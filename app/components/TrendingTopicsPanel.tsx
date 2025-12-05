'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

interface Topic {
  name: string;
  post_count: number;
  sentiment: number;
  trending_direction: 'up' | 'down' | 'stable';
}

interface TrendingTopicsPanelProps {
  topics: Topic[];
  onTopicClick?: (topicName: string) => void;
}

export const TrendingTopicsPanel: React.FC<TrendingTopicsPanelProps> = ({ topics, onTopicClick }) => {
  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'bg-green-500';
    if (sentiment < -0.3) return 'bg-red-500';
    return 'bg-amber-500';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.3) return 'Positive';
    if (sentiment < -0.3) return 'Negative';
    return 'Mixed';
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return (
          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        );
      default:
        return (
          <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
    }
  };

  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Trending Topics
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">No trending topics detected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Trending Topics
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          What people are discussing in this district
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          {topics.map((topic, index) => (
            <button
              key={topic.name}
              onClick={() => onTopicClick?.(topic.name)}
              className={`relative w-full text-left rounded-lg p-2 -m-2 transition-colors ${
                onTopicClick ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer' : ''
              }`}
              disabled={!onTopicClick}
            >
              {/* Topic row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-4">{index + 1}.</span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 capitalize">
                    {topic.name}
                  </span>
                  {getTrendIcon(topic.trending_direction)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {topic.post_count} posts
                  </span>
                  {onTopicClick && (
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  {/* Center line for neutral */}
                  <div className="relative h-full">
                    {/* Fill based on sentiment */}
                    {topic.sentiment >= 0 ? (
                      <div
                        className="absolute left-1/2 h-full bg-green-500 rounded-r-full transition-all duration-300"
                        style={{ width: `${Math.abs(topic.sentiment) * 50}%` }}
                      />
                    ) : (
                      <div
                        className="absolute right-1/2 h-full bg-red-500 rounded-l-full transition-all duration-300"
                        style={{ width: `${Math.abs(topic.sentiment) * 50}%` }}
                      />
                    )}
                    {/* Center marker */}
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-zinc-300 dark:bg-zinc-600 transform -translate-x-1/2" />
                  </div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getSentimentColor(topic.sentiment)} text-white`}>
                  {getSentimentLabel(topic.sentiment)}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Negative
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Mixed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Positive
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendingTopicsPanel;
