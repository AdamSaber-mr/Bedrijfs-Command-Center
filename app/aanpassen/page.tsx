"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Icon, ICONS } from "@/components/ui";

interface PromptTemplate {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

function CustomizeView() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptTemplate[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      setPrompts(data.prompts ?? []);
    } catch {
      setPrompts([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function add() {
    if (!newTitle.trim() || !newText.trim() || busy) return;
    setBusy(true);
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, text: newText }),
    });
    setNewTitle("");
    setNewText("");
    setBusy(false);
    refresh();
  }

  function startEdit(p: PromptTemplate) {
    setEditId(p.id);
    setEditTitle(p.title);
    setEditText(p.text);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editText.trim()) return;
    await fetch(`/api/prompts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, text: editText }),
    });
    setEditId(null);
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    setEditId(null);
    refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto px-5 py-8 sm:px-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900 dark:text-white">
          Aanpassen
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Beheer je prompt-sjablonen. Ze verschijnen in het zoekvenster (⌘K) en starten
          direct een nieuwe chat met de tekst als bericht. Je naam en vaste instructies
          beheer je in{" "}
          <button
            onClick={() => router.push("/settings?tab=profiel")}
            className="font-medium text-accent-700 underline-offset-2 hover:underline dark:text-accent-400"
          >
            Instellingen → Profiel
          </button>
          .
        </p>
      </div>

      {/* Nieuw sjabloon */}
      <div className="mt-6 rounded-2xl border border-slate-900/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <p className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Nieuw sjabloon
        </p>
        <div className="space-y-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 80))}
            placeholder="Titel — bijv. 'SWOT-analyse'"
            className={inputCls}
          />
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value.slice(0, 4000))}
            placeholder="De prompttekst die als bericht wordt ingevuld…"
            rows={3}
            className={`${inputCls} resize-y`}
          />
          <div className="flex justify-end">
            <button
              onClick={add}
              disabled={!newTitle.trim() || !newText.trim() || busy}
              className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition enabled:hover:bg-accent-400 enabled:active:scale-95 disabled:opacity-40"
            >
              <Icon d={ICONS.plus} className="h-4 w-4" />
              Toevoegen
            </button>
          </div>
        </div>
      </div>

      {/* Bestaande sjablonen */}
      <div className="mt-6 space-y-3">
        {prompts === null && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Laden…</p>
        )}
        {prompts !== null && prompts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-900/15 px-4 py-8 text-center text-sm text-slate-400 dark:border-white/15 dark:text-slate-500">
            Nog geen sjablonen. Voeg er hierboven één toe.
          </p>
        )}
        {prompts?.map((p) =>
          editId === p.id ? (
            <div
              key={p.id}
              className="rounded-2xl border border-accent-500/40 bg-white p-4 dark:bg-white/[0.03]"
            >
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
                  className={inputCls}
                />
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value.slice(0, 4000))}
                  rows={3}
                  className={`${inputCls} resize-y`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-xl border border-slate-900/15 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => saveEdit(p.id)}
                    className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={p.id}
              className="group flex items-start gap-3 rounded-2xl border border-slate-900/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.title}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {p.text}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => router.push(`/chat?draft=${encodeURIComponent(p.text)}`)}
                  title="Chat starten met dit sjabloon"
                  aria-label="Gebruiken"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-accent-700 dark:hover:bg-white/5 dark:hover:text-accent-300"
                >
                  <Icon d={ICONS.chat} className="h-4 w-4" />
                </button>
                <button
                  onClick={() => startEdit(p)}
                  title="Bewerken"
                  aria-label="Bewerken"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-100"
                >
                  <Icon d={ICONS.pencil} className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  title="Verwijderen"
                  aria-label="Verwijderen"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                >
                  <Icon d={ICONS.trash} className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function CustomizePage() {
  return (
    <Suspense>
      <AppShell>
        <CustomizeView />
      </AppShell>
    </Suspense>
  );
}
