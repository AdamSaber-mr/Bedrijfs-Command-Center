import { NextResponse } from "next/server";
import { deleteProject, getProject, updateProject } from "@/lib/projectStore";
import { listChats, updateChatMeta } from "@/lib/chatStore";
import { listNotes, updateNote } from "@/lib/noteStore";
import { listReports, updateReportMeta } from "@/lib/reportStore";

// Project + alle gekoppelde items in één antwoord voor de projectpagina.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }
  const [chats, notes, reports] = await Promise.all([
    listChats(),
    listNotes(),
    listReports(),
  ]);
  return NextResponse.json({
    project,
    chats: chats.filter((c) => c.projectId === id),
    notes: notes.filter((n) => n.projectId === id),
    reports: reports.filter((r) => r.projectId === id),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { name?: unknown; description?: unknown; instructions?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const project = await updateProject(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    instructions: typeof body.instructions === "string" ? body.instructions : undefined,
  });
  if (!project) {
    return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

// Verwijdert het project en ontkoppelt alle items (die blijven zelf bestaan).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [chats, notes, reports] = await Promise.all([
    listChats(),
    listNotes(),
    listReports(),
  ]);
  await Promise.all([
    ...chats
      .filter((c) => c.projectId === id)
      .map((c) => updateChatMeta(c.id, { projectId: null })),
    ...notes
      .filter((n) => n.projectId === id)
      .map((n) => updateNote(n.id, { projectId: null })),
    ...reports
      .filter((r) => r.projectId === id)
      .map((r) => updateReportMeta(r.id, { projectId: null })),
  ]);
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
