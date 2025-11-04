import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

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

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('tweets-search', { query, limit });
    const cached = serverCache.get<{ tweets: Tweet[] }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`🐦 Searching Twitter for: "${query}"`);

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Twitter API credentials not found');
      return NextResponse.json({ tweets: [] });
    }

    // Authenticate with Twitter API v2
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    // Get app-only bearer token
    const appOnlyClient = await client.appLogin();

    // Search for tweets
    // Add filters: -is:retweet (no retweets), lang:en (English only)
    const searchQuery = `${query} -is:retweet lang:en`;

    const result = await appOnlyClient.v2.search(searchQuery, {
      max_results: Math.max(10, Math.min(limit, 100)), // Twitter API requires minimum 10
      'tweet.fields': ['created_at', 'author_id'],
      expansions: ['author_id'],
    });

    if (!result.data.data || result.data.data.length === 0) {
      console.log(`⚠️  No tweets found for: "${query}"`);
      return NextResponse.json({ tweets: [] });
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

    // Format tweets
    const tweets: Tweet[] = result.data.data.map((tweet) => {
      const user = users.get(tweet.author_id || '');
      const username = user?.username || 'unknown';

      return {
        id: tweet.id,
        text: tweet.text || '',
        author: user?.name || 'Unknown',
        username: username,
        url: `https://twitter.com/${username}/status/${tweet.id}`,
        created_at: tweet.created_at || '',
      };
    }).slice(0, limit);

    console.log(`✅ Found ${tweets.length} tweets`);

    const response = { tweets };

    // Save to cache
    serverCache.set(cacheKey, response);

    return NextResponse.json(response);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error searching Twitter:', err.message || error);
    return NextResponse.json({ tweets: [] });
  }
}
