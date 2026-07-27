import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
} from "@/lib/db-cache";
import { searchTweetsViaSerpApi } from "@/lib/serpapi-tweets";

interface UserData {
  id: string;
  name: string;
  username: string;
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
}

interface TweetWithMetrics extends Tweet {
  engagement_score: number;
}

/**
 * X's free API tier does not allow search, so the live path above 403s in this
 * deployment. Recover genuine tweets through SerpAPI instead, and cache them on
 * the same keys the live path uses so repeat views are instant.
 */
async function recoverTweets(
  query: string,
  limit: number,
  reason: string,
  cacheKeys?: { memory: string; db: string; ttl: number }
) {
  const tweets = await searchTweetsViaSerpApi(query, limit);
  if (tweets.length === 0) {
    return NextResponse.json({ tweets: [] });
  }

  console.log(`✅ Serving ${tweets.length} tweets via SerpAPI for "${query}" (${reason})`);
  const response = { tweets };

  if (cacheKeys) {
    serverCache.set(cacheKeys.memory, response, cacheKeys.ttl);
    await setInDbCache(cacheKeys.db, 'tweets', 'global', response, cacheKeys.ttl);
  }

  return NextResponse.json(response);
}

/**
 * GET /api/tweets/search?query=...&limit=4
 * Searches Twitter for recent tweets and returns tweet IDs for embedding
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '4');

    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }

    // Check cache settings - default to 6 hours (21600 seconds)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '21600', 10);

    // Generate cache keys
    const memoryCacheKey = generateCacheKey('tweets-search', { query, limit: String(limit) });
    const dbCacheKey = `tweets:search:${query.toLowerCase().replace(/\s+/g, '-')}:${limit}`;

    // Check DB cache first (persistent across server restarts)
    if (useCache) {
      const dbCached = await getFromDbCache<{ tweets: Tweet[] }>(dbCacheKey, true);
      if (dbCached) {
        console.log(`📦 DB cache hit for tweets: "${query}"`);
        return NextResponse.json(dbCached);
      }
    }

    // Check memory cache as fallback
    const cached = serverCache.get<{ tweets: Tweet[] }>(memoryCacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`🐦 Searching Twitter for: "${query}"`);

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Twitter API credentials not found');
      return recoverTweets(query, limit, 'no credentials', {
        memory: memoryCacheKey,
        db: dbCacheKey,
        ttl: cacheDurationSeconds,
      });
    }

    // Authenticate with Twitter API v2
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    // Get app-only bearer token
    const appOnlyClient = await client.appLogin();

    // Search for tweets
    // Add filters: -is:retweet (no retweets), -is:reply (no replies), lang:en (English only)
    const searchQuery = `${query} -is:retweet -is:reply lang:en`;

    const result = await appOnlyClient.v2.search(searchQuery, {
      max_results: Math.max(10, Math.min(limit * 3, 100)), // Fetch more to sort by engagement
      'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
      expansions: ['author_id'],
    });

    if (!result.data.data || result.data.data.length === 0) {
      console.log(`⚠️  No tweets found for: "${query}"`);
      return recoverTweets(query, limit, 'no live results', {
        memory: memoryCacheKey,
        db: dbCacheKey,
        ttl: cacheDurationSeconds,
      });
    }

    // Map user data for easy lookup
    const users = new Map<string, UserData>();
    if (result.data.includes?.users) {
      for (const user of result.data.includes.users) {
        users.set(user.id, {
          id: user.id,
          name: user.name || 'Unknown',
          username: user.username || 'unknown',
        });
      }
    }

    // Format tweets with engagement metrics
    const tweetsWithMetrics: TweetWithMetrics[] = result.data.data.map((tweet) => {
      const user = users.get(tweet.author_id || '');
      const username = user?.username || 'unknown';

      // Calculate engagement score: likes + retweets*2 + replies
      const metrics = tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0 };
      const engagementScore =
        (metrics.like_count || 0) +
        (metrics.retweet_count || 0) * 2 +
        (metrics.reply_count || 0);

      return {
        id: tweet.id,
        text: tweet.text || '',
        author: user?.name || 'Unknown',
        username: username,
        url: `https://twitter.com/${username}/status/${tweet.id}`,
        created_at: tweet.created_at || '',
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
        engagement_score: engagementScore,
      };
    });

    // Sort by engagement score (highest first) and take top results
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tweets: Tweet[] = tweetsWithMetrics
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, limit)
      .map(({ engagement_score, ...tweet }) => tweet); // Remove only engagement_score, keep likes/retweets/replies

    console.log(`✅ Found ${tweets.length} tweets`);

    const response = { tweets };

    // Only cache if we got results (don't cache empty results)
    if (tweets.length > 0) {
      // Save to memory cache
      serverCache.set(memoryCacheKey, response, cacheDurationSeconds);

      // Save to DB cache (always write, even if cache reading is disabled)
      await setInDbCache(dbCacheKey, 'tweets', 'global', response, cacheDurationSeconds);
    }

    return NextResponse.json(response);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error searching Twitter:', err.message || error);

    // The cache keys are scoped to the try block, so rebuild them here to cache
    // the recovered results on the same keys the live path would have used.
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query') || '';
    if (!query) {
      return NextResponse.json({ tweets: [] });
    }
    const limit = parseInt(searchParams.get('limit') || '4');
    const ttl = parseInt(request.headers.get('x-cache-duration-seconds') || '21600', 10);

    return recoverTweets(query, limit, `live error ${err.code ?? ''}`.trim(), {
      memory: generateCacheKey('tweets-search', { query, limit: String(limit) }),
      db: `tweets:search:${query.toLowerCase().replace(/\s+/g, '-')}:${limit}`,
      ttl,
    });
  }
}
