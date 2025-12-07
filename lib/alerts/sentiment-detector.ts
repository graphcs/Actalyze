/**
 * Sentiment Shift Detector
 * Detects when sentiment on a topic changes significantly
 */

import { createClient } from '@supabase/supabase-js';
import { TwitterApi } from 'twitter-api-v2';
import type { AlertConfig, AlertCheckResult, AlertBaseline } from '@/types/alerts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Rolling average decay factor
const ROLLING_AVG_WEIGHT = 0.3;

// Minimum tweets needed for reliable sentiment
const MIN_TWEETS_FOR_SENTIMENT = 5;

/**
 * Get Twitter client
 */
async function getTwitterClient(): Promise<TwitterApi> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (bearerToken) {
    return new TwitterApi(bearerToken);
  }

  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Twitter API credentials not found');
  }

  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
  });

  return await client.appLogin();
}

/**
 * Simple sentiment analysis using keyword matching
 * Returns value between -1 (negative) and 1 (positive)
 */
function analyzeSentiment(text: string): number {
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'love', 'happy', 'success', 'win', 'best', 'support', 'progress',
    'hope', 'positive', 'improve', 'better', 'growth', 'benefit',
  ];

  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
    'fail', 'failure', 'disaster', 'crisis', 'problem', 'wrong',
    'angry', 'sad', 'fear', 'worried', 'concern', 'threat', 'danger',
    'oppose', 'against', 'reject', 'corrupt', 'scandal',
  ];

  const textLower = text.toLowerCase();
  let score = 0;
  let wordCount = 0;

  for (const word of positiveWords) {
    if (textLower.includes(word)) {
      score += 1;
      wordCount++;
    }
  }

  for (const word of negativeWords) {
    if (textLower.includes(word)) {
      score -= 1;
      wordCount++;
    }
  }

  // Normalize to -1 to 1 range
  if (wordCount === 0) return 0;
  return Math.max(-1, Math.min(1, score / Math.max(3, wordCount)));
}

/**
 * Get current sentiment for a topic from recent tweets
 */
async function getCurrentSentiment(topic: string): Promise<{ sentiment: number; tweets: string[] } | null> {
  try {
    const twitterClient = await getTwitterClient();
    const searchQuery = `${topic} -is:retweet -is:reply lang:en`;

    const result = await twitterClient.v2.search(searchQuery, {
      max_results: 50,
      'tweet.fields': ['created_at'],
    });

    if (!result.data.data || result.data.data.length < MIN_TWEETS_FOR_SENTIMENT) {
      return null;
    }

    const tweets = result.data.data.map(t => t.text);
    const sentiments = tweets.map(t => analyzeSentiment(t));
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

    return {
      sentiment: avgSentiment,
      tweets: tweets.slice(0, 5), // Sample tweets
    };
  } catch (error) {
    console.error('Error fetching tweets for sentiment:', error);
    return null;
  }
}

/**
 * Get or create baseline for a topic
 */
async function getBaseline(topic: string, districtCode: string): Promise<AlertBaseline | null> {
  const { data, error } = await supabase
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
 * Update baseline with new sentiment (rolling average)
 */
async function updateBaseline(topic: string, districtCode: string, newSentiment: number): Promise<void> {
  const existing = await getBaseline(topic, districtCode);

  if (existing) {
    const newAvg = existing.avg_sentiment !== null && existing.avg_sentiment !== undefined
      ? existing.avg_sentiment * (1 - ROLLING_AVG_WEIGHT) + newSentiment * ROLLING_AVG_WEIGHT
      : newSentiment;

    await supabase
      .from('alert_baselines')
      .update({
        avg_sentiment: newAvg,
        sample_count: existing.sample_count + 1,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('alert_baselines')
      .insert({
        topic: topic.toLowerCase(),
        district_code: districtCode,
        avg_sentiment: newSentiment,
        sample_count: 1,
      });
  }
}

/**
 * Check if sentiment has shifted significantly
 */
export async function checkSentimentShift(config: AlertConfig): Promise<AlertCheckResult> {
  const { topic, district_code, threshold } = config;

  if (!topic) {
    return { triggered: false };
  }

  // Get current sentiment
  const current = await getCurrentSentiment(topic);

  if (!current) {
    return { triggered: false };
  }

  // Get baseline
  const baseline = await getBaseline(topic, district_code);
  const baselineSentiment = baseline?.avg_sentiment ?? 0;

  // Calculate shift
  // Threshold is the absolute change required (e.g., 0.3 = 30% change on -1 to 1 scale)
  const shiftThreshold = threshold ?? 0.3;
  const shift = Math.abs(current.sentiment - baselineSentiment);

  const triggered = shift >= shiftThreshold;

  // Update baseline
  await updateBaseline(topic, district_code, current.sentiment);

  if (triggered) {
    const direction = current.sentiment > baselineSentiment ? 'more positive' : 'more negative';
    const shiftPercent = (shift * 100).toFixed(0);

    return {
      triggered: true,
      message: `Sentiment on "${topic}" has shifted ${shiftPercent}% ${direction}.`,
      details: {
        topic,
        district_code,
        current_sentiment: current.sentiment,
        baseline_sentiment: baselineSentiment,
        sample_tweets: current.tweets,
      },
    };
  }

  return { triggered: false };
}
