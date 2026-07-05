import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

export interface PromptTemplate {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

// Herbruikbare prompt-sjablonen, per gebruiker in één JSON-bestand
// data/users/<id>/prompts.json.
async function promptsFile(): Promise<string> {
  const root = userRoot(await requireUserId());
  await fs.mkdir(root, { recursive: true });
  return path.join(root, "prompts.json");
}

export async function listPrompts(): Promise<PromptTemplate[]> {
  try {
    const prompts = JSON.parse(await fs.readFile(await promptsFile(), "utf-8")) as PromptTemplate[];
    return prompts.sort((a, b) => a.title.localeCompare(b.title, "nl"));
  } catch {
    return [];
  }
}

async function save(prompts: PromptTemplate[]) {
  await fs.writeFile(await promptsFile(), JSON.stringify(prompts, null, 2), "utf-8");
}

export async function addPrompt(title: string, text: string): Promise<PromptTemplate> {
  const prompt: PromptTemplate = {
    id: randomUUID(),
    title: title.trim().slice(0, 80),
    text: text.trim().slice(0, 4000),
    createdAt: new Date().toISOString(),
  };
  const prompts = await listPrompts();
  prompts.push(prompt);
  await save(prompts);
  return prompt;
}

export async function updatePrompt(
  id: string,
  patch: { title?: string; text?: string }
): Promise<PromptTemplate | null> {
  const prompts = await listPrompts();
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) return null;
  if (typeof patch.title === "string") prompt.title = patch.title.trim().slice(0, 80);
  if (typeof patch.text === "string") prompt.text = patch.text.trim().slice(0, 4000);
  await save(prompts);
  return prompt;
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await listPrompts();
  await save(prompts.filter((p) => p.id !== id));
}
