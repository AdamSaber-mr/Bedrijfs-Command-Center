"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { CHATS_UPDATED_EVENT, REPORTS_UPDATED_EVENT } from "@/components/AppShell";
import type { ChatSummary } from "@/lib/chatStore";
import type { ReportSummary, SavedReport } from "@/lib/reportStore";

type Dir = 1 | -1;

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: Dir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition ${
          active
            ? "text-accent-700 dark:text-accent-300"
            : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
        }`}
      >
        {label}
        {active && <span>{dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "text-accent-700 dark:text-accent-300";
  if (score >= 45) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function CompareCard({ saved }: { saved: SavedReport }) {
  const r = saved.report;
  return (
    <div className="rounded-2xl border border-slate-900/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-white">
        {r.company.name}
      </h3>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {new Date(saved.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} · {r.company.industry}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Marktpositie", score: r.market_position.score },
          { label: "Partnership-fit", score: r.partnership_fit.score },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.02]">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{s.label}</p>
            <p className={`font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums ${scoreColor(s.score)}`}>
              {s.score}
              <span className="text-sm font-normal text-slate-400">/100</span>
            </p>
          </div>
        ))}
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Positie</dt>
          <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{r.market_position.position}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ideale partner</dt>
          <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{r.partnership_fit.ideal_partner_profile}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Risico&apos;s ({r.risks.length})
          </dt>
          <dd className="mt-0.5 text-slate-700 dark:text-slate-300">
            {r.risks.map((risk) => risk.title).join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Conclusie</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">{r.conclusion}</dd>
        </div>
      </dl>
    </div>
  );
}

function ArchiveView() {
  const router = useRouter();
  const [tab, setTab] = useState<"chats" | "reports">("chats");
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [chatSort, setChatSort] = useState<{ key: keyof ChatSummary; dir: Dir }>({ key: "updatedAt", dir: -1 });
  const [reportSort, setReportSort] = useState<{ key: keyof ReportSummary; dir: Dir }>({ key: "createdAt", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<SavedReport[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [chatsRes, reportsRes] = await Promise.all([fetch("/api/chats"), fetch("/api/reports")]);
      setChats((await chatsRes.json()).chats ?? []);
      setReports((await reportsRes.json()).reports ?? []);
    } catch {
      setChats([]);
      setReports([]);
    }
  }, []);

  useEffect(() => {
    // Via een timeout-callback zodat de setState buiten de effect-body valt.
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchTab(next: "chats" | "reports") {
    setTab(next);
    setSelected(new Set());
    setCompare(null);
  }

  async function deleteSelected() {
    const ids = [...selected];
    await Promise.all(
      ids.map((id) =>
        fetch(tab === "chats" ? `/api/chats/${id}` : `/api/reports/${id}`, { method: "DELETE" })
      )
    );
    setSelected(new Set());
    setCompare(null);
    window.dispatchEvent(new Event(tab === "chats" ? CHATS_UPDATED_EVENT : REPORTS_UPDATED_EVENT));
    load();
  }

  async function compareSelected() {
    const ids = [...selected].slice(0, 2);
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/reports/${id}`);
        return res.ok ? ((await res.json()).saved as SavedReport) : null;
      })
    );
    const valid = results.filter((r): r is SavedReport => r !== null);
    if (valid.length === 2) setCompare(valid);
  }

  const sortedChats = [...(chats ?? [])].sort((a, b) => {
    const { key, dir } = chatSort;
    const av = a[key];
    const bv = b[key];
    return (typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "nl")) * dir;
  });

  const sortedReports = [...(reports ?? [])].sort((a, b) => {
    const { key, dir } = reportSort;
    const av = a[key];
    const bv = b[key];
    return (typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "nl")) * dir;
  });

  const toggleChatSort = (key: keyof ChatSummary) =>
    setChatSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as Dir) : -1 }));
  const toggleReportSort = (key: keyof ReportSummary) =>
    setReportSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as Dir) : -1 }));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent-600/90 dark:text-accent-400/80">
            Archief
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Alle chats &amp; rapporten
          </h1>
        </div>
        <div className="flex rounded-lg border border-slate-900/10 p-0.5 dark:border-white/10">
          {(
            [
              { value: "chats", label: `Chats (${chats?.length ?? "…"})` },
              { value: "reports", label: `Rapporten (${reports?.length ?? "…"})` },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => switchTab(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.value
                  ? "bg-accent-500/15 text-accent-700 dark:text-accent-300"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Actiebalk bij selectie */}
      {selected.size > 0 && (
        <div className="animate-fade-in mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-900/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {selected.size} geselecteerd
          </span>
          {tab === "reports" && selected.size === 2 && (
            <button
              onClick={compareSelected}
              className="rounded-lg bg-accent-500 px-3.5 py-1.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
            >
              ⇆ Vergelijk
            </button>
          )}
          <button
            onClick={deleteSelected}
            className="rounded-lg border border-red-600/30 bg-red-500/5 px-3.5 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
          >
            Verwijderen
          </button>
        </div>
      )}

      {/* Vergelijking */}
      {compare && (
        <section className="animate-fade-up mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
              Vergelijking
            </h2>
            <button
              onClick={() => setCompare(null)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ✕ Sluiten
            </button>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {compare.map((saved) => (
              <CompareCard key={saved.id} saved={saved} />
            ))}
          </div>
        </section>
      )}

      {/* Tabel */}
      <div className="animate-fade-up mt-6 overflow-x-auto rounded-2xl border border-slate-900/10 bg-white dark:border-white/10 dark:bg-white/[0.03]" style={{ animationDelay: "0.08s" }}>
        {tab === "chats" ? (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-900/10 dark:border-white/10">
              <tr>
                <th className="w-10 px-3 py-2" />
                <SortHeader label="Titel" active={chatSort.key === "title"} dir={chatSort.dir} onClick={() => toggleChatSort("title")} />
                <SortHeader label="Berichten" active={chatSort.key === "messageCount"} dir={chatSort.dir} onClick={() => toggleChatSort("messageCount")} className="text-right" />
                <SortHeader label="Bijgewerkt" active={chatSort.key === "updatedAt"} dir={chatSort.dir} onClick={() => toggleChatSort("updatedAt")} />
              </tr>
            </thead>
            <tbody>
              {chats !== null && chats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nog geen chats.
                  </td>
                </tr>
              )}
              {sortedChats.map((chat) => (
                <tr
                  key={chat.id}
                  onClick={() => router.push(`/chat?chat=${chat.id}`)}
                  className="cursor-pointer border-b border-slate-900/5 transition last:border-0 hover:bg-accent-500/5 dark:border-white/5"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(chat.id)}
                      onChange={() => toggleSelect(chat.id)}
                      className="h-4 w-4 accent-[var(--accent-500)]"
                      aria-label={`Selecteer ${chat.title}`}
                    />
                  </td>
                  <td className="max-w-0 truncate px-3 py-2.5 text-slate-800 dark:text-slate-200">
                    {chat.pinned && <span className="mr-1.5 text-accent-500">•</span>}
                    {chat.title}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{chat.messageCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{fmtDate(chat.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-900/10 dark:border-white/10">
              <tr>
                <th className="w-10 px-3 py-2" />
                <SortHeader label="Bedrijf" active={reportSort.key === "company"} dir={reportSort.dir} onClick={() => toggleReportSort("company")} />
                <SortHeader label="Markt" active={reportSort.key === "marketScore"} dir={reportSort.dir} onClick={() => toggleReportSort("marketScore")} className="text-right" />
                <SortHeader label="Fit" active={reportSort.key === "fitScore"} dir={reportSort.dir} onClick={() => toggleReportSort("fitScore")} className="text-right" />
                <SortHeader label="Datum" active={reportSort.key === "createdAt"} dir={reportSort.dir} onClick={() => toggleReportSort("createdAt")} />
              </tr>
            </thead>
            <tbody>
              {reports !== null && reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nog geen rapporten.
                  </td>
                </tr>
              )}
              {sortedReports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => router.push(`/research?report=${report.id}`)}
                  className="cursor-pointer border-b border-slate-900/5 transition last:border-0 hover:bg-accent-500/5 dark:border-white/5"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(report.id)}
                      onChange={() => toggleSelect(report.id)}
                      className="h-4 w-4 accent-[var(--accent-500)]"
                      aria-label={`Selecteer ${report.company}`}
                    />
                  </td>
                  <td className="max-w-0 truncate px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                    {report.company}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${scoreColor(report.marketScore)}`}>
                    {report.marketScore}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${scoreColor(report.fitScore)}`}>
                    {report.fitScore}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{fmtDate(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-600">
        Klik op een rij om te openen · vink aan om te verwijderen{tab === "reports" ? " of (bij precies 2) te vergelijken" : ""}
      </p>
    </main>
  );
}

export default function ArchivePage() {
  return (
    <Suspense>
      <AppShell>
        <ArchiveView />
      </AppShell>
    </Suspense>
  );
}
