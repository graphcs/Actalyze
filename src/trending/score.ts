/**
 * Scoring utilities for trending topics
 */

/**
 * Calculate score from traffic string or number
 * Maps popularity metric into 0-100 range
 */
export function scoreFromTraffic(traffic: string | number | undefined): number {
  if (!traffic) return 50; // default mid-range score

  let numericValue: number;

  if (typeof traffic === 'string') {
    // Parse strings like "100K+", "1M+", "50K"
    const cleaned = traffic.toUpperCase().replace(/[^0-9KM.]/g, '');

    if (cleaned.includes('M')) {
      numericValue = parseFloat(cleaned) * 1_000_000;
    } else if (cleaned.includes('K')) {
      numericValue = parseFloat(cleaned) * 1_000;
    } else {
      numericValue = parseFloat(cleaned) || 0;
    }
  } else {
    numericValue = traffic;
  }

  // Logarithmic scaling to 0-100
  if (numericValue < 1000) return 20;
  if (numericValue < 10000) return 40;
  if (numericValue < 50000) return 60;
  if (numericValue < 100000) return 75;
  if (numericValue < 500000) return 85;
  return 95;
}

/**
 * Calculate score from article and query counts
 */
export function scoreFromCounts(articleCount: number, queryCount: number): number {
  const combined = articleCount * queryCount;
  if (combined === 0) return 30;

  // Heuristic: score = min(100, 20 + 10*log10(combined + 1))
  const score = Math.min(100, 20 + 10 * Math.log10(combined + 1));
  return Math.round(score);
}

/**
 * Calculate score for news clusters based on size and recency
 */
export function scoreFromCluster(clusterSize: number, avgRecencyHours: number): number {
  // Larger clusters = higher relevance
  const sizeScore = Math.min(50, clusterSize * 5);

  // Newer = higher score (decay over 48 hours)
  const recencyScore = Math.max(0, 50 - (avgRecencyHours / 48) * 50);

  return Math.min(100, Math.round(sizeScore + recencyScore));
}

/**
 * Normalize a topic string for comparison
 */
export function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
    .replace(/\s+/g, ' ');
}
