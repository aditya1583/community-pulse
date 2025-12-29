/**
 * Bat Signal - Smart Geo-Alert System
 *
 * The Vision:
 * Users shouldn't have to remember to open the app.
 * The app should buzz their pocket when something worth knowing is happening.
 *
 * This module provides:
 * 1. Vibe Velocity Detection - Detect when pulse activity spikes (200%+ of normal)
 * 2. Vibe Shift Detection - Detect when the dominant mood changes significantly
 * 3. Keyword Clustering - Detect when multiple people mention the same topic nearby
 *
 * The "gossip factor": users should wonder "What's happening?" and NEED to check.
 */

import type { VibeIntensity } from "@/components/types";

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = "vibe_shift" | "spike_alert" | "keyword_cluster" | "engagement_prompt";

export type VibeShiftPayload = {
  type: "vibe_shift";
  city: string;
  previousVibe: VibeIntensity;
  currentVibe: VibeIntensity;
  dominantMood: string | null;
  dominantMoodPercent: number;
  pulseCount: number;
};

export type SpikeAlertPayload = {
  type: "spike_alert";
  city: string;
  currentHourCount: number;
  rollingAverage: number;
  percentIncrease: number;
  dominantMood: string | null;
  dominantTag: string | null;
};

export type KeywordClusterPayload = {
  type: "keyword_cluster";
  city: string;
  keyword: string;
  matchCount: number;
  radiusMiles: number;
  recentPulseIds: number[];
};

export type EngagementPromptPayload = {
  type: "engagement_prompt";
  city: string;
  promptType: "morning_commute" | "lunch_check" | "evening_dinner" | "weekend_plans";
  promptText: string;
};

export type NotificationPayload =
  | VibeShiftPayload
  | SpikeAlertPayload
  | KeywordClusterPayload
  | EngagementPromptPayload;

export type NotificationPreferences = {
  id: string;
  user_id: string;
  city: string;
  vibe_shifts_enabled: boolean;
  spike_alerts_enabled: boolean;
  keyword_alerts_enabled: boolean;
  alert_keywords: string[];
  keyword_radius_miles: number;
  spike_threshold_percent: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  is_active: boolean;
};

export type VibeVelocityStat = {
  city: string;
  hour_bucket: string;
  pulse_count: number;
  rolling_avg_7d: number | null;
  dominant_mood: string | null;
  dominant_mood_percent: number | null;
  vibe_intensity: VibeIntensity | null;
};

// ============================================================================
// VIBE VELOCITY CALCULATIONS
// ============================================================================

/**
 * Calculate the velocity (rate of change) of pulse activity
 *
 * @param currentCount - Pulses in current hour
 * @param rollingAvg - Average pulses per hour over past 7 days (same hour)
 * @returns Percentage increase/decrease from normal
 */
export function calculateVibeVelocity(
  currentCount: number,
  rollingAvg: number | null
): number {
  // If no historical data, we can't calculate velocity
  if (rollingAvg === null || rollingAvg < 1) {
    // Return 0 (no change) if we have no baseline
    // But if we have 5+ pulses with no history, that's noteworthy
    return currentCount >= 5 ? 100 : 0;
  }

  return Math.round((currentCount / rollingAvg - 1) * 100);
}

/**
 * Determine if a spike alert should fire
 *
 * The spike detection is time-aware: we compare to the same hour of day
 * over the past week. This means a spike during rush hour is compared
 * to other rush hours, not to 3am.
 */
export function shouldTriggerSpikeAlert(
  currentCount: number,
  rollingAvg: number | null,
  thresholdPercent: number = 200
): boolean {
  // Minimum activity threshold - don't alert for tiny spikes
  if (currentCount < 3) return false;

  // If no historical data, require a higher absolute threshold
  if (rollingAvg === null || rollingAvg < 1) {
    return currentCount >= 5;
  }

  const velocity = calculateVibeVelocity(currentCount, rollingAvg);
  return velocity >= thresholdPercent;
}

/**
 * Detect significant vibe shifts
 *
 * A vibe shift occurs when the intensity level changes significantly,
 * for example: quiet -> buzzing, or calm -> chaotic
 */
export function detectVibeShift(
  previousIntensity: VibeIntensity | null,
  currentIntensity: VibeIntensity
): { shifted: boolean; direction: "escalating" | "calming" | "none" } {
  if (!previousIntensity) {
    return { shifted: false, direction: "none" };
  }

  const intensityOrder: VibeIntensity[] = ["quiet", "active", "buzzing", "intense"];
  const prevIndex = intensityOrder.indexOf(previousIntensity);
  const currIndex = intensityOrder.indexOf(currentIntensity);

  // Require at least 2 levels of change to be considered a "shift"
  // quiet -> buzzing, or active -> intense
  const delta = currIndex - prevIndex;

  if (delta >= 2) {
    return { shifted: true, direction: "escalating" };
  }
  if (delta <= -2) {
    return { shifted: true, direction: "calming" };
  }

  return { shifted: false, direction: "none" };
}

// ============================================================================
// NOTIFICATION MESSAGE GENERATION
// ============================================================================

/**
 * Generate a compelling notification message
 *
 * These messages are designed to create curiosity and urgency.
 * They should make the user WANT to open the app.
 */
