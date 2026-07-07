import { NextResponse } from "next/server";
import { createWatch, listWatches } from "@/lib/watchStore";
import { getReport } from "@/lib/reportStore";

export async function GET() {
  const watches = await listWatches();
  return NextResponse.json({ watches });
}

// Bedrijf volgen. Met een reportId erft de watch de projectkoppeling van het
// rapport; bij een vers rapport (jonger dan een dag) wacht de eerste
// automatische check tot morgen, want het rapport dekt de actualiteit al.
export async function POST(request: Request) {
  let body: { company?: unknown; reportId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (typeof body.company !== "string" || body.company.trim().length < 2) {
    return NextResponse.json({ error: "Voer een geldige bedrijfsnaam in" }, { status: 400 });
  }

  let reportId: string | undefined;
  let projectId: string | undefined;
  let lastCheckedAt: string | undefined;
  if (typeof body.reportId === "string" && /^[a-zA-Z0-9-]+$/.test(body.reportId)) {
    const report = await getReport(body.reportId);
    if (report) {
      reportId = report.id;
      projectId = report.projectId;
      const ageMs = Date.now() - new Date(report.createdAt).getTime();
      if (ageMs < 24 * 3600_000) lastCheckedAt = report.createdAt;
    }
  }

  const watch = await createWatch({
    company: body.company,
    reportId,
    projectId,
    lastCheckedAt,
  });
  return NextResponse.json({ watch });
}
