/**
 * Issue Surge Detector
 * Detects when a topic suddenly trends above baseline
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getTrendingPoliticsUS } from '@/src/trending';
import type { AlertConfig, AlertCheckResult, AlertBaseline } from '@/types/alerts';

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// Rolling average decay factor (how much weight to give new samples)
const ROLLING_AVG_WEIGHT = 0.3;

// Default baseline score for new topics
const DEFAULT_BASELINE_SCORE = 30;

/**
 * Get or create baseline for a topic
 */
async function getBaseline(topic: string, districtCode: string): Promise<AlertBaseline | null> {
  const { data, error } = await getSupabase()
    .from('alert_baselines')
    .select('*')
    .eq('topic', topic.toLowerCase())
    .eq('district_code', districtCode)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching baseline:', error);
    return null;
  }

  return data;
}

/**
 * Update baseline with new score (rolling average)
 */
async function updateBaseline(topic: string, districtCode: string, newScore: number): Promise<void> {
  const existing = await getBaseline(topic, districtCode);

  if (existing) {
    // Update with rolling average
    const newAvg = existing.avg_score !== null && existing.avg_score !== undefined
      ? existing.avg_score * (1 - ROLLING_AVG_WEIGHT) + newScore * ROLLING_AVG_WEIGHT
      : newScore;

    await getSupabase()
      .from('alert_baselines')
      .update({
        avg_score: newAvg,
        sample_count: existing.sample_count + 1,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Create new baseline
    await getSupabase()
      .from('alert_baselines')
      .insert({
        topic: topic.toLowerCase(),
        district_code: districtCode,
        avg_score: newScore,
        sample_count: 1,
      });
  }
}

/**
 * Get current topic score from trending data
 */
async function getCurrentTopicScore(topic: string): Promise<number | null> {
  try {
    const trending = await getTrendingPoliticsUS({ maxItems: 20, minScore: 0 });

    // Find matching topic (case-insensitive partial match)
    const topicLower = topic.toLowerCase();
    const match = trending.find(t =>
      t.topic.toLowerCase().includes(topicLower) ||
      topicLower.includes(t.topic.toLowerCase())
    );

    return match?.score ?? null;
  } catch (error) {
    console.error('Error fetching trending data:', error);
    return null;
  }
}

/**
 * Check if a topic is surging above baseline
 */
export async function checkIssueSurge(config: AlertConfig): Promise<AlertCheckResult> {
  const { topic, district_code, threshold } = config;

  if (!topic) {
    return { triggered: false };
  }

  // Get current score
  const currentScore = await getCurrentTopicScore(topic);

  if (currentScore === null) {
    // Topic not currently trending, update baseline to decay
    return { triggered: false };
  }

  // Get baseline
  const baseline = await getBaseline(topic, district_code);
  const baselineScore = baseline?.avg_score ?? DEFAULT_BASELINE_SCORE;

  // Calculate if surge occurred
  // Threshold is a percentage (e.g., 50 = 50% above baseline)
  const surgeThreshold = threshold ?? 50;
  const surgeTarget = baselineScore * (1 + surgeThreshold / 100);

  const triggered = currentScore > surgeTarget;

  // Update baseline with new reading
  await updateBaseline(topic, district_code, currentScore);

  if (triggered) {
    const percentIncrease = ((currentScore - baselineScore) / baselineScore * 100).toFixed(0);

    return {
      triggered: true,
      message: `"${topic}" is surging! Score of ${currentScore.toFixed(0)} is ${percentIncrease}% above baseline.`,
      details: {
        topic,
        district_code,
        current_score: currentScore,
        baseline_score: baselineScore,
      },
    };
  }

  return { triggered: false };
}
