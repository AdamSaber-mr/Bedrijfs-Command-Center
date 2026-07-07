import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId, userRoot } from "./auth";

// Dealbewaking: een "watch" volgt één bedrijf en verzamelt updates die
// periodieke checks (met webzoeken) opleveren. Zo wordt een rapport een
// levend dossier in plaats van een momentopname.

export type UpdateImpact = "laag" | "middel" | "hoog";

export const UPDATE_CATEGORIES = [
  "financieel",
  "product",
  "personeel",
  "concurrentie",
  "juridisch",
  "overig",
] as const;
export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];

export interface WatchUpdate {
  id: string;
  // Moment waarop de check deze update vond
  foundAt: string;
  headline: string;
  summary: string;
  category: UpdateCategory;
  impact: UpdateImpact;
  sourceUrl?: string;
  sourceTitle?: string;
  read: boolean;
}

export interface Watch {
  id: string;
  company: string;
  createdAt: string;
  // Ontbreekt zolang er nog nooit gecheckt is
  lastCheckedAt?: string;
  // Laatst bekende rapport van dit bedrijf, voor doorklikken vanuit updates
  reportId?: string;
  projectId?: string;
  updates: WatchUpdate[];
}

// Meer dan dit bewaren we niet per bedrijf; oudste updates vallen eraf.
const MAX_UPDATES = 30;

async function watchesDir(): Promise<string> {
  const dir = path.join(userRoot(await requireUserId()), "watches");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileFor(id: string): Promise<string> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig watch-ID");
  return path.join(await watchesDir(), `${id}.json`);
}

async function writeWatch(watch: Watch): Promise<void> {
  await fs.writeFile(await fileFor(watch.id), JSON.stringify(watch, null, 2), "utf-8");
}

export function normalizeCompany(name: string): string {
  return name.trim().toLowerCase();
}

export async function listWatches(): Promise<Watch[]> {
  const dir = await watchesDir();
  const files = await fs.readdir(dir);
  const watches = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f): Promise<Watch | null> => {
        try {
          return JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as Watch;
        } catch {
          return null;
        }
      })
  );
  return watches
    .filter((w): w is Watch => w !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWatch(id: string): Promise<Watch | null> {
  try {
    return JSON.parse(await fs.readFile(await fileFor(id), "utf-8")) as Watch;
  } catch {
    return null;
  }
}

export async function findWatchByCompany(company: string): Promise<Watch | null> {
  const normalized = normalizeCompany(company);
  const watches = await listWatches();
  return watches.find((w) => normalizeCompany(w.company) === normalized) ?? null;
}

export async function createWatch(input: {
  company: string;
  reportId?: string;
  projectId?: string;
  // Vanuit een vers rapport: de eerste check mag tot morgen wachten,
  // want het rapport dekt de actualiteit al.
  lastCheckedAt?: string;
}): Promise<Watch> {
  const existing = await findWatchByCompany(input.company);
  if (existing) {
    // Al gevolgd: alleen de rapport-/projectkoppeling verversen.
    if (input.reportId) existing.reportId = input.reportId;
    if (input.projectId) existing.projectId = input.projectId;
    await writeWatch(existing);
    return existing;
  }
  const watch: Watch = {
    id: randomUUID(),
    company: input.company.trim().slice(0, 120),
    createdAt: new Date().toISOString(),
    ...(input.lastCheckedAt ? { lastCheckedAt: input.lastCheckedAt } : {}),
    ...(input.reportId ? { reportId: input.reportId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    updates: [],
  };
  await writeWatch(watch);
  return watch;
}

export async function deleteWatch(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

// Resultaat van een check toevoegen; koppen die al in het dossier staan
// worden overgeslagen zodat dagelijkse checks geen dubbelingen stapelen.
export async function addUpdates(
  id: string,
  updates: Omit<WatchUpdate, "id" | "foundAt" | "read">[]
): Promise<Watch | null> {
  const watch = await getWatch(id);
  if (!watch) return null;
  const known = new Set(watch.updates.map((u) => u.headline.trim().toLowerCase()));
  const now = new Date().toISOString();
  const fresh: WatchUpdate[] = updates
    .filter((u) => !known.has(u.headline.trim().toLowerCase()))
    .map((u) => ({ ...u, id: randomUUID(), foundAt: now, read: false }));
  watch.updates = [...fresh, ...watch.updates].slice(0, MAX_UPDATES);
  watch.lastCheckedAt = now;
  await writeWatch(watch);
  return watch;
}

export async function markAllUpdatesRead(): Promise<void> {
  const watches = await listWatches();
  await Promise.all(
    watches
      .filter((w) => w.updates.some((u) => !u.read))
      .map((w) => {
        w.updates = w.updates.map((u) => ({ ...u, read: true }));
        return writeWatch(w);
      })
  );
}
