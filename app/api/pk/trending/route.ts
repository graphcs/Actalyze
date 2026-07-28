import { NextRequest, NextResponse } from 'next/server';
import { serverCache, generateCacheKey } from '@/src/lib/cache';
import { OPENROUTER_KEY } from '@/lib/ai-provider';
import { getFromDbCache, setInDbCache, generateDistrictCacheKey } from '@/lib/db-cache';
import { COUNTRY_SEARCH_LOCALE } from '@/lib/country';

/**
 * What Pakistan is talking about, nationally.
 *
 * Modelled on `app/api/trending/route.ts`, with four changes that Day-0 measurement
 * forced rather than taste:
 *
 *  1. `geo=PK` returns ~52 trending items but only **5** land in `Politics`. Filtering
 *     on that category alone — which is what the US path does — produces a feed thin
 *     enough to look broken. `Law and Government` carries six more and is where items
 *     like "ajk elections" and "toshakhana" actually sit, so both are accepted.
 *  2. The live payload uses `query`, `categories: [{id,name}]` and `search_volume`.
 *     `src/trending/serpapi.ts` still reads a singular `item.category` string, so it
 *     matches nothing against this response; the parsing is done here instead of
 *     changing a file the US app depends on.
 *  3. `engine=google_news&gl=pk` returns 100 solid Pakistani results and **zero**
 *     snippets. That is fine for headlines — which is all this route needs from it —
 *     but it means the news feed cannot be used to extract figures.
 *  4. Exactly two SerpAPI calls per cold build, ever. Per-topic article lookups would
 *     be one call each and the quota is shared with two other builds.
 *
 * If retrieval fails the route returns `[]`. It never substitutes plausible topics —
 * the page has an empty state and an honest empty state beats an invented feed.
 */

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

interface TrendingTopic {
  id: string;
  title: string;
  /** The raw Google Trends query, kept so the display title stays auditable. */
  rawQuery: string;
  tags: string[];
  /** SerpAPI search volume for the query. Measured, not modelled. */
  searchVolume?: number;
  increasePercentage?: number;
  categories: string[];
  color: string;
  headlines: Headline[];
}

const SERPAPI = 'https://serpapi.com/search';
const { gl, hl } = COUNTRY_SEARCH_LOCALE.PK;

/**
 * The US route asks about congress/senate/scotus. None of that means anything here.
 *
 * Two queries, because measurement showed neither one is sufficient and they fail in
 * opposite directions.
 *
 * The institutional query is fresh but broad: 32 of 100 results were within the recency
 * window, and it needs the trailing `Pakistan` anchor because every term in it is
 * globally ambiguous — unanchored it returned NPR on US Senate primaries, Reuters on
 * the IMF and Argentina, and Al Jazeera on the US Supreme Court. `gl=pk` biases ranking
 * without constraining subject.
 *
 * The party query is topically far better — it is the one that surfaces the coverage
 * the Google Trends queries are actually about — but it is dominated by analysis and
 * evergreen pages: 55 of 100 results were more than six months old and only 4 were
 * inside a week. Ranked alone it would fill the page with think-pieces.
 *
 * Merged and deduplicated they give a pool that is both current and about Pakistani
 * politics. Three SerpAPI calls per cold build, cached for six hours.
 */
const PK_NEWS_QUERIES = [
  '("national assembly" OR "prime minister" OR senate OR "supreme court" OR ECP OR IMF OR "provincial assembly" OR budget OR "chief minister") Pakistan',
  'Pakistan politics ("National Assembly" OR Senate OR "Election Commission" OR "provincial assembly" OR "chief minister" OR PTI OR "PML-N" OR PPP OR "Imran Khan")',
];

const ACCEPTED_CATEGORIES = ['politics', 'law and government'];

/**
 * Pakistani relevance, as an allowlist of subject plus an allowlist of outlets.
 *
 * Day-0 measurement was explicit that the filter must not be an outlet blocklist: a
 * Lahore query surfaced an NDTV story that was genuinely about Pakistan, and an Indian
 * outlet writing about Pakistan is a legitimate result. So a headline survives if it is
 * *about* Pakistan or if a Pakistani newsroom wrote it — the union, not the
 * intersection, so a Dawn story on a Pakistani subject that names no place still passes.
 */
