/**
 * API route for user gamification stats
 * GET /api/gamification/stats?userId=<uuid>
 *
 * Returns:
 * - User stats (pulse counts, reactions, streaks)
 * - Earned badges
 * - Level and XP
 * - Weekly leaderboard rank
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTierFromRank, calculateLevel } from "@/lib/gamification";

export const dynamic = "force-dynamic";

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      );
    }

    // Fetch user stats
    const { data: stats, error: statsError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Handle missing table gracefully (table may not be created yet)
    const isTableMissing = statsError?.code === "42P01" ||
      statsError?.message?.includes("does not exist");

    // User may not have stats yet (no pulses posted) or table not created
    const userStats = (stats && !isTableMissing) ? stats : {
      user_id: userId,
      pulse_count_total: 0,
      pulse_count_traffic: 0,
      pulse_count_weather: 0,
      pulse_count_events: 0,
      pulse_count_general: 0,
      reactions_received_total: 0,
      reactions_fire_received: 0,
      reactions_eyes_received: 0,
      reactions_check_received: 0,
      current_streak_days: 0,
      longest_streak_days: 0,
      last_pulse_date: null,
      pulses_this_week: 0,
      pulses_this_month: 0,
      reactions_this_week: 0,
      reactions_this_month: 0,
      level: 1,
      xp_total: 0,
    };

    // Fetch earned badges (handle missing table)
    let userBadges: unknown[] = [];
    try {
      const { data: badgesData, error: badgesError } = await supabase
        .from("user_badges")
        .select(`
          id,
          badge_id,
          earned_at,
          expires_at,
          current_progress,
          badge_definitions (
            id,
            name,
            description,
            icon,
            category,
            required_tag,
            tier,
            required_pulse_count,
            required_reaction_count,
            required_streak_days,
            display_order
          )
        `)
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });

      if (!badgesError) {
        userBadges = badgesData || [];
      }
    } catch {
      // Table doesn't exist yet, return empty badges
    }

    // Fetch user's weekly rank (handle missing table)
    let rankData: { rank: number; score: number } | null = null;
    try {
      const { data } = await supabase
        .from("leaderboard_cache")
        .select("rank, score")
        .eq("user_id", userId)
        .eq("period", "weekly")
        .is("city", null)
        .single();
      rankData = data;
    } catch {
      // Table doesn't exist yet
    }

    // Fetch username
    const { data: profile } = await supabase
      .from("profiles")
      .select("anon_name")
      .eq("id", userId)
      .single();

    // Map badges to expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badges = (userBadges || []).map((ub: any) => {
      // Supabase returns badge_definitions as an object (single relation)
      const bd = ub.badge_definitions;
      return {
        id: ub.id,
        badgeId: ub.badge_id,
        earnedAt: ub.earned_at,
        expiresAt: ub.expires_at,
        currentProgress: ub.current_progress,
        badge: bd ? {
          id: bd.id,
          name: bd.name,
          description: bd.description,
          icon: bd.icon,
          category: bd.category,
          requiredTag: bd.required_tag,
          tier: bd.tier,
          requiredPulseCount: bd.required_pulse_count,
          requiredReactionCount: bd.required_reaction_count,
          requiredStreakDays: bd.required_streak_days,
          displayOrder: bd.display_order,
        } : null,
      };
    }).filter((b: { badge: unknown }) => b.badge !== null);

    const weeklyRank = rankData?.rank ?? null;
    const tier = getTierFromRank(weeklyRank);

    return NextResponse.json({
      userId,
      username: profile?.anon_name ?? "Anonymous",
      level: userStats.level || calculateLevel(userStats.xp_total || 0),
      xp: userStats.xp_total || 0,
      tier: {
        name: tier.name,
        label: tier.label,
      },
      weeklyRank,
      stats: {
        userId: userStats.user_id,
        pulseCountTotal: userStats.pulse_count_total,
        pulseCountTraffic: userStats.pulse_count_traffic,
        pulseCountWeather: userStats.pulse_count_weather,
        pulseCountEvents: userStats.pulse_count_events,
        pulseCountGeneral: userStats.pulse_count_general,
        reactionsReceivedTotal: userStats.reactions_received_total,
        reactionsFireReceived: userStats.reactions_fire_received,
        reactionsEyesReceived: userStats.reactions_eyes_received,
        reactionsCheckReceived: userStats.reactions_check_received,
        currentStreakDays: userStats.current_streak_days,
        longestStreakDays: userStats.longest_streak_days,
        lastPulseDate: userStats.last_pulse_date,
        pulsesThisWeek: userStats.pulses_this_week,
        pulsesThisMonth: userStats.pulses_this_month,
        reactionsThisWeek: userStats.reactions_this_week,
        reactionsThisMonth: userStats.reactions_this_month,
      },
      badges,
      topBadge: badges.length > 0 ? badges[0] : null,
    });
  } catch (err) {
    console.error("[/api/gamification/stats] Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
