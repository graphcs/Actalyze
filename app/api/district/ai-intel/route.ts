import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
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

    // Check cache (AI intel is expensive, cache for 6 hours)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('district-ai-intel', { district: districtCode });
    const cached = serverCache.get<AIIntelResponse>(cacheKey, useCache);

    if (cached) {
      console.log(`📦 Using cached AI intel for ${districtLabel}`);
      return NextResponse.json(cached);
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

    const topicsPrompt = `You are a political research assistant with access to current news and web search. Research and identify the top 4-5 trending political topics, controversies, or local issues currently happening in ${districtName} (${districtLabel}) as of this week (November 2025).

Output ONLY a bulleted list of Twitter/X search terms in this exact format:
- [concise search term or hashtag]
- [concise search term or hashtag]
- [concise search term or hashtag]
- [concise search term or hashtag]
- [concise search term or hashtag]

Each search term should be SHORT (1-4 words), use keywords or hashtags that people would actually tweet about, and focus on district-specific issues, local politicians, controversies, or policy debates. Do NOT include generic phrases.

ONLY output the bulleted list of search terms with NO additional commentary.`;

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

    // Step 2: Search Twitter for tweets about these topics
    const client = new TwitterApi({
      appKey: twitterKey,
      appSecret: twitterSecret,
    });

    const appOnlyClient = await client.appLogin();
    const now = new Date();

    const allTweetsWithMetrics: TweetWithMetrics[] = [];
    const seenTweetIds = new Set<string>();

    for (const searchTerm of searchTerms.slice(0, 5)) {
      console.log(`🐦 Searching Twitter for: "${searchTerm}"`);

      const searchQuery = `${searchTerm} -is:retweet -is:reply lang:en`;

      try {
        const result = await appOnlyClient.v2.search(searchQuery, {
          max_results: 30, // Get more tweets for better analysis
          'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
          'user.fields': ['location', 'description'],
          expansions: ['author_id'],
        });

        if (!result.data.data || result.data.data.length === 0) {
          console.log(`⚠️  No tweets found for: "${searchTerm}"`);
          continue;
        }

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

          allTweetsWithMetrics.push({
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
          });
        }

        console.log(`✅ Found ${result.data.data.length} tweets for "${searchTerm}"`);
      } catch (error) {
        console.error(`❌ Error searching for "${searchTerm}":`, error);
        continue;
      }
    }

    console.log(`📊 Total tweets collected: ${allTweetsWithMetrics.length}`);

    // Filter to recent tweets (within 7 days)
    const filteredTweets = allTweetsWithMetrics.filter(t => t.age_days <= 7);

    // Sort by engagement and take top tweets for analysis
    filteredTweets.sort((a, b) => b.engagement_score - a.engagement_score);
    const tweetsToAnalyze = filteredTweets.slice(0, 20); // Analyze top 20 tweets

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

    // Step 4: Aggregate into district-level intelligence
    const aiIntel = aggregateClassifications(classifications, districtCode, districtName);

    console.log(`🎯 Generated AI intel: ${aiIntel.polling.estimate} (${aiIntel.election_outlook.rating})`);

    // Cache for 6 hours (expensive operation)
    serverCache.set(cacheKey, aiIntel, 6 * 60 * 60);

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
