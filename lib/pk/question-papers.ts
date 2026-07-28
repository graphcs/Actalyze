/**
 * Question-hour intelligence: search over what the National Assembly has already been
 * asked, and what the Ministry answered.
 *
 * The index is `data/pk/questions.json`, produced by `scripts/pk/ingest-questions.mjs`
 * from the Assembly's own question papers. Nothing here generates text — every question
 * and every reply is extracted verbatim from a published PDF, and every record carries
 * the URL of the paper it came from.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────────
 * Rule 78(j) of the Rules of Procedure, 2007:
 *
 *   "It shall not repeat in substance questions admitted for the same session, or
 *    already answered or disallowed by the Speaker, or to which an answer was refused
 *    in the Assembly during the last two sessions."
 *
 * A member cannot test that before filing. The papers are per-sitting PDFs of thirty to
 * forty megabytes with no index and no search. The notice goes in, and the Secretariat
 * returns it days later — by which time one of the two starred questions Rule 73 allows
 * for that day is gone.
 *
 * ── Why lexical retrieval rather than embeddings ──────────────────────────────────
 * The obvious move is to embed every question and cosine-match a draft against them.
 * It is the wrong tool for this corpus, for a specific and checkable reason: every
 * question in it is the same sentence.
 *
 *   "Will the Minister for <Division> be pleased to state ... details thereof?"
 *
 * That stem is thirty to sixty tokens of a hundred-token question, and it is identical
 * across all of them. Two questions on entirely unrelated subjects — Saidu Sharif
 * airport and passport offices in Karachi — sit at high cosine similarity purely on the
 * shared frame, and the subject term that actually distinguishes them contributes a few
 * per cent of the vector. Ranking by that similarity puts near-neighbours everywhere.
 *
 * IDF solves exactly this. A term appearing in every document has zero inverse document
 * frequency and therefore zero weight, so the formulaic stem cancels itself out of the
 * score without anyone having to hand-maintain a list of parliamentary stopwords. What
 * is left is the subject noun phrase — "Saidu Sharif", "passport", "advertisement" —
 * which is what "repeats in substance" turns on.
 *
 * Two further reasons this is the right trade here:
 *
 *  - The check must be explainable. A member's office needs to see *which* words matched
 *    to decide whether the Secretariat would call it a repeat. `matchedTerms` on every
 *    hit is a natural by-product of a term-weighted score and cannot be recovered from a
 *    cosine distance.
 *  - It runs with no API key, no network call and no per-query cost, and it is
 *    deterministic — the same draft returns the same neighbours every time. That matters
 *    for something checked immediately before filing.
 *
 * The honest limitation: a true paraphrase sharing no content words ("expenditure on
 * publicity" vs "advertising spend") scores low. Where a Ministry filter is supplied the
 * ministry bonus partly covers it, but the check is a strong first pass, not a
 * guarantee, and the interface says so.
 *
 * Search ranking uses BM25 — better behaved for the short keyword queries a search box
 * gets. The duplicate check uses TF-IDF cosine, which is bounded to [0,1] and so can be
 * reported as a percentage and thresholded. Both share one tokeniser and one IDF table.
 */

import rawIndex from '@/data/pk/questions.json';

// ── shapes ─────────────────────────────────────────────────────────────────────────

export interface QuestionRecord {
  id: string;
  sittingId: string;
  sessionId: string;
  /** e.g. "28th Session (Budget Session)". */
  session: string;
  sessionNumber: number | null;
  parliamentaryYear: string;
  /** ISO date of the sitting, or null where the paper's dateline did not parse. */
  date: string | null;
  /** The date exactly as the Assembly printed it, e.g. "Thursday, 11th June, 2026". */
  dateLabel: string;
  pdfUrl: string;
  /** Question number on the paper. Numbering restarts per listing. */
  number: number;
  starred: boolean;
  listing: 'starred' | 'unstarred' | 'written';
  asker: string;
  /** "(Deferred during 21st Session)" where the paper carried that note. */
  deferredFrom: string | null;
  ministry: string | null;
  division: string | null;
  /** The Minister who signed the reply, as printed. */
  answeredBy: string | null;
  question: string;
  reply: string;
  hasReply: boolean;
  /** The reply is mostly a table and extracts as a column of fragments. */
  replyIsTabular: boolean;
}