const PK_SUBJECT =
  /\b(pakistan|pakistani|islamabad|karachi|lahore|peshawar|quetta|rawalpindi|multan|faisalabad|gwadar|punjab|sindh|balochistan|khyber|pakhtunkhwa|gilgit|azad kashmir|ajk|national assembly|senate of pakistan|pti|pml-?n|pml-?q|ppp|mqm|jui-?f|imran khan|shehbaz|bilawal|nawaz sharif|zardari|ecp|nab|nadra|fbr|cpec|toshakhana|mohtasib|sindhi|baloch|pashtun)\b/i;

const PK_OUTLETS =
  /(dawn|express tribune|the news|business recorder|geo\b|ary|radio pakistan|associated press of pakistan|\bapp\b|the nation|arab news|samaa|dunya|pakistan today|profit|bol news|nation\.com\.pk|pakistan observer|daily times|minute mirror)/i;

function isAboutPakistan(title: string, source: string): boolean {
  return PK_SUBJECT.test(title) || PK_OUTLETS.test(source);
}

/**
 * Reference pages are not news and never become news.
 *
 * `engine=google_news` returned Britannica's biography of Maryam Nawaz Sharif against
 * the trend "nawaz sharif" — a perfect keyword match, a perfectly useless result, and
 * one that would have been presented on the page as today's coverage of a live topic.
 */
const REFERENCE_SOURCE = /(britannica|wikipedia|wikiwand|fandom|dictionary|encyclopedia|imdb)/i;

/**
 * Press releases can be evidence for a topic but must not *become* one.
 *
 * Embassy readouts and foreign-ministry statements are republished verbatim across
 * several sites, so they form the largest clusters in the pool and the news-clustering
 * fallback promoted them to headline topics — "Ambassador attends B2B conference" ranked
 * above anything contested. They stay in the pool, where they can legitimately support a
 * trend, but they cannot seed a topic of their own.
 */
const PRESS_RELEASE =
  /(embassy|ministry of foreign affairs|\bmofa\b|permanent mission|press release|alliance of civilizations|unaoc|\bpid\b|press information department)/i;

/**
 * Day-0 finding: `gl=pk` alone keeps Indian coverage out almost entirely — the
 * worst-case query ("Punjab assembly budget") returned 8/8 Pakistani results. This is
 * defence in depth, and it filters on Indian *subject matter* rather than on Indian
 * outlets, because an NDTV story about Pakistan is a legitimate result while a Dawn
 * story about the Lok Sabha is not.
 */
const INDIA_SUBJECT =
  /\b(modi|bjp|lok sabha|rajya sabha|ayushman|yojana|crore|amritsar|chandigarh|new delhi|congress party of india)\b/i;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'after', 'over', 'into', 'says',
  'said', 'will', 'has', 'have', 'been', 'not', 'new', 'more', 'than', 'its', 'his',
  'her', 'they', 'their', 'about', 'amid', 'what', 'when', 'who', 'how', 'why',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
}

