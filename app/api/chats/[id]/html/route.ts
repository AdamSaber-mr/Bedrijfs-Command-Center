import { getChat } from "@/lib/chatStore";
import { getSettings } from "@/lib/settings";
import { chatToHtml } from "@/lib/exportHtml";

// Exporteert één chat als zelfvoorzienende HTML-pagina om te delen.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await getChat(id);
  if (!chat) {
    return Response.json({ error: "Chat niet gevonden" }, { status: 404 });
  }
  const settings = await getSettings();

  const slug =
    chat.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "chat";

  return new Response(chatToHtml(chat, settings.name), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.html"`,
    },
  });
}