export interface SittingRecord {
  id: string;
  sessionId: string;
  session: string;
  sessionNumber: number | null;
  parliamentaryYear: string;
  dateLabel: string;
  date: string | null;
  pdfUrl: string;
  pages: number;
  bytes: number;
  questionCount: number;
  replyCount: number;
  letterRatio: number;
}

export interface SkippedSitting {
  session: string;
  date: string;
  pdfUrl: string;
  reason: string;
}

export interface QuestionIndex {
  generatedAt: string;
  source: string;
  tenure: string;
  sittingsListed: number;
  sessionsInArchive: number;
  sittingsIngested: number;
  questionCount: number;
  replyCount: number;
  sittings: SittingRecord[];
  skipped: SkippedSitting[];
  questions: QuestionRecord[];
}

export const questionIndex = rawIndex as unknown as QuestionIndex;

// ── tokenising ─────────────────────────────────────────────────────────────────────

/**
 * Function words only. The parliamentary boilerplate is deliberately NOT listed: IDF
 * removes it, and a hand-maintained list of it would rot the first time the Secretariat
 * changed its house style.
 */
const STOPWORDS = new Set(
  ('a an and are as at be been being by for from had has have he her his if in into is it its' +
    ' of on or our that the their there these they this to was were what when where which who' +
    ' will with would not no any such shall may can also been per etc')
    .split(/\s+/)
);

/**
 * Conservative suffix stripping. Full Porter would conflate "policy"/"police" and
 * "operation"/"operate", which in this corpus are different subjects. Plurals and the
 * two commonest verb endings are where the real variation is — "advertisement" vs
 * "advertisements", "constructed" vs "construction" — so only those are folded.
 */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && (w.endsWith('ses') || w.endsWith('xes') || w.endsWith('ches') || w.endsWith('shes'))) {
    return w.slice(0, -2);
  }
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  return w;
}

