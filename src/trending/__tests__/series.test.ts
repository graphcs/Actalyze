/**
 * Tests for SERPAPI series data fetchers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTrendsSeries, fetchNewsVelocity, fetchRelatedQueries } from '../series';

// Mock fetch globally
global.fetch = vi.fn();

const mockTrendsSeriesResponse = {
  interest_over_time: {
    timeline_data: [
      {
        date: '2025-10-21T00:00:00Z',
        values: [{ extracted_value: 50 }],
      },
      {
        date: '2025-10-22T00:00:00Z',
        values: [{ extracted_value: 65 }],
      },
      {
        date: '2025-10-23T00:00:00Z',
        values: [{ extracted_value: 80 }],
      },
      {
        date: '2025-10-24T00:00:00Z',
        values: [{ extracted_value: 75 }],
      },
      {
        date: '2025-10-25T00:00:00Z',
        values: [{ extracted_value: 90 }],
      },
      {
        date: '2025-10-26T00:00:00Z',
        values: [{ extracted_value: 95 }],
      },
    ],
  },
};

const mockNewsResponse = {
  news_results: [
    {
      title: 'Breaking news about topic',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      title: 'Another news article',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'Third article',
      date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    },
    {
      title: 'Fourth article',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    },
  ],
};

const mockRelatedQueriesResponse = {
  related_queries: {
    rising: [
      { query: 'related search 1' },
      { query: 'related search 2' },
    ],
    top: [
      { query: 'top search 1' },
      { query: 'top search 2' },
      { query: 'top search 3' },
    ],
  },
};

describe('Series Fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SERPAPI_KEY = 'test_key';
  });

  describe('fetchTrendsSeries', () => {
    it('should fetch and parse trends series data', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrendsSeriesResponse,
      });

      const result = await fetchTrendsSeries('test topic');

      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThanOrEqual(5);
      expect(result?.[0]).toHaveProperty('t');
      expect(result?.[0]).toHaveProperty('v');
      expect(result?.[0].v).toBe(50);
    });

    it('should return null if too few points', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interest_over_time: {
            timeline_data: [
              { date: '2025-10-26T00:00:00Z', values: [{ extracted_value: 50 }] },
            ],
          },
        }),
      });

      const result = await fetchTrendsSeries('test topic');

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await fetchTrendsSeries('test topic');

      expect(result).toBeNull();
    });
  });

  describe('fetchNewsVelocity', () => {
    it('should bucket news by hour', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewsResponse,
      });

      const result = await fetchNewsVelocity('test topic');

      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThanOrEqual(2);
      expect(result?.[0]).toHaveProperty('t');
      expect(result?.[0]).toHaveProperty('v');
    });

    it('should return null if too sparse', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          news_results: [
            { title: 'Single article', date: new Date().toISOString() },
          ],
        }),
      });

      const result = await fetchNewsVelocity('test topic');

      expect(result).toBeNull();
    });

    it('should handle missing dates', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          news_results: [
            { title: 'Article without date' },
            { title: 'Another without date' },
          ],
        }),
      });

      const result = await fetchNewsVelocity('test topic');

      expect(result).toBeNull();
    });
  });

  describe('fetchRelatedQueries', () => {
    it('should fetch related queries', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRelatedQueriesResponse,
      });

      const result = await fetchRelatedQueries('test topic');

      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThan(0);
      expect(result?.length).toBeLessThanOrEqual(5);
      expect(result?.[0]).toBe('related search 1');
    });

    it('should combine rising and top queries', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          related_queries: {
            rising: [{ query: 'rising 1' }],
            top: [{ query: 'top 1' }, { query: 'top 2' }],
          },
        }),
      });

      const result = await fetchRelatedQueries('test topic');

      expect(result).not.toBeNull();
      expect(result).toContain('rising 1');
      expect(result).toContain('top 1');
    });

    it('should return null if no queries found', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          related_queries: {},
        }),
      });

      const result = await fetchRelatedQueries('test topic');

      expect(result).toBeNull();
    });
  });

  describe('Caching', () => {
    it('should cache results and return cached data on second call', async () => {
      const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrendsSeriesResponse,
      });

      // First call
      const result1 = await fetchTrendsSeries('test topic');
      expect(result1).not.toBeNull();

      // Second call should use cache (no new fetch)
      const result2 = await fetchTrendsSeries('test topic');
      expect(result2).not.toBeNull();
      expect(result2).toEqual(result1);

      // Should only have called fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
