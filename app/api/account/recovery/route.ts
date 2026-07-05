import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { issueRecoveryCode } from "@/lib/users";

// Nieuwe herstelcode voor het ingelogde account; maakt de oude ongeldig.
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const recoveryCode = await issueRecoveryCode(userId);
  if (!recoveryCode) return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
  return NextResponse.json({ recoveryCode });
}
