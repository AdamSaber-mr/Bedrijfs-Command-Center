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

// Mini-ring voor scorekaartjes: zelfde severity-tinten (600-stappen,
// gevalideerd op contrast voor licht en donker) als de grote ringen op het
// rapport; het cijfer blijft in inkt-kleur.
function MiniRing({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70 ? "var(--accent-600)" : clamped >= 45 ? "#d97706" : "#dc2626";
  const R = 15;
  const CIRC = 2 * Math.PI * R;
  return (
    <span className="flex flex-col items-center gap-0.5" role="img" aria-label={`${label}: ${clamped} van 100`}>
      <span className="relative h-9 w-9">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="3.5" />
          <circle
            cx="18"
            cy="18"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - clamped / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
          {clamped}
        </span>
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-600">
        {label}
      </span>
    </span>
  );
}

interface DayStat {
  date: string;
  count: number;
}

// Vloeiend pad (monotone cubic, Fritsch–Carlson): glad zoals moderne
// fintech-grafieken, maar zonder overshoot voorbij de datapunten.
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  m[n - 1] = slope[n - 2];
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

// Activiteit als moderne area-grafiek: één serie in accent-600 (gevalideerd
// op contrast voor licht én donker), gradient-wash eronder, crosshair die
// naar de dichtstbijzijnde dag snapt, en een stat-kop met weekdelta.
function ActivityChart({ days }: { days: DayStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const lastWeek = days.slice(7).reduce((s, d) => s + d.count, 0);
  const prevWeek = days.slice(0, 7).reduce((s, d) => s + d.count, 0);
  const delta = prevWeek > 0 ? Math.round(((lastWeek - prevWeek) / prevWeek) * 100) : null;

  const W = 560;
  const H = 120;
  const PAD_X = 6;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 6;
  const max = Math.max(...days.map((d) => d.count), 1);
  const pts = days.map((d, i) => ({
    x: PAD_X + (i / (days.length - 1)) * (W - PAD_X * 2),
    y: PAD_TOP + (1 - d.count / max) * (H - PAD_TOP - PAD_BOTTOM),
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const last = pts[pts.length - 1];
  const active = hover !== null ? pts[hover] : null;

  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  // Crosshair snapt naar de dichtstbijzijnde dag — de lezer mikt op een
  // datum, nooit op een 2px-lijn.
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((x - PAD_X) / (W - PAD_X * 2)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  }

  return (
    <section
      className="animate-fade-up mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-slate-900/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"
      style={{ animationDelay: "0.22s" }}
    >
      {/* Stat-kop: label, waarde (volgt de hover), delta t.o.v. vorige week */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Berichten · 14 dagen
        </h2>
        <p className="mt-1 flex items-baseline gap-2.5">
          <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {hover !== null ? days[hover].count : total}
          </span>
          {hover !== null ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {dayLabel(days[hover].date)}
            </span>
          ) : (
            delta !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                  delta >= 0
                    ? "bg-accent-500/10 text-accent-700 dark:text-accent-300"
                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta}% t.o.v. vorige week
              </span>
            )
          )}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Berichten per dag, laatste 14 dagen, totaal ${total}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="mt-3 h-28 w-full touch-none"
      >
        <defs>
          <linearGradient id="activity-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-600)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent-600)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessieve hairline-gridlijnen */}
        {[0.5, 1].map((f) => {
          const y = PAD_TOP + (1 - f) * (H - PAD_TOP - PAD_BOTTOM);
          return (
            <line
              key={f}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              className="stroke-slate-900/[0.06] dark:stroke-white/[0.06]"
              strokeWidth="1"
            />
          );
        })}

        <path d={area} fill="url(#activity-wash)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair + actief punt (met 2px surface-ring) */}
        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD_TOP - 4}
            y2={H}
            className="stroke-slate-900/15 dark:stroke-white/20"
            strokeWidth="1"
          />
        )}
        <circle
          cx={active ? active.x : last.x}
          cy={active ? active.y : last.y}
          r="4.5"
          fill="var(--accent-600)"
          className="stroke-white dark:stroke-[#0d1526]"
          strokeWidth="2"
        />
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-600">
        <span>{dayLabel(days[0].date)}</span>
        <span>vandaag</span>
      </div>

      <table className="sr-only">
        <caption>Berichten per dag, laatste 14 dagen</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DashboardView() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [stats, setStats] = useState<DayStat[] | null>(null);
  const [question, setQuestion] = useState("");
  const { greeting, tagline } = useGreeting();
  const typed = useTypewriter(greeting);

  useEffect(() => {
    (async () => {
      try {
        const [chatsRes, reportsRes, statsRes] = await Promise.all([
          fetch("/api/chats"),
          fetch("/api/reports"),
          fetch("/api/stats"),
        ]);
        const chatsData = await chatsRes.json();
        const reportsData = await reportsRes.json();
        const statsData = await statsRes.json();
        setChats(chatsData.chats ?? []);
        setReports(reportsData.reports ?? []);
        setStats(statsData.days ?? []);
      } catch {
        setChats([]);
        setReports([]);
        setStats([]);
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

      {stats !== null && stats.length > 0 && stats.some((d) => d.count > 0) && (
        <ActivityChart days={stats} />
      )}

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
                <span className="flex shrink-0 gap-3">
                  <MiniRing score={report.marketScore} label="markt" />
                  <MiniRing score={report.fitScore} label="fit" />
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
