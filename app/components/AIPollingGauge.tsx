'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

interface AIPollingGaugeProps {
  estimate: string;
  margin: number;
  confidence: number;
  sampleSize: number;
  vsTraditional?: string;
}

export const AIPollingGauge: React.FC<AIPollingGaugeProps> = ({
  estimate,
  margin,
  confidence,
  sampleSize,
  vsTraditional,
}) => {
  // Convert margin to position on gauge (-15 to +15 range)
  const clampedMargin = Math.max(-15, Math.min(15, margin));
  const gaugePosition = ((clampedMargin + 15) / 30) * 100;

  // Determine color based on margin
  const getMarginColor = () => {
    if (margin < -5) return 'text-blue-600 dark:text-blue-400';
    if (margin > 5) return 'text-red-600 dark:text-red-400';
    return 'text-purple-600 dark:text-purple-400';
  };

  const getGaugeGradient = () => {
    return 'bg-gradient-to-r from-blue-500 via-purple-500 to-red-500';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              AI Polling Estimate
            </h3>
            <p className={`text-3xl font-bold mt-1 ${getMarginColor()}`}>
              {estimate}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-400">
              {Math.round(confidence * 100)}% confidence
            </div>
            <div className="text-xs text-zinc-400">
              n={sampleSize} tweets
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Gauge visualization */}
        <div className="relative mb-4">
          <div className={`h-3 rounded-full ${getGaugeGradient()} opacity-30`} />
          <div
            className="absolute top-0 w-4 h-3 bg-white dark:bg-zinc-900 border-2 border-zinc-800 dark:border-zinc-200 rounded-full transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${gaugePosition}%` }}
          />
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-xs text-zinc-500 mb-3">
          <span>D+15</span>
          <span>Even</span>
          <span>R+15</span>
        </div>

        {/* Comparison to traditional polling */}
        {vsTraditional && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">vs Traditional Polls:</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {vsTraditional}
              </span>
            </div>
          </div>
        )}

        {/* Methodology note */}
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Based on AI analysis of Twitter discussions. Methodology inspired by
            &quot;Artificially Intelligent Opinion Polling&quot; (Cerina &amp; Duch, 2023).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIPollingGauge;
