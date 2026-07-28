"use client";

/**
 * Parliamentary drafting for a Member of the National Assembly.
 *
 * The US build offers five memo formats. A Member of the National Assembly does not
 * write memos — they file *notices*, and each notice has a rule, a notice period and a
 * numeric cap that the Secretariat enforces before the notice reaches the Orders of the
 * Day. So this screen is built around the eight real instruments (plus three
 * communications formats), every one of them stamped with its rule.
 *
 * The Rule 78 tab is the part that matters. Rule 78 lists twenty-two conditions a
 * question must satisfy to be admitted. Condition (f) — "it shall not ordinarily exceed
 * one hundred and fifty words" — is decided by arithmetic in `countQuestionWords()`,
 * never by the model, and the counter updates as the member types. Getting that number
 * wrong would be worse than not showing it.
 *
 * Written RTL-first: logical properties throughout (`ms-`, `ps-`, `text-start`,
 * `border-s`), and every rule number, word count and Latin acronym wrapped in <Ltr> so
 * the bidi algorithm cannot reorder "Rule 78(f)" into something else inside Urdu prose.
 */

import { useMemo, useState } from "react";
import {
  FileText, MessageSquareQuote, Gavel, Megaphone, Check, X, Loader2,
  Copy, ShieldCheck, AlertTriangle, ArrowRight, Info,
} from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";
import {
  INSTRUMENTS,
  getInstrument,
  countQuestionWords,
  ruleStampParts,
  RULE_78_CONDITIONS,
  RULE_78_WORD_LIMIT,
  DRAFT_LANGUAGE_NOTE,
  type Instrument,
} from "@/lib/pk/instruments";
import { searchConstituencies, getConstituency } from "@/lib/pk/constituencies";

// ─────────────────────────────────────────────────────────────────────────────────────
// Interpolation that survives the bidi algorithm
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Fill `{name}` placeholders in a translated string, wrapping every substituted value
 * in <Ltr>.
 *
 * A plain `String.replace` would splice Western digits straight into Urdu prose, where
 * the bidi algorithm is free to reorder them against adjacent Latin punctuation —
 * "150" next to "78(f)" is exactly the pattern that breaks. Returning React nodes lets
 * each value carry its own `<bdi dir="ltr">`.
 */
