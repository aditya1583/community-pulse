-- Moderation log table for tracking all blocked/held/redacted content
-- Stores NO raw content - only hashes for privacy
CREATE TABLE IF NOT EXISTS ops_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id text,                    -- hashed/anonymized user id
  content_hash text NOT NULL,      -- SHA-256 hash of content
  category text NOT NULL,          -- moderation category that triggered
  confidence_score float,          -- confidence score (0-1)
  layer text NOT NULL,             -- which layer caught it (blocklist/local/pii/ai/perspective)
  action text NOT NULL DEFAULT 'blocked', -- blocked/held/redacted
  endpoint text                    -- which API route
);

-- Index for querying by timestamp (dashboards)
CREATE INDEX idx_ops_moderation_log_timestamp ON ops_moderation_log (timestamp DESC);

-- Index for querying by category (analytics)
CREATE INDEX idx_ops_moderation_log_category ON ops_moderation_log (category);

-- Index for querying by layer (pipeline analysis)
CREATE INDEX idx_ops_moderation_log_layer ON ops_moderation_log (layer);

-- RLS: only service role can insert/read
ALTER TABLE ops_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON ops_moderation_log
  FOR ALL USING (auth.role() = 'service_role');
