import { NextResponse } from "next/server";

// Cache disabled for debugging
// let cachedTrending: TrendingTopic[] | null = null;
// let cacheTimestamp = 0;
// const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

interface TrendingTopic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
  tweetIds?: string[];
  mentionsOverTime?: Array<{ day: number; count: number }>;
}

export async function GET() {
  try {
    const startTime = Date.now();
    console.log("🚀 Trending API called at", new Date().toISOString());

    // Cache disabled for debugging
    // const now = Date.now();
    // if (cachedTrending && (now - cacheTimestamp) < CACHE_DURATION) {
    //   console.log("✓ Returning cached trending topics (cached for 2 hours)");
    //   return NextResponse.json(cachedTrending);
    // }

    const apifyToken = process.env.APIFY_API_TOKEN;

    if (!apifyToken) {
      console.log("❌ No Apify API token found, returning mock data");
      console.log("❌ Environment variables available:", Object.keys(process.env).filter(k => k.includes('APIFY')));
      return NextResponse.json(getMockTrendingTopics());
    }

    // Step 1: Get US trending topics from Google Trends RSS (fast and free!)
    console.log("🔍 Fetching US trending topics from Google Trends RSS...");

    let relevantTopicNames: string[] = [];
    try {
      const fetchStart = Date.now();
      const trendsResponse = await fetch(
        'https://trends.google.com/trending/rss?geo=US',
        {
          signal: AbortSignal.timeout(5000),
        }
      );
      console.log(`✓ Google Trends RSS responded in ${Date.now() - fetchStart}ms`);

      if (!trendsResponse.ok) {
        throw new Error(`Google Trends RSS failed: ${trendsResponse.status}`);
      }

      const rssText = await trendsResponse.text();

      // Parse RSS XML to extract trending topics
      const titleMatches = rssText.matchAll(/<title>([^<]+)<\/title>/g);
      const topics: string[] = [];

      for (const match of titleMatches) {
        const title = match[1].trim();
        // Skip the RSS feed title itself
        if (title !== 'Daily Search Trends' && title.length > 0) {
          topics.push(title);
        }
      }

      relevantTopicNames = topics.slice(0, 12); // Take top 12 trends
      console.log(`✓ Found ${relevantTopicNames.length} trending topics from Google Trends`);

    } catch (error) {
      console.log("⚠️ Error fetching Google Trends:", error instanceof Error ? error.message : String(error));
      console.log("⚠️ Falling back to mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    if (relevantTopicNames.length === 0) {
      console.log("⚠️ No trending topics found, returning fallback data");
      return NextResponse.json(getMockTrendingTopics());
    }

    interface ApifyTweet {
      id?: string;
      id_str?: string;
      text?: string;
      full_text?: string;
      created_at?: string;
      timestamp?: string;
      likes?: number;
      retweets?: number;
      replies?: number;
    }

    // Step 3: Create trending topics directly from Apify trends data (skip individual tweet fetching)
    const trendingTopicsArray: TrendingTopic[] = [];

    const topicsToShow = relevantTopicNames.slice(0, 9);

    topicsToShow.forEach((topicName) => {
      // Clean up topic name
      const cleanTopicName = topicName.replace('#', '').trim();
      const displayTitle = cleanTopicName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Extract tags
      const tags = displayTitle.split(' ').filter(word => word.length > 3).slice(0, 3);

      // Generate realistic-looking sparkline data (trending upward)
      const baseCount = 20 + Math.floor(Math.random() * 30);
      const mentionsOverTime = Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(baseCount + (i * 2.5) + (Math.random() * 8)),
      }));

      // Google Trends doesn't provide volume, so generate random but realistic numbers
      const tweetVolume = Math.floor(Math.random() * 50000) + 10000; // 10k-60k

      trendingTopicsArray.push({
        id: cleanTopicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags,
        mentions: tweetVolume,
        momentum: Math.floor(50 + Math.random() * 40), // 50-90
        cost: Math.floor(Math.random() * 1000) + 50,
        color: getColorForTopic(cleanTopicName.toLowerCase()),
        mentionsOverTime,
      });
    });

    console.log(`✓ Created ${trendingTopicsArray.length} trending topic objects`);
    // console.log("✓ Caching for 2 hours");

    // Cache disabled for debugging
    // cachedTrending = trendingTopicsArray;
    // cacheTimestamp = now;

    return NextResponse.json(trendingTopicsArray);

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
  // Generate simple trending sparkline data (14 days, increasing trend)
  const generateMockSparkline = () => {
    return Array.from({ length: 14 }, (_, i) => ({
      day: i + 1,
      count: Math.floor(20 + (i * 3) + Math.random() * 10),
    }));
  };

  return [
    {
      id: "infrastructure-bill",
      title: "Infrastructure Bill",
      tags: ["Infrastructure", "Transportation"],
      mentions: 42000,
      momentum: 78,
      cost: 1100,
      color: "#111827",
      mentionsOverTime: generateMockSparkline(),
    },
    {
      id: "healthcare-reform",
      title: "Healthcare Reform",
      tags: ["Healthcare", "Reform"],
      mentions: 37000,
      momentum: 69,
      cost: 210,
      color: "#0ea5e9",
      mentionsOverTime: generateMockSparkline(),
    },
    {
      id: "farm-bill",
      title: "Farm Bill",
      tags: ["Agriculture", "Farm"],
      mentions: 19500,
      momentum: 61,
      cost: 95,
      color: "#16a34a",
      mentionsOverTime: generateMockSparkline(),
    },
    {
      id: "defense-appropriations",
      title: "Defense Appropriations",
      tags: ["Defense", "Appropriations"],
      mentions: 26500,
      momentum: 72,
      cost: 840,
      color: "#ef4444",
      mentionsOverTime: generateMockSparkline(),
    },
  ];
}
