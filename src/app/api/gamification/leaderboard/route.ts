/**
 * API route for leaderboard data
 * GET /api/gamification/leaderboard?period=weekly&city=Austin&limit=25
 *
 * Returns paginated leaderboard entries with optional city filter
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type LeaderboardPeriod = "weekly" | "monthly" | "alltime";

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
    const period = (searchParams.get("period") || "weekly") as LeaderboardPeriod;
    const city = searchParams.get("city") || null;
    const limitStr = searchParams.get("limit") || "25";
    const userId = searchParams.get("userId") || null;

    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 25));

    // Validate period
    if (!["weekly", "monthly", "alltime"].includes(period)) {
      return NextResponse.json(
        { error: "Invalid period. Must be weekly, monthly, or alltime." },
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

    // Build query
    let query = supabase
      .from("leaderboard_cache")
      .select("*")
      .eq("period", period)
      .order("rank", { ascending: true })
      .limit(limit);

    if (city) {
      query = query.eq("city", city);
    } else {
      query = query.is("city", null);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error("[/api/gamification/leaderboard] Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Unable to fetch leaderboard" },
        { status: 500 }
      );
    }

    // Get current user's rank if provided
    let userRank: number | null = null;
    if (userId) {
      let userQuery = supabase
        .from("leaderboard_cache")
        .select("rank")
        .eq("user_id", userId)
        .eq("period", period);

      if (city) {
        userQuery = userQuery.eq("city", city);
      } else {
        userQuery = userQuery.is("city", null);
      }

      const { data: userData } = await userQuery.single();
      userRank = userData?.rank ?? null;
    }

    // Get total users count
    let countQuery = supabase
      .from("leaderboard_cache")
      .select("*", { count: "exact", head: true })
      .eq("period", period);

    if (city) {
      countQuery = countQuery.eq("city", city);
    } else {
      countQuery = countQuery.is("city", null);
    }

    const { count: totalUsers } = await countQuery;

    // Map to response format
    const entries = (data || []).map((row: {
      user_id: string;
      username: string;
      rank: number;
      score: number;
      pulse_count: number;
      reaction_count: number;
      period: string;
      city: string | null;
    }) => ({
      userId: row.user_id,
      username: row.username,
      rank: row.rank,
      score: row.score,
      pulseCount: row.pulse_count,
      reactionCount: row.reaction_count,
      period: row.period,
      city: row.city,
    }));

    return NextResponse.json({
      entries,
      period,
      city,
      userRank,
      totalUsers: totalUsers ?? entries.length,
    });
  } catch (err) {
    console.error("[/api/gamification/leaderboard] Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
