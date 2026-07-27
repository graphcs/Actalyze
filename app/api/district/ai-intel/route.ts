import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { chatCompletions } from "@/lib/ai-provider";
import { searchTweetsViaSerpApi } from "@/lib/serpapi-tweets";
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
 * Per-request stage timer.
 *
 * The cold path for this route was ~45s and nobody knew which stage owned it.
 * Every stage is wrapped in `time()` so the breakdown lands in the server log
 * and in the `x-stage-timings` response header, where a load test can read it
 * without scraping stdout.
 */
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

  function summary() {
    return { ...stages, total: Date.now() - started };
  }

  return { time, summary };
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Search terms for a district, derived from the district code alone.
 *
 * These used to come from a gpt-4o call asking for "local politicians, district
 * issues, local controversies". On this deployment `chatCompletions({webSearch:true})`
 * resolves to plain OpenAI, which has no web access, so that call was inventing
 * plausible-sounding names from training data — and the terms were only ever fed
 * to SerpAPI as queries anyway. Deriving them from the district code costs 0ms
 * instead of ~1.1s, removes a fabrication surface, and makes the queries stable,
 * so SerpAPI's 1h fetch cache can actually hit and save quota.
 *
 * `primary` is queried first. `widen` is queried only when `primary` did not
 * return enough distinct posts — each SerpAPI query spends one search from a
 * shared monthly quota, so the fan-out is kept deliberately small.
 */
function buildDistrictSearchTerms(
  stateName: string,
  districtLabel: string,
  districtNumber: number
): { primary: string[]; widen: string[] } {
  const seat =
    districtNumber === 0
      ? `${stateName} at-large congressional district`
      : `${stateName}'s ${ordinal(districtNumber)} congressional district`;

  return {
    primary: [
      seat,
      `${stateName} politics`,
      `${stateName} governor race`,
      `${stateName} congress election`,
    ],
    widen: [`${districtLabel} election`],
  };
}

/**
 * Fetch the traditional polling baseline. Never rejects — a missing baseline
 * just means the AI estimate stands on its own.
 */
async function fetchTraditionalPolling(districtCode: string): Promise<string | null> {
  try {
    const pollingUrl = new URL(
      '/api/district/polling',
      process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    );
    pollingUrl.searchParams.set('district', districtCode);
    const pollingResponse = await fetch(pollingUrl.toString(), {
      headers: { 'x-use-cache': 'true' },
      signal: AbortSignal.timeout(10000),
    });
    if (!pollingResponse.ok) return null;
    const pollingData = await pollingResponse.json();
    return pollingData.trend ?? null;
  } catch {
    console.log('⚠️ Could not fetch traditional polling, using AI-only estimate');
    return null;
  }
}

/**
 * How many retrieved posts get sent to the classifier.
 *
 * Classification was the route's single biggest stage (29.5s for 50 posts), but
 * the cost was the *sequencing*, not the volume: batches of 5 ran one after the
 * other. With a concurrency-20 worker pool the same 40 posts finish in ~4s, and
 * classification is no longer on the critical path at all.
 *
 * Cutting this to 20-25 was tried and reverted. Only ~25% of classified posts
 * clear the `location_confidence >= 0.3` filter, and `calculatePollingEstimate`
 * needs MIN_PARTISAN_POSTS (6) survivors before it will report a margin — so a
 * 25-post cap pushed `ai_only_estimate` to "Unknown" on thin districts, i.e. the
 * AI signal stopped contributing at all. Since the guards must not be weakened,
 * the input has to stay large enough to satisfy them.
 */
const MAX_POSTS_TO_CLASSIFY = 40;

/**
 * GET /api/district/ai-intel?district=VA10
 * Returns AI-powered political intelligence for a congressional district
 * Based on concepts from "Artificially Intelligent Opinion Polling" (Cerina & Duch, 2023)
 */
