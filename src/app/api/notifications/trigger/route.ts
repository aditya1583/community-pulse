/**
 * POST /api/notifications/trigger
 *
 * Trigger notification checks for a city.
 * This endpoint can be called:
 * 1. By a Vercel Cron job every 15 minutes
 * 2. By a database trigger after pulse inserts
 * 3. Manually for testing
 *
 * It checks for:
 * - Vibe velocity spikes (200%+ increase in pulse rate)
 * - Vibe shifts (intensity level changes)
 * - Keyword clusters (3+ mentions of same keyword)
 *
 * Security:
 * - Requires either a valid cron secret OR service role key
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  shouldTriggerSpikeAlert,
  detectVibeShift,
  findKeywordClusters,
  type SpikeAlertPayload,
  type VibeShiftPayload,
  type KeywordClusterPayload,
} from "@/lib/batSignal";
import { sendCityNotification } from "@/lib/pushNotifications";
import type { VibeIntensity } from "@/components/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

// Maximum runtime for this endpoint (Vercel hobby tier)
export const maxDuration = 60;

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verify the request is authorized
 * Accepts either cron secret or service role key
 */
function isAuthorized(req: NextRequest): boolean {
  // Check for cron secret (Vercel Cron Jobs)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check for service role key (internal calls)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return true;
  }

  // Development bypass removed for security - always require authentication
  // Use CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY even in development

  return false;
}

