/**
 * Tests for SERPAPI trending topics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrendingPoliticsUS } from '../index';
import { scoreFromTraffic, scoreFromCounts, normalizeTopic } from '../score';

// Mock fetch globally
global.fetch = vi.fn();

const mockTrendingNowResponse = {
  trending_searches: [
    {
      title: 'Presidential Election 2024',
      category: 'Politics',
      traffic: '500K+',
      queries: [
        { query: 'election results' },
        { query: 'polling data' },
      ],
      articles: [
        { title: 'Election Update: Key Races', source: 'CNN' },
        { title: 'Polling Shows Tight Race', source: 'NYT' },
      ],
    },
    {
      title: 'Sports Game Tonight',
      category: 'Sports',
      traffic: '300K+',
      queries: [],
      articles: [],
    },
    {
      title: 'Congressional Hearing on AI',
      category: 'Politics',
      traffic: '100K+',
      queries: [{ query: 'senate ai hearing' }],
      articles: [{ title: 'Senate Debates AI Regulation', source: 'Reuters' }],
    },
  ],
};

const mockNewsResponse = {
  news_results: [
    {
      title: 'Senate Passes Major Infrastructure Bill',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      source: 'Washington Post',
    },
    {
      title: 'Infrastructure Bill Signed Into Law',
      date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      source: 'NYT',
    },
    {
      title: 'Governor Announces New Policy',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      source: 'Local News',
    },
  ],
};

describe('Trending Topics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SERPAPI_KEY = 'test_key';
  });

  it('should fetch and filter politics items from Trending Now', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTrendingNowResponse,
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0 });

    expect(result.length).toBe(2); // Only 2 politics items
    expect(result[0].topic).toBe('Presidential Election 2024');
    expect(result[0].source).toBe('trends_now');
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].examples.length).toBeGreaterThan(0);
  });

  it('should use fallback when no politics items present', async () => {
    // First call returns no politics items
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ trending_searches: [] }),
    });

    // Second call is the news fallback
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewsResponse,
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0, useFallback: true });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].source).toBe('news');
  });

  it('should handle missing fields gracefully', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trending_searches: [
          {
            title: 'Incomplete Item',
            category: 'Politics',
            // Missing traffic, queries, articles
          },
        ],
      }),
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0 });

    expect(result.length).toBe(1);
    expect(result[0].topic).toBe('Incomplete Item');
    expect(result[0].score).toBeGreaterThan(0); // Should have default score
  });

  it('should deduplicate topics case-insensitively', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trending_searches: [
          { title: 'Election 2024', category: 'Politics', traffic: '100K+' },
          { title: 'ELECTION 2024', category: 'Politics', traffic: '200K+' },
          { title: 'election 2024', category: 'Politics', traffic: '50K+' },
        ],
      }),
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0 });

    expect(result.length).toBe(1); // Should be deduplicated
    expect(result[0].score).toBeGreaterThan(60); // Should keep highest score
  });

  it('should sort by score descending', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trending_searches: [
          { title: 'Low Traffic', category: 'Politics', traffic: '10K+' },
          { title: 'High Traffic', category: 'Politics', traffic: '500K+' },
          { title: 'Medium Traffic', category: 'Politics', traffic: '100K+' },
        ],
      }),
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0 });

    expect(result[0].topic).toBe('High Traffic');
    expect(result[2].topic).toBe('Low Traffic');
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[1].score).toBeGreaterThan(result[2].score);
  });

  it('should respect minScore filter', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trending_searches: [
          { title: 'High Score Topic', category: 'Politics', traffic: '500K+' },
          { title: 'Low Score Topic', category: 'Politics', traffic: '1K+' },
        ],
      }),
    });

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 50 });

    expect(result.length).toBe(1);
    expect(result[0].topic).toBe('High Score Topic');
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const result = await getTrendingPoliticsUS({ maxItems: 10, minScore: 0, useFallback: false });

    expect(result).toEqual([]);
  });
});

describe('Scoring Utilities', () => {
  it('should score traffic strings correctly', () => {
    expect(scoreFromTraffic('1M+')).toBeGreaterThan(85);
    expect(scoreFromTraffic('500K+')).toBeGreaterThan(80);
    expect(scoreFromTraffic('100K+')).toBe(75);
    expect(scoreFromTraffic('50K+')).toBe(60);
    expect(scoreFromTraffic('5K+')).toBe(40);
    expect(scoreFromTraffic('500')).toBe(20);
  });

  it('should score from counts correctly', () => {
    expect(scoreFromCounts(10, 5)).toBeGreaterThan(30);
    expect(scoreFromCounts(0, 0)).toBe(30);
    expect(scoreFromCounts(100, 100)).toBeGreaterThan(50);
  });

  it('should normalize topics correctly', () => {
    expect(normalizeTopic('Election 2024')).toBe('election 2024');
    expect(normalizeTopic('  SENATE HEARING  ')).toBe('senate hearing');
    expect(normalizeTopic('Trump\'s Policy')).toBe('trumps policy');
  });
});
