"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Clean login-/registratieformulier in Claude-stijl. Wachtwoorden worden
// alleen door de gebruiker zelf ingevuld en direct naar de server gestuurd.
export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Registratie kan gesloten zijn (app-instelling); null = nog aan het laden.
  const [regOpen, setRegOpen] = useState<boolean | null>(null);
  // Na registratie tonen we eenmalig de herstelcode.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/register");
        const data = await res.json();
        if (!cancelled) setRegOpen(data.open === true);
      } catch {
        if (!cancelled) setRegOpen(true); // bij twijfel het formulier tonen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!isLogin && password !== confirm) {
      setError("De wachtwoorden komen niet overeen.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLogin ? { email, password } : { name, email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Er ging iets mis. Probeer het opnieuw.");
        setLoading(false);
        return;
      }
      // Bij registratie eerst de herstelcode tonen; daarna pas de app in.
      if (!isLogin && data.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
        setLoading(false);
        return;
      }
      // Volledige refresh zodat de proxy de nieuwe sessie oppikt.
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("Kan geen verbinding maken. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  function enterApp() {
    router.replace(from && from.startsWith("/") ? from : "/");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-accent-400/60 focus:outline-none focus:ring-4 focus:ring-accent-500/10 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelCls = "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10 dark:bg-[#0a0f1a]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Vantage
          </span>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isLogin ? "Welkom terug — log in om verder te gaan." : "Maak een account aan om te beginnen."}
          </p>
        </div>

        {/* Na registratie: eenmalig de herstelcode tonen */}
        {recoveryCode && (
          <div className="rounded-2xl border border-slate-900/10 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/30">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Bewaar je herstelcode
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Met deze code kun je je wachtwoord resetten als je het vergeet. Ze wordt
              maar één keer getoond — bewaar haar op een veilige plek.
            </p>
            <p className="mt-4 select-all rounded-xl border border-accent-600/30 bg-accent-500/10 px-4 py-3 text-center font-[family-name:var(--font-mono)] text-lg font-semibold tracking-wider text-accent-700 dark:border-accent-500/30 dark:text-accent-300">
              {recoveryCode}
            </p>
            <button
              onClick={enterApp}
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-[0.99]"
            >
              Ik heb de code bewaard — naar Vantage
            </button>
          </div>
        )}

        {/* Registratie gesloten */}
        {!recoveryCode && !isLogin && regOpen === false && (
          <div className="rounded-2xl border border-slate-900/10 bg-white p-6 text-center shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/30">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Registratie is gesloten
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Er kunnen momenteel geen nieuwe accounts worden aangemaakt. Vraag de
              beheerder om registratie te openen via Instellingen → Account.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400"
            >
              Naar inloggen
            </Link>
          </div>
        )}

        {!recoveryCode && (isLogin || regOpen !== false) && (
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/30">
          <h1 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">
            {isLogin ? "Inloggen" : "Account aanmaken"}
          </h1>

          <form onSubmit={submit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="name" className={labelCls}>
                  Naam
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Je naam"
                  required
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className={labelCls}>
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@voorbeeld.nl"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Je wachtwoord" : "Minimaal 8 tekens"}
                minLength={isLogin ? undefined : 8}
                required
                className={inputCls}
              />
            </div>
            {!isLogin && (
              <div>
                <label htmlFor="confirm" className={labelCls}>
                  Bevestig wachtwoord
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Herhaal je wachtwoord"
                  required
                  className={inputCls}
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-950 transition enabled:hover:bg-accent-400 enabled:active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Bezig…" : isLogin ? "Inloggen" : "Account aanmaken"}
            </button>

            {isLogin && (
              <p className="text-center">
                <Link
                  href="/reset"
                  className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Wachtwoord vergeten?
                </Link>
              </p>
            )}
          </form>
        </div>
        )}

        {!recoveryCode && (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {isLogin ? "Nog geen account? " : "Heb je al een account? "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
            >
              {isLogin ? "Registreren" : "Inloggen"}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
