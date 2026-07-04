"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { ChatSummary } from "@/lib/chatStore";
import type { ReportSummary } from "@/lib/reportStore";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gisteren";
  if (days < 7) return `${days} dagen geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 45) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p>
    </div>
  );
}

function DashboardView() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [chatsRes, reportsRes] = await Promise.all([
          fetch("/api/chats"),
          fetch("/api/reports"),
        ]);
        const chatsData = await chatsRes.json();
        const reportsData = await reportsRes.json();
        setChats(chatsData.chats ?? []);
        setReports(reportsData.reports ?? []);
      } catch {
        setChats([]);
        setReports([]);
      }
    })();
  }, []);

  const totalMessages = (chats ?? []).reduce((sum, c) => sum + c.messageCount, 0);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      {/* Kop + directe vraag */}
      <header className="animate-fade-up">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-600/90 dark:text-emerald-400/80">
          Dashboard
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
          {greeting()}, Adam
        </h1>
        <form onSubmit={ask} className="mt-6 max-w-2xl">
          <div className="flex gap-3 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] p-2 shadow-lg shadow-slate-900/5 dark:shadow-black/30 focus-within:border-emerald-400/50">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Stel direct een vraag aan je AI-assistent…"
              className="w-full bg-transparent px-4 py-2.5 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={question.trim().length === 0}
              className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Vraag
            </button>
          </div>
        </form>
      </header>

      {/* Statistieken */}
      <div className="animate-fade-up mt-10 grid gap-4 sm:grid-cols-3" style={{ animationDelay: "0.08s" }}>
        <StatTile
          label="Chats"
          value={chats === null ? "–" : String(chats.length)}
          hint="opgeslagen gesprekken"
        />
        <StatTile
          label="Berichten"
          value={chats === null ? "–" : String(totalMessages)}
          hint="bruikbaar als trainingsdata"
        />
        <StatTile
          label="Deal-rapporten"
          value={reports === null ? "–" : String(reports.length)}
          hint="opgeslagen analyses"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Recente chats */}
        <section className="animate-fade-up" style={{ animationDelay: "0.14s" }}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recente chats
            </h2>
            <Link
              href="/chat"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              + Nieuwe chat
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {chats !== null && chats.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 dark:border-white/15 px-4 py-6 text-center text-sm text-slate-500">
                Nog geen chats — stel hierboven je eerste vraag.
              </p>
            )}
            {(chats ?? []).slice(0, 6).map((chat) => (
              <Link
                key={chat.id}
                href={`/chat?chat=${chat.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 transition hover:border-emerald-400/40"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                  {chat.title}
                </span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {relativeTime(chat.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recente rapporten */}
        <section className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Deal-rapporten
            </h2>
            <Link
              href="/research"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              + Nieuwe analyse
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {reports !== null && reports.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 dark:border-white/15 px-4 py-6 text-center text-sm text-slate-500">
                Nog geen analyses —{" "}
                <Link href="/research" className="text-emerald-700 dark:text-emerald-300 hover:underline">
                  start je eerste deal-onderzoek
                </Link>
                .
              </p>
            )}
            {(reports ?? []).slice(0, 6).map((report) => (
              <Link
                key={report.id}
                href={`/research?report=${report.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 transition hover:border-emerald-400/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {report.company}
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {relativeTime(report.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-4 text-right">
                  <span>
                    <span className={`block font-[family-name:var(--font-display)] text-sm font-bold tabular-nums ${scoreColor(report.marketScore)}`}>
                      {report.marketScore}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-600">
                      markt
                    </span>
                  </span>
                  <span>
                    <span className={`block font-[family-name:var(--font-display)] text-sm font-bold tabular-nums ${scoreColor(report.fitScore)}`}>
                      {report.fitScore}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-600">
                      fit
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <AppShell>
        <DashboardView />
      </AppShell>
    </Suspense>
  );
}
