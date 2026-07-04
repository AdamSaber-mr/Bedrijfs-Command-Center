import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { RESEARCH_SCHEMA, type ResearchReport } from "@/lib/research";
import { saveReport, type Citation } from "@/lib/reportStore";
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
  // Bewaar de content van álle beurten, zodat citaties niet verloren gaan.
  let allContent: Anthropic.ContentBlock[] = [...response.content];
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < 4) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({
      ...baseParams,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
    });
    allContent = [...allContent, ...response.content];
    continuations++;
  }

  return { response, allContent };
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

  const name = company.trim().slice(0, 120);
  const settings = await getSettings();

  if (settings.demoMode) {
    // Kleine vertraging zodat de laad-ervaring realistisch blijft.
    await new Promise((r) => setTimeout(r, 1500));
    const saved = await saveReport(name, demoReport(name), [
      { url: "https://example.com/demo-bron", title: "Demo-bron (voorbeeld, geen echte data)" },
    ]);
    return NextResponse.json({ saved });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY ontbreekt. Voeg deze toe aan .env.local, of zet demo-modus aan via Instellingen.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic();

  try {
    let result: Awaited<ReturnType<typeof runAnalysis>>;
    try {
      result = await runAnalysis(client, name, true);
    } catch (err) {
      // Mocht de combinatie webzoeken + structured output geweigerd worden,
      // val dan terug op een analyse zonder webzoeken. Billing-fouten
      // hebben daar niets aan, dus die gaan direct door naar de foutafhandeling.
      if (err instanceof Anthropic.BadRequestError && !err.message.includes("credit balance")) {
        result = await runAnalysis(client, name, false);
      } else {
        throw err;
      }
    }

    const { response, allContent } = result;
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

    const report = extractReport(response);
    const saved = await saveReport(name, report, extractCitations(allContent));
    return NextResponse.json({ saved });
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
