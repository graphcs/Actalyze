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

export interface Tweet {
  text: string;
  author: string;
  engagement: number; // likes + retweets
  url?: string;
}

/**
 * Extract keywords from long topic names for better Google Trends queries
 * Reduces long phrases to 2-4 most relevant words
 */
function extractKeywordsForTrends(topic: string): string {
  // Common stop words to remove
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'including', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may',
    'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  const words = topic
    .split(' ')
    .filter(word => {
      const lower = word.toLowerCase();
      return !stopWords.has(lower) && word.length > 2;
    });

  // Take first 3-4 meaningful words (usually proper nouns + key context)
  return words.slice(0, 4).join(' ');
}

/**
 * Internal helper to try fetching Google Trends with a specific query
 */
async function tryFetchTrends(query: string, apiKey: string): Promise<TimeSeriesPoint[] | null> {
  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'google_trends');
    url.searchParams.set('data_type', 'TIMESERIES');
    url.searchParams.set('q', query);
    url.searchParams.set('geo', 'US');
    url.searchParams.set('api_key', apiKey);

    console.log(`🔍 Trying Google Trends with query: "${query}"`);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];

    if (timelineData.length === 0) return null;

    const points: TimeSeriesPoint[] = timelineData
      .map((item: { date?: string; timestamp?: string; values?: Array<{ value?: string | number; extracted_value?: number }> }) => {
        let timestamp = item.date || item.timestamp;
        if (!timestamp) return null;

        // Normalize timestamp to ISO format and validate
        try {
          // Handle date range format like "Oct 27 – Nov 2, 2024"
          // Extract the end date (second date in the range)
          if (timestamp.includes('–') || timestamp.includes('-')) {
            const parts = timestamp.split(/\s*[–-]\s*/);
            if (parts.length === 2) {
              // Second part might be "Nov 2, 2024" or just "Nov 2" or "2, 2024"
              let endDate = parts[1].trim();

              // If it's missing the month, prepend from the range start
              if (/^\d+,?\s*\d{4}/.test(endDate)) {
                // Format is "2, 2024" - need to get month from start
                const monthMatch = parts[0].match(/[A-Za-z]+/);
                if (monthMatch) {
                  endDate = `${monthMatch[0]} ${endDate}`;
                }
              }

              timestamp = endDate;
            }
          }

          const date = new Date(timestamp);
          if (isNaN(date.getTime())) {
            console.warn(`Invalid timestamp from Google Trends: ${timestamp}`);
            return null;
          }
          timestamp = date.toISOString();
        } catch (e) {
          console.warn(`Failed to parse timestamp: ${timestamp}`);
          return null;
        }

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

    return points.length > 0 ? points : null;
  } catch (error) {
    console.error(`Error trying query "${query}":`, error);
    return null;
  }
}

/**
 * Fetch Google Trends time series data with keyword extraction and retry logic
 */
export async function fetchTrendsSeries(topic: string): Promise<TimeSeriesPoint[] | null> {
  const cacheKey = `series:trends:${topic.toLowerCase()}`;
  const cached = getCached<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  // Try 1: Extract keywords (removes stop words, takes 3-4 words)
  const keywords = extractKeywordsForTrends(topic);
  let data = await tryFetchTrends(keywords, apiKey);
  if (data) {
    console.log(`✅ Google Trends succeeded with keywords: "${keywords}"`);
    setCache(cacheKey, data);
    return data;
  }

  // Try 2: Just first 3 words
  const shortQuery = topic.split(' ').slice(0, 3).join(' ');
  if (shortQuery !== keywords) {
    data = await tryFetchTrends(shortQuery, apiKey);
    if (data) {
      console.log(`✅ Google Trends succeeded with short query: "${shortQuery}"`);
      setCache(cacheKey, data);
      return data;
    }
  }

  // Try 3: First 2 words as last resort
  const veryShortQuery = topic.split(' ').slice(0, 2).join(' ');
  if (veryShortQuery !== shortQuery) {
    data = await tryFetchTrends(veryShortQuery, apiKey);
    if (data) {
      console.log(`✅ Google Trends succeeded with very short query: "${veryShortQuery}"`);
      setCache(cacheKey, data);
      return data;
    }
  }

  console.log(`⚠️ Google Trends failed for all variations of: "${topic}"`);
  return null;
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
 * Fetch top tweets about a topic using Twitter search
 */
export async function fetchTopTweets(topic: string): Promise<Tweet[] | null> {
  const cacheKey = `series:tweets:${topic.toLowerCase()}`;
  const cached = getCached<Tweet[]>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  try {
    // Use keyword extraction for better Twitter search results
    const keywords = extractKeywordsForTrends(topic);

    const url = new URL(SERPAPI_BASE);
    url.searchParams.set('engine', 'twitter');
    url.searchParams.set('q', keywords);
    url.searchParams.set('count', '5');
    url.searchParams.set('api_key', apiKey);

    console.log(`🐦 Fetching tweets for: "${keywords}"`);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.organic_results || data.tweets || [];

    if (results.length === 0) return null;

    // Map to Tweet interface
    const tweets: Tweet[] = results
      .slice(0, 5)
      .map((tweet: {
        text?: string;
        snippet?: string;
        author?: { name?: string; username?: string };
        user?: { name?: string; username?: string };
        likes?: number;
        retweets?: number;
        engagement?: { likes?: number; retweets?: number };
        link?: string;
      }) => {
        const text = tweet.text || tweet.snippet || '';
        const author = tweet.author || tweet.user;
        const authorName = author?.name || author?.username || 'Unknown';

        // Calculate engagement
        let engagement = 0;
        if (tweet.likes !== undefined && tweet.retweets !== undefined) {
          engagement = (tweet.likes || 0) + (tweet.retweets || 0);
        } else if (tweet.engagement) {
          engagement = (tweet.engagement.likes || 0) + (tweet.engagement.retweets || 0);
        }

        return {
          text,
          author: authorName,
          engagement,
          url: tweet.link,
        };
      })
      .filter((tweet: Tweet) => tweet.text.length > 0);

    if (tweets.length === 0) return null;

    console.log(`✅ Found ${tweets.length} tweets`);
    setCache(cacheKey, tweets);
    return tweets;
  } catch (error) {
    console.error('Error fetching tweets:', error);
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
