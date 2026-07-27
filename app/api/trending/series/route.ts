import { NextRequest, NextResponse } from "next/server";
import { fetchTrendsSeries } from "@/src/trending/series";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

export interface SeriesResponse {
  /**
   * 'trends'      - real Google Trends interest-over-time data, passed through unmodified
   * 'tweets'      - real tweets about the topic
   * 'queries'     - real related search queries
   * 'unavailable' - no data could be retrieved; no points are returned
   */
  source: 'trends' | 'tweets' | 'queries' | 'unavailable';
  points?: Array<{ t: string; v: number }>;
}

/**
 * Cache namespace version. Bumped so that entries written by earlier versions
 * of this route (which could contain generated, non-Trends series stored under
 * source: 'trends') are never read back.
 */
const CACHE_VERSION = '2';

/**
 * GET /api/trending/series?topic=...
 * Returns the Google Trends time series for a trending topic.
 *
 * Data integrity rules:
 * - Trends values are returned exactly as retrieved; they are never smoothed,
 *   re-sloped or otherwise rewritten.
 * - If Trends returns nothing, or the lookup fails, the response is
 *   { source: 'unavailable' } with no points. No substitute series is generated.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get('topic');

    if (!topic) {
      return NextResponse.json(
        { error: 'Missing topic parameter' },
        { status: 400 }
      );
    }

    // Check cache settings - uses global cache setting from admin (default: 24h)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);

    const memoryCacheKey = generateCacheKey('trending-series', { topic, v: CACHE_VERSION });
    const dbCacheKey = generateDistrictCacheKey('trending-series', 'national', { topic, v: CACHE_VERSION });

    // Try database cache first
    const dbCached = await getFromDbCache<SeriesResponse>(dbCacheKey, useCache);
    if (dbCached) {
      console.log(`📦 Using DB cached series for "${topic}"`);
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }

    // Fall back to memory cache
    const memoryCached = serverCache.get<SeriesResponse>(memoryCacheKey, useCache);
    if (memoryCached) {
      console.log(`📦 Using memory cached series for "${topic}"`);
      return NextResponse.json(memoryCached);
    }

    console.log(`📊 Fetching series data for topic: "${topic}"`);

    // Google Trends (accept any number of points), returned unmodified
    const trendsData = await fetchTrendsSeries(topic);
    if (trendsData && trendsData.length > 0) {
      console.log(`✅ Using Trends series (${trendsData.length} points)`);
      const result: SeriesResponse = {
        source: 'trends',
        points: trendsData,
      };
      // Cache the real result
      serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
      await setInDbCache(dbCacheKey, 'trending-series', 'national', result, cacheDurationSeconds);
      return NextResponse.json(result);
    }

    // No Trends data for this topic. Report that honestly rather than
    // generating a series and labelling it as Google Trends.
    // Deliberately not cached so a later request can pick up real data.
    console.log(`ℹ️ No Google Trends series available for topic: "${topic}"`);
    return NextResponse.json({ source: 'unavailable' } as SeriesResponse);

  } catch (error) {
    console.error('❌ Error in series API:', error);
    // Never throw - report unavailability rather than inventing a series.
    return NextResponse.json({ source: 'unavailable' } as SeriesResponse);
  }
}