export function tokenise(text: string): string[] {
  const out: string[] = [];
  // Keep intra-word hyphens and ampersands: "Saidu-Sharif", "I&B", "NA-247".
  for (const raw of text.toLowerCase().split(/[^a-z0-9&\-']+/)) {
    const t = raw.replace(/^[-']+|[-']+$/g, '');
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    if (/^\d+$/.test(t) && t.length < 4) continue; // clause numbers, not content
    out.push(stem(t));
  }
  return out;
}

function bigrams(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 1 < tokens.length; i++) out.add(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

// ── the index, built once per process ──────────────────────────────────────────────

interface Doc {
  record: QuestionRecord;
  /** Term frequencies over the question text alone. */
  qtf: Map<string, number>;
  qlen: number;
  /** Term frequencies over the reply. Searched, but at a lower weight. */
  rtf: Map<string, number>;
  rlen: number;
  /** L2 norm of the question's TF-IDF vector, for the cosine used by the duplicate check. */
  qnorm: number;
  qbigrams: Set<string>;
}

interface BuiltIndex {
  docs: Doc[];
  idf: Map<string, number>;
  avgQLen: number;
  avgRLen: number;
}

function counts(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

let built: BuiltIndex | null = null;

function build(): BuiltIndex {
  if (built) return built;

  const docs: Doc[] = [];
  const df = new Map<string, number>();

  for (const record of questionIndex.questions) {
    const qt = tokenise(record.question);
    const rt = tokenise(record.reply);
    const qtf = counts(qt);
    const rtf = counts(rt);
    // Document frequency is computed over question text only. A term that appears in
    // half the *replies* — "Ministry", "Division", "submitted" — is still discriminating
    // in a question, and folding the replies in would flatten that.
    for (const term of qtf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    docs.push({ record, qtf, qlen: qt.length, rtf, rlen: rt.length, qnorm: 0, qbigrams: bigrams(qt) });
  }

  const N = Math.max(docs.length, 1);
  const idf = new Map<string, number>();
  for (const [term, n] of df) {
    // Smoothed IDF, floored at zero. A term in every question scores exactly 0, which is
    // the whole point: it deletes the "Will the Minister … be pleased to state" stem.
    idf.set(term, Math.max(0, Math.log((N - n + 0.5) / (n + 0.5) + 1)));
  }

  for (const doc of docs) {
    let sum = 0;
    for (const [term, tf] of doc.qtf) {
      const w = (1 + Math.log(tf)) * (idf.get(term) ?? 0);
      sum += w * w;
    }
    doc.qnorm = Math.sqrt(sum);
  }

  built = {
    docs,
    idf,
    avgQLen: docs.reduce((s, d) => s + d.qlen, 0) / N,
    avgRLen: docs.reduce((s, d) => s + d.rlen, 0) / N || 1,
  };
  return built;
}

// ── search ─────────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  /** Free text: subject words, a ministry, or a member's name. */
  q?: string;
  ministry?: string;
  member?: string;
  session?: string;
  starred?: boolean | null;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  record: QuestionRecord;
  score: number;
  /** The query terms that actually earned the score, heaviest first. */
  matchedTerms: string[];
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}

const BM25_K1 = 1.4;
const BM25_B = 0.75;
/** Replies are searched, but a question is what the member is looking for. */
const REPLY_WEIGHT = 0.35;

function bm25(tf: number, len: number, avgLen: number, idf: number): number {
  if (tf === 0) return 0;
  return idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * len) / avgLen)));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A Division's identity, independent of how a particular paper spelled it.
 *
 * The same Division is printed several ways across these papers — "Information
 * Technology and Telecommunication" and "…Telecommunications", "Industries and
 * Production" and "Industries and production", "Planning, Development and Special
 * Initiative" and "…Initiatives". Left alone they split the breakdown into halves and
 * the filter finds only one of them. Case, punctuation and a trailing plural on any word
 * are folded; nothing else is, so two genuinely different Divisions never merge.
 */
function ministryKey(name: string): string {
  return norm(name)
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

export function searchQuestions(filters: SearchFilters): SearchResult {
  const index = build();
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  let pool = index.docs;
  if (filters.ministry) {
    // Matched on the folded key so picking one spelling of a Division returns the
    // questions filed under the other, and on the raw string so a partial word still
    // narrows ("Interior" → "Interior and Narcotics Control").
    const key = ministryKey(filters.ministry);
    const raw = norm(filters.ministry);
    pool = pool.filter((d) => {
      const m = d.record.ministry ?? '';
      return ministryKey(m) === key || norm(m).includes(raw);
    });
  }
  if (filters.member) {
    const m = norm(filters.member);
    pool = pool.filter((d) => norm(d.record.asker).includes(m));
  }
  if (filters.session) {
    const s = norm(filters.session);
    pool = pool.filter((d) => norm(d.record.session).includes(s) || d.record.sessionId === filters.session);
  }
  if (filters.starred === true) pool = pool.filter((d) => d.record.starred);
  if (filters.starred === false) pool = pool.filter((d) => !d.record.starred);

  const query = (filters.q ?? '').trim();
  if (!query) {
    // No query: newest sitting first, then question number, so the page opens on the
    // most recent question hour rather than on an arbitrary slice.
    const sorted = [...pool].sort((a, b) => {
      const d = (b.record.date ?? '').localeCompare(a.record.date ?? '');
      return d !== 0 ? d : a.record.number - b.record.number;
    });
    return {
      total: sorted.length,
      hits: sorted.slice(offset, offset + limit).map((d) => ({ record: d.record, score: 0, matchedTerms: [] })),
    };
  }

  const qTokens = [...new Set(tokenise(query))];
  const lowered = norm(query);

  const scored: SearchHit[] = [];
  for (const doc of pool) {
    let score = 0;
    const contributions: Array<[string, number]> = [];
    for (const term of qTokens) {
      const idf = index.idf.get(term);
      // A term absent from every question still deserves a floor: it may appear in a
      // reply, or be a rare name the corpus has seen once.
      const weight = idf === undefined ? Math.log(index.docs.length + 1) : Math.max(idf, 0.05);
      const q = bm25(doc.qtf.get(term) ?? 0, doc.qlen, index.avgQLen, weight);
      const r = REPLY_WEIGHT * bm25(doc.rtf.get(term) ?? 0, doc.rlen, index.avgRLen, weight);
      if (q + r > 0) {
        score += q + r;
        contributions.push([term, q + r]);
      }
    }

    // A member searching a name expects their own name to win outright; BM25 over the
    // question body never sees the asker, and a Division named in a query should beat a
    // question that merely mentions it in passing.
    if (norm(doc.record.asker).includes(lowered)) score += 6;
    if (doc.record.ministry && norm(doc.record.ministry).includes(lowered)) score += 4;
    if (doc.record.answeredBy && norm(doc.record.answeredBy).includes(lowered)) score += 3;

    if (score <= 0) continue;
    scored.push({
      record: doc.record,
      score,
      matchedTerms: contributions.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
    });
  }

  scored.sort((a, b) => b.score - a.score || (b.record.date ?? '').localeCompare(a.record.date ?? ''));
  return { total: scored.length, hits: scored.slice(offset, offset + limit) };
}

// ── ministry breakdown ─────────────────────────────────────────────────────────────

export interface MinistryStat {
  ministry: string;
  questions: number;
  starred: number;
  unstarred: number;
  answered: number;
  /** Distinct members who put a question to this Division. */
  members: number;
}

/**
 * Which Divisions attract the questions.
 *
 * This is the oversight signal the extraction produces for free, and it is not published
 * anywhere: the Assembly prints the papers but never aggregates them. A Division at the
 * top of this list is under sustained scrutiny; one absent from it is not being asked
 * anything at all, which is the more interesting finding.
 */
export function ministryBreakdown(): MinistryStat[] {
  const map = new Map<
    string,
    MinistryStat & { _members: Set<string>; _spellings: Map<string, number> }
  >();
  for (const q of questionIndex.questions) {
    const label = q.ministry?.trim() || 'Not attributed';
    const key = ministryKey(label);
    let row = map.get(key);
    if (!row) {
      row = {
        ministry: label,
        questions: 0,
        starred: 0,
        unstarred: 0,
        answered: 0,
        members: 0,
        _members: new Set<string>(),
        _spellings: new Map<string, number>(),
      };
      map.set(key, row);
    }
    row.questions += 1;
    if (q.starred) row.starred += 1;
    else row.unstarred += 1;
    if (q.hasReply) row.answered += 1;
    row._members.add(norm(q.asker));
    row._spellings.set(label, (row._spellings.get(label) ?? 0) + 1);
  }
  return [...map.values()]
    .map(({ _members, _spellings, ...rest }) => ({
      ...rest,
      // Display the spelling the papers used most often rather than whichever was seen
      // first — the Assembly's own predominant wording, not an accident of sort order.
      ministry: [..._spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      members: _members.size,
    }))
    .sort((a, b) => b.questions - a.questions || a.ministry.localeCompare(b.ministry));
}

// ── "has this been asked?" ─────────────────────────────────────────────────────────

export type DuplicateRisk = 'likely' | 'possible' | 'unlikely';

export interface SimilarQuestion {
  record: QuestionRecord;
  /** Cosine similarity of the TF-IDF vectors, 0–1. */
  similarity: number;
  /** Terms carrying the similarity, heaviest first. */
  sharedTerms: string[];
  /** Same Division as the draft addresses. */
  sameMinistry: boolean;
  /**
   * Whether this prior question falls inside the window Rule 78(j) draws: the session
   * the draft is for, or the two sessions before it.
   */
  withinRule78jWindow: boolean;
}

export interface DuplicateCheck {
  risk: DuplicateRisk;
  /** Highest similarity found, 0–1. */
  topSimilarity: number;
  matches: SimilarQuestion[];
  /** Terms of the draft that carry weight in this corpus — what the check ran on. */
  queryTerms: string[];
  /** Sessions the index actually covers, so the answer can be scoped honestly. */
  coverage: { sessions: string[]; sittings: number; questions: number; generatedAt: string };
  citation: 'Rule 78(j)';
}

/**
 * Thresholds.
 *
 * Calibrated against the corpus rather than picked: within the ingested papers, two
 * questions from different members on the same subject to the same Division — the
 * Ministry of Information advertising questions of the 28th Session, which the
 * Secretariat itself grouped — land at 0.35–0.60 cosine, while unrelated pairs sit under
 * 0.12 once IDF has removed the shared frame. 0.30 and 0.15 sit either side of that gap.
 * They are deliberately not tight: this check exists to make a member look, not to
 * decide for them.
 */
const LIKELY = 0.3;
const POSSIBLE = 0.15;

export function checkAlreadyAsked(
  draft: string,
  options: { ministry?: string | null; sessionNumber?: number | null; limit?: number } = {}
): DuplicateCheck {
  const index = build();
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 25);

  const tokens = tokenise(draft);
  const tf = counts(tokens);
  const grams = bigrams(tokens);

  const weights = new Map<string, number>();
  let qnorm = 0;
  for (const [term, n] of tf) {
    const idf = index.idf.get(term) ?? 0;
    const w = (1 + Math.log(n)) * idf;
    if (w > 0) {
      weights.set(term, w);
      qnorm += w * w;
    }
  }
  qnorm = Math.sqrt(qnorm);

  const queryTerms = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);

  // Every draft term has zero IDF, meaning it says nothing this corpus has not already
  // heard in every question. There is nothing to match on; say so rather than returning
  // an arbitrary ranking.
  if (qnorm === 0) {
    return {
      risk: 'unlikely',
      topSimilarity: 0,
      matches: [],
      queryTerms,
      coverage: coverage(),
      citation: 'Rule 78(j)',
    };
  }

  const draftMinistry = options.ministry ? norm(options.ministry) : null;
  const target = options.sessionNumber ?? null;

  const scored: SimilarQuestion[] = [];
  for (const doc of index.docs) {
    if (doc.qnorm === 0) continue;
    let dot = 0;
    const shared: Array<[string, number]> = [];
    for (const [term, qw] of weights) {
      const dtf = doc.qtf.get(term);
      if (!dtf) continue;
      const dw = (1 + Math.log(dtf)) * (index.idf.get(term) ?? 0);
      if (dw <= 0) continue;
      dot += qw * dw;
      shared.push([term, qw * dw]);
    }
    if (dot === 0) continue;

    let similarity = dot / (qnorm * doc.qnorm);

    // Two small, bounded adjustments, both in the direction the Secretariat reads it.
    // A repeat put to the same Division is the case Rule 78(j) is actually about; and a
    // shared two-word phrase ("Saidu Sharif", "passport office") is stronger evidence of
    // repeating in substance than the same two words apart.
    const sameMinistry = Boolean(
      draftMinistry &&
        doc.record.ministry &&
        (ministryKey(doc.record.ministry) === ministryKey(draftMinistry) ||
          norm(doc.record.ministry).includes(draftMinistry))
    );
    if (sameMinistry) similarity *= 1.15;
    let overlap = 0;
    for (const g of doc.qbigrams) if (grams.has(g)) overlap += 1;
    if (overlap > 0) similarity *= 1 + Math.min(overlap, 5) * 0.03;
    similarity = Math.min(similarity, 1);

    const n = doc.record.sessionNumber;
    const withinRule78jWindow = target === null || n === null ? true : n >= target - 2 && n <= target;

    scored.push({
      record: doc.record,
      similarity,
      sharedTerms: shared.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
      sameMinistry,
      withinRule78jWindow,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  const matches = scored.slice(0, limit);
  const top = matches[0]?.similarity ?? 0;

  return {
    risk: top >= LIKELY ? 'likely' : top >= POSSIBLE ? 'possible' : 'unlikely',
    topSimilarity: top,
    matches,
    queryTerms,
    coverage: coverage(),
    citation: 'Rule 78(j)',
  };
}

function coverage() {
  return {
    sessions: [...new Set(questionIndex.sittings.map((s) => s.session))],
    sittings: questionIndex.sittingsIngested,
    questions: questionIndex.questionCount,
    generatedAt: questionIndex.generatedAt,
  };
}

/**
 * Facets for the search interface, derived rather than hardcoded.
 *
 * Members are folded the same way Divisions are: the papers print the same member as
 * "Mr. Sohail Sultan" in one sitting and "MR. SOHAIL SULTAN" in the next, and two
 * entries for one member in a filter is a bug the reader has to work around.
 */
export function facets() {
  const members = new Map<string, { label: Map<string, number>; questions: number }>();
  const sessions = new Map<
    string,
    { session: string; sessionId: string; questions: number; date: string | null }
  >();
  for (const q of questionIndex.questions) {
    const key = norm(q.asker).replace(/[.,]/g, '');
    const row = members.get(key) ?? { label: new Map<string, number>(), questions: 0 };
    row.questions += 1;
    row.label.set(q.asker, (row.label.get(q.asker) ?? 0) + 1);
    members.set(key, row);

    const s =
      sessions.get(q.sessionId) ?? { session: q.session, sessionId: q.sessionId, questions: 0, date: q.date };
    s.questions += 1;
    if (q.date && (!s.date || q.date > s.date)) s.date = q.date;
    sessions.set(q.sessionId, s);
  }
  return {
    ministries: ministryBreakdown()
      .filter((m) => m.ministry !== 'Not attributed')
      .map((m) => ({ ministry: m.ministry, questions: m.questions })),
    members: [...members.values()]
      .map((row) => ({
        member: [...row.label.entries()].sort((a, b) => b[1] - a[1])[0][0],
        questions: row.questions,
      }))
      .sort((a, b) => b.questions - a.questions || a.member.localeCompare(b.member)),
    sessions: [...sessions.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  };
}
