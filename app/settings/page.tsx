"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell, { CHATS_UPDATED_EVENT, ThemeToggle } from "@/components/AppShell";
import ArchivePanel from "@/components/ArchivePanel";
import {
  DEFAULT_SETTINGS,
  MAX_TOKENS_OPTIONS,
  MODEL_OPTIONS,
  type Settings,
} from "@/lib/settingsShared";

/* ---------- Accentkleur (client-side, net als het thema) ---------- */

const ACCENTS = [
  { id: "emerald", label: "Smaragd", color: "#10b981" },
  { id: "sky", label: "Blauw", color: "#0ea5e9" },
  { id: "violet", label: "Paars", color: "#8b5cf6" },
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "rose", label: "Rood", color: "#f43f5e" },
] as const;

const ACCENT_EVENT = "accent-changed";

function subscribeAccent(onChange: () => void) {
  window.addEventListener(ACCENT_EVENT, onChange);
  return () => window.removeEventListener(ACCENT_EVENT, onChange);
}

function getAccent() {
  try {
    return localStorage.getItem("accent") ?? "emerald";
  } catch {
    return "emerald";
  }
}

function setAccent(id: string) {
  document.documentElement.dataset.accent = id;
  try {
    localStorage.setItem("accent", id);
  } catch {
    // geen localStorage — accent geldt alleen deze sessie
  }
  window.dispatchEvent(new Event(ACCENT_EVENT));
}

/* ---------- Bouwstenen (Claude-achtige rijen) ---------- */

