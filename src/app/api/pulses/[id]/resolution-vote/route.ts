import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/pulses/[id]/resolution-vote
 *
 * Cast a vote on what the actual outcome was for a community-resolved prediction.
 * This is used AFTER the prediction deadline passes.
 *
 * Body: { votedOutcome: 0 | 1, userIdentifier: string }
 * - votedOutcome 0 = "Option A happened"
 * - votedOutcome 1 = "Option B happened"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: pulseId } = await params;

  try {
    const body = await request.json();
    const { votedOutcome, userIdentifier } = body;

    // Validate inputs
    if (votedOutcome !== 0 && votedOutcome !== 1) {
      return NextResponse.json(
        { error: "votedOutcome must be 0 or 1" },
        { status: 400 }
      );
    }

    if (!userIdentifier || typeof userIdentifier !== "string") {
      return NextResponse.json(
        { error: "userIdentifier is required" },
        { status: 400 }
      );
    }

    const pulseIdNum = parseInt(pulseId, 10);
    if (isNaN(pulseIdNum)) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    // Need service role for RPC call
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server not configured for resolution voting" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function
    const { data, error } = await supabase.rpc("cast_resolution_vote", {
      p_pulse_id: pulseIdNum,
      p_user_identifier: userIdentifier,
      p_user_id: null, // Could pass auth user ID if available
      p_voted_outcome: votedOutcome,
    });

    if (error) {
      console.error("[ResolutionVote] Database error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const result = data?.[0];
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message || "Failed to cast vote" },
        { status: 400 }
      );
    }

    console.log(
      `[ResolutionVote] Vote cast for pulse ${pulseId}: outcome=${votedOutcome}, tally A=${result.current_tally_a}, B=${result.current_tally_b} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json({
      success: true,
      message: result.message,
      tally: {
        optionA: result.current_tally_a,
        optionB: result.current_tally_b,
      },
    });
  } catch (err) {
    console.error("[ResolutionVote] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pulses/[id]/resolution-vote
 *
 * Get current resolution voting status for a prediction
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pulseId } = await params;

  try {
    const pulseIdNum = parseInt(pulseId, 10);
    if (isNaN(pulseIdNum)) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get pulse info
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, is_prediction, prediction_resolves_at, prediction_resolved_at, prediction_winning_option, prediction_data_source, resolution_voting_ends_at, resolution_vote_count, poll_options")
      .eq("id", pulseIdNum)
      .single();

    if (pulseError || !pulse) {
      return NextResponse.json(
        { error: "Prediction not found" },
        { status: 404 }
      );
    }

    if (!pulse.is_prediction) {
      return NextResponse.json(
        { error: "Not a prediction" },
        { status: 400 }
      );
    }

    // Get vote tally
    const { data: votes } = await supabase
      .from("prediction_resolution_votes")
      .select("voted_outcome, was_original_predictor")
      .eq("pulse_id", pulseIdNum);

    let tallyA = 0;
    let tallyB = 0;

    if (votes) {
      for (const vote of votes) {
        const weight = vote.was_original_predictor ? 2 : 1;
        if (vote.voted_outcome === 0) {
          tallyA += weight;
        } else {
          tallyB += weight;
        }
      }
    }

    // Determine status
    const now = new Date();
    const resolvesAt = pulse.prediction_resolves_at ? new Date(pulse.prediction_resolves_at) : null;
    const resolutionEndsAt = pulse.resolution_voting_ends_at ? new Date(pulse.resolution_voting_ends_at) : null;

    let status: "prediction_active" | "resolution_voting" | "resolved" | "cancelled";

    if (pulse.prediction_resolved_at) {
      status = pulse.prediction_winning_option === -1 ? "cancelled" : "resolved";
    } else if (resolvesAt && now > resolvesAt) {
      status = "resolution_voting";
    } else {
      status = "prediction_active";
    }

    return NextResponse.json({
      status,
      dataSource: pulse.prediction_data_source,
      predictionDeadline: pulse.prediction_resolves_at,
      resolutionVotingEndsAt: pulse.resolution_voting_ends_at,
      isResolved: !!pulse.prediction_resolved_at,
      winningOption: pulse.prediction_winning_option,
      tally: {
        optionA: tallyA,
        optionB: tallyB,
        totalVotes: pulse.resolution_vote_count || 0,
      },
      options: pulse.poll_options,
    });
  } catch (err) {
    console.error("[ResolutionVote] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
