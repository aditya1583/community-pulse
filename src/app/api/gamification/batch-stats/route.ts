/**
 * API route for batch fetching user gamification stats
 * GET /api/gamification/batch-stats?userIds=id1,id2,id3
 *
 * Returns: { [userId]: { level, rank } }
 *
 * Used for displaying author stats on pulse cards without N+1 queries.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

type AuthorStats = {
  level: number;
  rank: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdsParam = searchParams.get("userIds");

    if (!userIdsParam) {
      return NextResponse.json(
        { error: "userIds parameter is required" },
        { status: 400 }
      );
    }

    // Parse comma-separated user IDs (limit to 50 to prevent abuse)
    const userIds = userIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, 50);

    if (userIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database configuration error" },
        { status: 500 }
      );
    }

    const result: Record<string, AuthorStats> = {};

    // Fetch levels from user_stats table
    const { data: statsData, error: statsError } = await supabase
      .from("user_stats")
      .select("user_id, level")
      .in("user_id", userIds);

    // Handle missing table gracefully
    const isTableMissing =
      statsError?.code === "42P01" ||
      statsError?.message?.includes("does not exist");

    if (!isTableMissing && statsData) {
      for (const stat of statsData) {
        result[stat.user_id] = {
          level: stat.level || 1,
          rank: null,
        };
      }
    }

    // Fetch ranks from leaderboard_cache (weekly, for current city context)
    // We fetch all available ranks and let the client filter by city if needed
    const { data: rankData, error: rankError } = await supabase
      .from("leaderboard_cache")
      .select("user_id, rank")
      .eq("period", "weekly")
      .in("user_id", userIds);

    const isRankTableMissing =
      rankError?.code === "42P01" ||
      rankError?.message?.includes("does not exist");

    if (!isRankTableMissing && rankData) {
      for (const entry of rankData) {
        if (result[entry.user_id]) {
          result[entry.user_id].rank = entry.rank;
        } else {
          result[entry.user_id] = {
            level: 1,
            rank: entry.rank,
          };
        }
      }
    }

    // Fill in defaults for any user IDs that weren't found
    for (const userId of userIds) {
      if (!result[userId]) {
        result[userId] = {
          level: 1,
          rank: null,
        };
      }
    }

    return NextResponse.json({
      stats: result,
    });
  } catch (err) {
    console.error("[batch-stats] Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
