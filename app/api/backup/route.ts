import { NextResponse } from "next/server";
import { allChats, type Chat } from "@/lib/chatStore";
import { getReport, listReports, type SavedReport } from "@/lib/reportStore";
import { allNotes, type Note } from "@/lib/noteStore";
import { listPrompts, addPrompt, type PromptTemplate } from "@/lib/promptStore";
import { getSettings, saveSettings } from "@/lib/settings";
import { promises as fs } from "fs";
import path from "path";

// Volledige back-up van alle lokale data als één JSON-bestand.
export async function GET() {
  const reportSummaries = await listReports();
  const reports = (
    await Promise.all(reportSummaries.map((s) => getReport(s.id)))
  ).filter((r): r is SavedReport => r !== null);

  const backup = {
    app: "bedrijfs-command-center",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await getSettings(),
    chats: await allChats(),
    reports,
    notes: await allNotes(),
    prompts: await listPrompts(),
  };

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="command-center-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// Import: voegt alles uit de back-up toe (bestaande items met hetzelfde ID
// worden overschreven, niets wordt verwijderd).
export async function POST(request: Request) {
  let backup: {
    app?: unknown;
    chats?: unknown;
    reports?: unknown;
    notes?: unknown;
    prompts?: unknown;
    settings?: unknown;
  };
  try {
    backup = await request.json();
  } catch {
    return NextResponse.json({ error: "Geen geldig JSON-bestand" }, { status: 400 });
  }

  if (backup.app !== "bedrijfs-command-center") {
    return NextResponse.json(
      { error: "Dit is geen back-up van het Bedrijfs Command Center" },
      { status: 400 }
    );
  }

  const counts = { chats: 0, reports: 0, notes: 0, prompts: 0 };

  if (Array.isArray(backup.chats)) {
    const dir = path.join(process.cwd(), "data", "chats");
    await fs.mkdir(dir, { recursive: true });
    for (const chat of backup.chats as Chat[]) {
      if (chat?.id && /^[a-zA-Z0-9-]+$/.test(chat.id) && Array.isArray(chat.messages)) {
        // Rechtstreeks wegschrijven zodat updatedAt uit de back-up behouden blijft.
        await fs.writeFile(
          path.join(dir, `${chat.id}.json`),
          JSON.stringify(chat, null, 2),
          "utf-8"
        );
        counts.chats++;
      }
    }
  }

  if (Array.isArray(backup.reports)) {
    const dir = path.join(process.cwd(), "data", "reports");
    await fs.mkdir(dir, { recursive: true });
    for (const report of backup.reports as SavedReport[]) {
      if (report?.id && /^[a-zA-Z0-9-]+$/.test(report.id) && report.report) {
        await fs.writeFile(
          path.join(dir, `${report.id}.json`),
          JSON.stringify(report, null, 2),
          "utf-8"
        );
        counts.reports++;
      }
    }
  }

  if (Array.isArray(backup.notes)) {
    const dir = path.join(process.cwd(), "data", "notes");
    await fs.mkdir(dir, { recursive: true });
    for (const note of backup.notes as Note[]) {
      if (note?.id && /^[a-zA-Z0-9-]+$/.test(note.id) && typeof note.content === "string") {
        // Rechtstreeks wegschrijven zodat updatedAt uit de back-up behouden blijft.
        await fs.writeFile(
          path.join(dir, `${note.id}.json`),
          JSON.stringify(note, null, 2),
          "utf-8"
        );
        counts.notes++;
      }
    }
  }

  if (Array.isArray(backup.prompts)) {
    const existing = new Set((await listPrompts()).map((p) => p.title));
    for (const prompt of backup.prompts as PromptTemplate[]) {
      if (prompt?.title && prompt?.text && !existing.has(prompt.title)) {
        await addPrompt(prompt.title, prompt.text);
        counts.prompts++;
      }
    }
  }

  if (backup.settings && typeof backup.settings === "object") {
    await saveSettings(backup.settings);
  }

  return NextResponse.json({ ok: true, imported: counts });
}
