/**
 * Notification Triggers
 *
 * Helper functions to send notifications from various code paths.
 * All functions are async and non-blocking — they fire and forget.
 *
 * Usage:
 *   import { notifyNearbyUsers, notifyReaction, notifyComment } from '@/lib/notificationTriggers';
 */

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Internal base URL for server-to-server calls
function getInternalUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

async function sendNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  try {
    const baseUrl = getInternalUrl();
    await fetch(`${baseUrl}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, body, type, data }),
    });
  } catch (err) {
    console.error(`[notificationTriggers] Failed to send ${type}:`, err);
  }
}

// ============================================================================
// TRIGGER: New post nearby
// ============================================================================

/**
 * Notify users within radius of a new post.
 * Call after successful pulse insertion.
 *
 * @param postLat - Latitude of the new post
 * @param postLon - Longitude of the new post
 * @param radiusMiles - Notification radius (default 10)
 * @param preview - Short preview of the post content
 * @param postId - The pulse ID for deep linking
 * @param authorUserId - The post author (excluded from notifications)
 */
export async function notifyNearbyUsers(
  postLat: number,
  postLon: number,
  radiusMiles: number = 10,
  preview: string,
  postId: number | string,
  authorUserId: string
): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;

  // Find users with push tokens who have location data
  // We use the push_tokens table joined with the most recent pulse location per user
  // This is an approximation — ideally we'd store user home locations
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id")
    .neq("user_id", authorUserId);

  if (!tokens || tokens.length === 0) return;

  // Deduplicate user IDs
  const userIds = [...new Set(tokens.map((t) => t.user_id))];

  // For each user, check if they have recent activity near this location
  // (Simple approach: notify all registered users for now, let preferences filter)
  const truncatedPreview = preview.length > 80 ? preview.substring(0, 77) + "..." : preview;

  // Must await — Vercel serverless kills pending async after response
  await Promise.allSettled(
    userIds.map((userId) =>
      sendNotification(
        userId,
        "New post near you",
        truncatedPreview,
        "nearby_post",
        { pulseId: String(postId) }
      )
    )
  );
}

// ============================================================================
// TRIGGER: Reaction on your post
// ============================================================================

/**
 * Notify a post author that someone reacted to their post.
 */
export async function notifyReaction(
  postAuthorUserId: string,
  reactionType: string,
  reactorName: string,
  postPreview: string,
  postId: number | string
): Promise<void> {
  const emojiMap: Record<string, string> = {
    fire: "🔥",
    eyes: "👀",
    check: "✅",
  };
  const emoji = emojiMap[reactionType] || reactionType;

  await sendNotification(
    postAuthorUserId,
    `${reactorName} reacted ${emoji}`,
    postPreview.substring(0, 80),
    "reaction",
    { pulseId: String(postId), reactionType }
  );
}

// ============================================================================
// TRIGGER: Comment on your post
// ============================================================================

/**
 * Notify a post author that someone commented on their post.
 */
export async function notifyComment(
  postAuthorUserId: string,
  commenterName: string,
  commentPreview: string,
  postId: number | string
): Promise<void> {
  const truncated = commentPreview.length > 80 ? commentPreview.substring(0, 77) + "..." : commentPreview;

  await sendNotification(
    postAuthorUserId,
    `${commenterName} commented`,
    truncated,
    "comment",
    { pulseId: String(postId) }
  );
}

// ============================================================================
// TRIGGER: Traffic alert
// ============================================================================

/**
 * Notify users in area about a traffic incident.
 */
export async function notifyTrafficAlert(
  city: string,
  description: string,
  severity: "moderate" | "severe"
): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id");

  if (!tokens || tokens.length === 0) return;

  const userIds = [...new Set(tokens.map((t) => t.user_id))];
  const title = severity === "severe" ? "🚨 Major Traffic Alert" : "🚗 Traffic Update";

  await Promise.allSettled(
    userIds.map((userId) =>
      sendNotification(userId, title, description, "traffic_alert", { city })
    )
  );
}

// ============================================================================
// TRIGGER: Event reminder
// ============================================================================

/**
 * Notify users about an upcoming event (within 2 hours).
 */
export async function notifyEventReminder(
  userId: string,
  eventName: string,
  eventId: string,
  startsIn: string
): Promise<void> {
  await sendNotification(
    userId,
    `🎉 ${eventName} starts ${startsIn}`,
    "Don't miss it!",
    "event",
    { eventId }
  );
}
