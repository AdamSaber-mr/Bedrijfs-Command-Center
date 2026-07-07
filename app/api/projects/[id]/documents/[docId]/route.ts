import { NextResponse } from "next/server";
import { removeProjectDocument } from "@/lib/projectStore";

// Document uit een project verwijderen.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const result = await removeProjectDocument(id, docId);
  if (result === null) {
    return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }
  if (result === false) {
    return NextResponse.json({ error: "Document niet gevonden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
