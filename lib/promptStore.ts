import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface PromptTemplate {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

// Herbruikbare prompt-sjablonen, samen in één JSON-bestand.
const FILE = path.join(process.cwd(), "data", "prompts.json");

export async function listPrompts(): Promise<PromptTemplate[]> {
  try {
    const prompts = JSON.parse(await fs.readFile(FILE, "utf-8")) as PromptTemplate[];
    return prompts.sort((a, b) => a.title.localeCompare(b.title, "nl"));
  } catch {
    return [];
  }
}

async function save(prompts: PromptTemplate[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(prompts, null, 2), "utf-8");
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

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await listPrompts();
  await save(prompts.filter((p) => p.id !== id));
}
