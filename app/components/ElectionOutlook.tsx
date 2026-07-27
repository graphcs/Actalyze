'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';

type Rating = 'Safe D' | 'Likely D' | 'Lean D' | 'Toss-up' | 'Lean R' | 'Likely R' | 'Safe R';

interface ElectionOutlookProps {
  rating: Rating;
  confidence: number;
  keyFactors: string[];
  /**
   * Number of posts behind the estimate. When 0 the upstream confidence is a
   * fixed placeholder, so showing it would present a confident-looking number
   * derived from no data.
   */
  sampleSize?: number;
}

export const ElectionOutlook: React.FC<ElectionOutlookProps> = ({
  rating,
  confidence,
  keyFactors,
  sampleSize,
}) => {
  const hasSample = sampleSize === undefined || sampleSize > 0;
  const getRatingStyles = (rating: Rating) => {
    switch (rating) {
      case 'Safe D':
        return {
          bg: 'bg-blue-600',
          text: 'text-white',
          border: 'border-blue-600',
          light: 'bg-blue-100 dark:bg-blue-900/30',
        };
      case 'Likely D':
        return {
          bg: 'bg-blue-500',
          text: 'text-white',
          border: 'border-blue-500',
          light: 'bg-blue-50 dark:bg-blue-900/20',
        };
      case 'Lean D':
        return {
          bg: 'bg-blue-400',
          text: 'text-white',
          border: 'border-blue-400',
          light: 'bg-blue-50 dark:bg-blue-900/10',
        };
      case 'Toss-up':
        return {
          bg: 'bg-purple-500',
          text: 'text-white',
          border: 'border-purple-500',
          light: 'bg-purple-50 dark:bg-purple-900/20',
        };
      case 'Lean R':
        return {
          bg: 'bg-red-400',
          text: 'text-white',
          border: 'border-red-400',
          light: 'bg-red-50 dark:bg-red-900/10',
        };
      case 'Likely R':
        return {
          bg: 'bg-red-500',
          text: 'text-white',
          border: 'border-red-500',
          light: 'bg-red-50 dark:bg-red-900/20',
        };
      case 'Safe R':
        return {
          bg: 'bg-red-600',
          text: 'text-white',
          border: 'border-red-600',
          light: 'bg-red-100 dark:bg-red-900/30',
        };
      default:
        return {
          bg: 'bg-zinc-500',
          text: 'text-white',
          border: 'border-zinc-500',
          light: 'bg-zinc-50 dark:bg-zinc-900/20',
        };
    }
  };

  const styles = getRatingStyles(rating);

  // Rating scale positions
  const ratings: Rating[] = ['Safe D', 'Likely D', 'Lean D', 'Toss-up', 'Lean R', 'Likely R', 'Safe R'];
  const currentIndex = ratings.indexOf(rating);

  return (
    <Card className={`overflow-hidden border-2 ${styles.border}`}>
      <CardHeader className={`${styles.light} pb-3`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Election Outlook
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1.5 rounded-lg font-bold text-lg ${styles.bg} ${styles.text}`}>
                {rating}
              </span>
            </div>
          </div>
          <div className="text-right">
            {hasSample ? (
              <>
                <div className="text-2xl font-bold text-zinc-700 dark:text-zinc-200">
                  {Math.round(confidence * 100)}%
                </div>
                <div className="text-xs text-zinc-400">confidence</div>
              </>
            ) : (
              <div className="text-xs text-zinc-400 max-w-[9rem]">
                No posts analysed
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Rating scale */}
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            {ratings.map((r, i) => (
              <div
                key={r}
                className={`w-8 h-2 rounded-full transition-all ${
                  i === currentIndex
                    ? `${styles.bg} scale-125`
                    : i < 3
                    ? 'bg-blue-200 dark:bg-blue-800'
                    : i === 3
                    ? 'bg-purple-200 dark:bg-purple-800'
                    : 'bg-red-200 dark:bg-red-800'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
            <span>Safe D</span>
            <span>Toss-up</span>
            <span>Safe R</span>
          </div>
        </div>

        {/* Key factors */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Key Factors
          </h4>
          <ul className="space-y-1.5">
            {keyFactors.map((factor, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-zinc-400 mt-0.5">•</span>
                <span className="text-zinc-600 dark:text-zinc-300">{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            AI-generated forecast based on social media sentiment analysis.
            This is not a scientific poll and should not be used for decision-making.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElectionOutlook;
