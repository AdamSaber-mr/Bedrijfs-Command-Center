import { promises as fs } from "fs";
import path from "path";
import { requireUserId, userRoot } from "./auth";
import { findById } from "./users";
import {
  DEFAULT_SETTINGS,
  MAX_TOKENS_OPTIONS,
  MODEL_OPTIONS,
  type Settings,
} from "./settingsShared";

export type { Settings };

// Instellingen zijn per gebruiker: data/users/<id>/settings.json.
async function settingsFile(): Promise<string> {
  const root = userRoot(await requireUserId());
  await fs.mkdir(root, { recursive: true });
  return path.join(root, "settings.json");
}

export async function getSettings(): Promise<Settings> {
  let settings: Settings;
  try {
    const raw = JSON.parse(await fs.readFile(await settingsFile(), "utf-8"));
    settings = sanitize(raw);
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  // Geen AI-naam ingesteld: gebruik de voornaam van het account, zodat de
  // begroeting en systeemprompt altijd op de echte gebruiker slaan.
  if (!settings.name) {
    try {
      const user = await findById(await requireUserId());
      settings.name = user?.name.trim().split(/\s+/)[0] ?? "";
    } catch {
      // niet ingelogd of account onvindbaar — begroeting blijft zonder naam
    }
  }
  return settings;
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const settings = sanitize(input);
  await fs.writeFile(await settingsFile(), JSON.stringify(settings, null, 2), "utf-8");
  return settings;
}

function sanitize(input: unknown): Settings {
  const raw = (input ?? {}) as Partial<Settings>;
  const model = MODEL_OPTIONS.some((m) => m.id === raw.model)
    ? (raw.model as string)
    : DEFAULT_SETTINGS.model;
  const maxTokens = MAX_TOKENS_OPTIONS.some((o) => o.value === raw.maxTokens)
    ? (raw.maxTokens as number)
    : DEFAULT_SETTINGS.maxTokens;
  const customInstructions =
    typeof raw.customInstructions === "string"
      ? raw.customInstructions.slice(0, 2000)
      : DEFAULT_SETTINGS.customInstructions;
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 40)
      : DEFAULT_SETTINGS.name;
  const demoMode = raw.demoMode === true;
  return { model, maxTokens, customInstructions, name, demoMode };
}
