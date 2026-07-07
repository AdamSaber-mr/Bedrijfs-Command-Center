"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { ChatSummary } from "@/lib/chatStore";
import type { ReportSummary } from "@/lib/reportStore";
import type { ProjectSummary, ProjectStage } from "@/lib/projectStore";
import type { Watch } from "@/lib/watchStore";
import { WATCHES_UPDATED_EVENT } from "@/lib/events";
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

interface Briefing {
  generatedAt: string;
  text: string;
}

const STAGE_LABELS: Record<ProjectStage, string> = {
  verkennen: "Verkennen",
  in_gesprek: "In gesprek",
  deal: "Deal",
  afgewezen: "Afgewezen",
};

const dayCount = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

// Pipeline-intelligentie: het dashboard vertelt wat er met je deals gebeurt
// (briefing, stilstand, verouderde rapporten, updates van gevolgde
// bedrijven) in plaats van alleen gebruiksstatistieken.
function PipelineToday({
  projects,
  reports,
  watches,
  checking,
  onCheckAll,
}: {
  projects: ProjectSummary[];
  reports: ReportSummary[];
  watches: Watch[];
  checking: boolean;
  onCheckAll: () => void;
}) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [generating, setGenerating] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/briefing");
        const data = await res.json();
        if (!cancelled) setBriefing(data.briefing ?? null);
      } catch {
        // briefing mag stil falen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function generateBriefing() {
    if (generating) return;
    setGenerating(true);
    setBriefingError(null);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Briefing mislukt");
      setBriefing(data.briefing);
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setGenerating(false);
    }
  }

  // Wat vraagt aandacht: stilstaande deals en verouderde rapporten.
  const staleProjects = projects.filter(
    (p) =>
      (p.stage === "verkennen" || p.stage === "in_gesprek") &&
      dayCount(p.updatedAt) >= 14
  );
  const latestPerCompany = new Map<string, ReportSummary>();
  for (const r of reports) {
    const key = r.company.trim().toLowerCase();
    if (!latestPerCompany.has(key)) latestPerCompany.set(key, r);
  }
  const agingReports = [...latestPerCompany.values()].filter(
    (r) => dayCount(r.createdAt) >= 60
  );
  const attention: { key: string; text: string; href: string; cta: string }[] = [
    ...staleProjects.map((p) => ({
      key: `project-${p.id}`,
      text: `“${p.name}” (${STAGE_LABELS[p.stage].toLowerCase()}) staat al ${dayCount(p.updatedAt)} dagen stil`,
      href: "/projecten",
      cta: "Open project",
    })),
    ...agingReports.map((r) => ({
      key: `report-${r.id}`,
      text: `Rapport over ${r.company} is ${dayCount(r.createdAt)} dagen oud`,
      href: `/research?report=${r.id}`,
      cta: "Ververs analyse",
    })),
  ].slice(0, 5);

  // Recentste updates van gevolgde bedrijven, ongelezen eerst zichtbaar.
  const updates = watches
    .flatMap((w) => w.updates.map((u) => ({ watch: w, update: u })))
    .sort((a, b) => b.update.foundAt.localeCompare(a.update.foundAt))
    .slice(0, 4);

  const stageCounts = (Object.keys(STAGE_LABELS) as ProjectStage[])
    .map((stage) => ({ stage, count: projects.filter((p) => p.stage === stage).length }))
    .filter((s) => s.count > 0);

  const briefingIsToday =
    briefing !== null &&
    new Date(briefing.generatedAt).toDateString() === new Date().toDateString();

  return (
    <section
      className="animate-fade-up mx-auto mt-10 w-full max-w-5xl rounded-2xl border border-slate-900/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03] sm:p-6"
      style={{ animationDelay: "0.1s" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
          Vandaag in je pipeline
        </h2>
        <div className="flex items-center gap-2">
          {watches.length > 0 && (
            <button
              onClick={onCheckAll}
              disabled={checking}
              title="Doorzoek het web nu op nieuws over al je gevolgde bedrijven"
              className="rounded-lg border border-slate-900/15 px-3 py-1.5 text-xs text-slate-600 transition hover:border-accent-400/50 hover:text-slate-900 disabled:opacity-50 dark:border-white/15 dark:text-slate-400 dark:hover:text-white"
            >
              {checking ? "Bedrijven checken…" : "↻ Check gevolgde bedrijven"}
            </button>
          )}
          <button
            onClick={generateBriefing}
            disabled={generating}
            className="rounded-lg border border-accent-600/30 bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-700 transition hover:bg-accent-500/20 disabled:opacity-50 dark:border-accent-500/30 dark:text-accent-300"
          >
            {generating
              ? "Briefing maken…"
              : briefing
                ? "↻ Nieuwe briefing"
                : "✦ Genereer dagbriefing"}
          </button>
        </div>
      </div>

      {briefingError && (
        <p className="mt-3 rounded-lg border border-red-600/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:text-red-300">
          {briefingError}
        </p>
      )}
      {briefing && (
        <div className="mt-4 rounded-xl border border-slate-900/10 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {briefingIsToday
              ? "Briefing van vandaag"
              : `Briefing van ${new Date(briefing.generatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}`}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {briefing.text}
          </p>
        </div>
      )}

      {stageCounts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {stageCounts.map(({ stage, count }) => (
            <Link
              key={stage}
              href="/projecten"
              className="rounded-full border border-slate-900/10 px-3 py-1 text-xs text-slate-600 transition hover:border-accent-400/40 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"
            >
              <strong className="font-semibold text-slate-900 dark:text-white">{count}</strong>{" "}
              {STAGE_LABELS[stage].toLowerCase()}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* Vraagt aandacht */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Vraagt aandacht
          </h3>
          <div className="mt-2.5 space-y-2">
            {attention.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 px-4 py-4 text-xs leading-relaxed text-slate-500 dark:border-white/15 dark:text-slate-400">
                Niets dat stilstaat of veroudert — je pipeline is bij. 👌
              </p>
            )}
            {attention.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 bg-slate-50 px-3.5 py-2.5 text-sm transition hover:-translate-y-0.5 hover:border-accent-400/40 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">
                  {item.text}
                </span>
                <span className="shrink-0 text-xs font-medium text-accent-700 dark:text-accent-300">
                  {item.cta} →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Updates van gevolgde bedrijven */}
        <div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gevolgde bedrijven
            </h3>
            {watches.length > 0 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-600">
                {watches.length} gevolgd · dagelijkse check
              </span>
            )}
          </div>
          <div className="mt-2.5 space-y-2">
            {watches.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 px-4 py-4 text-xs leading-relaxed text-slate-500 dark:border-white/15 dark:text-slate-400">
                Volg bedrijven om hier automatisch dealrelevant nieuws te zien:
                open een rapport en klik <strong>🔔 Volg bedrijf</strong>. Vantage
                checkt gevolgde bedrijven elke dag voor je.
              </p>
            )}
            {watches.length > 0 && updates.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-900/15 px-4 py-4 text-xs leading-relaxed text-slate-500 dark:border-white/15 dark:text-slate-400">
                {checking
                  ? "Bedrijven worden nu gecheckt op nieuws…"
                  : "Nog geen updates gevonden — zodra er dealrelevant nieuws is, verschijnt het hier en onder de bel."}
              </p>
            )}
            {updates.map(({ watch, update }) => (
              <Link
                key={update.id}
                href={watch.reportId ? `/research?report=${watch.reportId}` : "/research"}
                className="block rounded-xl border border-slate-900/10 bg-slate-50 px-3.5 py-2.5 transition hover:-translate-y-0.5 hover:border-accent-400/40 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <span className="flex items-center gap-2">
                  {!update.read && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-label="Ongelezen" />
                  )}
                  <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {watch.company}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                      update.impact === "hoog"
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : update.impact === "middel"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {update.impact}
                  </span>
                </span>
                <span className="mt-1 block text-sm font-medium leading-snug text-slate-800 dark:text-slate-200">
                  {update.headline}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Eerste-gebruik-onboarding: stuurt een nieuwe gebruiker meteen naar het
// aha-moment — het eerste deal-rapport — met demo-modus als gratis proefpad.
const ONBOARDING_EXAMPLES = ["ASML", "Adyen", "Coolblue"];

const ONBOARDING_STEPS = [
  {
    title: "Onderzoek een bedrijf",
    text: "Bedrijfsnaam in, compleet deal-rapport uit: scores, concurrenten, risico's en bronnen.",
  },
  {
    title: "Chat door over het rapport",
    text: "Outreach-mail, gespreksvoorbereiding of kritische vragen — met het rapport als context.",
  },
  {
    title: "Bundel deals in projecten",
    text: "Chats, rapporten en notities per deal, met een pipeline van verkennen tot deal.",
  },
];

function OnboardingHero() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setSettings(data.settings ?? null);
        setDemoMode(Boolean(data.settings?.demoMode));
        setApiConfigured(Boolean(data.apiKeyConfigured));
      } catch {
        // instellingen onbereikbaar — onboarding werkt ook zonder demo-rij
      }
    })();
  }, []);

  function start(name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    router.push(`/research?company=${encodeURIComponent(trimmed)}`);
  }

  async function toggleDemo() {
    if (saving || settings === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, demoMode: !demoMode }),
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setDemoMode(Boolean(data.settings.demoMode));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up mt-8 w-full max-w-2xl" style={{ animationDelay: "0.06s" }}>
      <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 text-left sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-600/90 dark:text-accent-400/80">
          Welkom bij Vantage
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 dark:text-white">
          Welk bedrijf wil je als eerste onderzoeken?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Vantage draait om deals: onderzoek een bedrijf en krijg binnen enkele minuten
          een compleet rapport om op door te werken.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(company);
          }}
          className="mt-5"
        >
          <div className="flex gap-2 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] p-2 focus-within:border-accent-400/50">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Bijv. ASML, Adyen, Coolblue…"
              autoFocus
              className="w-full bg-transparent px-3 py-2 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={company.trim().length < 2}
              className="shrink-0 rounded-xl bg-accent-500 px-5 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start onderzoek →
            </button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Of probeer:</span>
          {ONBOARDING_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => start(ex)}
              className="rounded-full border border-slate-900/10 dark:border-white/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-300 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:text-slate-900 dark:hover:text-white active:scale-95"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Demo-modus als gratis proefpad — prominent, niet verstopt in Instellingen */}
        {settings !== null && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {demoMode ? (
                <>
                  <strong className="text-slate-800 dark:text-slate-200">Demo-modus staat aan</strong> — analyses
                  zijn gratis voorbeelddata, ideaal om de app te verkennen.
                </>
              ) : apiConfigured ? (
                <>Eerst gratis verkennen? Demo-modus genereert voorbeeldrapporten zonder API-kosten.</>
              ) : (
                <>Er is nog geen API-sleutel ingesteld — verken de app gratis met demo-modus.</>
              )}
            </p>
            <button
              type="button"
              onClick={toggleDemo}
              disabled={saving}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                demoMode
                  ? "border-slate-900/15 dark:border-white/15 text-slate-600 dark:text-slate-400 hover:border-accent-400/50"
                  : "border-accent-600/30 dark:border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-300 hover:bg-accent-500/20"
              }`}
            >
              {demoMode ? "Demo-modus uitzetten" : "Zet demo-modus aan"}
            </button>
          </div>
        )}
      </div>

      {/* De kernflow in drie stappen */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {ONBOARDING_STEPS.map((step, i) => (
          <div
            key={step.title}
            className="animate-fade-up rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-4 text-left"
            style={{ animationDelay: `${0.12 + i * 0.06}s` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-600/90 dark:text-accent-400/80">
              Stap {i + 1}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{step.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Liever eerst gewoon chatten?{" "}
        <Link href="/chat" className="font-medium text-accent-700 dark:text-accent-300 hover:underline">
          Stel hier je vraag →
        </Link>
      </p>
    </div>
  );
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
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [stats, setStats] = useState<DayStat[] | null>(null);
  const [checking, setChecking] = useState(false);
  const autoCheckedRef = useRef(false);
  const [question, setQuestion] = useState("");
  const { greeting, tagline } = useGreeting();
  const typed = useTypewriter(greeting);

  useEffect(() => {
    (async () => {
      try {
        const [chatsRes, reportsRes, statsRes, projectsRes, watchesRes] =
          await Promise.all([
            fetch("/api/chats"),
            fetch("/api/reports"),
            fetch("/api/stats"),
            fetch("/api/projects"),
            fetch("/api/watches"),
          ]);
        const chatsData = await chatsRes.json();
        const reportsData = await reportsRes.json();
        const statsData = await statsRes.json();
        const projectsData = await projectsRes.json();
        const watchesData = await watchesRes.json();
        setChats(chatsData.chats ?? []);
        setReports(reportsData.reports ?? []);
        setStats(statsData.days ?? []);
        setProjects(projectsData.projects ?? []);
        setWatches(watchesData.watches ?? []);
      } catch {
        setChats([]);
        setReports([]);
        setStats([]);
        setProjects([]);
        setWatches([]);
      }
    })();
  }, []);

  const refreshWatches = useCallback(async () => {
    try {
      const res = await fetch("/api/watches");
      const data = await res.json();
      setWatches(data.watches ?? []);
    } catch {
      // stil falen — volgende bezoek probeert opnieuw
    }
  }, []);

  // Checks draaien na elkaar (elke check doorzoekt het web); na afloop
  // verversen we de lijst en de bel in de sidebar.
  const runChecks = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setChecking(true);
      try {
        for (const id of ids) {
          try {
            await fetch(`/api/watches/${id}/check`, { method: "POST" });
          } catch {
            // één mislukte check houdt de rest niet tegen
          }
        }
      } finally {
        setChecking(false);
        await refreshWatches();
        window.dispatchEvent(new Event(WATCHES_UPDATED_EVENT));
      }
    },
    [refreshWatches]
  );

  // De dagelijkse check: bij het openen van het dashboard worden gevolgde
  // bedrijven die >24 uur niet gecheckt zijn automatisch bijgewerkt
  // (maximaal 3 per bezoek, om kosten en wachttijd te begrenzen).
  useEffect(() => {
    if (watches === null || autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    const stale = watches.filter(
      (w) =>
        !w.lastCheckedAt ||
        Date.now() - new Date(w.lastCheckedAt).getTime() > 24 * 3600_000
    );
    runChecks(stale.slice(0, 3).map((w) => w.id));
  }, [watches, runChecks]);

  const totalMessages = (chats ?? []).reduce((sum, c) => sum + c.messageCount, 0);

  // Eerste gebruik (nog geen chats en geen rapporten): toon de onboarding
  // richting het eerste deal-rapport in plaats van het gewone dashboard.
  const firstRun =
    chats !== null && reports !== null && chats.length === 0 && reports.length === 0;

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
        {firstRun && <OnboardingHero />}
        {!firstRun && (
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
        )}
        {!firstRun && (
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
        )}
        {chats !== null && reports !== null && (chats.length > 0 || reports.length > 0) && (
          <p className="animate-fade-up mt-8 text-xs text-slate-400 dark:text-slate-600" style={{ animationDelay: "0.18s" }}>
            {chats.length} {chats.length === 1 ? "chat" : "chats"} · {totalMessages}{" "}
            {totalMessages === 1 ? "bericht" : "berichten"} · {reports.length}{" "}
            {reports.length === 1 ? "rapport" : "rapporten"}
          </p>
        )}
      </header>

      {!firstRun &&
        projects !== null &&
        watches !== null &&
        reports !== null &&
        (projects.length > 0 || watches.length > 0 || reports.length > 0) && (
          <PipelineToday
            projects={projects}
            reports={reports}
            watches={watches}
            checking={checking}
            onCheckAll={() => runChecks((watches ?? []).map((w) => w.id))}
          />
        )}

      {!firstRun && stats !== null && stats.length > 0 && stats.some((d) => d.count > 0) && (
        <ActivityChart days={stats} />
      )}

      {!firstRun && (
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
              <div className="rounded-xl border border-dashed border-slate-900/15 dark:border-white/15 px-5 py-7 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Onderzoek je eerste bedrijf
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Bedrijfsnaam in, gestructureerd deal-rapport uit — met scores,
                  concurrenten, risico&apos;s en bronnen. Klaar in enkele minuten.
                </p>
                <Link
                  href="/research"
                  className="mt-4 inline-block rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
                >
                  Start deal-onderzoek →
                </Link>
              </div>
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
      )}
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
