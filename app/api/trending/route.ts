import { NextRequest, NextResponse } from "next/server";
import { getTrendingPoliticsUS } from "@/src/trending/index";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

interface TrendingTopic {
  id: string;
  title: string;
  tags: string[];
  /** SERPAPI trend score for the topic (0-100) */
  momentum: number;
  color: string;
  thumbnails?: string[];
  /** Optional, only set when an actual measured value is available */
  mentions?: number;
  cost?: number;
  mentionsOverTime?: Array<{ day: number; count: number }>;
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

    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, skipping deduplication');
      return topics;
    }

    const useOpenRouter = !!OPENROUTER_KEY;
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
            content: `You are analyzing trending political topics to remove ONLY obvious duplicates. Below is a numbered list of topics.

${topicList}

ONLY mark topics as duplicates if they are about THE EXACT SAME story/event with very similar wording. For example:
- "Senate Rejects Trump Brazil Tariffs" and "Senate Blocks Trump Brazil Tariffs" = DUPLICATES (same story)
- "Senate Debate on Healthcare" and "Senate Healthcare Vote" = DIFFERENT (different aspects/events)
- "Trump Administration Policy" and "Trump Speech on Economy" = DIFFERENT (different topics)

Be conservative - when in doubt, keep both topics. We want to remove obvious duplicates only.

Return ONLY a JSON array of numbers representing the topics to KEEP (not remove). For example: [1,2,4,5,7,8,9] means keep most topics and only remove 3,6.

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
 * Use Gemini Flash to generate relevant tags for a topic
 */
async function generateTags(topic: string, examples: string[]): Promise<string[]> {
  try {
    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return ['Politics', 'Trending'];
    }

    const useOpenRouter = !!OPENROUTER_KEY;
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
            content: `Generate 2-4 concise, relevant tags for this political topic. Tags should be 1-2 words each.

Topic: "${topic}"

Context from headlines:
${contextHeadlines}

Return ONLY a JSON array of strings. Example: ["Senate", "Healthcare", "Budget"]`,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return ['Politics', 'Trending'];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return ['Politics', 'Trending'];

    const tags = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    if (!Array.isArray(tags)) return ['Politics', 'Trending'];

    return tags.slice(0, 4);
  } catch (error) {
    console.error('Error generating tags:', error);
    return ['Politics', 'Trending'];
  }
}

/**
 * Use Gemini Flash via OpenRouter to convert cryptic topic names into clear, human-readable titles
 */
async function convertTopicTitle(rawTopic: string, examples: string[]): Promise<string> {
  try {
    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ OpenRouter API key not set, using simple title case');
      return rawTopic
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    const useOpenRouter = !!OPENROUTER_KEY;
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

/**
 * Drop any non-measured fields that may still be present in cache entries
 * written by earlier versions of this route (generated mention counts, spend
 * figures and per-day series). Only values we actually measure are returned.
 */
function sanitizeTopics(topics: TrendingTopic[]): TrendingTopic[] {
  if (!Array.isArray(topics)) return [];
  return topics.map(({ id, title, tags, momentum, color, thumbnails }) => ({
    id,
    title,
    tags,
    momentum,
    color,
    ...(thumbnails && thumbnails.length > 0 ? { thumbnails } : {}),
  }));
}

export async function GET(request: NextRequest) {
  try {
    console.log("🚀 Trending API called at", new Date().toISOString());

    // Check cache settings - uses global cache setting from admin (default: 24h)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);

    const memoryCacheKey = generateCacheKey('trending-topics', {});
    const dbCacheKey = generateDistrictCacheKey('trending', 'national', {});

    // Try database cache first
    const dbCached = await getFromDbCache<TrendingTopic[]>(dbCacheKey, useCache);
    if (dbCached) {
      console.log(`📦 Using DB cached trending topics`);
      const sanitized = sanitizeTopics(dbCached);
      serverCache.set(memoryCacheKey, sanitized, cacheDurationSeconds);
      return NextResponse.json(sanitized);
    }

    // Fall back to memory cache
    const memoryCached = serverCache.get<TrendingTopic[]>(memoryCacheKey, useCache);
    if (memoryCached) {
      console.log(`📦 Using memory cached trending topics`);
      return NextResponse.json(sanitizeTopics(memoryCached));
    }

    // Fetch trending political topics from SERPAPI
    // Request 12 topics so after deduplication we have ~9
    const topics = await getTrendingPoliticsUS({
      maxItems: 12,
      minScore: 10,
      useFallback: true,
    });

    console.log(`✅ Got ${topics.length} topics from SERPAPI`);

    if (topics.length === 0) {
      // No live topics available. Return nothing rather than substituting
      // invented topics - the UI renders an "unavailable" state.
      console.log("⚠️ No topics returned from SERPAPI - returning empty list");
      return NextResponse.json([]);
    }

    // Transform SERPAPI topics to our frontend format (with parallel Gemini calls and thumbnail fetching)
    const trendingTopicsArray: TrendingTopic[] = await Promise.all(topics.map(async (topic) => {
      // Clean up topic name with Gemini
      const cleanTopicName = topic.topic.trim();

      // Fetch title, tags, and thumbnails in parallel
      const [displayTitle, aiTags, thumbnails] = await Promise.all([
        convertTopicTitle(cleanTopicName, topic.examples),
        generateTags(cleanTopicName, topic.examples),
        fetchTopicThumbnails(cleanTopicName),
      ]);

      // Use AI-generated tags (already unique and relevant)
      const uniqueTags = aiTags;

      // Only measured values are returned. `momentum` is the SERPAPI trend
      // score for the topic. Mention counts, spend estimates and per-day
      // series are not measured by this pipeline, so they are omitted rather
      // than generated.
      return {
        id: cleanTopicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags: uniqueTags.slice(0, 3),
        momentum: topic.score,
        color: getColorForTopic(cleanTopicName.toLowerCase()),
        thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
      };
    }));

    // Deduplicate similar topics using AI
    const dedupedTopics = await deduplicateTopics(trendingTopicsArray);

    // Ensure we always return exactly 9 topics
    const finalTopics = dedupedTopics.slice(0, 9);

    // Cache the results
    serverCache.set(memoryCacheKey, finalTopics, cacheDurationSeconds);
    await setInDbCache(dbCacheKey, 'trending', 'national', finalTopics, cacheDurationSeconds);

    console.log(`✅ Cached ${finalTopics.length} trending topics for ${cacheDurationSeconds / 3600}h`);

    return NextResponse.json(finalTopics);

  } catch (error) {
    console.error("❌ Error fetching trending topics:", error);
    // Fail closed: return no topics rather than invented ones.
    return NextResponse.json([]);
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
