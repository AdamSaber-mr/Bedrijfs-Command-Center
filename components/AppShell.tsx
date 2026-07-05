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
import { CHATS_UPDATED_EVENT, REPORTS_UPDATED_EVENT } from "@/lib/events";
import {
  Icon,
  ICONS,
  applyThemeMode,
  currentTheme,
  getThemeMode,
} from "@/components/ui";
import SettingsModal, { type SettingsTab } from "@/components/SettingsModal";

// Her-export voor bestaande importeurs (chat-/research-pagina's).
export { CHATS_UPDATED_EVENT, REPORTS_UPDATED_EVENT } from "@/lib/events";
export { ThemeToggle } from "@/components/ui";

// Tekst-woordmerk in Claude-stijl: geen icoon-blokje, alleen de naam in de
// display-serif. Ingeklapt tonen we alleen de initiaal.
function Logo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tracking-tight text-slate-900 dark:text-white">
        V
      </span>
    );
  }
  return (
    <span className="font-[family-name:var(--font-display)] text-[22px] font-semibold leading-none tracking-tight text-slate-900 dark:text-white">
      Vantage
    </span>
  );
}

// Initialen voor de account-avatar, afgeleid van de opgegeven naam.
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

/* ---------- Command palette (⌘K) ---------- */

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

interface SearchHits {
  chats: { id: string; title: string; snippet: string }[];
  reports: { id: string; company: string; snippet: string }[];
  notes: { id: string; title: string; snippet: string }[];
}

const NO_HITS: SearchHits = { chats: [], reports: [], notes: [] };

