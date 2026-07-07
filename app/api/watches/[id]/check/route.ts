import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  addUpdates,
  getWatch,
  UPDATE_CATEGORIES,
  type UpdateCategory,
  type UpdateImpact,
  type Watch,
  type WatchUpdate,
} from "@/lib/watchStore";
import { getReport } from "@/lib/reportStore";
import { getSettings } from "@/lib/settings";

// Een check kan even duren doordat het model eerst het web doorzoekt.
export const maxDuration = 300;

// Dagelijkse checks draaien op Sonnet: ruim goed genoeg voor nieuws-triage
// en een fractie van de kosten van Opus.
const MODEL = "claude-sonnet-5";

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    updates: {
      type: "array",
      description:
        "0 tot 5 werkelijk nieuwe, dealrelevante ontwikkelingen. Leeg als er niets noemenswaardigs is — dat is een prima uitkomst.",
      items: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Korte, feitelijke kop (max 12 woorden)" },
          summary: {
            type: "string",
            description:
              "Wat er gebeurd is en waarom dit relevant is voor een deal- of partnershipbeslissing (1-2 zinnen)",
          },
          category: { type: "string", enum: [...UPDATE_CATEGORIES] },
          impact: {
            type: "string",
            enum: ["laag", "middel", "hoog"],
            description: "Impact op een eventuele deal of samenwerking",
          },
          source_url: { type: "string", description: "URL van de belangrijkste bron, of leeg" },
          source_title: { type: "string", description: "Titel van die bron, of leeg" },
        },
        required: ["headline", "summary", "category", "impact", "source_url", "source_title"],
        additionalProperties: false,
      },
    },
  },
  required: ["updates"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Je bent een business-intelligence-monitor die gevolgde bedrijven bewaakt voor deal- en partnershipbeslissingen.

Werkwijze:
- Doorzoek het web op recent nieuws over het opgegeven bedrijf: financiële ontwikkelingen, product- of strategiewijzigingen, personeelswissels in de top, concurrentie-acties en juridische kwesties.
- Meld uitsluitend ontwikkelingen die NIEUW zijn sinds de opgegeven datum én relevant voor iemand die een deal of samenwerking met dit bedrijf overweegt.
- Geen opvulling: als er niets noemenswaardigs is, geef je een lege lijst terug. Dat is een goed antwoord.
- Geen dubbelingen van de meegegeven al-bekende koppen.
- Schrijf in het Nederlands, feitelijk en beknopt.`;

interface CheckResult {
  updates: {
    headline: string;
    summary: string;
    category: string;
    impact: string;
    source_url: string;
    source_title: string;
  }[];
}

function extractResult(response: Anthropic.Message): CheckResult {
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(textBlocks[i].text) as CheckResult;
    } catch {
      continue;
    }
  }
  throw new Error("Geen geldige JSON in het modelantwoord gevonden");
}

function userPrompt(watch: Watch, sinceLabel: string, context: string) {
  const known = watch.updates
    .slice(0, 10)
    .map((u) => `- ${u.headline}`)
    .join("\n");
  return `Check het bedrijf "${watch.company}" op nieuwe ontwikkelingen sinds ${sinceLabel}.
${context ? `\nContext over het bedrijf (ter disambiguatie):\n${context}\n` : ""}${
    known ? `\nDeze koppen zijn al bekend — niet opnieuw melden:\n${known}` : ""
  }`;
}

// Demo-modus: één herkenbare voorbeeld-update zodat de bel, het dashboard
// en het dossier zonder API te testen zijn.
function demoUpdates(company: string): Omit<WatchUpdate, "id" | "foundAt" | "read">[] {
  return [
    {
      headline: `${company} opent demo-vestiging in Rotterdam`,
      summary: `Voorbeeld-update over ${company}, lokaal gegenereerd zonder Anthropic-API. In de echte modus doorzoekt Claude het web op dealrelevant nieuws.`,
      category: "overig",
      impact: "middel",
      sourceUrl: "https://example.com/demo-bron",
      sourceTitle: "Demo-bron (voorbeeld, geen echte data)",
    },
  ];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) {
    return NextResponse.json({ error: "Watch niet gevonden" }, { status: 404 });
  }

  const settings = await getSettings();
  if (settings.demoMode) {
    await new Promise((r) => setTimeout(r, 800));
    const updated = await addUpdates(id, watch.updates.length === 0 ? demoUpdates(watch.company) : []);
    return NextResponse.json({ watch: updated });
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

  // Zonder eerdere check kijken we 30 dagen terug; daarna alleen wat er
  // sinds de vorige check bijgekomen is.
  const since = watch.lastCheckedAt
    ? new Date(watch.lastCheckedAt)
    : new Date(Date.now() - 30 * 24 * 3600_000);
  const sinceLabel = since.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Rapportcontext meegeven zodat het model het juiste bedrijf checkt
  // (bijv. niet een naamgenoot in een andere sector).
  let context = "";
  if (watch.reportId) {
    const report = await getReport(watch.reportId);
    if (report) {
      context = `${report.report.company.industry} — ${report.report.company.summary}`;
    }
  }

  const client = new Anthropic();
  try {
    const baseParams = {
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" as const },
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema" as const,
          schema: CHECK_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      tools: [
        { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 },
      ],
    };

    let messages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt(watch, sinceLabel, context) },
    ];
    let response = await client.messages.create({ ...baseParams, messages });
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < 3) {
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages.create({ ...baseParams, messages });
      continuations++;
    }

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "De check kon niet worden afgerond. Probeer het later opnieuw." },
        { status: 502 }
      );
    }

    const result = extractResult(response);
    const cleaned = result.updates.slice(0, 5).map((u) => ({
      headline: u.headline.slice(0, 160),
      summary: u.summary.slice(0, 600),
      category: (UPDATE_CATEGORIES as readonly string[]).includes(u.category)
        ? (u.category as UpdateCategory)
        : ("overig" as UpdateCategory),
      impact: (["laag", "middel", "hoog"] as const).includes(u.impact as UpdateImpact)
        ? (u.impact as UpdateImpact)
        : ("laag" as UpdateImpact),
      ...(u.source_url ? { sourceUrl: u.source_url } : {}),
      ...(u.source_title ? { sourceTitle: u.source_title } : {}),
    }));

    const updated = await addUpdates(id, cleaned);
    return NextResponse.json({ watch: updated });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "De API-sleutel is ongeldig. Vraag de beheerder de configuratie te controleren." },
        { status: 500 }
      );
    }
    if (err instanceof Anthropic.APIError && err.message.includes("credit balance")) {
      return NextResponse.json(
        { error: "Onvoldoende tegoed op je Anthropic-account. Koop credits via platform.claude.com → Plans & Billing." },
        { status: 402 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Te veel aanvragen. Wacht even en probeer het opnieuw." },
        { status: 429 }
      );
    }
    console.error("Watch check error:", err);
    return NextResponse.json(
      { error: "Er ging iets mis bij het checken op updates. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
