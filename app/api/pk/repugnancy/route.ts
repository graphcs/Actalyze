/**
 * Islamic-law constitutional review: retrieval, not adjudication.
 *
 * The shape of this route is the argument. It runs three separate retrievals and keeps
 * their results in three separate buckets, because a drafter's question decomposes into
 * three different questions with three different kinds of answer:
 *
 *   1. WHAT GOVERNS — answered from the Constitution, verbatim. Deterministic: the
 *      Articles come from `lib/pk/repugnancy.ts`, and each is re-retrieved from the
 *      document library so the page can show that the citation is grounded in a
 *      document rather than in the model's memory. An Article that fails to retrieve is
 *      reported as ungrounded rather than quietly shown as though it had.
 *
 *   2. WHAT THE COUNCIL HAS SAID — answered only from Council of Islamic Ideology
 *      documents in the library. If nothing matches, the answer is "nothing was
 *      located", full stop.
 *
 *   3. WHAT THE COURT HAS HELD — answered only from Federal Shariat Court documents.
 *      There are none in the library (the Court's site is down; see FSC_CORPUS_NOTE),
 *      so this bucket is always empty and always says why.
 *
 * ── What the model is and is not asked to do ──────────────────────────────────────
 * The model NEVER decides anything and never writes the page's findings. It is given
 * the passages that vector search already returned and asked two questions about each:
 * is this passage actually on the subject, and what does it record? Its answer is
 * constrained to a JSON object with a boolean and one sentence of reported speech.
 * There is no field in the schema in which a repugnancy conclusion could be expressed,
 * the prompt forbids one in as many words, and `readsAsRuling()` drops the sentence if
 * one appears anyway. The verbatim passage is rendered next to the sentence either way,
 * so the reader always sees the source.
 *
 * If no LLM provider is configured the route still works and simply returns the
 * retrieved passages without summaries. Retrieval is the product; the model is a filter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { searchDocuments } from '@/lib/document-processor';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  REVIEW_ARTICLES,
  REFERENCE_PROCEDURE,
  NO_RULING_DIRECTIVE,
  readsAsRuling,
  isAttributedReport,
  classifySource,
  detectLanguage,
  type ReviewArticle,
} from '@/lib/pk/repugnancy';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────────────
// Wire types
// ─────────────────────────────────────────────────────────────────────────────────────

export interface RetrievedPassage {
  /** Verbatim text from the document. Never model output. */
  quote: string;
  documentTitle: string;
  publisher: string | null;
  jurisdiction: string | null;
  year: number | null;
  sourceUrl: string | null;
  /** Cosine similarity from pgvector, shown so a weak match is visibly weak. */
  relevance: number;
  /**
   * One sentence of reported speech from the model saying what the passage records.
   * Null where no provider is configured, where the model returned nothing, or where
   * `readsAsRuling()` rejected what it returned.
   */
  note: string | null;
  /** True where a note was generated and then dropped by the ruling filter. */
  noteWithheld: boolean;
}

export interface ArticleCitation {
  article: string;
  headingEn: string;
  headingUr: string;
  quoteEn: string;
  quoteUr: string;
  body: 'council' | 'court' | 'both';
  /** True where this Article's own text was found in the document library. */
  grounded: boolean;
  groundedIn: string | null;
}

export interface RepugnancyResponse {
  subject: string;
  language: 'ur' | 'en';
  constitutional: {
    articles: ArticleCitation[];
    /** How many of the Articles were confirmed against the library. */
    groundedCount: number;
    sourceTitle: string | null;
  };
  council: {
    found: boolean;
    passages: RetrievedPassage[];
    /** Titles of the Council documents that were searched, whether or not they hit. */
    corpus: string[];
  };
  court: {
    found: boolean;
    passages: RetrievedPassage[];
    corpusEmpty: boolean;
  };
  procedure: typeof REFERENCE_PROCEDURE;
  /** Diagnostics. Shown in small type so a thin result is legible as a thin result. */
  meta: {
    chunksRetrieved: number;
    provider: string | null;
    notesWithheld: number;
  };
}