function CommandPalette({
  onClose,
  onOpenSettings,
  chats,
  reports,
}: {
  onClose: () => void;
  onOpenSettings: (tab: SettingsTab) => void;
  chats: ChatSummary[];
  reports: ReportSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState<SearchHits>(NO_HITS);
  const [prompts, setPrompts] = useState<{ id: string; title: string; text: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Prompt-sjablonen laden zodra het palet opent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/prompts");
        const data = await res.json();
        if (!cancelled) setPrompts(data.prompts ?? []);
      } catch {
        // sjablonen mogen stil falen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Full-text zoeken in de inhoud van chats en rapporten, licht gedebounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setHits(await res.json());
      } catch {
        // zoeken mag stil falen
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const actions: PaletteItem[] = [
      { id: "new-chat", group: "Acties", label: "Nieuwe chat", icon: ICONS.plus, run: go("/chat") },
      { id: "dashboard", group: "Acties", label: "Dashboard", icon: ICONS.dashboard, run: go("/") },
      { id: "chats", group: "Acties", label: "Alle chats", icon: ICONS.chat, run: go("/chats") },
      { id: "research", group: "Acties", label: "Deal Research", icon: ICONS.research, run: go("/research") },
      { id: "notes", group: "Acties", label: "Notities", icon: ICONS.note, run: go("/notes") },
      { id: "customize", group: "Acties", label: "Aanpassen", icon: ICONS.sparkle, run: go("/aanpassen") },
      {
        id: "archive",
        group: "Acties",
        label: "Archief",
        icon: ICONS.archive,
        run: () => {
          onOpenSettings("archief");
          onClose();
        },
      },
      {
        id: "settings",
        group: "Acties",
        label: "Instellingen",
        icon: ICONS.settings,
        run: () => {
          onOpenSettings("profiel");
          onClose();
        },
      },
      {
        id: "theme",
        group: "Acties",
        label: "Thema wisselen",
        icon: currentTheme() === "dark" ? ICONS.sun : ICONS.moon,
        run: () => {
          applyThemeMode(currentTheme() === "dark" ? "light" : "dark");
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
    const promptItems: PaletteItem[] = prompts.map((p) => ({
      id: `prompt-${p.id}`,
      group: "Sjablonen",
      label: p.title,
      hint: p.text,
      icon: ICONS.pencil,
      run: go(`/chat?draft=${encodeURIComponent(p.text)}`),
    }));

    const all = [...actions, ...chatItems, ...reportItems, ...promptItems];
    const q = query.trim().toLowerCase();
    if (!q)
      return [
        ...actions,
        ...chatItems.slice(0, 5),
        ...reportItems.slice(0, 4),
        ...promptItems.slice(0, 3),
      ];

    const byTitle = all.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 10);
    const shown = new Set(byTitle.map((item) => item.id));

    // Full-text-treffers uit berichten en rapportinhoud, zonder dubbelingen
    // met resultaten die al op titel matchen.
    const contentItems: PaletteItem[] = [
      ...hits.chats
        .filter((hit) => !shown.has(`chat-${hit.id}`))
        .map((hit) => ({
          id: `chat-content-${hit.id}`,
          group: "In berichten",
          label: hit.title,
          hint: hit.snippet,
          icon: ICONS.chat,
          run: go(`/chat?chat=${hit.id}`),
        })),
      ...hits.reports
        .filter((hit) => !shown.has(`report-${hit.id}`))
        .map((hit) => ({
          id: `report-content-${hit.id}`,
          group: "In rapporten",
          label: hit.company,
          hint: hit.snippet,
          icon: ICONS.report,
          run: go(`/research?report=${hit.id}`),
        })),
      ...(hits.notes ?? []).map((hit) => ({
        id: `note-${hit.id}`,
        group: "Notities",
        label: hit.title,
        hint: hit.snippet,
        icon: ICONS.note,
        run: go(`/notes?note=${hit.id}`),
      })),
    ];

    return [...byTitle, ...contentItems].slice(0, 14);
  }, [query, chats, reports, prompts, hits, router, onClose, onOpenSettings]);

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
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60"
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
              if (e.target.value.trim().length < 2) setHits(NO_HITS);
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
                      ? "bg-accent-500/10 text-accent-800 dark:text-accent-200"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Icon d={item.icon} className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="max-w-[45%] shrink-0 truncate text-xs text-slate-400 dark:text-slate-600">
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

// Rij in een dropdown-menu (chat-opties en account-menu).
function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  hint,
}: {
  icon: string;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
        danger
          ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
          : "text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
      }`}
    >
      <Icon d={icon} className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <kbd className="shrink-0 text-xs tracking-wide text-slate-400 dark:text-slate-500">
          {hint}
        </kbd>
      )}
    </button>
  );
}

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
  userName,
  userEmail,
  onToggleCollapse,
  onNavigate,
  onOpenPalette,
  onOpenSettings,
  onOpenShortcuts,
  onLogout,
  refreshChats,
  refreshReports,
}: {
  chats: ChatSummary[];
  reports: ReportSummary[];
  collapsed: boolean;
  width?: number;
  resizing?: boolean;
  userName: string;
  userEmail: string;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  refreshChats: () => void;
  refreshReports: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("chat");
  const activeReportId = searchParams.get("report");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipCommitRef = useRef(false);
  // ⋮-menu per chat, per rapport en het account-menu onderaan.
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [menuReportId, setMenuReportId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (activeChatId === id) router.push("/chat");
    refreshChats();
  }

  async function togglePin(chat: ChatSummary, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/chats/${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !chat.pinned }),
    });
    refreshChats();
  }

  function startRename(chat: ChatSummary, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    skipCommitRef.current = false;
    setDraft(chat.title);
    setRenamingId(chat.id);
  }

  // Opslaan gebeurt via één pad (blur); Enter blurt, Escape annuleert.
  async function commitRename(id: string) {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    const title = draft.trim();
    setRenamingId(null);
    if (!title) return;
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    refreshChats();
  }

  async function removeReport(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (activeReportId === id) router.push("/research");
    refreshReports();
  }

  // Vastgepinde chats bovenaan; de rest gegroepeerd op dag
  const pinnedChats = chats.filter((c) => c.pinned);
  const groups: { label: string; items: ChatSummary[] }[] = [];
  for (const chat of chats) {
    if (chat.pinned) continue;
    const label = relativeDay(chat.updatedAt);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(chat);
    else groups.push({ label, items: [chat] });
  }

  const renderChat = (chat: ChatSummary, index = 0) => {
    if (renamingId === chat.id) {
      return (
        <div key={chat.id} className="px-1 py-0.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                skipCommitRef.current = true;
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={() => commitRename(chat.id)}
            className="w-full rounded-lg border border-accent-400/50 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none dark:text-white"
          />
        </div>
      );
    }
    const active = activeChatId === chat.id && pathname === "/chat";
    const menuOpen = menuChatId === chat.id;
    return (
      <div
        key={chat.id}
        style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
        className={`animate-slide-in group relative flex items-center rounded-lg text-sm transition ${
          active || menuOpen
            ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
            : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
        }`}
      >
        <button
          onClick={() => {
            router.push(`/chat?chat=${chat.id}`);
            onNavigate?.();
          }}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
        >
          {chat.pinned && (
            <Icon d={ICONS.pin} className="h-3 w-3 shrink-0 text-accent-600 dark:text-accent-400" />
          )}
          <span className="min-w-0 flex-1 truncate">{chat.title}</span>
        </button>
        <button
          aria-label="Chatopties"
          title="Opties"
          onClick={(e) => {
            e.stopPropagation();
            setMenuChatId(menuOpen ? null : chat.id);
          }}
          className={`mr-1 shrink-0 rounded p-1 text-slate-500 transition hover:text-slate-900 dark:hover:text-white ${
            menuOpen ? "flex" : "hidden group-hover:flex"
          }`}
        >
          <Icon d={ICONS.dots} className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuChatId(null)} />
            <div className="animate-scale-in absolute right-1 top-9 z-50 w-44 overflow-hidden rounded-xl border border-slate-900/10 bg-white p-1 shadow-xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60">
              <MenuItem
                icon={ICONS.pin}
                label={chat.pinned ? "Losmaken" : "Vastpinnen"}
                onClick={(e) => {
                  setMenuChatId(null);
                  togglePin(chat, e);
                }}
              />
              <MenuItem
                icon={ICONS.pencil}
                label="Hernoemen"
                onClick={(e) => {
                  setMenuChatId(null);
                  startRename(chat, e);
                }}
              />
              <MenuItem
                icon={ICONS.trash}
                label="Verwijderen"
                danger
                onClick={(e) => {
                  setMenuChatId(null);
                  removeChat(chat.id, e);
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className={`flex h-full shrink-0 flex-col border-r border-slate-900/10 bg-white dark:border-white/10 dark:bg-black/30 ${
        resizing ? "" : "transition-[width] duration-200"
      }`}
    >
      {/* Kop: tekst-woordmerk met zoek- en inklap-icoon (Claude-stijl) */}
      <div className={`flex items-center pt-5 ${collapsed ? "flex-col gap-2 px-0 pb-3" : "justify-between px-4 pb-3"}`}>
        <Link href="/" onClick={onNavigate} aria-label="Dashboard">
          <Logo compact={collapsed} />
        </Link>
        <div className={`flex items-center gap-0.5 ${collapsed ? "flex-col" : ""}`}>
          <button
            onClick={onOpenPalette}
            aria-label="Zoeken"
            title="Zoeken (⌘K)"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            <Icon d={ICONS.search} className="h-[18px] w-[18px]" />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
              title={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
            >
              <Icon d={ICONS.panel} className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* Hoofdnavigatie */}
      <div className={`space-y-0.5 py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          onClick={() => {
            router.push("/chat");
            onNavigate?.();
          }}
          title={collapsed ? "Nieuwe chat" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-slate-900/15 dark:border-white/20">
            <Icon d={ICONS.plus} className="h-3.5 w-3.5" />
          </span>
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
          href="/chats"
          icon={ICONS.chat}
          label="Chats"
          active={pathname === "/chats"}
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
        <NavLink
          href="/notes"
          icon={ICONS.note}
          label="Notities"
          active={pathname === "/notes"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/aanpassen"
          icon={ICONS.sparkle}
          label="Aanpassen"
          active={pathname === "/aanpassen"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>

      {!collapsed && (
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Rapporten */}
          {reports.length > 0 && (
            <div className="mb-3">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Rapporten
              </p>
              {reports.slice(0, 5).map((report, i) => {
                const active = activeReportId === report.id && pathname === "/research";
                const menuOpen = menuReportId === report.id;
                return (
                  <div
                    key={report.id}
                    style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
                    className={`animate-slide-in group relative flex items-center rounded-lg text-sm transition ${
                      active || menuOpen
                        ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    }`}
                  >
                    <button
                      onClick={() => {
                        router.push(`/research?report=${report.id}`);
                        onNavigate?.();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                    >
                      <Icon d={ICONS.report} className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
                      <span className="min-w-0 flex-1 truncate">{report.company}</span>
                    </button>
                    <button
                      aria-label="Rapportopties"
                      title="Opties"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuReportId(menuOpen ? null : report.id);
                      }}
                      className={`mr-1 shrink-0 rounded p-1 text-slate-500 transition hover:text-slate-900 dark:hover:text-white ${
                        menuOpen ? "flex" : "hidden group-hover:flex"
                      }`}
                    >
                      <Icon d={ICONS.dots} className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuReportId(null)} />
                        <div className="animate-scale-in absolute right-1 top-9 z-50 w-40 overflow-hidden rounded-xl border border-slate-900/10 bg-white p-1 shadow-xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60">
                          <MenuItem
                            icon={ICONS.research}
                            label="Openen"
                            onClick={() => {
                              setMenuReportId(null);
                              router.push(`/research?report=${report.id}`);
                              onNavigate?.();
                            }}
                          />
                          <MenuItem
                            icon={ICONS.trash}
                            label="Verwijderen"
                            danger
                            onClick={(e) => {
                              setMenuReportId(null);
                              removeReport(report.id, e);
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recents */}
          <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Recent
            </p>
            <button
              onClick={onOpenPalette}
              aria-label="Zoeken in chats"
              title="Zoeken (⌘K)"
              className="rounded p-0.5 text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
            >
              <Icon d={ICONS.sliders} className="h-4 w-4" />
            </button>
          </div>

          {chats.length === 0 && (
            <p className="px-3 py-4 text-xs leading-relaxed text-slate-400 dark:text-slate-600">
              Nog geen chats. Start hierboven een nieuwe chat — elk gesprek wordt
              automatisch opgeslagen als trainingsdata.
            </p>
          )}
          {pinnedChats.length > 0 && (
            <div className="mb-3">
              {pinnedChats.map(renderChat)}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              {group.label !== "Vandaag" && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-600">
                  {group.label}
                </p>
              )}
              {group.items.map(renderChat)}
            </div>
          ))}
        </nav>
      )}

      {/* Account onderaan (Claude-stijl): naam + tandwiel voor directe
          instellingen, plus een dropdown-menu voor thema/export/sneltoetsen. */}
      {!collapsed ? (
        <div className="relative flex items-center gap-1 border-t border-slate-900/10 p-3 dark:border-white/10">
          {accountMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
              <div className="animate-scale-in absolute bottom-full left-3 right-3 z-50 mb-2 overflow-hidden rounded-2xl border border-slate-900/10 bg-white p-1.5 shadow-xl shadow-slate-900/25 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60">
                <p className="truncate px-3 pb-1.5 pt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {userEmail || "Ingelogd"}
                </p>
                <MenuItem
                  icon={ICONS.cog}
                  label="Instellingen"
                  hint="⌘,"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettings();
                    onNavigate?.();
                  }}
                />
                <MenuItem
                  icon={ICONS.keyboard}
                  label="Sneltoetsen"
                  hint="?"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenShortcuts();
                  }}
                />
                <MenuItem
                  icon={ICONS.download}
                  label="Exporteer trainingsdata"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    window.location.assign("/api/export");
                  }}
                />
                <div className="my-1 h-px bg-slate-900/[0.07] dark:bg-white/[0.07]" />
                <MenuItem
                  icon={ICONS.logout}
                  label="Uitloggen"
                  danger
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onLogout();
                  }}
                />
              </div>
            </>
          )}
          <button
            onClick={() => setAccountMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            title="Account"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-700 dark:text-accent-300">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {userName || "Account"}
              </span>
              <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                Vantage-werkruimte
              </span>
            </span>
            <Icon d={ICONS.chevronUpDown} className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              onNavigate?.();
            }}
            aria-label="Instellingen"
            title="Instellingen"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            <Icon d={ICONS.cog} className="h-[18px] w-[18px]" />
          </button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col items-center gap-1 border-t border-slate-900/10 p-2 dark:border-white/10">
          <a
            href="/api/export"
            title="Exporteer trainingsdata"
            aria-label="Exporteer trainingsdata"
            className="flex w-full justify-center rounded-lg py-2 text-slate-500 transition hover:bg-slate-900/5 hover:text-accent-700 dark:hover:bg-white/5 dark:hover:text-accent-300"
          >
            <Icon d={ICONS.download} />
          </a>
          <button
            onClick={() => {
              onOpenSettings();
              onNavigate?.();
            }}
            title="Instellingen"
            className="flex w-full justify-center rounded-lg p-1.5 transition hover:bg-slate-900/5 dark:hover:bg-white/5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-700 dark:text-accent-300">
              {initials(userName)}
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}