export async function GET(request: NextRequest) {
  const timer = createTimer();
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

    // Check cache headers - default to 24 hours (86400 seconds)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);

    // Generate cache keys
    const memoryCacheKey = generateCacheKey('district-ai-intel', { district: districtCode });
    const dbCacheKey = generateDistrictCacheKey('ai-intel', districtCode);

    // Try database cache first (persists across restarts)
    const dbCached = await timer.time('db_cache_read', () =>
      getFromDbCache<AIIntelResponse>(dbCacheKey, useCache)
    );
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

    // Check for required API keys. Only classification needs a chat provider
    // now; search terms are derived from the district code.
    const ai = chatCompletions();
    const twitterKey = process.env.TWITTER_API_KEY;
    const twitterSecret = process.env.TWITTER_API_SECRET;

    if (!ai) {
      console.error('❌ No LLM provider configured (OPENAI_API_KEY / OPENROUTER_API_KEY)');
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

    // The traditional polling baseline depends on nothing else this route does,
    // but it used to be awaited after classification had finished — ~7s of dead
    // time on the critical path. Start it now and collect it at the end.
    const traditionalPollingPromise = timer.time('traditional_polling_fetch', () =>
      fetchTraditionalPolling(districtCode)
    );

    // Step 1: Derive search terms from the district code (no LLM round trip).
    const { primary: primaryTerms, widen: widenTerms } = buildDistrictSearchTerms(
      stateName,
      districtLabel,
      parseInt(districtNum)
    );
    const searchTerms = [...primaryTerms, ...widenTerms];

    console.log(`📋 Search terms for ${districtLabel}:`, searchTerms);

    // Step 2: Check cached tweets first to save API calls
    const now = new Date();
    const allTweetsWithMetrics: TweetWithMetrics[] = [];
    const seenTweetIds = new Set<string>();

    // Check if we have enough cached tweets (at least 30)
    const cachedTweetCount = await timer.time('tweet_cache_count', () =>
      getCachedTweetCount(districtCode, 6)
    );
    let usedCache = false;

    if (cachedTweetCount >= 30) {
      console.log(`📦 Using ${cachedTweetCount} cached tweets for ${districtCode}`);
      const cachedTweets = await timer.time('tweet_cache_read', () =>
        getCachedTweets(searchTerms, districtCode, 6)
      );

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
        const result = await timer.time('twitter_search', () =>
          appOnlyClient.v2.search(combinedQuery, {
            max_results: 100,
            'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
            'user.fields': ['location', 'description'],
            expansions: ['author_id'],
          })
        );

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

    // X's free API tier forbids /2/tweets/search/recent, so on this deployment both
    // attempts above return 403 and every downstream card renders empty. Recover
    // genuine posts through SerpAPI instead - real handles, ids, text and links.
    if (allTweetsWithMetrics.length < 20) {
      console.log(`🔎 Recovering posts via SerpAPI for ${districtLabel}`);

      // Every query here spends one search from a shared, finite monthly SerpAPI
      // quota, so the fan-out is deliberately small. It used to be 9 near-duplicate
      // terms fired unconditionally; it is now 3 terms, widened to 5 only when the
      // first wave did not find enough distinct posts.
      //
      // POSTS_PER_TERM is raised from 8 to 20 for free: searchTweetsViaSerpApi
      // already asks Google for 40 results per query and then truncates to `limit`,
      // so a higher limit extracts more posts from the SAME search rather than
      // buying another one. That is what lets 3 terms replace 9 without losing
      // sample size.
      const POSTS_PER_TERM = 20;
      const ENOUGH_POSTS = 20;

      const fresh: CachedTweet[] = [];
      const termsQueried: string[] = [];

      const absorb = (batch: Awaited<ReturnType<typeof searchTweetsViaSerpApi>>, term: string) => {
        for (const t of batch) {
          if (seenTweetIds.has(t.id)) continue;
          seenTweetIds.add(t.id);

          const createdAt = t.created_at ? new Date(t.created_at) : now;
          const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const engagement = (t.likes ?? 0) + (t.retweets ?? 0) * 2 + (t.replies ?? 0);

          const cacheable: CachedTweet = {
            id: t.id,
            text: t.text,
            author: t.author,
            username: t.username,
            url: t.url,
            created_at: t.created_at ?? now.toISOString(),
            engagement_score: engagement,
            search_terms: [term],
            fetched_at: now.toISOString(),
          };

          fresh.push(cacheable);
          allTweetsWithMetrics.push({ ...cacheable, age_days: ageDays });
        }
      };

      const runWave = async (terms: string[]) => {
        const batches = await Promise.all(
          terms.map((term) => searchTweetsViaSerpApi(term, POSTS_PER_TERM).catch(() => []))
        );
        batches.forEach((batch, i) => absorb(batch, terms[i]));
        termsQueried.push(...terms);
      };

      await timer.time('serpapi_recovery', async () => {
        await runWave(primaryTerms);
        // Only pay for the broader terms when the district-specific ones came up short.
        if (allTweetsWithMetrics.length < ENOUGH_POSTS) {
          console.log(
            `🔎 Only ${allTweetsWithMetrics.length} posts from ${primaryTerms.length} terms, widening`
          );
          await runWave(widenTerms);
        }
      });

      if (fresh.length > 0) {
        await timer.time('tweet_cache_write', () =>
          cacheTweets(fresh, termsQueried.join(' | '), districtCode)
        );
      }
      console.log(
        `🔎 SerpAPI recovery: ${termsQueried.length} searches spent, added ${fresh.length} posts (total ${allTweetsWithMetrics.length})`
      );
    }

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
          const result = await timer.time('twitter_fallback_search', () =>
            fallbackClient.v2.search(searchQuery, {
              max_results: 100,
              'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
              'user.fields': ['location', 'description'],
              expansions: ['author_id'],
            })
          );

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
    const tweetsToAnalyze = filteredTweets.slice(0, MAX_POSTS_TO_CLASSIFY);

    console.log(`🔬 Analyzing ${tweetsToAnalyze.length} tweets with AI`);

    // Step 3: Classify tweets using LLM
    // Remove metrics fields for classification
    const tweetsForClassification: Tweet[] = tweetsToAnalyze.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ engagement_score, age_days, ...tweet }) => tweet
    );

    const classifications = await timer.time('classify_tweets', () =>
      classifyTweets(
        tweetsForClassification,
        districtCode,
        districtName,
        // classifyTweets resolves its own provider now; kept for signature compat.
        ''
      )
    );

    console.log(`✅ Classified ${classifications.length} tweets`);

    // Step 4: Collect the traditional polling baseline started before retrieval.
    // By now it has almost always already resolved, so this await is free.
    const traditionalPollingTrend = await traditionalPollingPromise;
    console.log(`📊 Traditional polling: ${traditionalPollingTrend}`);

    // Step 5: Aggregate into district-level intelligence (blending with traditional polling)
    const aiIntel = aggregateClassifications(classifications, districtCode, districtName, traditionalPollingTrend);

    console.log(`🎯 Generated AI intel: ${aiIntel.polling.estimate} (${aiIntel.election_outlook.rating})${traditionalPollingTrend ? ` [blended with ${traditionalPollingTrend}]` : ''}`);

    // Cache in both memory and database (always write, even if cache reading was disabled)
    // Use user-specified duration or default to 6 hours for AI intel
    const finalCacheDuration = Math.max(cacheDurationSeconds, 6 * 60 * 60); // Minimum 6h for expensive AI intel
    serverCache.set(memoryCacheKey, aiIntel, finalCacheDuration);
    await timer.time('db_cache_write', () =>
      setInDbCache(dbCacheKey, 'ai-intel', districtCode, aiIntel, finalCacheDuration)
    );

    const timings = timer.summary();
    console.log(`⏱️ ai-intel ${districtLabel} stage timings:`, JSON.stringify(timings));

    return NextResponse.json(aiIntel, {
      headers: { 'x-stage-timings': JSON.stringify(timings) },
    });

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error in AI intel API:', err.message || error);
    return NextResponse.json({
      error: 'Failed to generate AI intelligence',
      details: err.message,
    }, { status: 500 });
  }
}
