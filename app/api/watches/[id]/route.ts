import { NextResponse } from "next/server";
import { deleteWatch, getWatch } from "@/lib/watchStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) {
    return NextResponse.json({ error: "Watch niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ watch });
}

// Ontvolgen: de watch en zijn updates verdwijnen; rapporten blijven staan.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteWatch(id);
  return NextResponse.json({ ok: true });
}