const TABS = [
  { id: "profiel", label: "Profiel" },
  { id: "weergave", label: "Weergave" },
  { id: "model", label: "Model" },
  { id: "data", label: "Data" },
  { id: "archief", label: "Archief" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Eén instelling per rij: label + uitleg links, control rechts (of eronder).
function Row({
  title,
  description,
  children,
  stacked = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={`px-5 py-4 ${
        stacked ? "space-y-3" : "flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
      }`}
    >
      <div className={stacked ? "" : "min-w-0 max-w-md"}>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      <div className={stacked ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}

// Groep rijen in één kaart met scheidingslijnen, zoals Claude's instellingen.
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-slate-900/[0.07] rounded-2xl border border-slate-900/10 bg-white dark:divide-white/[0.07] dark:border-white/10 dark:bg-white/[0.03]">
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-900/10 p-0.5 dark:border-white/10">
      {options.map((option) => (
        <button
          key={String(option.value)}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === option.value
              ? "bg-accent-500/15 text-accent-700 dark:text-accent-300"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
        on ? "justify-end bg-accent-500" : "justify-start bg-slate-400/40 dark:bg-white/15"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

/* ---------- Pagina ---------- */

function SettingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "profiel";

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const accent = useSyncExternalStore(subscribeAccent, getAccent, () => "emerald");

  useEffect(() => {
    (async () => {
      const [settingsRes, chatsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/chats"),
      ]);
      const settingsData = await settingsRes.json();
      const chatsData = await chatsRes.json();
      setSettings(settingsData.settings);
      setApiKeyConfigured(settingsData.apiKeyConfigured);
      setChatCount(chatsData.chats?.length ?? 0);
    })();
  }, []);

  async function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteAllChats() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const res = await fetch("/api/chats", { method: "DELETE" });
    const data = await res.json();
    setChatCount(0);
    setConfirmDelete(false);
    window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
    setDataMessage(`${data.deleted} ${data.deleted === 1 ? "chat" : "chats"} verwijderd.`);
    setTimeout(() => setDataMessage(""), 4000);
  }

  async function importBackup(file: File) {
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const c = data.imported;
      setDataMessage(
        `Geïmporteerd: ${c.chats} chats, ${c.reports} rapporten, ${c.notes} notities, ${c.prompts} sjablonen.`
      );
      window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
      const chatsRes = await fetch("/api/chats");
      setChatCount((await chatsRes.json()).chats?.length ?? 0);
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : "Import mislukt");
    }
    setTimeout(() => setDataMessage(""), 6000);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <header className="animate-fade-up flex items-baseline justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          Instellingen
        </h1>
        <span
          aria-live="polite"
          className={`shrink-0 text-xs font-medium text-accent-600 transition-opacity dark:text-accent-400 ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          ✓ Opgeslagen
        </span>
      </header>

      {/* Tabbladen */}
      <nav className="animate-fade-up mt-6 flex gap-1 overflow-x-auto border-b border-slate-900/10 dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => router.replace(`/settings?tab=${t.id}`, { scroll: false })}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative shrink-0 px-3.5 pb-2.5 pt-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-500" />
            )}
          </button>
        ))}
      </nav>

      <div key={tab} className="animate-fade-up mt-6 space-y-6" style={{ animationDuration: "0.3s" }}>
        {tab === "profiel" && (
          <Group>
            <Row
              title="Naam"
              description="Wordt gebruikt in de begroeting en in de systeemprompt van de assistent."
            >
              <input
                value={settings.name}
                onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value.slice(0, 40) }))}
                onBlur={() => update({ name: settings.name })}
                placeholder="Je naam"
                className="w-56 rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </Row>
            <Row
              title="Eigen instructies"
              description="Wordt bij elk chatbericht aan de AI meegegeven — bijvoorbeeld je rol, schrijfstijl of vaste context. Max 2000 tekens."
              stacked
            >
              <textarea
                value={settings.customInstructions}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, customInstructions: e.target.value.slice(0, 2000) }))
                }
                onBlur={() => update({ customInstructions: settings.customInstructions })}
                placeholder="Bijv.: Ik ben student en bouw aan een portfolio van AI-projecten. Antwoord praktisch, met concrete voorbeelden."
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-900/15 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <p className="text-right text-xs text-slate-400 dark:text-slate-600">
                {settings.customInstructions.length}/2000
              </p>
            </Row>
          </Group>
        )}

        {tab === "weergave" && (
          <Group>
            <Row title="Thema" description="Licht, donker of automatisch meebewegen met je systeem.">
              <ThemeToggle />
            </Row>
            <Row title="Accentkleur" description="De kleur van knoppen, links en accenten. Wordt lokaal in je browser bewaard.">
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    aria-pressed={accent === a.id}
                    title={a.label}
                    aria-label={a.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90 ${
                      accent === a.id
                        ? "ring-2 ring-slate-900/40 ring-offset-2 ring-offset-white dark:ring-white/60 dark:ring-offset-[#0d1526]"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: a.color }}
                  >
                    {accent === a.id && <span className="text-xs font-bold text-white">✓</span>}
                  </button>
                ))}
              </div>
            </Row>
          </Group>
        )}

        {tab === "model" && (
          <>
            <Group>
              <Row
                title="AI-model"
                description="Bepaalt kwaliteit én kosten per bericht. Deal Research gebruikt altijd Opus."
                stacked
              >
                <div className="space-y-2">
                  {MODEL_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => update({ model: m.id })}
                      aria-pressed={settings.model === m.id}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        settings.model === m.id
                          ? "border-accent-500/60 bg-accent-500/10"
                          : "border-slate-900/10 bg-slate-50 hover:border-accent-400/40 dark:border-white/10 dark:bg-white/[0.02]"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                          settings.model === m.id
                            ? "border-accent-500 bg-accent-500"
                            : "border-slate-400 dark:border-slate-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {m.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Row>
              <Row title="Antwoordlengte" description="Maximale lengte van een antwoord. Korter = goedkoper.">
                <Segmented
                  options={MAX_TOKENS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={settings.maxTokens}
                  onChange={(value) => update({ maxTokens: value })}
                />
              </Row>
            </Group>
            <Group>
              <Row
                title="Demo-modus"
                description="Test de volledige app zonder API-tegoed: chat en Deal Research geven lokaal gegenereerde voorbeeldantwoorden."
              >
                <Switch on={settings.demoMode} onToggle={() => update({ demoMode: !settings.demoMode })} />
              </Row>
              <Row
                title="API-verbinding"
                description="De Anthropic API-sleutel staat lokaal in .env.local en is hier bewust niet zichtbaar."
              >
                <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      apiKeyConfigured === null
                        ? "bg-slate-400"
                        : apiKeyConfigured
                          ? "bg-accent-500"
                          : "bg-red-500"
                    }`}
                  />
                  {apiKeyConfigured === null
                    ? "Controleren…"
                    : apiKeyConfigured
                      ? "Geconfigureerd"
                      : "Geen sleutel gevonden"}
                </span>
              </Row>
            </Group>
          </>
        )}

        {tab === "data" && (
          <>
            <Group>
              <Row
                title="Trainingsdata exporteren"
                description={`Alle gesprekken als JSONL in het gangbare finetune-formaat. ${chatCount === null ? "" : `Nu ${chatCount} ${chatCount === 1 ? "chat" : "chats"} opgeslagen.`}`}
              >
                <a
                  href="/api/export"
                  className="rounded-xl border border-accent-600/30 bg-accent-500/10 px-4 py-2 text-sm font-medium text-accent-700 transition hover:bg-accent-500/20 dark:border-accent-500/30 dark:text-accent-300"
                >
                  ⇩ JSONL
                </a>
              </Row>
              <Row
                title="Volledige back-up"
                description="Chats, rapporten, notities, sjablonen en instellingen als één JSON-bestand — en weer te importeren."
              >
                <div className="flex gap-2">
                  <a
                    href="/api/backup"
                    className="rounded-xl border border-slate-900/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent-400/50 dark:border-white/15 dark:text-slate-300"
                  >
                    ⇩ Download
                  </a>
                  <label className="cursor-pointer rounded-xl border border-slate-900/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent-400/50 dark:border-white/15 dark:text-slate-300">
                    ⇧ Importeer…
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) importBackup(file);
                      }}
                    />
                  </label>
                </div>
              </Row>
            </Group>
            <Group>
              <Row
                title="Alle chats verwijderen"
                description="Verwijdert alle opgeslagen gesprekken definitief. Rapporten en notities blijven staan."
              >
                <button
                  onClick={deleteAllChats}
                  onMouseLeave={() => setConfirmDelete(false)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    confirmDelete
                      ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-300"
                      : "border-red-600/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
                  }`}
                >
                  {confirmDelete ? "Klik nogmaals om te wissen" : "Verwijderen"}
                </button>
              </Row>
            </Group>
            {dataMessage && (
              <p
                aria-live="polite"
                className="animate-fade-in rounded-xl border border-accent-600/30 bg-accent-500/10 px-4 py-2.5 text-sm text-accent-700 dark:border-accent-500/30 dark:text-accent-300"
              >
                ✓ {dataMessage}
              </p>
            )}
          </>
        )}

        {tab === "archief" && <ArchivePanel />}
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <AppShell>
        <SettingsView />
      </AppShell>
    </Suspense>
  );
}
