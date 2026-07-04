"use client";

import { useSyncExternalStore } from "react";

/* ---------- Iconen ---------- */

export function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
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

export const ICONS = {
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
  monitor: "M4 5h16v11H4zM9 20h6M12 16v4",
  pin: "M9 3h6l-1 6 3.5 3v1h-11v-1L10 9 9 3zM12 13v8",
  pencil: "M4 20l1.2-4L16.5 4.7a2.1 2.1 0 013 3L8.2 19 4 20z",
  archive: "M3 6h18v4H3zM5 10v10h14V10M10 14h4",
  note: "M5 3h14v18l-4-3H5zM9 8h6M9 12h4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2",
  database:
    "M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
};

/* ---------- Thema ---------- */

export function currentTheme(): "dark" | "light" {
  return typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

// Thema kent drie standen: licht, donker of systeem (volgt het OS).
// De keuze leeft in localStorage; "systeem" = geen opgeslagen waarde.
export type ThemeMode = "light" | "dark" | "system";
const THEME_MODE_EVENT = "theme-mode-changed";

function subscribeThemeMode(onChange: () => void) {
  window.addEventListener(THEME_MODE_EVENT, onChange);
  return () => window.removeEventListener(THEME_MODE_EVENT, onChange);
}

export function getThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemeMode(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", mode);
  } catch {
    // privémodus zonder localStorage — thema geldt dan alleen deze sessie
  }
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  window.dispatchEvent(new Event(THEME_MODE_EVENT));
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeThemeMode, getThemeMode, () => "system");

  return (
    <div className="flex rounded-lg border border-slate-900/10 p-0.5 dark:border-white/10">
      {(
        [
          { value: "light", label: "Licht", icon: ICONS.sun },
          { value: "system", label: "Auto", icon: ICONS.monitor },
          { value: "dark", label: "Donker", icon: ICONS.moon },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          onClick={() => applyThemeMode(option.value)}
          aria-pressed={mode === option.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            mode === option.value
              ? "bg-accent-500/15 text-accent-700 dark:text-accent-300"
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
