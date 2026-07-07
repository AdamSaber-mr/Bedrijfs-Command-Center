import Anthropic from "@anthropic-ai/sdk";
import { getChat, newChat, saveChat, type ChatAttachment, type ChatMessage } from "@/lib/chatStore";
import { getProject, type Project, type ProjectDocument } from "@/lib/projectStore";
import { getSettings } from "@/lib/settings";
import { MODEL_OPTIONS } from "@/lib/settingsShared";

// Toegestane bijlagetypes en limieten (base64 telt ~33% zwaarder dan het
// bestand zelf; de API accepteert requests tot 32 MB).
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const TEXT_TYPES = ["text/plain", "text/markdown", "text/csv"] as const;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // per bestand (na base64)
const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // per bericht (na base64)

// Valideert en normaliseert bijlagen uit de request body.
function sanitizeAttachments(input: unknown): ChatAttachment[] | { error: string } {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return { error: "Ongeldige bijlagen" };
  if (input.length > 5) return { error: "Maximaal 5 bijlagen per bericht." };
  const result: ChatAttachment[] = [];
  let total = 0;
  for (const raw of input) {
    const { name, mediaType, data } = (raw ?? {}) as Record<string, unknown>;
    if (typeof name !== "string" || typeof mediaType !== "string" || typeof data !== "string") {
      return { error: "Ongeldige bijlage" };
    }
    const type = mediaType.toLowerCase();
    const allowed =
      type === "application/pdf" ||
      (IMAGE_TYPES as readonly string[]).includes(type) ||
      (TEXT_TYPES as readonly string[]).includes(type);
    if (!allowed) {
      return { error: `Bestandstype ${type} wordt niet ondersteund (PDF, afbeelding of tekst).` };
    }
    if (data.length > MAX_ATTACHMENT_BYTES) {
      return { error: `"${name}" is te groot (max ~7 MB per bestand).` };
    }
    total += data.length;
    if (total > MAX_TOTAL_BYTES) {
      return { error: "De bijlagen zijn samen te groot voor één bericht." };
    }
    result.push({
      name: name.slice(0, 120),
      mediaType: type,
      // Base64 mag geen witruimte/newlines bevatten voor de API.
      data: data.replace(/\s/g, ""),
    });
  }
  return result;
}

// Zet een bestand (bijlage of projectdocument) om naar een content block:
// PDF → document-block, afbeelding → image-block, tekst → gedecodeerd tekstblok.
function fileBlock(file: { name: string; mediaType: string; data: string }): Anthropic.ContentBlockParam {
  if (file.mediaType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: file.data },
    };
  }
  if ((IMAGE_TYPES as readonly string[]).includes(file.mediaType)) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: file.mediaType as (typeof IMAGE_TYPES)[number],
        data: file.data,
      },
    };
  }
  // Tekstbestand: inhoud decoderen en als tekstblok meesturen.
  const text = Buffer.from(file.data, "base64").toString("utf-8").slice(0, 200_000);
  return { type: "text", text: `Inhoud van bijlage "${file.name}":\n\n${text}` };
}

// Bouwt de API-berichten: tekst blijft een string; berichten met bijlagen
// worden content blocks (document/afbeelding vóór het tekstblok).
function toApiMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role !== "user" || !m.attachments?.length) {
      return { role: m.role, content: m.content };
    }
    const blocks: Anthropic.ContentBlockParam[] = m.attachments.map(fileBlock);
    if (m.content) blocks.push({ type: "text", text: m.content });
    return { role: m.role, content: blocks };
  });
}

// Projectdocumenten gaan als synthetische uitwisseling VOORAAN in de
// API-berichten mee (niet opgeslagen in de chat zelf). Het laatste blok van
// het user-bericht krijgt een cache-breakpoint, zodat de documenten maar één
// keer per 5 minuten volledig verwerkt worden.
function projectDocumentMessages(documents: ProjectDocument[]): Anthropic.MessageParam[] {
  const blocks: Anthropic.ContentBlockParam[] = documents.map(fileBlock);
  blocks.push({
    type: "text",
    text: "Dit zijn de documenten van dit project als achtergrondcontext.",
    cache_control: { type: "ephemeral" },
  });
  return [
    { role: "user", content: blocks },
    { role: "assistant", content: "Begrepen — ik gebruik deze projectdocumenten als context." },
  ];
}

