import { allChats } from "@/lib/chatStore";

// Exporteert alle opgeslagen chats als JSONL — één gespreksvoorbeeld per
// regel in het gangbare finetune-formaat: {"messages": [{role, content}, ...]}
export async function GET() {
  const chats = await allChats();
  const lines = chats
    .filter((chat) => chat.messages.length >= 2)
    .map((chat) => JSON.stringify({ messages: chat.messages }));

  return new Response(lines.join("\n") + (lines.length ? "\n" : ""), {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="trainingsdata-${new Date().toISOString().slice(0, 10)}.jsonl"`,
    },
  });
}
