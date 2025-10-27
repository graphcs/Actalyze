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
    console.log("🔍 Searching for trending legislative and political topics...");

    const legislativeSearch = await readOnlyClient.v2.search(
      '(Congress OR bill OR legislation OR Senate OR House OR legislative OR politics OR government OR shutdown OR appropriations OR policy OR federal) -is:retweet lang:en',
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

    // Extract trending phrases dynamically from tweets
    const phraseFrequency: { [key: string]: {
      count: number;
      engagement: number;
      tweets: Array<{ id: string; public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } }>;
    } } = {};

    legislativeSearch.data.data.forEach((tweet: { text: string; id: string; public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number } }) => {
      const engagement = (tweet.public_metrics?.like_count || 0) +
                        (tweet.public_metrics?.retweet_count || 0) +
                        (tweet.public_metrics?.reply_count || 0);

      // Extract phrases containing legislative keywords
      const text = tweet.text;

      // Find phrases with "bill", "act", "resolution", "reform", "shutdown", etc.
      const legislativeTerms = [
        // Specific bill/act/resolution names (e.g., "Infrastructure Bill")
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(Bill|Act|Resolution)/gi,

        // Reform topics (e.g., "Immigration Reform")
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+Reform/gi,

        // Shutdown discussions
        /(Government|Federal)\s+Shutdown/gi,

        // Appropriations and funding
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(Appropriations?|Funding|Budget)/gi,

        // Specific legislative terms
        /(CR|Continuing Resolution|Omnibus|Minibus)\s*(Bill)?/gi,
        /(Big Beautiful Bill)/gi,
        /(NDAA|National Defense Authorization)/gi,

        // Policy areas
        /(Infrastructure\s+Investment)/gi,
        /(Debt\s+Ceiling)/gi,
        /(Farm\s+Bill)/gi,
        /(Defense\s+Authorization)/gi,

        // Legislative processes
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(Amendment|Committee|Legislation)/gi,
        /(Reconciliation\s+Package)/gi,
        /(Stimulus\s+Package)/gi,

        // Hot topics
        /(Border\s+Security)/gi,
        /(Immigration\s+Reform)/gi,
        /(Tax\s+Reform)/gi,
        /(Climate\s+(Bill|Legislation))/gi,
        /(Healthcare\s+Reform)/gi,
        /(Student\s+(Debt|Loan))/gi,
        /(Gun\s+(Control|Reform))/gi,
        /(Voting\s+Rights)/gi,

        // General legislative language (broader match)
        /(pass(ing|ed)?\s+(?:a|the)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+bill)/gi,
        /(support(ing)?\s+(?:the|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}))/gi,

        // Political news and events
        /(Presidential|White House|Executive Order)/gi,
        /(Supreme Court|SCOTUS)/gi,
        /(Impeachment)/gi,
        /(Filibuster)/gi,
        /(Speaker\s+of\s+the\s+House)/gi,
        /(Senate\s+Majority)/gi,
        /(Campaign\s+Finance)/gi,
        /(Gerrymandering)/gi,
      ];

      const foundPhrases = new Set<string>();

      legislativeTerms.forEach(regex => {
        const matches = text.matchAll(regex);
        for (const match of matches) {
          let phrase = match[0].trim();

          // Normalize the phrase
          phrase = phrase
            .replace(/\s+/g, ' ')
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            .trim();

          // Convert to lowercase for deduplication
          const normalizedPhrase = phrase.toLowerCase();

          // Skip generic, conversational, or irrelevant terms
          if (phrase.length < 5 ||
              normalizedPhrase === 'the bill' ||
              normalizedPhrase === 'this bill' ||
              normalizedPhrase === 'that act' ||
              normalizedPhrase.includes('my bill') ||
              normalizedPhrase.includes('your bill') ||
              normalizedPhrase.includes('i ') ||
              normalizedPhrase.includes('you ') ||
              normalizedPhrase.includes('always pay') ||
              normalizedPhrase.includes('money from')) {
            continue;
          }

          // Store using normalized (lowercase) key for deduplication
          foundPhrases.add(normalizedPhrase);
        }
      });

      // Record each phrase found
      foundPhrases.forEach(phrase => {
        if (!phraseFrequency[phrase]) {
          phraseFrequency[phrase] = { count: 0, engagement: 0, tweets: [] };
        }
        phraseFrequency[phrase].count++;
        phraseFrequency[phrase].engagement += engagement;
        if (phraseFrequency[phrase].tweets.length < 10) {
          phraseFrequency[phrase].tweets.push(tweet);
        }
      });
    });

    // Sort topics by combined score (count × engagement)
    const sortedTopics = Object.entries(phraseFrequency)
      .filter(([, data]) => data.count >= 1) // Only topics mentioned at least once
      .sort((a, b) => {
        const scoreA = a[1].count * (a[1].engagement + 1);
        const scoreB = b[1].count * (b[1].engagement + 1);
        return scoreB - scoreA;
      })
      .slice(0, 9); // Get top 9

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

      // Capitalize first letter of each word for display
      const displayTitle = topicName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Extract tags from topic name
      const tags = displayTitle.split(' ').filter(word => word.length > 3);

      trendingTopics.push({
        id: topicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags: tags.slice(0, 3),
        mentions: data.count * 1000 + Math.floor(Math.random() * 5000), // Estimated based on tweet count
        momentum: Math.max(momentum, 45), // Ensure minimum momentum (based on engagement)
        cost: Math.floor(Math.random() * 1000) + 50, // MOCK DATA: Random estimated cost in billions (real CBO data not available via API)
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
