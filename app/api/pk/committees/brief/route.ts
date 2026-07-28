import { NextRequest, NextResponse } from 'next/server';
import { serverCache, generateCacheKey } from '@/src/lib/cache';
import { getFromDbCache, setInDbCache, generateDistrictCacheKey } from '@/lib/db-cache';
import { chatCompletions } from '@/lib/ai-provider';
import { searchDocuments } from '@/lib/document-processor';
import { COUNTRY_SEARCH_LOCALE } from '@/lib/country';
import { party } from '@/lib/pk/parties';
import {
  blocBreakdown,
  getCommittee,
  newsQueries,
  partyBreakdown,
  ruleQueries,
  type PkCommittee,
} from '@/lib/pk/committees';

/**
 * The oversight pack for one committee: governing rules, subject-area coverage, and
 * suggested lines of questioning.
 *
 * This is the night-before-the-meeting document. Three things it must never do, in
 * order of how badly each one would land in a committee room:
 *
 *  1. **Never state a rule it has not retrieved.** A model asked "what rule governs
 *     standing committees in Pakistan" will produce a confident rule number, and the
 *     Committee on Rules of Procedure and Privileges is one of the committees this
 *     page serves. So the rules section is not generated at all: it is the retrieved
 *     text of the Rules of Procedure and Conduct of Business in the National Assembly,
 *     2007 from the document library, shown with the rule number the document itself
 *     carries, and it renders empty rather than approximate.
 *
 *  2. **Never present a suggested question as the committee's position.** The
 *     questions are drafting aid for a secretary, generated only from the retrieved
 *     coverage and the committee's own record, and every one carries the source it
 *     came from. The API says `suggested: true` and the UI says so on the page.
 *
 *  3. **Never invent membership.** Composition does not pass through here at all —
 *     it comes from `/api/pk/committees`, which is local data with no model in the
 *     path. What this route sees of the committee is its name, its chairman and the
 *     titles of reports it has already presented to the House.
 *
 * GET /api/pk/committees/brief?slug=finance-and-revenue[&lang=ur][&skip=news]
 */

// ── Rules retrieval ────────────────────────────────────────────────────────────────

/**
 * The Rules of Procedure in the library. Matched on title rather than id so a re-ingest
 * with a new row does not silently drop the rules section.
 */
const RULES_TITLE = /rules of procedure and conduct of business/i;

/**
 * The chapter heading the 2007 Rules print above the committee rules:
 * `CHAPTER XX COMMITTEES PART-I STANDING COMMITTEES AND GENERAL PROVISIONS…`.
 * Its presence in a retrieved chunk is the document's own statement that the rule
 * which follows opens the committee chapter.
 */
const CHAPTER_HEAD = /CHAPTER\s+[IVXLC]+\s+COMMITTEES/i;

interface RetrievedChunk {
  content?: string;
  document_title?: string;
  document_year?: number;
  document_jurisdiction?: string;
  similarity?: number;
  metadata?: { source_url?: string } | null;
}

export interface PkRuleCitation {
  /** The rule number as printed in the document, e.g. "200". Null when unnumbered. */
  rule: string | null;
  /** The rule's own marginal heading, where the chunk carries one. */
  heading: string | null;
  excerpt: string;
  documentTitle: string;
  documentYear: number | null;
  similarity: number;
  /**
   * True for the rule that states what a committee's subject matter IS, rather than
   * how it works. That rule is the committee's remit, and the page leads with it.
   */
  isRemit?: boolean;
}

/**
 * Repair letter-spacing artefacts from the PDF's text layer.
 *
 * The 2007 Rules extract cleanly for the most part, but justified lines come out as
 * `T h e  C o m m i tt e e  s h a l l`. Left alone that is unreadable, and it is the
 * kind of defect that makes a reader distrust the citation itself. Only runs of three
 * or more single characters are joined, which cannot touch ordinary prose — no English
 * sentence contains three consecutive one-letter words.
 */
function repairSpacing(text: string): string {
  return text.replace(/(?:\b\S\s){3,}\S\b/g, (run) => run.replace(/\s+/g, ''));
}

/**
 * Join two overlapping extracts of the same rule.
 *
 * Chunks overlap by design, so the same rule arrives split across two of them with a
 * shared middle. Returning both would print the rule twice; returning one drops half
 * of it. Finds the longest suffix of `a` that opens `b` and stitches. Returns null
 * when they do not overlap, which is the signal to keep them apart.
 */