function fill(template: string, values: Record<string, string | number>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(template))) {
    if (m.index > last) out.push(template.slice(last, m.index));
    const v = values[m[1]];
    out.push(
      v === undefined ? m[0] : <Ltr key={`v${k++}`}>{String(v)}</Ltr>
    );
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Instrument grouping
// ─────────────────────────────────────────────────────────────────────────────────────

const GROUPS: Array<{
  key: MessageKey;
  Icon: typeof FileText;
  ids: string[];
}> = [
  {
    key: "instruments.groupQuestions",
    Icon: MessageSquareQuote,
    ids: ["starred-question", "unstarred-question", "short-notice-question"],
  },
  {
    key: "instruments.groupMotions",
    Icon: Gavel,
    ids: [
      "calling-attention",
      "adjournment-motion",
      "privilege-question",
      "resolution",
      "private-members-bill",
    ],
  },
  {
    key: "instruments.groupComms",
    Icon: Megaphone,
    ids: ["press-release", "constituent-letter", "social-post"],
  },
];

interface ConditionVerdict {
  id: string;
  citation: string;
  textEn: string;
  textUr: string;
  pass: boolean;
  reasonEn: string;
  deterministic: boolean;
}

interface CheckResult {
  wordCount: number;
  wordLimit: number;
  overLimit: boolean;
  excess: number;
  conditions: ConditionVerdict[];
  passedCount: number;
  failedCount: number;
  totalConditions: number;
  partial: boolean;
  note?: string;
}

export default function PkInstrumentsPage() {
  const { t, locale } = useLocale();

  const [tab, setTab] = useState<"draft" | "check">("draft");

  // ── Draft state ────────────────────────────────────────────────────────────────
  const [instrumentId, setInstrumentId] = useState<string>("starred-question");
  const [subject, setSubject] = useState("");
  const [division, setDivision] = useState("");
  const [memberName, setMemberName] = useState("");
  const [constituency, setConstituency] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Check state ────────────────────────────────────────────────────────────────
  const [checkText, setCheckText] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const instrument = getInstrument(instrumentId) as Instrument;

  // The live counter. Same pure function the API uses, so the number on screen while
  // typing and the number in the verdict can never disagree.
  const liveWordCount = useMemo(() => countQuestionWords(checkText), [checkText]);
  const liveOver = liveWordCount > RULE_78_WORD_LIMIT;

  const draftWordCount = useMemo(
    () => (draft && instrument.wordLimit ? countQuestionWords(draft) : null),
    [draft, instrument.wordLimit]
  );

  const seat = useMemo(() => getConstituency(constituency), [constituency]);
  const seatSuggestions = useMemo(() => {
    if (!constituency.trim() || seat) return [];
    return searchConstituencies(constituency, 4);
  }, [constituency, seat]);

  const stamp = ruleStampParts(instrument, locale);

  async function runDraft() {
    if (!subject.trim() || drafting) return;
    setDrafting(true);
    setDraftError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/pk/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId,
          subject,
          division,
          memberName: memberName || seat?.memberName || undefined,
          constituency: constituency || undefined,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setDraft(data.draft);
    } catch {
      setDraftError(t("common.error"));
    } finally {
      setDrafting(false);
    }
  }

  async function runCheck(text?: string) {
    const body = (text ?? checkText).trim();
    if (!body || checking) return;
    setChecking(true);
    setCheckError(null);
    setCheck(null);
    try {
      const res = await fetch("/api/pk/instruments/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setCheck(data);
    } catch {
      setCheckError(t("common.error"));
    } finally {
      setChecking(false);
    }
  }

  function sendDraftToChecker() {
    if (!draft) return;
    setCheckText(draft);
    setCheck(null);
    setTab("check");
  }

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          {t("instruments.title")}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl mb-6 urdu-prose">
          {t("instruments.subtitle")}
        </p>

        {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-8 no-print">
          {([
            ["draft", "instruments.tabDraft", FileText],
            ["check", "instruments.tabCheck", ShieldCheck],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
                tab === key
                  ? "border-green-700 text-green-800 dark:text-green-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(label)}
            </button>
          ))}
        </div>

        {tab === "draft" ? (
          <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-8">
            {/* ── Instrument picker ────────────────────────────────────────────── */}
            <div className="space-y-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("instruments.chooseType")}
              </div>

              {GROUPS.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    <group.Icon className="w-3.5 h-3.5" />
                    {t(group.key)}
                  </div>
                  <div className="space-y-1">
                    {group.ids.map((id) => {
                      const inst = getInstrument(id)!;
                      const active = id === instrumentId;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setInstrumentId(id);
                            setDraft(null);
                            setDraftError(null);
                          }}
                          className={`w-full text-start rounded-lg px-3 py-2.5 border transition ${
                            active
                              ? "border-green-600 bg-green-50 dark:bg-green-950/40"
                              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <div
                            className={`text-sm ${
                              active
                                ? "font-semibold text-green-900 dark:text-green-200"
                                : "text-zinc-800 dark:text-zinc-200"
                            }`}
                          >
                            {t(inst.nameKey)}
                          </div>
                          {inst.ruleRange && (
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              <Ltr>{inst.ruleRange}</Ltr>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Form + output ───────────────────────────────────────────────── */}
            <div className="space-y-6 min-w-0">
              {/* Rule stamp for the selected instrument */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4">
                  <span className="text-lg font-bold">{t(instrument.nameKey)}</span>
                  {stamp.length > 0 && (
                    <span className="text-sm text-zinc-500">
                      {stamp.map((part, i) => (
                        <span key={part}>
                          {i > 0 && <span className="mx-1.5 text-zinc-300">·</span>}
                          <Ltr>{part}</Ltr>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                {instrument.constraints.length > 0 && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                      {t("instruments.rules")}
                    </div>
                    <ul className="space-y-2">
                      {instrument.constraints.map((c) => (
                        <li
                          key={`${c.rule}-${c.textEn.slice(0, 24)}`}
                          className="flex gap-2.5 text-sm"
                        >
                          <span className="shrink-0 mt-0.5 inline-flex items-center rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                            <Ltr>{c.rule}</Ltr>
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 urdu-prose">
                            {locale === "ur" ? c.textUr : c.textEn}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {instrument.isNotice && (
                  <p className="mt-4 flex gap-2 text-[11px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="urdu-prose">{DRAFT_LANGUAGE_NOTE[locale]}</span>
                  </p>
                )}
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("instruments.topic")}
                  </label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    rows={3}
                    placeholder={t("instruments.topicPlaceholder")}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {t("instruments.ministry")}
                    </label>
                    <input
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      placeholder={t("instruments.ministryPlaceholder")}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {t("instruments.constituency")}
                    </label>
                    <input
                      value={constituency}
                      onChange={(e) => setConstituency(e.target.value)}
                      placeholder="NA-127"
                      dir="ltr"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40"
                    />
                    {seat && (
                      <p className="text-[11px] text-zinc-500 mt-1">
                        <Ltr>{seat.code}</Ltr>
                        {seat.name && <> — {seat.name}</>}
                        {seat.memberName && (
                          <>
                            {" · "}
                            {seat.memberName}
                          </>
                        )}
                      </p>
                    )}
                    {seatSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {seatSuggestions.map((s) => (
                          <button
                            key={s.code}
                            onClick={() => setConstituency(s.code)}
                            className="text-[11px] rounded border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <Ltr>{s.code}</Ltr>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t("instruments.memberName")}
                  </label>
                  <input
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder={seat?.memberName ?? t("instruments.memberNamePlaceholder")}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40"
                  />
                </div>

                <button
                  onClick={runDraft}
                  disabled={!subject.trim() || drafting}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {drafting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("instruments.generating")}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {t("instruments.generate")}
                    </>
                  )}
                </button>
              </div>

              {draftError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                  {draftError}
                </div>
              )}

              {draft && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold">{t("instruments.result")}</span>
                      {stamp.length > 0 && (
                        <span className="text-zinc-500">
                          {stamp.map((part, i) => (
                            <span key={part}>
                              {i > 0 && <span className="mx-1.5 text-zinc-300">·</span>}
                              <Ltr>{part}</Ltr>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 no-print">
                      {draftWordCount !== null && instrument.wordLimit && (
                        <span
                          className={`text-xs rounded px-2 py-1 font-medium ${
                            draftWordCount > instrument.wordLimit
                              ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          }`}
                        >
                          <Ltr>{`${draftWordCount} / ${instrument.wordLimit}`}</Ltr>{" "}
                          {t("instruments.wordCount")}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(draft);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 hover:bg-white dark:hover:bg-zinc-800 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? t("common.copied") : t("common.copy")}
                      </button>
                    </div>
                  </div>

                  <pre
                    dir={instrument.isNotice ? "ltr" : undefined}
                    className={`px-5 py-4 text-sm whitespace-pre-wrap break-words font-sans leading-relaxed ${
                      instrument.isNotice ? "text-start" : "urdu-prose text-start"
                    }`}
                  >
                    {draft}
                  </pre>

                  {instrument.isQuestion && (
                    <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 no-print">
                      <button
                        onClick={sendDraftToChecker}
                        className="inline-flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300 hover:underline"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {t("instruments.checkFromDraft")}
                        <ArrowRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Rule 78 checker ─────────────────────────────────────────────────── */
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-8">
            <div className="space-y-4 min-w-0">
              <div>
                <h2 className="text-lg font-bold mb-1">{t("instruments.checkTitle")}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 urdu-prose">
                  {t("instruments.checkSub")}
                </p>
                <p className="text-xs text-zinc-500 mt-2 urdu-prose">
                  {fill(t("instruments.rule78Note"), {
                    total: RULE_78_CONDITIONS.length,
                  })}
                </p>
              </div>

              <textarea
                value={checkText}
                onChange={(e) => setCheckText(e.target.value)}
                rows={10}
                dir="ltr"
                placeholder={t("instruments.checkPlaceholder")}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-600/40"
              />

              {/* The live Rule 78(f) counter. Computed in the browser by the same pure
                  function the API uses, so it cannot disagree with the verdict. */}
              <div
                className={`rounded-lg border px-4 py-3 ${
                  liveOver
                    ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <Ltr>Rule 78(f)</Ltr>
                  </span>
                  <span
                    className={`text-2xl font-bold tabular-nums ${
                      liveOver
                        ? "text-red-700 dark:text-red-400"
                        : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    <Ltr>{`${liveWordCount} / ${RULE_78_WORD_LIMIT}`}</Ltr>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      liveOver ? "bg-red-600" : "bg-emerald-600"
                    }`}
                    style={{
                      width: `${Math.min(100, (liveWordCount / RULE_78_WORD_LIMIT) * 100)}%`,
                    }}
                  />
                </div>
                {checkText.trim() && (
                  <p
                    className={`text-sm mt-2 urdu-prose ${
                      liveOver
                        ? "text-red-800 dark:text-red-300 font-medium"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {liveOver
                      ? fill(t("instruments.wordCountOver"), {
                          n: liveWordCount,
                          limit: RULE_78_WORD_LIMIT,
                          excess: liveWordCount - RULE_78_WORD_LIMIT,
                        })
                      : fill(t("instruments.wordCountOk"), {
                          n: liveWordCount,
                          limit: RULE_78_WORD_LIMIT,
                        })}
                  </p>
                )}
              </div>

              <button
                onClick={() => runCheck()}
                disabled={!checkText.trim() || checking}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("instruments.checking")}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {t("instruments.check")}
                  </>
                )}
              </button>

              {checkError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                  {checkError}
                </div>
              )}
            </div>

            {/* ── Verdicts ────────────────────────────────────────────────────── */}
            <div className="min-w-0">
              {!check && !checking && (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-8 text-center text-sm text-zinc-500 urdu-prose">
                  {t("instruments.checkEmpty")}
                </div>
              )}

              {check && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                  <div
                    className={`px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 ${
                      check.failedCount > 0
                        ? "bg-red-50 dark:bg-red-950/40"
                        : "bg-emerald-50 dark:bg-emerald-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {check.failedCount > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          check.failedCount > 0
                            ? "text-red-900 dark:text-red-300"
                            : "text-emerald-900 dark:text-emerald-300"
                        }`}
                      >
                        {fill(t("instruments.conditionsSummary"), {
                          pass: check.passedCount,
                          total: check.totalConditions,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      <Ltr>{`${check.wordCount} / ${check.wordLimit}`}</Ltr>{" "}
                      {t("instruments.wordCount")}
                    </div>
                    {check.partial && check.note && (
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-2">
                        {check.note}
                      </p>
                    )}
                  </div>

                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[70vh] overflow-y-auto">
                    {[...check.conditions]
                      // Failures first — that is what the member needs to fix — then
                      // the satisfied conditions in Rule 78's own order.
                      .sort((a, b) => Number(a.pass) - Number(b.pass))
                      .map((c) => (
                        <li
                          key={c.id}
                          className={`px-4 py-3 ${
                            c.pass ? "" : "bg-red-50/60 dark:bg-red-950/20"
                          }`}
                        >
                          <div className="flex gap-2.5">
                            <span
                              className={`shrink-0 mt-0.5 w-4 h-4 rounded-full grid place-items-center ${
                                c.pass
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                                  : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                              }`}
                            >
                              {c.pass ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                  <Ltr>{c.citation}</Ltr>
                                </span>
                                <span
                                  className={`text-[10px] uppercase tracking-wide font-semibold ${
                                    c.pass
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-red-700 dark:text-red-400"
                                  }`}
                                >
                                  {c.pass ? t("instruments.passed") : t("instruments.failed")}
                                </span>
                                {c.deterministic && (
                                  <span className="text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-500">
                                    {t("instruments.computed")}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5 urdu-prose">
                                {locale === "ur" ? c.textUr : c.textEn}
                              </p>
                              <p
                                className={`text-xs mt-1 ${
                                  c.pass
                                    ? "text-zinc-600 dark:text-zinc-400"
                                    : "text-red-800 dark:text-red-300 font-medium"
                                }`}
                              >
                                {c.reasonEn}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-zinc-400 mt-3 urdu-prose">
                {t("instruments.rule78Source")}
              </p>
            </div>
          </div>
        )}

        {/* Instrument count, so the difference from the US build is legible. */}
        <p className="text-[11px] text-zinc-400 mt-10 urdu-prose">
          {fill(t("instruments.footerNote"), { n: INSTRUMENTS.filter((i) => i.isNotice).length })}
        </p>
      </div>
    </PkAppLayout>
  );
}