type TriggerBody = {
  city?: string;
  cities?: string[];
  checkSpikes?: boolean;
  checkVibeShifts?: boolean;
  checkKeywords?: boolean;
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const body: TriggerBody = await req.json().catch(() => ({}));

    // Determine which cities to check
    let citiesToCheck: string[] = [];

    if (body.city) {
      citiesToCheck = [body.city];
    } else if (body.cities?.length) {
      citiesToCheck = body.cities;
    } else {
      // Default: check all cities with active subscribers
      const { data: activeCities } = await supabase
        .from("notification_preferences")
        .select("city")
        .or("vibe_shifts_enabled.eq.true,spike_alerts_enabled.eq.true,keyword_alerts_enabled.eq.true");

      if (activeCities) {
        citiesToCheck = [...new Set(activeCities.map((c) => c.city))];
      }
    }

    if (citiesToCheck.length === 0) {
      return NextResponse.json({
        message: "No cities to check",
        results: [],
      });
    }

    const checkSpikes = body.checkSpikes !== false;
    const checkVibeShifts = body.checkVibeShifts !== false;
    const checkKeywords = body.checkKeywords !== false;

    const results: Array<{
      city: string;
      spikeSent?: boolean;
      vibeShiftSent?: boolean;
      keywordsSent?: string[];
      error?: string;
    }> = [];

    for (const city of citiesToCheck) {
      try {
        const result = await checkCityNotifications(supabase, city, {
          checkSpikes,
          checkVibeShifts,
          checkKeywords,
        });
        results.push({ city, ...result });
      } catch (err) {
        console.error(`[trigger] Error checking ${city}:`, err);
        results.push({
          city,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Checked ${citiesToCheck.length} cities`,
      results,
    });
  } catch (err) {
    console.error("[trigger] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Check notifications for a single city
 */
async function checkCityNotifications(
  supabase: AnySupabaseClient,
  city: string,
  options: { checkSpikes: boolean; checkVibeShifts: boolean; checkKeywords: boolean }
): Promise<{
  spikeSent?: boolean;
  vibeShiftSent?: boolean;
  keywordsSent?: string[];
}> {
  const result: {
    spikeSent?: boolean;
    vibeShiftSent?: boolean;
    keywordsSent?: string[];
  } = {};

  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  const previousHour = new Date(currentHour);
  previousHour.setHours(previousHour.getHours() - 1);

  // Fetch current vibe velocity stats
  const { data: currentStats } = await supabase
    .from("vibe_velocity_stats")
    .select("*")
    .eq("city", city)
    .eq("hour_bucket", currentHour.toISOString())
    .single();

  // Fetch previous hour stats for vibe shift detection
  const { data: previousStats } = await supabase
    .from("vibe_velocity_stats")
    .select("*")
    .eq("city", city)
    .eq("hour_bucket", previousHour.toISOString())
    .single();

  // Calculate 7-day rolling average for same hour of day
  const sevenDaysAgo = new Date(currentHour);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: historicalStats } = await supabase
    .from("vibe_velocity_stats")
    .select("pulse_count, hour_bucket")
    .eq("city", city)
    .gte("hour_bucket", sevenDaysAgo.toISOString())
    .lt("hour_bucket", currentHour.toISOString());

  // Calculate rolling average (same hour of day)
  const sameHourStats = (historicalStats || []).filter((s: { pulse_count: number; hour_bucket: string }) => {
    const hourBucket = new Date(s.hour_bucket);
    return hourBucket.getHours() === currentHour.getHours();
  });

  const rollingAvg =
    sameHourStats.length > 0
      ? sameHourStats.reduce((sum, s) => sum + s.pulse_count, 0) / sameHourStats.length
      : null;

  // Check for spike alert
  if (options.checkSpikes && currentStats) {
    const shouldAlert = shouldTriggerSpikeAlert(
      currentStats.pulse_count,
      rollingAvg
    );

    if (shouldAlert) {
      const percentIncrease = rollingAvg
        ? Math.round((currentStats.pulse_count / rollingAvg - 1) * 100)
        : 100;

      const payload: SpikeAlertPayload = {
        type: "spike_alert",
        city,
        currentHourCount: currentStats.pulse_count,
        rollingAverage: rollingAvg || 0,
        percentIncrease,
        dominantMood: currentStats.dominant_mood,
        dominantTag: null, // Would need to fetch from pulses
      };

      const sendResult = await sendCityNotification(city, "spike_alert", payload);
      result.spikeSent = sendResult.sent > 0;
    }
  }

  // Check for vibe shift
  if (options.checkVibeShifts && currentStats && previousStats) {
    const currentIntensity = await calculateVibeIntensity(supabase, city, currentHour);
    const previousIntensity = previousStats.vibe_intensity as VibeIntensity | null;

    if (currentIntensity && previousIntensity) {
      const shift = detectVibeShift(previousIntensity, currentIntensity);

      if (shift.shifted) {
        const payload: VibeShiftPayload = {
          type: "vibe_shift",
          city,
          previousVibe: previousIntensity,
          currentVibe: currentIntensity,
          dominantMood: currentStats.dominant_mood,
          dominantMoodPercent: currentStats.dominant_mood_percent || 0,
          pulseCount: currentStats.pulse_count,
        };

        const sendResult = await sendCityNotification(city, "vibe_shift", payload);
        result.vibeShiftSent = sendResult.sent > 0;

        // Update current stats with calculated intensity
        await supabase
          .from("vibe_velocity_stats")
          .update({ vibe_intensity: currentIntensity })
          .eq("city", city)
          .eq("hour_bucket", currentHour.toISOString());
      }
    }
  }

  // Check for keyword clusters
  if (options.checkKeywords) {
    // Get all keyword subscribers for this city
    const { data: keywordPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id, alert_keywords")
      .eq("city", city)
      .eq("keyword_alerts_enabled", true);

    if (keywordPrefs?.length) {
      // Collect all unique keywords being watched
      const allKeywords = new Set<string>();
      for (const pref of keywordPrefs) {
        const keywords = pref.alert_keywords as string[] | null;
        if (keywords) {
          keywords.forEach((k) => allKeywords.add(k.toLowerCase()));
        }
      }

      if (allKeywords.size > 0) {
        // Fetch recent pulses for this city
        const oneHourAgo = new Date(now);
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const { data: recentPulses } = await supabase
          .from("pulses")
          .select("id, message, created_at")
          .eq("city", city)
          .gte("created_at", oneHourAgo.toISOString());

        if (recentPulses?.length) {
          const clusters = findKeywordClusters(
            recentPulses,
            [...allKeywords],
            60
          );

          result.keywordsSent = [];

          for (const [keyword, pulseIds] of clusters) {
            const payload: KeywordClusterPayload = {
              type: "keyword_cluster",
              city,
              keyword,
              matchCount: pulseIds.length,
              radiusMiles: 1.0,
              recentPulseIds: pulseIds,
            };

            const sendResult = await sendCityNotification(
              city,
              "keyword_cluster",
              payload
            );

            if (sendResult.sent > 0) {
              result.keywordsSent.push(keyword);
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Calculate current vibe intensity from city context
 * Mirrors the logic in /api/city-mood
 */
async function calculateVibeIntensity(
  supabase: AnySupabaseClient,
  city: string,
  hour: Date
): Promise<VibeIntensity> {
  const { data: stats } = await supabase
    .from("vibe_velocity_stats")
    .select("pulse_count, dominant_mood_percent")
    .eq("city", city)
    .eq("hour_bucket", hour.toISOString())
    .single();

  if (!stats) return "quiet";

  const pulsesPerHour = stats.pulse_count;
  const dominantPercent = stats.dominant_mood_percent || 0;

  // Simple activity score calculation
  let activityScore = pulsesPerHour * 2;

  // Strong mood consensus adds to intensity
  if (dominantPercent >= 70) activityScore += 2;
  else if (dominantPercent >= 50) activityScore += 1;

  if (activityScore >= 6) return "intense";
  if (activityScore >= 4) return "buzzing";
  if (activityScore >= 1) return "active";
  return "quiet";
}

/**
 * GET /api/notifications/trigger
 *
 * Health check for cron job
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Bat Signal trigger endpoint ready",
    timestamp: new Date().toISOString(),
  });
}