function stitch(a: string, b: string, min = 40): string | null {
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= min; n -= 1) {
    if (a.endsWith(b.slice(0, n))) return a + b.slice(n);
  }
  if (a.includes(b)) return a;
  if (b.includes(a)) return b;
  return null;
}

/**
 * Pull rule numbers out of retrieved text.
 *
 * The 2007 Rules are printed as `199. Committees to be appointed.—(1) …`: a number, a
 * full stop, a marginal heading, then an em-dash. That shape is distinctive enough to
 * anchor on, and anchoring on it is what lets the page cite a rule number that is in
 * the document rather than one the model believes in.
 *
 * A chunk can span a rule boundary, so this returns every rule that opens inside it.
 */
function ruleHeadings(text: string): Array<{ rule: string; heading: string; at: number }> {
  const out: Array<{ rule: string; heading: string; at: number }> = [];
  const re = /(?:^|\n|\s)(\d{1,3})\.\s+([A-Z][^.\n]{3,80}?)\.\s*[—–-]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ rule: m[1], heading: m[2].trim(), at: m.index });
  }
  return out;
}

/**
 * Trim to whole sentences so a citation never ends mid-word.
 *
 * Generous, because a rule cut in half is a misquote: rule 198 runs to about 800
 * characters and its second sub-rule — the one that says what a committee's subject
 * matter is — is the half a reader needs.
 */
