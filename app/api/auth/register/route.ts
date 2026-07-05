import { NextResponse } from "next/server";
import { createUser, publicUser, userCount } from "@/lib/users";
import { createSession, migrateLegacyData, setSessionCookie } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email: unknown, name: unknown, password: unknown;
  try {
    ({ email, name, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Wachtwoord moet minimaal 8 tekens zijn." },
      { status: 400 }
    );
  }

  // De allereerste gebruiker erft de bestaande (single-user) data.
  const firstUser = (await userCount()) === 0;
  const user = await createUser(email, name, password);
  if (!user) {
    return NextResponse.json(
      { error: "Er bestaat al een account met dit e-mailadres." },
      { status: 409 }
    );
  }
  if (firstUser) await migrateLegacyData(user.id);

  const token = await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({ user: publicUser(user) });
}
