import { promises as fs } from "fs";
import path from "path";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export interface User {
  id: string;
  email: string;
  name: string;
  // Wachtwoord wordt nooit als platte tekst bewaard: scrypt-hash + salt.
  salt: string;
  hash: string;
  createdAt: string;
  // Herstelcode (voor wachtwoord-reset zonder e-mailserver), ook gehasht.
  recoverySalt?: string;
  recoveryHash?: string;
}

// Publieke weergave van een gebruiker — nooit salt/hash naar de client sturen.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const FILE = path.join(process.cwd(), "data", "users.json");

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readAll(): Promise<User[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8")) as User[];
  } catch {
    return [];
  }
}

async function writeAll(users: User[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function publicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export async function userCount(): Promise<number> {
  return (await readAll()).length;
}

export async function findByEmail(email: string): Promise<User | null> {
  const norm = email.trim().toLowerCase();
  return (await readAll()).find((u) => u.email === norm) ?? null;
}

export async function findById(id: string): Promise<User | null> {
  return (await readAll()).find((u) => u.id === id) ?? null;
}

// Maakt een gebruiker aan; retourneert null als het e-mailadres al bestaat.
export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<User | null> {
  const norm = email.trim().toLowerCase();
  const users = await readAll();
  if (users.some((u) => u.email === norm)) return null;
  const { salt, hash } = hashPassword(password);
  const user: User = {
    id: randomUUID(),
    email: norm,
    name: name.trim().slice(0, 60),
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeAll(users);
  return user;
}

// Verifieert inloggegevens in constante tijd; retourneert de gebruiker of null.
export async function verifyCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await findByEmail(email);
  if (!user) return null;
  const candidate = scryptSync(password, user.salt, 64);
  const known = Buffer.from(user.hash, "hex");
  if (candidate.length !== known.length) return null;
  return timingSafeEqual(candidate, known) ? user : null;
}

function passwordMatches(user: User, password: string): boolean {
  const candidate = scryptSync(password, user.salt, 64);
  const known = Buffer.from(user.hash, "hex");
  return candidate.length === known.length && timingSafeEqual(candidate, known);
}

// Naam en/of e-mail bijwerken; controleert e-mailformaat en uniciteit.
export async function updateUser(
  id: string,
  patch: { name?: string; email?: string }
): Promise<{ user: User | null; error?: string }> {
  const users = await readAll();
  const user = users.find((u) => u.id === id);
  if (!user) return { user: null, error: "Gebruiker niet gevonden" };

  if (typeof patch.email === "string") {
    const norm = patch.email.trim().toLowerCase();
    if (!EMAIL_RE.test(norm)) return { user: null, error: "Vul een geldig e-mailadres in." };
    if (users.some((u) => u.id !== id && u.email === norm)) {
      return { user: null, error: "Dit e-mailadres is al in gebruik." };
    }
    user.email = norm;
  }
  if (typeof patch.name === "string" && patch.name.trim()) {
    user.name = patch.name.trim().slice(0, 60);
  }
  await writeAll(users);
  return { user };
}

// Wachtwoord wijzigen: verifieert eerst het huidige wachtwoord.
export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const users = await readAll();
  const user = users.find((u) => u.id === id);
  if (!user) return { ok: false, error: "Gebruiker niet gevonden" };
  if (!passwordMatches(user, currentPassword)) {
    return { ok: false, error: "Je huidige wachtwoord klopt niet." };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, error: "Nieuw wachtwoord moet minimaal 8 tekens zijn." };
  }
  const { salt, hash } = hashPassword(newPassword);
  user.salt = salt;
  user.hash = hash;
  await writeAll(users);
  return { ok: true };
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readAll();
  await writeAll(users.filter((u) => u.id !== id));
}

/* ---------- Herstelcode (wachtwoord vergeten, zonder e-mailserver) ---------- */

// Leesbaar formaat XXXX-XXXX-XXXX zonder verwarrende tekens (geen O/0, I/1).
function newRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Geeft een nieuwe herstelcode uit voor de gebruiker; de code wordt alleen
// gehasht bewaard en is dus maar één keer zichtbaar voor de gebruiker.
export async function issueRecoveryCode(id: string): Promise<string | null> {
  const users = await readAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  const code = newRecoveryCode();
  const { salt, hash } = hashPassword(normalizeRecoveryCode(code));
  user.recoverySalt = salt;
  user.recoveryHash = hash;
  await writeAll(users);
  return code;
}

// Reset het wachtwoord met e-mail + herstelcode. De code is eenmalig:
// na een geslaagde reset wordt direct een nieuwe uitgegeven en teruggegeven.
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string; recoveryCode?: string }> {
  // Bewust één generieke foutmelding, zodat niet te raden is of het
  // e-mailadres bestaat of de code fout is.
  const invalid = { ok: false, error: "Onjuiste combinatie van e-mailadres en herstelcode." };
  const users = await readAll();
  const user = users.find((u) => u.email === email.trim().toLowerCase());
  if (!user?.recoverySalt || !user?.recoveryHash) return invalid;

  const candidate = scryptSync(normalizeRecoveryCode(code), user.recoverySalt, 64);
  const known = Buffer.from(user.recoveryHash, "hex");
  if (candidate.length !== known.length || !timingSafeEqual(candidate, known)) return invalid;

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, error: "Nieuw wachtwoord moet minimaal 8 tekens zijn." };
  }
  const { salt, hash } = hashPassword(newPassword);
  user.salt = salt;
  user.hash = hash;
  const fresh = newRecoveryCode();
  const rc = hashPassword(normalizeRecoveryCode(fresh));
  user.recoverySalt = rc.salt;
  user.recoveryHash = rc.hash;
  await writeAll(users);
  return { ok: true, recoveryCode: fresh };
}
