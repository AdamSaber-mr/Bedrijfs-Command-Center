import { getReport } from "@/lib/reportStore";
import { reportToHtml } from "@/lib/exportHtml";

// Exporteert één deal-rapport als zelfvoorzienende HTML-pagina om te delen.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const saved = await getReport(id);
  if (!saved) {
    return Response.json({ error: "Rapport niet gevonden" }, { status: 404 });
  }

  const slug =
    (saved.report.company.name || saved.company)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "rapport";

  return new Response(reportToHtml(saved), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-rapport.html"`,
    },
  });
}
