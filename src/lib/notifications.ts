/**
 * Capacitor Push Notifications Service
 *
 * Handles native push notifications for iOS (APNs) via @capacitor/push-notifications.
 * - Requests permission after sign-in
 * - Registers device token with backend
 * - Handles foreground notifications
 * - Handles notification tap → deep link navigation
 *
 * Usage:
 *   import { initPushNotifications, removePushToken } from '@/lib/notifications';
 *   // After sign-in:
 *   await initPushNotifications(accessToken, onNavigate);
 *   // On sign-out:
 *   await removePushToken();
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getApiUrl } from "@/lib/api-config";

// ============================================================================
// STATE
// ============================================================================

let initialized = false;
let currentToken: string | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize push notifications. Call after successful sign-in.
 *
 * @param accessToken - User's auth token for API calls
 * @param onNavigate - Callback for handling notification tap navigation
 *                     Receives { type, pulseId?, eventId? }
 */
export async function initPushNotifications(
  accessToken: string,
  onNavigate?: (data: Record<string, string>) => void
): Promise<boolean> {
  // Only works on native platforms
  const isNative = Capacitor.isNativePlatform();
  console.log("[notifications] Platform check — isNativePlatform:", isNative, "platform:", Capacitor.getPlatform());
  if (!isNative) {
    console.log("[notifications] Not a native platform, skipping push init");
    return false;
  }

  if (initialized && accessToken === "__anonymous__") {
    console.log("[notifications] Already initialized (anonymous)");
    return true;
  }
  // Allow re-init with real auth token to register with backend
  if (initialized && accessToken !== "__anonymous__" && currentToken) {
    console.log("[notifications] Re-registering existing token with auth...");
    try {
      const url = getApiUrl("/api/notifications/register");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token: currentToken, platform: "ios" }),
      });
      const body = await res.json().catch(() => ({}));
      console.log("[notifications] Re-registration response:", res.status, JSON.stringify(body));
    } catch (err) {
      console.error("[notifications] Re-registration failed:", err);
    }
    return true;
  }

  try {
    // Check current permission status
    const permStatus = await PushNotifications.checkPermissions();
    console.log("[notifications] Current permission status:", JSON.stringify(permStatus));

    if (permStatus.receive === "prompt") {
      // Request permission
      console.log("[notifications] Requesting permission...");
      const result = await PushNotifications.requestPermissions();
      console.log("[notifications] Permission result:", JSON.stringify(result));
      if (result.receive !== "granted") {
        console.log("[notifications] Permission denied by user");
        return false;
      }
    } else if (permStatus.receive !== "granted") {
      console.log("[notifications] Permission not granted (status:", permStatus.receive, ") — user may have denied previously");
      return false;
    }

    // Register for push notifications (triggers APNs registration)
    console.log("[notifications] Calling PushNotifications.register()...");
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener("registration", async (token) => {
      console.log("[notifications] APNs token received:", token.value.substring(0, 10) + "...");
      currentToken = token.value;

      // Register token with our backend (only if we have a real auth token)
      if (accessToken && accessToken !== "__anonymous__") {
        try {
          const url = getApiUrl("/api/notifications/register");
          console.log("[notifications] Registering token with backend:", url);
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              token: token.value,
              platform: "ios",
            }),
          });
          const body = await res.json().catch(() => ({}));
          console.log("[notifications] Backend registration response:", res.status, JSON.stringify(body));
          if (!res.ok) {
            console.error("[notifications] Backend registration failed:", res.status, body);
          }
        } catch (err) {
          console.error("[notifications] Failed to register token with backend:", err);
        }
      } else {
        console.log("[notifications] Skipping backend registration (no auth token) — will register on sign-in");
      }
    });

    // Listen for registration errors
    PushNotifications.addListener("registrationError", (err) => {
      console.error("[notifications] APNs registration FAILED:", JSON.stringify(err));
    });

    // Handle foreground notifications (show as in-app toast or badge)
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[notifications] Foreground notification:", notification.title);
      // Foreground notifications are handled by the app's UI
      // The notification is NOT shown in the system tray automatically
      // You could show an in-app toast here
    });

    // Handle notification tap (app opened from notification)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[notifications] Notification tapped:", action.notification.data);
      const data = action.notification.data as Record<string, string>;
      if (onNavigate && data) {
        onNavigate(data);
      }
    });

    initialized = true;
    return true;
  } catch (err) {
    console.error("[notifications] Init error:", err);
    return false;
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Remove the current device's push token from the backend.
 * Call on sign-out.
 */
export async function removePushToken(accessToken?: string): Promise<void> {
  if (!currentToken) return;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    await fetch(getApiUrl("/api/notifications/register"), {
      method: "DELETE",
      headers,
      body: JSON.stringify({ token: currentToken }),
    });
  } catch (err) {
    console.error("[notifications] Failed to remove token:", err);
  }

  currentToken = null;
  initialized = false;
}

/**
 * Get the current unread notification count.
 */
export async function getUnreadCount(accessToken: string): Promise<number> {
  try {
    const res = await fetch(getApiUrl("/api/notifications/unread-count"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}
