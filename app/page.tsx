"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { ChatSummary } from "@/lib/chatStore";
import type { ReportSummary } from "@/lib/reportStore";
import { useGreeting } from "@/lib/greeting";
import { useTypewriter } from "@/lib/animation";

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
  if (score >= 70) return "text-accent-700 dark:text-accent-300";
  if (score >= 45) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function DashboardView() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [question, setQuestion] = useState("");
  const { greeting, tagline } = useGreeting();
  const typed = useTypewriter(greeting);

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
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-8">
      {/* Hero: begroeting + directe vraag */}
      <header className="flex flex-col items-center pt-20 text-center sm:pt-28">
        <h1 className="min-h-[44px] font-[family-name:var(--font-display)] text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
          {typed.display}
          {greeting && !typed.done && (
            <span className="animate-blink ml-1 inline-block h-[0.85em] w-[3px] rounded bg-accent-400 align-baseline" />
          )}
        </h1>
        <p
          className={`mt-2 min-h-[24px] text-[15px] text-slate-500 transition-opacity duration-500 dark:text-slate-400 ${
            typed.done ? "opacity-100" : "opacity-0"
          }`}
        >
          {tagline}
        </p>
        <form onSubmit={ask} className="animate-fade-up mt-7 w-full max-w-2xl" style={{ animationDelay: "0.06s" }}>
          <div className="flex gap-2 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] p-2.5 focus-within:border-accent-400/50">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Hoe kan ik je vandaag helpen?"
              autoFocus
              className="w-full bg-transparent px-3 py-2 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={question.trim().length === 0}
              aria-label="Verstuur"
              className="shrink-0 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </form>
        <div className="animate-fade-up mt-5 flex flex-wrap justify-center gap-2" style={{ animationDelay: "0.12s" }}>
          <Link
            href="/chat"
            className="rounded-full border border-slate-900/10 dark:border-white/10 px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95"
          >
            ＋ Nieuwe chat
          </Link>
          <Link
            href="/research"
            className="rounded-full border border-slate-900/10 dark:border-white/10 px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95"
          >
            Deal Research
          </Link>
        </div>
        {chats !== null && reports !== null && (chats.length > 0 || reports.length > 0) && (
          <p className="animate-fade-up mt-8 text-xs text-slate-400 dark:text-slate-600" style={{ animationDelay: "0.18s" }}>
            {chats.length} {chats.length === 1 ? "chat" : "chats"} · {totalMessages}{" "}
            {totalMessages === 1 ? "bericht" : "berichten"} · {reports.length}{" "}
            {reports.length === 1 ? "rapport" : "rapporten"}
          </p>
        )}
      </header>

      <div className="mt-14 grid gap-8 lg:grid-cols-2">
        {/* Recente chats */}
        <section className="animate-fade-up" style={{ animationDelay: "0.14s" }}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recente chats
            </h2>
            <Link
              href="/chat"
              className="text-xs font-medium text-accent-700 dark:text-accent-300 hover:underline"
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
            {(chats ?? []).slice(0, 6).map((chat, i) => (
              <Link
                key={chat.id}
                href={`/chat?chat=${chat.id}`}
                className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/20"
                style={{ animationDelay: `${0.05 + i * 0.05}s` }}
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
              className="text-xs font-medium text-accent-700 dark:text-accent-300 hover:underline"
            >
              + Nieuwe analyse
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {reports !== null && reports.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 dark:border-white/15 px-4 py-6 text-center text-sm text-slate-500">
                Nog geen analyses —{" "}
                <Link href="/research" className="text-accent-700 dark:text-accent-300 hover:underline">
                  start je eerste deal-onderzoek
                </Link>
                .
              </p>
            )}
            {(reports ?? []).slice(0, 6).map((report, i) => (
              <Link
                key={report.id}
                href={`/research?report=${report.id}`}
                className="animate-fade-up flex items-center justify-between gap-4 rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/20"
                style={{ animationDelay: `${0.05 + i * 0.05}s` }}
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
