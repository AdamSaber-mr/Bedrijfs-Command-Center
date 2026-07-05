import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { changePassword } from "@/lib/users";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return NextResponse.json({ error: "Vul beide wachtwoordvelden in." }, { status: 400 });
  }

  const { ok, error } = await changePassword(userId, body.currentPassword, body.newPassword);
  if (!ok) return NextResponse.json({ error: error ?? "Wijzigen mislukt" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
