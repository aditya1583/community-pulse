"use client";

import { useEffect } from "react";

/**
 * Registers the service worker globally on every page load.
 * This enables push notifications without requiring navigation to settings.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Service worker registered:", registration.scope);

        // Check for updates periodically
        registration.update();
      })
      .catch((error) => {
        console.error("[SW] Service worker registration failed:", error);
      });
  }, []);

  // This component renders nothing
  return null;
}
