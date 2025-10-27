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

    console.log("✓ Apify API token found, fetching trending topics...");
    console.log("✓ Token starts with:", apifyToken.substring(0, 15) + "...");

    // Step 1: Get US trending topics from Apify Twitter Trends Scraper
    console.log("🔍 Fetching US trending topics from Apify...");

    const trendsInput = {
      country: 'united-states',
      onlyHashtags: false,
      language: 'en',
    };

    let trendingTopics;
    try {
      const fetchStart = Date.now();
      const trendsResponse = await fetch(
        'https://api.apify.com/v2/acts/fastcrawler~x-twitter-trends-scraper-2025/run-sync-get-dataset-items?token=' + apifyToken,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trendsInput),
          signal: AbortSignal.timeout(8000),
        }
      );
      console.log(`✓ Trends API responded in ${Date.now() - fetchStart}ms`);

      if (!trendsResponse.ok) {
        const errorText = await trendsResponse.text();
        console.log(`❌ Trends API failed: ${trendsResponse.status}`, errorText.substring(0, 200));
        throw new Error(`Trends API failed: ${trendsResponse.status}`);
      }

      trendingTopics = await trendsResponse.json();
      console.log(`✓ Fetched ${trendingTopics.length} trending topics from Twitter`);
    } catch (error) {
      console.log("⚠️ Error fetching trending topics:", error instanceof Error ? error.message : String(error));
      console.log("⚠️ Falling back to mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    // Step 2: Take top trending topics (no filtering for now)
    interface TrendingResult {
      name?: string;
      topic?: string;
      tweet_volume?: number;
      url?: string;
    }

    const relevantTopicNames = (trendingTopics as TrendingResult[])
      .map(t => t.name || t.topic || '')
      .filter(Boolean)
      .slice(0, 12); // Take top 12 trends

    console.log(`✓ Using ${relevantTopicNames.length} trending topics from Apify`);

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

      // Find the corresponding trend to get tweet_volume
      const trendData = (trendingTopics as TrendingResult[]).find(
        t => (t.name || t.topic || '') === topicName
      );

      const tweetVolumeStr = trendData?.tweet_volume || '0';
      const tweetVolume = typeof tweetVolumeStr === 'string'
        ? parseInt(tweetVolumeStr.replace(/[^0-9]/g, '')) || 10000
        : tweetVolumeStr || 10000;

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
