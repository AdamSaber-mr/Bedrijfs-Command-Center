import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

// Projecten bundelen chats, notities en rapporten rond één deal/bedrijf,
// met eigen instructies die als extra context in projectchats meegaan.
export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
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
  patch: { name?: string; description?: string; instructions?: string }
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
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(await fileFor(id), JSON.stringify(project, null, 2), "utf-8");
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}