function serpKey(): string | null {
  return process.env.SERPAPI_KEY?.trim().replace(/^["']|["']$/g, '') || null;
}

/**
 * `engine=google_news` accepts `tbs=qdr:*` and then ignores it — a 2018 article came
 * back ranked among 2026 coverage in testing. Sending the parameter would be worse than
 * omitting it, because it reads as though recency were handled. It is enforced here
 * instead, on the date each result carries. Undated results are kept: Google omits the
 * date on a meaningful share of Pakistani results and the thing being guarded against —
 * a years-old article next to a live trend — is always dated.
 */
const MAX_AGE_DAYS = 30;

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('ago')) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function isRecent(value: string | undefined, maxDays = MAX_AGE_DAYS): boolean {
  if (!value) return true;

  const relative = value.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
  if (relative) {
    const n = parseInt(relative[1], 10);
    const days: Record<string, number> = {
      minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365,
    };
    return n * (days[relative[2].toLowerCase()] ?? 1) <= maxDays;
  }
  if (/ago$/i.test(value.trim())) return true;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return true;
  return (Date.now() - parsed.getTime()) / 86_400_000 <= maxDays;
}

// ── retrieval ─────────────────────────────────────────────────────────────────────

async function fetchTrendingNow(apiKey: string) {
  const url = new URL(SERPAPI);
  url.searchParams.set('engine', 'google_trends_trending_now');
  url.searchParams.set('geo', 'PK');
  url.searchParams.set('hl', hl);
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`[pk/trending] trending_now HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: Array<{
    query?: string;
    search_volume?: number;
    increase_percentage?: number;
    categories?: Array<{ id?: number; name?: string }>;
  }> = data.trending_searches || [];

  console.log(`[pk/trending] ${items.length} trending items for geo=PK`);

  return items
    .map((item) => ({
      query: (item.query || '').trim(),
      searchVolume: item.search_volume,
      increasePercentage: item.increase_percentage,
      categories: (item.categories || []).map((c) => c.name || '').filter(Boolean),
    }))
    .filter((item) => {
      if (!item.query) return false;
      // "2" arrived as a Law-and-Government trend. A bare number or a two-letter
      // fragment is a Google artefact, not a topic anyone is discussing.
      if (item.query.length < 3) return false;
      if (/^[\d\s.,-]+$/.test(item.query)) return false;
      return item.categories.some((c) => ACCEPTED_CATEGORIES.includes(c.toLowerCase()));
    });
}

type NewsResult = {
  title?: string;
  link?: string;
  date?: string;
  thumbnail?: string;
  source?: { name?: string };
  stories?: Array<Record<string, unknown>>;
};

async function fetchNewsQuery(query: string, apiKey: string): Promise<NewsResult[]> {
  const url = new URL(SERPAPI);
  url.searchParams.set('engine', 'google_news');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', gl);
  url.searchParams.set('hl', hl);
  url.searchParams.set('num', '100');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`[pk/trending] google_news HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const results: NewsResult[] = data.news_results || [];
  // Google News nests same-story coverage under `stories`; flatten so every member of a
  // cluster is individually matchable.
  return results.flatMap((r) =>
    Array.isArray(r.stories) && r.stories.length > 0 ? (r.stories as NewsResult[]) : [r]
  );
}

async function fetchNationalHeadlines(apiKey: string): Promise<Headline[]> {
  const batches = await Promise.all(
    PK_NEWS_QUERIES.map((q) =>
      fetchNewsQuery(q, apiKey).catch((e) => {
        console.error('[pk/trending] news query failed:', e);
        return [] as NewsResult[];
      })
    )
  );
  const flat = batches.flat();

  const seen = new Set<string>();
  const headlines: Headline[] = [];
  for (const r of flat) {
    if (!r.title || !r.link) continue;
    if (seen.has(r.title)) continue;
    if (INDIA_SUBJECT.test(r.title)) continue;
    if (REFERENCE_SOURCE.test(r.source?.name || '') || REFERENCE_SOURCE.test(r.link)) continue;
    if (!isRecent(r.date)) continue;
    if (!isAboutPakistan(r.title, r.source?.name || '')) continue;
    seen.add(r.title);
    headlines.push({
      title: r.title,
      url: r.link,
      source: r.source?.name || 'Unknown',
      date: formatDate(r.date),
      thumbnail: r.thumbnail,
    });
  }

  console.log(
    `[pk/trending] ${headlines.length} Pakistani headlines kept of ${flat.length} retrieved ` +
      `(dropped: duplicate, off-subject, Indian, or older than ${MAX_AGE_DAYS} days)`
  );
  return headlines;
}

// ── shaping ───────────────────────────────────────────────────────────────────────

/**
 * Attach the headlines that are actually about a topic.
 *
 * The threshold is two, not one, and that is not fussiness. At one, the topic "chief of
 * defence forces of pakistan" matched "IMF chief praises Argentina's economic reforms"
 * on the single token "chief" and rendered it as Pakistani defence coverage. One shared
 * common noun is a coincidence; a whole phrase, or two independent tokens, is a match.
 */
const MIN_MATCH_SCORE = 2;

/**
 * How much a shared token is worth, from how common it is in this pool.
 *
 * A fixed stopword list cannot work here, because the words that carry no information
 * are the ones the retrieval query selected for. Every headline in the pool contains
 * "Pakistan" by construction, and "chief" and "minister" are in a third of them — so
 * "chief of defence forces of pakistan" matched a story about the Chief Justice meeting
 * the Punjab Bar Council on two "shared" tokens that were shared with everything.
 *
 * Weighting by inverse document frequency makes the list self-tuning: whichever words
 * happen to be everywhere this week stop counting, without anyone maintaining a list.
 */
function tokenWeights(pool: Headline[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const h of pool) {
    for (const tok of new Set(tokens(h.title))) df.set(tok, (df.get(tok) ?? 0) + 1);
  }
  const weights = new Map<string, number>();
  const n = Math.max(pool.length, 1);
  for (const [tok, count] of df) {
    // Present in more than 15% of the pool: near-worthless as a discriminator.
    weights.set(tok, count / n > 0.15 ? 0.25 : 1);
  }
  return weights;
}

function matchHeadlines(
  query: string,
  pool: Headline[],
  weights: Map<string, number>,
  limit = 3
): Headline[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  const scored = pool
    .map((h) => {
      const t = h.title.toLowerCase();
      // Whole-phrase containment is conclusive on its own — "ajk elections" appearing
      // verbatim cannot be an accident.
      const phrase = t.includes(query.toLowerCase()) ? MIN_MATCH_SCORE + 1 : 0;
      const overlap = queryTokens
        .filter((tok) => t.includes(tok))
        .reduce((sum, tok) => sum + (weights.get(tok) ?? 1), 0);
      return { h, score: Math.max(phrase, overlap) };
    })
    .filter((s) => s.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const { h } of scored) {
    if (seen.has(h.title)) continue;
    seen.add(h.title);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Cluster the news pool into topics.
 *
 * This is the fallback for the day Google Trends returns nothing political, and it is
 * also what makes the page survive `geo=PK` having a thin Politics category. It is real
 * retrieved coverage either way — nothing here is generated.
 */
function clusterHeadlines(pool: Headline[], want: number) {
  const clusters: Array<{ seed: Headline; members: Headline[]; tokens: string[] }> = [];

  for (const h of pool) {
    const ts = tokens(h.title);
    if (ts.length < 2) continue;

    let placed = false;
    for (const cluster of clusters) {
      const shared = ts.filter((t) => cluster.tokens.includes(t)).length;
      const union = new Set([...ts, ...cluster.tokens]).size;
      if (union > 0 && shared / union > 0.3) {
        cluster.members.push(h);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ seed: h, members: [h], tokens: ts });
  }

  return clusters
    .filter((c) => !PRESS_RELEASE.test(c.seed.source) && !PRESS_RELEASE.test(c.seed.title))
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, want)
    .map((c) => ({
      query: c.seed.title,
      searchVolume: undefined as number | undefined,
      increasePercentage: undefined as number | undefined,
      categories: ['News'],
      headlines: c.members.slice(0, 3),
    }));
}

/**
 * Turn raw trend queries into something a member would read.
 *
 * One batched call rather than the US route's per-topic fan-out: same result, a tenth
 * of the tokens, and no chance of nine calls half-succeeding. Failure is non-fatal —
 * the raw query is already meaningful, just untidy.
 */
async function polishTitles(
  topics: Array<{ query: string; headlines: Headline[] }>
): Promise<Array<{ title: string; tags: string[] } | null>> {
  const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || topics.length === 0) return topics.map(() => null);

  const useOpenRouter = !!OPENROUTER_KEY;
  const endpoint = useOpenRouter
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (useOpenRouter) {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    headers['X-Title'] = 'Actalyze Pakistan';
  }

  const listing = topics
    .map(
      (t, i) =>
        `${i + 1}. query: "${t.query}"\n   headlines: ${
          t.headlines.map((h) => h.title).join(' | ') || '(none retrieved)'
        }`
    )
    .join('\n');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `These are trending search topics in Pakistan. For each, write a clear headline-style title (max 8 words) describing what the topic is about, and 2-3 short tags.

Rules:
- Pakistani political context. "toshakhana" is the state gift depository at the centre of a corruption case; "ajk" is Azad Jammu and Kashmir.
- Base the title on the headlines where they are given. If no headlines are given, expand the query minimally — do NOT invent an event.
- Keep Pakistani proper nouns and acronyms (NA, ECP, PTI, PML-N, PPP, IMF) as-is.
- English only.

${listing}

Return ONLY a JSON array of ${topics.length} objects, in the same order, each {"title": string, "tags": string[]}.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return topics.map(() => null);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return topics.map(() => null);

    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
    if (!Array.isArray(parsed)) return topics.map(() => null);

    return topics.map((_, i) => {
      const item = parsed[i];
      if (!item || typeof item.title !== 'string') return null;
      return {
        title: item.title.trim().replace(/^["']|["']$/g, ''),
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 3).map(String) : [],
      };
    });
  } catch (error) {
    console.error('[pk/trending] title polish failed:', error);
    return topics.map(() => null);
  }
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(' ');
}

const PALETTE = ['#0f766e', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ── route ─────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const useCache = request.headers.get('x-use-cache') !== 'false';
    const ttl = parseInt(request.headers.get('x-cache-duration-seconds') || '21600', 10);

    // `national` is already taken by the US route in the same Supabase table, and the
    // cache layer carries no country dimension — see lib/country.ts. Namespacing the
    // subnational code is what keeps the two builds from overwriting each other.
    const memoryKey = generateCacheKey('pk-trending-topics', {});
    const dbKey = generateDistrictCacheKey('trending', 'pk-national');

    const dbCached = await getFromDbCache<TrendingTopic[]>(dbKey, useCache);
    if (dbCached) {
      serverCache.set(memoryKey, dbCached, ttl);
      return NextResponse.json(dbCached);
    }

    const memoryCached = serverCache.get<TrendingTopic[]>(memoryKey, useCache);
    if (memoryCached) return NextResponse.json(memoryCached);

    const apiKey = serpKey();
    if (!apiKey) {
      console.warn('[pk/trending] SERPAPI_KEY not set — returning empty feed');
      return NextResponse.json([]);
    }

    // Two calls, issued together. Trends supplies what is rising; news supplies what is
    // being written about it.
    const [trends, headlinePool] = await Promise.all([
      fetchTrendingNow(apiKey).catch((e) => {
        console.error('[pk/trending] trends failed:', e);
        return [];
      }),
      fetchNationalHeadlines(apiKey).catch((e) => {
        console.error('[pk/trending] news failed:', e);
        return [];
      }),
    ]);

    const weights = tokenWeights(headlinePool);

    let candidates = trends.map((t) => ({
      query: t.query,
      searchVolume: t.searchVolume,
      increasePercentage: t.increasePercentage,
      categories: t.categories,
      headlines: matchHeadlines(t.query, headlinePool, weights),
    }));

    // Top up from news clustering when Trends is thin, which for `geo=PK` it usually
    // is. Clusters that duplicate a trend query are dropped.
    if (candidates.length < 9 && headlinePool.length > 0) {
      const have = new Set(candidates.map((c) => c.query.toLowerCase()));
      for (const cluster of clusterHeadlines(headlinePool, 12)) {
        if (candidates.length >= 9) break;
        const key = cluster.query.toLowerCase();
        if (have.has(key)) continue;
        if (candidates.some((c) => key.includes(c.query.toLowerCase()))) continue;
        have.add(key);
        candidates.push(cluster);
      }
    }

    if (candidates.length === 0) {
      console.warn('[pk/trending] no topics retrieved — returning empty feed');
      return NextResponse.json([]);
    }

    candidates = candidates.slice(0, 9);
    const polished = await polishTitles(candidates);

    const topics: TrendingTopic[] = candidates.map((c, i) => {
      const p = polished[i];
      return {
        id: c.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `topic-${i}`,
        title: p?.title || titleCase(c.query),
        rawQuery: c.query,
        tags: p?.tags?.length ? p.tags : c.categories.slice(0, 2),
        searchVolume: c.searchVolume,
        increasePercentage: c.increasePercentage,
        categories: c.categories,
        color: colorFor(c.query),
        headlines: c.headlines,
      };
    });

    serverCache.set(memoryKey, topics, ttl);
    await setInDbCache(dbKey, 'trending', 'pk-national', topics, ttl);

    console.log(`[pk/trending] returning ${topics.length} topics`);
    return NextResponse.json(topics);
  } catch (error) {
    console.error('[pk/trending] failed:', error);
    // Fail closed. An empty feed is a state the page renders honestly.
    return NextResponse.json([]);
  }
}
