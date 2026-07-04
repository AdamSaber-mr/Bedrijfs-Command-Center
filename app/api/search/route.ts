import { NextResponse } from "next/server";
import { allChats } from "@/lib/chatStore";
import { getReport, listReports } from "@/lib/reportStore";
import { allNotes } from "@/lib/noteStore";

// Full-text zoeken voor het ⌘K-palette: doorzoekt de inhoud van chats en
// rapporten (titels doet het palette zelf al client-side).

function snippetAround(text: string, query: string, radius = 45): string {
  const idx = text.toLowerCase().indexOf(query);
  if (idx < 0) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, end).replace(/\s+/g, " ").trim() +
    (end < text.length ? "…" : "")
  );
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ chats: [], reports: [], notes: [] });
  }

  const chats = (await allChats())
    .map((chat) => {
      const match = chat.messages.find((m) => m.content.toLowerCase().includes(q));
      if (!match) return null;
      return {
        id: chat.id,
        title: chat.title,
        snippet: snippetAround(match.content, q),
      };
    })
    .filter((c) => c !== null)
    .slice(0, 5);

  const reportSummaries = await listReports();
  const reports = (
    await Promise.all(
      reportSummaries.map(async (summary) => {
        const saved = await getReport(summary.id);
        if (!saved) return null;
        const haystack = [
          saved.report.company.summary,
          saved.report.market_position.analysis,
          saved.report.partnership_fit.analysis,
          saved.report.conclusion,
        ].join(" ");
        if (
          !summary.company.toLowerCase().includes(q) &&
          !haystack.toLowerCase().includes(q)
        ) {
          return null;
        }
        return {
          id: summary.id,
          company: summary.company,
          snippet: snippetAround(haystack, q),
        };
      })
    )
  )
    .filter((r) => r !== null)
    .slice(0, 4);

  const notes = (await allNotes())
    .map((note) => {
      const haystack = `${note.title}\n${note.content}`;
      if (!haystack.toLowerCase().includes(q)) return null;
      return {
        id: note.id,
        title: note.title,
        snippet: snippetAround(note.content, q) || note.title,
      };
    })
    .filter((n) => n !== null)
    .slice(0, 4);

  return NextResponse.json({ chats, reports, notes });
}
