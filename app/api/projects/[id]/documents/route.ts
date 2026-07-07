import { NextResponse } from "next/server";
import { addProjectDocument } from "@/lib/projectStore";

// Document toevoegen aan een project: { name, mediaType, data (base64) }.
// Validatie (type, max 5 documenten, 5 MB per bestand, 12 MB totaal) zit in
// de store; het antwoord bevat alleen metadata — de base64 blijft server-side.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { name?: unknown; mediaType?: unknown; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (
    typeof body.name !== "string" ||
    typeof body.mediaType !== "string" ||
    typeof body.data !== "string"
  ) {
    return NextResponse.json({ error: "Ongeldig document" }, { status: 400 });
  }

  const result = await addProjectDocument(id, {
    name: body.name,
    mediaType: body.mediaType,
    data: body.data,
  });
  if (result === null) {
    return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
  }
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    document: {
      id: result.id,
      name: result.name,
      mediaType: result.mediaType,
      size: result.size,
      addedAt: result.addedAt,
    },
  });
}
