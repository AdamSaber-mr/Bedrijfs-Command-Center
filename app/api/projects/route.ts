import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/projectStore";

export async function GET() {
  return NextResponse.json({ projects: await listProjects() });
}

export async function POST(request: Request) {
  let name: unknown, description: unknown;
  try {
    ({ name, description } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Geef het project een naam." }, { status: 400 });
  }
  const project = await createProject(
    name,
    typeof description === "string" ? description : ""
  );
  return NextResponse.json({ project });
}
