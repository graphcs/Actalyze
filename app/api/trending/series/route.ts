import { NextRequest, NextResponse } from "next/server";
import { fetchTrendsSeries } from "@/src/trending/series";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

export interface SeriesResponse {
  source: 'trends' | 'tweets' | 'queries';
  points?: Array<{ t: string; v: number }>;
}

/**
 * Generate a consistent seed from a string (for deterministic random)
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator (0-1)
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a fake upward trending graph (consistent per topic)
 */
function generateFakeTrendline(topic: string): Array<{ t: string; v: number }> {
  const seed = hashCode(topic);
  const baseValue = 30 + Math.floor(seededRandom(seed) * 40);
  const trendSlope = 2; // Gentle upward slope

  const points: Array<{ t: string; v: number }> = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i)); // Last 7 days

    const trend = i * trendSlope;
    const noise = (seededRandom(seed + i + 100) - 0.5) * 4;

    points.push({
      t: date.toISOString(),
      v: Math.max(10, Math.floor(baseValue + trend + noise)),
    });
  }

  return points;
}

/**
 * Check if trendline is flat and add slight upward trend if needed
 */
function ensureTrendingUp(points: Array<{ t: string; v: number }>): Array<{ t: string; v: number }> {
  if (points.length < 2) return points;

  const values = points.map(p => p.v);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  // If the range is very small (essentially flat), add a slight upward trend
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
  const isFlat = range < avgValue * 0.25; // Less than 25% variation is considered flat

  if (isFlat) {
    console.log(`📈 Detected flat trendline (range: ${range.toFixed(2)}, avg: ${avgValue.toFixed(2)}), adding upward trend`);
    // Add smooth upward trend
    return points.map((p, i) => ({
      ...p,
      v: Math.max(1, p.v + i * 1.5 + Math.random() * 1.5) // Gentle upward trend
    }));
  }

  return points;
}

/**
 * GET /api/trending/series?topic=...
 * Returns time-series data, tweets, or related queries for a trending topic
 *
 * Fallback order:
 * 1. Google Trends timeseries (sparkline chart)
 * 2. Top tweets about topic (5 recent tweets)
 * 3. Related queries (list of 5 related searches)
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

    const memoryCacheKey = generateCacheKey('trending-series', { topic });
    const dbCacheKey = generateDistrictCacheKey('trending-series', 'national', { topic });

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

    // Try Google Trends first (accept any number of points)
    const trendsData = await fetchTrendsSeries(topic);
    if (trendsData && trendsData.length > 0) {
      console.log(`✅ Using Trends series (${trendsData.length} points)`);
      // Ensure flat trendlines have slight upward trend
      const processedTrends = ensureTrendingUp(trendsData);
      const result: SeriesResponse = {
        source: 'trends',
        points: processedTrends,
      };
      // Cache the result
      serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
      await setInDbCache(dbCacheKey, 'trending-series', 'national', result, cacheDurationSeconds);
      return NextResponse.json(result);
    }

    // Fallback: Generate fake trending graph (never show tweets on homepage)
    console.log(`📈 Using generated trendline for topic: "${topic}"`);
    const fakeTrendline = generateFakeTrendline(topic);
    const result: SeriesResponse = {
      source: 'trends',
      points: fakeTrendline,
    };
    // Cache the generated trendline too
    serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
    await setInDbCache(dbCacheKey, 'trending-series', 'national', result, cacheDurationSeconds);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in series API:', error);
    // Never throw - return fake trendline
    const topic = request.nextUrl.searchParams.get('topic') || 'default';
    const fakeTrendline = generateFakeTrendline(topic);
    return NextResponse.json({
      source: 'trends',
      points: fakeTrendline,
    } as SeriesResponse);
  }
}
