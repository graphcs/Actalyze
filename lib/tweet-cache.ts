/**
 * Tweet Cache - Store tweets in database to avoid redundant API calls
 * Saves Twitter API quota by reusing previously fetched tweets
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.ACTALYZE_SUPABASE_URL;
    const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn('Supabase not configured for tweet cache');
      return null;
    }
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

export interface CachedTweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at: string;
  user_location?: string;
  user_bio?: string;
  engagement_score: number;
  search_terms: string[];  // Which search terms this tweet matched
  fetched_at: string;
}

interface TweetCacheEntry {
  tweet_id: string;
  tweet_data: CachedTweet;
  search_query: string;
  district_code: string;
  fetched_at: string;
}

// How long to consider cached tweets as fresh (in hours)
const TWEET_CACHE_TTL_HOURS = 6;

/**
 * Get cached tweets for a search query
 */
export async function getCachedTweets(
  searchTerms: string[],
  districtCode: string,
  maxAge: number = TWEET_CACHE_TTL_HOURS
): Promise<CachedTweet[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAge);

    // Get cached tweets that match any of our search terms
    const { data, error } = await supabase
      .from('tweet_cache')
      .select('tweet_data')
      .eq('district_code', districtCode)
      .gte('fetched_at', cutoffTime.toISOString())
      .limit(200);

    if (error) {
      // Table might not exist
      if (error.code === '42P01') {
        console.log('Tweet cache table not found');
        return [];
      }
      console.error('Error fetching cached tweets:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Deduplicate by tweet ID
    const seenIds = new Set<string>();
    const tweets: CachedTweet[] = [];

    for (const row of data) {
      const tweet = row.tweet_data as CachedTweet;
      if (!seenIds.has(tweet.id)) {
        seenIds.add(tweet.id);
        tweets.push(tweet);
      }
    }

    console.log(`📦 Found ${tweets.length} cached tweets for ${districtCode}`);
    return tweets;
  } catch (error) {
    console.error('Error getting cached tweets:', error);
    return [];
  }
}

/**
 * Save tweets to cache
 */
export async function cacheTweets(
  tweets: CachedTweet[],
  searchQuery: string,
  districtCode: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || tweets.length === 0) {
    return;
  }

  try {
    const now = new Date().toISOString();
    const entries: Omit<TweetCacheEntry, 'id'>[] = tweets.map(tweet => ({
      tweet_id: tweet.id,
      tweet_data: { ...tweet, fetched_at: now },
      search_query: searchQuery,
      district_code: districtCode,
      fetched_at: now,
    }));

    // Upsert to handle duplicates
    const { error } = await supabase
      .from('tweet_cache')
      .upsert(entries, {
        onConflict: 'tweet_id',
        ignoreDuplicates: true,
      });

    if (error) {
      // Table might not exist
      if (error.code === '42P01') {
        console.log('Tweet cache table not found, skipping cache write');
        return;
      }
      console.error('Error caching tweets:', error);
      return;
    }

    console.log(`💾 Cached ${tweets.length} tweets for ${districtCode}`);
  } catch (error) {
    console.error('Error caching tweets:', error);
  }
}

/**
 * Get tweet count for a district (to check if we have enough cached data)
 */
export async function getCachedTweetCount(
  districtCode: string,
  maxAge: number = TWEET_CACHE_TTL_HOURS
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    return 0;
  }

  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAge);

    const { count, error } = await supabase
      .from('tweet_cache')
      .select('*', { count: 'exact', head: true })
      .eq('district_code', districtCode)
      .gte('fetched_at', cutoffTime.toISOString());

    if (error) {
      return 0;
    }

    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Clean up old cached tweets
 */
export async function cleanupOldTweets(maxAgeHours: number = 24): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    return 0;
  }

  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    const { error } = await supabase
      .from('tweet_cache')
      .delete()
      .lt('fetched_at', cutoffTime.toISOString());

    if (error) {
      console.error('Error cleaning up old tweets:', error);
      return 0;
    }

    console.log(`🧹 Cleaned up tweets older than ${maxAgeHours} hours`);
    return 1;
  } catch (error) {
    console.error('Error cleaning up old tweets:', error);
    return 0;
  }
}
