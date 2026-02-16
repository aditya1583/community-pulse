-- Push Notifications Migration for Voxlo
-- Run this in Supabase SQL Editor
-- This adds native push token storage alongside the existing web push system

-- ============================================================================
-- TABLES
-- ============================================================================

-- Store device push tokens (APNs for iOS, FCM for Android)
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nearby_posts boolean DEFAULT true,
  reactions boolean DEFAULT true,
  comments boolean DEFAULT true,
  events boolean DEFAULT true,
  traffic_alerts boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Notification history / inbox
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- push_tokens: users can manage their own tokens
CREATE POLICY "Users can view own tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);
-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access on push_tokens" ON push_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- notification_preferences: users can manage their own
CREATE POLICY "Users can view own preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on notification_preferences" ON notification_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- notifications: users can read their own, service role can insert
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- NOTIFICATION BATCHING TABLE (for rate limiting & batching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_batch_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  sent boolean DEFAULT false,
  batch_key text NOT NULL -- e.g. "nearby_posts:user123" for grouping
);

CREATE INDEX IF NOT EXISTS idx_notification_batch_queue_pending
  ON notification_batch_queue(user_id, batch_key, sent, created_at DESC);

ALTER TABLE notification_batch_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on notification_batch_queue" ON notification_batch_queue
  FOR ALL USING (auth.role() = 'service_role');
