import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

/**
 * A source shown next to a polling figure.
 *
 * These are never produced by the language model. Each one is copied verbatim
 * from a SerpAPI news result that this route retrieved, so `name` and `url`
 * always refer to a document that genuinely exists and genuinely contains the
 * reported number. See `pickSources()`.
 */
interface PollingSource {
  name: string;
  url: string;
}

/**
 * Response shape for district polling.
 *
 * `sources` is populated only when a figure was extracted from retrieved search
 * results; it is an empty array whenever `trend` is null. app/district/[code]/page.tsx
 * renders it when non-empty.
 */
interface DistrictPollingResponse {
  trend: string | null;
  description: string;
  sources: PollingSource[];
}

/**
 * Cache namespace version.
 *
 * v1 stored invented `sources` (named polling organisations the model had not
 * read). v2 stored a null trend for every district, because the prompt demanded
 * a real published poll from a model with no web access. v3 introduced grounded
 * retrieval but let the model phrase the margin itself, which produced party
 * framing for same-party primaries. v4 composes the margin in code. v5 additionally
 * requires the cited article's own text to bear the number out. No earlier
 * generation of entries may be served.
 */
const CACHE_VERSION = '5';

const STATE_NAMES: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "District of Columbia"
};

/** A news result retrieved from SerpAPI, normalised. */
interface RetrievedArticle {
  title: string;
  snippet: string;
  source: string;
  url: string;
  date?: string;
  /** True when the title or snippet contains something that looks like a poll number. */
  hasFigure: boolean;
}

/**
 * Detects an explicit numeric result in retrieved text: "9-point lead", "53-40",
 * "48%", "D+5", "leads ... by 8". Used only to decide whether the retrieved
 * material is worth sending to the model — the model still has to find and
 * attribute the number itself.
 */
const FIGURE_PATTERN =
  /\b\d{1,2}(\.\d)?\s*(%|percent|-point|point|points)\b|\b[DRI]\s*\+\s*\d{1,2}\b|\b\d{1,2}\s*(?:to|vs\.?|–|-)\s*\d{1,2}\b|\bleads?\b.{0,40}\bby\b.{0,25}\d/i;

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

/**
 * Patterns that tie an article to *this* district rather than the same-numbered
 * district in another state.
 *
 * This filter is the reason the route is safe. A search for California's 12th
 * district returns articles about New York's 12th (including a genuine NY-12
 * poll), and a search for Pennsylvania's 7th returns New York's and Illinois's.
 * Without this, the model would be handed a real poll for the wrong race and
 * would quite reasonably report it.
 */
function districtMatchers(stateCode: string, stateName: string, districtNum: number): RegExp[] {
  const ord = ordinal(districtNum);
  const slug = stateName.toLowerCase().replace(/ /g, '-');
  return [
    new RegExp(`\\b${stateCode}[-\\s]?0?${districtNum}\\b`, 'i'),
    new RegExp(`${stateName}['’]?s?\\s+${ord}\\s+congressional\\s+district`, 'i'),
    new RegExp(`${stateName}['’]?s?\\s+${ord}\\s+district`, 'i'),
    new RegExp(`${slug}-us-house-${districtNum}\\b`, 'i'),
    new RegExp(`${slug}-house-${districtNum}\\b`, 'i'),
  ];
}

/**
 * Query SerpAPI's Google News index.
 *
 * `engine=google&tbm=nws` is used rather than `engine=google_news`: the latter
 * returns titles only, while this returns a `snippet` for each result. The
 * snippet is where the actual numbers live ("Becerra +25. 61%Becerra • 36%Hilton"),
 * so without it there is nothing to ground a figure in.
 */
