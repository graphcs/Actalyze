/**
 * Main entry point for fetching US political trending topics via SERPAPI
 */

import type { TrendingTopic, GetTrendingOptions } from './types';
import { fetchTrendingNow, fetchGoogleNews } from './serpapi';
import { normalizeTopic } from './score';

const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_MIN_SCORE = 0;

/**
 * Get trending political topics from US using SERPAPI
 *
 * @param opts - Options for fetching and filtering topics
 * @returns Promise<TrendingTopic[]> - Sorted list of unique topics by score descending
 */
export async function getTrendingPoliticsUS(opts: GetTrendingOptions = {}): Promise<TrendingTopic[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error('❌ SERPAPI_KEY environment variable not set');
    return [];
  }

  const maxItems = opts.maxItems ?? parseInt(process.env.TREND_MAX_ITEMS || String(DEFAULT_MAX_ITEMS));
  const minScore = opts.minScore ?? parseInt(process.env.TREND_MIN_SCORE || String(DEFAULT_MIN_SCORE));
  const useFallback = opts.useFallback ?? true;

  console.log(`📊 Fetching trending politics (max: ${maxItems}, minScore: ${minScore})`);

  const allTopics: TrendingTopic[] = [];

  // Try Trending Now first
  const trendingNowTopics = await fetchTrendingNow(apiKey);
  allTopics.push(...trendingNowTopics);

  console.log(`✓ Got ${trendingNowTopics.length} topics from Trending Now`);

  // Use fallback if no results or all below min score
  const validTopics = allTopics.filter(t => t.score >= minScore);

  if (validTopics.length === 0 && useFallback) {
    console.log('⚠️ No valid topics from Trending Now, using Google News fallback');
    const newsTopics = await fetchGoogleNews(apiKey);
    allTopics.push(...newsTopics);
    console.log(`✓ Got ${newsTopics.length} topics from Google News`);
  }

  // Deduplicate by normalized topic (case-insensitive)
  const uniqueMap = new Map<string, TrendingTopic>();

  for (const topic of allTopics) {
    const normalizedKey = normalizeTopic(topic.topic);

    if (!normalizedKey) continue;

    const existing = uniqueMap.get(normalizedKey);

    // Keep the higher score if duplicate
    if (!existing || topic.score > existing.score) {
      uniqueMap.set(normalizedKey, topic);
    }
  }

  // Convert to array, filter by minScore, sort by score desc, limit to maxItems
  const result = Array.from(uniqueMap.values())
    .filter(t => t.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  console.log(`✅ Returning ${result.length} unique trending topics`);

  return result;
}

// Export types and utilities
export type { TrendingTopic, GetTrendingOptions } from './types';
export { scoreFromTraffic, scoreFromCounts, scoreFromCluster, normalizeTopic } from './score';
