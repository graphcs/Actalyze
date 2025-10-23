import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

// Cache trending topics for 2 hours to reduce API calls
let cachedTrending: TrendingTopic[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

interface TrendingTopic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
  tweetIds?: string[];
}

export async function GET() {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedTrending && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log("Returning cached trending topics");
      return NextResponse.json(cachedTrending);
    }

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log("❌ No Twitter API credentials found, returning mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    console.log("✓ Twitter API credentials found, attempting to fetch live data...");

    // Initialize Twitter client with API key and secret
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    // Get app-only authentication
    const appOnlyClient = await client.appLogin();
    const readOnlyClient = appOnlyClient.readOnly;

    // Search for political/legislative keywords (reduced to avoid rate limits)
    const keywords = [
      "infrastructure bill",
      "healthcare reform",
      "farm bill",
      "defense appropriations"
    ];

    const trendingTopics: TrendingTopic[] = [];

    // Fetch tweets for each keyword and calculate momentum
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      try {
        // Add small delay between requests to avoid rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

        const recentTweets = await readOnlyClient.v2.search(`${keyword} -is:retweet lang:en`, {
          max_results: 10,
          'tweet.fields': ['created_at', 'public_metrics'],
        });

        if (recentTweets.data && recentTweets.data.data && recentTweets.data.data.length > 0) {
          const tweets = recentTweets.data.data;

          // Calculate total mentions and engagement
          const totalEngagement = tweets.reduce((sum, tweet: { public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } }) => {
            const metrics = tweet.public_metrics || {};
            return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
          }, 0);

          // Calculate momentum (simplified: based on recent engagement)
          const momentum = Math.min(Math.round((totalEngagement / tweets.length) / 10), 100);

          // Extract tags from keyword
          const tags = keyword.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          );

          trendingTopics.push({
            id: keyword.replace(/\s+/g, '-').toLowerCase(),
            title: keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            tags: tags.slice(0, 3),
            mentions: tweets.length * 1000 + Math.floor(Math.random() * 10000), // Estimated
            momentum,
            cost: Math.floor(Math.random() * 1000) + 50, // Mock cost data
            color: getColorForTopic(keyword),
            tweetIds: tweets.slice(0, 5).map((t: { id: string }) => t.id),
          });
        }
      } catch (error: unknown) {
        const err = error as { code?: number };
        if (err.code === 429) {
          console.error(`❌ Rate limit hit for "${keyword}" - stopping searches`);
          break; // Stop searching if we hit rate limit
        }
        console.error(`❌ Error fetching tweets for "${keyword}":`, error);
      }
    }

    console.log(`✓ Fetched ${trendingTopics.length} trending topics from Twitter`);

    // Sort by momentum
    trendingTopics.sort((a, b) => b.momentum - a.momentum);

    // Take top 4
    const result = trendingTopics.slice(0, 4);

    // If we got at least 2 results, cache and return them
    if (result.length >= 2) {
      console.log("✓ Caching live trending topics");
      cachedTrending = result;
      cacheTimestamp = now;
      return NextResponse.json(result);
    }

    // Fallback to mock data if API fails
    console.log("⚠️ No topics found from Twitter API, returning mock data");
    return NextResponse.json(getMockTrendingTopics());

  } catch (error) {
    console.error("❌ Error fetching trending topics:", error);
    console.log("⚠️ Falling back to mock data due to error");
    return NextResponse.json(getMockTrendingTopics());
  }
}

function getColorForTopic(keyword: string): string {
  const colorMap: { [key: string]: string } = {
    infrastructure: "#111827",
    healthcare: "#0ea5e9",
    farm: "#16a34a",
    defense: "#ef4444",
    climate: "#10b981",
    education: "#f59e0b",
    immigration: "#8b5cf6",
    tax: "#ec4899",
  };

  for (const [key, color] of Object.entries(colorMap)) {
    if (keyword.toLowerCase().includes(key)) {
      return color;
    }
  }
  return "#64748b";
}

function getMockTrendingTopics(): TrendingTopic[] {
  return [
    {
      id: "ijia",
      title: "Infrastructure & Jobs Act",
      tags: ["Infrastructure", "Energy", "Transportation"],
      mentions: 42000,
      momentum: 78,
      cost: 1100,
      color: "#111827",
    },
    {
      id: "aca",
      title: "Affordable Care Act",
      tags: ["Healthcare", "Subsidies"],
      mentions: 37000,
      momentum: 69,
      cost: 210,
      color: "#0ea5e9",
    },
    {
      id: "farmbill",
      title: "Farm Bill",
      tags: ["Agriculture", "Food", "Rural"],
      mentions: 19500,
      momentum: 61,
      cost: 95,
      color: "#16a34a",
    },
    {
      id: "defense",
      title: "Defense Appropriations",
      tags: ["Defense", "Security"],
      mentions: 26500,
      momentum: 72,
      cost: 840,
      color: "#ef4444",
    },
  ];
}
