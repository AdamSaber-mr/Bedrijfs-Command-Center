import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUserId, userRoot } from "@/lib/auth";
import { listProjects } from "@/lib/projectStore";
import { listReports } from "@/lib/reportStore";
import { listWatches } from "@/lib/watchStore";
import { getSettings } from "@/lib/settings";

export const maxDuration = 120;

// De briefing kijkt alleen naar lokale pipeline-data (geen webzoeken) en is
// daardoor snel en goedkoop; de actualiteit komt uit de watch-updates.
const SYSTEM_PROMPT = `Je bent de pipeline-assistent van Vantage, een zakelijke AI-werkplek voor deal-research.

Je krijgt de actuele pipeline van de gebruiker als JSON: projecten met dealfase, deal-rapporten met scores, en gevolgde bedrijven met recente updates.

Schrijf een korte, direct bruikbare briefing in het Nederlands:
- Begin met de 2-3 belangrijkste acties voor vandaag, concreet geformuleerd ("Plan een vervolggesprek met X", niet "besteed aandacht aan X").
- Benoem wat stilstaat of veroudert (deals zonder recente activiteit, oude rapporten) en wat daaraan te doen.
- Licht opvallende updates van gevolgde bedrijven kort toe als die er zijn.
- Maximaal ±180 woorden, in korte alinea's of streepjes. Geen aanhef, geen afsluiting, geen markdown-koppen.
- Wees eerlijk: bij een lege of rustige pipeline zeg je dat gewoon en stel je één zinvolle volgende stap voor.`;

interface StoredBriefing {
  generatedAt: string;
  text: string;
}

async function briefingFile(): Promise<string> {
  const root = userRoot(await requireUserId());
  await fs.mkdir(root, { recursive: true });
  return path.join(root, "briefing.json");
}

export async function GET() {
  try {
    const briefing = JSON.parse(
      await fs.readFile(await briefingFile(), "utf-8")
    ) as StoredBriefing;
    return NextResponse.json({ briefing });
  } catch {
    return NextResponse.json({ briefing: null });
  }
}

async function pipelineSnapshot() {
  const [projects, reports, watches] = await Promise.all([
    listProjects(),
    listReports(),
    listWatches(),
  ]);
  const now = Date.now();
  const days = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86400000);
  return {
    vandaag: new Date().toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    projecten: projects.map((p) => ({
      naam: p.name,
      fase: p.stage,
      dagen_sinds_laatste_activiteit: days(p.updatedAt),
    })),
    rapporten: reports.slice(0, 15).map((r) => ({
      bedrijf: r.company,
      marktscore: r.marketScore,
      fitscore: r.fitScore,
      dagen_oud: days(r.createdAt),
    })),
    gevolgde_bedrijven: watches.map((w) => ({
      bedrijf: w.company,
      recente_updates: w.updates.slice(0, 5).map((u) => ({
        kop: u.headline,
        impact: u.impact,
        ongelezen: !u.read,
      })),
    })),
  };
}

export async function POST() {
  const settings = await getSettings();
  const snapshot = await pipelineSnapshot();

  if (settings.demoMode) {
    await new Promise((r) => setTimeout(r, 600));
    const briefing: StoredBriefing = {
      generatedAt: new Date().toISOString(),
      text: `Demo-briefing (voorbeeldtekst zonder API):\n\n- Plan vandaag een vervolgstap voor je meest recente deal — de pipeline telt ${snapshot.projecten.length} project(en) en ${snapshot.rapporten.length} rapport(en).\n- Ververs rapporten die ouder zijn dan twee maanden voordat je een gesprek ingaat.\n- Zet demo-modus uit via Instellingen voor een echte briefing op basis van jouw pipeline.`,
    };
    await fs.writeFile(await briefingFile(), JSON.stringify(briefing, null, 2), "utf-8");
    return NextResponse.json({ briefing });
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
  try {
    const response = await client.messages.create({
      model: settings.model,
      max_tokens: 1500,
      // Haiku ondersteunt geen adaptive thinking — zelfde uitzondering als in de chat.
      ...(settings.model.includes("haiku") ? {} : { thinking: { type: "adaptive" as const } }),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Hier is mijn actuele pipeline:\n\n${JSON.stringify(snapshot, null, 2)}\n\nSchrijf mijn briefing voor vandaag.`,
        },
      ],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Leeg antwoord van het model");

    const briefing: StoredBriefing = { generatedAt: new Date().toISOString(), text };
    await fs.writeFile(await briefingFile(), JSON.stringify(briefing, null, 2), "utf-8");
    return NextResponse.json({ briefing });
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.message.includes("credit balance")) {
      return NextResponse.json(
        { error: "Onvoldoende tegoed op je Anthropic-account. Koop credits via platform.claude.com → Plans & Billing." },
        { status: 402 }
      );
    }
    console.error("Briefing error:", err);
    return NextResponse.json(
      { error: "Er ging iets mis bij het genereren van de briefing. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
