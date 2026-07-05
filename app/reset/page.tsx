"use client";

import { useState } from "react";
import Link from "next/link";

// Wachtwoord resetten met de herstelcode die bij registratie is uitgegeven.
// Publieke pagina (zie PUBLIC_PATHS); na een geslaagde reset tonen we de
// nieuwe herstelcode, want de oude is eenmalig.
export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (password !== confirm) {
      setError("De wachtwoorden komen niet overeen.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Er ging iets mis. Probeer het opnieuw.");
        setLoading(false);
        return;
      }
      setNewCode(data.recoveryCode ?? "");
    } catch {
      setError("Kan geen verbinding maken. Probeer het opnieuw.");
    }
    setLoading(false);
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
            Reset je wachtwoord met je herstelcode.
          </p>
        </div>

        {newCode !== null ? (
          <div className="rounded-2xl border border-slate-900/10 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/30">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Wachtwoord gewijzigd
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Je oude herstelcode is verbruikt. Dit is je nieuwe code — bewaar haar op
              een veilige plek, ze wordt maar één keer getoond.
            </p>
            <p className="mt-4 select-all rounded-xl border border-accent-600/30 bg-accent-500/10 px-4 py-3 text-center font-[family-name:var(--font-mono)] text-lg font-semibold tracking-wider text-accent-700 dark:border-accent-500/30 dark:text-accent-300">
              {newCode}
            </p>
            <Link
              href="/login"
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400"
            >
              Naar inloggen
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-900/10 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/30">
            <h1 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">
              Wachtwoord vergeten
            </h1>
            <form onSubmit={submit} className="space-y-4">
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
                <label htmlFor="code" className={labelCls}>
                  Herstelcode
                </label>
                <input
                  id="code"
                  type="text"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  required
                  className={`${inputCls} font-[family-name:var(--font-mono)] tracking-wider`}
                />
              </div>
              <div>
                <label htmlFor="password" className={labelCls}>
                  Nieuw wachtwoord
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimaal 8 tekens"
                  minLength={8}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="confirm" className={labelCls}>
                  Bevestig nieuw wachtwoord
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Herhaal je nieuwe wachtwoord"
                  required
                  className={inputCls}
                />
              </div>

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
                {loading ? "Bezig…" : "Wachtwoord resetten"}
              </button>
            </form>
          </div>
        )}

        {newCode === null && (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Toch weer terecht?{" "}
            <Link
              href="/login"
              className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
            >
              Inloggen
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
