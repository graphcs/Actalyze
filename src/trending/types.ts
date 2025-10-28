export type TrendingTopic = {
  topic: string;                 // canonical topic string
  score: number;                 // 0–100 scaled score
  examples: string[];            // example headlines or queries (1–3)
  source: 'trends_now' | 'news'; // which feed produced it
  fetchedAt: string;             // ISO timestamp
};

export type SerpApiTrendingNowItem = {
  title?: string;
  queries?: Array<{ query?: string }>;
  articles?: Array<{ title?: string; source?: string }>;
  category?: string;
  traffic?: string | number;
};

export type SerpApiNewsItem = {
  title?: string;
  link?: string;
  source?: string;
  date?: string;
  snippet?: string;
};

export type GetTrendingOptions = {
  maxItems?: number;        // overrides TREND_MAX_ITEMS
  minScore?: number;        // overrides TREND_MIN_SCORE
  useFallback?: boolean;    // default true
};
