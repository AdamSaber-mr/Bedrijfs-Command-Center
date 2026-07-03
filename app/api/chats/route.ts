import { NextResponse } from "next/server";
import { deleteChat, listChats } from "@/lib/chatStore";

export async function GET() {
  return NextResponse.json({ chats: await listChats() });
}

// Verwijdert alle opgeslagen chats — alleen via expliciete bevestiging in de UI.
export async function DELETE() {
  const chats = await listChats();
  await Promise.all(chats.map((c) => deleteChat(c.id)));
  return NextResponse.json({ ok: true, deleted: chats.length });
}
