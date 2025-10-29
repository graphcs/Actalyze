/**
 * Fetch wrapper that includes cache preference header
 * Reads from localStorage to determine if caching should be used
 */

export async function fetchWithCache(url: string, options?: RequestInit): Promise<Response> {
  // Check localStorage for cache preference (default: true)
  let useCache = true;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cacheEnabled');
    useCache = saved !== 'false';
  }

  // Add x-use-cache header
  const headers = new Headers(options?.headers);
  headers.set('x-use-cache', String(useCache));

  return fetch(url, {
    ...options,
    headers,
  });
}
