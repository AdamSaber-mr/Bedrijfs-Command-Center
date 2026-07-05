import { NextResponse } from "next/server";
import { deleteReport, getReport, updateReportMeta } from "@/lib/reportStore";

// Projectkoppeling aanpassen (projectId: string of null om te ontkoppelen).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { projectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const saved = await updateReportMeta(id, {
    projectId:
      body.projectId === null || typeof body.projectId === "string"
        ? body.projectId
        : undefined,
  });
  if (!saved) {
    return NextResponse.json({ error: "Rapport niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ saved });
}

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
