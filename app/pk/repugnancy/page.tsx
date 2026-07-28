"use client";

/**
 * Repugnancy research: a citation index, presented as one.
 *
 * The whole design problem here is that the page must be USEFUL without ever looking
 * like it has decided anything. Four choices carry that:
 *
 *   1. NO VERDICT CHROME. There is no traffic light, no score, no "3 issues found"
 *      banner, no red. The palette is the same neutral zinc as the document library,
 *      because this screen is a library shelf, not a compliance report. The moment a
 *      screen shows a red badge next to a clause, it has issued a ruling whatever the
 *      words say.
 *
 *   2. THE QUOTATION IS THE PRIMARY ELEMENT. Every retrieved passage renders its
 *      verbatim text at full size, with the model's one-line summary above it in
 *      smaller, quieter type explicitly labelled "what this passage records". The
 *      reader never gets a characterisation without the text it characterises.
 *
 *   3. ABSENCE IS RENDERED AS A RESULT, not as an empty div. "No Council of Islamic
 *      Ideology recommendation was located on this subject" is set in the same weight
 *      as a positive finding, and is followed by the reason it might be absent — the
 *      library holds part of what the Council has published, not all of it. Silence
 *      that does not explain itself reads as "the Council has never addressed this",
 *      which is a far bigger claim than the truth.
 *
 *   4. THE BOUNDARY IS ABOVE THE FOLD OF ITS OWN SECTION, in prose, at the end where a
 *      reader who has just read a finding will meet it — not tucked in a footer.
 *
 * RTL-first: logical properties throughout (`ms-`, `ps-`, `border-s`, `text-start`), and
 * every Article number, similarity figure and Latin document title wrapped in <Ltr>, so
 * the bidi algorithm cannot turn "Article 203D" into "D203 Article" inside Urdu prose.
 */

import { useState } from "react";
import {
  Scale, BookOpen, Landmark, Gavel, Route, ShieldAlert, Search, Loader2,
  ExternalLink, Quote, ChevronDown, Info, FileX,
} from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";
import {
  COUNCIL_ARTICLES,
  COURT_ARTICLES,
  REFERENCE_PROCEDURE,
  BOUNDARY_STATEMENT,
  FSC_CORPUS_NOTE,
  EXAMPLE_KEYS,
  type ReviewArticle,
} from "@/lib/pk/repugnancy";

// ─────────────────────────────────────────────────────────────────────────────────────
// Wire types — mirrors app/api/pk/repugnancy/route.ts
// ─────────────────────────────────────────────────────────────────────────────────────

interface RetrievedPassage {
  quote: string;
  documentTitle: string;
  publisher: string | null;
  jurisdiction: string | null;
  year: number | null;
  sourceUrl: string | null;
  relevance: number;
  note: string | null;
  noteWithheld: boolean;
}

interface ArticleCitation {
  article: string;
  headingEn: string;
  headingUr: string;
  quoteEn: string;
  quoteUr: string;
  body: "council" | "court" | "both";
  grounded: boolean;
  groundedIn: string | null;
}

interface ProcedureStep {
  citation: string;
  titleEn: string;
  titleUr: string;
  bodyEn: string;
  bodyUr: string;
}

