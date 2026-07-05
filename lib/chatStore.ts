import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Tijdstip van het bericht; ontbreekt bij oudere chats
  at?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  // Optionele achtergrondcontext (bv. een deal-rapport) die als systeemcontext
  // wordt meegestuurd, maar geen deel is van de zichtbare berichten.
  context?: string;
  // Vastgepinde chats staan bovenaan in de sidebar
  pinned?: boolean;
  // Per-chat modelkeuze; ontbreekt = de standaard uit Instellingen
  model?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
}

// Chats worden als losse JSON-bestanden bewaard, per gebruiker in
// data/users/<id>/chats/, zodat ze later 1-op-1 als trainingsdata te
// gebruiken zijn (zie /api/export voor JSONL).
async function chatsDir(): Promise<string> {
  const dir = path.join(userRoot(await requireUserId()), "chats");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileFor(id: string): Promise<string> {
  // ID's komen alleen uit randomUUID, maar valideer defensief tegen path traversal.
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig chat-ID");
  return path.join(await chatsDir(), `${id}.json`);
}

export async function listChats(): Promise<ChatSummary[]> {
  const dir = await chatsDir();
  const files = await fs.readdir(dir);
  const chats = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const chat = JSON.parse(
            await fs.readFile(path.join(dir, f), "utf-8")
          ) as Chat;
          return {
            id: chat.id,
            title: chat.title,
            updatedAt: chat.updatedAt,
            messageCount: chat.messages.length,
            pinned: chat.pinned === true,
          };
        } catch {
          return null;
        }
      })
  );
  return chats
    .filter((c): c is ChatSummary => c !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(id: string): Promise<Chat | null> {
  try {
    return JSON.parse(await fs.readFile(await fileFor(id), "utf-8")) as Chat;
  } catch {
    return null;
  }
}

export function newChat(firstMessage: string): Chat {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : ""),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export async function saveChat(chat: Chat): Promise<void> {
  chat.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(chat.id), JSON.stringify(chat, null, 2), "utf-8");
}

// Titel of pin-status aanpassen zónder updatedAt te verhogen, zodat de chat
// niet onbedoeld naar boven springt in de datumgroepen.
export async function updateChatMeta(
  id: string,
  patch: { title?: string; pinned?: boolean }
): Promise<Chat | null> {
  const chat = await getChat(id);
  if (!chat) return null;
  if (typeof patch.title === "string" && patch.title.trim()) {
    chat.title = patch.title.trim().slice(0, 80);
  }
  if (typeof patch.pinned === "boolean") {
    chat.pinned = patch.pinned;
  }
  await fs.writeFile(await fileFor(chat.id), JSON.stringify(chat, null, 2), "utf-8");
  return chat;
}

export async function deleteChat(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

export async function allChats(): Promise<Chat[]> {
  const summaries = await listChats();
  const chats = await Promise.all(summaries.map((s) => getChat(s.id)));
  return chats.filter((c): c is Chat => c !== null);
}
