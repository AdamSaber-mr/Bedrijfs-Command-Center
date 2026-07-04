import { NextResponse } from "next/server";
import { deletePrompt } from "@/lib/promptStore";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePrompt(id);
  return NextResponse.json({ ok: true });
}
