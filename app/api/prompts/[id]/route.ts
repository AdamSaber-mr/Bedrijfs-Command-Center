import { NextResponse } from "next/server";
import { deletePrompt, updatePrompt } from "@/lib/promptStore";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { title?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const prompt = await updatePrompt(id, {
    title: typeof body.title === "string" ? body.title : undefined,
    text: typeof body.text === "string" ? body.text : undefined,
  });
  if (!prompt) {
    return NextResponse.json({ error: "Sjabloon niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ prompt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePrompt(id);
  return NextResponse.json({ ok: true });
}
