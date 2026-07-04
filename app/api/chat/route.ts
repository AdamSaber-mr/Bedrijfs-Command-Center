import Anthropic from "@anthropic-ai/sdk";
import { getChat, newChat, saveChat } from "@/lib/chatStore";
import { getSettings } from "@/lib/settings";

export const maxDuration = 300;

const systemPrompt = (name: string) => `Je bent een zakelijke AI-assistent in het Bedrijfs Command Center van ${name}.
Je helpt met business-vragen, strategie, analyses en algemene ondersteuning.
Antwoord in het Nederlands (tenzij de gebruiker een andere taal gebruikt), helder en zakelijk maar toegankelijk.
Houd antwoorden beknopt waar het kan en gestructureerd waar het helpt.`;

// Demo-modus: een mock-antwoord dat woord voor woord wordt gestreamd, zodat
// de volledige chatflow (streamen, stoppen, regenereren, opslaan, exporteren)
// zonder Anthropic-API te testen is.
function demoReply(userMessage: string): string {
  const quoted = userMessage.slice(0, 140);
  return [
    `**Demo-modus actief** — dit antwoord komt niet van Claude, maar wordt lokaal gegenereerd.`,
    ``,
    `Je vroeg: “${quoted}”`,
    ``,
    `In demo-modus werkt de hele app zoals normaal, alleen zonder API-kosten:`,
    ``,
    `- Antwoorden **streamen** woord voor woord het scherm in`,
    `- De **stop-knop** bewaart het gedeeltelijke antwoord`,
    `- **Opnieuw genereren** vervangt dit antwoord`,
    `- De chat wordt opgeslagen in \`data/chats/\` en telt mee voor de export`,
    ``,
    `Ook syntax highlighting doet het gewoon:`,
    ``,
    "```ts",
    `const antwoord = await assistant.beantwoord("${quoted.slice(0, 40).replace(/"/g, "'")}");`,
    `console.log(antwoord);`,
    "```",
    ``,
    `Zet demo-modus uit via **Instellingen → Demo-modus** zodra er API-tegoed is.`,
  ].join("\n");
}

// Genereer met Haiku een korte, herkenbare titel na de eerste uitwisseling —
// beter dan de eerste 60 tekens van het bericht.
async function generateTitle(client: Anthropic, userMessage: string, answer: string) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 50,
    system:
      "Vat het gespreksonderwerp samen als een korte titel van maximaal 5 woorden, in de taal van het gesprek. Antwoord uitsluitend met de titel zelf — geen aanhalingstekens, geen punt.",
    messages: [
      {
        role: "user",
        content: `Vraag: ${userMessage.slice(0, 600)}\n\nAntwoord: ${answer.slice(0, 600)}`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  const title = block?.type === "text" ? block.text.trim().replace(/^["']|["']$/g, "") : "";
  return title.slice(0, 60);
}

export async function POST(request: Request) {
  let chatId: unknown, message: unknown, regenerate: unknown;
  try {
    ({ chatId, message, regenerate } = await request.json());
  } catch {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  let chat;
  if (regenerate === true) {
    // Opnieuw genereren: laatste assistent-antwoord vervangen door een nieuw.
    chat = typeof chatId === "string" ? await getChat(chatId) : null;
    if (!chat) {
      return Response.json({ error: "Chat niet gevonden" }, { status: 404 });
    }
    if (chat.messages[chat.messages.length - 1]?.role === "assistant") {
      chat.messages.pop();
    }
    if (chat.messages[chat.messages.length - 1]?.role !== "user") {
      return Response.json({ error: "Niets om opnieuw te genereren" }, { status: 400 });
    }
  } else {
    if (typeof message !== "string" || message.trim().length === 0) {
      return Response.json({ error: "Leeg bericht" }, { status: 400 });
    }
    const userMessage = message.trim();
    chat =
      (typeof chatId === "string" && (await getChat(chatId))) ||
      newChat(userMessage);
    chat.messages.push({
      role: "user",
      content: userMessage,
      at: new Date().toISOString(),
    });
  }

  const settings = await getSettings();

  // Demo-modus: stream een mock-antwoord zonder de Anthropic-API aan te roepen.
  if (settings.demoMode) {
    const encoder = new TextEncoder();
    const text = demoReply(
      chat.messages.filter((m) => m.role === "user").at(-1)?.content ?? ""
    );
    let full = "";
    let persisted = false;
    let cancelled = false;

    const persist = async () => {
      if (persisted || full.length === 0) return;
      persisted = true;
      chat.messages.push({
        role: "assistant",
        content: full,
        at: new Date().toISOString(),
      });
      await saveChat(chat);
    };

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Splits op spaties maar behoud ze, zodat het als echte tokens oogt.
          for (const part of text.split(/(?<= )/)) {
            if (cancelled) break;
            full += part;
            controller.enqueue(encoder.encode(part));
            await new Promise((r) => setTimeout(r, 14));
          }
          await persist();
          if (!cancelled) controller.close();
        } catch {
          await persist();
        }
      },
      async cancel() {
        cancelled = true;
        await persist();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Id": chat.id,
        "Cache-Control": "no-store",
      },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY ontbreekt. Voeg deze toe aan .env.local, of zet demo-modus aan via Instellingen.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic();
  const basePrompt = systemPrompt(settings.name);
  let system = settings.customInstructions
    ? `${basePrompt}\n\nAanvullende instructies van de gebruiker:\n${settings.customInstructions}`
    : basePrompt;
  if (chat.context) {
    system = `${system}\n\n${chat.context}`;
  }

  try {
    const stream = client.messages.stream({
      model: settings.model,
      max_tokens: settings.maxTokens,
      // Haiku ondersteunt geen adaptive thinking — parameter dan weglaten
      ...(settings.model.includes("haiku")
        ? {}
        : { thinking: { type: "adaptive" as const } }),
      system,
      messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Wacht op het eerste event vóór we een streaming-response starten:
    // API-fouten (billing, auth, rate limit) treden hier op en kunnen dan
    // nog als nette JSON-fout worden teruggegeven.
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();

    const encoder = new TextEncoder();
    let full = "";
    let persisted = false;

    const persist = async () => {
      if (persisted || full.length === 0) return;
      persisted = true;
      chat.messages.push({
        role: "assistant",
        content: full,
        at: new Date().toISOString(),
      });
      // Geef nieuwe chats na de eerste uitwisseling een korte AI-titel.
      if (chat.messages.length === 2 && !chat.context) {
        try {
          const title = await generateTitle(client, chat.messages[0].content, full);
          if (title) chat.title = title;
        } catch {
          // titel is nice-to-have — bij een fout blijft de standaardtitel staan
        }
      }
      await saveChat(chat);
    };

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const handle = (event: Anthropic.MessageStreamEvent) => {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        };
        try {
          if (!first.done) handle(first.value);
          while (true) {
            const { done, value } = await iterator.next();
            if (done) break;
            handle(value);
          }
          await persist();
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
      // De gebruiker drukte op stop of sloot het tabblad: bewaar wat er al
      // gestreamd is, zodat de chat bij heropenen klopt met wat er te zien was.
      async cancel() {
        stream.abort();
        await persist();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Id": chat.id,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.message.includes("credit balance")) {
      return Response.json(
        { error: "Onvoldoende tegoed op je Anthropic-account. Koop credits via platform.claude.com → Plans & Billing." },
        { status: 402 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "Ongeldige API-sleutel. Controleer ANTHROPIC_API_KEY in .env.local" },
        { status: 500 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Te veel aanvragen. Wacht even en probeer het opnieuw." },
        { status: 429 }
      );
    }
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Er ging iets mis. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
