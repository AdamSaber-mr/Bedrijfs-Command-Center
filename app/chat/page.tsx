"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import AppShell, { CHATS_UPDATED_EVENT } from "@/components/AppShell";
import type { ChatMessage } from "@/lib/chatStore";
import type { PromptTemplate } from "@/lib/promptStore";
import { MODEL_OPTIONS } from "@/lib/settingsShared";
import { useGreeting } from "@/lib/greeting";
import { useTypewriter } from "@/lib/animation";

// Korte weergavenaam: "Claude Opus 4.8" → "Opus 4.8".
function shortModelLabel(id: string) {
  const label = MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id;
  return label.replace(/^Claude\s+/, "");
}

// Modelkeuze per gesprek, zoals Claude's selector in de chatbalk.
function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-scale-in absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-slate-900/10 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/50">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                aria-pressed={value === m.id}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                  value === m.id
                    ? "bg-accent-500/10"
                    : "hover:bg-slate-900/5 dark:hover:bg-white/5"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                    {shortModelLabel(m.id)}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {m.description}
                  </span>
                </span>
                {value === m.id && (
                  <span className="ml-auto mt-0.5 text-accent-600 dark:text-accent-400">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Model kiezen voor dit gesprek"
        className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
      >
        {shortModelLabel(value)}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function TemplatesButton({
  currentInput,
  onInsert,
}: {
  currentInput: string;
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[] | null>(null);
  const [newTitle, setNewTitle] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      setPrompts(data.prompts ?? []);
    } catch {
      setPrompts([]);
    }
  }

  function toggle() {
    setOpen((o) => !o);
    setNewTitle(null);
    if (!prompts) load();
  }

  async function saveCurrent() {
    if (!newTitle?.trim() || !currentInput.trim()) return;
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, text: currentInput }),
    });
    setNewTitle(null);
    load();
  }

  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-scale-in absolute bottom-full right-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-slate-900/10 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#0d1526] dark:shadow-black/50">
            <p className="border-b border-slate-900/10 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-slate-500">
              Prompt-sjablonen
            </p>
            <div className="max-h-56 overflow-y-auto p-1.5">
              {prompts === null && (
                <p className="px-2.5 py-3 text-xs text-slate-400">Laden…</p>
              )}
              {prompts !== null && prompts.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-slate-400 dark:text-slate-500">
                  Nog geen sjablonen. Typ iets in het invoerveld en sla het hieronder op.
                </p>
              )}
              {(prompts ?? []).map((p) => (
                <div key={p.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => {
                      onInsert(p.text);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-accent-500/10 dark:text-slate-300"
                  >
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                      {p.text}
                    </span>
                  </button>
                  <button
                    aria-label="Verwijder sjabloon"
                    onClick={async () => {
                      await fetch(`/api/prompts/${p.id}`, { method: "DELETE" });
                      load();
                    }}
                    className="hidden shrink-0 rounded p-1 text-slate-400 hover:text-red-500 group-hover:block dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {currentInput.trim().length > 0 && (
              <div className="border-t border-slate-900/10 p-2 dark:border-white/10">
                {newTitle === null ? (
                  <button
                    onClick={() => setNewTitle("")}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-accent-700 transition hover:bg-accent-500/10 dark:text-accent-300"
                  >
                    ＋ Huidige invoer opslaan als sjabloon
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
                      placeholder="Naam van het sjabloon…"
                      className="w-full rounded-lg border border-slate-900/15 bg-transparent px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent-400/50 focus:outline-none dark:border-white/15 dark:text-white"
                    />
                    <button
                      onClick={saveCurrent}
                      disabled={!newTitle.trim()}
                      className="shrink-0 rounded-lg bg-accent-500 px-2.5 py-1.5 text-xs font-semibold text-accent-950 transition hover:bg-accent-400 disabled:opacity-40"
                    >
                      Opslaan
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={toggle}
        title="Prompt-sjablonen"
        aria-label="Prompt-sjablonen"
        className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm transition active:scale-95 ${
          open
            ? "border-accent-400/50 text-accent-700 dark:text-accent-300"
            : "border-slate-900/15 text-slate-500 hover:border-accent-400/40 hover:text-slate-800 dark:border-white/15 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        ✦
      </button>
    </div>
  );
}

const SUGGESTIONS = [
  "Schrijf een professionele e-mail",
  "Trends in Nederlandse e-commerce",
  "Maak een SWOT-analyse",
  "Help me een verdienmodel kiezen",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard niet beschikbaar (bv. http zonder permissie) — knop doet dan niets
    }
  }

  return (
    <button
      onClick={copy}
      className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
    >
      {copied ? "✓ Gekopieerd" : "⧉ Kopieer"}
    </button>
  );
}

function MessageBubble({
  message,
  isLast,
  busy,
  onRegenerate,
  onEdit,
}: {
  message: ChatMessage;
  isLast: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="animate-message-in group flex flex-col items-end">
        <div
          title={
            message.at
              ? new Date(message.at).toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined
          }
          className="max-w-[85%] rounded-2xl rounded-br-md border border-accent-600/30 dark:border-accent-500/25 bg-accent-500/10 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100"
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {!busy && (
          <button
            onClick={onEdit}
            className="mt-1 rounded-md px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-slate-900/5 hover:text-slate-700 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
          >
            ✎ Bewerk
          </button>
        )}
      </div>
    );
  }
  const streaming = busy && isLast && message.content.length > 0;

  return (
    <div className="animate-message-in group">
      <div className="min-w-0 max-w-[92%]">
        <div className="markdown text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
          {message.content ? (
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
          ) : (
            <span className="inline-flex gap-1.5 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-accent-400"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </span>
          )}
        </div>
        {streaming && (
          <span className="animate-blink mt-1 inline-block h-4 w-[2px] rounded bg-accent-400" />
        )}
        {message.content && !busy && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={message.content} />
            {isLast && (
              <button
                onClick={onRegenerate}
                className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
              >
                ↻ Genereer opnieuw
              </button>
            )}
            {message.at && (
              <span className="px-2 text-[11px] tabular-nums text-slate-400 dark:text-slate-600">
                {new Date(message.at).toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chat");
  const initialQuestion = searchParams.get("q");
  const draft = searchParams.get("draft");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Modelkeuze: null = standaard uit Instellingen; anders per-chat override.
  const [model, setModel] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState(MODEL_OPTIONS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  // Reset direct tijdens de render wanneer de chat-selectie wijzigt
  // (sidebar-klik of "Nieuwe chat"), zonder tussenrender met oude inhoud.
  const [prevChatId, setPrevChatId] = useState(chatId);
  if (prevChatId !== chatId) {
    setPrevChatId(chatId);
    setError("");
    if (!chatId && !busy) {
      setMessages([]);
      setModel(null);
    }
  }

  // Standaardmodel uit Instellingen, voor de weergave in de modelkiezer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (!cancelled && data.settings?.model) setDefaultModel(data.settings.model);
      } catch {
        // standaard blijft dan de eerste optie
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Laad bestaande chat bij selectie in de sidebar.
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled && !abortRef.current) {
        setMessages(data.chat.messages);
        setModel(data.chat.model ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Alleen automatisch meescrollen als de gebruiker (bijna) onderaan staat.
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function send(text: string, opts?: { regenerate?: boolean; replaceFrom?: number }) {
    const trimmed = text.trim();
    if ((!trimmed && !opts?.regenerate) || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    setEditing(null);
    setAtBottom(true);
    setMessages((prev) => {
      if (opts?.regenerate) return [...prev.slice(0, -1), { role: "assistant", content: "" }];
      const base = opts?.replaceFrom !== undefined ? prev.slice(0, opts.replaceFrom) : prev;
      return [...base, { role: "user", content: trimmed }, { role: "assistant", content: "" }];
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts?.regenerate
            ? { chatId, regenerate: true, model: model ?? undefined }
            : { chatId, message: trimmed, replaceFrom: opts?.replaceFrom, model: model ?? undefined }
        ),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Er ging iets mis");
      }

      const newChatId = res.headers.get("X-Chat-Id");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }

      window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
      if (newChatId && newChatId !== chatId) {
        router.replace(`/chat?chat=${newChatId}`, { scroll: false });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Gestopt door de gebruiker — het gedeeltelijke antwoord blijft staan
        // en is server-side opgeslagen.
        window.dispatchEvent(new Event(CHATS_UPDATED_EVENT));
      } else {
        // Verwijder de lege assistent-bubbel bij een fout
        setMessages((prev) =>
          prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev
        );
        setError(err instanceof Error ? err.message : "Er ging iets mis");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  // Vraag meegekregen vanaf het dashboard (?q=…): direct versturen.
  useEffect(() => {
    if (initialQuestion && !chatId && !autoSentRef.current) {
      autoSentRef.current = true;
      send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, chatId]);

  // Sjabloon meegekregen via ⌘K (?draft=…): zet het klaar in het invoerveld.
  function applyDraft(text: string) {
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  useEffect(() => {
    if (draft && !autoSentRef.current) {
      autoSentRef.current = true;
      applyDraft(draft);
    }
  }, [draft]);

  const empty = messages.length === 0;
  const { greeting, tagline } = useGreeting();
  const typed = useTypewriter(greeting);

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className="w-full"
    >
      {error && (
        <p className="mb-3 rounded-xl border border-red-600/30 dark:border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div
        className={`flex items-end gap-2 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] focus-within:border-accent-400/50 ${
          empty ? "p-2.5" : "p-2"
        }`}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={empty ? "Hoe kan ik je vandaag helpen?" : "Stel een vraag…"}
          rows={Math.min(6, Math.max(1, input.split("\n").length))}
          autoFocus
          className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
        />
        <ModelPicker value={model ?? defaultModel} onChange={setModel} />
        <TemplatesButton
          currentInput={input}
          onInsert={(text) => {
            setInput(text);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        />
        {busy ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop met genereren"
            className="shrink-0 rounded-xl border border-slate-900/15 dark:border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-red-400/50 hover:text-red-600 dark:hover:text-red-400"
          >
            ◼
          </button>
        ) : (
          <button
            type="submit"
            disabled={input.trim().length === 0}
            aria-label="Verstuur"
            className="shrink-0 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↑
          </button>
        )}
      </div>
    </form>
  );

  if (empty) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-6 pb-24">
        <h1 className="min-h-[44px] text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
          {typed.display}
          {greeting && !typed.done && (
            <span className="animate-blink ml-1 inline-block h-[0.85em] w-[3px] rounded bg-accent-400 align-baseline" />
          )}
        </h1>
        <p
          className={`mt-2 min-h-[24px] text-center text-[15px] text-slate-500 transition-opacity duration-500 dark:text-slate-400 ${
            typed.done ? "opacity-100" : "opacity-0"
          }`}
        >
          {tagline}
        </p>
        <div className="animate-fade-up mt-7 w-full" style={{ animationDelay: "0.15s" }}>
          {composer}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="animate-fade-up rounded-full border border-slate-900/10 dark:border-white/10 px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition hover:-translate-y-0.5 hover:border-accent-400/40 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95"
              style={{ animationDelay: `${0.3 + i * 0.07}s` }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }}
          className="h-full overflow-y-auto"
        >
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
            {chatId && (
              <div className="flex justify-end">
                <a
                  href={`/api/chats/${chatId}/markdown`}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
                >
                  ⇩ Exporteer als Markdown
                </a>
              </div>
            )}
            {messages.map((m, i) =>
              editing?.index === i ? (
                <div key={i} className="animate-message-in flex justify-end">
                  <div className="w-full max-w-[85%] rounded-2xl border border-accent-400/50 bg-white p-2 dark:bg-white/[0.04]">
                    <textarea
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ index: i, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send(editing.text, { replaceFrom: i });
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      rows={Math.min(8, Math.max(2, editing.text.split("\n").length))}
                      className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] text-slate-900 focus:outline-none dark:text-white"
                    />
                    <div className="flex justify-end gap-2 px-1 pb-1">
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Annuleer
                      </button>
                      <button
                        onClick={() => send(editing.text, { replaceFrom: i })}
                        disabled={editing.text.trim().length === 0}
                        className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-accent-950 transition hover:bg-accent-400 active:scale-95 disabled:opacity-40"
                      >
                        Opslaan & opnieuw
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <MessageBubble
                  key={i}
                  message={m}
                  isLast={i === messages.length - 1}
                  busy={busy}
                  onRegenerate={() => send("", { regenerate: true })}
                  onEdit={() => setEditing({ index: i, text: m.content })}
                />
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {!atBottom && (
          <button
            onClick={() => {
              setAtBottom(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            aria-label="Scroll naar beneden"
            className="animate-fade-in absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-900/15 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-lg shadow-slate-900/10 transition hover:border-accent-400/50 hover:text-slate-900 active:scale-95 dark:border-white/15 dark:bg-[#0d1526] dark:text-slate-300 dark:shadow-black/40 dark:hover:text-white"
          >
            ↓ Nieuwste bericht
          </button>
        )}
      </div>

      <div className="px-4 pb-4 sm:px-6">
        <div className="mx-auto max-w-3xl">{composer}</div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <AppShell>
        <ChatView />
      </AppShell>
    </Suspense>
  );
}
