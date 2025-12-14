-- Migration: RLS Policies and Realtime for Community Pulse MVP
-- Date: 2024-12-14
-- Purpose: Enable public read, authenticated write, delete ownership, and realtime

-- ============================================================================
-- 1. ENABLE REALTIME FOR PULSES TABLE
-- Required for B2: Cross-browser live updates
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pulses;

-- ============================================================================
-- 2. RLS POLICIES FOR PULSES
-- B1: Public read - anyone can view pulses
-- B8/B9: Authenticated write/delete - only owners can modify their pulses
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Public can read all pulses" ON pulses;
DROP POLICY IF EXISTS "Authenticated users can insert pulses" ON pulses;
DROP POLICY IF EXISTS "Users can delete own pulses" ON pulses;

-- Enable RLS on pulses table
ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: Anyone can read pulses (signed out or signed in)
CREATE POLICY "Public can read all pulses" ON pulses
  FOR SELECT
  USING (true);

-- AUTHENTICATED INSERT: Only signed-in users can create pulses
-- The user_id must match the authenticated user
CREATE POLICY "Authenticated users can insert pulses" ON pulses
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid()
  );

-- OWNER DELETE: Only the owner can delete their own pulses (B9)
CREATE POLICY "Users can delete own pulses" ON pulses
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid()
  );

-- ============================================================================
-- 3. PROFILES TABLE: UNIQUE ANON NAME (B10)
-- Add unique constraint on anon_name to prevent duplicates
-- Note: This may fail if duplicates already exist - resolve manually first
-- ============================================================================

-- Create unique index on anon_name (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_anon_name_unique
  ON profiles (anon_name);

-- ============================================================================
-- 4. RLS POLICIES FOR PROFILES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: Anyone can read profiles (for displaying author names)
CREATE POLICY "Public can read profiles" ON profiles
  FOR SELECT
  USING (true);

-- AUTHENTICATED INSERT: Users can create their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    id = auth.uid()
  );

-- OWNER UPDATE: Users can update only their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    id = auth.uid()
  );

-- ============================================================================
-- 5. FAVORITES TABLE RLS (existing, verify)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;

-- Enable RLS on favorites table
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "Users can read own favorites" ON favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own favorites
CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