async function searchNews(query: string, apiKey: string, tbs?: string): Promise<RetrievedArticle[]> {
  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('tbm', 'nws');
    url.searchParams.set('q', query);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '20');
    if (tbs) url.searchParams.set('tbs', tbs);
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`SERPAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: Array<{
      title?: string;
      snippet?: string;
      link?: string;
      date?: string;
      source?: { name?: string } | string;
    }> = data.news_results || [];

    return results
      .filter(a => a.title && a.link)
      .map(a => {
        const title = a.title as string;
        const snippet = a.snippet || '';
        return {
          title,
          snippet,
          source: (typeof a.source === 'string' ? a.source : a.source?.name) || 'Unknown',
          url: a.link as string,
          date: a.date,
          hasFigure: FIGURE_PATTERN.test(`${title} ${snippet}`),
        };
      });
  } catch (error) {
    console.error('SERPAPI search error:', error);
    return [];
  }
}

/**
 * Retrieve news plausibly containing a poll for this district.
 *
 * Two passes, because district polling is rare and the two query shapes surface
 * different things: the first finds district-race coverage generally, the second
 * is worded the way a headline reporting a margin is worded. The second pass runs
 * only when the first turned up no numbers.
 */
async function retrieveDistrictArticles(
  stateCode: string,
  stateName: string,
  districtNum: number,
  apiKey: string
): Promise<RetrievedArticle[]> {
  const ord = ordinal(districtNum);
  const padded = String(districtNum).padStart(2, '0');
  const matchers = districtMatchers(stateCode, stateName, districtNum);

  const passes = [
    `"${stateName} ${ord} Congressional District" OR "${stateCode}-${padded}" 2026 poll survey voters`,
    `"${stateCode}-${padded}" OR "${stateName} ${ord} district" poll lead points survey 2026`,
  ];

  const seen = new Set<string>();
  const kept: RetrievedArticle[] = [];

  for (const query of passes) {
    const raw = await searchNews(query, apiKey);

    for (const article of raw) {
      if (seen.has(article.url)) continue;
      const blob = `${article.title} ${article.snippet} ${article.url}`;
      if (!matchers.some(re => re.test(blob))) continue;
      seen.add(article.url);
      kept.push(article);
    }

    // Stop as soon as we have something with a number in it.
    if (kept.some(a => a.hasFigure)) break;
  }

  // Figure-bearing articles first, otherwise preserve Google's own ranking.
  return kept
    .sort((a, b) => Number(b.hasFigure) - Number(a.hasFigure))
    .slice(0, 8);
}

/**
 * Turn the model's chosen index into a source.
 *
 * The model is asked for an *index* into the retrieved list, never for a name or
 * a URL. Anything outside the list is discarded, so a source that was not
 * retrieved cannot reach the response.
 */
function pickSources(articles: RetrievedArticle[], sourceIndex: unknown): PollingSource[] {
  if (typeof sourceIndex !== 'number' || !Number.isInteger(sourceIndex)) return [];
  const article = articles[sourceIndex];
  if (!article) return [];
  return [{ name: article.source, url: article.url }];
}

/**
 * Build the displayed margin from structured fields rather than letting the model
 * phrase it.
 *
 * The model was previously asked for a ready-made string and returned "R+8" for a
 * Paxton-vs-Cornyn Republican runoff and "R+10" for a Robson-vs-Biggs Republican
 * primary — party framing for contests where both candidates share a party, which
 * reads as a lead over the *other* party. Composing the string here makes that
 * class of error impossible: a same-party contest can only ever be labelled with a
 * candidate's name, and a party letter in that position is rejected outright.
 */
function buildTrend(
  leader: unknown,
  margin: unknown,
  contestType: unknown
): { trend: string; points: number } | null {
  if (typeof leader !== 'string') return null;
  const name = leader.trim().replace(/[^A-Za-z .'-]/g, '').slice(0, 24).trim();
  if (!name) return null;

  const points = typeof margin === 'number' ? margin : Number(margin);
  if (!Number.isFinite(points) || points < 0 || points > 99) return null;
  if (points === 0) return { trend: 'Tied', points: 0 };

  const rounded = Math.round(points * 10) / 10;

  if (/^[DRI]$/i.test(name)) {
    // A primary or runoff between candidates of one party has no party margin.
    if (contestType === 'primary') return null;
    return { trend: `${name.toUpperCase()}+${rounded}`, points: rounded };
  }

  return { trend: `${name} +${rounded}`, points: rounded };
}

/**
 * Does the cited article's own text actually support a lead of `points`?
 *
 * This is the last line of defence, and it exists because two distinct failure
 * modes showed up in testing even with a grounded prompt:
 *
 *  - a candidate's vote share was read as a margin — "Andy Biggs at 60% support in
 *    GOP governor race" became "Biggs +60";
 *  - a number was taken from one retrieved article and attributed to another —
 *    "Becerra +25" was cited to a KCRA piece whose text says only "a wide margin".
 *
 * A number therefore counts only when the article states it *as* a lead ("9-point
 * lead", "leads by 8", "+25"), or when two vote shares in the article differ by it
 * ("Shapiro Leads Garrity, 53-40%" supports 13). A bare percentage never does.
 */
function marginSupportedBy(article: RetrievedArticle, points: number): boolean {
  const text = `${article.title} ${article.snippet}`;
  const target = Math.round(points);

  if (target === 0) {
    return /\btie\b|\btied\b|toss-?up|deadlock|dead heat|statistically even/i.test(text);
  }

  // Numbers the article states as a lead or margin.
  const stated = new Set<number>();
  const marginPatterns = [
    /(\d{1,2}(?:\.\d)?)[-\s]*(?:percentage[-\s]*)?points?\b/gi,
    /\bby\s+(\d{1,2}(?:\.\d)?)\b/gi,
    /\+\s*(\d{1,2}(?:\.\d)?)/g,
  ];
  for (const re of marginPatterns) {
    for (const m of text.matchAll(re)) stated.add(Math.round(Number(m[1])));
  }
  if (stated.has(target)) return true;

  // Or two reported shares that differ by the margin ("53-40%", "61% ... 36%").
  const shares: number[] = [
    ...[...text.matchAll(/(\d{1,2}(?:\.\d)?)\s*%/g)].map(m => Number(m[1])),
    ...[...text.matchAll(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g)].flatMap(m => [Number(m[1]), Number(m[2])]),
  ];
  for (let i = 0; i < shares.length; i++) {
    for (let j = i + 1; j < shares.length; j++) {
      if (Math.round(Math.abs(shares[i] - shares[j])) === target) return true;
    }
  }

  return false;
}

const NO_POLLING = "No recent public polling found for this district.";

/**
 * GET /api/district/polling?district=VA05
 *
 * Retrieves real news coverage for the district via SerpAPI, then asks the model
 * to extract a polling figure *from that material only*. Returns null when the
 * retrieved material contains no poll, which is the common case for House districts.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const districtCode = searchParams.get('district')?.toUpperCase();

    if (!districtCode) {
      return NextResponse.json(
        { error: 'Missing district parameter' },
        { status: 400 }
      );
    }

    // Parse district code (e.g., "VA05" -> state: "VA", district: "05")
    const match = districtCode.match(/^([A-Z]{2})(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid district code format' },
        { status: 400 }
      );
    }

    const [, stateCode, districtNum] = match;
    const districtLabel = `${stateCode}-${districtNum}`;
    const stateName = STATE_NAMES[stateCode] || stateCode;
    const districtNumber = parseInt(districtNum, 10);

    // Check cache settings - default to 24 hours (86400 seconds)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);
    const dbCacheKey = generateDistrictCacheKey('polling', districtCode, { v: CACHE_VERSION });

    // Check DB cache first (if cache reading is enabled)
    if (useCache) {
      const dbCached = await getFromDbCache<DistrictPollingResponse>(dbCacheKey, true);
      if (dbCached) {
        console.log(`📦 DB cache hit for polling ${districtCode}`);
        return NextResponse.json({ ...dbCached, sources: dbCached.sources ?? [] });
      }
    }

    // Check memory cache as fallback
    const cacheKey = generateCacheKey('district-polling', { district: districtCode, v: CACHE_VERSION });
    const cached = serverCache.get<DistrictPollingResponse>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json({ ...cached, sources: cached.sources ?? [] });
    }

    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      console.warn('⚠️ SERPAPI_KEY not set — cannot ground polling, returning null');
      return NextResponse.json({
        trend: null,
        description: "Polling data unavailable",
        sources: []
      } as DistrictPollingResponse);
    }

    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        trend: null,
        description: "Polling data unavailable",
        sources: []
      } as DistrictPollingResponse);
    }

    // ---- Retrieval: real search results before any model call ----
    const articles = await retrieveDistrictArticles(stateCode, stateName, districtNumber, serpApiKey);
    const grounded = articles.filter(a => a.hasFigure);

    console.log(
      `🔎 ${districtLabel}: retrieved ${articles.length} district-matched articles, ${grounded.length} with a figure`
    );

    // Nothing retrieved contains a number, so there is nothing a figure could be
    // grounded in. Do not call the model at all — it could only guess.
    if (grounded.length === 0) {
      const result: DistrictPollingResponse = {
        trend: null,
        description: NO_POLLING,
        sources: []
      };
      serverCache.set(cacheKey, result, cacheDurationSeconds);
      await setInDbCache(dbCacheKey, 'polling', districtCode, result, cacheDurationSeconds);
      return NextResponse.json(result);
    }

    const useOpenRouter = !!OPENROUTER_KEY;
    const baseURL = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Actalyze';
    }

    // Only articles that actually contain a number are offered. Handing the model
    // figure-less items invites it to cite one of them for a number it got
    // elsewhere, which is how "Becerra +25" ended up attributed to an article that
    // only said "a wide margin".
    const context = grounded
      .map((a, i) => `[${i}] SOURCE: ${a.source}${a.date ? ` (${a.date})` : ''}
