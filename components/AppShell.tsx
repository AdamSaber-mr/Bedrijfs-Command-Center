"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChatSummary } from "@/lib/chatStore";
import type { ReportSummary } from "@/lib/reportStore";

// Sidebar-refresh: chatpagina stuurt dit event na elk voltooid bericht.
export const CHATS_UPDATED_EVENT = "chats-updated";
// Idem voor deal-rapporten, na een afgeronde of verwijderde analyse.
export const REPORTS_UPDATED_EVENT = "reports-updated";

/* ---------- Iconen ---------- */

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chat: "M21 12c0 4.1-4 7.5-9 7.5-1 0-2-.13-2.9-.38L4 21l1.3-3.3A7.1 7.1 0 013 12c0-4.1 4-7.5 9-7.5s9 3.4 9 7.5z",
  research: "M3 17l6-6 4 4 8-8M15 7h6v6",
  report: "M7 3h7l5 5v13H7zM14 3v5h5M10.5 13h7M10.5 17h7",
  settings:
    "M4 8h9M17.5 8H20M13.5 8a2 2 0 104 0 2 2 0 00-4 0zM4 16h2.5M10.5 16H20M6.5 16a2 2 0 104 0 2 2 0 00-4 0z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M5 21h14",
  close: "M6 6l12 12M18 6L6 18",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 13A8.5 8.5 0 0111 3a8.5 8.5 0 102 10z",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600">
        <svg viewBox="0 0 24 24" fill="white" className="h-4.5 w-4.5" aria-hidden>
          <path d="M13 2 4.5 13.5h5L11 22l8.5-11.5h-5L13 2z" />
        </svg>
      </span>
      {!compact && (
        <span className="font-[family-name:var(--font-display)] text-sm font-bold leading-tight tracking-wide text-slate-900 dark:text-white">
          Bedrijfs
          <span className="block text-emerald-600 dark:text-emerald-400">Command Center</span>
        </span>
      )}
    </span>
  );
}

/* ---------- Helpers ---------- */

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

function currentTheme(): "dark" | "light" {
  return typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

function applyTheme(next: "dark" | "light") {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("theme", next);
  } catch {
    // privémodus zonder localStorage — thema geldt dan alleen deze sessie
  }
}

// De class op <html> is de bron van waarheid (gezet door het no-flash script
// in layout.tsx); een MutationObserver houdt React ermee in sync.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function useTheme(): "dark" | "light" {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "dark");
}

