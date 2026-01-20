import type { PulseExpiryStatus, PulseCategory } from "@/components/types";
import {
  PULSE_LIFESPAN_HOURS,
  PULSE_GRACE_PERIOD_HOURS,
  EXPIRING_SOON_THRESHOLD_MINUTES,
} from "@/components/types";

export type AuthStatus = "loading" | "signed_in" | "signed_out";

export function getOnboardingCompletedStorageKey(userId: string) {
  return `cp-onboarding-completed:${userId}`;
}

export function readOnboardingCompleted(
  storage: Pick<Storage, "getItem">,
  userId: string
) {
  try {
    return storage.getItem(getOnboardingCompletedStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingCompleted(
  storage: Pick<Storage, "setItem">,
  userId: string
) {
  try {
    storage.setItem(getOnboardingCompletedStorageKey(userId), "1");
  } catch {
    // ignore storage errors (private mode, disabled storage, etc.)
  }
}

// Session-level tracking keys (survive navigation within session, cleared on tab close)
const FIRST_PULSE_MODAL_SHOWN_KEY = "cp-first-pulse-modal-shown";

/**
 * Check if the first pulse modal has been shown this session (survives navigation)
 */
export function hasShownFirstPulseModalThisSession(
  storage: Pick<Storage, "getItem">
): boolean {
  try {
    return storage.getItem(FIRST_PULSE_MODAL_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Mark the first pulse modal as shown this session
 */
export function markFirstPulseModalShown(
  storage: Pick<Storage, "setItem">
): void {
  try {
    storage.setItem(FIRST_PULSE_MODAL_SHOWN_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

export function shouldShowFirstPulseOnboarding(args: {
  authStatus: AuthStatus;
  identityReady: boolean;
  pulseCountResolved: boolean;
  userPulseCount: number;
  onboardingCompleted: boolean;
  hasShownThisSession: boolean;
}) {
  if (args.authStatus !== "signed_in") return false;
  if (!args.identityReady) return false;
  if (!args.pulseCountResolved) return false;
  if (args.onboardingCompleted) return false;
  if (args.hasShownThisSession) return false;
  return args.userPulseCount === 0;
}

export function startOfLocalDay(now: Date = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfNextLocalDay(now: Date = new Date()) {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Get the start of "recent" window (7 days ago)
 */
export function startOfRecentWindow(now: Date = new Date(), days: number = 7) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isInLocalToday(createdAt: string | Date, now: Date = new Date()) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;

  const start = startOfLocalDay(now).getTime();
  const end = startOfNextLocalDay(now).getTime();
  const t = d.getTime();
  return t >= start && t < end;
}

/**
 * Check if a pulse is within the "recent" window (default 7 days)
 * This is the default filter for the feed - not just "today"
 */
export function isInRecentWindow(createdAt: string | Date, now: Date = new Date(), days: number = 7) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;

  const start = startOfRecentWindow(now, days).getTime();
  const end = startOfNextLocalDay(now).getTime();
  const t = d.getTime();
  return t >= start && t < end;
}

export function formatPulseDateTime(createdAt: string | Date) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Unknown time";

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  const hours12 = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");

  // Example: 12/26/25 9:07
  return `${month}/${day}/${year} ${hours12}:${minutes}`;
}

export function formatPulseLocation(city: string, neighborhood?: string | null) {
  const safeCity = (city || "").trim();
  const safeNeighborhood = (neighborhood || "").trim();

  if (!safeCity && !safeNeighborhood) return "Unknown location";
  if (safeCity && safeNeighborhood) return `${safeCity} · ${safeNeighborhood}`;
  return safeCity || safeNeighborhood;
}

export function isPostEnabled(args: {
  identityReady: boolean;
  loading: boolean;
  mood: string;
  tag: string;
  message: string;
}) {
  if (!args.identityReady) return false;
  if (args.loading) return false;
  if (!args.mood) return false;
  if (!args.tag) return false;
  if (!args.message.trim()) return false;
  return true;
}

export function resetComposerAfterSuccessfulPost() {
  return { mood: "", tag: "", message: "" };
}

// ============================================================================
// EPHEMERAL PULSE SYSTEM
// Content decay makes feeds feel fresh and urgent
// ============================================================================

/**
 * Calculate the expiry timestamp for a pulse based on its category
 */
export function calculateExpiryTime(
  createdAt: string | Date,
  tag: string
): Date {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const category = tag as PulseCategory;
  const lifespanHours = PULSE_LIFESPAN_HOURS[category] ?? 24;

  const expiresAt = new Date(created);
  expiresAt.setHours(expiresAt.getHours() + lifespanHours);

  return expiresAt;
}

/**
 * Get the number of seconds remaining until a pulse expires
 * Returns negative if expired, null if no expiry
 */
export function getRemainingSeconds(
  expiresAt: string | Date | number | null | undefined,
  now: Date = new Date()
): number | null {
  if (!expiresAt) return null;

  let expires: Date;

  if (expiresAt instanceof Date) {
    expires = expiresAt;
  } else if (typeof expiresAt === "number") {
    // Handle Unix timestamps - if less than year 2000, assume it's seconds not milliseconds
    const isSeconds = expiresAt < 946684800000; // Jan 1, 2000 in ms
    expires = isSeconds ? new Date(expiresAt * 1000) : new Date(expiresAt);
  } else {
    expires = new Date(expiresAt);
  }

  if (Number.isNaN(expires.getTime())) return null;

  return Math.floor((expires.getTime() - now.getTime()) / 1000);
}

/**
 * Determine the expiry status of a pulse for display purposes
 */
export function getPulseExpiryStatus(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): PulseExpiryStatus {
  const remainingSeconds = getRemainingSeconds(expiresAt, now);

  // No expiry set - treat as active
  if (remainingSeconds === null) {
    return "active";
  }

  // Past grace period - fully expired
  const gracePeriodSeconds = PULSE_GRACE_PERIOD_HOURS * 60 * 60;
  if (remainingSeconds < -gracePeriodSeconds) {
    return "expired";
  }

  // Past expiry but within grace period - fading
  if (remainingSeconds < 0) {
    return "fading";
  }

  // Expiring soon threshold
  const expiringThresholdSeconds = EXPIRING_SOON_THRESHOLD_MINUTES * 60;
  if (remainingSeconds <= expiringThresholdSeconds) {
    return "expiring-soon";
  }

  return "active";
}

/**
 * Check if a pulse should be visible in the feed
 * Pulses in grace period are still visible (faded)
 * Pulses past grace period are hidden
 */
export function isPulseVisible(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  const status = getPulseExpiryStatus(expiresAt, now);
  return status !== "expired";
}

/**
 * Filter an array of pulses to only include visible ones
 * This is the client-side safety net for expiry filtering
 * 
 * UPDATE: Now enforces STRICT implicit expiry based on tag to prevent stale
 * Traffic/Weather updates from persisting even if database expiry is missing.
 */
export function filterVisiblePulses<T extends { expiresAt?: string | null; tag: string; createdAt: string }>(
  pulses: T[],
  now: Date = new Date()
): T[] {
  return pulses.filter((pulse) => {
    // 1. Check explicit expiry first
    if (!isPulseVisible(pulse.expiresAt, now)) {
      return false;
    }

    // 2. Enforce strict implicit expiry for time-sensitive tags
    // This catches "zombie posts" that might have missed their expiry window
    // or have bad data.
    const created = new Date(pulse.createdAt);
    const ageInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    // Safety check for future dates (allow 10 min clock skewed future posts)
    if (ageInHours < -0.16) return true;

    // STRICT RULES:
    // Traffic: Gone after 3 hours (no matter what)
    if (pulse.tag === "Traffic" && ageInHours > 3) return false;

    // Weather: Gone after 4 hours
    if (pulse.tag === "Weather" && ageInHours > 4) return false;

    // Events: Gone after 24 hours
    if (pulse.tag === "Events" && ageInHours > 24) return false;

    // General: Gone after 48 hours (allow conversation to linger)
    if ((pulse.tag === "General" || !pulse.tag) && ageInHours > 48) return false;

    return true;
  });
}

/**
 * Format remaining time for display
 * Returns human-readable strings like "2h left", "30m left", "Fading..."
 */
export function formatRemainingTime(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const status = getPulseExpiryStatus(expiresAt, now);

  if (status === "expired") {
    return null;
  }

  if (status === "fading") {
    return "Fading...";
  }

  const remainingSeconds = getRemainingSeconds(expiresAt, now);
  if (remainingSeconds === null || remainingSeconds < 0) {
    return null;
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);

  if (hours > 0) {
    const minutePart = minutes > 0 ? ` ${minutes}m` : "";
    return `${hours}h${minutePart} left`;
  }

  if (minutes > 0) {
    return `${minutes}m left`;
  }

  return "< 1m left";
}

/**
 * Calculate opacity for a fading pulse
 * Returns 1.0 for active, gradually decreasing for expiring-soon and fading
 */
export function getPulseOpacity(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): number {
  const status = getPulseExpiryStatus(expiresAt, now);
  const remainingSeconds = getRemainingSeconds(expiresAt, now);

  switch (status) {
    case "active":
      return 1.0;

    case "expiring-soon": {
      // Gradually fade from 1.0 to 0.8 during expiring-soon phase
      if (remainingSeconds === null) return 1.0;
      const thresholdSeconds = EXPIRING_SOON_THRESHOLD_MINUTES * 60;
      const progress = 1 - remainingSeconds / thresholdSeconds;
      return 1.0 - progress * 0.2; // 1.0 -> 0.8
    }

    case "fading": {
      // Continue fading from 0.8 to 0.4 during grace period
      if (remainingSeconds === null) return 0.6;
      const gracePeriodSeconds = PULSE_GRACE_PERIOD_HOURS * 60 * 60;
      const progress = Math.abs(remainingSeconds) / gracePeriodSeconds;
      return 0.8 - progress * 0.4; // 0.8 -> 0.4
    }

    case "expired":
      return 0;

    default:
      return 1.0;
  }
}

/**
 * Get CSS class names for expiry status
 */
export function getExpiryClasses(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): string {
  const status = getPulseExpiryStatus(expiresAt, now);

  switch (status) {
    case "expiring-soon":
      return "pulse-expiring-soon";
    case "fading":
      return "pulse-fading";
    case "expired":
      return "pulse-expired";
    default:
      return "";
  }
}

