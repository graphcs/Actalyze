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
      console.log("✓ Returning cached trending topics (cached for 2 hours)");
      return NextResponse.json(cachedTrending);
    }

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log("❌ No Twitter API credentials found, returning mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    console.log("✓ Twitter API credentials found, fetching live trending topics...");

    // Initialize Twitter client with API key and secret
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    // Get app-only authentication
    const appOnlyClient = await client.appLogin();
    const readOnlyClient = appOnlyClient.readOnly;

    // Get trending legislative/political topics from Twitter with a single search
    console.log("🔍 Searching for trending legislative topics...");

    const legislativeSearch = await readOnlyClient.v2.search(
      '(Congress OR bill OR legislation OR Senate OR House OR legislative) -is:retweet lang:en',
      {
        max_results: 100,
        'tweet.fields': ['created_at', 'public_metrics'],
        sort_order: 'relevancy',
      }
    );

    if (!legislativeSearch.data.data || legislativeSearch.data.data.length === 0) {
      console.log("⚠️ No legislative tweets found, returning fallback data");
      return NextResponse.json(getMockTrendingTopics());
    }

    console.log(`✓ Found ${legislativeSearch.data.data.length} legislative tweets`);

    // Extract topics/keywords from tweets using pattern matching
    const topicFrequency: { [key: string]: {
      count: number;
      engagement: number;
      tweets: Array<{ id: string; public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } }>;
    } } = {};

    legislativeSearch.data.data.forEach((tweet: { text: string; id: string; public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } }) => {
      const engagement = (tweet.public_metrics?.like_count || 0) +
                        (tweet.public_metrics?.retweet_count || 0) +
                        (tweet.public_metrics?.reply_count || 0);

      // Define bill/legislative patterns to extract
      const patterns = [
        { regex: /infrastructure\s+(bill|act|law)/i, name: "Infrastructure Bill" },
        { regex: /healthcare\s+(reform|bill|act)/i, name: "Healthcare Reform" },
        { regex: /farm\s+bill/i, name: "Farm Bill" },
        { regex: /defense\s+(appropriations|budget|spending|bill)/i, name: "Defense Appropriations" },
        { regex: /climate\s+(bill|legislation|act|action)/i, name: "Climate Legislation" },
        { regex: /education\s+(funding|bill|reform)/i, name: "Education Funding" },
        { regex: /immigration\s+reform/i, name: "Immigration Reform" },
        { regex: /tax\s+(reform|bill|cut)/i, name: "Tax Reform" },
        { regex: /budget\s+(bill|resolution)/i, name: "Budget Bill" },
        { regex: /energy\s+bill/i, name: "Energy Bill" },
        { regex: /veterans\s+(affairs|benefits)/i, name: "Veterans Affairs" },
        { regex: /social\s+security/i, name: "Social Security" },
        { regex: /voting\s+(rights|reform)/i, name: "Voting Rights" },
        { regex: /student\s+(loan|debt)/i, name: "Student Loans" },
      ];

      patterns.forEach(({ regex, name }) => {
        if (regex.test(tweet.text)) {
          if (!topicFrequency[name]) {
            topicFrequency[name] = { count: 0, engagement: 0, tweets: [] };
          }
          topicFrequency[name].count++;
          topicFrequency[name].engagement += engagement;
          if (topicFrequency[name].tweets.length < 10) {
            topicFrequency[name].tweets.push(tweet);
          }
        }
      });
    });

    // Sort topics by combined score (count × engagement)
    const sortedTopics = Object.entries(topicFrequency)
      .filter(([_, data]) => data.count >= 2) // Only topics mentioned at least twice
      .sort((a, b) => {
        const scoreA = a[1].count * (a[1].engagement + 1);
        const scoreB = b[1].count * (b[1].engagement + 1);
        return scoreB - scoreA;
      })
      .slice(0, 6); // Get top 6

    console.log(`✓ Found ${sortedTopics.length} trending legislative topics`);

    if (sortedTopics.length === 0) {
      console.log("⚠️ No topics extracted, returning fallback data");
      return NextResponse.json(getMockTrendingTopics());
    }

    const trendingTopics: TrendingTopic[] = [];

    // Create topic objects from trending keywords
    for (const [topicName, data] of sortedTopics) {
      const avgEngagement = data.engagement / data.count;
      const momentum = Math.min(Math.round(avgEngagement / 10), 100);

      // Extract tags from topic name
      const tags = topicName.split(' ').filter(word => word.length > 3);

      trendingTopics.push({
        id: topicName.toLowerCase().replace(/\s+/g, '-'),
        title: topicName,
        tags: tags.slice(0, 3),
        mentions: data.count * 1000 + Math.floor(Math.random() * 5000), // Estimated
        momentum: Math.max(momentum, 45), // Ensure minimum momentum
        cost: Math.floor(Math.random() * 1000) + 50, // Mock cost data (requires CBO)
        color: getColorForTopic(topicName.toLowerCase()),
        tweetIds: data.tweets.slice(0, 5).map(t => t.id),
      });
    }

    console.log(`✓ Created ${trendingTopics.length} trending topic objects`);
    console.log("✓ Caching for 2 hours");

    // Cache the results
    cachedTrending = trendingTopics;
    cacheTimestamp = now;

    return NextResponse.json(trendingTopics);

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
    budget: "#6366f1",
    energy: "#14b8a6",
    veterans: "#f43f5e",
    social: "#8b5cf6",
    voting: "#a855f7",
    student: "#f59e0b",
  };

  for (const [key, color] of Object.entries(colorMap)) {
    if (keyword.includes(key)) {
      return color;
    }
  }
  return "#64748b";
}

function getMockTrendingTopics(): TrendingTopic[] {
  return [
    {
      id: "infrastructure-bill",
      title: "Infrastructure Bill",
      tags: ["Infrastructure", "Transportation"],
      mentions: 42000,
      momentum: 78,
      cost: 1100,
      color: "#111827",
    },
    {
      id: "healthcare-reform",
      title: "Healthcare Reform",
      tags: ["Healthcare", "Reform"],
      mentions: 37000,
      momentum: 69,
      cost: 210,
      color: "#0ea5e9",
    },
    {
      id: "farm-bill",
      title: "Farm Bill",
      tags: ["Agriculture", "Farm"],
      mentions: 19500,
      momentum: 61,
      cost: 95,
      color: "#16a34a",
    },
    {
      id: "defense-appropriations",
      title: "Defense Appropriations",
      tags: ["Defense", "Appropriations"],
      mentions: 26500,
      momentum: 72,
      cost: 840,
      color: "#ef4444",
    },
  ];
}
