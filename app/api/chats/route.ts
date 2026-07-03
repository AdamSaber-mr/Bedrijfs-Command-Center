import { NextResponse } from "next/server";
import { listChats } from "@/lib/chatStore";

export async function GET() {
  return NextResponse.json({ chats: await listChats() });
}
