import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteUserData,
  destroyUserSessions,
  getCurrentUserId,
} from "@/lib/auth";
import { deleteUser, publicUser, updateUser } from "@/lib/users";

// Naam en/of e-mailadres van het ingelogde account bijwerken.
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  let body: { name?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const patch: { name?: string; email?: string } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.email === "string") patch.email = body.email;

  const { user, error } = await updateUser(userId, patch);
  if (!user) {
    const status = error?.includes("gebruik") ? 409 : 400;
    return NextResponse.json({ error: error ?? "Bijwerken mislukt" }, { status });
  }
  return NextResponse.json({ user: publicUser(user) });
}

// Account definitief verwijderen: gebruiker, sessies én alle data.
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  await deleteUser(userId);
  await destroyUserSessions(userId);
  await deleteUserData(userId);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
