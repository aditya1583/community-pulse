-- =====================================================
-- VENUE VIBE CHECK SYSTEM
-- =====================================================
-- Real-time crowd-sourced venue atmosphere data
-- This is hyper-local intelligence that Google doesn't have
-- =====================================================

-- Vibe check submissions
CREATE TABLE IF NOT EXISTS venue_vibes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Venue identification (using Yelp business ID or composite key)
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    venue_lat DECIMAL(10, 7),
    venue_lon DECIMAL(10, 7),

    -- The vibe being reported
    vibe_type TEXT NOT NULL CHECK (vibe_type IN (
        'busy', 'quiet', 'moderate',           -- Crowd level
        'live_music', 'great_vibes', 'chill',  -- Atmosphere
        'long_wait', 'fast_service',           -- Service
        'worth_it', 'skip_it'                  -- Quality signals
    )),

    -- User tracking (anonymous by default, but supports auth)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_fingerprint TEXT, -- For rate limiting anonymous users

    -- Location verification (optional - proves user was actually there)
    submitted_lat DECIMAL(10, 7),
    submitted_lon DECIMAL(10, 7),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Vibes expire quickly - 4 hour lifespan
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_venue_vibes_venue_id ON venue_vibes(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_vibes_expires_at ON venue_vibes(expires_at);
CREATE INDEX IF NOT EXISTS idx_venue_vibes_created_at ON venue_vibes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_vibes_vibe_type ON venue_vibes(vibe_type);

-- Function to get aggregated vibes for a venue
CREATE OR REPLACE FUNCTION get_venue_vibes(p_venue_id TEXT)
RETURNS TABLE (
    vibe_type TEXT,
    count BIGINT,
    latest_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vv.vibe_type,
        COUNT(*)::BIGINT as count,
        MAX(vv.created_at) as latest_at
    FROM venue_vibes vv
    WHERE vv.venue_id = p_venue_id
      AND vv.expires_at > NOW()
    GROUP BY vv.vibe_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user recently submitted a vibe for this venue
-- (Rate limiting: 1 vibe per venue per 30 minutes per user/device)
CREATE OR REPLACE FUNCTION can_submit_venue_vibe(
    p_venue_id TEXT,
    p_user_id UUID DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    recent_count INT;
BEGIN
    SELECT COUNT(*) INTO recent_count
    FROM venue_vibes
    WHERE venue_id = p_venue_id
      AND created_at > NOW() - INTERVAL '30 minutes'
      AND (
          (p_user_id IS NOT NULL AND user_id = p_user_id)
          OR
          (p_device_fingerprint IS NOT NULL AND device_fingerprint = p_device_fingerprint)
      );

    RETURN recent_count = 0;
END;
$$ LANGUAGE plpgsql;

-- View for current (non-expired) vibes with aggregation
CREATE OR REPLACE VIEW current_venue_vibes AS
SELECT
    venue_id,
    venue_name,
    vibe_type,
    COUNT(*) as vibe_count,
    MAX(created_at) as latest_at,
    MIN(expires_at) as first_expires_at
FROM venue_vibes
WHERE expires_at > NOW()
GROUP BY venue_id, venue_name, vibe_type;

-- Enable RLS
ALTER TABLE venue_vibes ENABLE ROW LEVEL SECURITY;

-- Anyone can read vibes
CREATE POLICY "Anyone can read venue vibes"
    ON venue_vibes FOR SELECT
    USING (true);

-- Anyone can submit vibes (rate limited via function)
CREATE POLICY "Anyone can submit venue vibes"
    ON venue_vibes FOR INSERT
    WITH CHECK (true);

-- Only delete your own vibes
CREATE POLICY "Users can delete own vibes"
    ON venue_vibes FOR DELETE
    USING (auth.uid() = user_id);

-- Cleanup function to remove expired vibes (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_venue_vibes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM venue_vibes WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT ON venue_vibes TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
