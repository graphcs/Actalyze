/**
 * Fetch wrapper that includes cache preference headers
 * Reads from localStorage to determine if caching should be used and duration
 */

// Cache duration in seconds for each option
const CACHE_DURATION_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
};

export async function fetchWithCache(url: string, options?: RequestInit): Promise<Response> {
  // Check localStorage for cache preferences (default: enabled, 1h duration)
  let useCache = true;
  let cacheDuration = '1h';

  if (typeof window !== 'undefined') {
    const savedEnabled = localStorage.getItem('cacheEnabled');
    useCache = savedEnabled !== 'false';

    const savedDuration = localStorage.getItem('cacheDuration');
    if (savedDuration && CACHE_DURATION_SECONDS[savedDuration]) {
      cacheDuration = savedDuration;
    }
  }

  // Add cache headers
  const headers = new Headers(options?.headers);
  headers.set('x-use-cache', String(useCache));
  headers.set('x-cache-duration', cacheDuration);
  headers.set('x-cache-duration-seconds', String(CACHE_DURATION_SECONDS[cacheDuration] || 3600));

  return fetch(url, {
    ...options,
    headers,
  });
}
