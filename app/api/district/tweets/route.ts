import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

interface UserData {
  id: string;
  name: string;
  username: string;
  location?: string;
  description?: string;
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at: string;
  user_location?: string;
  user_bio?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
}

interface TweetWithMetrics extends Tweet {
  engagement_score: number;
  age_days: number;
}

/**
 * GET /api/district/tweets?district=VA10
 * Uses Claude Sonnet 4.5 to identify trending topics in a district,
 * then searches Twitter for high-engagement tweets about those topics
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
    const districtLabel = `${stateCode}-${parseInt(districtNum)}`;

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('district-tweets', { district: districtCode });
    const cached = serverCache.get<{ tweets: Tweet[] }>(cacheKey, useCache);

    if (cached) {
      console.log(`📦 Using cached tweets for ${districtLabel}`);
      return NextResponse.json(cached);
    }

    console.log(`🔍 Finding trending topics for district ${districtLabel}`);

    // Step 1: Call Claude Sonnet 4.5 via OpenRouter to get trending topics
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      console.error('❌ OPENROUTER_API_KEY not found');
      return NextResponse.json({ tweets: [] });
    }

    const stateNames: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };

    const stateName = stateNames[stateCode] || stateCode;
    const districtName = `${stateName}'s ${parseInt(districtNum)} Congressional District (${districtLabel})`;

    const claudePrompt = `Generate 5 Twitter search terms to find political tweets relevant to ${districtName} in ${stateName}.

Use a MIX of regional and state terms that will actually return results:
- 2 terms with REGIONAL geography (counties, major cities in the district) + politics
- 2 terms with state governor or major state politicians
- 1 term with the current US Representative's name (if known)

Good examples for Long Island NY districts:
- "Long Island politics"
- "Suffolk County news"
- "Hochul Long Island"
- "New York governor economy"

Good examples for California districts:
- "Bay Area politics" or "Orange County politics"
- "Newsom California"
- "California congress"

Output ONLY a bulleted list of 5 search terms. NO explanations.`;

    const claudeResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [
          {
            role: 'user',
            content: claudePrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!claudeResponse.ok) {
      console.error(`❌ Claude API error: ${claudeResponse.status}`);
      return NextResponse.json({ tweets: [] });
    }

    const claudeData = await claudeResponse.json();
    const claudeText = claudeData.choices?.[0]?.message?.content?.trim();

    if (!claudeText) {
      console.error('❌ No response from Claude');
      return NextResponse.json({ tweets: [] });
    }

    console.log(`🤖 Claude response:\n${claudeText}`);

    // Parse search terms from Claude's response
    const searchTerms: string[] = [];
    const lines = claudeText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        const term = trimmed.substring(1).trim();
        if (term && term.length > 0) {
          searchTerms.push(term);
        }
      }
    }

    console.log(`📋 Extracted ${searchTerms.length} search terms:`, searchTerms);

    if (searchTerms.length === 0) {
      console.error('❌ No search terms extracted from Claude response');
      return NextResponse.json({ tweets: [] });
    }

    // Step 2: Search Twitter for each topic
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ Twitter API credentials not found');
      return NextResponse.json({ tweets: [] });
    }

    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    const appOnlyClient = await client.appLogin();

    // Calculate date cutoffs
    const now = new Date();

    // Collect all tweets from all topics
    const allTweetsWithMetrics: TweetWithMetrics[] = [];
    const seenTweetIds = new Set<string>();

    // Reduced from 5 to 3 to save API calls
    for (const searchTerm of searchTerms.slice(0, 3)) {
      console.log(`🐦 Searching Twitter for: "${searchTerm}"`);

      const searchQuery = `${searchTerm} -is:retweet -is:reply lang:en`;

      try {
        const result = await appOnlyClient.v2.search(searchQuery, {
          max_results: 20,
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
          // Skip duplicates
          if (seenTweetIds.has(tweet.id)) {
            continue;
          }
          seenTweetIds.add(tweet.id);

          const user = users.get(tweet.author_id || '');
          const username = user?.username || 'unknown';

          // Calculate age in days
          const createdAt = tweet.created_at ? new Date(tweet.created_at) : now;
          const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

          // Calculate engagement score
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
            likes: metrics.like_count || 0,
            retweets: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
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

    // Step 3: Filter by date and sort by engagement
    // First try 5 days
    let filteredTweets = allTweetsWithMetrics.filter(t => t.age_days <= 5);

    // If we have less than 4 tweets, expand to 7 days
    if (filteredTweets.length < 4) {
      console.log(`⚠️  Only ${filteredTweets.length} tweets within 5 days, expanding to 7 days`);
      filteredTweets = allTweetsWithMetrics.filter(t => t.age_days <= 7);
    }

    // Sort by engagement score (highest first)
    filteredTweets.sort((a, b) => b.engagement_score - a.engagement_score);

    // Take top 4
    const topTweets = filteredTweets.slice(0, 4);

    console.log(`✅ Returning ${topTweets.length} top tweets for ${districtLabel}`);

    // Remove internal metrics from final output but keep likes/retweets/replies
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tweets: Tweet[] = topTweets.map(({ engagement_score, age_days, ...tweet }) => tweet);

    const response = { tweets };

    // Save to cache
    serverCache.set(cacheKey, response);

    return NextResponse.json(response);

  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('❌ Error in district tweets API:', err.message || error);
    return NextResponse.json({ tweets: [] });
  }
}
