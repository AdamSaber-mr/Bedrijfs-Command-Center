import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ResearchReport } from "./research";
import { requireUserId, userRoot } from "./auth";

export interface Citation {
  url: string;
  title: string;
}

export interface SavedReport {
  id: string;
  company: string;
  createdAt: string;
  report: ResearchReport;
  citations: Citation[];
}

export interface ReportSummary {
  id: string;
  company: string;
  createdAt: string;
  marketScore: number;
  fitScore: number;
}

// Rapporten worden net als chats als losse JSON-bestanden bewaard, per
// gebruiker in data/users/<id>/reports/.
async function reportsDir(): Promise<string> {
  const dir = path.join(userRoot(await requireUserId()), "reports");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fileFor(id: string): Promise<string> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig rapport-ID");
  return path.join(await reportsDir(), `${id}.json`);
}

export async function saveReport(
  company: string,
  report: ResearchReport,
  citations: Citation[]
): Promise<SavedReport> {
  const saved: SavedReport = {
    id: randomUUID(),
    company,
    createdAt: new Date().toISOString(),
    report,
    citations,
  };
  await fs.writeFile(await fileFor(saved.id), JSON.stringify(saved, null, 2), "utf-8");
  return saved;
}

export async function getReport(id: string): Promise<SavedReport | null> {
  try {
    return JSON.parse(await fs.readFile(await fileFor(id), "utf-8")) as SavedReport;
  } catch {
    return null;
  }
}

export async function deleteReport(id: string): Promise<void> {
  try {
    await fs.unlink(await fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  const dir = await reportsDir();
  const files = await fs.readdir(dir);
  const reports = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const saved = JSON.parse(
            await fs.readFile(path.join(dir, f), "utf-8")
          ) as SavedReport;
          return {
            id: saved.id,
            company: saved.report.company.name || saved.company,
            createdAt: saved.createdAt,
            marketScore: saved.report.market_position.score,
            fitScore: saved.report.partnership_fit.score,
          };
        } catch {
          return null;
        }
      })
  );
  return reports
    .filter((r): r is ReportSummary => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