function excerpt(text: string, max = 1100): string {
  const clean = text
    .replace(/\s+/g, ' ')
    // Footnote apparatus. The printed Rules carry a rule of underscores or em-dashes
    // and then the amendment history — "1 Substituted vide S.R.O. No. 281(I)/2018".
    // It is real text from the document, but it is not the rule, and printing it in a
    // citation makes the rule look like it ends mid-thought.
    .replace(/[_—–-]{6,}[\s\S]*$/, '')
    .replace(/\s*\d?\s*(?:Substituted|Subs\.|Inserted|Ins\.|Added|Omitted|Deleted)\s+vide[\s\S]*$/i, '')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${(stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim()}…`;
}

/**
 * Retrieve the rules that govern this committee.
 *
 * Runs the committee-specific query ladder and keeps only chunks that came from the
 * Rules of Procedure — a semantic search over a library that also holds the
 * Constitution and the Elections Act will happily return a constitutional article for
 * a question about committee procedure, and an article is not a rule.
 */
async function retrieveRules(
  c: PkCommittee
): Promise<{ citations: PkRuleCitation[]; documentTitle: string | null; queriesRun: string[] }> {
  interface Span {
    rule: string | null;
    heading: string | null;
    text: string;
    similarity: number;
    year: number | null;
    title: string;
    /**
     * True where the document itself puts this rule at the head of its Committees
     * chapter — the chunk carries "CHAPTER XX COMMITTEES" immediately before the rule.
     * That is the document saying which rule constitutes committees, so the pack keeps
     * it whatever it scores. Read from the retrieved text; nothing is hard-coded.
     */
    chapterOpener: boolean;
  }

  const numbered = new Map<string, Span>();
  const loose: Span[] = [];
  const queriesRun: string[] = [];
  let documentTitle: string | null = null;

  for (const query of ruleQueries(c)) {
    queriesRun.push(query);
    // A wide net. The rule that defines a committee's remit comes back at a similarity
    // of about 0.46 on the query that reaches it at all — it is the fifth or sixth
    // rule in that result set, so a limit of ten or twenty cuts it off. The band
    // filter below, not the retrieval limit, is what keeps the citation list tight.
    const { results } = await searchDocuments(query, { limit: 25, threshold: 0.15 });
    const chunks = (results ?? []) as unknown as RetrievedChunk[];
    const fromRules = chunks.filter((x) => RULES_TITLE.test(x.document_title ?? ''));
    console.log(
      `📖 [rules] "${query.slice(0, 46)}…" → ${chunks.length} chunk(s), ${fromRules.length} from the Rules ` +
        `[${fromRules.flatMap((x) => ruleHeadings(x.content ?? '').map((h) => h.rule)).join(' ')}]`
    );

    for (const chunk of chunks) {
      const title = chunk.document_title ?? '';
      if (!RULES_TITLE.test(title)) continue;
      const content = repairSpacing((chunk.content ?? '').replace(/\s+/g, ' ')).trim();
      if (content.length < 80) continue;
      documentTitle = documentTitle ?? title;

      const headings = ruleHeadings(content);
      // Where a chunk opens rules, split it at each heading so the excerpt printed
      // under "202. Public Accounts Committee." is that rule's own text. A chunk that
      // opens no rule is a continuation of one that started in a neighbouring chunk.
      // Text before the chunk's first rule heading belongs to a rule that opened in
      // the previous chunk. Dropping it loses real rule text — it is where sub-rule
      // 198(2), the sentence that defines a committee's subject matter, actually
      // lives — so it is emitted as a loose span and folded back below.
      if (headings.length && headings[0].at > 120) {
        loose.push({
          rule: null,
          heading: null,
          text: content.slice(0, headings[0].at).trim(),
          similarity: chunk.similarity ?? 0,
          year: chunk.document_year ?? null,
          title,
          chapterOpener: false,
        });
      }

      const spans: Span[] = headings.length
        ? headings.map((h, i) => ({
            rule: h.rule,
            heading: h.heading,
            text: content.slice(h.at, headings[i + 1]?.at ?? content.length).trim(),
            similarity: chunk.similarity ?? 0,
            year: chunk.document_year ?? null,
            title,
            chapterOpener: CHAPTER_HEAD.test(content.slice(Math.max(0, h.at - 160), h.at)),
          }))
        : [
            {
              rule: null,
              heading: null,
              text: content,
              similarity: chunk.similarity ?? 0,
              year: chunk.document_year ?? null,
              title,
              chapterOpener: false,
            },
          ];


      for (const span of spans) {
        if (span.rule === null) {
          loose.push(span);
          continue;
        }
        const existing = numbered.get(span.rule);
        if (!existing) {
          numbered.set(span.rule, span);
          continue;
        }
        // Same rule from two chunks: stitch them if they overlap, otherwise keep
        // whichever extract is longer.
        const joined = stitch(existing.text, span.text) ?? stitch(span.text, existing.text);
        existing.text = joined ?? (span.text.length > existing.text.length ? span.text : existing.text);
        existing.similarity = Math.max(existing.similarity, span.similarity);
        existing.chapterOpener = existing.chapterOpener || span.chapterOpener;
      }
    }

    // No early exit. `search_documents` is an approximate-nearest-neighbour search
    // and its recall per query is narrow and uneven — measured on this corpus, one
    // query in the ladder returns a single chunk above threshold while the next
    // returns twenty. Stopping at the first query that looks productive therefore
    // drops rules that a later query would have found, including rule 198 itself.
    // Every query in the ladder runs and the union is taken; it is one embedding call
    // each, against a result cached for twelve hours.
  }

  // A chunk with no rule heading is the middle of a rule that opened earlier. Where
  // it overlaps a rule already cited, fold it in — that is how the second half of
  // rule 198, which is the sentence that actually defines a committee's remit, gets
  // attached to rule 198 instead of being printed as an orphan fragment.
  const orphans: Span[] = [];
  for (const span of loose) {
    let folded = false;
    for (const existing of numbered.values()) {
      const joined = stitch(existing.text, span.text) ?? stitch(span.text, existing.text);
      if (joined) {
        existing.text = joined;
        folded = true;
        break;
      }
    }
    if (!folded) orphans.push(span);
  }

  // Rank by retrieval score, THEN present in rule order. Ranking first keeps rule 198
  // ahead of rule 148 (which is about bills, and matches the same words); presenting
  // in rule order keeps a reader following along in the printed Rules.
  // A relevance band rather than a fixed count. Semantic search over a 414-chunk rule
  // book returns a long tail of rules that share vocabulary without sharing subject —
  // rule 148 is about referring a Bill to a standing committee and matches every query
  // about standing committees, but it is not one of the rules that governs one. Keeping
  // only what scores close to the best match drops that tail without hard-coding which
  // rules are allowed to appear.
  const isRemitSpan = (s: Span) =>
    /subjects?\s+assigned/i.test(s.text) && /Division|Ministry/i.test(s.text);

  /**
   * A rule that names this committee.
   *
   * The Rules name the five non-ministerial committees and give each its own rules —
   * the Public Accounts Committee, Rules of Procedure and Privileges, House and
   * Library, Government Assurances, Business Advisory. Those rules ARE the committee's
   * governing law and must not be ranked out by a general procedural rule that happens
   * to score higher.
   *
   * Restricted to the non-ministerial committees on purpose. The Rules do not name any
   * of the 34 ministry committees, so applying a name match to them would only match
   * on an incidental word — rule 198 mentions the Ministry of Law and Justice, which
   * is not a rule about the Standing Committee on Law and Justice.
   */
  const nameWords =
    c.kind === 'standing'
      ? []
      : c.name
          .replace(/\(.*?\)/g, ' ')
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter((w) => w.length > 3 && !['and', 'the', 'committee', 'special'].includes(w));

  const namesCommittee = (s: Span) =>
    nameWords.length > 0 && nameWords.every((w) => s.text.toLowerCase().includes(w));

  const byScore = [...numbered.values()].sort((a, b) => b.similarity - a.similarity);
  const best = byScore[0]?.similarity ?? 0;
  const ranked = byScore.filter((s, i) => i < 3 || s.similarity >= best - 0.08).slice(0, 6);

  // Two citations are never dropped for score: the rule the document places at the
  // head of its Committees chapter, and the rule that states what a committee's
  // subject matter is. Both come back on a low similarity — the query that reaches
  // them is aimed at the chapter rather than at them — and a pack that ranks them out
  // has lost the one thing the first card on the page is for.
  for (const keep of byScore
    .filter((s) => s.chapterOpener || isRemitSpan(s) || namesCommittee(s))
    .reverse()) {
    if (!ranked.includes(keep)) ranked.unshift(keep);
  }

  const topUp = ranked.length >= 3 ? [] : orphans.sort((a, b) => b.similarity - a.similarity).slice(0, 2);

  const citations: PkRuleCitation[] = [...ranked, ...topUp]
    .sort((a, b) => {
      if (a.rule && b.rule) return Number(a.rule) - Number(b.rule);
      if (a.rule) return -1;
      if (b.rule) return 1;
      return b.similarity - a.similarity;
    })
    .map((s) => ({
      rule: s.rule,
      heading: s.heading,
      // The rule number and its marginal heading are shown as the citation's own
      // label, so leave them off the front of the quotation — otherwise every
      // citation reads "Rule 198 — Committees of the Assembly / 198. Committees of
      // the Assembly.- (1) …". The quotation still begins at the rule's first word.
      excerpt: excerpt(
        s.rule && s.heading
          ? s.text.replace(
              new RegExp(`^${s.rule}\\.\\s*${s.heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\.\\s*[—–-]\\s*`),
              ''
            )
          : s.text
      ),
      documentTitle: s.title,
      documentYear: s.year,
      similarity: s.similarity,
      // The remit sentence: "Each Committee shall deal with the subjects assigned …
      // to the Division or the Ministry with which it is concerned". Flagged from the
      // retrieved text, not asserted — if it is not retrieved, the page says so.
      isRemit: isRemitSpan(s),
    }));

  return { citations, documentTitle, queriesRun };
}

// ── Subject-area news ──────────────────────────────────────────────────────────────

export interface PkCommitteeHeadline {
  title: string;
  url: string;
  source: string;
  date?: string;
  snippet?: string;
}

/**
 * Indian SUBJECT MATTER, not Indian outlets — the same list and the same reasoning as
 * `/api/pk/news`. Pakistan and India share place names and a shared-language press, and
 * Indian outlets carry genuine Pakistan coverage, so filtering by outlet would throw
 * away real results. These terms are specific to Indian politics and Indian government
 * programmes: an article mentioning Lok Sabha or a Yojana scheme is about India
 * whoever published it.
 */
const INDIA_SUBJECT_TERMS = [
  'modi',
  'bjp',
  'lok sabha',
  'rajya sabha',
  'ayushman',
  'yojana',
  'crore',
  'amritsar',
  'chandigarh',
  'ludhiana',
  'rahul gandhi',
  'new delhi',
  'aam aadmi',
  'nda government',
];

function isIndianSubject(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return INDIA_SUBJECT_TERMS.some((term) => lower.includes(term));
}

/**
 * A POSITIVE test for Pakistani subject matter, which the constituency route does not
 * need and this one cannot do without.
 *
 * A constituency query carries "NA-121" or a member's name and lands in Pakistan on
 * its own. A committee query is generic by construction — "Public Accounts Committee",
 * "Business Advisory Committee", "Standing Committee on Commerce" — and every
 * Commonwealth parliament has the same bodies under the same names. Measured on the
 * PAC query with `gl=pk`: three of nine results were Kenya's Public Accounts Committee
 * from The Eastleigh Voice, and one of them had already been used to draft a question
 * about Kenyan audit delays for a Pakistani ministry. A blocklist cannot fix that;
 * there is no end to the list of other countries' parliaments.
 *
 * So an article has to earn its place. Note the asymmetry with `isIndianSubject`,
 * which is a subject-matter EXCLUSION and never looks at the outlet: here the outlet
 * is only ever a reason to KEEP something. An Indian or British paper reporting on
 * Pakistan still passes on its subject tokens, which is the behaviour the constituency
 * route was built for and this preserves.
 */
const PAKISTAN_SUBJECT_TERMS = [
  'pakistan',
  'islamabad',
  'karachi',
  'lahore',
  'peshawar',
  'quetta',
  'rawalpindi',
  'multan',
  'faisalabad',
  'sindh',
  'balochistan',
  'khyber pakhtunkhwa',
  'gilgit',
  'national assembly',
  'majlis-e-shoora',
  'mna ',
  'mnas',
  'fbr',
  'nepra',
  'ogra',
  'nadra',
  'wapda',
  'bisp',
  'benazir income support',
  'state bank',
  'pkr',
  'pml-n',
  'ppp',
  'pti',
  'mqm',
  'jui-f',
  'imran khan',
  'shehbaz',
  'aurangzeb',
];

/**
 * Pakistani mastheads. A positive signal only — never used to exclude anything.
 * Every one of these was observed carrying Pakistani political coverage in this build.
 */
const PAKISTANI_OUTLETS = [
  'dawn',
  'express tribune',
  'business recorder',
  'the news',
  'geo',
  'ary',
  'samaa',
  'pakistan today',
  'the nation',
  'dunya',
  'radio pakistan',
  'arab news pk',
  'profit',
  'techjuice',
  'brecorder',
  'nation.com.pk',
  'app.com.pk',
  'bolnews',
  'mm news',
  'daily times',
  'pakistan observer',
];

function isPakistanSubject(text: string, source: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  if (PAKISTAN_SUBJECT_TERMS.some((term) => lower.includes(term))) return true;
  const outlet = source.toLowerCase();
  return PAKISTANI_OUTLETS.some((name) => outlet.includes(name));
}

function parseArticleDate(dateString?: string): number | null {
  if (!dateString) return null;
  if (dateString.includes('ago')) return Date.now();
  const ms = new Date(dateString).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  if (dateString.includes('ago')) return dateString;
  const ms = parseArticleDate(dateString);
  if (ms === null) return dateString;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

/**
 * Recency window for oversight.
 *
 * Much tighter than the twelve-month window `/api/pk/news` uses for a constituency.
 * A committee's questions have to be about what is in front of it now; a story from
 * two years ago is history, not oversight. `engine=google&tbm=nws` does honour `tbs`,
 * but it honours it loosely, so the window is enforced here as well.
 */
const MAX_ARTICLE_AGE_MS = 180 * 24 * 60 * 60 * 1000;

interface SerpNewsItem {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string | { name?: string };
}

function sourceName(rawSource: SerpNewsItem['source'], link?: string): string {
  if (typeof rawSource === 'string' && rawSource) return rawSource;
  if (rawSource && typeof rawSource === 'object' && rawSource.name) return rawSource.name;
  try {
    return new URL(link || '').hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown';
  }
}

/**
 * One paid search.
 *
 * `engine=google&tbm=nws`, not `engine=google_news`: the questions have to be drawn
 * from what the coverage SAYS, and google_news returns zero snippets for Pakistan
 * (measured 0/100 on day 0). It also silently ignores `tbs`, so the recency filter
 * would be a no-op there. This engine carries snippets and honours `tbs`.
 */
async function searchSubjectNews(
  query: string,
  apiKey: string
): Promise<PkCommitteeHeadline[]> {
  const { gl, hl } = COUNTRY_SEARCH_LOCALE.PK;
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('tbm', 'nws');
  url.searchParams.set('num', '20');
  url.searchParams.set('tbs', 'qdr:m6');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', gl);
  url.searchParams.set('hl', hl);
  url.searchParams.set('api_key', apiKey);

  try {
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      console.error(`SERPAPI error (pk committee news): ${response.status}`);
      return [];
    }
    const data = await response.json();
    const items: SerpNewsItem[] = data.news_results || data.organic_results || [];

    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS;
    const scored: Array<{ headline: PkCommitteeHeadline; at: number }> = [];

    for (const item of items) {
      const title = item.title?.trim();
      if (!title || !item.link) continue;
      const body = `${title} ${item.snippet ?? ''}`;
      const source = sourceName(item.source, item.link);

      if (isIndianSubject(body)) {
        console.log(`🚫 Filtered (Indian subject matter): ${title}`);
        continue;
      }
      if (!isPakistanSubject(body, source)) {
        console.log(`🚫 Filtered (not Pakistani subject matter): ${title} — ${source}`);
        continue;
      }

      const at = parseArticleDate(item.date);
      if (at !== null && at < cutoff) continue;
      scored.push({
        at: at ?? 0,
        headline: {
          title,
          url: item.link,
          source,
          date: formatDate(item.date),
          snippet: item.snippet?.trim() || undefined,
        },
      });
    }

    return scored.sort((a, b) => b.at - a.at).map((s) => s.headline);
  } catch (error) {
    console.error('SERPAPI search error (pk committee news):', error);
    return [];
  }
}

interface NewsResult {
  headlines: PkCommitteeHeadline[];
  queriesRun: string[];
  reason?: string;
}

/**
 * Subject-area coverage, cached on the committee alone.
 *
 * Deliberately NOT part of the pack's own cache entry, which is keyed by language.
 * The retrieved coverage is identical for the Urdu and English packs — only the
 * generated questions differ — so sharing this entry halves the search spend for a
 * bilingual product on a quota shared with three other builds.
 */
async function retrieveNews(c: PkCommittee, useCache: boolean): Promise<NewsResult> {
  const memoryKey = generateCacheKey('pk-committee-news', { slug: c.slug });
  const dbKey = generateDistrictCacheKey('news', `COMMITTEE-${c.slug}`, undefined, 'PK');

  const dbCached = await getFromDbCache<NewsResult>(dbKey, useCache);
  if (dbCached) {
    serverCache.set(memoryKey, dbCached, 43200);
    return dbCached;
  }
  const memoryCached = serverCache.get<NewsResult>(memoryKey, useCache);
  if (memoryCached) return memoryCached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return { headlines: [], queriesRun: [], reason: 'search_unavailable' };

  const headlines: PkCommitteeHeadline[] = [];
  const queriesRun: string[] = [];
  const seen = new Set<string>();

  for (const query of newsQueries(c)) {
    queriesRun.push(query);
    console.log(`📰 [${c.slug}] querying: ${query}`);
    for (const h of await searchSubjectNews(query, apiKey)) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      headlines.push(h);
    }
    // Each tier is a paid search from a quota shared across this build. Stop early.
    if (headlines.filter((h) => h.snippet).length >= 6) break;
  }

  const result: NewsResult = { headlines: headlines.slice(0, 10), queriesRun };
  serverCache.set(memoryKey, result, 43200);
  // An empty result is not cached: it usually means the quota ran out or the request
  // timed out, and caching that for twelve hours would make the failure look permanent.
  if (result.headlines.length) {
    await setInDbCache(dbKey, 'news', `COMMITTEE-${c.slug}`, result, 43200);
  }
  return result;
}

// ── Suggested lines of questioning ─────────────────────────────────────────────────

export interface PkSuggestedQuestion {
  question: string;
  /** What the question was drawn from. Every question must have one. */
  basis: string;
  /** 1-based index into the headline list, where the basis is coverage. */
  sourceIndex: number | null;
}

/**
 * Facts about the committee the model is allowed to use.
 *
 * Deliberately narrow. It gets the committee's name, whether the chair is filled, and
 * the titles of the reports it has already presented — all of them from na.gov.pk.
 * It does not get the member list: a question that names a member is a question that
 * puts words in a named parliamentarian's mouth.
 */
function committeeFacts(c: PkCommittee): string {
  const lines = [
    `Committee: ${c.nameOfficial}`,
    `Class: ${c.compositionClass ?? c.kindLabelEn} committee of the National Assembly of Pakistan`,
    c.chairVacant
      ? 'Chair: VACANT — the chairmanship is currently unfilled.'
      : `Chair: ${c.chairName ?? 'not recorded'}`,
    `Members: ${c.members.length} MNAs${c.senators.length ? ` and ${c.senators.length} Senators` : ''}`,
  ];
  if (c.reports.length) {
    lines.push(
      'Reports this committee has presented to the House (most recent first):',
      ...c.reports.slice(0, 6).map((r) => `  - ${r.dateLabel}: ${r.title}`)
    );
  }
  if (c.meetings.length) {
    lines.push(
      'Scheduled sittings:',
      ...c.meetings.map(
        (m) => `  - ${m.dateLabel}${m.time ? ` ${m.time}` : ''}: ${m.title}`
      )
    );
  }
  return lines.join('\n');
}

function parseQuestions(text: string, headlineCount: number): PkSuggestedQuestion[] {
  const out: PkSuggestedQuestion[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/^\s*[-*\d.)\s]+/, '').trim();
    if (trimmed.length < 15) continue;
    // `question || basis` — the model is asked to emit the basis on the same line so
    // an unsourced question is structurally impossible to render.
    const [q, basis] = trimmed.split('||').map((s) => s.trim());
    if (!q || !basis) continue;
    const ref = /\[(\d+)\]/.exec(basis);
    const idx = ref ? Number(ref[1]) : null;
    out.push({
      question: q.replace(/^["“]|["”]$/g, ''),
      basis,
      sourceIndex: idx && idx >= 1 && idx <= headlineCount ? idx : null,
    });
  }
  return out.slice(0, 8);
}

async function generateQuestions(
  c: PkCommittee,
  headlines: PkCommitteeHeadline[],
  rules: PkRuleCitation[],
  lang: 'en' | 'ur'
): Promise<{ questions: PkSuggestedQuestion[]; grounded: boolean }> {
  const provider = chatCompletions();
  if (!provider) return { questions: [], grounded: false };

  // No retrieved coverage and no committee record means nothing to question from.
  // An empty list is the honest outcome; the UI has a message for it.
  if (headlines.length === 0 && c.reports.length === 0) {
    return { questions: [], grounded: false };
  }

  const evidence = headlines
    .map((h, i) => {
      const parts = [`[${i + 1}] ${h.title}`, `    source: ${h.source}`];
      if (h.date) parts.push(`    date: ${h.date}`);
      if (h.snippet) parts.push(`    excerpt: ${h.snippet}`);
      return parts.join('\n');
    })
    .join('\n\n');

  const ruleContext = rules
    .filter((r) => r.rule)
    .slice(0, 4)
    .map((r) => `Rule ${r.rule}${r.heading ? ` (${r.heading})` : ''}: ${r.excerpt.slice(0, 300)}`)
    .join('\n');

  const languageRule =
    lang === 'ur'
      ? 'Write each question in URDU, in the formal register used in the National Assembly. Keep organisation names, acronyms (FBR, NEPRA, IMF, PAC), figures and dates in Latin script exactly as they appear in the evidence — Pakistani press does the same. The "basis" half of each line stays in English.'
      : 'Write each question in English.';

  const prompt = `You are helping the secretary of a committee of the National Assembly of Pakistan prepare a briefing pack for members ahead of a meeting.

COMMITTEE RECORD (from the National Assembly Secretariat, na.gov.pk):
${committeeFacts(c)}

${ruleContext ? `THE COMMITTEE'S POWERS, from the Rules of Procedure and Conduct of Business in the National Assembly, 2007:\n${ruleContext}\n` : ''}
RETRIEVED NEWS COVERAGE OF THIS COMMITTEE'S SUBJECT AREA (the ONLY reporting you may draw on):
${evidence || '(no coverage retrieved)'}

Draft up to six SUGGESTED lines of questioning the committee could put to the ministry or division it oversees.

OUTPUT FORMAT — one question per line, nothing else, no numbering, no headings:
question text || basis

The "basis" must name what the question comes from: a bracketed evidence number like [3], or the title of a report the committee has presented, or the scheduled sitting. A question with no basis in the material above must not be written at all.

HARD RULES — these matter more than fluency:
- Every question must trace to the retrieved coverage or to this committee's own record above. If the coverage is thin, write fewer questions. Four well-sourced questions are worth more than six with two invented.
- Do NOT state any figure, date, scheme name, official's name or organisation that does not appear in the material above.
- Do NOT name or address any individual member of the committee, and do not attribute a view to the committee, to its chair, or to any party. These are suggestions for a secretary to consider, not the committee's position.
- Stay inside this committee's subject area. A committee may only examine the ministry or division it is attached to.
- Ask about administration, expenditure, policy and implementation — the things a committee can actually summon a secretary of a division to answer for. Avoid rhetorical or political questions.
- Each question is a single sentence and ends in a question mark.
- ${languageRule}`;

  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        // Low: a warmer model is measurably more willing to embellish past the
        // supplied evidence, and here that means inventing a figure for a minister
        // to be asked about in public.
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error(`LLM error generating committee questions: ${response.status}`);
      return { questions: [], grounded: false };
    }
    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';
    const questions = parseQuestions(text, headlines.length);
    return { questions, grounded: questions.length > 0 };
  } catch (error) {
    console.error('Error generating committee questions:', error);
    return { questions: [], grounded: false };
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const slug = params.get('slug');
    const lang = params.get('lang') === 'ur' ? 'ur' : 'en';
    const skip = new Set((params.get('skip') ?? '').split(',').filter(Boolean));

    const committee = getCommittee(slug);
    if (!committee) {
      return NextResponse.json(
        { error: `No committee "${slug ?? ''}". See /api/pk/committees for the catalogue.` },
        { status: 404 }
      );
    }

    const useCache = request.headers.get('x-use-cache') !== 'false';
    const cacheDurationSeconds = parseInt(
      request.headers.get('x-cache-duration-seconds') || '43200',
      10
    );

    // `district_cache` has no committee cache type and `lib/db-cache.ts` is shared
    // with the US app, so the committee rides in the code slot with a prefix. The
    // `pk:` country scope keeps it clear of every US key.
    const cacheSubject = `COMMITTEE-${committee.slug}`;
    const memoryCacheKey = generateCacheKey('pk-committee-brief', {
      slug: committee.slug,
      lang,
      skip: [...skip].sort().join(','),
    });
    const dbCacheKey = generateDistrictCacheKey(
      'summary',
      cacheSubject,
      { lang, kind: 'brief' },
      'PK'
    );

    if (!skip.has('cache')) {
      const dbCached = await getFromDbCache<Record<string, unknown>>(dbCacheKey, useCache);
      if (dbCached) {
        serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
        return NextResponse.json({ ...dbCached, cached: true });
      }
      const memoryCached = serverCache.get<Record<string, unknown>>(memoryCacheKey, useCache);
      if (memoryCached) return NextResponse.json({ ...memoryCached, cached: true });
    }

    // Rules and news are independent retrievals against different services; running
    // them in sequence would add the slower one to the faster one for no reason.
    const [ruleResult, newsResult] = await Promise.all([
      skip.has('rules')
        ? Promise.resolve({ citations: [], documentTitle: null, queriesRun: [] })
        : retrieveRules(committee),
      skip.has('news')
        ? Promise.resolve<NewsResult>({ headlines: [], queriesRun: [], reason: 'skipped' })
        : retrieveNews(committee, useCache && !skip.has('cache')),
    ]);

    const { questions, grounded } = skip.has('questions')
      ? { questions: [], grounded: false }
      : await generateQuestions(committee, newsResult.headlines, ruleResult.citations, lang);

    const result = {
      slug: committee.slug,
      name: committee.name,
      lang,
      generatedAt: new Date().toISOString(),
      rules: {
        citations: ruleResult.citations,
        documentTitle: ruleResult.documentTitle,
        queries: ruleResult.queriesRun,
        // False means the library did not return rule text; the UI must not fill the
        // gap with a description of what the rules "generally" provide.
        retrieved: ruleResult.citations.length > 0,
      },
      news: {
        headlines: newsResult.headlines,
        queries: newsResult.queriesRun,
        searches: newsResult.queriesRun.length,
        reason: newsResult.reason ?? null,
      },
      questions: {
        items: questions,
        suggested: true,
        grounded,
        headlineCount: newsResult.headlines.length,
      },
      composition: {
        memberCount: committee.members.length,
        senatorCount: committee.senators.length,
        parties: partyBreakdown(committee).map((p) => ({
          ...p,
          name: party(p.party).commonName,
        })),
        blocs: blocBreakdown(committee),
      },
    };

    serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
    if (!skip.size) {
      await setInDbCache(dbCacheKey, 'summary', cacheSubject, result, cacheDurationSeconds);
    }

    console.log(
      `✅ [${committee.slug}] pack: ${ruleResult.citations.length} rule citation(s), ` +
        `${newsResult.headlines.length} headline(s) from ${newsResult.queriesRun.length} search(es), ` +
        `${questions.length} suggested question(s)`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error building PK committee brief:', error);
    return NextResponse.json({ error: 'Could not build the pack' }, { status: 500 });
  }
}
