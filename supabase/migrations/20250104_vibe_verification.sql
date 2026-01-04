-- =====================================================
-- VIBE VERIFICATION & TRUST SYSTEM
-- =====================================================
-- "The Waze for Lifestyle" - gamification through verification
-- Users confirm or contradict existing vibes, building reputation
-- =====================================================

-- User trust scores - tracks reputation per city
CREATE TABLE IF NOT EXISTS user_trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    city TEXT NOT NULL,

    -- Trust metrics
    total_vibes_submitted INT DEFAULT 0,
    vibes_confirmed INT DEFAULT 0,           -- Others confirmed your vibes
    vibes_contradicted INT DEFAULT 0,        -- Others contradicted your vibes
    confirmations_given INT DEFAULT 0,       -- You confirmed others' vibes
    contradictions_given INT DEFAULT 0,      -- You contradicted others' vibes
    confirmation_accuracy DECIMAL(5, 2),     -- % of your confirmations that match majority

    -- Calculated trust score (0-100)
    trust_score INT DEFAULT 50,

    -- Badges earned (stored as JSON array)
    badges JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one trust profile per user per city
    UNIQUE(user_id, city)
);

-- Vibe confirmations - tracks when users verify others' reports
CREATE TABLE IF NOT EXISTS vibe_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The vibe being confirmed/contradicted
    vibe_id UUID NOT NULL REFERENCES venue_vibes(id) ON DELETE CASCADE,
    venue_id TEXT NOT NULL,
    original_vibe_type TEXT NOT NULL,

    -- Who is confirming
    confirmer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The confirmation action
    action TEXT NOT NULL CHECK (action IN ('confirm', 'contradict', 'update')),
    -- If contradicting, what's the actual vibe?
    updated_vibe_type TEXT,

    -- Location verification (optional)
    confirmer_lat DECIMAL(10, 7),
    confirmer_lon DECIMAL(10, 7),

    -- City for filtering
    city TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Rate limiting: one confirmation per vibe per user
    UNIQUE(vibe_id, confirmer_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_trust_scores_user_id ON user_trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trust_scores_city ON user_trust_scores(city);
CREATE INDEX IF NOT EXISTS idx_user_trust_scores_trust_score ON user_trust_scores(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_vibe_confirmations_vibe_id ON vibe_confirmations(vibe_id);
CREATE INDEX IF NOT EXISTS idx_vibe_confirmations_venue_id ON vibe_confirmations(venue_id);
CREATE INDEX IF NOT EXISTS idx_vibe_confirmations_confirmer ON vibe_confirmations(confirmer_user_id);

-- Function to get a user's trust badge based on score
CREATE OR REPLACE FUNCTION get_trust_badge(p_trust_score INT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        WHEN p_trust_score >= 90 THEN 'local_hero'
        WHEN p_trust_score >= 75 THEN 'trusted_local'
        WHEN p_trust_score >= 60 THEN 'regular'
        WHEN p_trust_score >= 40 THEN 'newcomer'
        ELSE 'learning'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to record a confirmation and update trust scores
CREATE OR REPLACE FUNCTION record_vibe_confirmation(
    p_vibe_id UUID,
    p_confirmer_user_id UUID,
    p_action TEXT,
    p_updated_vibe_type TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_vibe RECORD;
    v_original_user_id UUID;
    v_confirmation_id UUID;
    v_confirmer_trust INT;
    v_original_trust INT;
BEGIN
    -- Get the original vibe
    SELECT * INTO v_vibe FROM venue_vibes WHERE id = p_vibe_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vibe not found');
    END IF;

    -- Can't confirm your own vibe
    IF v_vibe.user_id = p_confirmer_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm your own vibe');
    END IF;

    v_original_user_id := v_vibe.user_id;

    -- Insert confirmation
    INSERT INTO vibe_confirmations (
        vibe_id, venue_id, original_vibe_type,
        confirmer_user_id, action, updated_vibe_type, city
    ) VALUES (
        p_vibe_id, v_vibe.venue_id, v_vibe.vibe_type,
        p_confirmer_user_id, p_action, p_updated_vibe_type, p_city
    )
    ON CONFLICT (vibe_id, confirmer_user_id) DO UPDATE SET
        action = p_action,
        updated_vibe_type = p_updated_vibe_type,
        created_at = NOW()
    RETURNING id INTO v_confirmation_id;

    -- Update confirmer's trust scores
    INSERT INTO user_trust_scores (user_id, city, confirmations_given, contradictions_given)
    VALUES (
        p_confirmer_user_id,
        COALESCE(p_city, 'Unknown'),
        CASE WHEN p_action = 'confirm' THEN 1 ELSE 0 END,
        CASE WHEN p_action = 'contradict' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, city) DO UPDATE SET
        confirmations_given = user_trust_scores.confirmations_given +
            CASE WHEN p_action = 'confirm' THEN 1 ELSE 0 END,
        contradictions_given = user_trust_scores.contradictions_given +
            CASE WHEN p_action = 'contradict' THEN 1 ELSE 0 END,
        updated_at = NOW();

    -- Update original vibe author's trust scores (if they have a user_id)
    IF v_original_user_id IS NOT NULL THEN
        INSERT INTO user_trust_scores (user_id, city, vibes_confirmed, vibes_contradicted)
        VALUES (
            v_original_user_id,
            COALESCE(p_city, 'Unknown'),
            CASE WHEN p_action = 'confirm' THEN 1 ELSE 0 END,
            CASE WHEN p_action = 'contradict' THEN 1 ELSE 0 END
        )
        ON CONFLICT (user_id, city) DO UPDATE SET
            vibes_confirmed = user_trust_scores.vibes_confirmed +
                CASE WHEN p_action = 'confirm' THEN 1 ELSE 0 END,
            vibes_contradicted = user_trust_scores.vibes_contradicted +
                CASE WHEN p_action = 'contradict' THEN 1 ELSE 0 END,
            updated_at = NOW();

        -- Recalculate original author's trust score
        UPDATE user_trust_scores
        SET trust_score = LEAST(100, GREATEST(0,
            50 + (vibes_confirmed * 2) - (vibes_contradicted * 3) +
            (total_vibes_submitted / 10)
        ))
        WHERE user_id = v_original_user_id AND city = COALESCE(p_city, 'Unknown');

        SELECT trust_score INTO v_original_trust FROM user_trust_scores
        WHERE user_id = v_original_user_id AND city = COALESCE(p_city, 'Unknown');
    END IF;

    -- Get confirmer's updated trust score
    SELECT trust_score INTO v_confirmer_trust FROM user_trust_scores
    WHERE user_id = p_confirmer_user_id AND city = COALESCE(p_city, 'Unknown');

    RETURN jsonb_build_object(
        'success', true,
        'confirmationId', v_confirmation_id,
        'confirmerTrustScore', v_confirmer_trust,
        'originalAuthorTrustScore', v_original_trust
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get confirmation stats for a vibe
CREATE OR REPLACE FUNCTION get_vibe_confirmations(p_vibe_id UUID)
RETURNS TABLE (
    confirms BIGINT,
    contradicts BIGINT,
    majority_action TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE action = 'confirm') as confirms,
        COUNT(*) FILTER (WHERE action = 'contradict') as contradicts,
        CASE
            WHEN COUNT(*) FILTER (WHERE action = 'confirm') > COUNT(*) FILTER (WHERE action = 'contradict')
            THEN 'confirm'
            WHEN COUNT(*) FILTER (WHERE action = 'contradict') > COUNT(*) FILTER (WHERE action = 'confirm')
            THEN 'contradict'
            ELSE 'split'
        END as majority_action
    FROM vibe_confirmations
    WHERE vibe_id = p_vibe_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard for a city
CREATE OR REPLACE FUNCTION get_trust_leaderboard(p_city TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    trust_score INT,
    badge TEXT,
    total_vibes INT,
    confirmations INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uts.user_id,
        uts.trust_score,
        get_trust_badge(uts.trust_score) as badge,
        uts.total_vibes_submitted,
        uts.vibes_confirmed
    FROM user_trust_scores uts
    WHERE uts.city = p_city
    ORDER BY uts.trust_score DESC, uts.total_vibes_submitted DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- View for vibes with confirmation status
CREATE OR REPLACE VIEW venue_vibes_with_trust AS
SELECT
    vv.*,
    uts.trust_score as author_trust_score,
    get_trust_badge(COALESCE(uts.trust_score, 50)) as author_badge,
    (SELECT COUNT(*) FROM vibe_confirmations vc WHERE vc.vibe_id = vv.id AND vc.action = 'confirm') as confirm_count,
    (SELECT COUNT(*) FROM vibe_confirmations vc WHERE vc.vibe_id = vv.id AND vc.action = 'contradict') as contradict_count
FROM venue_vibes vv
LEFT JOIN user_trust_scores uts ON vv.user_id = uts.user_id AND vv.city = uts.city;

-- Enable RLS
ALTER TABLE user_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_confirmations ENABLE ROW LEVEL SECURITY;

-- Anyone can read trust scores (public leaderboard)
CREATE POLICY "Anyone can read trust scores"
    ON user_trust_scores FOR SELECT
    USING (true);

-- Users can only update their own trust scores (via function)
CREATE POLICY "Users can update own trust scores"
    ON user_trust_scores FOR UPDATE
    USING (auth.uid() = user_id);

-- Anyone can read confirmations
CREATE POLICY "Anyone can read confirmations"
    ON vibe_confirmations FOR SELECT
    USING (true);

-- Authenticated users can insert confirmations
CREATE POLICY "Authenticated users can confirm vibes"
    ON vibe_confirmations FOR INSERT
    WITH CHECK (auth.uid() = confirmer_user_id);

-- Grant permissions
GRANT SELECT ON user_trust_scores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON user_trust_scores TO authenticated;
GRANT SELECT ON vibe_confirmations TO anon, authenticated;
GRANT SELECT, INSERT ON vibe_confirmations TO authenticated;
GRANT SELECT ON venue_vibes_with_trust TO anon, authenticated;
