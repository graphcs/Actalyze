import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";
import { COUNTRY_SEARCH_LOCALE } from "@/lib/country";
import { normalizePkCode } from "@/lib/pk/constituency-code";
import { getConstituency, type PkConstituency } from "@/lib/pk/constituencies";
import { PK_PROVINCES } from "@/lib/pk/parties";

/**
 * Local news for a National Assembly constituency.
 *
 * Modelled on `/api/district/news`, with three Pakistan-specific departures, all of
 * them measured on day 0 (`data/pk/DAY0-FINDINGS.md`) rather than assumed:
 *
 *  1. **Engine choice is not free.** `engine=google_news` returns ZERO snippets for
 *     Pakistan — measured 0/100, 0/42 and 0/43 across three queries. It is still the
 *     right engine for a headline list, which needs no snippet. But anything that
 *     has to *read* the coverage (the constituency briefing) needs
 *     `engine=google&tbm=nws`, which carries them 10/10. `?snippets=1` selects it.
 *
 *  2. **The exclusion filter targets Indian subject matter, not Indian outlets.** A
 *     Lahore query surfaced an NDTV story that was genuinely about Pakistan, so an
 *     outlet blocklist would have thrown away a real result. `gl=pk` is already
 *     doing most of the work (8/8 Pakistani results on the worst-case query
 *     "Punjab assembly budget"), so this is defence in depth, not the critical path.
 *
 *  3. **No LLM in the query path.** The US route asks a model to invent a search
 *     query and to list towns. Here the seat, member, districts and province all come
 *     from the na.gov.pk roster, so the queries are derived, stable (SerpAPI's fetch
 *     cache can actually hit) and carry no fabrication surface.
 *
 * GET /api/pk/news?code=NA-123[&snippets=1]
 */

export interface PkHeadline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
  /** Only populated when the caller asked for `snippets=1`. */
  snippet?: string;
}

/**
 * Indian SUBJECT MATTER, not Indian outlets.
 *
 * Pakistan and India share place names (Punjab, Hyderabad, Gujrat/Gujarat) and a
 * shared-language press, so a name-based filter would be wrong in both directions.
 * These terms are specific to Indian politics and Indian government programmes:
 * an article that mentions Lok Sabha, a Yojana scheme or Amritsar is about India
 * whoever published it.
 *
 * Deliberately NOT here: "Punjab" (Pakistan has one), "Congress" (used generically),
 * "rupee" (both), "lakh" (used in Pakistani business copy).
 */
const INDIA_SUBJECT_TERMS = [
  "modi",
  "bjp",
  "lok sabha",
  "rajya sabha",
  "ayushman",
  "yojana",
  "crore",
  "amritsar",
  "chandigarh",
  "ludhiana",
  "rahul gandhi",
  "new delhi",
  "aam aadmi",
  "nda government",
];

function isIndianSubject(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return INDIA_SUBJECT_TERMS.some((term) => lower.includes(term));
}

