"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell, { REPORTS_UPDATED_EVENT } from "@/components/AppShell";
import type { ThreatLevel } from "@/lib/research";
import type { SavedReport } from "@/lib/reportStore";
import { useCountUp } from "@/lib/animation";

const EXAMPLES = ["ASML", "Adyen", "Coolblue", "Tesla", "Bol.com"];

const LOADING_STEPS = [
  "Bedrijfsprofiel opzoeken…",
  "Actuele bronnen doorzoeken…",
  "Marktpositie analyseren…",
  "Concurrentielandschap in kaart brengen…",
  "Partnership-fit beoordelen…",
  "Risico's wegen…",
  "Rapport samenstellen…",
];

const SEVERITY_STYLES: Record<ThreatLevel, string> = {
  laag: "bg-accent-500/10 text-accent-700 dark:text-accent-300 border-accent-600/30 dark:border-accent-500/30",
  middel: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-600/40 dark:border-amber-500/30",
  hoog: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-600/30 dark:border-red-500/30",
};

// Severity-kleur van de ring: 600-stappen, gevalideerd op contrast tegen
// zowel het lichte als het donkere oppervlak. Het cijfer zelf blijft in
// inkt-kleur — tekst draagt nooit de datakleur.
function ringColor(score: number) {
  if (score >= 70) return "var(--accent-600)";
  if (score >= 45) return "#d97706"; // amber-600
  return "#dc2626"; // red-600
}

function scoreLabel(score: number) {
  if (score >= 70) return "Sterk";
  if (score >= 45) return "Gemiddeld";
  return "Zwak";
}

