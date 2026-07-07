"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Icon, ICONS } from "@/components/ui";
import { CHATS_UPDATED_EVENT } from "@/lib/events";
import type { ChatSummary } from "@/lib/chatStore";

function relativeDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86400000
  );
  if (diffDays <= 0) return "Vandaag";
  if (diffDays === 1) return "Gisteren";
  if (diffDays < 7) return "Deze week";
  if (diffDays < 31) return "Deze maand";
  return "Ouder";
}

function ChatsView() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      setChats([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function togglePin(chat: ChatSummary, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/chats/${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !chat.pinned }),
    });
    await refresh();
    window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
  }

  async function remove(chat: ChatSummary, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
    await refresh();
    window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
  }

  // Filteren op titel, daarna groeperen (vastgepind bovenaan, rest op dag).
  const groups = useMemo(() => {
    if (!chats) return [];
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
    const result: { label: string; items: ChatSummary[] }[] = [];
    const pinned = filtered.filter((c) => c.pinned);
    if (pinned.length) result.push({ label: "Vastgepind", items: pinned });
    for (const chat of filtered) {
      if (chat.pinned) continue;
      const label = relativeDay(chat.updatedAt);
      const group = result.find((g) => g.label === label);
      if (group) group.items.push(chat);
      else result.push({ label, items: [chat] });
    }
    return result;
  }, [chats, query]);

  const total = chats?.length ?? 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900 dark:text-white">
            Chats
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {total} {total === 1 ? "gesprek" : "gesprekken"} · automatisch bewaard
          </p>
        </div>
        <button
          onClick={() => router.push("/chat")}
          className="flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95"
        >
          <Icon d={ICONS.plus} className="h-4 w-4" />
          Nieuwe chat
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <Icon d={ICONS.search} className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op titel…"
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {chats === null && (
          <p className="px-1 py-8 text-sm text-slate-400 dark:text-slate-500">Laden…</p>
        )}
        {chats !== null && groups.length === 0 && (
          <p className="px-1 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            {query
              ? `Geen chats gevonden voor “${query}”.`
              : "Nog geen chats. Start je eerste gesprek."}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-900/10 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              {group.items.map((chat, i) => (
                <button
                  key={chat.id}
                  onClick={() => router.push(`/chat?chat=${chat.id}`)}
                  className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/5 ${
                    i > 0 ? "border-t border-slate-900/[0.07] dark:border-white/[0.07]" : ""
                  }`}
                >
                  {chat.pinned && (
                    <Icon d={ICONS.pin} className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {chat.title}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {chat.messageCount} {chat.messageCount === 1 ? "bericht" : "berichten"} ·{" "}
                      {new Date(chat.updatedAt).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                    <span
                      role="button"
                      aria-label={chat.pinned ? "Losmaken" : "Vastpinnen"}
                      title={chat.pinned ? "Losmaken" : "Vastpinnen"}
                      onClick={(e) => togglePin(chat, e)}
                      className={`rounded-lg p-1.5 ${
                        chat.pinned
                          ? "text-accent-600 dark:text-accent-400"
                          : "text-slate-400 hover:text-accent-600 dark:hover:text-accent-300"
                      }`}
                    >
                      <Icon d={ICONS.pin} className="h-4 w-4" />
                    </span>
                    <span
                      role="button"
                      aria-label="Verwijderen"
                      title="Verwijderen"
                      onClick={(e) => remove(chat, e)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Icon d={ICONS.trash} className="h-4 w-4" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense>
      <AppShell>
        <ChatsView />
      </AppShell>
    </Suspense>
  );
}