interface RepugnancyResult {
  subject: string;
  language: "ur" | "en";
  constitutional: {
    articles: ArticleCitation[];
    groundedCount: number;
    sourceTitle: string | null;
  };
  council: { found: boolean; passages: RetrievedPassage[]; corpus: string[] };
  court: { found: boolean; passages: RetrievedPassage[]; corpusEmpty: boolean };
  procedure: ProcedureStep[];
  meta: { chunksRetrieved: number; provider: string | null; notesWithheld: number };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Interpolation that survives the bidi algorithm
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Fill `{name}` placeholders, wrapping every substituted value in <Ltr>.
 *
 * Splicing Western digits straight into Urdu prose lets the bidi algorithm reorder them
 * against adjacent punctuation. Returning nodes gives each value its own isolate.
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
    out.push(v === undefined ? m[0] : <Ltr key={`v${k++}`}>{String(v)}</Ltr>);
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Article card
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * One Article, collapsed to its heading until asked for.
 *
 * Thirteen Articles of constitutional text is more than anyone reads at once, and the
 * question a drafter arrives with is "which Articles govern this", not "recite them".
 * So the heading and the grounding badge are always visible and the text is one click
 * away. The badge is the honest part: an Article whose text could not be found in the
 * library says so, rather than being presented at the same confidence as one that was.
 */
function ArticleCard({
  article,
  citation,
  locale,
  t,
}: {
  article: ReviewArticle;
  citation: ArticleCitation | undefined;
  locale: "ur" | "en";
  t: (k: MessageKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const heading = locale === "ur" ? article.headingUr : article.headingEn;
  const quote = locale === "ur" ? article.quoteUr : article.quoteEn;
  const grounded = citation?.grounded ?? false;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="shrink-0 mt-0.5 text-xs font-semibold px-2 py-1 rounded-md bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300">
          <Ltr>{`Article ${article.article}`}</Ltr>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium leading-snug">{heading}</span>
          <span className="block text-[11px] text-zinc-400 mt-1">
            {grounded ? t("repugnancy.grounded") : t("repugnancy.ungrounded")}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 mt-1 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1">
          <blockquote
            className={`text-sm text-zinc-700 dark:text-zinc-300 border-s-2 border-zinc-200 dark:border-zinc-700 ps-3 text-start ${
              locale === "ur" ? "urdu-prose" : "leading-relaxed"
            }`}
          >
            {quote}
          </blockquote>
          {locale === "ur" && (
            <p className="mt-2 text-[11px] text-zinc-400 text-start urdu-prose">
              {t("repugnancy.urduTranslationNote")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Retrieved passage
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A located passage.
 *
 * Deliberately shaped like a citation slip rather than a result card: the source line
 * sits above the quotation, the quotation is set in the reading face at full size, and
 * the model's one-line summary — where there is one — is above it in smaller type under
 * an explicit label. Nothing here is styled as a judgement, because nothing here is one.
 */
function PassageCard({
  passage,
  locale,
  t,
}: {
  passage: RetrievedPassage;
  locale: "ur" | "en";
  t: (k: MessageKey) => string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-zinc-400">{t("repugnancy.quotedFrom")}</div>
          {/* `dir="auto"` rather than the page direction: these titles are genuinely
              bilingual ("اسلامی نظریاتی کونسل، سالانہ رپورٹ 2020-21 — Council of Islamic
              Ideology, Annual Report 2020–21"), and forcing them into the surrounding
              paragraph direction reorders the Urdu run against the Latin one. Letting
              the first strong character pick the direction renders each title the way
              the institution that issued it prints it. */}
          <div dir="auto" className="text-sm font-medium leading-snug mt-0.5">
            {passage.documentTitle}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-zinc-500">
            {passage.publisher && <Ltr>{passage.publisher}</Ltr>}
            {/* A year is a label, not a quantity — never comma-grouped. */}
            {passage.year != null && <Ltr>{String(passage.year)}</Ltr>}
            {passage.jurisdiction && <Ltr>{passage.jurisdiction}</Ltr>}
            <span>
              {t("repugnancy.relevance")}{" "}
              <Ltr>{`${Math.round(passage.relevance * 100)}%`}</Ltr>
            </span>
          </div>
        </div>
        {passage.sourceUrl && (
          <a
            href={passage.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-green-700 dark:hover:text-green-400 shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            {t("repugnancy.openSource")}
          </a>
        )}
      </header>

      {passage.note && (
        <div className="mt-3">
          <div className="text-[11px] text-zinc-400 mb-1">{t("repugnancy.whatItRecords")}</div>
          <p
            className={`text-sm text-zinc-600 dark:text-zinc-400 text-start ${
              locale === "ur" ? "urdu-prose" : ""
            }`}
          >
            {passage.note}
          </p>
        </div>
      )}

      {passage.noteWithheld && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-zinc-500">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p className={`text-start ${locale === "ur" ? "urdu-prose" : ""}`}>
            {t("repugnancy.noteWithheld")}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2">
        <Quote className="w-3.5 h-3.5 shrink-0 mt-1.5 text-zinc-300 dark:text-zinc-700" />
        <blockquote
          className={`flex-1 text-sm text-zinc-800 dark:text-zinc-200 border-s-2 border-green-700/30 ps-3 text-start whitespace-pre-wrap urdu-prose`}
        >
          {passage.quote}
        </blockquote>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Section shell
// ─────────────────────────────────────────────────────────────────────────────────────

function Section({
  Icon,
  title,
  subtitle,
  locale,
  children,
}: {
  Icon: typeof Scale;
  title: string;
  subtitle?: string;
  locale: "ur" | "en";
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <header className="flex items-start gap-3 mb-4">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 grid place-items-center">
          <Icon className="w-4 h-4 text-zinc-500" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-start">{title}</h2>
          {subtitle && (
            <p
              className={`text-sm text-zinc-500 mt-0.5 text-start ${
                locale === "ur" ? "urdu-prose" : ""
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Absence, rendered with the same weight as a finding. */
function NothingFound({
  headline,
  body,
  locale,
}: {
  headline: string;
  body: React.ReactNode;
  locale: "ur" | "en";
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-6">
      <div className="flex items-start gap-3">
        <FileX className="w-5 h-5 shrink-0 mt-0.5 text-zinc-400" />
        <div className="min-w-0">
          <p
            className={`text-sm font-medium text-start ${locale === "ur" ? "urdu-prose" : ""}`}
          >
            {headline}
          </p>
          <div
            className={`text-sm text-zinc-500 mt-2 text-start ${
              locale === "ur" ? "urdu-prose" : ""
            }`}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────────────

export default function PkRepugnancyPage() {
  const { t, locale } = useLocale();
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<RepugnancyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The answer language follows the question, not the interface. The route decides it
   * from the script of the subject; this mirrors that so the retrieved prose and the
   * chrome around it agree.
   */
  const answerLocale: "ur" | "en" = result?.language ?? locale;

  async function run(text: string) {
    const query = text.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/pk/repugnancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: query, locale }),
      });
      if (response.status === 429) {
        setError(t("repugnancy.rateLimited"));
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setResult((await response.json()) as RepugnancyResult);
    } catch {
      setError(t("repugnancy.failed"));
    } finally {
      setLoading(false);
    }
  }

  const citationFor = (article: ReviewArticle): ArticleCitation | undefined =>
    result?.constitutional.articles.find((a) => a.article === article.article);

  const procedure: ProcedureStep[] = result?.procedure ?? REFERENCE_PROCEDURE;
  const boundary = BOUNDARY_STATEMENT[answerLocale];

  return (
    <PkAppLayout>
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-20">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-start">
            {t("repugnancy.title")}
          </h1>
          <p
            className={`text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl text-start ${
              locale === "ur" ? "urdu-prose" : ""
            }`}
          >
            {t("repugnancy.subtitle")}
          </p>
        </header>

        {/* ── query ─────────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <label
            htmlFor="repugnancy-subject"
            className="block text-sm font-medium mb-2 text-start"
          >
            {t("repugnancy.inputLabel")}
          </label>
          <textarea
            id="repugnancy-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(subject);
            }}
            rows={4}
            placeholder={t("repugnancy.inputPlaceholder")}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-start focus:outline-none focus:ring-2 focus:ring-green-600/40 resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-zinc-400">{t("repugnancy.examples")}</span>
              {EXAMPLE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setSubject(t(key));
                    run(t(key));
                  }}
                  className="text-[11px] px-2 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 transition"
                >
                  {t(key)}
                </button>
              ))}
            </div>

            <button
              onClick={() => run(subject)}
              disabled={loading || !subject.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:hover:bg-green-700 text-white px-4 py-2 text-sm font-medium transition"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? t("repugnancy.searching") : t("repugnancy.search")}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-500 text-start">{error}</p>
        )}

        {!result && !loading && !error && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-10 text-center">
            <Scale className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-sm font-medium">{t("repugnancy.emptyTitle")}</p>
            <p
              className={`text-sm text-zinc-500 mt-1 max-w-md mx-auto ${
                locale === "ur" ? "urdu-prose" : ""
              }`}
            >
              {t("repugnancy.emptyBody")}
            </p>
          </div>
        )}

        {/* ── 1. the constitutional position ────────────────────────────────────── */}
        {result && (
          <>
            <Section
              Icon={BookOpen}
              title={t("repugnancy.constitutionTitle")}
              subtitle={t("repugnancy.constitutionSub")}
              locale={answerLocale}
            >
              <p className="text-[11px] text-zinc-400 mb-3 text-start">
                {fill(t("repugnancy.groundedSummary"), {
                  n: result.constitutional.groundedCount,
                  total: result.constitutional.articles.length,
                })}
                {result.constitutional.sourceTitle && (
                  <>
                    {" — "}
                    <span className="text-zinc-500">{result.constitutional.sourceTitle}</span>
                  </>
                )}
              </p>

              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mt-4 mb-2 text-start">
                <span className="inline-flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5" />
                  {t("repugnancy.councilArticles")}
                </span>
              </h3>
              <div className="space-y-2">
                {COUNCIL_ARTICLES.map((a) => (
                  <ArticleCard
                    key={a.article}
                    article={a}
                    citation={citationFor(a)}
                    locale={answerLocale}
                    t={t}
                  />
                ))}
              </div>

              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mt-6 mb-2 text-start">
                <span className="inline-flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5" />
                  {t("repugnancy.courtArticles")}
                </span>
              </h3>
              <div className="space-y-2">
                {COURT_ARTICLES.map((a) => (
                  <ArticleCard
                    key={a.article}
                    article={a}
                    citation={citationFor(a)}
                    locale={answerLocale}
                    t={t}
                  />
                ))}
              </div>
            </Section>

            {/* ── 2. Council of Islamic Ideology ──────────────────────────────────── */}
            <Section
              Icon={Landmark}
              title={t("repugnancy.councilTitle")}
              subtitle={t("repugnancy.councilSub")}
              locale={answerLocale}
            >
              {result.council.found ? (
                <div className="space-y-3">
                  {result.council.passages.map((p, i) => (
                    <PassageCard key={i} passage={p} locale={answerLocale} t={t} />
                  ))}
                </div>
              ) : (
                <NothingFound
                  headline={t("repugnancy.councilNone")}
                  body={t("repugnancy.councilNoneBody")}
                  locale={answerLocale}
                />
              )}

              {/* Each title is its own block rather than one joined string: these are
                  mixed Urdu and Latin, and the bidi algorithm reorders a run of them
                  against each other when they share a line. One per row also makes the
                  point the list exists to make — that the Council's reports WERE
                  searched, and named — which a run-on sentence obscures. */}
              {result.council.corpus.length > 0 && (
                <div className="mt-3 text-[11px] text-zinc-400 text-start">
                  <div>{t("repugnancy.councilCorpus")}</div>
                  <ul className="mt-1 space-y-0.5">
                    {result.council.corpus.map((title) => (
                      <li
                        key={title}
                        dir="auto"
                        className="ps-3 border-s border-zinc-200 dark:border-zinc-800"
                      >
                        {title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* ── 3. Federal Shariat Court ────────────────────────────────────────── */}
            <Section
              Icon={Gavel}
              title={t("repugnancy.courtTitle")}
              subtitle={t("repugnancy.courtSub")}
              locale={answerLocale}
            >
              {result.court.found ? (
                <div className="space-y-3">
                  {result.court.passages.map((p, i) => (
                    <PassageCard key={i} passage={p} locale={answerLocale} t={t} />
                  ))}
                </div>
              ) : (
                <NothingFound
                  headline={t("repugnancy.courtNone")}
                  body={FSC_CORPUS_NOTE[answerLocale]}
                  locale={answerLocale}
                />
              )}
            </Section>

            {/* ── 4. procedure ────────────────────────────────────────────────────── */}
            <Section
              Icon={Route}
              title={t("repugnancy.procedureTitle")}
              subtitle={t("repugnancy.procedureSub")}
              locale={answerLocale}
            >
              <ol className="space-y-3">
                {procedure.map((step, i) => (
                  <li
                    key={`${step.citation}-${i}`}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 grid place-items-center text-[11px] font-semibold text-zinc-500">
                        <Ltr>{String(i + 1)}</Ltr>
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3 className="text-sm font-medium text-start">
                            {answerLocale === "ur" ? step.titleUr : step.titleEn}
                          </h3>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300">
                            <Ltr>{step.citation}</Ltr>
                          </span>
                        </div>
                        <p
                          className={`text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 text-start ${
                            answerLocale === "ur" ? "urdu-prose" : ""
                          }`}
                        >
                          {answerLocale === "ur" ? step.bodyUr : step.bodyEn}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            {/* ── 5. what this tool is not ────────────────────────────────────────── */}
            <Section
              Icon={ShieldAlert}
              title={t("repugnancy.boundaryTitle")}
              locale={answerLocale}
            >
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-5 py-4 space-y-3">
                {boundary.map((paragraph, i) => (
                  <p
                    key={i}
                    className={`text-sm text-start ${
                      i === 0
                        ? "font-medium text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-600 dark:text-zinc-400"
                    } ${answerLocale === "ur" ? "urdu-prose" : ""}`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </Section>

            <div className="mt-8 flex items-start gap-2 text-[11px] text-zinc-400">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {/* The withheld count is not repeated here: every affected passage
                  already carries the notice on its own card, and a bare number in the
                  footer would read as a defect rate rather than as what it is. */}
              <p className="text-start">
                <Ltr>{String(result.meta.chunksRetrieved)}</Ltr>{" "}
                {t("repugnancy.chunksRetrieved")}
              </p>
            </div>
          </>
        )}
      </div>
    </PkAppLayout>
  );
}
