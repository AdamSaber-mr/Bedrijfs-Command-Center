import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { RESEARCH_SCHEMA, type ResearchReport } from "@/lib/research";
import { getReport, saveReport, type Citation } from "@/lib/reportStore";
import { getSettings } from "@/lib/settings";

// Demo-modus: een herkenbaar voorbeeldrapport zodat de hele research-flow
// (laden, opslaan, sidebar, bronnen, chat-over-rapport) zonder API te testen is.
// Scores zijn deterministisch afgeleid van de bedrijfsnaam.
function demoReport(company: string): ResearchReport {
  let hash = 0;
  for (const ch of company) hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
  const marketScore = 40 + (hash % 55);
  const fitScore = 35 + ((hash >> 2) % 60);
  return {
    company: {
      name: company,
      industry: "Demo-sector",
      headquarters: "Amsterdam, Nederland",
      founded: "2015",
      size: "±120 medewerkers (voorbeeld)",
      summary: `Dit is een demo-rapport over ${company}, lokaal gegenereerd zonder Anthropic-API. Alle cijfers en teksten zijn voorbeelddata om de app te testen.`,
    },
    market_position: {
      score: marketScore,
      position: marketScore >= 70 ? "Marktleider (demo)" : "Uitdager (demo)",
      strengths: [
        "Voorbeeldsterkte: sterk merk in de thuismarkt",
        "Voorbeeldsterkte: efficiënte operatie",
        "Voorbeeldsterkte: loyale klantenbasis",
      ],
      trends: [
        "Voorbeeldtrend: toenemende digitalisering",
        "Voorbeeldtrend: consolidatie in de sector",
      ],
      analysis: `Demo-analyse van de marktpositie van ${company}. In de echte modus doorzoekt Claude actuele bronnen en onderbouwt het deze sectie met feiten en cijfers.`,
    },
    competitors: [
      { name: "Concurrent Alfa", description: "Grootste directe concurrent in dit demo-scenario.", threat_level: "hoog" },
      { name: "Concurrent Beta", description: "Uitdager met overlappend aanbod.", threat_level: "middel" },
      { name: "Concurrent Gamma", description: "Nichespeler met beperkte overlap.", threat_level: "laag" },
    ],
    partnership_fit: {
      score: fitScore,
      ideal_partner_profile: "Demo-profiel: partijen met complementaire technologie en een gedeelde doelgroep.",
      opportunities: [
        "Voorbeeldkans: gezamenlijke propositie richting mkb",
        "Voorbeeldkans: data-uitwisseling en integraties",
        "Voorbeeldkans: co-marketing in de Benelux",
      ],
      analysis: `Demo-onderbouwing van de partnership-fit met ${company}.`,
    },
    risks: [
      { title: "Demo-risico: afhankelijkheid van één markt", severity: "middel", description: "Voorbeeldrisico ter illustratie van de rapportweergave." },
      { title: "Demo-risico: regelgeving", severity: "laag", description: "Voorbeeldrisico ter illustratie." },
    ],
    conclusion: `Dit is een demo-conclusie over ${company}. Zet demo-modus uit via Instellingen en voer de analyse opnieuw uit zodra er API-tegoed is — dan is het rapport gebaseerd op actuele bronnen.`,
  };
}

// Analyses met webzoeken kunnen enkele minuten duren.
export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Je bent een senior business-intelligence-analist die due-diligence-rapporten schrijft voor deal- en partnershipbeslissingen.

Werkwijze:
- Gebruik webzoeken om actuele, feitelijke informatie over het bedrijf te verzamelen (recente ontwikkelingen, financiën, concurrentielandschap).
- Wees concreet en onderbouwd: benoem feiten en cijfers waar mogelijk, geen vage algemeenheden.
- Wees eerlijk over onzekerheid: als informatie niet te vinden is, zeg dat expliciet in plaats van te gokken.
- Scores zijn onderbouwde inschattingen: marktpositie-score weegt marktaandeel, groei, merk en differentiatie; partnership-score weegt strategische complementariteit, stabiliteit en bereikbaarheid als partner.
- Schrijf het volledige rapport in het Nederlands, in zakelijke maar heldere taal.`;

function userPrompt(company: string) {
  return `Maak een volledige business-analyse van het bedrijf "${company}". Onderzoek de marktpositie, de belangrijkste concurrenten, de partnership-fit en de risico's.`;
}

// NDJSON-events die de route naar de client stuurt (één JSON-object per regel):
// {type:"status", text}            — fase-overgang in de analyse
// {type:"source", url, title}      — live gevonden webbron (gededupliceerd)
// {type:"done", saved}             — het opgeslagen rapport
// {type:"error", error, status}    — fout, met dezelfde teksten/semantiek als voorheen
type Emit = (event: Record<string, unknown>) => void;

