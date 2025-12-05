/**
 * API Route: /api/wordcloud/generate
 * Generates word cloud data from Twitter posts
 */

import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  processTweet,
  calculateWordFrequencies,
  calculateAverageSentiment,
} from "@/src/lib/text-processor";
import type { WordCloudData, WordCloudFilters, WordCloudWord } from "@/types/wordcloud";

interface TweetData {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

/**
 * Calculate time range in hours
 */
function getTimeRangeHours(timeRange: string): number {
  switch (timeRange) {
    case '24h':
      return 24;
    case '7d':
      return 24 * 7;
    case '30d':
      return 24 * 30;
    default:
      return 24 * 7; // Default to 7 days
  }
}

/**
 * Calculate engagement score for a tweet
 */
function calculateEngagement(metrics: TweetData['public_metrics']): number {
  if (!metrics) return 0;
  return (metrics.like_count || 0) + 
         (metrics.retweet_count || 0) * 2 + 
         (metrics.reply_count || 0);
}

/**
 * GET /api/wordcloud/generate
 * Query params:
 * - topic: string (required)
 * - timeRange: 24h | 7d | 30d (default: 7d)
 * - location: national | state code (default: national)
 * - sentimentType: all | positive | negative | neutral (default: all)
 * - minFrequency: number (default: 2)
 * - maxTweets: number (default: 500, max: 1000)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters
    const filters: WordCloudFilters = {
      topic: searchParams.get('topic') || '',
      timeRange: (searchParams.get('timeRange') as WordCloudFilters['timeRange']) || '7d',
      location: searchParams.get('location') || 'national',
      sentimentType: (searchParams.get('sentimentType') as WordCloudFilters['sentimentType']) || 'all',
      minFrequency: parseInt(searchParams.get('minFrequency') || '2'),
    };

    const maxTweets = Math.min(parseInt(searchParams.get('maxTweets') || '500'), 1000);
    const excludeKeyword = searchParams.get('excludeKeyword') === 'true';

    if (!filters.topic) {
      return NextResponse.json(
        { error: 'Missing topic parameter' },
        { status: 400 }
      );
    }

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('wordcloud', {
      topic: filters.topic,
      timeRange: filters.timeRange,
      location: filters.location || 'national',
      sentimentType: filters.sentimentType || 'all',
      minFrequency: filters.minFrequency || 2,
      maxTweets: maxTweets,
    });
    const cached = serverCache.get<WordCloudData>(cacheKey, useCache);

    if (cached) {
      console.log('✅ Returning cached word cloud data');
      return NextResponse.json(cached);
    }

    console.log(`🌥️ Generating word cloud for: "${filters.topic}"`);

    // Get Twitter API credentials
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Twitter API credentials not found');
      return NextResponse.json(
        { error: 'Twitter API not configured' },
        { status: 500 }
      );
    }

    // Authenticate with Twitter API
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    const appOnlyClient = await client.appLogin();

    // Build search query
    const searchQuery = `${filters.topic} -is:retweet -is:reply lang:en`;
    
    // Note: Location filtering via Twitter API requires different approach
    // The 'place:' operator is not supported in basic search
    // We'll filter client-side or use Twitter's geo features in a future update

    // Calculate date range (for reference, though Free tier limits to 7 days)
    const hoursAgo = getTimeRangeHours(filters.timeRange);

    console.log(`📊 Searching Twitter: "${searchQuery}"`);
    console.log(`📅 Time range: Last ${hoursAgo} hours (Twitter Free tier: last 7 days max)`);
    console.log(`🎯 Target: ${maxTweets} tweets`);

    // Fetch multiple pages of tweets to reach maxTweets
    const allTweets: TweetData[] = [];
    let nextToken: string | undefined = undefined;
    const tweetsPerPage = 100; // Twitter API max per request
    const maxPages = Math.ceil(maxTweets / tweetsPerPage);

    try {
      for (let page = 0; page < maxPages; page++) {
        console.log(`📥 Fetching page ${page + 1}/${maxPages}...`);
        
        const searchParams: Record<string, unknown> = {
          max_results: tweetsPerPage,
          'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
          expansions: ['author_id'],
        };

        if (nextToken) {
          searchParams.next_token = nextToken;
        }

        const result = await appOnlyClient.v2.search(searchQuery, searchParams);

        if (result.data.data && result.data.data.length > 0) {
          allTweets.push(...(result.data.data as TweetData[]));
          console.log(`   ✓ Got ${result.data.data.length} tweets (total: ${allTweets.length})`);
        }

        // Check if there's a next page
        if (result.data.meta?.next_token && allTweets.length < maxTweets) {
          nextToken = result.data.meta.next_token;
          // Add a small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          break;
        }
      }
    } catch (paginationError: unknown) {
      console.warn('⚠️ Pagination stopped early:', paginationError);
      // Continue with tweets we have so far
    }

    if (allTweets.length === 0) {
      console.log(`⚠️ No tweets found for: "${filters.topic}"`);
      return NextResponse.json({
        words: [],
        metadata: {
          topic: filters.topic,
          filters,
          totalTweets: 0,
          processedAt: new Date().toISOString(),
          uniqueWords: 0,
        },
      } as WordCloudData);
    }

    console.log(`✅ Found ${allTweets.length} tweets total`);

    // Process all tweets
    const processedTweets = allTweets.map((tweet) =>
      processTweet(tweet.text || '', tweet.id, tweet.created_at || new Date().toISOString())
    );

    // Filter by sentiment if specified
    let filteredTweets = processedTweets;
    if (filters.sentimentType && filters.sentimentType !== 'all') {
      filteredTweets = processedTweets.filter(
        (tweet) => tweet.sentimentCategory === filters.sentimentType
      );
    }

    console.log(`📝 Processing ${filteredTweets.length} tweets after sentiment filter`);

    // Calculate word frequencies
    const wordFrequencies = calculateWordFrequencies(
      filteredTweets,
      filters.minFrequency || 2
    );

    // Exclude the main topic keyword(s) if requested to prevent them from dominating
    if (excludeKeyword && filters.topic) {
      const topicWords = filters.topic.toLowerCase().split(/\s+/);
      for (const word of topicWords) {
        wordFrequencies.delete(word);
      }
      console.log(`🚫 Excluded topic keywords: ${topicWords.join(', ')}`);
    }

    console.log(`📊 Found ${wordFrequencies.size} unique words`);

    // Build word cloud data with metadata
    const words: WordCloudWord[] = [];
    const tweetsById = new Map(allTweets.map((t) => [t.id, t]));

    for (const [word, data] of wordFrequencies.entries()) {
      const avgSentiment = calculateAverageSentiment(data.sentiments);
      
      // Find the tweet with highest engagement for this word
      let topTweet: WordCloudWord['metadata']['topTweet'] = undefined;
      let maxEngagement = 0;
      
      for (const tweetId of data.tweetIds) {
        const tweet = tweetsById.get(tweetId);
        if (tweet) {
          const engagement = calculateEngagement(tweet.public_metrics);
          if (engagement > maxEngagement) {
            maxEngagement = engagement;
            topTweet = {
              id: tweet.id,
              text: tweet.text || '',
              author: 'Unknown',
              username: 'unknown',
              engagement,
            };
          }
        }
      }

      words.push({
        text: word,
        value: data.count,
        sentiment: avgSentiment,
        metadata: {
          tweetIds: data.tweetIds,
          firstSeen: data.timestamps[0],
          lastSeen: data.timestamps[data.timestamps.length - 1],
          topTweet,
        },
      });
    }

    // Sort by frequency and return all words (no limit)
    words.sort((a, b) => b.value - a.value);

    const responseData: WordCloudData = {
      words: words,
      metadata: {
        topic: filters.topic,
        filters,
        totalTweets: filteredTweets.length,
        processedAt: new Date().toISOString(),
        uniqueWords: words.length,
      },
    };

    // Cache for 30 minutes
    serverCache.set(cacheKey, responseData, 30 * 60);

    console.log(`✅ Generated word cloud with ${words.length} words`);

    return NextResponse.json(responseData);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error generating word cloud:', err.message || error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate word cloud',
        details: err.message 
      },
      { status: 500 }
    );
  }
}
