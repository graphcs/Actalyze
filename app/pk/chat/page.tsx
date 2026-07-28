"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Square, RotateCcw, Library, Quote } from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";

/**
 * The legislative assistant.
 *
 * Two things here are Pakistan-specific rather than cosmetic:
 *
 *  1. An answer's direction follows the answer, not the interface. Someone reading the
 *     UI in English can still ask in Urdu, and that reply has to render right-to-left
 *     in Nastaliq while the chrome around it stays left-to-right. So each bubble
 *     carries its own `dir`, derived from the script the model actually replied in.
 *  2. Citation markers are isolated. `[1]` sitting inside Urdu prose is a Latin-script
 *     run in an RTL paragraph; without a bidi isolate the bracket can render on the
 *     wrong side of the digit, which reads as a typo to a native reader and as nothing
 *     at all to everyone else.
 */

interface Source {
  index: number;
  title: string;
  jurisdiction: string | null;
  year: number | null;
  relevance: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set once the stream completes; until then it is inferred from the text so far. */
  language?: "Urdu" | "English";
  sources?: Source[];
  failed?: boolean;
}

const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const isUrdu = (text: string) => URDU_SCRIPT.test(text);

const SUGGESTIONS: MessageKey[] = [
  "chat.suggestion1",
  "chat.suggestion2",
  "chat.suggestion4",
  "chat.suggestion5",
];

/**
 * Minimal renderer for what the model emits: paragraphs, `**bold**` and `[n]` citation
 * chips. Deliberately not a markdown library — the answer format is fixed by the system
 * prompt, and a full parser would be several hundred kilobytes to render three things.
 */
function AnswerBody({ text, urdu }: { text: string; urdu: boolean }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);

  return (
    <div
      dir={urdu ? "rtl" : "ltr"}
      className={urdu ? "urdu-prose space-y-3" : "space-y-3"}
    >
      {blocks.map((block, bi) => (
        <p key={bi} className="text-start whitespace-pre-wrap leading-relaxed">
          {block.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g).map((piece, pi) => {
            if (/^\*\*[^*]+\*\*$/.test(piece)) {
              return (
                <strong key={pi} className="font-semibold">
                  {piece.slice(2, -2)}
                </strong>
              );
            }
            if (/^\[\d{1,2}\]$/.test(piece)) {
              return (
                <Ltr key={pi} className="inline-flex items-center align-baseline mx-0.5 px-1.5 rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-[11px] font-semibold">
                  {piece.slice(1, -1)}
                </Ltr>
              );
            }
            return <span key={pi}>{piece}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

export default function PkChatPage() {
  const { t, locale } = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: text };
      const assistantId = `a-${Date.now()}`;

      // Snapshot the history before the optimistic update — the route wants the
      // exchange so far, not the turn currently being sent.
      const history = messages.map(({ role, content }) => ({ role, content }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setInput("");
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: Message) => Message) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        const res = await fetch("/api/pk/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          patch((m) => ({ ...m, content: t("chat.rateLimited"), failed: true }));
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // SSE frames are newline-delimited but arrive on arbitrary chunk boundaries, so
        // hold the tail back until a blank line proves the frame is whole.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;

            try {
              const data = JSON.parse(payload);
              if (data.content) {
                patch((m) => ({ ...m, content: m.content + data.content }));
              } else if (data.done) {
                patch((m) => ({ ...m, language: data.language, sources: data.sources }));
              } else if (data.error) {
                patch((m) => ({ ...m, content: t("chat.failed"), failed: true }));
              }
            } catch {
              // A partial frame that slipped through; the next read completes it.
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          patch((m) => ({
            ...m,
            content: m.content || t("chat.failed"),
            failed: !m.content,
          }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, t]
  );

  const empty = messages.length === 0;

  return (
    <PkAppLayout>
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-16 flex flex-col min-h-[calc(100vh-3.5rem)]">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {t("chat.title")}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl urdu-prose">
                {t("chat.subtitle")}
              </p>
            </div>
            {!empty && (
              <button
                onClick={() => setMessages([])}
                className="shrink-0 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("chat.clear")}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span className="max-w-xl">{t("chat.groundingNote")}</span>
            <Link
              href="/pk/documents"
              className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 hover:underline"
            >
              <Library className="w-3.5 h-3.5" />
              {t("chat.browseLibrary")}
            </Link>
          </div>
        </header>

        <div className="flex-1 space-y-6">
          {empty && (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6">
              <h2 className="font-semibold mb-1">{t("chat.emptyTitle")}</h2>
              <p className="text-sm text-zinc-500 mb-4">{t("chat.answerLanguageNote")}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    onClick={() => ask(t(key))}
                    dir={isUrdu(t(key)) ? "rtl" : "ltr"}
                    className="text-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm hover:border-green-600 hover:shadow-sm transition"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            // Direction follows the message, not the interface: an Urdu answer must
            // render RTL even when someone is reading the UI in English.
            const urdu = m.language ? m.language === "Urdu" : isUrdu(m.content);

            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div
                    dir={isUrdu(m.content) ? "rtl" : "ltr"}
                    className="max-w-[85%] rounded-2xl bg-green-700 text-white px-4 py-2.5 text-sm text-start whitespace-pre-wrap"
                  >
                    {m.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                  {t("chat.assistant")}
                </div>
                <div
                  className={`rounded-2xl border px-5 py-4 text-sm ${
                    m.failed
                      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  {m.content ? (
                    <AnswerBody text={m.content} urdu={urdu} />
                  ) : (
                    <span className="text-zinc-400">{t("chat.thinking")}</span>
                  )}
                </div>

                {m.sources && m.sources.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
                      <Quote className="w-3 h-3" />
                      {t("chat.sourcesUsed")}
                    </div>
                    <ul className="space-y-1.5">
                      {m.sources.map((s) => (
                        <li key={s.index} className="flex items-start gap-2 text-xs">
                          <Ltr className="mt-0.5 shrink-0 w-5 h-5 grid place-items-center rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-semibold">
                            {s.index}
                          </Ltr>
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {s.title}
                            {s.jurisdiction && (
                              <span className="text-zinc-400 ms-2">
                                <Ltr>{s.jurisdiction}</Ltr>
                              </span>
                            )}
                            {/* A year is a label, not a quantity — `LtrNumber` would
                                render 1973 as "1,973". */}
                            {s.year && (
                              <span className="text-zinc-400 ms-2">
                                <Ltr>{String(s.year)}</Ltr>
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.sources && m.sources.length === 0 && !m.failed && (
                  <p className="text-xs text-zinc-400">{t("chat.noSources")}</p>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="sticky bottom-0 mt-8 bg-gradient-to-t from-white dark:from-zinc-950 pt-4 no-print"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={2}
              // The field mirrors as the typist types, so someone switching to Urdu
              // mid-session does not fight a left-aligned caret.
              dir={input && isUrdu(input) ? "rtl" : locale === "ur" ? "rtl" : "ltr"}
              placeholder={t("chat.placeholder")}
              className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800 px-4 py-3 text-sm font-medium flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                {t("chat.stop")}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="shrink-0 rounded-xl bg-green-700 text-white px-4 py-3 text-sm font-medium flex items-center gap-2 disabled:opacity-40 hover:bg-green-800 transition"
              >
                {/* The paper plane points forward, so it mirrors with the writing
                    direction rather than staying pinned to the right. */}
                <Send className="w-4 h-4 rtl:-scale-x-100" />
                {t("chat.send")}
              </button>
            )}
          </div>
        </form>
      </div>
    </PkAppLayout>
  );
}
