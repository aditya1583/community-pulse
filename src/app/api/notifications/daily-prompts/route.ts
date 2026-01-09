/**
 * POST /api/notifications/daily-prompts
 *
 * Send time-based engagement prompts to users.
 * Called by Vercel Cron at specific times:
 * - 7:30 AM (morning commute)
 * - 12:00 PM (lunch check)
 * - 6:00 PM (evening dinner)
 * - 10:00 AM Saturday/Sunday (weekend plans)
 *
 * These prompts encourage users to share what's happening in their city.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCityNotification } from "@/lib/pushNotifications";
import { logger } from "@/lib/logger";
import type { EngagementPromptPayload } from "@/lib/batSignal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PromptType = "morning_commute" | "lunch_check" | "evening_dinner" | "weekend_plans";

const PROMPTS: Record<PromptType, string[]> = {
  morning_commute: [
    "How's the morning commute looking?",
    "Is traffic moving? Help your neighbors plan their route.",
    "Spotted anything interesting on your way to work?",
    "How's the coffee line at your spot today?",
  ],
  lunch_check: [
    "Where's the lunch rush happening?",
    "Any food truck lines worth the wait?",
    "Found a hidden gem for lunch? Share it!",
    "What's the vibe downtown today?",
  ],
  evening_dinner: [
    "Heading out for dinner? What looks good?",
    "How's the evening traffic shaping up?",
    "Any restaurant wait times worth knowing?",
    "What's happening in your neighborhood tonight?",
  ],
  weekend_plans: [
    "What's worth checking out this weekend?",
    "Any good farmers markets or events happening?",
    "Where's the best brunch spot today?",
    "What's the weekend vibe in your area?",
  ],
};

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAuthorized(req: NextRequest): boolean {
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
  return false;
}

function getRandomPrompt(promptType: PromptType): string {
  const prompts = PROMPTS[promptType];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Determine prompt type based on time in a specific timezone
 * Vercel crons run in UTC, so we need to convert to target timezone
 */
function determinePromptType(timezone: string = "America/Chicago"): PromptType {
  // Get current time in the target timezone
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    hour12: false,
    weekday: "short",
    timeZone: timezone,
  };

  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(now);

  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "12", 10);
  const weekday = parts.find(p => p.type === "weekday")?.value || "";
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  // Weekend (Saturday or Sunday) before noon
  if (isWeekend && hour < 14) {
    return "weekend_plans";
  }

  // Morning (7-10 AM)
  if (hour >= 7 && hour < 10) {
    return "morning_commute";
  }

  // Lunch (11 AM - 2 PM)
  if (hour >= 11 && hour < 14) {
    return "lunch_check";
  }

  // Evening (5-8 PM)
  if (hour >= 17 && hour < 20) {
    return "evening_dinner";
  }

  // Default to lunch check if called at other times
  return "lunch_check";
}

type DailyPromptsBody = {
  promptType?: PromptType;
  timezone?: string;
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
    // Parse request body for optional overrides
    const body: DailyPromptsBody = await req.json().catch(() => ({}));

    // Allow explicit prompt type override, or determine from timezone
    const timezone = body.timezone || "America/Chicago";
    const promptType = body.promptType || determinePromptType(timezone);
    const promptText = getRandomPrompt(promptType);

    logger.info("Sending daily prompts", {
      action: "daily_prompts",
      promptType,
      timezone,
    });

    // Get all cities with active push subscribers
    const { data: activeCities } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .eq("is_active", true);

    if (!activeCities?.length) {
      return NextResponse.json({
        message: "No active subscribers",
        promptType,
        sent: 0,
      });
    }

    // Get unique cities from user profiles
    const userIds = [...new Set(activeCities.map((s) => s.user_id))];

    const { data: userProfiles } = await supabase
      .from("profiles")
      .select("city")
      .in("id", userIds)
      .not("city", "is", null);

    if (!userProfiles?.length) {
      return NextResponse.json({
        message: "No users with cities configured",
        promptType,
        sent: 0,
      });
    }

    // Get unique cities
    const cities = [...new Set(userProfiles.map((p) => p.city).filter(Boolean))];

    let totalSent = 0;
    let totalFailed = 0;

    for (const city of cities) {
      const payload: EngagementPromptPayload = {
        type: "engagement_prompt",
        city,
        promptType,
        promptText,
      };

      const result = await sendCityNotification(city, "engagement_prompt", payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return NextResponse.json({
      message: `Sent ${promptType} prompts`,
      promptType,
      promptText,
      cities: cities.length,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (err) {
    logger.error("Daily prompts error", {
      action: "daily_prompts",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Daily prompts endpoint ready",
    currentPromptType: determinePromptType(),
    timestamp: new Date().toISOString(),
  });
}