/* ---------- Shortcuts-overzicht (?) ---------- */

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Zoeken in chats, rapporten en acties" },
  { keys: ["⌘", "B"], label: "Sidebar in- of uitklappen" },
  { keys: ["⌘", "⇧", "O"], label: "Nieuwe chat" },
  { keys: ["⌘", ","], label: "Instellingen openen" },
  { keys: ["Enter"], label: "Bericht versturen" },
  { keys: ["⇧", "Enter"], label: "Nieuwe regel in een bericht" },
  { keys: ["?"], label: "Dit overzicht openen of sluiten" },
  { keys: ["Esc"], label: "Venster sluiten" },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-6 shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
          Sneltoetsen
        </h2>
        <ul className="mt-4 space-y-2.5">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-600 dark:text-slate-400">{s.label}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-slate-900/15 px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-white/15 dark:text-slate-400"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
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

export default function AppShell({
  children,
  initialSettingsTab,
}: {
  children: React.ReactNode;
  initialSettingsTab?: SettingsTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(
    initialSettingsTab ?? null
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileOpenRef = useRef(false);
  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

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

  // Naam en e-mail van het ingelogde account voor de account-rij.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!cancelled && data.user) {
          setUserName(data.user.name ?? "");
          setUserEmail(data.user.email ?? "");
        }
      } catch {
        // account-info mag stil falen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Uitloggen: sessie intrekken en terug naar de loginpagina.
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ook bij een netwerkfout sturen we door naar login
    }
    router.replace("/login");
    router.refresh();
  }, [router]);

  // Instellingen-popup sluiten; op de /settings-deeplink navigeren we terug.
  function closeSettings() {
    setSettingsTab(null);
    if (pathname === "/settings") router.replace("/");
  }

  function toggleCollapse() {
    try {
      // Lees de actuele stand uit localStorage zodat dit ook vanuit
      // stale closures (zoals de globale keydown-listener) klopt.
      localStorage.setItem("sidebar-collapsed", getCollapsed() ? "0" : "1");
    } catch {
      // geen localStorage — inklappen werkt dan niet, geen ramp
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  // Globale sneltoetsen: ⌘K zoeken, ⌘B sidebar, ⌘⇧O nieuwe chat, ? overzicht.
  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShortcutsOpen(false);
        setPaletteOpen((o) => !o);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        router.push("/chat");
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsTab("profiel");
      } else if (e.key === "?" && !mod && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.key === "Escape") {
        setShortcutsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  // Edge-swipe op touch-apparaten: vanaf de linkerrand naar rechts vegen
  // opent de sidebar; naar links vegen sluit hem weer.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = touch.clientX < 28 || mobileOpenRef.current;
    }
    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dy > 60) {
        tracking = false;
        return;
      }
      if (dx > 60 && !mobileOpenRef.current) {
        tracking = false;
        setMobileOpen(true);
      } else if (dx < -60 && mobileOpenRef.current) {
        tracking = false;
        setMobileOpen(false);
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // Volg live wijzigingen van het OS-thema wanneer "Auto" actief is.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemeMode() === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* Desktop sidebar */}
      <div className="relative hidden md:flex">
        <Sidebar
          chats={chats}
          reports={reports}
          collapsed={collapsed}
          width={sidebarWidth}
          resizing={resizing}
          userName={userName}
          userEmail={userEmail}
          onToggleCollapse={toggleCollapse}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={() => setSettingsTab("profiel")}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onLogout={logout}
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
              resizing ? "bg-accent-400/50" : "hover:bg-accent-400/30"
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
            userName={userName}
            userEmail={userEmail}
            onNavigate={() => setMobileOpen(false)}
            onOpenPalette={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
            onOpenSettings={() => setSettingsTab("profiel")}
            onOpenShortcuts={() => {
              setMobileOpen(false);
              setShortcutsOpen(true);
            }}
            onLogout={logout}
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
        <div className="flex items-center gap-3 border-b border-slate-900/10 px-4 py-3 dark:border-white/10 md:hidden print:hidden">
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

        <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">{children}</div>
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={(tab) => setSettingsTab(tab)}
          chats={chats}
          reports={reports}
        />
      )}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {settingsTab && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}
