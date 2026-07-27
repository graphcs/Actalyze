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

interface Tweet {
  text: string;
  author: string;
  engagement: number;
  url?: string;
}

interface SeriesResponse {
  source: 'trends' | 'tweets' | 'queries' | 'unavailable';
  points?: Array<{ t: string; v: number }>;
  tweets?: Tweet[];
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
        setData({ source: 'unavailable' });
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

  // Only claim a source when there is actual data from that source to show.
  const hasTrendPoints = data.source === 'trends' && !!data.points && data.points.length > 0;
  const hasTweets = data.source === 'tweets' && !!data.tweets && data.tweets.length > 0;
  const hasQueries = data.source === 'queries' && !!data.queries && data.queries.length > 0;
  const hasData = hasTrendPoints || hasTweets || hasQueries;

  return (
    <div className="relative">
      {/* Source badge - shown only when data from that source is actually rendered */}
      {hasData && (
        <div className="absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
          {hasTrendPoints && 'Trends'}
          {hasTweets && 'Tweets'}
          {hasQueries && 'Related'}
        </div>
      )}

      {/* Render sparkline for trends */}
      {hasTrendPoints && <Sparkline points={data.points!} />}

      {/* No series available (Trends returned nothing, or the lookup failed) */}
      {(data.source === 'unavailable' || (data.source === 'trends' && !hasTrendPoints)) && (
        <div className="h-16 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
          No trend data
        </div>
      )}

      {/* Render tweets */}
      {data.source === 'tweets' && data.tweets && data.tweets.length > 0 ? (
        <div className="space-y-2 text-xs">
          {data.tweets.slice(0, 3).map((tweet, i) => (
            <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
              <div className="text-zinc-900 dark:text-zinc-100 line-clamp-2">
                {tweet.text}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>@{tweet.author}</span>
                <span>{tweet.engagement.toLocaleString()} interactions</span>
              </div>
            </div>
          ))}
        </div>
      ) : data.source === 'tweets' ? (
        <div className="h-16 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
          No tweets available
        </div>
      ) : null}

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
function Sparkline({ points }: { points: Array<{ t: string; v: number }> }) {
  if (points.length === 0) return null;

  // Take only the last 7 data points (most recent 7 weeks/days)
  const recentPoints = points.slice(-7);

  if (recentPoints.length === 0) return null;

  const width = 200;
  const height = 50;
  const padding = 2;

  // Find min/max for scaling
  const values = recentPoints.map(p => p.v);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  // Generate coordinate points
  const coords = recentPoints.map((point, index) => {
    const x = padding + (index / (recentPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.v - minValue) / range) * (height - 2 * padding);
    return { x, y };
  });

  // Generate smooth curve path using cubic bezier curves
  let pathD = `M ${coords[0].x},${coords[0].y}`;

  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];

    // Calculate control points for smooth cubic bezier curve
    // Control points are offset by 1/3 of the distance to create smooth curves
    const cp1x = current.x + (next.x - current.x) / 3;
    const cp1y = current.y + (next.y - current.y) / 3;
    const cp2x = current.x + 2 * (next.x - current.x) / 3;
    const cp2y = current.y + 2 * (next.y - current.y) / 3;

    pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
  }

  // Get date range for x-axis label
  const firstDate = new Date(recentPoints[0].t);
  const lastDate = new Date(recentPoints[recentPoints.length - 1].t);
  const formatDate = (d: Date) => {
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-1">
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

      {/* X-axis time labels */}
      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>{formatDate(firstDate)}</span>
        <span>{formatDate(lastDate)}</span>
      </div>
    </div>
  );
}
