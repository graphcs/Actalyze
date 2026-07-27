'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

interface AIPollingGaugeProps {
  estimate: string;
  margin: number;
  confidence: number;
  sampleSize: number;
  vsTraditional?: string;
  aiOnlyEstimate?: string;
  aiOnlyMargin?: number;
  traditionalMargin?: number;
  blendWeight?: number;
}

export const AIPollingGauge: React.FC<AIPollingGaugeProps> = ({
  estimate,
  margin,
  confidence,
  sampleSize,
  vsTraditional,
  aiOnlyEstimate,
  traditionalMargin,
  blendWeight,
}) => {
  // Convert margin to position on gauge (-15 to +15 range)
  const clampedMargin = Math.max(-15, Math.min(15, margin));
  const gaugePosition = ((clampedMargin + 15) / 30) * 100;

  // Is this a blended estimate?
  const isBlended = traditionalMargin !== undefined && blendWeight !== undefined && blendWeight > 0;

  // No sampled posts means the confidence figure is not derived from data.
  const hasSample = sampleSize > 0;

  // Values arrive as "<label>: D+20". Strip any leading "<label>: " so wording
  // changes upstream never leak into the gauge.
  const baselineValue = vsTraditional?.replace(/^[^:]{1,40}:\s*/, '').trim();

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
              {isBlended ? 'Model Estimate (Combined)' : 'Model Estimate'}
            </h3>
            <p className={`text-3xl font-bold mt-1 ${getMarginColor()}`}>
              {estimate}
            </p>
            {isBlended && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Weighting: {Math.round((blendWeight || 0) * 100)}% baseline estimate + {Math.round((1 - (blendWeight || 0)) * 100)}% social-signal estimate
              </p>
            )}
          </div>
          <div className="text-right">
            {hasSample ? (
              <>
                <div className="text-xs text-zinc-400">
                  {Math.round(confidence * 100)}% model confidence
                </div>
                <div className="text-xs text-zinc-400">
                  n={sampleSize} posts analysed
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-400">
                No posts analysed
              </div>
            )}
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

        {/* Component breakdown for blended estimates */}
        {isBlended && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Baseline estimate:</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {baselineValue || 'N/A'}
              </span>
            </div>
            {aiOnlyEstimate && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Social-signal estimate:</span>
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {aiOnlyEstimate}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-blended: show the baseline estimate if available */}
        {!isBlended && baselineValue && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Baseline estimate:</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {baselineValue}
              </span>
            </div>
          </div>
        )}

        {/* Methodology note */}
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {isBlended
              ? 'Model-derived estimate. Combines a baseline partisan-lean estimate generated by a language model with an AI reading of recent public posts. It is not a poll and no voters were surveyed.'
              : 'Model-derived estimate from AI classification of recent public posts. It is not a poll and no voters were surveyed. Methodology inspired by "Artificially Intelligent Opinion Polling" (Cerina & Duch, 2023).'}
            {!hasSample && ' No posts were available for this area, so no social signal contributed to this estimate.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIPollingGauge;
