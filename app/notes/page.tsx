"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import AppShell from "@/components/AppShell";
import type { Note, NoteSummary } from "@/lib/noteStore";

function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function NotesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteId = searchParams.get("note");

  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Note | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    // Via een timeout-callback zodat de setState buiten de effect-body valt.
    const timer = setTimeout(refreshList, 0);
    return () => clearTimeout(timer);
  }, [refreshList]);

  // Nog niet weggeschreven wijzigingen direct opslaan (bij wisselen/weggaan).
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      await fetch(`/api/notes/${pending.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pending.title, content: pending.content }),
      });
    }
  }, []);

  // Reset tijdens render bij deselectie.
  const [prevNoteId, setPrevNoteId] = useState(noteId);
  if (prevNoteId !== noteId) {
    setPrevNoteId(noteId);
    if (!noteId) setNote(null);
  }

  useEffect(() => {
    if (!noteId) return;
    if (note?.id === noteId) return;
    let cancelled = false;
    (async () => {
      await flush();
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) {
        setNote(data.note);
        setSaveState("saved");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => () => void flush(), [flush]);

  function edit(patch: Partial<Pick<Note, "title" | "content">>) {
    setNote((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      pendingRef.current = next;
      return next;
    });
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      await fetch(`/api/notes/${pending.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pending.title, content: pending.content }),
      });
      setSaveState("saved");
      refreshList();
    }, 700);
  }

  async function newNote() {
    const res = await fetch("/api/notes", { method: "POST" });
    const data = await res.json();
    await refreshList();
    router.push(`/notes?note=${data.note.id}`);
  }

  async function removeNote(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (noteId === id) router.push("/notes");
    refreshList();
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Lijst */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-900/10 dark:border-white/10 max-sm:w-48">
        <div className="flex items-center justify-between px-4 pb-2 pt-5">
          <h1 className="font-[family-name:var(--font-display)] text-sm font-bold text-slate-900 dark:text-white">
            Notities
          </h1>
          <button
            onClick={newNote}
            title="Nieuwe notitie"
            className="rounded-lg border border-accent-600/30 bg-accent-500/10 px-2 py-1 text-xs font-medium text-accent-700 transition hover:bg-accent-500/20 active:scale-95 dark:border-accent-500/30 dark:text-accent-300"
          >
            ＋ Nieuw
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {notes !== null && notes.length === 0 && (
            <p className="px-3 py-6 text-xs text-slate-400 dark:text-slate-600">
              Nog geen notities. Maak er hierboven één aan.
            </p>
          )}
          {(notes ?? []).map((n, i) => (
            <button
              key={n.id}
              onClick={() => router.push(`/notes?note=${n.id}`)}
              style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
              className={`animate-slide-in group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition ${
                noteId === n.id
                  ? "bg-slate-900/10 dark:bg-white/10"
                  : "hover:bg-slate-900/5 dark:hover:bg-white/5"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800 dark:text-slate-200">
                  {n.title}
                </span>
                <span className="block text-[11px] text-slate-400 dark:text-slate-600">
                  {relativeTime(n.updatedAt)}
                </span>
              </span>
              <span
                role="button"
                aria-label="Verwijder notitie"
                onClick={(e) => removeNote(n.id, e)}
                className="hidden shrink-0 rounded p-0.5 text-slate-500 hover:text-red-500 group-hover:block dark:hover:text-red-400"
              >
                ✕
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        {note ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-900/10 px-5 py-3 dark:border-white/10">
              <input
                value={note.title}
                onChange={(e) => edit({ title: e.target.value })}
                placeholder="Titel…"
                className="w-full bg-transparent font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 focus:outline-none dark:text-white"
              />
              <span
                className={`shrink-0 text-xs transition-opacity ${
                  saveState === "saving" ? "text-slate-400" : "text-accent-600 dark:text-accent-400"
                }`}
              >
                {saveState === "saving" ? "Opslaan…" : "✓ Opgeslagen"}
              </span>
              <button
                onClick={() => setPreview((p) => !p)}
                aria-pressed={preview}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  preview
                    ? "border-accent-500/50 bg-accent-500/10 text-accent-700 dark:text-accent-300"
                    : "border-slate-900/10 text-slate-500 hover:text-slate-800 dark:border-white/10 dark:hover:text-slate-200"
                }`}
              >
                {preview ? "✎ Bewerken" : "◫ Voorbeeld"}
              </button>
            </div>
            {preview ? (
              <div className="markdown min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
                {note.content.trim() ? (
                  <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{note.content}</ReactMarkdown>
                ) : (
                  <p className="text-slate-400 dark:text-slate-600">Nog geen inhoud.</p>
                )}
              </div>
            ) : (
              <textarea
                value={note.content}
                onChange={(e) => edit({ content: e.target.value })}
                placeholder="Schrijf hier… (markdown wordt ondersteund)"
                className="min-h-0 w-full flex-1 resize-none bg-transparent px-6 py-5 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 dark:text-white">
              Notities
            </p>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Selecteer links een notitie of maak een nieuwe aan. Alles wordt
              automatisch bewaard terwijl je typt.
            </p>
            <button
              onClick={newNote}
              className="mt-6 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
            >
              ＋ Nieuwe notitie
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense>
      <AppShell>
        <NotesView />
      </AppShell>
    </Suspense>
  );
}
