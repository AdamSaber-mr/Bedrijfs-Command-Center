import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { RESEARCH_SCHEMA, type ResearchReport } from "@/lib/research";

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

async function runAnalysis(client: Anthropic, company: string, useWebSearch: boolean) {
  const baseParams = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: RESEARCH_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  };

  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt(company) },
  ];

  let response = await client.messages.create({
    ...baseParams,
    messages,
    ...(useWebSearch
      ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 }] }
      : {}),
  });

  // Server-side tools kunnen pauzeren; opnieuw insturen om te hervatten.
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < 4) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({
      ...baseParams,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
    });
    continuations++;
  }

  return response;
}

export async function POST(request: Request) {
  let company: unknown;
  try {
    ({ company } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof company !== "string" || company.trim().length < 2) {
    return NextResponse.json(
      { error: "Voer een geldige bedrijfsnaam in" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt. Voeg deze toe aan .env.local" },
      { status: 500 }
    );
  }

  const client = new Anthropic();
  const name = company.trim().slice(0, 120);

  try {
    let response: Anthropic.Message;
    try {
      response = await runAnalysis(client, name, true);
    } catch (err) {
      // Mocht de combinatie webzoeken + structured output geweigerd worden,
      // val dan terug op een analyse zonder webzoeken. Billing-fouten
      // hebben daar niets aan, dus die gaan direct door naar de foutafhandeling.
      if (err instanceof Anthropic.BadRequestError && !err.message.includes("credit balance")) {
        response = await runAnalysis(client, name, false);
      } else {
        throw err;
      }
    }

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Deze aanvraag kon niet worden verwerkt. Probeer een andere bedrijfsnaam." },
        { status: 422 }
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "De analyse werd afgekapt. Probeer het opnieuw." },
        { status: 502 }
      );
    }

    return NextResponse.json({ report: extractReport(response) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Ongeldige API-sleutel. Controleer ANTHROPIC_API_KEY in .env.local" },
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
    console.error("Research API error:", err);
    return NextResponse.json(
      { error: "Er ging iets mis bij het genereren van de analyse. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