// Bundelt status-deduplicatie (alleen bij fase-overgang sturen) en
// bron-deduplicatie op URL over álle beurten heen.
function makeProgress(emit: Emit) {
  let lastStatus = "";
  const seenUrls = new Set<string>();
  return {
    status(text: string) {
      if (text === lastStatus) return;
      lastStatus = text;
      emit({ type: "status", text });
    },
    source(url: unknown, title: unknown) {
      if (typeof url !== "string" || !url || seenUrls.has(url)) return;
      seenUrls.add(url);
      emit({
        type: "source",
        url,
        title: typeof title === "string" && title ? title : url,
      });
    },
  };
}
type Progress = ReturnType<typeof makeProgress>;

// Verpakt het werk in een NDJSON-stream (application/x-ndjson). Fouten ná de
// start van de stream gaan als {type:"error"}-regel naar de client, omdat de
// HTTP-status dan al verstuurd is.
function ndjsonStream(run: (emit: Emit) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Client heeft de verbinding gesloten (bv. geannuleerd) — negeren.
        }
      };
      try {
        await run(emit);
      } catch (err) {
        console.error("Research stream error:", err);
        emit({
          type: "error",
          error: "Er ging iets mis bij het genereren van de analyse. Probeer het opnieuw.",
          status: 500,
        });
      } finally {
        try {
          controller.close();
        } catch {
          // al gesloten
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function extractReport(response: Anthropic.Message): ResearchReport {
  // Bij structured outputs bevat het laatste tekstblok de gevalideerde JSON;
  // eerdere tekstblokken kunnen tussenliggende zoek-narratie bevatten.
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(textBlocks[i].text) as ResearchReport;
    } catch {
      continue;
    }
  }
  throw new Error("Geen geldige JSON in het modelantwoord gevonden");
}

// Verzamelt geciteerde bronnen uit alle assistant-content (ook tussenbeurten
// bij pause_turn), zodat het rapport toont waarop het gebaseerd is.
function extractCitations(allContent: Anthropic.ContentBlock[]): Citation[] {
  const seen = new Map<string, Citation>();
  const add = (url: unknown, title: unknown) => {
    if (typeof url !== "string" || !url) return;
    if (!seen.has(url)) {
      seen.set(url, {
        url,
        title: typeof title === "string" && title ? title : url,
      });
    }
  };

  // Voorkeur: bronnen die het model daadwerkelijk citeert in tekstblokken.
  for (const block of allContent) {
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c.type === "web_search_result_location") add(c.url, c.title);
      }
    }
  }

  // Terugval: gevonden zoekresultaten als er geen expliciete citaties zijn.
  if (seen.size === 0) {
    for (const block of allContent) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === "web_search_result") add(item.url, item.title);
        }
      }
    }
  }

  return [...seen.values()].slice(0, 12);
}

// Cache-breakpoint op het laatste assistant-tekstblok bij continuaties
// (multi-turn patroon uit de caching-documentatie). Alleen op tekstblokken:
// thinking- en server-tool-blokken accepteren geen cache_control.
function withCacheBreakpoint(
  content: Anthropic.ContentBlock[]
): Anthropic.ContentBlockParam[] {
  const last = content[content.length - 1];
  if (!last || last.type !== "text") return content;
  return [
    ...content.slice(0, -1),
    { ...last, cache_control: { type: "ephemeral" } } as Anthropic.ContentBlockParam,
  ];
}

// Eén modelbeurt streamen: leidt live voortgang af uit echte stream-events
// (server_tool_use = zoeken, web_search_tool_result = resultaten binnen,
// text = rapport schrijven) en levert daarna het volledige bericht op.
async function streamTurn(
  client: Anthropic,
  params: Anthropic.MessageStreamParams,
  progress: Progress
): Promise<Anthropic.Message> {
  const stream = client.messages.stream(params);
  for await (const event of stream) {
    if (event.type !== "content_block_start") continue;
    const block = event.content_block;
    if (block.type === "thinking") {
      progress.status("Informatie afwegen…");
    } else if (block.type === "server_tool_use") {
      progress.status("Web doorzoeken…");
    } else if (block.type === "web_search_tool_result") {
      progress.status("Bronnen lezen…");
      if (Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === "web_search_result") progress.source(item.url, item.title);
        }
      }
    } else if (block.type === "text") {
      progress.status("Rapport samenstellen…");
    }
  }
  return stream.finalMessage();
}

async function runAnalysis(
  client: Anthropic,
  company: string,
  useWebSearch: boolean,
  progress: Progress
) {
  const baseParams = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    // Prompt caching: system als blok-array met cache_control op het laatste
    // blok — scheelt vooral bij pause_turn-continuaties en de fallback-retry,
    // waar dezelfde prefix opnieuw wordt ingestuurd.
    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: RESEARCH_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  };
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 },
  ];
  const firstMessage: Anthropic.MessageParam = {
    role: "user",
    content: userPrompt(company),
  };

  let response = await streamTurn(
    client,
    { ...baseParams, messages: [firstMessage], ...(useWebSearch ? { tools } : {}) },
    progress
  );

  // Server-side tools kunnen pauzeren; opnieuw streamen om te hervatten.
  // Bewaar de content van álle beurten, zodat citaties niet verloren gaan.
  // De messages worden per beurt opnieuw opgebouwd zodat alleen de laatste
  // assistant-beurt een cache-breakpoint draagt (max 4 breakpoints per request).
  let allContent: Anthropic.ContentBlock[] = [...response.content];
  const assistantTurns: Anthropic.ContentBlock[][] = [];
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < 4) {
    progress.status("Onderzoek hervatten…");
    assistantTurns.push(response.content);
    const messages: Anthropic.MessageParam[] = [
      firstMessage,
      ...assistantTurns.map((content, i) => ({
        role: "assistant" as const,
        content:
          i === assistantTurns.length - 1 ? withCacheBreakpoint(content) : content,
      })),
    ];
    response = await streamTurn(client, { ...baseParams, messages, tools }, progress);
    allContent = [...allContent, ...response.content];
    continuations++;
  }

  return { response, allContent };
}

