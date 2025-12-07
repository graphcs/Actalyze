/**
 * Representative Mention Detector
 * Detects when a specific representative is mentioned in recent tweets
 */

import { TwitterApi } from 'twitter-api-v2';
import type { AlertConfig, AlertCheckResult } from '@/types/alerts';

// Minimum mentions to trigger alert
const MIN_MENTIONS_THRESHOLD = 3;

// How far back to look (in hours)
const LOOKBACK_HOURS = 6;

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
 * Build search query for representative
 */
function buildSearchQuery(repName: string, districtCode?: string): string {
  // Handle names with multiple parts
  const nameParts = repName.split(' ').filter(p => p.length > 1);

  let query = '';

  if (nameParts.length >= 2) {
    // Search for full name or last name
    query = `("${repName}" OR ${nameParts[nameParts.length - 1]})`;
  } else {
    query = `"${repName}"`;
  }

  // Add district context if available
  if (districtCode && districtCode !== 'national') {
    const stateCode = districtCode.substring(0, 2);
    query += ` (${stateCode} OR congress OR representative OR rep)`;
  } else {
    query += ' (congress OR representative OR politician OR senator)';
  }

  query += ' -is:retweet lang:en';

  return query;
}

/**
 * Check for representative mentions
 */
export async function checkRepMention(config: AlertConfig): Promise<AlertCheckResult> {
  const { representative_name, district_code } = config;

  if (!representative_name) {
    return { triggered: false };
  }

  try {
    const twitterClient = await getTwitterClient();
    const searchQuery = buildSearchQuery(representative_name, district_code);

    // Calculate start time (lookback period)
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - LOOKBACK_HOURS);

    const result = await twitterClient.v2.search(searchQuery, {
      max_results: 100,
      'tweet.fields': ['created_at', 'public_metrics'],
      start_time: startTime.toISOString(),
    });

    const tweets = result.data.data || [];
    const mentionCount = tweets.length;

    // Filter to only recent tweets (within lookback period)
    const recentTweets = tweets.filter(tweet => {
      if (!tweet.created_at) return true;
      const tweetTime = new Date(tweet.created_at);
      return tweetTime >= startTime;
    });

    const triggered = recentTweets.length >= MIN_MENTIONS_THRESHOLD;

    if (triggered) {
      // Get sample tweets (top engaged)
      const sortedTweets = [...recentTweets].sort((a, b) => {
        const aScore = (a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2;
        const bScore = (b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2;
        return bScore - aScore;
      });

      const sampleTweets = sortedTweets.slice(0, 5).map(t => t.text);

      return {
        triggered: true,
        message: `${representative_name} was mentioned ${recentTweets.length} times in the past ${LOOKBACK_HOURS} hours.`,
        details: {
          representative_name,
          district_code: district_code || 'national',
          mention_count: recentTweets.length,
          sample_tweets: sampleTweets,
        },
      };
    }

    return { triggered: false };
  } catch (error) {
    console.error('Error checking rep mentions:', error);
    return { triggered: false };
  }
}