export function generateNotificationMessage(payload: NotificationPayload): {
  title: string;
  body: string;
  tag: string;
  data: Record<string, unknown>;
} {
  const cityName = payload.city.split(",")[0].trim();

  switch (payload.type) {
    case "spike_alert": {
      const intensity = payload.percentIncrease >= 300 ? "surge" : "spike";
      return {
        title: `Something is happening in ${cityName}`,
        body: `${payload.currentHourCount} pulses in the last hour. Tap to see what's going on.`,
        tag: `spike-${payload.city}-${Date.now()}`,
        data: {
          type: "spike_alert",
          city: payload.city,
          url: `/?city=${encodeURIComponent(payload.city)}&tab=pulse`,
        },
      };
    }

    case "vibe_shift": {
      const vibeDescriptions: Record<VibeIntensity, string> = {
        quiet: "Quiet",
        active: "Active",
        buzzing: "Buzzing",
        intense: "Intense",
      };
      const currentDesc = vibeDescriptions[payload.currentVibe];
      const previousDesc = vibeDescriptions[payload.previousVibe];

      return {
        title: `${cityName} just went ${currentDesc}`,
        body: `The vibe shifted from ${previousDesc}. ${payload.pulseCount} people talking now.`,
        tag: `vibe-shift-${payload.city}-${Date.now()}`,
        data: {
          type: "vibe_shift",
          city: payload.city,
          url: `/?city=${encodeURIComponent(payload.city)}&tab=pulse`,
        },
      };
    }

    case "keyword_cluster": {
      const keyword = payload.keyword.charAt(0).toUpperCase() + payload.keyword.slice(1);
      return {
        title: `"${keyword}" trending in ${cityName}`,
        body: `${payload.matchCount} people mentioned "${payload.keyword}" nearby. Tap to see.`,
        tag: `keyword-${payload.keyword}-${payload.city}-${Date.now()}`,
        data: {
          type: "keyword_cluster",
          city: payload.city,
          keyword: payload.keyword,
          url: `/?city=${encodeURIComponent(payload.city)}&tab=pulse&q=${encodeURIComponent(payload.keyword)}`,
        },
      };
    }

    case "engagement_prompt": {
      const promptTitles: Record<string, string> = {
        morning_commute: `Good morning, ${cityName}!`,
        lunch_check: `Lunchtime in ${cityName}`,
        evening_dinner: `Evening check-in`,
        weekend_plans: `Weekend in ${cityName}`,
      };
      return {
        title: promptTitles[payload.promptType] || `What's happening in ${cityName}?`,
        body: payload.promptText,
        tag: `prompt-${payload.promptType}-${payload.city}-${Date.now()}`,
        data: {
          type: "engagement_prompt",
          city: payload.city,
          url: `/?city=${encodeURIComponent(payload.city)}&tab=pulse`,
        },
      };
    }
  }
}

// ============================================================================
// KEYWORD CLUSTERING
// ============================================================================

/**
 * Find keyword clusters in recent pulses
 *
 * Returns keywords that appear in 3+ pulses within the specified time window
 */
export function findKeywordClusters(
  pulses: Array<{ id: number; message: string; created_at: string }>,
  keywords: string[],
  windowMinutes: number = 60
): Map<string, number[]> {
  const clusters = new Map<string, number[]>();
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  // Normalize keywords for case-insensitive matching
  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

  for (const pulse of pulses) {
    const pulseTime = new Date(pulse.created_at).getTime();

    // Only consider pulses within the time window
    if (now - pulseTime > windowMs) continue;

    const messageLower = pulse.message.toLowerCase();

    for (const keyword of normalizedKeywords) {
      // Word boundary matching to avoid partial matches
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
      if (regex.test(messageLower)) {
        const existing = clusters.get(keyword) || [];
        existing.push(pulse.id);
        clusters.set(keyword, existing);
      }
    }
  }

  // Filter to only clusters with 3+ matches
  const significantClusters = new Map<string, number[]>();
  for (const [keyword, pulseIds] of clusters) {
    if (pulseIds.length >= 3) {
      significantClusters.set(keyword, pulseIds);
    }
  }

  return significantClusters;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// QUIET HOURS CHECK
// ============================================================================

/**
 * Check if we're currently in quiet hours for a user
 */
export function isInQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  timezone: string = "America/Chicago"
): boolean {
  if (!quietStart || !quietEnd) return false;

  try {
    // Get current time in user's timezone
    const now = new Date();
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );

    const currentMinutes =
      userTime.getHours() * 60 + userTime.getMinutes();

    const [startHour, startMin] = quietStart.split(":").map(Number);
    const [endHour, endMin] = quietEnd.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      // Overnight case
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Same-day case
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    // If timezone parsing fails, assume not in quiet hours
    return false;
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const NOTIFICATION_COOLDOWNS: Record<NotificationType, number> = {
  spike_alert: 60 * 60 * 1000, // 1 hour
  vibe_shift: 30 * 60 * 1000, // 30 minutes
  keyword_cluster: 60 * 60 * 1000, // 1 hour
  engagement_prompt: 6 * 60 * 60 * 1000, // 6 hours between prompts
};

/**
 * Check if a notification type is on cooldown for a user/city
 *
 * This is a simple in-memory check. The database also enforces this via
 * the get_notification_subscribers function, but this client-side check
 * saves unnecessary API calls.
 */
const lastNotificationTimes = new Map<string, number>();

export function isOnCooldown(
  userId: string,
  city: string,
  notificationType: NotificationType
): boolean {
  const key = `${userId}:${city}:${notificationType}`;
  const lastTime = lastNotificationTimes.get(key);

  if (!lastTime) return false;

  const cooldown = NOTIFICATION_COOLDOWNS[notificationType];
  return Date.now() - lastTime < cooldown;
}

export function recordNotificationSent(
  userId: string,
  city: string,
  notificationType: NotificationType
): void {
  const key = `${userId}:${city}:${notificationType}`;
  lastNotificationTimes.set(key, Date.now());
}
