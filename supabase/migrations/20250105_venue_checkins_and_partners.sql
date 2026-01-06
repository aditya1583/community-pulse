-- Migration: Venue Check-ins and Partner Venues
-- Date: 2025-01-05
-- Purpose: Support venue detail pages, check-ins, and partner venue program

-- ============================================================================
-- 1) VENUE CHECK-INS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venue_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  venue_id TEXT,
  venue_lat DOUBLE PRECISION,
  venue_lon DOUBLE PRECISION,
  city TEXT,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, venue_name, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_venue_checkins_venue_name ON public.venue_checkins(venue_name);
CREATE INDEX IF NOT EXISTS idx_venue_checkins_created_at ON public.venue_checkins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_checkins_user_id ON public.venue_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_checkins_city ON public.venue_checkins(city);

-- ============================================================================
-- 2) PARTNER VENUES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  phone TEXT,
  hours TEXT,
  website TEXT,
  foursquare_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  partner_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  qr_code_url TEXT,
  qr_scans INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_venues_city ON public.partner_venues(city);
CREATE INDEX IF NOT EXISTS idx_partner_venues_slug ON public.partner_venues(slug);
CREATE INDEX IF NOT EXISTS idx_partner_venues_is_active ON public.partner_venues(is_active);

-- ============================================================================
-- 3) RLS POLICIES
-- ============================================================================

ALTER TABLE public.venue_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read check-ins" ON public.venue_checkins;
CREATE POLICY "Public can read check-ins" ON public.venue_checkins
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can check in" ON public.venue_checkins;
CREATE POLICY "Authenticated users can check in" ON public.venue_checkins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can read partner venues" ON public.partner_venues;
CREATE POLICY "Public can read partner venues" ON public.partner_venues
  FOR SELECT USING (true);

-- ============================================================================
-- 4) GRANTS
-- ============================================================================

GRANT SELECT ON public.venue_checkins TO anon, authenticated;
GRANT INSERT ON public.venue_checkins TO authenticated;
GRANT ALL PRIVILEGES ON public.venue_checkins TO service_role;

GRANT SELECT ON public.partner_venues TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.partner_venues TO service_role;

-- ============================================================================
-- 5) FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_qr_scans(venue_slug TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.partner_venues
  SET qr_scans = qr_scans + 1, updated_at = NOW()
  WHERE slug = venue_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_qr_scans(TEXT) TO anon, authenticated;
