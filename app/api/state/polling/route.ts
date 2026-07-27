import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";

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

/**
 * A source shown next to a polling figure. Never produced by the language model:
 * each is copied verbatim from a SerpAPI news result this route retrieved.
 */
interface PollingSource {
  name: string;
  url: string;
}

/**
 * Response shape for state polling. `sources` is populated only when a figure was
 * extracted from retrieved search results, and is empty whenever `trend` is null.
 */
interface StatePollingResponse {
  trend: string | null;
  description: string;
  sources: PollingSource[];
}

/**
 * Cache namespace version.
 *
 * v1 allowed inferred leanings to be presented as polling. v2 returned null for
 * every state, because the prompt demanded a real published poll from a model
 * with no web access. v3 introduced grounded retrieval but let the model phrase
 * the margin itself, which produced party framing for same-party primaries.
 * v4 composes the margin in code. v5 additionally requires the cited article's own
 * text to bear the number out. No earlier generation of entries may be served.
 */
const CACHE_VERSION = '5';

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
 * material is worth sending to the model.
 */
const FIGURE_PATTERN =
  /\b\d{1,2}(\.\d)?\s*(%|percent|-point|point|points)\b|\b[DRI]\s*\+\s*\d{1,2}\b|\b\d{1,2}\s*(?:to|vs\.?|–|-)\s*\d{1,2}\b|\bleads?\b.{0,40}\bby\b.{0,25}\d/i;

/**
 * Query SerpAPI's Google News index.
 *
 * `engine=google&tbm=nws` rather than `engine=google_news`: the latter returns
 * titles only, while this returns a `snippet` per result, and the snippet is
 * where the numbers actually are ("Becerra +25. 61%Becerra • 36%Hilton").
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
 * Retrieve news plausibly containing a statewide poll.
 *
 * Pass 1 is restricted to the past month and finds current coverage. Pass 2 widens
 * to six months and is worded the way a headline reporting a margin is worded; it
 * runs only when pass 1 produced no numbers. Both are needed: pass 1 alone finds
 * California's numbers but not Texas's, pass 2 finds Texas's.
 */
async function retrieveStateArticles(stateName: string, apiKey: string): Promise<RetrievedArticle[]> {
  const passes: Array<{ q: string; tbs?: string }> = [
    { q: `${stateName} 2026 poll voters percent survey`, tbs: 'qdr:m' },
    // Six months, not a year: a year-long window surfaced an August 2025 Arizona
    // primary poll for a race that had since been decided, which is not "recent
    // polling" in any sense a reader would accept.
    { q: `${stateName} Senate OR governor race 2026 poll lead points`, tbs: 'qdr:6m' },
  ];

  // Require the state to be named in the text. National generic-ballot polls rank
  // highly for these queries and must not be reported as this state's polling.
  const stateMention = new RegExp(`\\b${stateName.replace(/ /g, '\\s+')}(?:ns|ians|ans)?\\b`, 'i');

  const seen = new Set<string>();
  const kept: RetrievedArticle[] = [];

  for (const pass of passes) {
    const raw = await searchNews(pass.q, apiKey, pass.tbs);

    for (const article of raw) {
      if (seen.has(article.url)) continue;
      if (!stateMention.test(`${article.title} ${article.snippet}`)) continue;
      seen.add(article.url);
      kept.push(article);
    }

    if (kept.some(a => a.hasFigure)) break;
  }

  return kept
    .sort((a, b) => Number(b.hasFigure) - Number(a.hasFigure))
    .slice(0, 8);
}

