/**
 * SERPAPI fetchers and normalizers for trending topics
 */

import type { TrendingTopic, SerpApiTrendingNowItem, SerpApiNewsItem } from './types';
import { scoreFromTraffic, scoreFromCounts, scoreFromCluster, normalizeTopic } from './score';

const SERPAPI_BASE = 'https://serpapi.com/search';

/**
 * Fetch trending topics from Google Trends Trending Now
 */
export async function fetchTrendingNow(apiKey: string): Promise<TrendingTopic[]> {
  const url = new URL(SERPAPI_BASE);
  url.searchParams.set('engine', 'google_trends_trending_now');
  url.searchParams.set('geo', 'US');
  url.searchParams.set('api_key', apiKey);

  console.log('🔍 Fetching from SERPAPI Trending Now...');

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`SERPAPI Trending Now failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items = data.trending_searches || [];

    console.log(`✓ Got ${items.length} trending items from SERPAPI`);

    // Filter for Politics category and normalize
    const politicsItems = items.filter((item: SerpApiTrendingNowItem) =>
      item.category?.toLowerCase() === 'politics'
    );

    console.log(`✓ Filtered to ${politicsItems.length} politics items`);

    return politicsItems.map((item: SerpApiTrendingNowItem) =>
      normalizeTrendingNowItem(item)
    );
  } catch (error) {
    console.error('Error fetching Trending Now:', error);
    return [];
  }
}

/**
 * Normalize a Trending Now item to TrendingTopic
 */
function normalizeTrendingNowItem(item: SerpApiTrendingNowItem): TrendingTopic {
  const topic = (item.title || '').trim();

  // Gather examples from queries and articles
  const examples: string[] = [];

  if (item.queries) {
    item.queries.slice(0, 2).forEach(q => {
      if (q.query) examples.push(q.query);
    });
  }

  if (item.articles && examples.length < 3) {
    item.articles.slice(0, 3 - examples.length).forEach(a => {
      if (a.title) examples.push(a.title);
    });
  }

  // Calculate score
  const articleCount = item.articles?.length || 0;
  const queryCount = item.queries?.length || 0;

  let score: number;
  if (item.traffic) {
    score = scoreFromTraffic(item.traffic);
  } else {
    score = scoreFromCounts(articleCount, queryCount);
  }

  return {
    topic,
    score,
    examples: examples.slice(0, 3),
    source: 'trends_now',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch trending topics from Google News (fallback)
 */
export async function fetchGoogleNews(apiKey: string): Promise<TrendingTopic[]> {
  const url = new URL(SERPAPI_BASE);
  url.searchParams.set('engine', 'google_news');
  url.searchParams.set('gl', 'us');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('num', '100');
  url.searchParams.set('q', '(congress OR election OR senate OR house OR "white house" OR scotus OR governor OR policy OR "attorney general")');
  url.searchParams.set('api_key', apiKey);

  console.log('🔍 Fetching from SERPAPI Google News fallback...');

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`SERPAPI Google News failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items: SerpApiNewsItem[] = data.news_results || [];

    console.log(`✓ Got ${items.length} news items from SERPAPI`);

    // Cluster by normalized headline
    const clusters = clusterNewsByTopic(items);

    console.log(`✓ Clustered into ${clusters.length} topics`);

    return clusters.map(cluster => normalizeNewsCluster(cluster));
  } catch (error) {
    console.error('Error fetching Google News:', error);
    return [];
  }
}

/**
 * Cluster news items by topic using simple token-based similarity
 */
function clusterNewsByTopic(items: SerpApiNewsItem[]): SerpApiNewsItem[][] {
  const clusters: SerpApiNewsItem[][] = [];

  for (const item of items) {
    if (!item.title) continue;

    const normalizedTitle = normalizeTopic(item.title);
    const tokens = normalizedTitle.split(' ').filter(t => t.length > 3);

    // Find existing cluster with similar tokens
    let foundCluster = false;
    for (const cluster of clusters) {
      const clusterTitle = normalizeTopic(cluster[0].title || '');
      const clusterTokens = clusterTitle.split(' ').filter(t => t.length > 3);

      // Jaccard similarity: intersection / union
      const intersection = tokens.filter(t => clusterTokens.includes(t)).length;
      const union = new Set([...tokens, ...clusterTokens]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity > 0.3) { // 30% similarity threshold
        cluster.push(item);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push([item]);
    }
  }

  // Sort clusters by size, return top clusters
  return clusters
    .sort((a, b) => b.length - a.length)
    .slice(0, 20);
}

/**
 * Normalize a news cluster to TrendingTopic
 */
function normalizeNewsCluster(cluster: SerpApiNewsItem[]): TrendingTopic {
  // Topic = most common 2-5 tokens from the cluster
  const allTitles = cluster.map(item => item.title || '').join(' ');
  const tokens = normalizeTopic(allTitles)
    .split(' ')
    .filter(t => t.length > 3);

  // Count token frequency
  const tokenCounts = new Map<string, number>();
  tokens.forEach(token => {
    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  });

  // Get top 3 tokens as topic
  const topTokens = Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([token]) => token);

  const topic = topTokens.join(' ');

  // Examples = top 3 headlines
  const examples = cluster
    .slice(0, 3)
    .map(item => item.title || '')
    .filter(Boolean);

  // Score based on cluster size and recency
  const now = Date.now();
  const recencyHours = cluster.map(item => {
    if (!item.date) return 24; // default 24 hours if no date
    const date = new Date(item.date);
    return (now - date.getTime()) / (1000 * 60 * 60);
  });
  const avgRecency = recencyHours.reduce((a, b) => a + b, 0) / recencyHours.length;

  const score = scoreFromCluster(cluster.length, avgRecency);

  return {
    topic,
    score,
    examples,
    source: 'news',
    fetchedAt: new Date().toISOString(),
  };
}
