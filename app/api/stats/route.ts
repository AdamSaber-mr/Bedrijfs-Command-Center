import { NextResponse } from "next/server";
import { allChats } from "@/lib/chatStore";

// Berichten per dag over de laatste 14 dagen, voor het activiteitsgrafiekje.
// Berichten van vóór de tijdstempel-functie (zonder `at`) tellen niet mee.
export async function GET() {
  const chats = await allChats();
  const counts = new Map<string, number>();

  for (const chat of chats) {
    for (const message of chat.messages) {
      if (!message.at) continue;
      const day = message.at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return NextResponse.json({ days });
}
