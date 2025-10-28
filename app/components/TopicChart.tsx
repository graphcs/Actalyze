/**
 * TopicChart Component
 *
 * Displays a chart or related queries for a trending topic.
 *
 * Fallback order:
 * 1. Google Trends timeseries (sparkline, last 7 days)
 * 2. Google News velocity (sparkline, hourly counts last 36h)
 * 3. Related queries (bullet list of 5 related searches)
 *
 * Fetches data from /api/trending/series?topic=... on mount.
 */

'use client';

import { useEffect, useState } from 'react';

interface TopicChartProps {
  topic: string;
}

interface SeriesResponse {
  source: 'trends' | 'news' | 'queries';
  points?: Array<{ t: string; v: number }>;
  queries?: string[];
}

export default function TopicChart({ topic }: TopicChartProps) {
  const [data, setData] = useState<SeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/trending/series?topic=${encodeURIComponent(topic)}`);
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching series:', error);
        setData({ source: 'queries', queries: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [topic]);

  if (loading) {
    return (
      <div className="h-16 flex items-center justify-center">
        <div className="text-xs text-zinc-400 dark:text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="relative">
      {/* Source badge */}
      <div className="absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
        {data.source === 'trends' && 'Trends'}
        {data.source === 'news' && 'News'}
        {data.source === 'queries' && 'Related'}
      </div>

      {/* Render sparkline for trends or news */}
      {(data.source === 'trends' || data.source === 'news') && data.points && data.points.length > 0 && (
        <Sparkline points={data.points} source={data.source} />
      )}

      {/* Render related queries list */}
      {data.source === 'queries' && data.queries && data.queries.length > 0 && (
        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
          {data.queries.map((query, i) => (
            <div key={i} className="flex items-start">
              <span className="mr-1.5 text-zinc-400">•</span>
              <span className="line-clamp-1">{query}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {data.source === 'queries' && (!data.queries || data.queries.length === 0) && (
        <div className="h-16 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
          No data available
        </div>
      )}
    </div>
  );
}

/**
 * Simple SVG sparkline component with axis labels
 */
function Sparkline({ points, source }: { points: Array<{ t: string; v: number }>; source: 'trends' | 'news' }) {
  if (points.length === 0) return null;

  const width = 200;
  const height = 50;
  const padding = 2;

  // Find min/max for scaling
  const values = points.map(p => p.v);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  // Generate path
  const pathPoints = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.v - minValue) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${pathPoints.join(' L ')}`;

  // Get date range for x-axis label
  const firstDate = new Date(points[0].t);
  const lastDate = new Date(points[points.length - 1].t);
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Y-axis label based on source
  const yAxisLabel = source === 'trends' ? 'Search Interest (0-100)' : 'Articles per Hour';

  return (
    <div className="space-y-1">
      {/* Y-axis label */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {yAxisLabel}
      </div>

      {/* SVG Chart */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-14"
        preserveAspectRatio="none"
      >
        {/* Area fill */}
        <path
          d={`${pathD} L ${width - padding},${height} L ${padding},${height} Z`}
          fill="currentColor"
          className="text-blue-100 dark:text-blue-900/30"
          opacity="0.3"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-500 dark:text-blue-400"
        />
      </svg>

      {/* X-axis labels and value range */}
      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>{formatDate(firstDate)}</span>
        <span className="text-zinc-400 dark:text-zinc-500">
          {minValue === maxValue ? maxValue : `${Math.round(minValue)}-${Math.round(maxValue)}`}
        </span>
        <span>{formatDate(lastDate)}</span>
      </div>
    </div>
  );
}
