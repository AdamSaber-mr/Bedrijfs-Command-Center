import { promises as fs } from "fs";
import path from "path";

// App-brede instellingen (géén per-gebruiker data): data/app.json.
// Registratie staat standaard dicht zodra er een account bestaat; de
// allereerste registratie is altijd toegestaan (zie de register-route).
const FILE = path.join(process.cwd(), "data", "app.json");

export interface AppConfig {
  openRegistration: boolean;
}

const DEFAULTS: AppConfig = { openRegistration: false };

export async function getAppConfig(): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf-8"));
    return { openRegistration: raw.openRegistration === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const next = { ...(await getAppConfig()), ...patch };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