TITLE: ${a.title}
SNIPPET: ${a.snippet || '(no snippet)'}`)
      .join('\n\n');

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'perplexity/sonar-pro' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Below are real news search results retrieved for US Congressional District ${districtLabel} (${stateName}'s ${ordinal(districtNumber)} district).

${context}

Extract a polling figure ONLY if the material above explicitly states one.

Return ONLY a JSON object with exactly five keys:
- "leader": who the poll shows ahead. Use the leading candidate's SURNAME (e.g. "Brooks"). Use "D", "R" or "I" only when the contest is between different parties AND the material frames the lead that way. null if the material contains no poll of this district.
- "margin": the size of the lead in percentage points, as a plain number (e.g. 7). This is the DIFFERENCE between the leader and the runner-up — never a candidate's own vote share. If the material gives one candidate's support level (e.g. "at 60% support") without the runner-up's, and states no lead, there is no margin: return null. Use 0 if the poll shows a tie.
- "contestType": "primary" if the poll covers a primary or runoff between candidates of the SAME party, otherwise "general". null if there is no poll.
- "description": one factual sentence describing what that poll found, who conducted or sponsored it if the material says so, when, and which race it covered. If the material gives only how long ago the article was published, say when it was reported rather than asserting when the poll was conducted.
- "sourceIndex": the number in square brackets of the ONE item the figure came from, or null.

Strict rules:
- Use ONLY the material above. You have no other knowledge of this race.
- The poll must be of voters in ${districtLabel} specifically. If an item is about a different state's ${ordinal(districtNumber)} district, or about a national or statewide poll, it does NOT count.
- Do NOT infer a number from race ratings, partisan lean, endorsements, fundraising or past election results. Only an actual poll of voters counts.
- If the material describes a race but reports no polling numbers, return {"leader": null, "margin": null, "contestType": null, "description": "${NO_POLLING}", "sourceIndex": null}
- "sourceIndex" must be an index that appears above. Never invent a publication or URL.
- Return no other keys.`,
          },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return NextResponse.json({
        trend: null,
        description: "Recent polling data unavailable",
        sources: []
      } as DistrictPollingResponse);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        trend: null,
        description: "Polling trends unavailable",
        sources: []
      } as DistrictPollingResponse);
    }

    const pollingData = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    // Attribution is rebuilt from the retrieved list, never from model text.
    const sources = pickSources(grounded, pollingData.sourceIndex);
    const cited =
      typeof pollingData.sourceIndex === 'number' ? grounded[pollingData.sourceIndex] : undefined;
    const built = buildTrend(pollingData.leader, pollingData.margin, pollingData.contestType);

    // Publish only when the figure is tied to a retrieved document *and* that
    // document's own words bear the number out. Anything else is dropped: without
    // a verifiable source it is indistinguishable from the fabrication this route
    // used to produce.
    const supported = !!built && !!cited && marginSupportedBy(cited, built.points);

    const result: DistrictPollingResponse =
      built && sources.length > 0 && supported
        ? {
            trend: built.trend,
            description: typeof pollingData.description === 'string' && pollingData.description.trim()
              ? pollingData.description.trim()
              : NO_POLLING,
            sources,
          }
        : { trend: null, description: NO_POLLING, sources: [] };

    if (built && sources.length === 0) {
      console.warn(`⚠️ ${districtLabel}: model returned a figure with no valid sourceIndex — dropped`);
    } else if (built && !supported) {
      console.warn(
        `⚠️ ${districtLabel}: "${built.trend}" is not supported by the text of the cited article — dropped`
      );
    }

    // Save to memory cache
    serverCache.set(cacheKey, result, cacheDurationSeconds);

    // Save to DB cache (always write, even if cache reading is disabled)
    await setInDbCache(dbCacheKey, 'polling', districtCode, result, cacheDurationSeconds);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching district polling data:', error);
    return NextResponse.json({
      trend: null,
      description: "Polling information unavailable",
      sources: []
    } as DistrictPollingResponse);
  }
}
