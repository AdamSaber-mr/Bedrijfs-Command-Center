"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Icon, ICONS } from "@/components/ui";
import type { ProjectSummary, Project } from "@/lib/projectStore";
import type { ChatSummary } from "@/lib/chatStore";
import type { NoteSummary } from "@/lib/noteStore";
import type { ReportSummary } from "@/lib/reportStore";

const inputCls =
  "w-full rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500";

function relativeDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/* ---------- Overzicht ---------- */

function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      setProjects((await res.json()).projects ?? []);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) router.push(`/projecten?project=${data.project.id}`);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900 dark:text-white">
            Projecten
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bundel chats, notities en rapporten rond één deal of bedrijf, met eigen
            instructies voor de AI.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
        >
          <Icon d={ICONS.plus} className="h-4 w-4" />
          Nieuw project
        </button>
      </div>

      {showForm && (
        <div className="animate-fade-in mt-6 rounded-2xl border border-slate-900/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Projectnaam — bijv. 'Deal: TestCo BV'"
              className={inputCls}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Korte omschrijving (optioneel)"
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-900/15 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Annuleren
              </button>
              <button
                onClick={create}
                disabled={!name.trim() || creating}
                className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition enabled:hover:bg-accent-400 disabled:opacity-40"
              >
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {projects === null && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Laden…</p>
        )}
        {projects !== null && projects.length === 0 && !showForm && (
          <p className="col-span-full rounded-xl border border-dashed border-slate-900/15 px-4 py-10 text-center text-sm text-slate-400 dark:border-white/15 dark:text-slate-500">
            Nog geen projecten. Maak er hierboven één aan.
          </p>
        )}
        {projects?.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/projecten?project=${p.id}`)}
            className="group rounded-2xl border border-slate-900/10 bg-white p-5 text-left transition hover:border-accent-400/50 hover:shadow-lg hover:shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:shadow-black/20"
          >
            <span className="flex items-center gap-2.5">
              <Icon d={ICONS.folder} className="h-5 w-5 text-accent-600 dark:text-accent-400" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {p.name}
              </span>
            </span>
            <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {p.description || "Geen omschrijving"}
            </span>
            <span className="mt-3 block text-[11px] text-slate-400 dark:text-slate-600">
              Bijgewerkt {relativeDate(p.updatedAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Detail ---------- */

interface Detail {
  project: Project;
  chats: ChatSummary[];
  notes: NoteSummary[];
  reports: ReportSummary[];
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-900/10 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        {children}
      </div>
    </div>
  );
}

function ItemRow({
  label,
  hint,
  onOpen,
  onUnlink,
  first,
}: {
  label: string;
  hint?: string;
  onOpen: () => void;
  onUnlink: () => void;
  first: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-4 py-2.5 transition hover:bg-slate-900/5 dark:hover:bg-white/5 ${
        first ? "" : "border-t border-slate-900/[0.07] dark:border-white/[0.07]"
      }`}
    >
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-slate-800 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400 dark:text-slate-600">{hint}</span>}
      </button>
      <button
        onClick={onUnlink}
        title="Ontkoppelen van dit project"
        aria-label="Ontkoppelen"
        className="hidden shrink-0 rounded p-1 text-slate-400 transition hover:text-red-500 group-hover:block dark:hover:text-red-400"
      >
        <Icon d={ICONS.close} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Kiezer om bestaande, nog niet gekoppelde items aan het project te hangen.
function LinkPicker({
  placeholder,
  options,
  onPick,
}: {
  placeholder: string;
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
      className="mt-2 w-full rounded-lg border border-dashed border-slate-900/15 bg-transparent px-3 py-2 text-xs text-slate-500 focus:outline-none dark:border-white/15 dark:text-slate-400"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [all, setAll] = useState<{
    chats: ChatSummary[];
    notes: NoteSummary[];
    reports: ReportSummary[];
  }>({ chats: [], notes: [], reports: [] });
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [detailRes, chatsRes, notesRes, reportsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch("/api/chats"),
        fetch("/api/notes"),
        fetch("/api/reports"),
      ]);
      if (!detailRes.ok) {
        setMissing(true);
        return;
      }
      const data = (await detailRes.json()) as Detail;
      setDetail(data);
      setInstructions(data.project.instructions);
      setAll({
        chats: (await chatsRes.json()).chats ?? [],
        notes: (await notesRes.json()).notes ?? [],
        reports: (await reportsRes.json()).reports ?? [],
      });
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function saveInstructions() {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function link(kind: "chats" | "notes" | "reports", itemId: string, unlink = false) {
    const projectId = unlink ? null : id;
    if (kind === "chats") {
      await fetch(`/api/chats/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
    } else if (kind === "notes") {
      await fetch(`/api/notes/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
    } else {
      await fetch(`/api/reports/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
    }
    refresh();
  }

  async function removeProject() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projecten");
  }

  if (missing) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Project niet gevonden.</p>
        <button
          onClick={() => router.push("/projecten")}
          className="mt-4 rounded-xl border border-slate-900/15 px-4 py-2 text-sm text-slate-700 dark:border-white/15 dark:text-slate-300"
        >
          ← Terug naar projecten
        </button>
      </div>
    );
  }
  if (!detail) {
    return <p className="px-8 py-10 text-sm text-slate-400 dark:text-slate-500">Laden…</p>;
  }

  const linkedIds = {
    chats: new Set(detail.chats.map((c) => c.id)),
    notes: new Set(detail.notes.map((n) => n.id)),
    reports: new Set(detail.reports.map((r) => r.id)),
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-5 py-8 sm:px-8">
      <button
        onClick={() => router.push("/projecten")}
        className="self-start text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
      >
        ← Alle projecten
      </button>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900 dark:text-white">
            <Icon d={ICONS.folder} className="h-6 w-6 shrink-0 text-accent-600 dark:text-accent-400" />
            <span className="truncate">{detail.project.name}</span>
          </h1>
          {detail.project.description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {detail.project.description}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/chat?project=${id}`)}
          className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
        >
          <Icon d={ICONS.plus} className="h-4 w-4" />
          Nieuwe chat in project
        </button>
      </div>

      {/* Instructies */}
      <div className="mt-6 rounded-2xl border border-slate-900/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Projectinstructies
          </p>
          <span
            aria-live="polite"
            className={`text-xs font-medium text-accent-600 transition-opacity dark:text-accent-400 ${saved ? "opacity-100" : "opacity-0"}`}
          >
            ✓ Opgeslagen
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Gaan als context mee in elke chat binnen dit project — bijv. de deal-doelen,
          gewenste toon of vaste feiten. Max 4000 tekens.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, 4000))}
          onBlur={saveInstructions}
          placeholder="Bijv.: We onderzoeken een partnership met TestCo BV. Focus op logistiek en de Benelux-markt…"
          rows={4}
          className={`${inputCls} mt-3 resize-y`}
        />
      </div>

      {/* Gekoppelde items */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title={`Chats (${detail.chats.length})`}>
          {detail.chats.length === 0 && (
            <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-600">
              Nog geen chats in dit project.
            </p>
          )}
          {detail.chats.map((c, i) => (
            <ItemRow
              key={c.id}
              first={i === 0}
              label={c.title}
              hint={`${c.messageCount} berichten · ${relativeDate(c.updatedAt)}`}
              onOpen={() => router.push(`/chat?chat=${c.id}`)}
              onUnlink={() => link("chats", c.id, true)}
            />
          ))}
          <div className="px-3 pb-3">
            <LinkPicker
              placeholder="+ Bestaande chat koppelen…"
              options={all.chats
                .filter((c) => !linkedIds.chats.has(c.id) && !c.projectId)
                .map((c) => ({ id: c.id, label: c.title }))}
              onPick={(itemId) => link("chats", itemId)}
            />
          </div>
        </Section>

        <Section title={`Rapporten (${detail.reports.length})`}>
          {detail.reports.length === 0 && (
            <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-600">
              Nog geen rapporten in dit project.
            </p>
          )}
          {detail.reports.map((r, i) => (
            <ItemRow
              key={r.id}
              first={i === 0}
              label={r.company}
              hint={`Markt ${r.marketScore}/100 · Fit ${r.fitScore}/100`}
              onOpen={() => router.push(`/research?report=${r.id}`)}
              onUnlink={() => link("reports", r.id, true)}
            />
          ))}
          <div className="px-3 pb-3">
            <LinkPicker
              placeholder="+ Bestaand rapport koppelen…"
              options={all.reports
                .filter((r) => !linkedIds.reports.has(r.id) && !r.projectId)
                .map((r) => ({ id: r.id, label: r.company }))}
              onPick={(itemId) => link("reports", itemId)}
            />
          </div>
        </Section>

        <Section title={`Notities (${detail.notes.length})`}>
          {detail.notes.length === 0 && (
            <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-600">
              Nog geen notities in dit project.
            </p>
          )}
          {detail.notes.map((n, i) => (
            <ItemRow
              key={n.id}
              first={i === 0}
              label={n.title}
              hint={relativeDate(n.updatedAt)}
              onOpen={() => router.push(`/notes?note=${n.id}`)}
              onUnlink={() => link("notes", n.id, true)}
            />
          ))}
          <div className="px-3 pb-3">
            <LinkPicker
              placeholder="+ Bestaande notitie koppelen…"
              options={all.notes
                .filter((n) => !linkedIds.notes.has(n.id) && !n.projectId)
                .map((n) => ({ id: n.id, label: n.title }))}
              onPick={(itemId) => link("notes", itemId)}
            />
          </div>
        </Section>

        {/* Gevarenzone */}
        <div className="flex items-end">
          <button
            onClick={removeProject}
            onMouseLeave={() => setConfirmDelete(false)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              confirmDelete
                ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-300"
                : "border-red-600/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
            }`}
          >
            {confirmDelete
              ? "Klik nogmaals — chats/notities blijven bestaan"
              : "Project verwijderen"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Route ---------- */

function ProjectsView() {
  const projectId = useSearchParams().get("project");
  return projectId ? <ProjectDetail id={projectId} /> : <ProjectList />;
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <AppShell>
        <ProjectsView />
      </AppShell>
    </Suspense>
  );
}
