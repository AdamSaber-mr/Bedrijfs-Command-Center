"use client";

import { Suspense, useEffect, useState } from "react";
import AppShell, { CHATS_UPDATED_EVENT } from "@/components/AppShell";
import {
  DEFAULT_SETTINGS,
  MAX_TOKENS_OPTIONS,
  MODEL_OPTIONS,
  type Settings,
} from "@/lib/settingsShared";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function RadioCard({
  checked,
  onSelect,
  label,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        checked
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-emerald-400/40"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
            checked
              ? "border-emerald-500 bg-emerald-500"
              : "border-slate-400 dark:border-slate-500"
          }`}
        />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
      </span>
      <span className="mt-1 block pl-6 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </span>
    </button>
  );
}

function SettingsView() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    alert(`${data.deleted} chat(s) verwijderd.`);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Instellingen
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Wijzigingen worden direct opgeslagen en gelden voor alle nieuwe berichten.
          </p>
        </div>
        <span
          aria-live="polite"
          className={`shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
        >
          ✓ Opgeslagen
        </span>
      </header>

      <Section
        title="AI-model"
        description="Bepaalt kwaliteit én kosten per bericht. De Deal Research-tool gebruikt altijd Opus voor maximale kwaliteit."
      >
        <div className="space-y-2.5">
          {MODEL_OPTIONS.map((m) => (
            <RadioCard
              key={m.id}
              checked={settings.model === m.id}
              onSelect={() => update({ model: m.id })}
              label={m.label}
              description={m.description}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Antwoordlengte"
        description="Maximale lengte van een antwoord. Korter = goedkoper."
      >
        <div className="grid gap-2.5 sm:grid-cols-3">
          {MAX_TOKENS_OPTIONS.map((o) => (
            <RadioCard
              key={o.value}
              checked={settings.maxTokens === o.value}
              onSelect={() => update({ maxTokens: o.value })}
              label={o.label}
              description={o.description}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Eigen instructies"
        description="Wordt bij elk chatbericht aan de AI meegegeven — bijvoorbeeld je rol, schrijfstijl of vaste context. Max 2000 tekens."
      >
        <textarea
          value={settings.customInstructions}
          onChange={(e) =>
            setSettings((s) => ({ ...s, customInstructions: e.target.value.slice(0, 2000) }))
          }
          onBlur={() => update({ customInstructions: settings.customInstructions })}
          placeholder={"Bijv.: Ik ben student en bouw aan een portfolio van AI-projecten. Antwoord praktisch, met concrete voorbeelden."}
          rows={4}
          className="w-full resize-y rounded-xl border border-slate-900/15 dark:border-white/15 bg-slate-50 dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
        />
        <p className="mt-1.5 text-right text-xs text-slate-400 dark:text-slate-600">
          {settings.customInstructions.length}/2000
        </p>
      </Section>

      <Section
        title="API-verbinding"
        description="De Anthropic API-sleutel staat lokaal in .env.local en is hier bewust niet zichtbaar of aanpasbaar."
      >
        <div className="flex items-center gap-2.5 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              apiKeyConfigured === null
                ? "bg-slate-400"
                : apiKeyConfigured
                  ? "bg-emerald-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-slate-700 dark:text-slate-300">
            {apiKeyConfigured === null
              ? "Controleren…"
              : apiKeyConfigured
                ? "API-sleutel geconfigureerd"
                : "Geen API-sleutel gevonden — voeg ANTHROPIC_API_KEY toe aan .env.local"}
          </span>
        </div>
      </Section>

      <Section
        title="Data & trainingsdata"
        description="Chats worden lokaal opgeslagen in data/chats/ en blijven privé (staat in .gitignore)."
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/export"
            className="rounded-xl border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20"
          >
            ⇩ Exporteer als JSONL
          </a>
          <button
            onClick={deleteAllChats}
            onMouseLeave={() => setConfirmDelete(false)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              confirmDelete
                ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-300"
                : "border-red-600/30 dark:border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300 hover:bg-red-500/10"
            }`}
          >
            {confirmDelete ? "Klik nogmaals om definitief te wissen" : "Alle chats verwijderen"}
          </button>
          <span className="text-xs text-slate-500">
            {chatCount === null ? "…" : `${chatCount} ${chatCount === 1 ? "chat" : "chats"} opgeslagen`}
          </span>
        </div>
      </Section>
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
