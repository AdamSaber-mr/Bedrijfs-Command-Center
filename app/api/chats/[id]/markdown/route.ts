import { getChat } from "@/lib/chatStore";

// Exporteert één chat als leesbaar Markdown-bestand.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await getChat(id);
  if (!chat) {
    return Response.json({ error: "Chat niet gevonden" }, { status: 404 });
  }

  const lines: string[] = [
    `# ${chat.title}`,
    "",
    `_Geëxporteerd uit Vantage · ${new Date(chat.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}_`,
    "",
  ];
  for (const m of chat.messages) {
    lines.push(m.role === "user" ? "## Jij" : "## Assistent");
    if (m.at) {
      lines.push(
        `_${new Date(m.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}_`
      );
    }
    for (const att of m.attachments ?? []) {
      lines.push(`> 📎 Bijlage: ${att.name}`);
    }
    lines.push("", m.content, "");
  }

  const slug =
    chat.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "chat";

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
    },
  });
}
