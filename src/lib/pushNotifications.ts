/**
 * Web Push Notification Service
 *
 * Handles sending push notifications via the Web Push API with VAPID authentication.
 *
 * Required environment variables:
 * - VAPID_PUBLIC_KEY: Public VAPID key (also exposed to client as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 * - VAPID_PRIVATE_KEY: Private VAPID key (server-side only)
 * - VAPID_SUBJECT: mailto: or https: URL identifying the application
 *
 * To generate VAPID keys:
 * npx web-push generate-vapid-keys
 */

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type {
  NotificationPayload,
  NotificationType,
  PushSubscription,
} from "./batSignal";
import {
  generateNotificationMessage,
  isInQuietHours,
  isOnCooldown,
  recordNotificationSent,
} from "./batSignal";

// ============================================================================
// CONFIGURATION
// ============================================================================

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@communitypulse.app";

  if (!publicKey || !privateKey) {
    console.warn("[pushNotifications] VAPID keys not configured. Push notifications disabled.");
    return null;
  }

  return { publicKey, privateKey, subject };
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[pushNotifications] Supabase service role not configured.");
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================================
// PUSH NOTIFICATION SENDING
// ============================================================================

export type SendResult = {
  success: boolean;
  subscriptionId: string;
  error?: string;
  statusCode?: number;
};

/**
 * Send a push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription["subscription"],
  payload: NotificationPayload
): Promise<SendResult & { subscriptionId: string }> {
  const vapidConfig = getVapidConfig();

  if (!vapidConfig) {
    return {
      success: false,
      subscriptionId: "",
      error: "VAPID not configured",
    };
  }

  // Configure web-push with VAPID details
  webpush.setVapidDetails(
    vapidConfig.subject,
    vapidConfig.publicKey,
    vapidConfig.privateKey
  );

  const message = generateNotificationMessage(payload);

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(message),
      {
        TTL: 3600, // 1 hour expiry
        urgency: "normal",
        topic: message.tag,
      }
    );

    return {
      success: true,
      subscriptionId: subscription.endpoint,
      statusCode: result.statusCode,
    };
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };

    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription is no longer valid - should be cleaned up
      return {
        success: false,
        subscriptionId: subscription.endpoint,
        error: "Subscription expired",
        statusCode: error.statusCode,
      };
    }

    return {
      success: false,
      subscriptionId: subscription.endpoint,
      error: error.message || "Unknown error",
      statusCode: error.statusCode,
    };
  }
}

/**
 * Send notifications to all subscribers for a city/type
 *
 * This function:
 * 1. Fetches all eligible subscribers from the database
 * 2. Filters by quiet hours and cooldowns
 * 3. Sends notifications in parallel
 * 4. Updates subscription status for failures
 * 5. Logs all notifications for analytics
 */
export async function sendCityNotification(
  city: string,
  notificationType: NotificationType,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number; skipped: number }> {
  const supabase = getServiceClient();

  if (!supabase) {
    console.error("[sendCityNotification] No service client available");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const vapidConfig = getVapidConfig();
  if (!vapidConfig) {
    console.warn("[sendCityNotification] VAPID not configured, skipping notifications");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Fetch eligible subscribers using our database function
  const { data: subscribers, error } = await supabase.rpc(
    "get_notification_subscribers",
    {
      p_city: city,
      p_notification_type: notificationType,
    }
  );

  if (error) {
    console.error("[sendCityNotification] Error fetching subscribers:", error);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  if (!subscribers || subscribers.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Send notifications in parallel with concurrency limit
  const BATCH_SIZE = 10;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (sub: { user_id: string; subscription: PushSubscription["subscription"]; subscription_id: string }) => {
        // Client-side cooldown check (database also enforces this)
        if (isOnCooldown(sub.user_id, city, notificationType)) {
          return { status: "skipped" as const, sub };
        }

        const result = await sendPushNotification(sub.subscription, payload);

        if (result.success) {
          recordNotificationSent(sub.user_id, city, notificationType);
        }

        return { status: result.success ? "sent" as const : "failed" as const, sub, result };
      })
    );

    // Process results
    for (const r of results) {
      if (r.status === "sent") {
        sent++;

        // Log successful notification
        await supabase.from("notification_log").insert({
          user_id: r.sub.user_id,
          subscription_id: r.sub.subscription_id,
          notification_type: notificationType,
          city,
          payload,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } else if (r.status === "failed") {
        failed++;

        // Update subscription status if expired
        if ("result" in r && (r.result.statusCode === 410 || r.result.statusCode === 404)) {
          await supabase
            .from("push_subscriptions")
            .update({
              is_active: false,
              last_failure_at: new Date().toISOString(),
              last_failure_reason: "Subscription expired",
            })
            .eq("id", r.sub.subscription_id);
        } else if ("result" in r) {
          // Increment failure count
          await supabase.rpc("increment", {
            table_name: "push_subscriptions",
            row_id: r.sub.subscription_id,
            column_name: "consecutive_failures",
            increment_by: 1,
          });
        }

        // Log failed notification
        await supabase.from("notification_log").insert({
          user_id: r.sub.user_id,
          subscription_id: r.sub.subscription_id,
          notification_type: notificationType,
          city,
          payload,
          status: "failed",
          error_message: "result" in r ? r.result.error : "Unknown error",
        });
      } else {
        skipped++;
      }
    }
  }

  console.log(
    `[sendCityNotification] ${city} ${notificationType}: sent=${sent}, failed=${failed}, skipped=${skipped}`
  );

  return { sent, failed, skipped };
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Subscribe a user to push notifications
 */
export async function subscribeToPush(
  userId: string,
  subscription: PushSubscription["subscription"],
  deviceName?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  if (!supabase) {
    return { success: false, error: "Server not configured" };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      subscription,
      device_name: deviceName,
      user_agent: userAgent,
      is_active: true,
      consecutive_failures: 0,
      last_failure_at: null,
      last_failure_reason: null,
    },
    {
      onConflict: "endpoint",
    }
  );

  if (error) {
    console.error("[subscribeToPush] Error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeFromPush(
  userId: string,
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  if (!supabase) {
    return { success: false, error: "Server not configured" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[unsubscribeFromPush] Error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get user's active push subscriptions
 */
export async function getUserSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  const supabase = getServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("[getUserSubscriptions] Error:", error);
    return [];
  }

  return data || [];
}