/** Milliseconds since epoch, or null when the date is relative or unparseable. */
function parseArticleDate(dateString?: string): number | null {
  if (!dateString) return null;
  if (dateString.includes("ago")) return Date.now();
  const ms = new Date(dateString).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  if (dateString.includes("ago")) return dateString;
  const ms = parseArticleDate(dateString);
  if (ms === null) return dateString;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

/**
 * How old an article may be and still count as "local news".
 *
 * `engine=google_news` does not honour SerpAPI's `tbs` parameter, so the recency
 * window has to be applied here rather than in the request — without it a 2018
 * election preview ranks alongside this month's coverage, which reads as a stale
 * product. Three years is deliberately generous: constituency-level Pakistani
 * coverage is thin, and an empty card is worse than a slightly older one.
 */
const MAX_ARTICLE_AGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;

interface SerpNewsItem {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  thumbnail?: string;
  source?: string | { name?: string };
}

function sourceName(raw: SerpNewsItem["source"], link?: string): string {
  if (typeof raw === "string" && raw) return raw;
  if (raw && typeof raw === "object" && raw.name) return raw.name;
  try {
    return new URL(link || "").hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

/**
 * One SerpAPI search. `withSnippets` picks the engine per the day-0 finding.
 *
 * Every call here spends one search from a quota shared with the rest of the build,
 * so the caller tiers deliberately rather than fanning out.
 */
async function searchPkNews(
  query: string,
  apiKey: string,
  withSnippets: boolean
): Promise<PkHeadline[]> {
  const { gl, hl } = COUNTRY_SEARCH_LOCALE.PK;
  const url = new URL("https://serpapi.com/search");

  if (withSnippets) {
    // Verified: carries snippets 10/10, with real figures and real constituency
    // coverage (NA-121, NA-126 Lahore). This engine DOES honour `tbs`.
    url.searchParams.set("engine", "google");
    url.searchParams.set("tbm", "nws");
    url.searchParams.set("num", "20");
    url.searchParams.set("tbs", "qdr:y");
  } else {
    // Verified: 0 snippets, but a clean headline list from Dawn, Express Tribune,
    // Arab News PK, Radio Pakistan and Business Recorder. Ignores `tbs` — recency
    // is enforced below instead.
    url.searchParams.set("engine", "google_news");
  }

  url.searchParams.set("q", query);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.error(`SERPAPI error (pk news): ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items: SerpNewsItem[] = data.news_results || data.organic_results || [];

    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS;
    const scored: Array<{ headline: PkHeadline; at: number }> = [];

    for (const item of items) {
      const title = item.title?.trim();
      if (!title || !item.link) continue;

      if (isIndianSubject(`${title} ${item.snippet ?? ""}`)) {
        console.log(`🚫 Filtered (Indian subject matter): ${title}`);
        continue;
      }

      const at = parseArticleDate(item.date);
      if (at !== null && at < cutoff) continue;

      scored.push({
        at: at ?? 0, // undated results sort last rather than being dropped
        headline: {
          title,
          url: item.link,
          source: sourceName(item.source, item.link),
          date: formatDate(item.date),
          thumbnail: item.thumbnail,
          snippet: withSnippets ? item.snippet?.trim() || undefined : undefined,
        },
      });
    }

    return scored
      .sort((a, b) => b.at - a.at)
      .slice(0, 8)
      .map((s) => s.headline);
  } catch (error) {
    console.error("SERPAPI search error (pk news):", error);
    return [];
  }
}

/**
 * Query ladder for a seat, widest signal first.
 *
 * A constituency code is the highest-precision term Pakistani press uses ("NA-121",
 * "NA-126 Lahore" both appeared verbatim in day-0 results), but coverage at that
 * granularity is thin, so the member's name carries most queries. District and
 * province are the widening steps.
 */
function buildQueries(c: PkConstituency): string[] {
  const province = c.province ? PK_PROVINCES[c.province].nameEn : "Pakistan";
  const districts = c.districts.length ? c.districts.join(" OR ") : province;

  if (c.vacant) {
    // No member and no geography in the roster for a vacant seat, so the code is
    // all there is. A by-election is the thing worth surfacing.
    return [
      `"${c.code}" by-election Pakistan National Assembly`,
      `"${c.code}" constituency Pakistan`,
    ];
  }

  return [
    `"${c.code}" OR "${c.memberName}"`,
    `${districts} ${province} politics National Assembly`,
    `"${province}" Pakistan politics assembly`,
  ];
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const code = normalizePkCode(params.get("code"));
    const withSnippets = params.get("snippets") === "1";

    if (!code) {
      return NextResponse.json(
        { error: "Invalid or missing constituency code. Expected e.g. NA-123." },
        { status: 400 }
      );
    }

    const constituency = getConstituency(code);
    if (!constituency) {
      return NextResponse.json(
        { error: `No National Assembly constituency ${code}` },
        { status: 404 }
      );
    }

    const useCache = request.headers.get("x-use-cache") !== "false";
    const cacheDurationSeconds = parseInt(
      request.headers.get("x-cache-duration-seconds") || "86400",
      10
    );

    // Snippet and headline results come from different engines and are not
    // interchangeable, so they get separate cache entries.
    const variant = withSnippets ? { snippets: "1" } : undefined;
    const memoryCacheKey = generateCacheKey("pk-news", {
      code,
      snippets: String(withSnippets),
    });
    const dbCacheKey = generateDistrictCacheKey("news", code, variant, "PK");

    const dbCached = await getFromDbCache<{ headlines: PkHeadline[] }>(
      dbCacheKey,
      useCache
    );
    if (dbCached) {
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }

    const memoryCached = serverCache.get<{ headlines: PkHeadline[] }>(
      memoryCacheKey,
      useCache
    );
    if (memoryCached) return NextResponse.json(memoryCached);

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      console.warn("⚠️ SERPAPI_KEY not set; returning no headlines for", code);
      // No placeholder headlines. The US route invents "Local news for VA05"
      // linking to "#", which reads as a broken product to anyone who clicks it.
      return NextResponse.json({ headlines: [], reason: "search_unavailable" });
    }

    const queries = buildQueries(constituency);
    let headlines: PkHeadline[] = [];
    const queriesRun: string[] = [];

    // Tier down only while the result is thin. Each tier is one paid search.
    for (const query of queries) {
      queriesRun.push(query);
      console.log(`📰 [${code}] querying: ${query}`);
      const batch = await searchPkNews(query, apiKey, withSnippets);

      const seen = new Set(headlines.map((h) => h.url));
      for (const h of batch) {
        if (seen.has(h.url)) continue;
        seen.add(h.url);
        headlines.push(h);
      }

      if (headlines.length >= 5) break;
    }

    headlines = headlines.slice(0, 8);

    const result = {
      headlines,
      queries: queriesRun,
      constituency: code,
    };

    serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
    await setInDbCache(dbCacheKey, "news", code, result, cacheDurationSeconds);

    console.log(
      `✅ [${code}] ${headlines.length} headlines from ${queriesRun.length} search(es)` +
        `${withSnippets ? ` (${headlines.filter((h) => h.snippet).length} with snippets)` : ""}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching PK constituency news:", error);
    return NextResponse.json({ headlines: [], reason: "error" });
  }
}
