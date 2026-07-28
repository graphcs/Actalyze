"use client";

/**
 * Question hour — the record of what the National Assembly has already been asked.
 *
 * The drafting screen at /pk/instruments can write a starred question and test it
 * against twenty-one of Rule 78's twenty-two conditions. It cannot test condition (j):
 *
 *   "It shall not repeat in substance questions admitted for the same session, or
 *    already answered or disallowed by the Speaker, or to which an answer was refused in
 *    the Assembly during the last two sessions."
 *
 * That one is not a judgement about the draft — it is a fact about the record, and the
 * record is a set of thirty-to-forty megabyte PDFs on na.gov.pk with no index and no
 * search. This page is that record made searchable, which is what turns the drafting
 * tool from a demonstration into something a member's office opens before every notice
 * goes in.
 *
 * ── Three things it does, in the order an office needs them ───────────────────────
 *  1. Search — subject, Division or member, showing the question, the Ministry's reply
 *     and a link to the paper it came from.
 *  2. By Division — which Divisions attract the questions. The Assembly publishes the
 *     papers and never aggregates them, so this number does not exist anywhere else.
 *  3. Has this been asked? — a draft against the record, with the terms that matched.
 *
 * ── Interface notes ───────────────────────────────────────────────────────────────
 * Logical properties throughout (`ms-`, `ps-`, `text-start`, `border-s`) so the whole
 * screen mirrors when the locale flips. Every question number, date, percentage and
 * Latin proper noun is wrapped in <Ltr>, because a bare "Q115" or "11 June 2026" beside
 * Urdu prose is reordered by the bidi algorithm.
 *
 * Question and reply text is left in the language it was published in — these papers are
 * English — and is never machine-translated, because a translated reply attributed to a
 * named Minister is a fabricated quotation. Only the interface follows the locale.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  FileWarning,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  Star,
  Table2,
} from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr, LtrNumber } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";

// ─────────────────────────────────────────────────────────────────────────────────────
// API shapes
//
// Declared here rather than imported from lib/pk/question-papers.ts on purpose: that
// module imports the 1.8 MB index, and a value import from a client component would put
// the whole thing in the browser bundle. Types would be erased, but the import is easy
// to widen by accident later.
// ─────────────────────────────────────────────────────────────────────────────────────

interface QuestionRecord {
  id: string;
  session: string;
  sessionNumber: number | null;
  date: string | null;
  dateLabel: string;
  pdfUrl: string;
  number: number;
  starred: boolean;
  listing: string;
  asker: string;
  deferredFrom: string | null;
  ministry: string | null;
  division: string | null;
  answeredBy: string | null;
  question: string;
  reply: string;
  hasReply: boolean;
  replyStatus: "answered" | "not-received" | "deferred" | "not-extracted";
  replyIsTabular: boolean;
  fontArtifact?: boolean;
}

interface SearchHit {
  record: QuestionRecord;
  score: number;
  matchedTerms: string[];
}

interface Sitting {
  id: string;
  session: string;
  dateLabel: string;
  date: string | null;
  pdfUrl: string;
  pages: number;
  questionCount: number;
  replyCount: number;
  encodingRepaired?: boolean;
}

interface Coverage {
  generatedAt: string;
  source: string;
  tenure: string;
  sittingsIngested: number;
  sittingsListed: number;
  sessionsInArchive: number;
  questionCount: number;
  replyCount: number;
  sittings: Sitting[];
  skipped: Array<{ session: string; date: string; pdfUrl: string; reason: string }>;
}

interface MinistryStat {
  ministry: string;
  questions: number;
  starred: number;
  unstarred: number;
  answered: number;
  members: number;
}

interface SimilarQuestion {
  record: QuestionRecord;
  similarity: number;
  sharedTerms: string[];
  sameMinistry: boolean;
  withinRule78jWindow: boolean;
}

interface DuplicateCheck {
  risk: "likely" | "possible" | "unlikely";
  topSimilarity: number;
  matches: SimilarQuestion[];
  queryTerms: string[];
  citation: string;
}

type Tab = "search" | "ministries" | "check" | "coverage";

const TABS: Array<{ id: Tab; key: MessageKey; Icon: typeof Search }> = [
  { id: "search", key: "questions.tabSearch", Icon: Search },
  { id: "ministries", key: "questions.tabMinistries", Icon: BarChart3 },
  { id: "check", key: "questions.tabCheck", Icon: ShieldCheck },
  { id: "coverage", key: "questions.tabCoverage", Icon: Info },
];

// ─────────────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3">
      <div className="text-xl font-bold">
        <LtrNumber value={value} />
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

/**
 * One question and its reply.
 *
 * The reply is collapsed by default. Some run to twelve thousand characters of tables,
 * and a page of those between every question makes the record unreadable — but a reply
 * that is hidden entirely is the same failure as not extracting it, so the toggle says
 * how long it is and the status is always visible.
 */
