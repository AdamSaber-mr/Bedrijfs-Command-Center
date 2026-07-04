import { NextResponse } from "next/server";
import { deleteChat, getChat, updateChatMeta } from "@/lib/chatStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await getChat(id);
  if (!chat) {
    return NextResponse.json({ error: "Chat niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ chat });
}

// Hernoemen of vastpinnen
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { title?: unknown; pinned?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const chat = await updateChatMeta(id, {
    title: typeof body.title === "string" ? body.title : undefined,
    pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
  });
  if (!chat) {
    return NextResponse.json({ error: "Chat niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ chat });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteChat(id);
  return NextResponse.json({ ok: true });
}
