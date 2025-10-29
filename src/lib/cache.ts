/**
 * Server-side cache with TTL support
 * Cache is shared across all users on the same server instance
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class ServerCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 3600) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to milliseconds

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @param useCache Whether to use cache (controlled by user toggle)
   * @returns Cached value or null
   */
  get<T>(key: string, useCache: boolean = true): T | null {
    if (!useCache) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ Cache HIT: ${key}`);
    return entry.data as T;
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttlSeconds TTL in seconds (optional, uses default if not provided)
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    const expires = Date.now() + ttl;

    this.cache.set(key, {
      data,
      expires,
    });

    console.log(`💾 Cache SET: ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️  Cache DELETE: ${key}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️  Cache CLEARED');
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const serverCache = new ServerCache(3600); // 1 hour TTL

/**
 * Helper to generate cache keys
 */
export function generateCacheKey(prefix: string, params: Record<string, string | number | boolean>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');

  return `${prefix}:${sortedParams}`;
}
