import Anthropic from "@anthropic-ai/sdk";
import { getChat, newChat, saveChat } from "@/lib/chatStore";

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Je bent een zakelijke AI-assistent in het Bedrijfs Command Center van Adam.
Je helpt met business-vragen, strategie, analyses en algemene ondersteuning.
Antwoord in het Nederlands (tenzij de gebruiker een andere taal gebruikt), helder en zakelijk maar toegankelijk.
Houd antwoorden beknopt waar het kan en gestructureerd waar het helpt.`;

export async function POST(request: Request) {
  let chatId: unknown, message: unknown;
  try {
    ({ chatId, message } = await request.json());
  } catch {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json({ error: "Leeg bericht" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Voeg deze toe aan .env.local" },
      { status: 500 }
    );
  }

  const userMessage = message.trim();
  const chat =
    (typeof chatId === "string" && (await getChat(chatId))) ||
    newChat(userMessage);
  chat.messages.push({ role: "user", content: userMessage });

  const client = new Anthropic();

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Wacht op het eerste event vóór we een streaming-response starten:
    // API-fouten (billing, auth, rate limit) treden hier op en kunnen dan
    // nog als nette JSON-fout worden teruggegeven.
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = "";
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
          // Pas opslaan als het antwoord compleet is — zo bevat de
          // trainingsdata alleen volledige beurten.
          chat.messages.push({ role: "assistant", content: full });
          await saveChat(chat);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
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
