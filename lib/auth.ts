import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { SESSION_COOKIE } from "./authConstants";

// Sessies: token → gebruiker. Bewust server-side (niet in de cookie zelf) zodat
// uitloggen een sessie echt intrekt en cookies niet te vervalsen zijn.
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dagen

type SessionMap = Record<string, { userId: string; createdAt: string }>;

async function readSessions(): Promise<SessionMap> {
  try {
    return JSON.parse(await fs.readFile(SESSIONS_FILE, "utf-8")) as SessionMap;
  } catch {
    return {};
  }
}

async function writeSessions(sessions: SessionMap): Promise<void> {
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const sessions = await readSessions();
  sessions[token] = { userId, createdAt: new Date().toISOString() };
  await writeSessions(sessions);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const sessions = await readSessions();
  if (sessions[token]) {
    delete sessions[token];
    await writeSessions(sessions);
  }
}

/* ---------- Cookie-helpers (alleen in Route Handlers / Server Actions) ---------- */

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/* ---------- Huidige gebruiker ---------- */

export async function getCurrentUserId(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const sessions = await readSessions();
  return sessions[token]?.userId ?? null;
}

// Gooit als er geen geldige sessie is; gebruikt door de per-gebruiker stores.
export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new Error("NIET_INGELOGD");
  return id;
}

/* ---------- Per-gebruiker datamap ---------- */

// Elke gebruiker heeft zijn eigen map data/users/<id>/ met chats, reports, enz.
export function userRoot(userId: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) throw new Error("Ongeldig gebruikers-ID");
  return path.join(process.cwd(), "data", "users", userId);
}

// Verplaatst bestaande (single-user) data eenmalig naar de map van deze gebruiker.
// Bedoeld voor de allereerste registratie, zodat oude chats/rapporten niet
// verloren gaan. Verplaatst alleen als de bestemming nog niet bestaat.
export async function migrateLegacyData(userId: string): Promise<void> {
  const root = userRoot(userId);
  await fs.mkdir(root, { recursive: true });
  const dataDir = path.join(process.cwd(), "data");
  const legacy = ["chats", "reports", "notes", "prompts.json", "settings.json"];
  for (const name of legacy) {
    const src = path.join(dataDir, name);
    const dst = path.join(root, name);
    try {
      await fs.access(src); // bestaat er legacy-data?
    } catch {
      continue;
    }
    try {
      await fs.access(dst); // bestemming bestaat al → niet overschrijven
      continue;
    } catch {
      // bestemming bestaat niet — verplaatsen
    }
    try {
      await fs.rename(src, dst);
    } catch {
      // verplaatsen mislukt (bv. cross-device) — stil negeren
    }
  }
}
