"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChatSummary } from "@/lib/chatStore";

// Sidebar-refresh: chatpagina stuurt dit event na elk voltooid bericht.
export const CHATS_UPDATED_EVENT = "chats-updated";

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
  return "Ouder";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Lees de werkelijke stand pas na mount (het no-flash script in layout.tsx
  // heeft de class dan al gezet), zodat server- en client-render gelijk blijven.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function apply(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // privémodus zonder localStorage — thema geldt dan alleen deze sessie
    }
  }

  return (
    <div className="flex rounded-lg border border-slate-900/10 p-0.5 dark:border-white/10">
      {(
        [
          { value: "light", label: "☀ Licht" },
          { value: "dark", label: "☾ Donker" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          onClick={() => apply(option.value)}
          aria-pressed={theme === option.value}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            theme === option.value
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("chat");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      // sidebar mag stil falen
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CHATS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, refresh);
  }, [refresh]);

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (activeChatId === id) router.push("/");
    refresh();
  }

  // Groepeer op dag voor het bekende sidebar-gevoel
  const groups: { label: string; items: ChatSummary[] }[] = [];
  for (const chat of chats) {
    const label = relativeDay(chat.updatedAt);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(chat);
    else groups.push({ label, items: [chat] });
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-900/10 dark:border-white/10 bg-white dark:bg-black/30">
      <div className="px-4 pb-2 pt-5">
        <p className="font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-slate-900 dark:text-white">
          Bedrijfs <span className="text-emerald-600 dark:text-emerald-400">Command Center</span>
        </p>
      </div>

      <div className="space-y-1 px-3 py-3">
        <button
          onClick={() => {
            router.push("/");
            onNavigate?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20"
        >
          <span className="text-base leading-none">＋</span> Nieuwe chat
        </button>
        <Link
          href="/research"
          onClick={onNavigate}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
            pathname === "/research"
              ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="text-base leading-none">◈</span> Deal Research
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
            pathname === "/settings"
              ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="text-base leading-none">⚙</span> Instellingen
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {groups.length === 0 && (
          <p className="px-3 py-6 text-xs text-slate-400 dark:text-slate-600">
            Nog geen chats. Start hierboven een nieuwe chat — elk gesprek wordt
            automatisch opgeslagen als trainingsdata.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-600">
              {group.label}
            </p>
            {group.items.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  router.push(`/?chat=${chat.id}`);
                  onNavigate?.();
                }}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeChatId === chat.id && pathname === "/"
                    ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                <span
                  role="button"
                  aria-label="Verwijder chat"
                  onClick={(e) => removeChat(chat.id, e)}
                  className="hidden shrink-0 rounded p-0.5 text-slate-500 hover:text-red-500 dark:hover:text-red-400 group-hover:block"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-slate-900/10 dark:border-white/10 p-3">
        <ThemeToggle />
        <a
          href="/api/export"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-400 transition hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-emerald-700 dark:hover:text-emerald-300"
        >
          <span className="text-sm leading-none">⇩</span>
          <span>
            Exporteer trainingsdata
            <span className="block text-[10px] text-slate-400 dark:text-slate-600">
              {chats.length} {chats.length === 1 ? "chat" : "chats"} · JSONL
            </span>
          </span>
        </a>
      </div>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
          <div
            className="flex-1 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobiele topbalk */}
        <div className="flex items-center gap-3 border-b border-slate-900/10 dark:border-white/10 px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-slate-900/15 dark:border-white/15 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300"
          >
            ☰
          </button>
          <p className="font-[family-name:var(--font-display)] text-sm font-bold text-slate-900 dark:text-white">
            Bedrijfs <span className="text-emerald-600 dark:text-emerald-400">Command Center</span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
