"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import AppShell, { CHATS_UPDATED_EVENT } from "@/components/AppShell";
import type { ChatMessage } from "@/lib/chatStore";

const SUGGESTIONS = [
  "Schrijf een professionele e-mail naar een potentiële partner",
  "Wat zijn de grootste trends in de Nederlandse e-commerce?",
  "Help me een SWOT-analyse maken voor mijn bedrijfsidee",
  "Leg uit hoe ik een goed verdienmodel kies",
];

function MessageBubble({ message }: { message: ChatMessage }) {
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
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        AI
      </div>
      <div className="markdown min-w-0 max-w-[85%] text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
        {message.content ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
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
    </div>
  );
}

function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chat");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Laad bestaande chat bij selectie in de sidebar; leeg bij "Nieuwe chat".
  useEffect(() => {
    setError("");
    if (!chatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setMessages(data.chat.messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: trimmed }),
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
        router.replace(`/?chat=${newChatId}`, { scroll: false });
      }
    } catch (err) {
      // Verwijder de lege assistent-bubbel bij een fout
      setMessages((prev) =>
        prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev
      );
      setError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="animate-fade-up mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
            <span className="rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-700 dark:text-emerald-300">
              Aangedreven door Claude
            </span>
            <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              Waarmee kan ik je <span className="text-emerald-600 dark:text-emerald-400">helpen</span>?
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Elke chat wordt automatisch opgeslagen en is via de sidebar te
              exporteren als trainingsdata voor je eigen model.
            </p>
            <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-300 transition hover:border-emerald-400/40 hover:text-slate-900 dark:hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-900/10 dark:border-white/10 bg-slate-50/80 dark:bg-black/20 px-4 py-4 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto max-w-3xl"
        >
          {error && (
            <p className="mb-3 rounded-xl border border-red-600/30 dark:border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex items-end gap-3 rounded-2xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-white/[0.04] p-2 focus-within:border-emerald-400/50">
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
              placeholder="Stel een vraag… (Enter om te versturen)"
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              autoFocus
              className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "…" : "Verstuur"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-600">
            Chats worden lokaal opgeslagen in <code>data/chats/</code> en zijn exporteerbaar als JSONL-trainingsdata
          </p>
        </form>
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
