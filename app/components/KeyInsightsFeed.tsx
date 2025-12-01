'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

interface Insight {
  text: string;
  type: 'pattern' | 'shift' | 'emerging';
  timestamp: string;
}

interface KeyInsightsFeedProps {
  insights: Insight[];
}

export const KeyInsightsFeed: React.FC<KeyInsightsFeedProps> = ({ insights }) => {
  const getTypeStyles = (type: Insight['type']) => {
    switch (type) {
      case 'pattern':
        return {
          bg: 'bg-indigo-100 dark:bg-indigo-900/30',
          text: 'text-indigo-600 dark:text-indigo-400',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          label: 'Pattern',
        };
      case 'shift':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-600 dark:text-amber-400',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          label: 'Shift',
        };
      case 'emerging':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-600 dark:text-emerald-400',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          label: 'Emerging',
        };
      default:
        return {
          bg: 'bg-zinc-100 dark:bg-zinc-800',
          text: 'text-zinc-600 dark:text-zinc-400',
          icon: null,
          label: 'Insight',
        };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Key Insights
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">No notable insights detected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Key Insights
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              AI-detected patterns and trends
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {insights.length} insights
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const styles = getTypeStyles(insight.type);
            return (
              <div
                key={index}
                className={`p-3 rounded-lg ${styles.bg} transition-all hover:scale-[1.01]`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-md bg-white dark:bg-zinc-900 ${styles.text}`}>
                    {styles.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${styles.text}`}>
                        {styles.label}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(insight.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                      {insight.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyInsightsFeed;
