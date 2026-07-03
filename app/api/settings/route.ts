import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json({
    settings: await getSettings(),
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const settings = await saveSettings(body);
  return NextResponse.json({ settings });
}
