-- Content Moderation Log Table
-- Tracks all moderation decisions for audit, analytics, and review workflows.
-- Run this migration against your Supabase project.

CREATE TABLE IF NOT EXISTS ops_moderation_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id text,  -- hashed user ID (privacy-safe, not a direct FK)
  content_hash text NOT NULL,
  category text NOT NULL,
  confidence_score float,
  action text NOT NULL CHECK (action IN ('blocked', 'held_for_review', 'auto_redacted', 'allowed')),
  source text NOT NULL CHECK (source IN ('openai_api', 'regex_layer', 'manual', 'blocklist', 'local', 'pii', 'ai', 'perspective')),
  layer text,  -- which pipeline layer triggered (blocklist, local, pii, ai, perspective)
  endpoint text,  -- which API endpoint (/api/pulses, /api/pulses/[id]/comments, etc.)
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mod_log_user ON ops_moderation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_log_category ON ops_moderation_log(category);
CREATE INDEX IF NOT EXISTS idx_mod_log_created ON ops_moderation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_mod_log_action ON ops_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_mod_log_source ON ops_moderation_log(source);

-- RLS: Only service role can read/write (no user access)
ALTER TABLE ops_moderation_log ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can access (which is what we want)
COMMENT ON TABLE ops_moderation_log IS 'Content moderation audit log. Privacy-safe: stores hashed user IDs and content hashes only.';
