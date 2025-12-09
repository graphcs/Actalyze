-- District Data Cache Table
-- Used to persist cached API responses in the database for instant loading

CREATE TABLE IF NOT EXISTS district_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL, -- 'news', 'summary', 'polling', 'perspectives', 'tweets', 'ai-intel'
  district_code TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for fast lookups by cache key
CREATE INDEX IF NOT EXISTS idx_district_cache_key ON district_cache(cache_key);

-- Index for finding expired entries
CREATE INDEX IF NOT EXISTS idx_district_cache_expires ON district_cache(expires_at);

-- Index for district-specific queries
CREATE INDEX IF NOT EXISTS idx_district_cache_district ON district_cache(district_code);

-- Function to clean up expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM district_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for simplicity (or add policies if needed)
ALTER TABLE district_cache DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Tweet Cache Table
-- Stores tweets to reduce Twitter API calls
-- =====================================================

CREATE TABLE IF NOT EXISTS tweet_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_data JSONB NOT NULL,
  search_query TEXT NOT NULL,
  district_code TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by tweet ID (for deduplication)
CREATE INDEX IF NOT EXISTS idx_tweet_cache_tweet_id ON tweet_cache(tweet_id);

-- Index for finding tweets by district
CREATE INDEX IF NOT EXISTS idx_tweet_cache_district ON tweet_cache(district_code);

-- Index for finding recent tweets
CREATE INDEX IF NOT EXISTS idx_tweet_cache_fetched_at ON tweet_cache(fetched_at);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_tweet_cache_district_time ON tweet_cache(district_code, fetched_at);

-- Disable RLS
ALTER TABLE tweet_cache DISABLE ROW LEVEL SECURITY;
