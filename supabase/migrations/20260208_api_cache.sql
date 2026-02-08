-- API Response Cache Table
-- Stores cached responses from external APIs (weather, traffic, events)
-- to avoid re-fetching during Vercel function execution.
-- Cache entries expire and are refreshed by cron.

CREATE TABLE IF NOT EXISTS api_cache (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,         -- e.g. "weather:30.5788:-97.8531" or "events:Leander"
  category TEXT NOT NULL,                  -- "weather", "traffic", "events", "farmers_markets"
  city TEXT NOT NULL,                      -- city name for easy lookup
  data JSONB NOT NULL,                     -- cached API response
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_city ON api_cache (city);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache (expires_at);

-- Auto-cleanup: delete expired entries (can be called by cron or on read)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