function ThemeToggle() {
  const theme = useTheme();

  function apply(next: "dark" | "light") {
    applyTheme(next);
  }

  return (
    <div className="flex rounded-lg border border-slate-900/10 p-0.5 dark:border-white/10">
      {(
        [
          { value: "light", label: "Licht", icon: ICONS.sun },
          { value: "dark", label: "Donker", icon: ICONS.moon },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          onClick={() => apply(option.value)}
          aria-pressed={theme === option.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            theme === option.value
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Icon d={option.icon} className="h-3.5 w-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Command palette (⌘K) ---------- */

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

function CommandPalette({
  onClose,
  chats,
  reports,
}: {
  onClose: () => void;
  chats: ChatSummary[];
  reports: ReportSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const actions: PaletteItem[] = [
      { id: "new-chat", group: "Acties", label: "Nieuwe chat", icon: ICONS.plus, run: go("/chat") },
      { id: "dashboard", group: "Acties", label: "Dashboard", icon: ICONS.dashboard, run: go("/") },
      { id: "research", group: "Acties", label: "Deal Research", icon: ICONS.research, run: go("/research") },
      { id: "settings", group: "Acties", label: "Instellingen", icon: ICONS.settings, run: go("/settings") },
      {
        id: "theme",
        group: "Acties",
        label: "Thema wisselen",
        icon: currentTheme() === "dark" ? ICONS.sun : ICONS.moon,
        run: () => {
          applyTheme(currentTheme() === "dark" ? "light" : "dark");
          onClose();
        },
      },
      {
        id: "export",
        group: "Acties",
        label: "Exporteer trainingsdata",
        hint: "JSONL",
        icon: ICONS.download,
        run: () => {
          window.location.assign("/api/export");
          onClose();
        },
      },
    ];
    const chatItems: PaletteItem[] = chats.map((c) => ({
      id: `chat-${c.id}`,
      group: "Chats",
      label: c.title,
      hint: relativeDay(c.updatedAt),
      icon: ICONS.chat,
      run: go(`/chat?chat=${c.id}`),
    }));
    const reportItems: PaletteItem[] = reports.map((r) => ({
      id: `report-${r.id}`,
      group: "Rapporten",
      label: r.company,
      hint: new Date(r.createdAt).toLocaleDateString("nl-NL"),
      icon: ICONS.report,
      run: go(`/research?report=${r.id}`),
    }));

    const all = [...actions, ...chatItems, ...reportItems];
    const q = query.trim().toLowerCase();
    if (!q) return [...actions, ...chatItems.slice(0, 5), ...reportItems.slice(0, 4)];
    return all.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 12);
  }, [query, chats, reports, router, onClose]);

  // Houd de selectie in beeld bij navigatie met pijltjestoetsen.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const groups: { label: string; items: { item: PaletteItem; flatIndex: number }[] }[] = [];
  items.forEach((item, flatIndex) => {
    const group = groups.find((g) => g.label === item.group);
    if (group) group.items.push({ item, flatIndex });
    else groups.push({ label: item.group, items: [{ item, flatIndex }] });
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="animate-fade-up w-full max-w-lg overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60"
        style={{ animationDuration: "0.2s" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-900/10 px-4 dark:border-white/10">
          <Icon d={ICONS.search} className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[index]?.run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Zoek chats, rapporten of acties…"
            className="w-full bg-transparent py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />
          <kbd className="rounded border border-slate-900/15 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-white/15 dark:text-slate-500">
            esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Geen resultaten voor “{query}”
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-600">
                {group.label}
              </p>
              {group.items.map(({ item, flatIndex }) => (
                <button
                  key={item.id}
                  data-index={flatIndex}
                  onClick={item.run}
                  onMouseMove={() => setIndex(flatIndex)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    flatIndex === index
                      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Icon d={item.icon} className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-600">
                      {item.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Sidebar ---------- */

function NavLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        collapsed ? "justify-center px-0" : ""
      } ${
        active
          ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
          : "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
    >
      <Icon d={icon} />
      {!collapsed && label}
    </Link>
  );
}

function Sidebar({
  chats,
  reports,
  collapsed,
  width = DEFAULT_SIDEBAR_WIDTH,
  resizing = false,
  onToggleCollapse,
  onNavigate,
  onOpenPalette,
  refreshChats,
  refreshReports,
}: {
  chats: ChatSummary[];
  reports: ReportSummary[];
  collapsed: boolean;
  width?: number;
  resizing?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenPalette: () => void;
  refreshChats: () => void;
  refreshReports: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("chat");
  const activeReportId = searchParams.get("report");
  const [search, setSearch] = useState("");

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (activeChatId === id) router.push("/chat");
    refreshChats();
  }

  async function removeReport(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (activeReportId === id) router.push("/research");
    refreshReports();
  }

  const filteredChats = search.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    : chats;

  // Groepeer op dag voor het bekende sidebar-gevoel
  const groups: { label: string; items: ChatSummary[] }[] = [];
  for (const chat of filteredChats) {
    const label = relativeDay(chat.updatedAt);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(chat);
    else groups.push({ label, items: [chat] });
  }

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className={`flex h-full shrink-0 flex-col border-r border-slate-900/10 bg-white dark:border-white/10 dark:bg-black/30 ${
        resizing ? "" : "transition-[width] duration-200"
      }`}
    >
      <div className={`flex items-center pt-5 ${collapsed ? "justify-center px-0 pb-3" : "justify-between px-4 pb-2"}`}>
        <Link href="/" onClick={onNavigate} aria-label="Dashboard">
          <Logo compact={collapsed} />
        </Link>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Sidebar inklappen"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <Icon d={ICONS.chevronLeft} className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          aria-label="Sidebar uitklappen"
          className="mx-auto mb-1 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
        >
          <Icon d={ICONS.chevronRight} className="h-4 w-4" />
        </button>
      )}

      <div className={`space-y-1 py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          onClick={() => {
            router.push("/chat");
            onNavigate?.();
          }}
          title={collapsed ? "Nieuwe chat" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-lg border border-emerald-600/30 bg-emerald-500/10 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-300 ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <Icon d={ICONS.plus} />
          {!collapsed && "Nieuwe chat"}
        </button>
        <NavLink
          href="/"
          icon={ICONS.dashboard}
          label="Dashboard"
          active={pathname === "/"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/research"
          icon={ICONS.research}
          label="Deal Research"
          active={pathname === "/research"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>

      {!collapsed && (
        <>
          <div className="px-3 pb-1">
            <button
              onClick={onOpenPalette}
              className="flex w-full items-center gap-2.5 rounded-lg border border-slate-900/10 px-3 py-2 text-sm text-slate-400 transition hover:border-emerald-400/40 hover:text-slate-600 dark:border-white/10 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <Icon d={ICONS.search} className="h-4 w-4" />
              <span className="flex-1 text-left">Zoeken…</span>
              <kbd className="rounded border border-slate-900/15 px-1.5 py-0.5 text-[10px] dark:border-white/15">
                ⌘K
              </kbd>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {/* Rapporten */}
            {reports.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-600">
                  Rapporten
                </p>
                {reports.slice(0, 5).map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      router.push(`/research?report=${report.id}`);
                      onNavigate?.();
                    }}
                    className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeReportId === report.id && pathname === "/research"
                        ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon d={ICONS.report} className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                    <span className="min-w-0 flex-1 truncate">{report.company}</span>
                    <span
                      role="button"
                      aria-label="Verwijder rapport"
                      onClick={(e) => removeReport(report.id, e)}
                      className="hidden shrink-0 rounded p-0.5 text-slate-500 hover:text-red-500 group-hover:block dark:hover:text-red-400"
                    >
                      <Icon d={ICONS.close} className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Chats */}
            {search.trim() && filteredChats.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-400 dark:text-slate-600">
                Geen chats gevonden voor “{search.trim()}”.
              </p>
            )}
            {!search.trim() && groups.length === 0 && (
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
                      router.push(`/chat?chat=${chat.id}`);
                      onNavigate?.();
                    }}
                    className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeChatId === chat.id && pathname === "/chat"
                        ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                    <span
                      role="button"
                      aria-label="Verwijder chat"
                      onClick={(e) => removeChat(chat.id, e)}
                      className="hidden shrink-0 rounded p-0.5 text-slate-500 hover:text-red-500 group-hover:block dark:hover:text-red-400"
                    >
                      <Icon d={ICONS.close} className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Zoekveld voor chats */}
          <div className="border-t border-slate-900/10 px-3 pb-1 pt-2 dark:border-white/10">
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/[0.04] px-2.5 dark:bg-white/[0.04]">
              <Icon d={ICONS.search} className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter chats…"
                className="w-full bg-transparent py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Wis zoekopdracht"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <Icon d={ICONS.close} className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 p-3">
            <ThemeToggle />
            <a
              href="/api/export"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-900/5 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-emerald-300"
            >
              <Icon d={ICONS.download} className="h-4 w-4" />
              <span>
                Exporteer trainingsdata
                <span className="block text-[10px] text-slate-400 dark:text-slate-600">
                  {chats.length} {chats.length === 1 ? "chat" : "chats"} · JSONL
                </span>
              </span>
            </a>
            <NavLink
              href="/settings"
              icon={ICONS.settings}
              label="Instellingen"
              active={pathname === "/settings"}
              collapsed={false}
              onNavigate={onNavigate}
            />
          </div>
        </>
      )}

      {collapsed && (
        <div className="flex flex-1 flex-col justify-end space-y-1 px-2 pb-3">
          <button
            onClick={onOpenPalette}
            title="Zoeken (⌘K)"
            className="flex w-full justify-center rounded-lg py-2 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <Icon d={ICONS.search} />
          </button>
          <NavLink
            href="/settings"
            icon={ICONS.settings}
            label="Instellingen"
            active={pathname === "/settings"}
            collapsed
            onNavigate={onNavigate}
          />
        </div>
      )}
    </aside>
  );
}

/* ---------- Shell ---------- */

// Breedte van de sidebar is met de muis versleepbaar; net als de ingeklapte
// stand leeft die in localStorage met een custom event voor useSyncExternalStore.
const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 480;
const SIDEBAR_WIDTH_EVENT = "sidebar-width-changed";

function clampSidebarWidth(px: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, px));
}

function subscribeSidebarWidth(onChange: () => void) {
  window.addEventListener(SIDEBAR_WIDTH_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_WIDTH_EVENT, onChange);
}

function getSidebarWidth() {
  try {
    const stored = Number(localStorage.getItem("sidebar-width"));
    return stored ? clampSidebarWidth(stored) : DEFAULT_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function setSidebarWidth(px: number) {
  try {
    localStorage.setItem("sidebar-width", String(Math.round(clampSidebarWidth(px))));
  } catch {
    // geen localStorage — slepen heeft dan geen effect, sidebar houdt de standaardbreedte
  }
  window.dispatchEvent(new Event(SIDEBAR_WIDTH_EVENT));
}

// Ingeklapte stand van de sidebar leeft in localStorage, met een custom
// event zodat useSyncExternalStore wijzigingen direct oppikt.
const SIDEBAR_EVENT = "sidebar-collapsed-changed";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

function getCollapsed() {
  try {
    return localStorage.getItem("sidebar-collapsed") === "1";
  } catch {
    return false;
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => false);
  const sidebarWidth = useSyncExternalStore(
    subscribeSidebarWidth,
    getSidebarWidth,
    () => DEFAULT_SIDEBAR_WIDTH
  );

  // Sleep de rechterrand van de sidebar om de breedte aan te passen.
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => setSidebarWidth(ev.clientX);
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      // sidebar mag stil falen
    }
  }, []);

  const refreshReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      // sidebar mag stil falen
    }
  }, []);

  useEffect(() => {
    window.addEventListener(CHATS_UPDATED_EVENT, refreshChats);
    window.addEventListener(REPORTS_UPDATED_EVENT, refreshReports);
    // Eerste lading via dezelfde event-route als latere updates.
    window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
    window.dispatchEvent(new Event(REPORTS_UPDATED_EVENT));
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, refreshChats);
      window.removeEventListener(REPORTS_UPDATED_EVENT, refreshReports);
    };
  }, [refreshChats, refreshReports]);

  function toggleCollapse() {
    try {
      localStorage.setItem("sidebar-collapsed", collapsed ? "0" : "1");
    } catch {
      // geen localStorage — inklappen werkt dan niet, geen ramp
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  // ⌘K / Ctrl+K opent het zoekpalet.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="relative hidden md:flex">
        <Sidebar
          chats={chats}
          reports={reports}
          collapsed={collapsed}
          width={sidebarWidth}
          resizing={resizing}
          onToggleCollapse={toggleCollapse}
          onOpenPalette={() => setPaletteOpen(true)}
          refreshChats={refreshChats}
          refreshReports={refreshReports}
        />
        {!collapsed && (
          <div
            onPointerDown={startResize}
            onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            title="Sleep om de breedte aan te passen · dubbelklik om te herstellen"
            aria-hidden
            className={`absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize transition-colors ${
              resizing ? "bg-emerald-400/50" : "hover:bg-emerald-400/30"
            }`}
          />
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <Sidebar
            chats={chats}
            reports={reports}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
            onOpenPalette={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
            refreshChats={refreshChats}
            refreshReports={refreshReports}
          />
          <div
            className="flex-1 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobiele topbalk */}
        <div className="flex items-center gap-3 border-b border-slate-900/10 px-4 py-3 dark:border-white/10 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-slate-900/15 px-2.5 py-1.5 text-sm text-slate-700 dark:border-white/15 dark:text-slate-300"
          >
            ☰
          </button>
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          chats={chats}
          reports={reports}
        />
      )}
    </div>
  );
}
