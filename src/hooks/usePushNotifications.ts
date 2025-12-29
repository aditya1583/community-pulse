/**
 * usePushNotifications Hook
 *
 * Client-side hook for managing push notification subscriptions.
 * Handles the Web Push API subscription flow and syncs with the server.
 *
 * Usage:
 * const {
 *   isSupported,
 *   permission,
 *   isSubscribed,
 *   subscribe,
 *   unsubscribe,
 *   error,
 * } = usePushNotifications(city);
 */

import { useState, useEffect, useCallback } from "react";

export type PushPermission = "default" | "granted" | "denied";

export type PushNotificationState = {
  isSupported: boolean;
  isLoading: boolean;
  permission: PushPermission;
  isSubscribed: boolean;
  error: string | null;
};

export type PushNotificationActions = {
  subscribe: (preferences?: NotificationPreferences) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<PushPermission>;
};

export type NotificationPreferences = {
  vibe_shifts_enabled?: boolean;
  spike_alerts_enabled?: boolean;
  keyword_alerts_enabled?: boolean;
  alert_keywords?: string[];
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string;
};

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Convert base64 VAPID key to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function usePushNotifications(
  city: string,
  getAuthToken: () => Promise<string | null>
): PushNotificationState & PushNotificationActions {
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push notifications are supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Initialize: register service worker and check subscription status
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    async function init() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js");
        setRegistration(reg);

        // Check permission status
        const perm = Notification.permission as PushPermission;
        setPermission(perm);

        // Check if already subscribed
        if (perm === "granted") {
          const subscription = await reg.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      } catch (err) {
        console.error("[usePushNotifications] Init error:", err);
        setError("Failed to initialize push notifications");
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [isSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<PushPermission> => {
    if (!isSupported) {
      return "denied";
    }

    try {
      const result = await Notification.requestPermission();
      const perm = result as PushPermission;
      setPermission(perm);
      return perm;
    } catch (err) {
      console.error("[usePushNotifications] Permission error:", err);
      setError("Failed to request notification permission");
      return "denied";
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(
    async (preferences?: NotificationPreferences): Promise<boolean> => {
      if (!isSupported || !registration) {
        setError("Push notifications not supported");
        return false;
      }

      if (!VAPID_PUBLIC_KEY) {
        setError("Push notifications not configured");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Request permission if not granted
        let perm = permission;
        if (perm !== "granted") {
          perm = await requestPermission();
          if (perm !== "granted") {
            setError("Notification permission denied");
            setIsLoading(false);
            return false;
          }
        }

        // Subscribe to push manager
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Get auth token
        const token = await getAuthToken();
        if (!token) {
          setError("Authentication required");
          setIsLoading(false);
          return false;
        }

        // Send subscription to server
        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            city,
            preferences,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to subscribe");
        }

        setIsSubscribed(true);
        setIsLoading(false);
        return true;
      } catch (err) {
        console.error("[usePushNotifications] Subscribe error:", err);
        setError(err instanceof Error ? err.message : "Failed to subscribe");
        setIsLoading(false);
        return false;
      }
    },
    [isSupported, registration, permission, requestPermission, city, getAuthToken]
  );

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Get auth token
        const token = await getAuthToken();
        if (token) {
          // Remove from server
          await fetch(
            `/api/notifications/subscribe?endpoint=${encodeURIComponent(
              subscription.endpoint
            )}&city=${encodeURIComponent(city)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
        }
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[usePushNotifications] Unsubscribe error:", err);
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
      setIsLoading(false);
      return false;
    }
  }, [registration, city, getAuthToken]);

  return {
    isSupported,
    isLoading,
    permission,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}
