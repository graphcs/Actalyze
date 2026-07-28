/**
 * Database-backed cache for district data
 * Persists cache to Supabase for instant loading across server restarts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { CountryCode } from './country';

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.ACTALYZE_SUPABASE_URL;
    const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn('Supabase not configured for DB cache');
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

export type CacheType = 'news' | 'summary' | 'polling' | 'perspectives' | 'tweets' | 'ai-intel' | 'state-news' | 'wordcloud' | 'trending' | 'trending-series' | 'comms-radar';

// Default TTL values in seconds
export const DEFAULT_CACHE_DURATIONS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
};

/**
 * Generate a cache key for district data.
 *
 * `country` scopes the key so a second country cannot overwrite the first in the
 * shared `district_cache` table. This is not hypothetical: Pakistan's `NA-123` and a
 * US district code live in the same `cache_key` column, and two-letter subnational
 * codes collide outright (Sindh `SD` vs South Dakota `SD`).
 *
 * `'US'` — the default — emits the byte-identical key it always has, so every cache
 * row written before this parameter existed still resolves. Only non-US countries
 * take a prefix.
 */
export function generateDistrictCacheKey(
  cacheType: CacheType,
  districtCode: string,
  additionalParams?: Record<string, string>,
  country: CountryCode = 'US'
): string {
  let key = `district:${cacheType}:${districtCode}`;
  if (additionalParams) {
    const sortedParams = Object.keys(additionalParams)
      .sort()
      .map(k => `${k}=${additionalParams[k]}`)
      .join('&');
    key += `:${sortedParams}`;
  }
  return country === 'US' ? key : `${country.toLowerCase()}:${key}`;
}

/**
 * Get cached data from database
 * @param cacheKey The cache key to look up
 * @param useCache Whether to actually read from cache (false = skip reading)
 * @returns Cached data or null
 */
export async function getFromDbCache<T>(
  cacheKey: string,
  useCache: boolean = true
): Promise<T | null> {
  // If cache reading is disabled, return null (but we'll still write to cache)
  if (!useCache) {
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('district_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired entry
      await supabase.from('district_cache').delete().eq('cache_key', cacheKey);
      return null;
    }

    console.log(`✅ DB Cache HIT: ${cacheKey}`);
    return data.data as T;
  } catch (error) {
    console.error('Error reading from DB cache:', error);
    return null;
  }
}

/**
 * Save data to database cache
 * @param cacheKey The cache key
 * @param cacheType The type of cache (news, summary, etc.)
 * @param districtCode The district code
 * @param data The data to cache
 * @param ttlSeconds Time-to-live in seconds
 */
export async function setInDbCache<T>(
  cacheKey: string,
  cacheType: CacheType,
  districtCode: string,
  data: T,
  ttlSeconds: number = DEFAULT_CACHE_DURATIONS['1h']
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    // Upsert to handle both insert and update
    const { error } = await supabase.from('district_cache').upsert(
      {
        cache_key: cacheKey,
        cache_type: cacheType,
        district_code: districtCode,
        data: data,
        expires_at: expiresAt,
      },
      {
        onConflict: 'cache_key',
      }
    );

    if (error) {
      // Table might not exist yet - that's okay, fall back to memory cache
      if (error.code === '42P01') {
        console.log('DB cache table not found, using memory cache only');
        return;
      }
      console.error('Error writing to DB cache:', error);
      return;
    }

    console.log(`💾 DB Cache SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.error('Error writing to DB cache:', error);
  }
}

/**
 * Delete a cache entry
 */
export async function deleteFromDbCache(cacheKey: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    await supabase.from('district_cache').delete().eq('cache_key', cacheKey);
    console.log(`🗑️ DB Cache DELETE: ${cacheKey}`);
  } catch (error) {
    console.error('Error deleting from DB cache:', error);
  }
}

/**
 * Clear all cache for a district
 */
export async function clearDistrictCache(districtCode: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    await supabase.from('district_cache').delete().eq('district_code', districtCode);
    console.log(`🗑️ DB Cache CLEARED for district: ${districtCode}`);
  } catch (error) {
    console.error('Error clearing district cache:', error);
  }
}

/**
 * Clean up all expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('cleanup_expired_cache');

    if (error) {
      // Function might not exist - try direct delete
      const { error: deleteError } = await supabase
        .from('district_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (deleteError) {
        console.error('Error cleaning up cache:', deleteError);
        return 0;
      }
      return 1; // Assume some were deleted
    }

    return data || 0;
  } catch (error) {
    console.error('Error cleaning up expired cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  byType: Record<string, number>;
  byDistrict: Record<string, number>;
} | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('district_cache')
      .select('cache_type, district_code')
      .gt('expires_at', new Date().toISOString());

    if (error || !data) {
      return null;
    }

    const byType: Record<string, number> = {};
    const byDistrict: Record<string, number> = {};

    for (const entry of data) {
      byType[entry.cache_type] = (byType[entry.cache_type] || 0) + 1;
      byDistrict[entry.district_code] = (byDistrict[entry.district_code] || 0) + 1;
    }

    return {
      totalEntries: data.length,
      byType,
      byDistrict,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}
