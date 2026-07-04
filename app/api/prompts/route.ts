import { NextResponse } from "next/server";
import { addPrompt, listPrompts } from "@/lib/promptStore";

export async function GET() {
  return NextResponse.json({ prompts: await listPrompts() });
}

export async function POST(request: Request) {
  let title: unknown, text: unknown;
  try {
    ({ title, text } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (
    typeof title !== "string" ||
    !title.trim() ||
    typeof text !== "string" ||
    !text.trim()
  ) {
    return NextResponse.json({ error: "Titel en tekst zijn verplicht" }, { status: 400 });
  }
  return NextResponse.json({ prompt: await addPrompt(title, text) });
}
