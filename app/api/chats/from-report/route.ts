import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveChat, type Chat } from "@/lib/chatStore";
import { getReport } from "@/lib/reportStore";

// Start een chat met een deal-rapport als achtergrondcontext, zodat je
// vervolgvragen over de analyse kunt stellen.
export async function POST(request: Request) {
  let reportId: unknown;
  try {
    ({ reportId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof reportId !== "string") {
    return NextResponse.json({ error: "Ongeldig rapport-ID" }, { status: 400 });
  }

  const saved = await getReport(reportId);
  if (!saved) {
    return NextResponse.json({ error: "Rapport niet gevonden" }, { status: 404 });
  }

  const company = saved.report.company.name || saved.company;
  const now = new Date().toISOString();
  const chat: Chat = {
    id: randomUUID(),
    title: `Rapport: ${company}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: `De gebruiker bespreekt een eerder gegenereerd due-diligence-rapport over "${company}" (gemaakt op ${saved.createdAt.slice(0, 10)}). Gebruik dit rapport als feitelijke basis voor je antwoorden:\n\n${JSON.stringify(saved.report, null, 2)}${
      saved.citations.length
        ? `\n\nGebruikte bronnen:\n${saved.citations.map((c) => `- ${c.title} (${c.url})`).join("\n")}`
        : ""
    }`,
  };
  await saveChat(chat);

  return NextResponse.json({ chatId: chat.id });
}
