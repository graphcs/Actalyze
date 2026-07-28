import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { chatCompletions } from "@/lib/ai-provider";
import { searchTweetsViaSerpApi } from "@/lib/serpapi-tweets";
import { COUNTRY_SEARCH_LOCALE } from "@/lib/country";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";
import { normalizePkCode } from "@/lib/pk/constituency-code";
import { getConstituency, type PkConstituency } from "@/lib/pk/constituencies";
import { PK_PROVINCES } from "@/lib/pk/parties";
import {
  classifyPkPosts,
  aggregatePkClassifications,
  type PkIntelResponse,
  type PkPost,
} from "@/lib/pk/party-intel";

/**
 * Public-discourse signal for a National Assembly constituency.
 *
 * Modelled on `/api/district/ai-intel`, minus the Twitter path. X's free tier forbids
 * `/2/tweets/search/recent`, so on this deployment both Twitter attempts in the US
 * route return 403 and every post that reaches the classifier arrived via SerpAPI
 * anyway. Rather than reproduce ~200 lines of dead code and a hard 503 on missing
 * Twitter credentials, this route goes straight to the path that works.
 *
 * Everything returned is derived from real retrieved posts. Nothing is synthesised:
 * with no posts, `sample_size` is 0 and the page renders no figure at all.
 *
 * GET /api/pk/ai-intel?code=NA-123
 */

/** Same ceiling as the US route — see its note on why 40 rather than 25. */
const MAX_POSTS_TO_CLASSIFY = 40;

/** Posts requested per term. SerpAPI returns 40 results per search regardless, so a
 *  higher limit extracts more from the SAME paid search rather than buying another. */
const POSTS_PER_TERM = 20;

/** Stop widening once the sample can support the MIN_PARTISAN_POSTS gate. */
const ENOUGH_POSTS = 20;

function createTimer() {
  const started = Date.now();
  const stages: Record<string, number> = {};

  async function time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      stages[name] = (stages[name] ?? 0) + (Date.now() - t0);
    }
  }

  return { time, summary: () => ({ ...stages, total: Date.now() - started }) };
}

/**
 * Search terms derived from the roster, not from a model.
 *
 * The US route once asked gpt-4o for "local politicians and district issues"; with no
 * web access that call invented plausible names from training data, and the terms were
 * only ever fed to SerpAPI as query strings. Here the member, seat, districts and
 * province all come from na.gov.pk, so the terms cost 0ms, are stable enough for
 * SerpAPI's fetch cache to hit, and cannot fabricate a politician.
 *
 * `primary` is queried first; `widen` only when `primary` came up short. Every query
 * spends one search from a quota shared across this build.
 */
function buildSearchTerms(c: PkConstituency): { primary: string[]; widen: string[] } {
  const province = c.province ? PK_PROVINCES[c.province].nameEn : "Pakistan";

  if (c.vacant) {
    return {
      primary: [`${c.code} by-election`, `${c.code} National Assembly Pakistan`],
      widen: [`Pakistan National Assembly by-election`],
    };
  }

  const district = c.districts[0] ?? province;

  return {
    primary: [
      `${c.code} ${c.memberName}`,
      `${c.memberName} ${district}`,
      `${c.code} constituency`,
    ],
    widen: [`${district} politics Pakistan`, `${province} National Assembly politics`],
  };
}

export async function GET(request: NextRequest) {
  const timer = createTimer();

  try {
    const code = normalizePkCode(request.nextUrl.searchParams.get("code"));
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

    const memoryCacheKey = generateCacheKey("pk-ai-intel", { code });
    const dbCacheKey = generateDistrictCacheKey("ai-intel", code, undefined, "PK");

    const dbCached = await timer.time("db_cache_read", () =>
      getFromDbCache<PkIntelResponse>(dbCacheKey, useCache)
    );
    if (dbCached) {
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }

    const memoryCached = serverCache.get<PkIntelResponse>(memoryCacheKey, useCache);
    if (memoryCached) return NextResponse.json(memoryCached);

    if (!chatCompletions()) {
      console.error("❌ No LLM provider configured");
      return NextResponse.json(
        { error: "AI service unavailable", constituency: code },
        { status: 503 }
      );
    }

    console.log(`🧠 Building discourse signal for ${code}`);

    // ── Retrieval ────────────────────────────────────────────────────────────────
    const { primary, widen } = buildSearchTerms(constituency);
    const seen = new Set<string>();
    const posts: PkPost[] = [];
    const now = new Date();
    const termsQueried: string[] = [];

    const absorb = (batch: Awaited<ReturnType<typeof searchTweetsViaSerpApi>>) => {
      for (const t of batch) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        posts.push({
          id: t.id,
          text: t.text,
          author: t.author,
          username: t.username,
          url: t.url,
          created_at: t.created_at ?? now.toISOString(),
        });
      }
    };

    const runWave = async (terms: string[]) => {
      const batches = await Promise.all(
        terms.map((term) =>
          // Pakistan's locale. Without it the shared helper sends gl=us and a
          // constituency query returns American posts.
          searchTweetsViaSerpApi(term, POSTS_PER_TERM, COUNTRY_SEARCH_LOCALE.PK).catch(
            () => []
          )
        )
      );
      batches.forEach(absorb);
      termsQueried.push(...terms);
    };

    await timer.time("serpapi_retrieval", async () => {
      await runWave(primary);
      if (posts.length < ENOUGH_POSTS) {
        console.log(`🔎 ${posts.length} posts from ${primary.length} terms, widening`);
        await runWave(widen);
      }
    });

    console.log(
      `🔎 [${code}] ${termsQueried.length} searches spent, ${posts.length} distinct posts`
    );

    if (posts.length === 0) {
      // Honest empty state. Cached briefly so a demo does not re-spend quota on a
      // seat that has no public discussion, but not for a full day.
      const empty = aggregatePkClassifications([], code, constituency.name);
      serverCache.set(memoryCacheKey, empty, 30 * 60);
      return NextResponse.json(empty);
    }

    // ── Classification ───────────────────────────────────────────────────────────
    const toClassify = posts.slice(0, MAX_POSTS_TO_CLASSIFY);

    const classifications = await timer.time("classify", () =>
      classifyPkPosts(toClassify, {
        code: constituency.code,
        seatName: constituency.name,
        districts: constituency.districts,
        province: constituency.province
          ? PK_PROVINCES[constituency.province].nameEn
          : null,
        memberName: constituency.memberName,
        memberParty: constituency.party,
      })
    );

    const intel = aggregatePkClassifications(classifications, code, constituency.name);

    console.log(
      `🎯 [${code}] n=${intel.sample_size} partisan=${intel.partisan_posts} ` +
        `leader=${intel.outlook.leader ?? "none"} lead=${intel.outlook.leadPoints} ` +
        `(${intel.outlook.competitiveness})`
    );

    // Classification is the expensive stage; hold it for at least 6h like the US route.
    const finalCacheDuration = Math.max(cacheDurationSeconds, 6 * 60 * 60);
    serverCache.set(memoryCacheKey, intel, finalCacheDuration);
    await timer.time("db_cache_write", () =>
      setInDbCache(dbCacheKey, "ai-intel", code, intel, finalCacheDuration)
    );

    const timings = timer.summary();
    console.log(`⏱️ pk ai-intel ${code}:`, JSON.stringify(timings));

    return NextResponse.json(intel, {
      headers: { "x-stage-timings": JSON.stringify(timings) },
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error("❌ Error in PK ai-intel:", err.message || error);
    return NextResponse.json(
      { error: "Failed to build discourse signal", details: err.message },
      { status: 500 }
    );
  }
}
