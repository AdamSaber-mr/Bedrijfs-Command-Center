import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  // Project waar deze notitie bij hoort
  projectId?: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: string;
  projectId?: string;
}

// Notities als losse JSON-bestanden, per gebruiker in data/users/<id>/notes/.
async function notesDir(): Promise<string> {
  const dir = path.join(userRoot(await requireUserId()), "notes");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileFor(id: string): Promise<string> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig notitie-ID");
  return path.join(await notesDir(), `${id}.json`);
}

export async function listNotes(): Promise<NoteSummary[]> {
  const dir = await notesDir();
  const files = await fs.readdir(dir);
  const notes = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f): Promise<NoteSummary | null> => {
        try {
          const note = JSON.parse(
            await fs.readFile(path.join(dir, f), "utf-8")
          ) as Note;
          return {
            id: note.id,
            title: note.title,
            updatedAt: note.updatedAt,
            projectId: note.projectId,
          };
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
    return JSON.parse(await fs.readFile(await fileFor(id), "utf-8")) as Note;
  } catch {
    return null;
  }
}

export async function createNote(): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = {
    id: randomUUID(),
    title: "Nieuwe notitie",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(await fileFor(note.id), JSON.stringify(note, null, 2), "utf-8");
  return note;
}

export async function saveNote(note: Note): Promise<void> {
  note.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(note.id), JSON.stringify(note, null, 2), "utf-8");
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string; projectId?: string | null }
): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;
  if (typeof patch.title === "string") note.title = patch.title.slice(0, 120) || "Zonder titel";
  if (typeof patch.content === "string") note.content = patch.content.slice(0, 100_000);
  if (patch.projectId === null) {
    delete note.projectId;
  } else if (typeof patch.projectId === "string" && /^[a-zA-Z0-9-]+$/.test(patch.projectId)) {
    note.projectId = patch.projectId;
  }
  await saveNote(note);
  return note;
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

export async function allNotes(): Promise<Note[]> {
  const summaries = await listNotes();
  const notes = await Promise.all(summaries.map((s) => getNote(s.id)));
  return notes.filter((n): n is Note => n !== null);
}
