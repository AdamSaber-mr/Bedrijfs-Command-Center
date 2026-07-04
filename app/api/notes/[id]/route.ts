import { NextResponse } from "next/server";
import { deleteNote, getNote, updateNote } from "@/lib/noteStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) {
    return NextResponse.json({ error: "Notitie niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const note = await updateNote(id, {
    title: typeof body.title === "string" ? body.title : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
  });
  if (!note) {
    return NextResponse.json({ error: "Notitie niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteNote(id);
  return NextResponse.json({ ok: true });
}
