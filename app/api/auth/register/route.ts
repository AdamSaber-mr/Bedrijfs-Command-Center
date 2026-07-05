import { NextResponse } from "next/server";
import { EMAIL_RE, createUser, issueRecoveryCode, publicUser, userCount } from "@/lib/users";
import {
  createSession,
  getCurrentUserId,
  migrateLegacyData,
  setSessionCookie,
} from "@/lib/auth";
import { getAppConfig, saveAppConfig } from "@/lib/appConfig";

// De allereerste registratie is altijd toegestaan; daarna bepaalt de
// app-instelling "openRegistration" of nieuwe accounts welkom zijn.
async function registrationOpen(): Promise<boolean> {
  if ((await userCount()) === 0) return true;
  return (await getAppConfig()).openRegistration;
}

// Publieke status voor de registratiepagina.
export async function GET() {
  return NextResponse.json({ open: await registrationOpen() });
}

// Registratie openen/sluiten — alleen voor ingelogde gebruikers.
export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  let open: unknown;
  try {
    ({ open } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const config = await saveAppConfig({ openRegistration: open === true });
  return NextResponse.json({ open: config.openRegistration });
}

export async function POST(request: Request) {
  if (!(await registrationOpen())) {
    return NextResponse.json(
      { error: "Registratie is gesloten. Vraag de beheerder om toegang." },
      { status: 403 }
    );
  }

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

  // Herstelcode voor "wachtwoord vergeten" — één keer zichtbaar bij registratie.
  const recoveryCode = await issueRecoveryCode(user.id);

  const token = await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({ user: publicUser(user), recoveryCode });
}
