import { NextResponse } from "next/server";
import { createNote, listNotes } from "@/lib/noteStore";

export async function GET() {
  return NextResponse.json({ notes: await listNotes() });
}

export async function POST() {
  return NextResponse.json({ note: await createNote() });
}
