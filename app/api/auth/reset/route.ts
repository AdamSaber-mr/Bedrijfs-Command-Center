import { NextResponse } from "next/server";
import { resetPasswordWithCode } from "@/lib/users";
import { checkRateLimit, clearRateLimit, recordFailure } from "@/lib/rateLimit";

// Wachtwoord-reset met e-mail + herstelcode (zie lib/users.ts). Zelfde
// rate-limiting als inloggen, met een eigen sleutel-prefix.
export async function POST(request: Request) {
  let email: unknown, code: unknown, newPassword: unknown;
  try {
    ({ email, code, newPassword } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (
    typeof email !== "string" ||
    typeof code !== "string" ||
    typeof newPassword !== "string"
  ) {
    return NextResponse.json({ error: "Vul alle velden in." }, { status: 400 });
  }

  const key = `reset:${email.trim().toLowerCase()}`;
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfter / 60);
    return NextResponse.json(
      { error: `Te veel pogingen. Probeer het over ${minutes} minuten opnieuw.` },
      { status: 429 }
    );
  }

  const result = await resetPasswordWithCode(email, code, newPassword);
  if (!result.ok) {
    recordFailure(key);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  clearRateLimit(key);
  // De oude code is verbruikt; de nieuwe wordt één keer getoond.
  return NextResponse.json({ ok: true, recoveryCode: result.recoveryCode });
}