export async function POST(request: Request) {
  let company: unknown, previousReportId: unknown;
  try {
    ({ company, previousReportId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof company !== "string" || company.trim().length < 2) {
    return NextResponse.json(
      { error: "Voer een geldige bedrijfsnaam in" },
      { status: 400 }
    );
  }

  const name = company.trim().slice(0, 120);
  const settings = await getSettings();

  // "Ververs analyse": koppel het nieuwe rapport aan het vorige, zodat de
  // UI kan tonen wat er veranderd is. Het project erft mee.
  let refreshMeta: { previousReportId?: string; projectId?: string } | undefined;
  if (typeof previousReportId === "string" && /^[a-zA-Z0-9-]+$/.test(previousReportId)) {
    const previous = await getReport(previousReportId);
    if (previous) {
      refreshMeta = { previousReportId, projectId: previous.projectId };
    }
  }

  if (settings.demoMode) {
    // Demo-modus: simuleer een paar voortgangs-events met korte vertragingen,
    // zodat de laad-ervaring realistisch blijft.
    return ndjsonStream(async (emit) => {
      const progress = makeProgress(emit);
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      progress.status("Web doorzoeken…");
      await wait(600);
      progress.source(
        "https://example.com/demo-bron",
        "Demo-bron (voorbeeld, geen echte data)"
      );
      await wait(400);
      progress.status("Bronnen lezen…");
      await wait(400);
      progress.status("Rapport samenstellen…");
      await wait(500);
      const saved = await saveReport(
        name,
        demoReport(name),
        [{ url: "https://example.com/demo-bron", title: "Demo-bron (voorbeeld, geen echte data)" }],
        true,
        refreshMeta
      );
      emit({ type: "done", saved });
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "De AI-verbinding is nog niet ingesteld. Zet demo-modus aan via Instellingen, of vraag de beheerder de API-sleutel te configureren.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic();

  return ndjsonStream(async (emit) => {
    const progress = makeProgress(emit);
    try {
      progress.status("Analyse starten…");
      let result: Awaited<ReturnType<typeof runAnalysis>>;
      let webSearchUsed = true;
      try {
        result = await runAnalysis(client, name, true, progress);
      } catch (err) {
        // Mocht de combinatie webzoeken + structured output geweigerd worden,
        // val dan terug op een analyse zonder webzoeken. Billing-fouten
        // hebben daar niets aan, dus die gaan direct door naar de foutafhandeling.
        if (err instanceof Anthropic.BadRequestError && !err.message.includes("credit balance")) {
          progress.status("Opnieuw proberen zonder webzoeken…");
          result = await runAnalysis(client, name, false, progress);
          webSearchUsed = false;
        } else {
          throw err;
        }
      }

      const { response, allContent } = result;
      if (response.stop_reason === "refusal") {
        emit({
          type: "error",
          error: "Deze aanvraag kon niet worden verwerkt. Probeer een andere bedrijfsnaam.",
          status: 422,
        });
        return;
      }
      if (response.stop_reason === "max_tokens") {
        emit({
          type: "error",
          error: "De analyse werd afgekapt. Probeer het opnieuw.",
          status: 502,
        });
        return;
      }

      progress.status("Rapport opslaan…");
      const report = extractReport(response);
      const saved = await saveReport(
        name,
        report,
        extractCitations(allContent),
        webSearchUsed,
        refreshMeta
      );
      emit({ type: "done", saved });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        emit({
          type: "error",
          error: "De API-sleutel is ongeldig. Vraag de beheerder de configuratie te controleren.",
          status: 500,
        });
        return;
      }
      if (err instanceof Anthropic.APIError && err.message.includes("credit balance")) {
        emit({
          type: "error",
          error: "Onvoldoende tegoed op je Anthropic-account. Koop credits via platform.claude.com → Plans & Billing.",
          status: 402,
        });
        return;
      }
      if (err instanceof Anthropic.RateLimitError) {
        emit({
          type: "error",
          error: "Te veel aanvragen. Wacht even en probeer het opnieuw.",
          status: 429,
        });
        return;
      }
      console.error("Research API error:", err);
      emit({
        type: "error",
        error: "Er ging iets mis bij het genereren van de analyse. Probeer het opnieuw.",
        status: 500,
      });
    }
  });
}
