import { NextResponse } from "next/server";

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
  mentionsOverTime?: Array<{ day: number; count: number }>;
}

export async function GET() {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedTrending && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log("✓ Returning cached trending topics (cached for 2 hours)");
      return NextResponse.json(cachedTrending);
    }

    const apifyToken = process.env.APIFY_API_TOKEN;

    if (!apifyToken) {
      console.log("❌ No Apify API token found, returning mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    console.log("✓ Apify API token found, fetching trending topics...");

    // Step 1: Get US trending topics from Apify Twitter Trends Scraper
    console.log("🔍 Fetching US trending topics from Apify...");

    const trendsInput = {
      country: 'united-states',
      onlyHashtags: false,
      language: 'en',
    };

    let trendingTopics;
    try {
      const trendsResponse = await fetch(
        'https://api.apify.com/v2/acts/fastcrawler~x-twitter-trends-scraper-2025/run-sync-get-dataset-items?token=' + apifyToken,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trendsInput),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!trendsResponse.ok) {
        throw new Error(`Trends API failed: ${trendsResponse.status}`);
      }

      trendingTopics = await trendsResponse.json();
      console.log(`✓ Fetched ${trendingTopics.length} trending topics from Twitter`);
    } catch (error) {
      console.log("⚠️ Error fetching trending topics:", error);
      return NextResponse.json(getMockTrendingTopics());
    }

    // Step 2: Filter for political/legislative relevance
    const politicalRegex = /bill|act|senate|house|congress|gov|hearing|committee|election|ballot|SCOTUS|appropriation|H\.R\.|S\.|HB|SB|shutdown|legislation|federal|policy|reform|vote|amendment|president|white house|trump|biden|supreme court/i;

    interface TrendingResult {
      name?: string;
      topic?: string;
      tweet_volume?: number;
      url?: string;
    }

    const relevantTopics = (trendingTopics as TrendingResult[]).filter((topic: TrendingResult) =>
      politicalRegex.test(topic.name || topic.topic || '')
    );

    console.log(`✓ Filtered to ${relevantTopics.length} political/legislative topics`);

    if (relevantTopics.length === 0) {
      console.log("⚠️ No relevant political topics found, returning fallback data");
      return NextResponse.json(getMockTrendingTopics());
    }

    // Step 3: For each trending topic, fetch sample tweets to get historical data
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

    const topicsWithTweets: { [key: string]: ApifyTweet[] } = {};

    // Take top 12 relevant topics (we'll filter to top 9 later)
    for (const topic of relevantTopics.slice(0, 12)) {
      const topicName = topic.name || topic.topic || '';
      const searchQuery = topicName.replace('#', ''); // Remove # for search

      try {
        console.log(`🔍 Fetching tweets for: "${searchQuery}"`);

        const tweetsInput = {
          searchTerms: [searchQuery],
          maxTweets: 50,
          includeRetweets: false,
          language: 'en',
        };

        const tweetsResponse = await fetch(
          'https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=' + apifyToken,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tweetsInput),
            signal: AbortSignal.timeout(30000),
          }
        );

        if (tweetsResponse.ok) {
          const tweets = await tweetsResponse.json();
          if (Array.isArray(tweets) && tweets.length > 0) {
            topicsWithTweets[topicName] = tweets;
            console.log(`✓ Found ${tweets.length} tweets for "${searchQuery}"`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Error fetching tweets for "${searchQuery}":`, error);
      }
    }

    console.log(`✓ Collected tweets for ${Object.keys(topicsWithTweets).length} topics`);

    // Step 4: Create trending topics with sparkline data
    const trendingTopicsArray: TrendingTopic[] = [];

    for (const [topicName, tweets] of Object.entries(topicsWithTweets)) {
      if (tweets.length === 0) continue;

      // Calculate total engagement
      const totalEngagement = tweets.reduce((sum, t) =>
        sum + (t.likes || 0) + (t.retweets || 0) + (t.replies || 0), 0
      );
      const avgEngagement = totalEngagement / tweets.length;
      const momentum = Math.min(Math.round(avgEngagement / 10), 100);

      // Calculate daily mentions for sparkline (last 14 days)
      const dailyMentions: { [key: number]: number } = {};
      const nowTime = Date.now();

      // Initialize last 14 days
      for (let i = 13; i >= 0; i--) {
        dailyMentions[i] = 0;
      }

      // Aggregate tweets by day
      tweets.forEach(tweet => {
        const tweetDate = tweet.created_at || tweet.timestamp;
        if (tweetDate) {
          const date = new Date(tweetDate);
          const daysAgo = Math.floor((nowTime - date.getTime()) / (24 * 60 * 60 * 1000));
          if (daysAgo >= 0 && daysAgo < 14) {
            dailyMentions[13 - daysAgo]++;
          }
        }
      });

      const mentionsOverTime = Object.keys(dailyMentions).map(day => ({
        day: parseInt(day) + 1,
        count: dailyMentions[parseInt(day)],
      }));

      // Clean up topic name
      const cleanTopicName = topicName.replace('#', '').trim();
      const displayTitle = cleanTopicName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Extract tags
      const tags = displayTitle.split(' ').filter(word => word.length > 3).slice(0, 3);

      trendingTopicsArray.push({
        id: cleanTopicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags,
        mentions: tweets.length * 1000, // Estimate based on sample
        momentum: Math.max(momentum, 45),
        cost: Math.floor(Math.random() * 1000) + 50, // Mock cost
        color: getColorForTopic(cleanTopicName.toLowerCase()),
        tweetIds: tweets.slice(0, 5).map(t => t.id || t.id_str || ''),
        mentionsOverTime,
      });

      // Stop at 9 topics
      if (trendingTopicsArray.length >= 9) break;
    }

    console.log(`✓ Created ${trendingTopicsArray.length} trending topic objects`);
    console.log("✓ Caching for 2 hours");

    // Cache the results
    cachedTrending = trendingTopicsArray;
    cacheTimestamp = now;

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
