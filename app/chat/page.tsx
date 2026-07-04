"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import AppShell, { CHATS_UPDATED_EVENT } from "@/components/AppShell";
import type { ChatMessage } from "@/lib/chatStore";
import { useGreeting } from "@/lib/greeting";

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
}: {
  message: ChatMessage;
  isLast: boolean;
  busy: boolean;
  onRegenerate: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-emerald-600/30 dark:border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="group">
      <div className="min-w-0 max-w-[92%]">
        <div className="markdown text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
          {message.content ? (
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
          ) : (
            <span className="inline-flex gap-1.5 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </span>
          )}
        </div>
        {message.content && !busy && (
          <div className="mt-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={message.content} />
            {isLast && (
              <button
                onClick={onRegenerate}
                className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
              >
                ↻ Genereer opnieuw
              </button>
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    if (!chatId && !busy) setMessages([]);
  }

  // Laad bestaande chat bij selectie in de sidebar.
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled && !abortRef.current) setMessages(data.chat.messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string, opts?: { regenerate?: boolean }) {
    const trimmed = text.trim();
    if ((!trimmed && !opts?.regenerate) || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((prev) =>
      opts?.regenerate
        ? [...prev.slice(0, -1), { role: "assistant", content: "" }]
        : [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]
    );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts?.regenerate ? { chatId, regenerate: true } : { chatId, message: trimmed }
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

  const empty = messages.length === 0;
  const greeting = useGreeting();

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
        className={`flex items-end gap-2 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] focus-within:border-emerald-400/50 ${
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
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
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
        <h1
          key={greeting}
          className="animate-fade-up min-h-[44px] text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl"
        >
          {greeting}
        </h1>
        <div className="mt-8 w-full">{composer}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-slate-900/10 dark:border-white/10 px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 transition hover:border-emerald-400/40 hover:text-slate-800 dark:hover:text-slate-200"
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
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              isLast={i === messages.length - 1}
              busy={busy}
              onRegenerate={() => send("", { regenerate: true })}
            />
          ))}
          <div ref={bottomRef} />
        </div>
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