function QuestionCard({
  hit,
  t,
  defaultOpen = false,
}: {
  hit: { record: QuestionRecord; matchedTerms?: string[] };
  t: (k: MessageKey) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = hit.record;

  const statusKey: MessageKey | null =
    q.replyStatus === "not-received"
      ? "questions.replyNotReceived"
      : q.replyStatus === "deferred"
        ? "questions.replyDeferred"
        : q.replyStatus === "not-extracted"
          ? "questions.replyNotExtracted"
          : null;

  return (
    <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
              q.starred
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {q.starred && <Star className="w-3 h-3" />}
            {t(q.starred ? "questions.starredShort" : "questions.unstarredShort")}
          </span>

          <span className="text-xs text-zinc-500">
            {t("questions.questionNo")} <Ltr className="font-semibold text-zinc-700 dark:text-zinc-300">{String(q.number)}</Ltr>
          </span>

          <span className="text-xs text-zinc-500">
            <Ltr>{q.session}</Ltr>
          </span>
          <span className="text-xs text-zinc-500">
            <Ltr>{q.dateLabel}</Ltr>
          </span>

          {q.deferredFrom && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {t("questions.deferredFrom")} <Ltr>{q.deferredFrom}</Ltr>
            </span>
          )}
        </div>

        {q.ministry && (
          <div className="text-sm font-semibold text-green-800 dark:text-green-400 text-start mb-1">
            <Ltr>{q.ministry}</Ltr>
            {q.division && (
              <span className="text-zinc-500 font-normal">
                {" — "}
                <Ltr>{q.division}</Ltr>
              </span>
            )}
          </div>
        )}

        <div className="text-xs text-zinc-500 mb-3">
          {t("questions.askedBy")}{" "}
          <Ltr className="text-zinc-700 dark:text-zinc-300">{q.asker}</Ltr>
          {q.answeredBy && (
            <>
              {" · "}
              {t("questions.answeredBy")}{" "}
              <Ltr className="text-zinc-700 dark:text-zinc-300">{q.answeredBy}</Ltr>
            </>
          )}
        </div>

        {/* Published in English. Forced LTR so it cannot be reflowed by an Urdu shell. */}
        <p
          dir="ltr"
          className="text-sm leading-relaxed text-start whitespace-pre-wrap text-zinc-800 dark:text-zinc-200"
        >
          {q.question}
        </p>

        {q.fontArtifact && (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-500 mt-2">
            <FileWarning className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{t("questions.replyNotExtracted")}</span>
          </p>
        )}

        {hit.matchedTerms && hit.matchedTerms.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-[10px] text-zinc-400">{t("questions.matchedOn")}</span>
            {hit.matchedTerms.map((term) => (
              <span
                key={term}
                className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-400"
              >
                <Ltr>{term}</Ltr>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {q.hasReply ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-800 dark:text-green-400 hover:underline"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              {t(open ? "questions.hideReply" : "questions.showReply")}
              <span className="text-zinc-400 font-normal">
                <LtrNumber value={q.reply.length} /> {t("questions.chars")}
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              {statusKey ? t(statusKey) : t("questions.replyNotExtracted")}
            </span>
          )}

          <a
            href={q.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-green-700 dark:hover:text-green-400"
          >
            <ArrowUpRight className="w-3 h-3" />
            {t("questions.openPaper")}
          </a>
        </div>

        {open && q.hasReply && (
          <div className="mt-3">
            {q.replyIsTabular && (
              <p className="flex items-start gap-1.5 text-[11px] text-zinc-500 mb-2">
                <Table2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>{t("questions.replyTabular")}</span>
              </p>
            )}
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
              {t("questions.reply")}
            </div>
            <pre
              dir="ltr"
              className="text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans text-start text-zinc-700 dark:text-zinc-300 max-h-96 overflow-y-auto border-s-2 border-green-700/40 ps-3"
            >
              {q.reply}
            </pre>
          </div>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────────────

export default function PkQuestionsPage() {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("search");

  const [query, setQuery] = useState("");
  const [ministry, setMinistry] = useState("");
  const [member, setMember] = useState("");
  const [session, setSession] = useState("");
  const [starred, setStarred] = useState<"" | "true" | "false">("");

  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [ministries, setMinistries] = useState<MinistryStat[] | null>(null);
  const [facets, setFacets] = useState<{
    ministries: Array<{ ministry: string; questions: number }>;
    members: Array<{ member: string; questions: number }>;
    sessions: Array<{ session: string; sessionId: string; questions: number }>;
  } | null>(null);

  const [draft, setDraft] = useState("");
  const [draftMinistry, setDraftMinistry] = useState("");
  const [draftSession, setDraftSession] = useState("");
  const [check, setCheck] = useState<DuplicateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Facets and coverage are static for the life of the index; fetched once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/pk/questions?view=facets")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setFacets({ ministries: data.ministries, members: data.members, sessions: data.sessions });
        setCoverage(data.coverage);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (query.trim()) params.set("q", query.trim());
      if (ministry) params.set("ministry", ministry);
      if (member) params.set("member", member);
      if (session) params.set("session", session);
      if (starred) params.set("starred", starred);
      const res = await fetch(`/api/pk/questions?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHits(data.hits ?? []);
      setTotal(data.total ?? 0);
      setCoverage(data.coverage ?? null);
      setFailed(false);
    } catch {
      setFailed(true);
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, [query, ministry, member, session, starred]);

  // Debounced: the index is in-process, so a keystroke costs nothing on the wire, but
  // re-rendering twenty-five long records on every character is visible.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSearch();
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runSearch]);

  useEffect(() => {
    if (tab !== "ministries" || ministries) return;
    let cancelled = false;
    fetch("/api/pk/questions?view=ministries")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMinistries(data.ministries ?? []);
      })
      .catch(() => {
        if (!cancelled) setMinistries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, ministries]);

  const runCheck = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/pk/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          ministry: draftMinistry || null,
          sessionNumber: draftSession ? Number(draftSession) : null,
          limit: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCheck(data);
    } catch {
      setCheckError(t("common.error"));
      setCheck(null);
    } finally {
      setChecking(false);
    }
  };

  const maxMinistry = useMemo(
    () => (ministries && ministries.length > 0 ? ministries[0].questions : 1),
    [ministries]
  );

  const hasFilters = Boolean(query || ministry || member || session || starred);
  const prose = locale === "ur" ? "urdu-prose" : "";

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t("questions.title")}
          </h1>
          <p className={`text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl text-start ${prose}`}>
            {t("questions.subtitle")}
          </p>
        </header>

        {coverage && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Stat value={coverage.sittingsIngested} label={t("questions.statSittings")} />
            <Stat value={coverage.questionCount} label={t("questions.statQuestions")} />
            <Stat value={coverage.replyCount} label={t("questions.statReplies")} />
            <Stat value={facets?.ministries.length ?? 0} label={t("questions.statDivisions")} />
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6">
          {TABS.map(({ id, key, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id
                  ? "border-green-700 text-green-800 dark:text-green-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(key)}
            </button>
          ))}
        </div>

        {failed && !hits && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 mb-6">
            {t("questions.loadFailed")}
          </div>
        )}

        {/* ── search ─────────────────────────────────────────────────────────────── */}
        {tab === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-zinc-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("questions.searchPlaceholder")}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 ps-9 pe-3 py-2.5 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
              />
            </div>
            <p className="text-xs text-zinc-500 text-start -mt-2">{t("questions.searchHint")}</p>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start max-w-64"
              >
                <option value="">
                  {t("questions.filterMinistry")} — {t("questions.filterAll")}
                </option>
                {(facets?.ministries ?? []).map((m) => (
                  <option key={m.ministry} value={m.ministry}>
                    {m.ministry} ({m.questions})
                  </option>
                ))}
              </select>

              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start max-w-64"
              >
                <option value="">
                  {t("questions.filterMember")} — {t("questions.filterAll")}
                </option>
                {(facets?.members ?? []).map((m) => (
                  <option key={m.member} value={m.member}>
                    {m.member} ({m.questions})
                  </option>
                ))}
              </select>

              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start"
              >
                <option value="">
                  {t("questions.filterSession")} — {t("questions.filterAll")}
                </option>
                {(facets?.sessions ?? []).map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.session} ({s.questions})
                  </option>
                ))}
              </select>

              <select
                value={starred}
                onChange={(e) => setStarred(e.target.value as "" | "true" | "false")}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start"
              >
                <option value="">
                  {t("questions.filterType")} — {t("questions.filterAll")}
                </option>
                <option value="true">{t("questions.starred")}</option>
                <option value="false">{t("questions.unstarred")}</option>
              </select>

              {hasFilters && (
                <button
                  onClick={() => {
                    setQuery("");
                    setMinistry("");
                    setMember("");
                    setSession("");
                    setStarred("");
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                >
                  {t("questions.clearFilters")}
                </button>
              )}

              <span className="ms-auto text-xs text-zinc-500 inline-flex items-center gap-1.5">
                {searching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <LtrNumber value={total} /> {t("questions.resultsCount")}
              </span>
            </div>

            {hits === null && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
                  />
                ))}
              </div>
            )}

            {hits !== null && hits.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-10 text-center">
                <Search className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="text-sm font-medium">{t("questions.noResults")}</p>
                <p className={`text-xs text-zinc-500 mt-2 max-w-xl mx-auto ${prose}`}>
                  {t("questions.noResultsBody")}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {(hits ?? []).map((hit) => (
                <QuestionCard key={hit.record.id} hit={hit} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* ── by division ────────────────────────────────────────────────────────── */}
        {tab === "ministries" && (
          <div className="space-y-4">
            <p className={`text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl text-start ${prose}`}>
              {t("questions.ministryIntro")}
            </p>

            {ministries === null && (
              <div className="h-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
            )}

            {ministries !== null && ministries.length === 0 && (
              <p className="text-sm text-zinc-500">{t("questions.ministryEmpty")}</p>
            )}

            {ministries !== null && ministries.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                      <th className="text-start font-medium px-4 py-2.5">{t("questions.colDivision")}</th>
                      <th className="text-end font-medium px-3 py-2.5">{t("questions.colQuestions")}</th>
                      <th className="text-end font-medium px-3 py-2.5">{t("questions.colStarred")}</th>
                      <th className="text-end font-medium px-3 py-2.5">{t("questions.colAnswered")}</th>
                      <th className="text-end font-medium px-4 py-2.5">{t("questions.colMembers")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ministries.map((m) => (
                      <tr
                        key={m.ministry}
                        className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                        onClick={() => {
                          setMinistry(m.ministry);
                          setTab("search");
                        }}
                      >
                        <td className="px-4 py-2.5 text-start">
                          {/* A rule under the name rather than a block behind it: at this
                              row height a filled background reads as a text selection,
                              and the Division names are long enough to sit on top of it. */}
                          <div className="relative pb-2">
                            <span>
                              <Ltr>{m.ministry}</Ltr>
                            </span>
                            <div
                              className="absolute bottom-0 start-0 h-1 rounded-full bg-green-600/50 dark:bg-green-500/50"
                              style={{ width: `${Math.max((m.questions / maxMinistry) * 100, 2)}%` }}
                              aria-hidden
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-end font-semibold">
                          <LtrNumber value={m.questions} />
                        </td>
                        <td className="px-3 py-2.5 text-end text-zinc-500">
                          <LtrNumber value={m.starred} />
                        </td>
                        <td className="px-3 py-2.5 text-end text-zinc-500">
                          <LtrNumber value={m.answered} />
                        </td>
                        <td className="px-4 py-2.5 text-end text-zinc-500">
                          <LtrNumber value={m.members} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── has this been asked? ───────────────────────────────────────────────── */}
        {tab === "check" && (
          <div className="space-y-5">
            <div className="rounded-xl border-s-4 border-s-green-700 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
              <div className="text-xs font-semibold text-green-800 dark:text-green-400 mb-1">
                <Ltr>Rule 78(j)</Ltr>
              </div>
              <p className={`text-sm text-zinc-600 dark:text-zinc-400 text-start ${prose}`}>
                {t("questions.checkIntro")}
              </p>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              dir="ltr"
              placeholder={t("questions.checkPlaceholder")}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-start leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-600/40"
            />

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1 text-start">
                  {t("questions.checkMinistry")}
                </label>
                <select
                  value={draftMinistry}
                  onChange={(e) => setDraftMinistry(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start max-w-72"
                >
                  <option value="">—</option>
                  {(facets?.ministries ?? []).map((m) => (
                    <option key={m.ministry} value={m.ministry}>
                      {m.ministry}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1 text-start">
                  {t("questions.checkSession")}
                </label>
                <input
                  value={draftSession}
                  onChange={(e) => setDraftSession(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="28"
                  className="w-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-start"
                />
              </div>

              <button
                onClick={runCheck}
                disabled={draft.trim().length < 12 || checking}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {t(checking ? "questions.checking" : "questions.checkRun")}
              </button>

              {draft.trim().length > 0 && draft.trim().length < 12 && (
                <span className="text-xs text-amber-700">{t("questions.checkTooShort")}</span>
              )}
            </div>

            {checkError && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                {checkError}
              </div>
            )}

            {check && (
              <div className="space-y-4">
                <div
                  className={`rounded-xl border px-5 py-4 ${
                    check.risk === "likely"
                      ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
                      : check.risk === "possible"
                        ? "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40"
                        : "border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {check.risk === "unlikely" ? (
                      <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          check.risk === "likely"
                            ? "text-red-700 dark:text-red-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      />
                    )}
                    <span className="font-semibold text-sm">
                      {t(
                        check.risk === "likely"
                          ? "questions.riskLikely"
                          : check.risk === "possible"
                            ? "questions.riskPossible"
                            : "questions.riskUnlikely"
                      )}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {t("questions.similarity")}{" "}
                      <Ltr className="font-semibold">{`${Math.round(check.topSimilarity * 100)}%`}</Ltr>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/30 text-zinc-600 dark:text-zinc-300">
                      <Ltr>{check.citation}</Ltr>
                    </span>
                  </div>
                  <p className={`text-sm text-start ${prose}`}>
                    {t(
                      check.risk === "likely"
                        ? "questions.riskLikelyBody"
                        : check.risk === "possible"
                          ? "questions.riskPossibleBody"
                          : "questions.riskUnlikelyBody"
                    )}
                  </p>
                </div>

                {check.matches.map((m) => (
                  <div key={m.record.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        <Ltr>{`${Math.round(m.similarity * 100)}%`}</Ltr>
                      </span>
                      {m.sameMinistry && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-400">
                          {t("questions.sameDivision")}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          m.withinRule78jWindow
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {t(m.withinRule78jWindow ? "questions.inWindow" : "questions.outsideWindow")}
                      </span>
                      {m.sharedTerms.length > 0 && (
                        <span className="text-zinc-400">
                          {t("questions.sharedTerms")}:{" "}
                          <Ltr className="text-zinc-600 dark:text-zinc-400">
                            {m.sharedTerms.join(", ")}
                          </Ltr>
                        </span>
                      )}
                    </div>
                    <QuestionCard hit={{ record: m.record }} t={t} />
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  <p className={`flex items-start gap-2 text-xs text-zinc-500 max-w-3xl ${prose}`}>
                    <Info className="w-4 h-4 shrink-0 mt-px" />
                    <span>{t("questions.checkMethod")}</span>
                  </p>
                  <p className={`flex items-start gap-2 text-xs text-zinc-500 max-w-3xl ${prose}`}>
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
                    <span>{t("questions.checkNotAdvice")}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── coverage ───────────────────────────────────────────────────────────── */}
        {tab === "coverage" && coverage && (
          <div className="space-y-6">
            <p className={`text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl text-start ${prose}`}>
              {t("questions.coverageIntro")}
            </p>

            <div className="text-xs text-zinc-500 text-start">
              <Ltr>{coverage.tenure}</Ltr>
              {" · "}
              <a
                href={coverage.source}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-700 dark:hover:text-green-400 underline"
              >
                <Ltr>na.gov.pk</Ltr>
              </a>
            </div>

            <section>
              <h2 className="text-sm font-semibold mb-2 text-start">{t("questions.sittingsTitle")}</h2>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
                {coverage.sittings.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 min-w-48 text-start">
                      <Ltr>{s.session}</Ltr>
                    </span>
                    <span className="text-zinc-500">
                      <Ltr>{s.dateLabel}</Ltr>
                    </span>
                    <span className="text-zinc-500">
                      <LtrNumber value={s.pages} /> {t("questions.pages")}
                    </span>
                    <span className="text-zinc-500">
                      <LtrNumber value={s.questionCount} /> {t("questions.statQuestions")}
                    </span>
                    <span className="text-zinc-500">
                      <LtrNumber value={s.replyCount} /> {t("questions.statReplies")}
                    </span>
                    {s.encodingRepaired && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                        {t("questions.repaired")}
                      </span>
                    )}
                    <a
                      href={s.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-auto inline-flex items-center gap-1 text-zinc-400 hover:text-green-700 dark:hover:text-green-400"
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      {t("questions.openPaper")}
                    </a>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold mb-1 text-start">{t("questions.skippedTitle")}</h2>
              <p className={`text-xs text-zinc-500 mb-2 max-w-3xl text-start ${prose}`}>
                {t("questions.skippedBody")}
              </p>
              {coverage.skipped.length === 0 ? (
                <p className="text-xs text-zinc-500">{t("questions.skippedNone")}</p>
              ) : (
                <div className="space-y-2">
                  {coverage.skipped.map((s) => (
                    <div
                      key={s.pdfUrl}
                      className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <FileWarning className="w-3.5 h-3.5 text-amber-700 dark:text-amber-500" />
                        <span className="font-medium">
                          <Ltr>{s.session}</Ltr>
                        </span>
                        <span className="text-zinc-500">
                          <Ltr>{s.date}</Ltr>
                        </span>
                        <a
                          href={s.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-auto inline-flex items-center gap-1 text-zinc-500 hover:text-green-700 dark:hover:text-green-400"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          {t("questions.openPaper")}
                        </a>
                      </div>
                      {/* The reason is in English because it is a technical finding about a
                          specific file, not interface copy. */}
                      <p dir="ltr" className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200/90 text-start">
                        {s.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </PkAppLayout>
  );
}
