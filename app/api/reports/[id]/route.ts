import { NextResponse } from "next/server";
import { deleteReport, getReport } from "@/lib/reportStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const saved = await getReport(id);
  if (!saved) {
    return NextResponse.json({ error: "Rapport niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ saved });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
