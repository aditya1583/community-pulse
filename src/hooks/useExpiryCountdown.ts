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

import { useState, useEffect, useCallback, useRef } from "react";
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate derived values
  const calculateInfo = useCallback(
    (currentTime: Date): ExpiryInfo => {
      const status = getPulseExpiryStatus(expiresAt, currentTime);
      const remainingSeconds = getRemainingSeconds(expiresAt, currentTime);
      const remainingText = formatRemainingTime(expiresAt, currentTime);
      const opacity = getPulseOpacity(expiresAt, currentTime);

      return {
        status,
        remainingText,
        remainingSeconds,
        opacity,
        isExpired: status === "expired",
        isExpiringSoon: status === "expiring-soon",
        isFading: status === "fading",
      };
    },
    [expiresAt]
  );

  // Get initial info
  const [info, setInfo] = useState<ExpiryInfo>(() => calculateInfo(new Date()));

  // Update the countdown
  useEffect(() => {
    // Skip if disabled or no expiry
    if (disabled || !expiresAt) {
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Calculate current info
    const currentNow = new Date();
    const currentInfo = calculateInfo(currentNow);
    setInfo(currentInfo);
    setNow(currentNow);

    // If already expired, no need to update
    if (currentInfo.isExpired) {
      return;
    }

    // Determine update interval based on urgency
    const intervalMs =
      currentInfo.isExpiringSoon || currentInfo.isFading
        ? urgentIntervalMs
        : activeIntervalMs;

    // Set up interval for updates
    intervalRef.current = setInterval(() => {
      const newNow = new Date();
      const newInfo = calculateInfo(newNow);
      setNow(newNow);
      setInfo(newInfo);

      // Stop updates if fully expired
      if (newInfo.isExpired && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [expiresAt, disabled, activeIntervalMs, urgentIntervalMs, calculateInfo]);

  // Recalculate when transitioning between phases
  useEffect(() => {
    if (disabled || !expiresAt || info.isExpired) {
      return;
    }

    // Check if we need to switch to urgent updates
    const currentInfo = calculateInfo(new Date());
    const wasUrgent = info.isExpiringSoon || info.isFading;
    const isNowUrgent = currentInfo.isExpiringSoon || currentInfo.isFading;

    // If urgency changed, recalculate interval
    if (wasUrgent !== isNowUrgent) {
      setInfo(currentInfo);
    }
  }, [info, expiresAt, disabled, calculateInfo]);

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
