import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ResearchReport } from "./research";

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

// Rapporten worden net als chats als losse JSON-bestanden bewaard,
// zodat analyses na een refresh terug te vinden zijn.
const DATA_DIR = path.join(process.cwd(), "data", "reports");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Ongeldig rapport-ID");
  return path.join(DATA_DIR, `${id}.json`);
}

export async function saveReport(
  company: string,
  report: ResearchReport,
  citations: Citation[]
): Promise<SavedReport> {
  await ensureDir();
  const saved: SavedReport = {
    id: randomUUID(),
    company,
    createdAt: new Date().toISOString(),
    report,
    citations,
  };
  await fs.writeFile(fileFor(saved.id), JSON.stringify(saved, null, 2), "utf-8");
  return saved;
}

export async function getReport(id: string): Promise<SavedReport | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf-8")) as SavedReport;
  } catch {
    return null;
  }
}

export async function deleteReport(id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(id));
  } catch {
    // bestaat al niet meer — prima
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const reports = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const saved = JSON.parse(
            await fs.readFile(path.join(DATA_DIR, f), "utf-8")
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
