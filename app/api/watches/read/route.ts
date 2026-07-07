import { NextResponse } from "next/server";
import { markAllUpdatesRead } from "@/lib/watchStore";

// "Alles gelezen" in het notificatie-paneel.
export async function POST() {
  await markAllUpdatesRead();
  return NextResponse.json({ ok: true });
}
