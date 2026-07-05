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
}

// Publieke weergave van een gebruiker — nooit salt/hash naar de client sturen.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const FILE = path.join(process.cwd(), "data", "users.json");

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
