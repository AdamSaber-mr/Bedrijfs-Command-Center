import { NextResponse } from "next/server";
import { deleteChat, getChat } from "@/lib/chatStore";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteChat(id);
  return NextResponse.json({ ok: true });
}
