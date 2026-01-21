/**
 * useExpiryCountdown Hook
 *
 * Provides real-time countdown display for ephemeral pulse expiry.
 * Updates every minute for active pulses, every 10 seconds when expiring soon.
 *
 * Design principles:
 * - Minimal re-renders when not needed
 * - Graceful handling of expired pulses
 * - SSR-safe (only runs on client)
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getPulseExpiryStatus,
  getRemainingSeconds,
  formatRemainingTime,
  getPulseOpacity,
} from "@/lib/pulses";
import type { PulseExpiryStatus } from "@/components/types";

export type ExpiryInfo = {
  /** Current status: active, expiring-soon, fading, expired */
  status: PulseExpiryStatus;
  /** Human-readable remaining time like "2h 15m left" */
  remainingText: string | null;
  /** Remaining seconds (negative if expired, null if no expiry) */
  remainingSeconds: number | null;
  /** Opacity value for visual decay (1.0 -> 0.4) */
  opacity: number;
  /** Whether the pulse should be hidden */
  isExpired: boolean;
  /** Whether we're in the warning zone */
  isExpiringSoon: boolean;
  /** Whether we're in the grace period */
  isFading: boolean;
};

type UseExpiryCountdownOptions = {
  /** Update interval in ms when active (default: 60000 = 1 minute) */
  activeIntervalMs?: number;
  /** Update interval in ms when expiring soon (default: 10000 = 10 seconds) */
  urgentIntervalMs?: number;
  /** Disable countdown updates (useful for performance optimization) */
  disabled?: boolean;
};

/**
 * Hook to track real-time expiry countdown for a pulse
 *
 * @param expiresAt - ISO timestamp of when the pulse expires
 * @param options - Configuration options
 * @returns ExpiryInfo object with current status and display values
 *
 * @example
 * const { status, remainingText, opacity, isExpiringSoon } = useExpiryCountdown(pulse.expiresAt);
 *
 * return (
 *   <div style={{ opacity }} className={isExpiringSoon ? 'pulse-urgent' : ''}>
 *     {remainingText && <span className="expiry-badge">{remainingText}</span>}
 *   </div>
 * );
 */
export function useExpiryCountdown(
  expiresAt: string | Date | null | undefined,
  options: UseExpiryCountdownOptions = {}
): ExpiryInfo {
  const {
    activeIntervalMs = 60000,
    urgentIntervalMs = 10000,
    disabled = false,
  } = options;

  const [now, setNow] = useState(() => new Date());

  // Derive all info from 'now' and 'expiresAt'
  const info = useMemo((): ExpiryInfo => {
    const status = getPulseExpiryStatus(expiresAt, now);
    const remainingSeconds = getRemainingSeconds(expiresAt, now);
    const remainingText = formatRemainingTime(expiresAt, now);
    const opacity = getPulseOpacity(expiresAt, now);

    return {
      status,
      remainingText,
      remainingSeconds,
      opacity,
      isExpired: status === "expired",
      isExpiringSoon: status === "expiring-soon",
      isFading: status === "fading",
    };
  }, [expiresAt, now]);

  // Handle periodic updates
  useEffect(() => {
    if (disabled || !expiresAt || info.isExpired) {
      return;
    }

    // Determine update interval based on urgency
    const intervalMs =
      info.isExpiringSoon || info.isFading
        ? urgentIntervalMs
        : activeIntervalMs;

    const interval = setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [expiresAt, disabled, activeIntervalMs, urgentIntervalMs, info.isExpired, info.isExpiringSoon, info.isFading]);

  return info;
}

/**
 * Lightweight version that only returns the expiry status
 * Use this when you don't need the full countdown, just the status
 */
export function useExpiryStatus(
  expiresAt: string | Date | null | undefined
): PulseExpiryStatus {
  const { status } = useExpiryCountdown(expiresAt, {
    activeIntervalMs: 120000, // Less frequent updates since we only care about status changes
    urgentIntervalMs: 30000,
  });
  return status;
}

export default useExpiryCountdown;
