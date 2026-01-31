/**
 * API Route: Resolve Prediction
 *
 * POST /api/pulses/:id/resolve
 *
 * Resolves a prediction and awards XP to correct voters.
 * This is a privileged operation that requires either:
 * - CRON_SECRET header (for automated resolution by cron jobs)
 * - Admin authentication (for manual resolution)
 *
 * Resolution Process:
 * 1. Verify prediction exists and is unresolved
 * 2. Mark the winning option
 * 3. Award XP to all users who voted for the winning option
 * 4. Update user_stats with prediction accuracy stats
 * 5. Return summary of resolution
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Service role client for database writes
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("SUPABASE_SERVICE_ROLE_KEY not configured", {
      service: "supabase",
      action: "config_check",
    });
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface ResolveRequest {
  winningOption: number;  // 0 or 1 for binary predictions
}

interface ResolutionResult {
  success: boolean;
  pulseId: number;
  winningOption: number;
  usersRewarded: number;
  totalXpAwarded: number;
  winningVotes: number;
  totalVotes: number;
}

/**
 * POST /api/pulses/:id/resolve
 *
 * Resolves a prediction and awards XP to winners.
 * Requires CRON_SECRET or admin authentication.
 */
export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse<ResolutionResult | { error: string }>> {
  try {
    // Authentication: CRON_SECRET or Admin
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    let isAuthorized = false;

    // Check CRON_SECRET (for automated resolution)
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }

    // TODO: Add admin role check for manual resolution
    // For now, only CRON_SECRET is supported

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Resolution requires CRON_SECRET." },
        { status: 401 }
      );
    }

    // Get service role client
    const supabase = getServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Parse request
    const params = await context.params;
    const pulseId = parseInt(params.id, 10);

    if (isNaN(pulseId)) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.winningOption !== "number") {
      return NextResponse.json(
        { error: "winningOption (0 or 1) is required" },
        { status: 400 }
      );
    }

    const { winningOption } = body as ResolveRequest;

    if (winningOption !== 0 && winningOption !== 1) {
      return NextResponse.json(
        { error: "winningOption must be 0 or 1" },
        { status: 400 }
      );
    }

    // Fetch the pulse and verify it's an unresolved prediction
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, is_prediction, prediction_resolved_at, prediction_xp_reward, poll_options")
      .eq("id", pulseId)
      .single();

    if (pulseError) {
      if (pulseError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Pulse not found" },
          { status: 404 }
        );
      }
      logger.error("Error fetching pulse for resolution", {
        service: "supabase",
        action: "pulse_fetch",
        error: pulseError.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch pulse" },
        { status: 500 }
      );
    }

    if (!pulse.is_prediction) {
      return NextResponse.json(
        { error: "Pulse is not a prediction" },
        { status: 400 }
      );
    }

    if (pulse.prediction_resolved_at) {
      return NextResponse.json(
        { error: "Prediction already resolved" },
        { status: 400 }
      );
    }

    const xpReward = pulse.prediction_xp_reward || 25;

    // Mark the prediction as resolved
    const { error: updateError } = await supabase
      .from("pulses")
      .update({
        prediction_resolved_at: new Date().toISOString(),
        prediction_winning_option: winningOption,
      })
      .eq("id", pulseId);

    if (updateError) {
      logger.error("Error marking prediction as resolved", {
        service: "supabase",
        action: "pulse_update",
        error: updateError.message,
      });
      return NextResponse.json(
        { error: "Failed to update prediction status" },
        { status: 500 }
      );
    }

    // Fetch all votes for this prediction
    const { data: votes, error: votesError } = await supabase
      .from("poll_votes")
      .select("user_identifier, option_index")
      .eq("pulse_id", pulseId);

    if (votesError) {
      logger.error("Error fetching votes for resolution", {
        service: "supabase",
        action: "votes_fetch",
        error: votesError.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch votes" },
        { status: 500 }
      );
    }

    const totalVotes = votes?.length || 0;
    const winningVotes = votes?.filter(v => v.option_index === winningOption).length || 0;

    // Award XP to winners
    let usersRewarded = 0;
    let totalXpAwarded = 0;

    if (votes && votes.length > 0) {
      // Get winners
      const winners = votes.filter(v => v.option_index === winningOption);

      // For each winner, try to find their user_id from profiles and award XP
      for (const winner of winners) {
        // Try to find user_id by anonymous name
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("anon_name", winner.user_identifier)
          .single();

        // Insert reward record
        const { error: rewardError } = await supabase
          .from("prediction_rewards")
          .insert({
            pulse_id: pulseId,
            user_identifier: winner.user_identifier,
            user_id: profile?.id || null,
            option_voted: winner.option_index,
            xp_awarded: xpReward,
          })
          .select()
          .single();

        if (rewardError) {
          // Might be duplicate, skip
          if (rewardError.code !== "23505") {  // Not a unique violation
            logger.warn("Error inserting prediction reward", {
              service: "supabase",
              action: "reward_insert",
              error: rewardError.message,
            });
          }
          continue;
        }

        usersRewarded++;
        totalXpAwarded += xpReward;

        // Update user_stats if we have their user_id
        if (profile?.id) {
          const { error: statsError } = await supabase
            .from("user_stats")
            .update({
              predictions_correct: supabase.rpc("increment", { x: 1 }),
              prediction_xp_earned: supabase.rpc("increment", { x: xpReward }),
              xp_total: supabase.rpc("increment", { x: xpReward }),
            })
            .eq("user_id", profile.id);

          if (statsError) {
            // Try to insert if doesn't exist
            await supabase
              .from("user_stats")
              .upsert({
                user_id: profile.id,
                predictions_correct: 1,
                prediction_xp_earned: xpReward,
                xp_total: xpReward,
              }, {
                onConflict: "user_id",
              });
          }
        }
      }
    }

    logger.info("Prediction resolved successfully", {
      service: "predictions",
      action: "resolve",
      pulseId,
      winningOption,
      usersRewarded,
      totalXpAwarded,
    });

    return NextResponse.json({
      success: true,
      pulseId,
      winningOption,
      usersRewarded,
      totalXpAwarded,
      winningVotes,
      totalVotes,
    });

  } catch (err) {
    logger.error("Unexpected error resolving prediction", {
      action: "prediction_resolve",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pulses/:id/resolve
 *
 * Get prediction resolution status and details.
 * Public endpoint - anyone can view resolution status.
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const params = await context.params;
    const pulseId = parseInt(params.id, 10);

    if (isNaN(pulseId)) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    // Fetch prediction status
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select(`
        id,
        is_prediction,
        prediction_resolves_at,
        prediction_resolved_at,
        prediction_winning_option,
        prediction_xp_reward,
        prediction_category,
        poll_options
      `)
      .eq("id", pulseId)
      .single();

    if (pulseError) {
      if (pulseError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Pulse not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch prediction status" },
        { status: 500 }
      );
    }

    if (!pulse.is_prediction) {
      return NextResponse.json(
        { error: "Pulse is not a prediction" },
        { status: 400 }
      );
    }

    // Get vote counts
    const { data: votes } = await supabase
      .from("poll_votes")
      .select("option_index")
      .eq("pulse_id", pulseId);

    const voteCounts: Record<number, number> = {};
    votes?.forEach(v => {
      voteCounts[v.option_index] = (voteCounts[v.option_index] || 0) + 1;
    });

    // Get user's reward if resolved and they have a userIdentifier header
    let userReward = null;
    const userIdentifier = req.headers.get("x-user-identifier");
    if (userIdentifier && pulse.prediction_resolved_at) {
      const { data: reward } = await supabase
        .from("prediction_rewards")
        .select("xp_awarded")
        .eq("pulse_id", pulseId)
        .eq("user_identifier", userIdentifier)
        .single();

      if (reward) {
        userReward = reward.xp_awarded;
      }
    }

    return NextResponse.json({
      pulseId,
      isPrediction: true,
      resolvesAt: pulse.prediction_resolves_at,
      resolvedAt: pulse.prediction_resolved_at,
      winningOption: pulse.prediction_winning_option,
      xpReward: pulse.prediction_xp_reward,
      category: pulse.prediction_category,
      options: pulse.poll_options,
      voteCounts,
      totalVotes: votes?.length || 0,
      userReward,
    });

  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