// Cache-breakpoint op het laatste content-blok van het laatste bericht:
// het aanbevolen patroon voor multi-turn gesprekken, waarbij elke beurt de
// volledige eerdere geschiedenis uit de cache herleest.
function withHistoryCacheBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const last = messages[messages.length - 1];
  if (!last) return messages;
  let content: Anthropic.ContentBlockParam[];
  if (typeof last.content === "string") {
    if (!last.content) return messages;
    content = [
      { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
    ];
  } else {
    const blocks = last.content;
    content = blocks.map((block, i) =>
      i === blocks.length - 1
        ? { ...block, cache_control: { type: "ephemeral" as const } }
        : block
    );
  }
  return [...messages.slice(0, -1), { role: last.role, content }];
}

export const maxDuration = 300;

const systemPrompt = (name: string) => `Je bent een zakelijke AI-assistent in Vantage${name ? `, de werkruimte van ${name}` : ""}.
Je helpt met business-vragen, strategie, analyses en algemene ondersteuning.
Antwoord in het Nederlands (tenzij de gebruiker een andere taal gebruikt), helder en zakelijk maar toegankelijk.
Houd antwoorden beknopt waar het kan en gestructureerd waar het helpt.
Je kunt het web doorzoeken: doe dat bij vragen over actuele ontwikkelingen, cijfers, bedrijven of nieuws, en baseer je antwoord dan op wat je vindt in plaats van op je eigen kennis.`;

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
    `- De chat wordt automatisch bewaard en telt mee voor de export`,
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
  let chatId: unknown, message: unknown, regenerate: unknown, replaceFrom: unknown, model: unknown, attachments: unknown, projectId: unknown;
  try {
    ({ chatId, message, regenerate, replaceFrom, model, attachments, projectId } = await request.json());
  } catch {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const atts = sanitizeAttachments(attachments);
  if (!Array.isArray(atts)) {
    return Response.json({ error: atts.error }, { status: 400 });
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
    const userMessage = typeof message === "string" ? message.trim() : "";
    // Een bericht mag leeg zijn als er bijlagen zijn ("analyseer dit bestand").
    if (userMessage.length === 0 && atts.length === 0) {
      return Response.json({ error: "Leeg bericht" }, { status: 400 });
    }
    chat =
      (typeof chatId === "string" && (await getChat(chatId))) ||
      newChat(userMessage || (atts[0] ? `Bijlage: ${atts[0].name}` : "Nieuw gesprek"));
    // Nieuwe chat vanuit een projectpagina: koppel aan het project.
    if (
      !chat.projectId &&
      typeof projectId === "string" &&
      /^[a-zA-Z0-9-]+$/.test(projectId) &&
      (await getProject(projectId))
    ) {
      chat.projectId = projectId;
    }
    // Bewerken van een eerder bericht: kap het gesprek af vóór dat bericht,
    // zodat de aangepaste versie en een nieuw antwoord de rest vervangen.
    if (
      typeof replaceFrom === "number" &&
      Number.isInteger(replaceFrom) &&
      replaceFrom >= 0 &&
      replaceFrom < chat.messages.length
    ) {
      chat.messages = chat.messages.slice(0, replaceFrom);
    }
    chat.messages.push({
      role: "user",
      content: userMessage,
      at: new Date().toISOString(),
      ...(atts.length > 0 ? { attachments: atts } : {}),
    });
  }

  const settings = await getSettings();

  // Per-chat modelkeuze: meegestuurde keuze bewaren op de chat; anders de
  // eerder bewaarde keuze; anders de standaard uit Instellingen.
  if (typeof model === "string" && MODEL_OPTIONS.some((m) => m.id === model)) {
    chat.model = model;
  }
  const chatModel =
    chat.model && MODEL_OPTIONS.some((m) => m.id === chat.model)
      ? chat.model
      : settings.model;

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
          "De AI-verbinding is nog niet ingesteld. Zet demo-modus aan via Instellingen, of vraag de beheerder de API-sleutel te configureren.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic();
  const basePrompt = systemPrompt(settings.name);
  let system = settings.customInstructions
    ? `${basePrompt}\n\nAanvullende instructies van de gebruiker:\n${settings.customInstructions}`
    : basePrompt;
  // Projectcontext: naam en instructies van het gekoppelde project gaan mee;
  // de projectdocumenten gaan verderop als content blocks in de berichten mee.
  let project: Project | null = null;
  if (chat.projectId) {
    project = await getProject(chat.projectId);
    if (project) {
      system = `${system}\n\nDit gesprek hoort bij het project "${project.name}".${
        project.description ? ` ${project.description}` : ""
      }${project.instructions ? `\n\nProjectinstructies:\n${project.instructions}` : ""}`;
    }
  }
  if (chat.context) {
    system = `${system}\n\n${chat.context}`;
  }

  try {
    const baseParams = {
      model: chatModel,
      max_tokens: settings.maxTokens,
      // Haiku ondersteunt geen adaptive thinking — parameter dan weglaten
      ...(chatModel.includes("haiku")
        ? {}
        : { thinking: { type: "adaptive" as const } }),
      // Systeemprompt als tekstblok met cache-breakpoint: de (grotendeels
      // stabiele) prompt wordt dan maar één keer per 5 minuten verwerkt.
      system: [
        {
          type: "text" as const,
          text: system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
    };
    const startStream = (msgs: Anthropic.MessageParam[], withSearch: boolean) =>
      client.messages.stream({
        ...baseParams,
        messages: msgs,
        // Webzoeken zodat de chat ook actuele vragen aankan; het model
        // beslist zelf of zoeken nodig is.
        ...(withSearch
          ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 }] }
          : {}),
      });

    // Gespreksgeschiedenis met incrementeel cache-breakpoint; documenten van
    // het project gaan als synthetische uitwisseling vooraan mee (de rol-
    // volgorde blijft kloppen: user → assistant → user …). In totaal maximaal
    // drie breakpoints: systeemprompt, projectdocumenten en geschiedenis.
    let apiMessages = withHistoryCacheBreakpoint(toApiMessages(chat.messages));
    if (project?.documents?.length) {
      apiMessages = [...projectDocumentMessages(project.documents), ...apiMessages];
    }
    let searchEnabled = true;
    let stream = startStream(apiMessages, true);

    // Wacht op het eerste event vóór we een streaming-response starten:
    // API-fouten (billing, auth, rate limit) treden hier op en kunnen dan
    // nog als nette JSON-fout worden teruggegeven.
    let iterator = stream[Symbol.asyncIterator]();
    let first: IteratorResult<Anthropic.MessageStreamEvent>;
    try {
      first = await iterator.next();
    } catch (err) {
      // Mocht webzoeken geweigerd worden (bv. i.c.m. bepaalde bijlagen),
      // val dan terug op een gewone chat zonder zoeken.
      if (err instanceof Anthropic.BadRequestError && !err.message.includes("credit balance")) {
        searchEnabled = false;
        stream = startStream(apiMessages, false);
        iterator = stream[Symbol.asyncIterator]();
        first = await iterator.next();
      } else {
        throw err;
      }
    }

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

    // Bronnen die het model daadwerkelijk citeert uit webzoekresultaten,
    // om als nette lijst onder het antwoord te zetten.
    const sources = new Map<string, string>();
    const collectSources = (content: Anthropic.ContentBlock[]) => {
      for (const block of content) {
        if (block.type === "text" && Array.isArray(block.citations)) {
          for (const c of block.citations) {
            if (c.type === "web_search_result_location" && c.url && !sources.has(c.url)) {
              sources.set(c.url, c.title || c.url);
            }
          }
        }
      }
    };

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (text: string) => {
          full += text;
          controller.enqueue(encoder.encode(text));
        };
        const handle = (event: Anthropic.MessageStreamEvent) => {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emit(event.delta.text);
          }
        };
        try {
          if (!first.done) handle(first.value);
          while (true) {
            const { done, value } = await iterator.next();
            if (done) break;
            handle(value);
          }
          let final = await stream.finalMessage();
          collectSources(final.content);
          // Webzoeken kan de beurt pauzeren; hervat tot het antwoord af is.
          let continuations = 0;
          while (searchEnabled && final.stop_reason === "pause_turn" && continuations < 3) {
            apiMessages = [...apiMessages, { role: "assistant", content: final.content }];
            stream = startStream(apiMessages, true);
            for await (const event of stream) handle(event);
            final = await stream.finalMessage();
            collectSources(final.content);
            continuations++;
          }
          if (sources.size > 0) {
            const list = [...sources.entries()]
              .slice(0, 8)
              .map(([url, title]) => `- [${title}](${url})`)
              .join("\n");
            emit(`\n\n**Bronnen**\n${list}`);
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
        { error: "De API-sleutel is ongeldig. Vraag de beheerder de configuratie te controleren." },
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
