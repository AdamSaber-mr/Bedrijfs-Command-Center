"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import ArchivePanel from "@/components/ArchivePanel";
import { Icon, ICONS, ThemeToggle } from "@/components/ui";
import { ACCOUNT_UPDATED_EVENT, CHATS_UPDATED_EVENT } from "@/lib/events";
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

/* ---------- Bouwstenen ---------- */

export type SettingsTab =
  | "profiel"
  | "account"
  | "weergave"
  | "model"
  | "data"
  | "archief";

const NAV: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "profiel", label: "Profiel", icon: ICONS.user },
  { id: "account", label: "Account", icon: ICONS.shield },
  { id: "weergave", label: "Weergave", icon: ICONS.sun },
  { id: "model", label: "Model", icon: ICONS.sparkle },
  { id: "data", label: "Data", icon: ICONS.database },
  { id: "archief", label: "Archief", icon: ICONS.archive },
];

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
      <div className={stacked ? "" : "min-w-0 max-w-sm"}>
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

/* ---------- Modal ---------- */

export default function SettingsModal({
  tab,
  onTabChange,
  onClose,
}: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const accent = useSyncExternalStore(subscribeAccent, getAccent, () => "emerald");

  // Account (los van de AI-profielnaam): naam + e-mail van het login-account.
  const [account, setAccount] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [accountError, setAccountError] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  useEffect(() => {
    (async () => {
      const [settingsRes, chatsRes, meRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/chats"),
        fetch("/api/auth/me"),
      ]);
      const settingsData = await settingsRes.json();
      const chatsData = await chatsRes.json();
      const meData = await meRes.json();
      setSettings(settingsData.settings);
      setApiKeyConfigured(settingsData.apiKeyConfigured);
      setChatCount(chatsData.chats?.length ?? 0);
      if (meData.user) setAccount({ name: meData.user.name ?? "", email: meData.user.email ?? "" });
    })();
  }, []);

  // Naam of e-mail van het account opslaan.
  async function saveAccount(patch: { name?: string; email?: string }) {
    setAccountError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setAccountError(data.error ?? "Bijwerken mislukt");
      return;
    }
    setAccount({ name: data.user.name, email: data.user.email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new Event(ACCOUNT_UPDATED_EVENT));
  }

  async function changePassword() {
    setPwError("");
    setPwMessage("");
    if (pw.next !== pw.confirm) {
      setPwError("De nieuwe wachtwoorden komen niet overeen.");
      return;
    }
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwError(data.error ?? "Wijzigen mislukt");
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    setPwMessage("Wachtwoord gewijzigd.");
    setTimeout(() => setPwMessage(""), 4000);
  }

  async function deleteAccount() {
    if (!confirmDeleteAccount) {
      setConfirmDeleteAccount(true);
      return;
    }
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) window.location.assign("/login");
  }

  // Esc sluit de popup.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  const activeLabel = NAV.find((n) => n.id === tab)?.label ?? "";

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm dark:bg-black/60 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Instellingen"
    >
      <div
        className="animate-scale-in flex h-[min(680px,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-2xl shadow-slate-900/25 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/60 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Linkerkolom: navigatie */}
        <div className="shrink-0 border-b border-slate-900/10 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/20 md:w-52 md:border-b-0 md:border-r md:p-4">
          <p className="hidden px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 md:block">
            Instellingen
          </p>
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition md:w-full ${
                  tab === item.id
                    ? "bg-slate-900/10 font-medium text-slate-900 dark:bg-white/10 dark:text-white"
                    : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <Icon d={item.icon} className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Rechterkolom: inhoud */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5 sm:px-8">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-white">
              {activeLabel}
            </h2>
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                className={`text-xs font-medium text-accent-600 transition-opacity dark:text-accent-400 ${
                  saved ? "opacity-100" : "opacity-0"
                }`}
              >
                ✓ Opgeslagen
              </span>
              <button
                onClick={onClose}
                aria-label="Sluiten"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <Icon d={ICONS.close} className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div key={tab} className="animate-fade-in min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-2 sm:px-8">
            {tab === "profiel" && (
              <Group>
                <Row
                  title="Hoe moet de AI je noemen?"
                  description="Alleen voor de begroeting en de systeemprompt van de assistent — los van je accountnaam en e-mail (die beheer je onder Account)."
                >
                  <input
                    value={settings.name}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, name: e.target.value.slice(0, 40) }))
                    }
                    onBlur={() => update({ name: settings.name })}
                    placeholder="Je naam"
                    className="w-52 rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
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
                      setSettings((s) => ({
                        ...s,
                        customInstructions: e.target.value.slice(0, 2000),
                      }))
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

            {tab === "account" && (
              <>
                <Group>
                  <Row title="Naam" description="Je naam op dit account.">
                    <input
                      value={account.name}
                      onChange={(e) =>
                        setAccount((a) => ({ ...a, name: e.target.value.slice(0, 60) }))
                      }
                      onBlur={() => account.name.trim() && saveAccount({ name: account.name })}
                      placeholder="Je naam"
                      className="w-60 rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </Row>
                  <Row title="E-mailadres" description="Het adres waarmee je inlogt.">
                    <input
                      type="email"
                      value={account.email}
                      onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                      onBlur={() => account.email.trim() && saveAccount({ email: account.email })}
                      placeholder="jij@voorbeeld.nl"
                      className="w-60 rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </Row>
                </Group>
                {accountError && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                    {accountError}
                  </p>
                )}

                <Group>
                  <Row
                    title="Wachtwoord wijzigen"
                    description="Voer je huidige wachtwoord in en kies een nieuw wachtwoord van minimaal 8 tekens."
                    stacked
                  >
                    <div className="space-y-2">
                      {(
                        [
                          { key: "current", placeholder: "Huidig wachtwoord", autoComplete: "current-password" },
                          { key: "next", placeholder: "Nieuw wachtwoord", autoComplete: "new-password" },
                          { key: "confirm", placeholder: "Bevestig nieuw wachtwoord", autoComplete: "new-password" },
                        ] as const
                      ).map((f) => (
                        <input
                          key={f.key}
                          type="password"
                          autoComplete={f.autoComplete}
                          value={pw[f.key]}
                          onChange={(e) => setPw((p) => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full rounded-xl border border-slate-900/15 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                      ))}
                      {pwError && <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>}
                      {pwMessage && (
                        <p className="text-sm text-accent-600 dark:text-accent-400">✓ {pwMessage}</p>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={changePassword}
                          disabled={!pw.current || !pw.next || !pw.confirm}
                          className="rounded-xl border border-accent-600/30 bg-accent-500/10 px-4 py-2 text-sm font-medium text-accent-700 transition enabled:hover:bg-accent-500/20 disabled:opacity-40 dark:border-accent-500/30 dark:text-accent-300"
                        >
                          Wachtwoord wijzigen
                        </button>
                      </div>
                    </div>
                  </Row>
                </Group>

                <Group>
                  <Row
                    title="Account verwijderen"
                    description="Verwijdert je account én al je data (chats, rapporten, notities, sjablonen) definitief. Dit kan niet ongedaan worden gemaakt."
                  >
                    <button
                      onClick={deleteAccount}
                      onMouseLeave={() => setConfirmDeleteAccount(false)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        confirmDeleteAccount
                          ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-300"
                          : "border-red-600/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
                      }`}
                    >
                      {confirmDeleteAccount ? "Klik nogmaals om te verwijderen" : "Account verwijderen"}
                    </button>
                  </Row>
                </Group>
              </>
            )}

            {tab === "weergave" && (
              <Group>
                <Row title="Thema" description="Licht, donker of automatisch meebewegen met je systeem.">
                  <ThemeToggle />
                </Row>
                <Row
                  title="Accentkleur"
                  description="De kleur van knoppen, links en accenten. Wordt lokaal in je browser bewaard."
                >
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
                        {accent === a.id && (
                          <span className="text-xs font-bold text-white">✓</span>
                        )}
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
                  <Row
                    title="Antwoordlengte"
                    description="Maximale lengte van een antwoord. Korter = goedkoper."
                  >
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
                    <Switch
                      on={settings.demoMode}
                      onToggle={() => update({ demoMode: !settings.demoMode })}
                    />
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
        </div>
      </div>
    </div>
  );
}
