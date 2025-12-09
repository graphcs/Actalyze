import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";
import {
  getCachedTweets,
  cacheTweets,
  getCachedTweetCount,
  CachedTweet,
} from "@/lib/tweet-cache";
import {
  Tweet,
  AIIntelResponse,
  STATE_NAMES,
  classifyTweets,
  aggregateClassifications,
} from "@/lib/ai-intel";

interface UserData {
  id: string;
  name: string;
  username: string;
  location?: string;
  description?: string;
}

interface TweetWithMetrics extends Tweet {
  engagement_score: number;
  age_days: number;
}

/**
 * GET /api/district/ai-intel?district=VA10
 * Returns AI-powered political intelligence for a congressional district
 * Based on concepts from "Artificially Intelligent Opinion Polling" (Cerina & Duch, 2023)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const districtCode = searchParams.get('district')?.toUpperCase();

    if (!districtCode) {
      return NextResponse.json(
        { error: 'Missing district parameter' },
        { status: 400 }
      );
    }

    // Parse district code (e.g., "VA10" -> state: "VA", district: "10")
    const match = districtCode.match(/^([A-Z]{2})(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid district code format' },
        { status: 400 }
      );
    }

    const [, stateCode, districtNum] = match;
    const stateName = STATE_NAMES[stateCode] || stateCode;
    const districtLabel = `${stateCode}-${parseInt(districtNum)}`;
    const districtName = `${stateName}'s ${parseInt(districtNum)} Congressional District`;

    // Check cache headers
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '21600', 10); // Default 6h for AI intel

    // Generate cache keys
    const memoryCacheKey = generateCacheKey('district-ai-intel', { district: districtCode });
    const dbCacheKey = generateDistrictCacheKey('ai-intel', districtCode);

    // Try database cache first (persists across restarts)
    const dbCached = await getFromDbCache<AIIntelResponse>(dbCacheKey, useCache);
    if (dbCached) {
      console.log(`📦 Using DB cached AI intel for ${districtLabel}`);
      // Also set in memory cache for faster subsequent hits
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }

    // Fall back to memory cache
    const memoryCached = serverCache.get<AIIntelResponse>(memoryCacheKey, useCache);
    if (memoryCached) {
      console.log(`📦 Using memory cached AI intel for ${districtLabel}`);
      return NextResponse.json(memoryCached);
    }

    console.log(`🧠 Generating AI political intelligence for ${districtLabel}`);

    // Check for required API keys
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const twitterKey = process.env.TWITTER_API_KEY;
    const twitterSecret = process.env.TWITTER_API_SECRET;

    if (!openrouterKey) {
      console.error('❌ OPENROUTER_API_KEY not found');
      return NextResponse.json({
        error: 'AI service unavailable',
        district: districtCode,
      }, { status: 503 });
    }

    if (!twitterKey || !twitterSecret) {
      console.error('❌ Twitter API credentials not found');
      return NextResponse.json({
        error: 'Twitter service unavailable',
        district: districtCode,
      }, { status: 503 });
    }

    // Step 1: Get trending topics for the district using Perplexity
    console.log(`🔍 Finding trending topics for ${districtLabel}`);

    const topicsPrompt = `You are a political research assistant with access to current news and web search. Research and identify 10 search terms for finding political discussions relevant to ${districtName} (${districtLabel}) in ${stateName} as of December 2025.

Generate search terms across these categories:
- 3 DISTRICT-SPECIFIC: Local politicians, district issues, local controversies
- 3 STATE-LEVEL: ${stateName} governor, state legislature, statewide issues
- 2 REGIONAL: Major cities in the district, regional concerns (economy, traffic, housing)
- 2 NATIONAL ISSUES relevant to ${stateName}: Immigration, economy, healthcare debates with state context

Output ONLY a bulleted list of Twitter/X search terms:
- [search term]
- [search term]
...

Each search term should be SHORT (1-4 words), use keywords people actually tweet about. Include a mix of specific local terms AND broader state/regional terms to ensure sufficient data.

ONLY output the bulleted list with NO additional commentary.`;

    const topicsResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: topicsPrompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!topicsResponse.ok) {
      console.error(`❌ Topics API error: ${topicsResponse.status}`);
      return NextResponse.json({
        error: 'Failed to identify trending topics',
        district: districtCode,
      }, { status: 502 });
    }

    const topicsData = await topicsResponse.json();
    const topicsText = topicsData.choices?.[0]?.message?.content?.trim();

    // Parse search terms
    const searchTerms: string[] = [];
    if (topicsText) {
      const lines = topicsText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
          const term = trimmed.substring(1).trim();
          if (term && term.length > 0) {
            searchTerms.push(term);
          }
        }
      }
    }

    console.log(`📋 Extracted ${searchTerms.length} search terms:`, searchTerms);

    if (searchTerms.length === 0) {
      // Fallback to generic district search
      searchTerms.push(districtLabel, stateName + ' politics');
    }

    // Step 2: Check cached tweets first to save API calls
    const now = new Date();
    const allTweetsWithMetrics: TweetWithMetrics[] = [];
    const seenTweetIds = new Set<string>();

    // Check if we have enough cached tweets (at least 30)
    const cachedTweetCount = await getCachedTweetCount(districtCode, 6);
    let usedCache = false;

    if (cachedTweetCount >= 30) {
      console.log(`📦 Using ${cachedTweetCount} cached tweets for ${districtCode}`);
      const cachedTweets = await getCachedTweets(searchTerms, districtCode, 6);

      for (const cached of cachedTweets) {
        if (seenTweetIds.has(cached.id)) continue;
        seenTweetIds.add(cached.id);

        const createdAt = cached.created_at ? new Date(cached.created_at) : now;
        const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        allTweetsWithMetrics.push({
          ...cached,
          age_days: ageDays,
        });
      }

      usedCache = true;
      console.log(`📊 Loaded ${allTweetsWithMetrics.length} tweets from cache`);
    }

    // Only fetch from Twitter if cache insufficient
    if (!usedCache || allTweetsWithMetrics.length < 30) {
      console.log(`🐦 Fetching fresh tweets from Twitter API`);

      // Use Bearer Token if available (more efficient, no OAuth handshake)
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      let appOnlyClient: TwitterApi;

      if (bearerToken) {
        appOnlyClient = new TwitterApi(bearerToken);
      } else {
        const client = new TwitterApi({
          appKey: twitterKey,
          appSecret: twitterSecret,
        });
        appOnlyClient = await client.appLogin();
      }

      // OPTIMIZED: Combine search terms into a single query with OR operators
      const topTerms = searchTerms.slice(0, 5);
      const combinedQuery = `(${topTerms.join(' OR ')}) -is:retweet -is:reply lang:en`;
      console.log(`🐦 Combined Twitter search: "${combinedQuery}"`);

      try {
        const result = await appOnlyClient.v2.search(combinedQuery, {
          max_results: 100,
          'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
          'user.fields': ['location', 'description'],
          expansions: ['author_id'],
        });

        const newTweets: CachedTweet[] = [];

        if (result.data.data && result.data.data.length > 0) {
          // Map user data
          const users = new Map<string, UserData>();
          if (result.data.includes?.users) {
            for (const user of result.data.includes.users) {
              users.set(user.id, {
                id: user.id,
                name: user.name || 'Unknown',
                username: user.username || 'unknown',
                location: user.location,
                description: user.description,
              });
            }
          }

          // Process tweets
          for (const tweet of result.data.data) {
            if (seenTweetIds.has(tweet.id)) continue;
            seenTweetIds.add(tweet.id);

            const user = users.get(tweet.author_id || '');
            const username = user?.username || 'unknown';

            const createdAt = tweet.created_at ? new Date(tweet.created_at) : now;
            const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

            const metrics = tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0 };
            const engagementScore =
              (metrics.like_count || 0) +
              (metrics.retweet_count || 0) * 2 +
              (metrics.reply_count || 0);

            const tweetData: TweetWithMetrics = {
              id: tweet.id,
              text: tweet.text || '',
              author: user?.name || 'Unknown',
              username: username,
              url: `https://twitter.com/${username}/status/${tweet.id}`,
              created_at: tweet.created_at || '',
              user_location: user?.location,
              user_bio: user?.description,
              engagement_score: engagementScore,
              age_days: ageDays,
            };

            allTweetsWithMetrics.push(tweetData);
            newTweets.push({
              ...tweetData,
              search_terms: topTerms,
              fetched_at: now.toISOString(),
            });
          }

          console.log(`✅ Found ${result.data.data.length} tweets from Twitter API`);

          // Cache the new tweets for future use
          if (newTweets.length > 0) {
            await cacheTweets(newTweets, combinedQuery, districtCode);
          }
        } else {
          console.log(`⚠️ No tweets found from Twitter API`);
        }
      } catch (error) {
        console.error(`❌ Error in Twitter search:`, error);
      }
    }

    console.log(`📊 Total tweets collected: ${allTweetsWithMetrics.length}`);

    // Fallback: if insufficient data and we didn't use cached data, try state-level search
    // Skip this if we used cache (to save API calls)
    if (allTweetsWithMetrics.length < 20 && !usedCache) {
      console.log(`⚠️ Only ${allTweetsWithMetrics.length} tweets found, adding fallback search`);

      // Initialize Twitter client for fallback
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      let fallbackClient: TwitterApi;

      if (bearerToken) {
        fallbackClient = new TwitterApi(bearerToken);
      } else {
        const client = new TwitterApi({
          appKey: twitterKey,
          appSecret: twitterSecret,
        });
        fallbackClient = await client.appLogin();
      }

      const fallbackTerms = [`${stateName} politics`];

      for (const searchTerm of fallbackTerms) {
        console.log(`🐦 Fallback search for: "${searchTerm}"`);
        const searchQuery = `${searchTerm} -is:retweet -is:reply lang:en`;

        try {
          const result = await fallbackClient.v2.search(searchQuery, {
            max_results: 100,
            'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
            'user.fields': ['location', 'description'],
            expansions: ['author_id'],
          });

          if (result.data.data && result.data.data.length > 0) {
            const users = new Map<string, UserData>();
            if (result.data.includes?.users) {
              for (const user of result.data.includes.users) {
                users.set(user.id, {
                  id: user.id,
                  name: user.name || 'Unknown',
                  username: user.username || 'unknown',
                  location: user.location,
                  description: user.description,
                });
              }
            }

            const fallbackTweets: CachedTweet[] = [];

            for (const tweet of result.data.data) {
              if (seenTweetIds.has(tweet.id)) continue;
              seenTweetIds.add(tweet.id);

              const user = users.get(tweet.author_id || '');
              const username = user?.username || 'unknown';
              const createdAt = tweet.created_at ? new Date(tweet.created_at) : now;
              const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
              const metrics = tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0 };
              const engagementScore = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 2 + (metrics.reply_count || 0);

              const tweetData: TweetWithMetrics = {
                id: tweet.id,
                text: tweet.text || '',
                author: user?.name || 'Unknown',
                username: username,
                url: `https://twitter.com/${username}/status/${tweet.id}`,
                created_at: tweet.created_at || '',
                user_location: user?.location,
                user_bio: user?.description,
                engagement_score: engagementScore,
                age_days: ageDays,
              };

              allTweetsWithMetrics.push(tweetData);
              fallbackTweets.push({
                ...tweetData,
                search_terms: [searchTerm],
                fetched_at: now.toISOString(),
              });
            }

            // Cache fallback tweets too
            if (fallbackTweets.length > 0) {
              await cacheTweets(fallbackTweets, searchQuery, districtCode);
            }

            console.log(`✅ Fallback found ${result.data.data.length} tweets for "${searchTerm}"`);
          }
        } catch (error) {
          console.error(`❌ Fallback search error for "${searchTerm}":`, error);
        }
      }
      console.log(`📊 Total tweets after fallback: ${allTweetsWithMetrics.length}`);
    }

    // Filter to recent tweets (within 14 days, expanded from 7)
    let filteredTweets = allTweetsWithMetrics.filter(t => t.age_days <= 14);

    // Fallback: if insufficient data, expand to 30 days
    if (filteredTweets.length < 30) {
      console.log(`⚠️ Only ${filteredTweets.length} tweets in 14 days, expanding to 30 days`);
      filteredTweets = allTweetsWithMetrics.filter(t => t.age_days <= 30);
    }

    // Sort by engagement and take top tweets for analysis
    filteredTweets.sort((a, b) => b.engagement_score - a.engagement_score);
    const tweetsToAnalyze = filteredTweets.slice(0, 50); // Analyze top 50 tweets (up from 20)

    console.log(`🔬 Analyzing ${tweetsToAnalyze.length} tweets with AI`);

    // Step 3: Classify tweets using LLM
    // Remove metrics fields for classification
    const tweetsForClassification: Tweet[] = tweetsToAnalyze.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ engagement_score, age_days, ...tweet }) => tweet
    );

    const classifications = await classifyTweets(
      tweetsForClassification,
      districtCode,
      districtName,
      openrouterKey
    );

    console.log(`✅ Classified ${classifications.length} tweets`);

    // Step 4: Fetch traditional polling data to blend with AI estimates
    let traditionalPollingTrend: string | null = null;
    try {
      const pollingUrl = new URL('/api/district/polling', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000');
      pollingUrl.searchParams.set('district', districtCode);
      const pollingResponse = await fetch(pollingUrl.toString(), {
        headers: { 'x-use-cache': 'true' },
        signal: AbortSignal.timeout(10000),
      });
      if (pollingResponse.ok) {
        const pollingData = await pollingResponse.json();
        traditionalPollingTrend = pollingData.trend;
        console.log(`📊 Traditional polling: ${traditionalPollingTrend}`);
      }
    } catch (error) {
      console.log('⚠️ Could not fetch traditional polling, using AI-only estimate');
    }

    // Step 5: Aggregate into district-level intelligence (blending with traditional polling)
    const aiIntel = aggregateClassifications(classifications, districtCode, districtName, traditionalPollingTrend);

    console.log(`🎯 Generated AI intel: ${aiIntel.polling.estimate} (${aiIntel.election_outlook.rating})${traditionalPollingTrend ? ` [blended with ${traditionalPollingTrend}]` : ''}`);

    // Cache in both memory and database (always write, even if cache reading was disabled)
    // Use user-specified duration or default to 6 hours for AI intel
    const finalCacheDuration = Math.max(cacheDurationSeconds, 6 * 60 * 60); // Minimum 6h for expensive AI intel
    serverCache.set(memoryCacheKey, aiIntel, finalCacheDuration);
    await setInDbCache(dbCacheKey, 'ai-intel', districtCode, aiIntel, finalCacheDuration);

    return NextResponse.json(aiIntel);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error in AI intel API:', err.message || error);
    return NextResponse.json({
      error: 'Failed to generate AI intelligence',
      details: err.message,
    }, { status: 500 });
  }
}
