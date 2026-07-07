import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

// Dealfases voor de pipeline-weergave op de projectenpagina.
export const PROJECT_STAGES = ["verkennen", "in_gesprek", "deal", "afgewezen"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

// Documenten die als vaste achtergrondcontext in elke projectchat meegaan.
// Zelfde toegestane types als de chat-bijlagen.
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;
export const MAX_DOCUMENTS_PER_PROJECT = 5;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // per bestand (gedecodeerd)
export const MAX_TOTAL_DOCUMENT_BYTES = 12 * 1024 * 1024; // per project (gedecodeerd)

export interface ProjectDocument {
  id: string;
  name: string;
  mediaType: string;
  // Base64 zonder witruimte, klaar voor de Anthropic-API.
  data: string;
  // Bestandsgrootte in bytes (gedecodeerd), voor weergave en limieten.
  size: number;
  addedAt: string;
}

// Projecten bundelen chats, notities en rapporten rond één deal/bedrijf,
// met eigen instructies die als extra context in projectchats meegaan.
export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  // Dealfase; ontbreekt bij oudere projecten = "verkennen"
  stage?: ProjectStage;
  // Documenten die in elke projectchat als context meegaan.
  documents?: ProjectDocument[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  stage: ProjectStage;
  documentCount: number;
}

async function projectsDir(): Promise<string> {
  const dir = path.join(userRoot(await requireUserId()), "projects");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileFor(id: string): Promise<string> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig project-ID");
  return path.join(await projectsDir(), `${id}.json`);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const dir = await projectsDir();
  const files = await fs.readdir(dir);
  const projects = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const p = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as Project;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            updatedAt: p.updatedAt,
            stage: p.stage && PROJECT_STAGES.includes(p.stage) ? p.stage : "verkennen",
            documentCount: p.documents?.length ?? 0,
          };
        } catch {
          return null;
        }
      })
  );
  return projects
    .filter((p): p is ProjectSummary => p !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    return JSON.parse(await fs.readFile(await fileFor(id), "utf-8")) as Project;
  } catch {
    return null;
  }
}

export async function createProject(name: string, description = ""): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: name.trim().slice(0, 80),
    description: description.trim().slice(0, 300),
    instructions: "",
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(await fileFor(project.id), JSON.stringify(project, null, 2), "utf-8");
  return project;
}

export async function updateProject(
  id: string,
  patch: { name?: string; description?: string; instructions?: string; stage?: string }
): Promise<Project | null> {
  const project = await getProject(id);
  if (!project) return null;
  if (typeof patch.name === "string" && patch.name.trim()) {
    project.name = patch.name.trim().slice(0, 80);
  }
  if (typeof patch.description === "string") {
    project.description = patch.description.trim().slice(0, 300);
  }
  if (typeof patch.instructions === "string") {
    project.instructions = patch.instructions.slice(0, 4000);
  }
  if (
    typeof patch.stage === "string" &&
    PROJECT_STAGES.includes(patch.stage as ProjectStage)
  ) {
    project.stage = patch.stage as ProjectStage;
  }
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(id), JSON.stringify(project, null, 2), "utf-8");
  return project;
}

// Voegt een document toe aan een project, met validatie van type en limieten.
// Retourneert null als het project niet bestaat, of { error } bij een
// overschreden limiet/ongeldig bestand.
export async function addProjectDocument(
  projectId: string,
  doc: { name: string; mediaType: string; data: string }
): Promise<ProjectDocument | { error: string } | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const mediaType = doc.mediaType.toLowerCase();
  if (!(DOCUMENT_TYPES as readonly string[]).includes(mediaType)) {
    return {
      error: `Bestandstype ${mediaType} wordt niet ondersteund (PDF, afbeelding of tekstbestand).`,
    };
  }

  const documents = project.documents ?? [];
  if (documents.length >= MAX_DOCUMENTS_PER_PROJECT) {
    return { error: `Maximaal ${MAX_DOCUMENTS_PER_PROJECT} documenten per project.` };
  }

  // Base64 mag geen witruimte bevatten voor de API; grootte = gedecodeerde bytes.
  const data = doc.data.replace(/\s/g, "");
  if (data.length === 0) {
    return { error: "Het bestand is leeg of kon niet worden gelezen." };
  }
  const size = Math.floor((data.length * 3) / 4);
  if (size > MAX_DOCUMENT_BYTES) {
    return { error: `"${doc.name}" is te groot (max 5 MB per bestand).` };
  }
  const totalSize = documents.reduce((sum, d) => sum + d.size, 0) + size;
  if (totalSize > MAX_TOTAL_DOCUMENT_BYTES) {
    return { error: "De documenten zijn samen te groot (max 12 MB per project)." };
  }

  const document: ProjectDocument = {
    id: randomUUID(),
    name: doc.name.trim().slice(0, 120) || "Document",
    mediaType,
    data,
    size,
    addedAt: new Date().toISOString(),
  };
  project.documents = [...documents, document];
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(projectId), JSON.stringify(project, null, 2), "utf-8");
  return document;
}

// Verwijdert een document uit een project. Retourneert null als het project
// niet bestaat, false als het document niet bestaat, anders true.
export async function removeProjectDocument(
  projectId: string,
  docId: string
): Promise<boolean | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const documents = project.documents ?? [];
  const remaining = documents.filter((d) => d.id !== docId);
  if (remaining.length === documents.length) return false;
  project.documents = remaining;
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(projectId), JSON.stringify(project, null, 2), "utf-8");
  return true;
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}
