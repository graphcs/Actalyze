/**
 * SERPAPI series data fetchers for trending topic charts
 * Provides time-series data with automatic fallbacks
 */

const SERPAPI_BASE = 'https://serpapi.com/search';

// Caching disabled per user request
// Simple in-memory cache with TTL
// interface CacheEntry<T> {
//   data: T;
//   expires: number;
// }

// const cache = new Map<string, CacheEntry<unknown>>();
// const CACHE_TTL = 45 * 60 * 1000; // 45 minutes

function getCached<T>(_key: string): T | null {
  // Caching disabled
  return null;
}

function setCache<T>(_key: string, _data: T): void {
  // Caching disabled
  return;
}

export interface TimeSeriesPoint {
  t: string; // ISO timestamp
  v: number; // Value 0-100 for trends, count for news
}

/**
 * Fetch Google Trends time series data (last 7 days)
 */
export async function fetchTrendsSeries(topic: string): Promise<TimeSeriesPoint[] | null> {
  const cacheKey = `series:trends:${topic.toLowerCase()}`;
  const cached = getCached<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'google_trends');
    url.searchParams.set('data_type', 'TIMESERIES');
    url.searchParams.set('q', topic);
    url.searchParams.set('geo', 'US');
    // Don't set date - defaults to 'today 12-m' which works
    // Or use 'now 7-d' format, but 12 months provides better data
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];

    // Accept any number of points (removed threshold check per user request)
    if (timelineData.length === 0) return null;

    const points: TimeSeriesPoint[] = timelineData
      .map((item: { date?: string; timestamp?: string; values?: Array<{ value?: string | number; extracted_value?: number }> }) => {
        const timestamp = item.date || item.timestamp;
        if (!timestamp) return null;

        // Extract value from the first value entry
        const valueEntry = item.values?.[0];
        let value = 0;

        if (valueEntry) {
          if (typeof valueEntry.extracted_value === 'number') {
            value = valueEntry.extracted_value;
          } else if (valueEntry.value !== undefined) {
            const parsed = typeof valueEntry.value === 'string'
              ? parseInt(valueEntry.value)
              : valueEntry.value;
            value = isNaN(parsed) ? 0 : parsed;
          }
        }

        return {
          t: timestamp,
          v: value,
        };
      })
      .filter((p: TimeSeriesPoint | null): p is TimeSeriesPoint => p !== null);

    setCache(cacheKey, points);
    return points;
  } catch (error) {
    console.error('Error fetching trends series:', error);
    return null;
  }
}

/**
 * Fetch news velocity (hourly buckets from last 36 hours)
 */
export async function fetchNewsVelocity(topic: string, hours = 36): Promise<TimeSeriesPoint[] | null> {
  const cacheKey = `series:news:${topic.toLowerCase()}`;
  const cached = getCached<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', topic);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '100');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const newsResults = data.news_results || [];

    if (newsResults.length === 0) return null;

    // Bucket by hour
    const now = Date.now();
    const cutoff = now - (hours * 60 * 60 * 1000);
    const hourlyBuckets = new Map<number, number>();

    newsResults.forEach((article: { date?: string }) => {
      if (!article.date) return;

      try {
        const articleDate = new Date(article.date);
        const articleTime = articleDate.getTime();

        if (articleTime < cutoff || articleTime > now) return;

        // Round down to hour
        const hourKey = Math.floor(articleTime / (60 * 60 * 1000));
        hourlyBuckets.set(hourKey, (hourlyBuckets.get(hourKey) || 0) + 1);
      } catch (e) {
        // Invalid date, skip
      }
    });

    if (hourlyBuckets.size < 3) return null; // Too sparse

    // Convert to array and sort by time
    const points: TimeSeriesPoint[] = Array.from(hourlyBuckets.entries())
      .map(([hourKey, count]) => ({
        t: new Date(hourKey * 60 * 60 * 1000).toISOString(),
        v: count,
      }))
      .sort((a, b) => a.t.localeCompare(b.t));

    setCache(cacheKey, points);
    return points;
  } catch (error) {
    console.error('Error fetching news velocity:', error);
    return null;
  }
}

/**
 * Fetch related queries as fallback
 */
export async function fetchRelatedQueries(topic: string): Promise<string[] | null> {
  const cacheKey = `series:queries:${topic.toLowerCase()}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'google_trends');
    url.searchParams.set('data_type', 'RELATED_QUERIES');
    url.searchParams.set('q', topic);
    url.searchParams.set('geo', 'US');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Try rising queries first, then top queries
    const risingQueries = data.related_queries?.rising || [];
    const topQueries = data.related_queries?.top || [];

    const allQueries = [...risingQueries, ...topQueries];

    if (allQueries.length === 0) return null;

    // Extract query strings (handle different formats)
    const queries = allQueries
      .slice(0, 5)
      .map((item: { query?: string; value?: string }) => item.query || item.value)
      .filter((q): q is string => typeof q === 'string' && q.length > 0);

    if (queries.length === 0) return null;

    setCache(cacheKey, queries);
    return queries;
  } catch (error) {
    console.error('Error fetching related queries:', error);
    return null;
  }
}