interface Chunk {
  content?: string;
  document_title?: string;
  document_jurisdiction?: string;
  document_year?: number;
  similarity?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Publisher and source URL
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * `search_documents` returns title, jurisdiction and year but not `metadata`, and the
 * RPC is shared with the US build so its signature is not this build's to change. The
 * publisher and the link to the original live in `documents.metadata`, and a citation a
 * reader cannot open is half a citation — so they are fetched here, in one read keyed
 * by the handful of titles retrieval actually returned.
 *
 * Read-only, on a table this route never writes to.
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.ACTALYZE_SUPABASE_URL;
    const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseClient;
}

interface DocumentProvenance {
  publisher: string | null;
  sourceUrl: string | null;
}

async function loadProvenance(titles: string[]): Promise<Map<string, DocumentProvenance>> {
  const map = new Map<string, DocumentProvenance>();
  if (titles.length === 0) return map;

  const db = getSupabase();
  if (!db) return map;

  try {
    const { data, error } = await db
      .from('documents')
      .select('title,metadata')
      .in('title', titles)
      .limit(50);
    if (error) {
      // Non-fatal: the passage still renders with its title, year and jurisdiction.
      console.error('Repugnancy provenance lookup failed:', error.message);
      return map;
    }
    for (const row of data || []) {
      const metadata = (row.metadata || {}) as { publisher?: string; source_url?: string };
      map.set(row.title as string, {
        publisher: metadata.publisher ?? null,
        sourceUrl: metadata.source_url ?? null,
      });
    }
  } catch (err) {
    console.error('Repugnancy provenance lookup threw:', err);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Retrieval
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Ground the constitutional citations against the Constitution held in the library.
 *
 * ── Why this is a literal check and not a vector search ───────────────────────────
 * The obvious implementation — embed each Article's text, see whether the Constitution
 * comes back — was written first and it does not work, for a reason that is a property
 * of the shared index rather than of the idea. `document_chunks` is indexed with
 * `ivfflat ... WITH (lists = 100)` and pgvector's `ivfflat.probes` defaults to 1, so a
 * query sees about a hundredth of the table. Thirteen Articles searched that way
 * grounded five. The other eight are in the library — they are in the wrong cluster.
 *
 * But "is Article 203D in the Constitution we hold" was never a similarity question.
 * It is a containment question, and `documents.content` holds the whole extracted text.
 * So each Article carries a short exact `groundingPhrase` and this checks for it
 * literally, after collapsing whitespace on both sides — PDF extraction breaks lines
 * mid-sentence, so a raw `includes` would fail on text that is plainly present.
 *
 * That makes the badge on the page a stronger claim than the original design could
 * make. It no longer says "something about this Article came back from a search". It
 * says "this phrase appears verbatim in the document in the library", which means a
 * quotation in `lib/pk/repugnancy.ts` that had drifted from the source would show up as
 * an unconfirmed Article rather than as a confident misquotation.
 *
 * ── Why the result is cached for the process lifetime ─────────────────────────────
 * It does not depend on the user's subject: it is the same thirteen checks against the
 * same document every time, and that document changes only when someone re-ingests the
 * Constitution. The cache is per-instance and dies with the process, which is the right
 * TTL for "is this document still in the library" — a restart is the cheapest possible
 * way to be wrong for less time.
 */
let groundingCache: { articles: ArticleCitation[]; sourceTitle: string | null } | null = null;

/** Collapse whitespace and normalise the quotation marks PDF extraction varies on. */
function normalise(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

async function groundArticles(): Promise<{
  articles: ArticleCitation[];
  sourceTitle: string | null;
}> {
  if (groundingCache) return groundingCache;

  let haystack = '';
  let sourceTitle: string | null = null;

  const db = getSupabase();
  if (db) {
    try {
      const { data, error } = await db
        .from('documents')
        .select('title,content')
        .ilike('title', '%Constitution of the Islamic Republic of Pakistan%')
        .eq('is_active', true)
        .limit(1);
      if (error) {
        console.error('Repugnancy grounding lookup failed:', error.message);
      } else if (data?.[0]) {
        sourceTitle = data[0].title as string;
        haystack = normalise((data[0].content as string) || '');
      }
    } catch (err) {
      console.error('Repugnancy grounding lookup threw:', err);
    }
  }

  // No Constitution in the library means nothing is grounded. The Articles are still
  // shown — they are what governs review whether or not this deployment holds the
  // document — but every badge reads "not confirmed against the library", which is the
  // truthful state of affairs rather than a silent pass.
  const articles = REVIEW_ARTICLES.map((a: ReviewArticle): ArticleCitation => {
    const grounded = haystack.length > 0 && haystack.includes(normalise(a.groundingPhrase));
    return {
      article: a.article,
      headingEn: a.headingEn,
      headingUr: a.headingUr,
      quoteEn: a.quoteEn,
      quoteUr: a.quoteUr,
      body: a.body,
      grounded,
      groundedIn: grounded ? sourceTitle : null,
    };
  });

  groundingCache = { articles, sourceTitle };
  return groundingCache;
}

/**
 * Search the subject from several angles, and union the results.
 *
 * ── The problem this solves, which is a property of the shared index ──────────────
 * `document_chunks.embedding` is indexed with `ivfflat (vector_cosine_ops) WITH
 * (lists = 100)` and pgvector's `ivfflat.probes` defaults to 1. Every query therefore
 * scans ONE of a hundred clusters — roughly 1% of the table — and everything outside
 * that cluster is invisible no matter how well it matches. Measured against this
 * corpus: "Zakat deduction from bank accounts" returned four chunks in total at a
 * threshold of 0.05, and not one of them was from the Zakat and Ushr Ordinance sitting
 * in the index with 133 chunks.
 *
 * `probes` is a session GUC. It cannot be set through a PostgREST RPC call, and the
 * index belongs to the schema the US build shares, so neither is this build's to
 * change. What IS available is the observation that a different query vector lands in a
 * different cluster. Three queries probe three clusters.
 *
 * ── Why these three ───────────────────────────────────────────────────────────────
 * They are deterministic string concatenations, not model-generated paraphrases.
 * Nothing is invented, and the same subject always produces the same three searches:
 *
 *   1. the subject exactly as the drafter wrote it;
 *   2. the subject in the vocabulary of the Council's own Urdu reports, which is where
 *      the Council corpus actually lives — an English subject will not land near
 *      Urdu chunks without it;
 *   3. the subject in the vocabulary of Article 227 and Article 203D, which is how the
 *      Constitution and any judgment would phrase it.
 *
 * Results are unioned on chunk content and keep the best similarity each achieved, so a
 * chunk found by two angles is ranked by its strongest match rather than counted twice.
 */
const COUNCIL_ANGLE = 'اسلامی نظریاتی کونسل کی سفارشات اور رائے — Council of Islamic Ideology recommendation on';
const REVIEW_ANGLE =
  'repugnant to the Injunctions of Islam as laid down in the Holy Quran and Sunnah, examined under Article 227 and Article 203D —';

async function searchFromSeveralAngles(subject: string): Promise<Chunk[]> {
  const queries = [subject, `${COUNCIL_ANGLE} ${subject}`, `${REVIEW_ANGLE} ${subject}`];

  const batches = await Promise.all(
    queries.map((q) => searchDocuments(q, { limit: 24, threshold: 0.25 }))
  );

  const best = new Map<string, Chunk>();
  for (const { results } of batches) {
    for (const chunk of (results || []) as Chunk[]) {
      const key = `${chunk.document_title}::${(chunk.content || '').slice(0, 120)}`;
      const seen = best.get(key);
      if (!seen || (chunk.similarity ?? 0) > (seen.similarity ?? 0)) best.set(key, chunk);
    }
  }

  return dropNearDuplicates(
    [...best.values()].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
  );
}

/**
 * Drop passages that are substantially the same text as one already accepted.
 *
 * Chunking runs with `overlap: 200` against a `chunk_size` of 800, so consecutive
 * chunks share up to a quarter of their text by design — and a subject that sits inside
 * that shared run comes back twice. Exact-content de-duplication does not catch it,
 * because the two chunks genuinely differ at their edges. What a reader sees is the
 * same recommendation quoted twice, a few words apart, which makes a single finding
 * look like two and makes the tool look like it is padding.
 *
 * Word-level Jaccard over the chunk texts, keeping the higher-ranked of any pair above
 * the threshold. 0.5 is well above what two genuinely different passages on one subject
 * score and well below what a 200-character overlap produces.
 */
const NEAR_DUPLICATE_THRESHOLD = 0.5;

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s.,;:()[\]"'،۔]+/)
      .filter((w) => w.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared);
}

function dropNearDuplicates(chunks: Chunk[]): Chunk[] {
  const kept: Array<{ chunk: Chunk; words: Set<string> }> = [];
  for (const chunk of chunks) {
    const words = wordSet(chunk.content || '');
    const duplicate = kept.some(
      (k) =>
        k.chunk.document_title === chunk.document_title &&
        jaccard(k.words, words) >= NEAR_DUPLICATE_THRESHOLD
    );
    if (!duplicate) kept.push({ chunk, words });
  }
  return kept.map((k) => k.chunk);
}

function toPassage(chunk: Chunk, provenance: Map<string, DocumentProvenance>): RetrievedPassage {
  const title = chunk.document_title || 'Untitled';
  const source = provenance.get(title);
  return {
    quote: (chunk.content || '').trim(),
    documentTitle: title,
    publisher: source?.publisher ?? null,
    jurisdiction: chunk.document_jurisdiction ?? null,
    year: chunk.document_year ?? null,
    sourceUrl: source?.sourceUrl ?? null,
    relevance: chunk.similarity ?? 0,
    note: null,
    noteWithheld: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// The model's only job
// ─────────────────────────────────────────────────────────────────────────────────────

const TRIAGE_SCHEMA = `{
  "passages": [
    { "id": 1, "onSubject": true,  "anchor": "words copied exactly from passage 1", "records": "one sentence of reported speech" },
    { "id": 2, "onSubject": false, "anchor": "", "records": "" }
  ]
}`;

function buildTriagePrompt(language: 'ur' | 'en', bodyLabel: string): string {
  return `${NO_RULING_DIRECTIVE}

YOUR TASK.

You are given numbered passages that a vector search returned from published documents
of the ${bodyLabel}. For each passage, decide two things and nothing else:

  onSubject — is THIS passage, in the text printed below its number, genuinely about the
              subject the user asked about? Vector search returns nearest neighbours
              whether or not any of them are close, and these documents are long, so a
              passage often sits a page away from the thing that matched. Judge only the
              words in front of you. A passage about a NEIGHBOURING topic, or one that
              merely mentions the subject in a heading or a page footer, is NOT on the
              subject. When in doubt, false: a passage wrongly included is put in front
              of a drafter as a citation.

  anchor    — if and only if onSubject is true, between three and ten words COPIED
              CHARACTER FOR CHARACTER from that passage, which are the words that make
              it on-subject. Do not translate them, do not tidy them, do not correct
              their spelling: copy them. This is checked against the passage text, and a
              passage whose anchor cannot be found in it is discarded along with your
              summary of it. If onSubject is false, return an empty string.

  records   — if and only if onSubject is true, ONE sentence in reported speech saying
              what this passage records. Begin with the body that said it. For example:
              "The Council's report records a recommendation that …",
              "The passage sets out the Council's observation that …".
              It must describe THE PASSAGE YOU ANCHORED IN, not the general subject and
              not what a neighbouring passage said. Do not state a date, a report number
              or a session unless it appears in the passage itself. If onSubject is
              false, return an empty string.

RULES FOR "records":
  - Reported speech only. Every sentence must attribute what it says to the body whose
    document it came from. Never write a sentence that reads as your own assessment.
  - Never characterise the subject as repugnant, as not repugnant, or as raising or not
    raising a question of repugnancy. Report only what the passage itself states.
  - Do not add context the passage does not contain. Do not say what the recommendation
    "means for" the user's draft. Do not draw an implication.
  - One sentence. No preamble, no markdown.

LANGUAGE: write every "records" sentence in ${language === 'ur' ? 'Urdu (اردو)' : 'English'}.${
    language === 'ur'
      ? ' Use natural Urdu of the register the Council itself writes in. Keep Article numbers, Latin acronyms and Western digits in their original form.'
      : ''
  }

Return ONLY a JSON object of this exact shape, one entry per passage:
${TRIAGE_SCHEMA}`;
}

/**
 * Ask the model which passages are on-subject, and what each records.
 *
 * Returns the passages with `note` set, `onSubject` false ones removed, and a count of
 * notes the ruling filter withheld. On any failure — no provider, HTTP error,
 * unparseable JSON — every passage is kept with a null note, because showing a real
 * retrieved passage without a summary is strictly better than showing nothing.
 */
async function triage(
  passages: RetrievedPassage[],
  subject: string,
  language: 'ur' | 'en',
  bodyLabel: string
): Promise<{ kept: RetrievedPassage[]; provider: string | null; withheld: number }> {
  if (passages.length === 0) return { kept: [], provider: null, withheld: 0 };

  const provider = chatCompletions();
  if (!provider) return { kept: passages, provider: null, withheld: 0 };

  const numbered = passages
    .map((p, i) => `[${i + 1}] From "${p.documentTitle}"${p.year ? ` (${p.year})` : ''}:\n${p.quote.slice(0, 2200)}`)
    .join('\n\n---\n\n');

  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: buildTriagePrompt(language, bodyLabel) },
          {
            role: 'user',
            content: `SUBJECT THE DRAFTER ASKED ABOUT:\n${subject}\n\nPASSAGES:\n\n${numbered}\n\nRespond with JSON only.`,
          },
        ],
        // There is a right answer to "is this passage about this subject". Variation is
        // only a way to get it wrong.
        temperature: 0.1,
        max_tokens: 1600,
        // OpenRouter's Perplexity models reject response_format; the prompt asks for
        // JSON either way and the parse below tolerates a fenced reply.
        ...(provider.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.error(`Repugnancy triage failed: ${response.status}`);
      return { kept: passages, provider: provider.provider, withheld: 0 };
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/^\s*```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();

    let parsed: {
      passages?: Array<{ id?: number; onSubject?: boolean; anchor?: string; records?: string }>;
    } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Repugnancy triage: unparseable model response');
      return { kept: passages, provider: provider.provider, withheld: 0 };
    }

    const verdicts = new Map(
      (parsed.passages ?? [])
        .filter((v) => typeof v?.id === 'number')
        .map((v) => [v.id as number, v])
    );

    let withheld = 0;
    const kept: RetrievedPassage[] = [];

    passages.forEach((p, i) => {
      const verdict = verdicts.get(i + 1);
      // No verdict for a passage means the model did not answer for it. Drop it rather
      // than present an unvetted passage as a located recommendation — an absent
      // judgement is not a positive one.
      if (!verdict || verdict.onSubject !== true) return;

      // The anchor test.
      //
      // Reading a long Urdu report, the model will occasionally attach a summary to the
      // wrong passage — it describes something true that it read a page earlier, and
      // pins it to whichever chunk came back. That produces the single most damaging
      // artefact this page could ship: an accurate-sounding sentence sitting above a
      // quotation that does not say it.
      //
      // So a passage is only kept if the model can produce a few words copied out of it
      // verbatim. It is a cheap, checkable proof that the summary was written from the
      // text underneath it rather than from the subject. Whitespace is normalised on
      // both sides because PDF extraction breaks lines inside sentences.
      const anchor = normalise(verdict.anchor || '');
      if (anchor.length < 8 || !normalise(p.quote).includes(anchor)) {
        console.warn(
          `Repugnancy: dropped a passage whose anchor was not found in it — "${(verdict.anchor || '').slice(0, 60)}"`
        );
        return;
      }

      // Two independent tests, and a note must survive both. `readsAsRuling` is a
      // blacklist of verdict phrasings; `isAttributedReport` is the whitelist that
      // catches everything the blacklist did not anticipate, by requiring the sentence
      // to open by naming what said it. Failing either drops the note and keeps the
      // passage — the reader loses a summary, never a source.
      const note = (verdict.records || '').trim();
      if (note && (readsAsRuling(note) || !isAttributedReport(note))) {
        withheld++;
        console.warn(`Repugnancy: withheld a model note that did not read as attributed reporting: ${note.slice(0, 120)}`);
        kept.push({ ...p, note: null, noteWithheld: true });
        return;
      }
      kept.push({ ...p, note: note || null, noteWithheld: false });
    });

    return { kept, provider: provider.provider, withheld };
  } catch (error) {
    console.error('Repugnancy triage error:', error);
    return { kept: passages, provider: provider.provider, withheld: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Public route; every call spends embeddings plus a completion.
    const limited = checkRateLimit(request, 'pk-repugnancy', { limit: 15, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await request.json()) as { subject?: string; locale?: 'en' | 'ur' };
    const subject = body.subject?.trim();

    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }
    if (subject.length > 6000) {
      return NextResponse.json({ error: 'subject is too long' }, { status: 400 });
    }

    // Answer in the language of the question, falling back to the interface language
    // for a subject that carries no script signal at all (a bare clause number).
    const language = /\p{L}/u.test(subject)
      ? detectLanguage(subject)
      : body.locale === 'ur'
        ? 'ur'
        : 'en';

    // Retrieval, then split by issuing body. There is no per-publisher filter to push
    // down into the RPC, so the split happens here on the document title.
    const [{ articles, sourceTitle }, chunks] = await Promise.all([
      groundArticles(),
      searchFromSeveralAngles(subject),
    ]);

    const councilChunks = chunks.filter(
      (c) => classifySource(c.document_title || '') === 'council'
    );
    const courtChunks = chunks.filter((c) => classifySource(c.document_title || '') === 'court');

    // Six is the most a drafter will read. Ranked by pgvector, so this is the top six.
    const shortlist = [...councilChunks.slice(0, 6), ...courtChunks.slice(0, 6)];
    const provenance = await loadProvenance([
      ...new Set(shortlist.map((c) => c.document_title || 'Untitled')),
    ]);

    const councilCandidates = councilChunks.slice(0, 6).map((c) => toPassage(c, provenance));
    const courtCandidates = courtChunks.slice(0, 6).map((c) => toPassage(c, provenance));

    const [council, court] = await Promise.all([
      triage(councilCandidates, subject, language, 'Council of Islamic Ideology of Pakistan'),
      triage(courtCandidates, subject, language, 'Federal Shariat Court of Pakistan'),
    ]);

    // Which Council documents were in scope at all. Distinguishes "the Council has said
    // nothing on this" from "there is no Council material to search", which are very
    // different answers and look identical if you only report the hit count.
    const corpus = [
      ...new Set(
        chunks
          .filter((c) => classifySource(c.document_title || '') === 'council')
          .map((c) => c.document_title as string)
      ),
    ];

    const payload: RepugnancyResponse = {
      subject,
      language,
      constitutional: {
        articles,
        groundedCount: articles.filter((a) => a.grounded).length,
        sourceTitle,
      },
      council: {
        found: council.kept.length > 0,
        passages: council.kept,
        corpus,
      },
      court: {
        found: court.kept.length > 0,
        passages: court.kept,
        corpusEmpty: courtChunks.length === 0,
      },
      procedure: REFERENCE_PROCEDURE,
      meta: {
        chunksRetrieved: chunks.length,
        provider: council.provider ?? court.provider,
        notesWithheld: council.withheld + court.withheld,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Repugnancy research error:', error);
    return NextResponse.json({ error: 'Research request failed' }, { status: 500 });
  }
}

/** The constitutional framework, so the page can render it before any query runs. */
export async function GET() {
  return NextResponse.json({
    articles: REVIEW_ARTICLES,
    procedure: REFERENCE_PROCEDURE,
    source:
      'The Constitution of the Islamic Republic of Pakistan, 1973 (as modified upto the 31st May, 2018)',
    sourceUrl: 'https://www.pakp.gov.pk/wp-content/uploads/2024/07/Constitution.pdf',
  });
}
