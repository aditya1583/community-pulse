/**
 * API route for pulse reactions
 * Handles toggling reactions (fire, eyes, check) on pulses
 *
 * POST /api/pulses/[id]/react - Toggle a reaction
 * GET /api/pulses/[id]/react - Get reaction counts and user's reactions
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyReaction } from "@/lib/notificationTriggers";

export const dynamic = "force-dynamic";
// Valid reaction types
const VALID_REACTION_TYPES = ["fire", "eyes", "check"] as const;
type ReactionType = (typeof VALID_REACTION_TYPES)[number];

// Create Supabase client with service role for unrestricted access
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[/api/pulses/[id]/react] Missing Supabase configuration");
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

/**
 * POST /api/pulses/[id]/react
 * Toggle a reaction on a pulse
 *
 * Request body:
 * {
 *   reactionType: 'fire' | 'eyes' | 'check',
 *   userIdentifier: string  // The user's anonymous username
 * }
 *
 * Response:
 * {
 *   fire: number,
 *   eyes: number,
 *   check: number,
 *   userReactions: string[]  // e.g., ['fire', 'check']
 * }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const pulseId = params.id;

    if (!pulseId || isNaN(Number(pulseId))) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { reactionType, userIdentifier } = body as {
      reactionType?: string;
      userIdentifier?: string;
    };

    // Validate reactionType
    if (!reactionType || !VALID_REACTION_TYPES.includes(reactionType as ReactionType)) {
      return NextResponse.json(
        { error: "Invalid reaction type. Must be 'fire', 'eyes', or 'check'." },
        { status: 400 }
      );
    }

    // Validate userIdentifier
    if (!userIdentifier || typeof userIdentifier !== "string" || !userIdentifier.trim()) {
      return NextResponse.json(
        { error: "User identifier is required" },
        { status: 400 }
      );
    }

    const trimmedUserIdentifier = userIdentifier.trim();

    // Check if the pulse exists
    const { data: pulse, error: pulseError } = await supabase
      .from("pulses")
      .select("id, user_id, message")
      .eq("id", pulseId)
      .single();

    if (pulseError || !pulse) {
      return NextResponse.json(
        { error: "Pulse not found" },
        { status: 404 }
      );
    }

    // Check if user already has this reaction
    const { data: existingReaction, error: fetchError } = await supabase
      .from("pulse_reactions")
      .select("id")
      .eq("pulse_id", pulseId)
      .eq("user_identifier", trimmedUserIdentifier)
      .eq("reaction_type", reactionType)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned (expected when reaction doesn't exist)
      console.error("[/api/pulses/[id]/react] Error checking existing reaction:", fetchError);
      return NextResponse.json(
        { error: "Failed to check existing reaction" },
        { status: 500 }
      );
    }

    if (existingReaction) {
      // Toggle OFF: Delete the existing reaction
      const { error: deleteError } = await supabase
        .from("pulse_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        console.error("[/api/pulses/[id]/react] Error deleting reaction:", deleteError);
        return NextResponse.json(
          { error: "Failed to remove reaction" },
          { status: 500 }
        );
      }
    } else {
      // Toggle ON: Insert new reaction
      const { error: insertError } = await supabase
        .from("pulse_reactions")
        .insert({
          pulse_id: Number(pulseId),
          user_identifier: trimmedUserIdentifier,
          reaction_type: reactionType,
        });

      if (insertError) {
        console.error("[/api/pulses/[id]/react] Error inserting reaction:", insertError);
        return NextResponse.json(
          { error: "Failed to add reaction" },
          { status: 500 }
        );
      }

      // Notify the post author about the reaction (fire and forget)
      if (pulse.user_id && pulse.user_id !== trimmedUserIdentifier) {
        notifyReaction(
          pulse.user_id,
          reactionType,
          trimmedUserIdentifier,
          pulse.message || "",
          pulseId
        ).catch(() => {});
      }
    }

    // Get updated reaction counts
    const { data: allReactions, error: countError } = await supabase
      .from("pulse_reactions")
      .select("reaction_type, user_identifier")
      .eq("pulse_id", pulseId);

    if (countError) {
      console.error("[/api/pulses/[id]/react] Error fetching reaction counts:", countError);
      return NextResponse.json(
        { error: "Failed to fetch updated counts" },
        { status: 500 }
      );
    }

    // Calculate counts
    const counts = {
      fire: 0,
      eyes: 0,
      check: 0,
    };

    const userReactions: string[] = [];

    for (const reaction of allReactions || []) {
      const type = reaction.reaction_type as ReactionType;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
      if (reaction.user_identifier === trimmedUserIdentifier) {
        userReactions.push(type);
      }
    }

    return NextResponse.json({
      ...counts,
      userReactions,
    });
  } catch (err) {
    console.error("[/api/pulses/[id]/react] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pulses/[id]/react
 * Get reaction counts and optionally the current user's reactions
 *
 * Query params:
 * - userIdentifier (optional): The user's anonymous username to check their reactions
 *
 * Response:
 * {
 *   fire: number,
 *   eyes: number,
 *   check: number,
 *   userReactions: string[]  // e.g., ['fire', 'check']
 * }
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const pulseId = params.id;

    if (!pulseId || isNaN(Number(pulseId))) {
      return NextResponse.json(
        { error: "Invalid pulse ID" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get optional userIdentifier from query params
    const { searchParams } = new URL(req.url);
    const userIdentifier = searchParams.get("userIdentifier")?.trim() || null;

    // Fetch all reactions for this pulse
    const { data: allReactions, error } = await supabase
      .from("pulse_reactions")
      .select("reaction_type, user_identifier")
      .eq("pulse_id", pulseId);

    if (error) {
      console.error("[/api/pulses/[id]/react] Error fetching reactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch reactions" },
        { status: 500 }
      );
    }

    // Calculate counts
    const counts = {
      fire: 0,
      eyes: 0,
      check: 0,
    };

    const userReactions: string[] = [];

    for (const reaction of allReactions || []) {
      const type = reaction.reaction_type as ReactionType;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
      if (userIdentifier && reaction.user_identifier === userIdentifier) {
        userReactions.push(type);
      }
    }

    return NextResponse.json({
      ...counts,
      userReactions,
    });
  } catch (err) {
    console.error("[/api/pulses/[id]/react] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
