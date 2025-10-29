import { NextResponse } from "next/server";
import { getTrendingPoliticsUS } from "@/src/trending/index";

interface TrendingTopic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
  mentionsOverTime?: Array<{ day: number; count: number }>;
  thumbnails?: string[];
}

/**
 * Fetch 1 thumbnail for a topic from SERPAPI Google News
 */
async function fetchTopicThumbnails(topic: string): Promise<string[]> {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return [];
    }

    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', topic);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '3');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const newsResults = data.news_results || [];

    // Extract thumbnail from first article that has one
    const thumbnails = newsResults
      .slice(0, 3)
      .map((article: { thumbnail?: string; image?: string }) =>
        article.thumbnail || article.image
      )
      .filter((url: string | undefined) => url)
      .slice(0, 1);

    return thumbnails;
  } catch (error) {
    console.error(`Error fetching thumbnails for "${topic}":`, error);
    return [];
  }
}

/**
 * Use Gemini to identify and remove duplicate/similar topics
 */
async function deduplicateTopics(topics: TrendingTopic[]): Promise<TrendingTopic[]> {
  try {
    if (topics.length <= 1) return topics;

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, skipping deduplication');
      return topics;
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const baseURL = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Actalyze';
    }

    // Create numbered list of topics
    const topicList = topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n');

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `You are analyzing trending political topics to remove duplicates. Below is a numbered list of topics.

${topicList}

Identify which topics are duplicates or very similar (covering the same story/event). When duplicates exist, keep ONLY the one that appears first in the list.

Return ONLY a JSON array of numbers representing the topics to KEEP (not remove). For example: [1,2,4,5,7] means keep topics 1,2,4,5,7 and remove 3,6,8,9.

Return ONLY the JSON array, nothing else.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Deduplication API error: ${response.status}`);
      return topics;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return topics;

    // Parse the JSON array
    const keepIndices = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    if (!Array.isArray(keepIndices)) return topics;

    // Filter topics based on indices (convert 1-based to 0-based)
    const deduped = topics.filter((_, i) => keepIndices.includes(i + 1));

    console.log(`🔍 Deduplication: ${topics.length} → ${deduped.length} topics (removed ${topics.length - deduped.length} duplicates)`);

    return deduped;
  } catch (error) {
    console.error('Error deduplicating topics:', error);
    return topics; // Return original on error
  }
}

/**
 * Use Gemini Flash via OpenRouter to convert cryptic topic names into clear, human-readable titles
 */
async function convertTopicTitle(rawTopic: string, examples: string[]): Promise<string> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ OpenRouter API key not set, using simple title case');
      return rawTopic
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const baseURL = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Actalyze';
    }

    const contextHeadlines = examples.slice(0, 2).join('\n');

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Convert this cryptic trending topic name into a clear, concise, human-readable title (max 5-7 words).

Raw topic: "${rawTopic}"

Context from recent headlines:
${contextHeadlines}

Return ONLY the cleaned up title, nothing else. Make it clear what the topic is about.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return rawTopic
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    const data = await response.json();
    const cleanedTitle = data.choices?.[0]?.message?.content?.trim().replace(/['"]/g, '') || rawTopic;

    console.log(`✨ AI: "${rawTopic}" → "${cleanedTitle}"`);
    return cleanedTitle;
  } catch (error) {
    console.error('Error converting topic title:', error);
    // Fallback to simple title case
    return rawTopic
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export async function GET() {
  try {
    console.log("🚀 Trending API called at", new Date().toISOString());

    // Fetch trending political topics from SERPAPI
    const topics = await getTrendingPoliticsUS({
      maxItems: 9,
      minScore: 10,
      useFallback: true,
    });

    console.log(`✅ Got ${topics.length} topics from SERPAPI`);

    if (topics.length === 0) {
      console.log("⚠️ No topics returned, falling back to mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    // Transform SERPAPI topics to our frontend format (with parallel Gemini calls and thumbnail fetching)
    const trendingTopicsArray: TrendingTopic[] = await Promise.all(topics.map(async (topic) => {
      // Clean up topic name with Gemini
      const cleanTopicName = topic.topic.trim();

      // Fetch both title and thumbnails in parallel
      const [displayTitle, thumbnails] = await Promise.all([
        convertTopicTitle(cleanTopicName, topic.examples),
        fetchTopicThumbnails(cleanTopicName),
      ]);

      // Extract tags from examples or topic
      const tags = topic.examples
        .slice(0, 2)
        .map(ex => {
          const words = ex.split(' ').filter(w => w.length > 4);
          return words[0] || 'Politics';
        })
        .filter(Boolean);

      if (tags.length === 0) {
        tags.push('Politics', 'Trending');
      }

      // Generate realistic-looking sparkline data with natural variation
      const baseCount = 15 + Math.floor(Math.random() * 35);
      const trendDirection = Math.random() > 0.3 ? 1 : -0.5; // Usually trending up
      const volatility = 5 + Math.random() * 10; // Random daily variation

      const mentionsOverTime = Array.from({ length: 7 }, (_, i) => {
        const trend = i * 2.5 * trendDirection;
        const noise = (Math.random() - 0.5) * volatility;
        const weekendDip = (i % 7 === 5 || i % 7 === 6) ? -3 : 0; // Slight weekend dip
        return {
          day: i + 1,
          count: Math.max(5, Math.floor(baseCount + trend + noise + weekendDip)),
        };
      });

      // Estimate mentions based on score
      const mentions = Math.floor((topic.score / 100) * 100000) + 10000;

      return {
        id: cleanTopicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags: tags.slice(0, 3),
        mentions,
        momentum: topic.score,
        cost: Math.floor(Math.random() * 1000) + 50,
        color: getColorForTopic(cleanTopicName.toLowerCase()),
        mentionsOverTime,
        thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
      };
    }));

    // Deduplicate similar topics using AI
    const dedupedTopics = await deduplicateTopics(trendingTopicsArray);

    return NextResponse.json(dedupedTopics);

  } catch (error) {
    console.error("❌ Error fetching trending topics:", error);
    console.log("⚠️ Falling back to mock data due to error");
    return NextResponse.json(getMockTrendingTopics());
  }
}

function getColorForTopic(topic: string): string {
  const colors = [
    "#111827", // dark gray
    "#0ea5e9", // blue
    "#16a34a", // green
    "#ef4444", // red
    "#8b5cf6", // purple
    "#f59e0b", // amber
    "#ec4899", // pink
    "#06b6d4", // cyan
  ];

  // Simple hash to consistently assign colors
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
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
      mentionsOverTime: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(30 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "healthcare-reform",
      title: "Healthcare Reform",
      tags: ["Healthcare", "Reform"],
      mentions: 37000,
      momentum: 69,
      cost: 210,
      color: "#0ea5e9",
      mentionsOverTime: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(25 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "farm-bill",
      title: "Farm Bill",
      tags: ["Agriculture", "Farm"],
      mentions: 19500,
      momentum: 61,
      cost: 95,
      color: "#16a34a",
      mentionsOverTime: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(22 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "defense-appropriations",
      title: "Defense Appropriations",
      tags: ["Defense", "Appropriations"],
      mentions: 26500,
      momentum: 72,
      cost: 840,
      color: "#ef4444",
      mentionsOverTime: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(27 + i * 3 + Math.random() * 10),
      })),
    },
  ];
}
