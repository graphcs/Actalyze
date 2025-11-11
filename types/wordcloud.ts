/**
 * Type definitions for Word Cloud Analytics Module
 */

export interface WordCloudWord {
  text: string;
  value: number; // frequency count
  sentiment: number; // -1 to 1
  metadata: WordMetadata;
}

export interface WordMetadata {
  tweetIds: string[];
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  topTweet?: {
    id: string;
    text: string;
    author: string;
    username: string;
    engagement: number;
  };
}

export interface WordCloudFilters {
  topic: string;
  timeRange: '24h' | '7d' | '30d';
  location?: 'national' | string; // state code or 'national'
  sentimentType?: 'all' | 'positive' | 'negative' | 'neutral';
  minFrequency?: number;
}

export interface WordCloudData {
  words: WordCloudWord[];
  metadata: {
    topic: string;
    filters: WordCloudFilters;
    totalTweets: number;
    processedAt: string; // ISO timestamp
    uniqueWords: number;
  };
}

export interface WordAnalytics {
  word: string;
  totalOccurrences: number;
  sentiment: {
    average: number;
    distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  topTweets: Array<{
    id: string;
    text: string;
    author: string;
    username: string;
    url: string;
    created_at: string;
    engagement: number;
    sentiment: number;
  }>;
  relatedWords: Array<{
    word: string;
    coOccurrence: number;
  }>;
  timeSeriesData: Array<{
    timestamp: string;
    count: number;
  }>;
  context: {
    topic: string;
    timeRange: string;
    location?: string;
  };
}

export interface ProcessedText {
  words: string[];
  originalText: string;
  tweetId: string;
  sentiment: number;
  timestamp: string;
}
