import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: string;
}

// Notities als losse JSON-bestanden, net als chats en rapporten.
const DATA_DIR = path.join(process.cwd(), "data", "notes");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig notitie-ID");
  return path.join(DATA_DIR, `${id}.json`);
}

export async function listNotes(): Promise<NoteSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const notes = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const note = JSON.parse(
            await fs.readFile(path.join(DATA_DIR, f), "utf-8")
          ) as Note;
          return { id: note.id, title: note.title, updatedAt: note.updatedAt };
        } catch {
          return null;
        }
      })
  );
  return notes
    .filter((n): n is NoteSummary => n !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNote(id: string): Promise<Note | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf-8")) as Note;
  } catch {
    return null;
  }
}

export async function createNote(): Promise<Note> {
  await ensureDir();
  const now = new Date().toISOString();
  const note: Note = {
    id: randomUUID(),
    title: "Nieuwe notitie",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(fileFor(note.id), JSON.stringify(note, null, 2), "utf-8");
  return note;
}

export async function saveNote(note: Note): Promise<void> {
  await ensureDir();
  note.updatedAt = new Date().toISOString();
  await fs.writeFile(fileFor(note.id), JSON.stringify(note, null, 2), "utf-8");
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string }
): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;
  if (typeof patch.title === "string") note.title = patch.title.slice(0, 120) || "Zonder titel";
  if (typeof patch.content === "string") note.content = patch.content.slice(0, 100_000);
  await saveNote(note);
  return note;
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

export async function allNotes(): Promise<Note[]> {
  const summaries = await listNotes();
  const notes = await Promise.all(summaries.map((s) => getNote(s.id)));
  return notes.filter((n): n is Note => n !== null);
}