function SeverityBadge({ level }: { level: ThreatLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[level] ?? SEVERITY_STYLES.middel}`}
    >
      {level}
    </span>
  );
}

// Score als moderne ring-gauge (radiale meter): de gevulde boog draagt de
// severity-kleur, het spoor is dezelfde tint op lage dekking, het cijfer
// staat in inkt-kleur in het midden en telt op bij binnenkomst.
function ScoreCard({ label, score, subtitle }: { label: string; score: number; subtitle: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const shown = useCountUp(clamped);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const color = ringColor(clamped);

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
      <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${label}: ${clamped} van 100`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* Spoor: dezelfde tint op lage dekking, zodat de hele meter leest */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={color}
            strokeOpacity="0.15"
            strokeWidth="9"
          />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={mounted ? CIRC * (1 - clamped / 100) : CIRC}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums leading-none text-slate-900 dark:text-white">
            {shown}
          </span>
          <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          {scoreLabel(clamped)}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  kicker,
  children,
  className = "",
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 sm:p-8 ${className}`}>
      {kicker && (
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-accent-600/90 dark:text-accent-400/80">{kicker}</p>
      )}
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600/70 dark:bg-accent-400/70" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function LoadingState({ company }: { company: string }) {
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(
      () => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      9000
    );
    const secTimer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(stepTimer);
      clearInterval(secTimer);
    };
  }, []);

  return (
    <div className="animate-fade-up mx-auto mt-16 max-w-lg rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent-600/30 dark:border-accent-500/30 bg-accent-500/10">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-pulse-dot h-2 w-2 rounded-full bg-accent-400"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>
      </div>
      <h2 className="mt-6 font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
        Analyse van {company}
      </h2>
      <p className="mt-2 text-sm text-accent-700/90 dark:text-accent-300/90">{LOADING_STEPS[step]}</p>
      <p className="mt-6 text-xs text-slate-500">
        Claude doorzoekt actuele bronnen en stelt het rapport samen — dit duurt doorgaans 1 à 3 minuten.
        <span className="ml-2 font-[family-name:var(--font-mono)] tabular-nums text-slate-600 dark:text-slate-400">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </p>
    </div>
  );
}

function Report({ saved, onReset }: { saved: SavedReport; onReset: () => void }) {
  const router = useRouter();
  const [openingChat, setOpeningChat] = useState(false);
  const report = saved.report;

  // Start een chat met het rapport als context; met `draft` staat de
  // vervolgvraag alvast klaar in het invoerveld (gebruiker verstuurt zelf).
  async function chatAboutReport(draft?: string) {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const res = await fetch("/api/chats/from-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: saved.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(
        `/chat?chat=${data.chatId}${draft ? `&draft=${encodeURIComponent(draft)}` : ""}`
      );
    } catch {
      setOpeningChat(false);
    }
  }

  function printReport() {
    // Print altijd in licht thema; zet donker daarna terug.
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    window.addEventListener(
      "afterprint",
      () => {
        if (wasDark) document.documentElement.classList.add("dark");
      },
      { once: true }
    );
    setTimeout(() => window.print(), 50);
  }

  const meta = [
    { label: "Sector", value: report.company.industry },
    { label: "Hoofdkantoor", value: report.company.headquarters },
    { label: "Opgericht", value: report.company.founded },
    { label: "Omvang", value: report.company.size },
  ].filter((m) => m.value && m.value.toLowerCase() !== "onbekend");

  return (
    <div className="animate-fade-up mx-auto mt-10 max-w-5xl space-y-6 pb-24">
      {/* Bedrijfskop */}
      <header className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-gradient-to-br from-accent-500/[0.07] to-transparent p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-600/90 dark:text-accent-400/80">
              Business-analyse ·{" "}
              {new Date(saved.createdAt).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              {report.company.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2.5 print:hidden">
            <a
              href={`/api/reports/${saved.id}/html`}
              title="Download als nette standalone pagina om te delen"
              className="rounded-lg border border-slate-900/15 dark:border-white/15 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:border-accent-400/50 hover:text-slate-900 dark:hover:text-white"
            >
              ↗ Delen (HTML)
            </a>
            <button
              onClick={printReport}
              className="rounded-lg border border-slate-900/15 dark:border-white/15 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:border-accent-400/50 hover:text-slate-900 dark:hover:text-white"
            >
              ⎙ Opslaan als PDF
            </button>
            <button
              onClick={() => chatAboutReport()}
              disabled={openingChat}
              className="rounded-lg border border-accent-600/30 dark:border-accent-500/30 bg-accent-500/10 px-4 py-2 text-sm font-medium text-accent-700 dark:text-accent-300 transition hover:bg-accent-500/20 disabled:opacity-50"
            >
              {openingChat ? "Chat openen…" : "💬 Chat over dit rapport"}
            </button>
            <button
              onClick={onReset}
              className="rounded-lg border border-slate-900/15 dark:border-white/15 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:border-accent-400/50 hover:text-slate-900 dark:hover:text-white"
            >
              Nieuwe analyse
            </button>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          {report.company.summary}
        </p>
        {meta.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-xs uppercase tracking-wider text-slate-500">{m.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {/* Scores */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ScoreCard
          label="Marktpositie"
          score={report.market_position.score}
          subtitle={report.market_position.position}
        />
        <ScoreCard
          label="Partnership-fit"
          score={report.partnership_fit.score}
          subtitle={report.partnership_fit.ideal_partner_profile}
        />
      </div>

      {/* Marktpositie */}
      <SectionCard kicker="01 — Markt" title="Marktpositie" className="animate-fade-up [animation-delay:0.08s]">
        <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{report.market_position.analysis}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Sterktes</h3>
            <BulletList items={report.market_position.strengths} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Markttrends</h3>
            <BulletList items={report.market_position.trends} />
          </div>
        </div>
      </SectionCard>

      {/* Concurrenten */}
      <SectionCard kicker="02 — Concurrentie" title="Belangrijkste concurrenten" className="animate-fade-up [animation-delay:0.14s]">
        <div className="grid gap-4 sm:grid-cols-2">
          {report.competitors.map((c) => (
            <div key={c.name} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-accent-400/30">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-[family-name:var(--font-display)] font-semibold text-slate-900 dark:text-slate-100">
                  {c.name}
                </h3>
                <SeverityBadge level={c.threat_level} />
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Badge = concurrentiedreiging voor {report.company.name}</p>
      </SectionCard>

      {/* Partnership-fit */}
      <SectionCard kicker="03 — Samenwerking" title="Partnership-fit" className="animate-fade-up [animation-delay:0.2s]">
        <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{report.partnership_fit.analysis}</p>
        <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-800 dark:text-slate-200">Concrete kansen</h3>
        <BulletList items={report.partnership_fit.opportunities} />
      </SectionCard>

      {/* Risico's */}
      <SectionCard kicker="04 — Risico" title="Risico's" className="animate-fade-up [animation-delay:0.26s]">
        <div className="space-y-3">
          {report.risks.map((r) => (
            <div key={r.title} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-accent-400/30">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</h3>
                <SeverityBadge level={r.severity} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{r.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Conclusie */}
      <section className="rounded-2xl border border-accent-600/30 dark:border-accent-500/25 bg-accent-500/[0.06] p-6 sm:p-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-accent-600 dark:text-accent-400">
          Strategische conclusie
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{report.conclusion}</p>
      </section>

      {/* Vervolgacties: van inzicht naar actie — start een chat met het
          rapport als context en de vervolgvraag alvast ingevuld. */}
      <section className="print:hidden">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Volgende stap
        </p>
        <div className="flex flex-wrap gap-2.5">
          {[
            {
              icon: "✉️",
              label: "Outreach-mail schrijven",
              draft: `Schrijf een korte, persoonlijke outreach-mail aan ${report.company.name} om een eerste gesprek voor te stellen. Gebruik de partnership-kansen en sterktes uit het rapport, houd het onder de 150 woorden en vermijd verkooppraat.`,
            },
            {
              icon: "🎯",
              label: "Gesprek voorbereiden",
              draft: `Bereid een eerste gesprek met ${report.company.name} voor op basis van dit rapport: een korte agenda, onze drie sterkste aanknopingspunten, de bezwaren die zij waarschijnlijk opwerpen (met reactie) en de vragen die wij moeten stellen.`,
            },
            {
              icon: "❓",
              label: "Kritische vragen",
              draft: `Welke tien kritische due-diligence-vragen moeten we ${report.company.name} stellen vóór we verdergaan? Baseer je op de risico's en onzekerheden in het rapport, van belangrijkst naar minst belangrijk.`,
            },
            {
              icon: "⚖️",
              label: "Vergelijk met concurrent",
              draft: `Vergelijk ${report.company.name} als potentiële partner met [vul hier de concurrent in]: marktpositie, partnership-fit, risico's en welke van de twee wij zouden moeten kiezen.`,
            },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => chatAboutReport(action.draft)}
              disabled={openingChat}
              className="rounded-xl border border-slate-900/15 dark:border-white/15 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:-translate-y-0.5 hover:border-accent-400/50 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* Bronnen */}
      {saved.citations.length > 0 && (
        <SectionCard kicker="Bronnen" title="Gebruikte bronnen" className="animate-fade-up [animation-delay:0.32s]">
          <ul className="grid gap-2 sm:grid-cols-2">
            {saved.citations.map((c) => (
              <li key={c.url}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3 transition hover:border-accent-400/40"
                >
                  <span className="mt-0.5 text-xs text-accent-600/80 dark:text-accent-400/70">↗</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-accent-700 dark:group-hover:text-accent-300">
                      {c.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-500">
                      {(() => {
                        try {
                          return new URL(c.url).hostname.replace(/^www\./, "");
                        } catch {
                          return c.url;
                        }
                      })()}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-slate-600">
        Gegenereerd door Claude · AI-analyse ter ondersteuning, geen vervanging van eigen due diligence
      </p>
    </div>
  );
}

function ResearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report");

  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");
  const [analyzedCompany, setAnalyzedCompany] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset direct tijdens de render wanneer het rapport uit de URL verdwijnt
  // (bv. via "Nieuwe analyse" of de sidebar).
  const [prevReportId, setPrevReportId] = useState(reportId);
  if (prevReportId !== reportId) {
    setPrevReportId(reportId);
    if (!reportId) {
      setSaved(null);
      if (status !== "loading") setStatus("idle");
    }
  }

  // Laad een opgeslagen rapport wanneer er een ?report=… in de URL staat
  // (via de sidebar of na een refresh).
  useEffect(() => {
    if (!reportId) return;
    if (saved?.id === reportId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/reports/${reportId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) {
        setSaved(data.saved);
        setStatus("done");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  async function analyze(name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2 || status === "loading") return;
    setStatus("loading");
    setAnalyzedCompany(trimmed);
    setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onbekende fout");
      setSaved(data.saved);
      setStatus("done");
      window.dispatchEvent(new Event(REPORTS_UPDATED_EVENT));
      router.replace(`/research?report=${data.saved.id}`, { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setSaved(null);
    setCompany("");
    setError("");
    router.replace("/research", { scroll: false });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-8">
      {status === "done" && saved ? (
        <Report saved={saved} onReset={reset} />
      ) : (
        <div className="flex flex-col items-center pt-20 sm:pt-28">
          <div className="animate-fade-up flex max-w-2xl flex-col items-center text-center">
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl">
              Company &amp; Deal
              <br />
              <span className="text-accent-600 dark:text-accent-400">Research Assistant</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
              Voer een bedrijfsnaam in en ontvang binnen enkele minuten een gestructureerde
              business-analyse: marktpositie, concurrenten, partnership-fit en risico&apos;s —
              onderbouwd met actuele bronnen.
            </p>
          </div>

          {status !== "loading" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                analyze(company);
              }}
              className="animate-fade-up mt-10 w-full max-w-xl"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="flex gap-3 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] p-2 shadow-2xl shadow-slate-900/10 dark:shadow-black/40 focus-within:border-accent-400/50">
                <input
                  ref={inputRef}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Bijv. ASML, Adyen, Coolblue…"
                  autoFocus
                  className="w-full bg-transparent px-4 py-2.5 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={company.trim().length < 2}
                  className="shrink-0 rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Analyseer
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-slate-500">Probeer:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setCompany(ex);
                      analyze(ex);
                    }}
                    className="rounded-full border border-slate-900/10 dark:border-white/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-300 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:text-slate-900 dark:hover:text-white active:scale-95"
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {status === "error" && (
                <p className="mt-5 rounded-xl border border-red-600/30 dark:border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              )}
            </form>
          )}

          {status === "loading" && <LoadingState company={analyzedCompany} />}

          {status !== "loading" && (
            <div
              className="animate-fade-up mt-16 grid max-w-3xl gap-4 pb-20 sm:grid-cols-3"
              style={{ animationDelay: "0.2s" }}
            >
              {[
                {
                  title: "Marktpositie",
                  text: "Score, sterktes en relevante markttrends op basis van actuele informatie.",
                },
                {
                  title: "Concurrentie & risico's",
                  text: "De belangrijkste concurrenten en risico's, gewogen op dreigingsniveau.",
                },
                {
                  title: "Partnership-fit",
                  text: "Concrete samenwerkingskansen en het ideale partnerprofiel voor dealbeslissingen.",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 text-left">
                  <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{f.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function ResearchPage() {
  return (
    <Suspense>
      <AppShell>
        <ResearchView />
      </AppShell>
    </Suspense>
  );
}
