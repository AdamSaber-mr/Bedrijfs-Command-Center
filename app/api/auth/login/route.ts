import { NextResponse } from "next/server";
import { publicUser, verifyCredentials } from "@/lib/users";
import { createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, clearRateLimit, recordFailure } from "@/lib/rateLimit";

export async function POST(request: Request) {
  let email: unknown, password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Vul je e-mailadres en wachtwoord in." }, { status: 400 });
  }

  const key = email.trim().toLowerCase();
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfter / 60);
    return NextResponse.json(
      { error: `Te veel inlogpogingen. Probeer het over ${minutes} minuten opnieuw.` },
      { status: 429 }
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    recordFailure(key);
    return NextResponse.json(
      { error: "Onjuist e-mailadres of wachtwoord." },
      { status: 401 }
    );
  }

  clearRateLimit(key);
  const token = await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({ user: publicUser(user) });
}