/**
 * Turn the model's chosen index into a source. The model returns an *index*,
 * never a name or URL, so an unretrieved source cannot reach the response.
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

const NO_POLLING = "No recent public polling found for this state.";

/**
 * GET /api/state/polling?state=VA
 *
 * Retrieves real news coverage for the state via SerpAPI, then asks the model to
 * extract a polling figure *from that material only*. Returns null when the
 * retrieved material contains no poll.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stateCode = searchParams.get('state')?.toUpperCase();

    if (!stateCode || !STATE_NAMES[stateCode]) {
      return NextResponse.json(
        { error: 'Invalid state code' },
        { status: 400 }
      );
    }

    const stateName = STATE_NAMES[stateCode];

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);
    const cacheKey = generateCacheKey('state-polling', { state: stateCode, v: CACHE_VERSION });
    const cached = serverCache.get<StatePollingResponse>(cacheKey, useCache);

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
      } as StatePollingResponse);
    }

    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        trend: null,
        description: "Polling data unavailable",
        sources: []
      } as StatePollingResponse);
    }

    // ---- Retrieval: real search results before any model call ----
    const articles = await retrieveStateArticles(stateName, serpApiKey);
    const grounded = articles.filter(a => a.hasFigure);

    console.log(
      `🔎 ${stateCode}: retrieved ${articles.length} state-matched articles, ${grounded.length} with a figure`
    );

    // Nothing retrieved contains a number, so a figure could not be grounded.
    // Do not call the model at all — it could only guess.
    if (grounded.length === 0) {
      const result: StatePollingResponse = {
        trend: null,
        description: NO_POLLING,
        sources: []
      };
      serverCache.set(cacheKey, result, cacheDurationSeconds);
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
            content: `Below are real news search results retrieved for ${stateName}.

${context}

Extract a polling figure ONLY if the material above explicitly states one.

Return ONLY a JSON object with exactly five keys:
- "leader": who the poll shows ahead. Use the leading candidate's SURNAME (e.g. "Ossoff"). Use "D", "R" or "I" only when the contest is between different parties AND the material frames the lead that way. null if the material contains no poll of ${stateName} voters.
- "margin": the size of the lead in percentage points, as a plain number (e.g. 9). This is the DIFFERENCE between the leader and the runner-up — never a candidate's own vote share. If the material gives one candidate's support level (e.g. "at 60% support") without the runner-up's, and states no lead, there is no margin: return null. Use 0 if the poll shows a tie.
- "contestType": "primary" if the poll covers a primary or runoff between candidates of the SAME party, otherwise "general". null if there is no poll.
- "description": one factual sentence describing what that poll found, who conducted or sponsored it if the material says so, when, and which race it covered. If the material gives only how long ago the article was published, say when it was reported rather than asserting when the poll was conducted.
- "sourceIndex": the number in square brackets of the ONE item the figure came from, or null.

Strict rules:
- Use ONLY the material above. You have no other knowledge of these races.
- The poll must be of ${stateName} voters specifically. A national poll, a generic congressional ballot, or a poll of another state does NOT count, even if it appears above.
- Do NOT infer a number from race ratings, partisan lean, endorsements, fundraising or past election results. Only an actual poll of voters counts.
- If the material reports no polling numbers for ${stateName}, return {"leader": null, "margin": null, "contestType": null, "description": "${NO_POLLING}", "sourceIndex": null}
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
      } as StatePollingResponse);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        trend: null,
        description: "Polling trends unavailable",
        sources: []
      } as StatePollingResponse);
    }

    const pollingData = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    // Attribution is rebuilt from the retrieved list, never from model text.
    const sources = pickSources(grounded, pollingData.sourceIndex);
    const cited =
      typeof pollingData.sourceIndex === 'number' ? grounded[pollingData.sourceIndex] : undefined;
    const built = buildTrend(pollingData.leader, pollingData.margin, pollingData.contestType);

    // Publish only when the figure is tied to a retrieved document *and* that
    // document's own words bear the number out. Anything else is dropped.
    const supported = !!built && !!cited && marginSupportedBy(cited, built.points);

    const result: StatePollingResponse =
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
      console.warn(`⚠️ ${stateCode}: model returned a figure with no valid sourceIndex — dropped`);
    } else if (built && !supported) {
      console.warn(
        `⚠️ ${stateCode}: "${built.trend}" is not supported by the text of the cited article — dropped`
      );
    }

    // Save to cache
    serverCache.set(cacheKey, result, cacheDurationSeconds);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching polling data:', error);
    return NextResponse.json({
      trend: null,
      description: "Polling information unavailable",
      sources: []
    } as StatePollingResponse);
  }
}
