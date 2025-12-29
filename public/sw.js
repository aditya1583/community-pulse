/**
 * Service Worker for Community Pulse - Bat Signal Notifications
 *
 * Handles push notifications and click-through navigation.
 * This file must be served from the root of the domain.
 */

// Cache version for updates
const CACHE_VERSION = "v1";

// Handle push notification events
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("[SW] Push received but no data");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.error("[SW] Failed to parse push data:", e);
    return;
  }

  const { title, body, tag, data } = payload;

  const options = {
    body,
    tag,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    vibrate: [100, 50, 100],
    data,
    requireInteraction: false,
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click events
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  // Dismiss action - just close
  if (action === "dismiss") {
    return;
  }

  // Determine URL to open
  let targetUrl = "/";

  if (data.url) {
    targetUrl = data.url;
  } else if (data.city) {
    targetUrl = `/?city=${encodeURIComponent(data.city)}&tab=pulse`;
  }

  // Track click (best effort)
  if (data.notificationId) {
    fetch("/api/notifications/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: data.notificationId,
        action: "clicked",
      }),
    }).catch(() => {
      // Ignore tracking errors
    });
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            // Navigate existing window
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(targetUrl);
      })
  );
});

// Handle notification close (without clicking)
self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};

  if (data.notificationId) {
    fetch("/api/notifications/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: data.notificationId,
        action: "dismissed",
      }),
    }).catch(() => {
      // Ignore tracking errors
    });
  }
});

// Handle push subscription change
self.addEventListener("pushsubscriptionchange", (event) => {
  // The push subscription has changed (e.g., expired)
  // We need to resubscribe and update the server
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.applicationServerKey,
      })
      .then((subscription) => {
        // Send new subscription to server
        return fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            isResubscription: true,
          }),
        });
      })
      .catch((error) => {
        console.error("[SW] Failed to resubscribe:", error);
      })
  );
});

// Service worker lifecycle events
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker v" + CACHE_VERSION);
  // Take control immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker v" + CACHE_VERSION);
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});
