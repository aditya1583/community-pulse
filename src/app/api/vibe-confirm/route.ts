import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, buildRateLimitHeaders } from "@/lib/rateLimit";
import { getSupabaseService } from "../../../../lib/supabaseServer";

const VALID_ACTIONS = ["confirm", "contradict"] as const;
type ConfirmAction = typeof VALID_ACTIONS[number];

/**
 * GET /api/vibe-confirm?vibe_id=...
 * Get confirmation stats for a vibe
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vibeId = searchParams.get("vibe_id");
  const venueId = searchParams.get("venue_id");

  if (!vibeId && !venueId) {
    return NextResponse.json(
      { error: "vibe_id or venue_id is required" },
      { status: 400 }
    );
  }

  try {
    // If vibeId provided, get stats for specific vibe
    if (vibeId) {
      const { data, error } = await getSupabaseService()
        .from("vibe_confirmations")
        .select("action")
        .eq("vibe_id", vibeId);

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          return NextResponse.json({
            confirms: 0,
            contradicts: 0,
            majorityAction: "split",
          });
        }
        throw error;
      }

      const confirms = data?.filter((d) => d.action === "confirm").length || 0;
      const contradicts = data?.filter((d) => d.action === "contradict").length || 0;

      return NextResponse.json({
        confirms,
        contradicts,
        majorityAction:
          confirms > contradicts
            ? "confirm"
            : contradicts > confirms
              ? "contradict"
              : "split",
      });
    }

    // If venueId provided, get all vibes with their confirmation stats
    if (venueId) {
      const { data: vibes, error: vibesError } = await getSupabaseService()
        .from("venue_vibes")
        .select("id, venue_id, venue_name, vibe_type, user_id, created_at, expires_at")
        .eq("venue_id", venueId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (vibesError) {
        if (vibesError.code === "42P01" || vibesError.message?.includes("does not exist")) {
          return NextResponse.json({ vibes: [] });
        }
        throw vibesError;
      }

      // Get confirmation stats for each vibe
      const vibesWithStats = await Promise.all(
        (vibes || []).map(async (vibe) => {
          const { data: confirmations } = await getSupabaseService()
            .from("vibe_confirmations")
            .select("action")
            .eq("vibe_id", vibe.id);

          const confirms = confirmations?.filter((d) => d.action === "confirm").length || 0;
          const contradicts = confirmations?.filter((d) => d.action === "contradict").length || 0;

          // Get author's trust score
          let authorTrustScore = 50;
          let authorBadge = "newcomer";
          if (vibe.user_id) {
            const { data: trustData } = await getSupabaseService()
              .from("user_trust_scores")
              .select("trust_score")
              .eq("user_id", vibe.user_id)
              .single();

            if (trustData) {
              authorTrustScore = trustData.trust_score;
              authorBadge =
                authorTrustScore >= 90
                  ? "local_hero"
                  : authorTrustScore >= 75
                    ? "trusted_local"
                    : authorTrustScore >= 60
                      ? "regular"
                      : authorTrustScore >= 40
                        ? "newcomer"
                        : "learning";
            }
          }

          return {
            id: vibe.id,
            venueId: vibe.venue_id,
            venueName: vibe.venue_name,
            vibeType: vibe.vibe_type,
            userId: vibe.user_id,
            createdAt: vibe.created_at,
            expiresAt: vibe.expires_at,
            authorTrustScore,
            authorBadge,
            confirmCount: confirms,
            contradictCount: contradicts,
          };
        })
      );

      return NextResponse.json({ vibes: vibesWithStats });
    }

    return NextResponse.json({ vibes: [] });
  } catch (error) {
    console.error("[vibe-confirm] Error fetching confirmations:", error);
    return NextResponse.json(
      { error: "Failed to fetch confirmation stats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vibe-confirm
 * Confirm or contradict a vibe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vibeId, action, userId, city } = body;

    // Require authentication
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required to verify vibes" },
        { status: 401 }
      );
    }

    // Rate limiting - 20 confirmations per hour
    const rateLimitResult = checkRateLimit(userId, {
      limit: 20,
      windowSeconds: 3600,
      keyPrefix: "vibe-confirm",
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `You've verified too many vibes recently. Try again in ${Math.ceil(rateLimitResult.resetInSeconds / 60)} minutes.`,
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Validation
    if (!vibeId || !action) {
      return NextResponse.json(
        { error: "vibeId and action are required" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action as ConfirmAction)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the original vibe
    const { data: vibe, error: vibeError } = await getSupabaseService()
      .from("venue_vibes")
      .select("*")
      .eq("id", vibeId)
      .single();

    if (vibeError || !vibe) {
      return NextResponse.json({ error: "Vibe not found" }, { status: 404 });
    }

    // Can't confirm your own vibe
    if (vibe.user_id === userId) {
      return NextResponse.json(
        { error: "You cannot verify your own vibe" },
        { status: 400 }
      );
    }

    // Check if already confirmed
    const { data: existingConfirmation } = await getSupabaseService()
      .from("vibe_confirmations")
      .select("id, action")
      .eq("vibe_id", vibeId)
      .eq("confirmer_user_id", userId)
      .single();

    if (existingConfirmation) {
      // Update existing confirmation
      const { error: updateError } = await getSupabaseService()
        .from("vibe_confirmations")
        .update({ action, created_at: new Date().toISOString() })
        .eq("id", existingConfirmation.id);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        updated: true,
        previousAction: existingConfirmation.action,
      });
    }

    // Insert new confirmation
    const { error: insertError } = await getSupabaseService().from("vibe_confirmations").insert({
      vibe_id: vibeId,
      venue_id: vibe.venue_id,
      original_vibe_type: vibe.vibe_type,
      confirmer_user_id: userId,
      action,
      city: city || vibe.city,
    });

    if (insertError) {
      if (insertError.code === "42P01" || insertError.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Verification feature not yet enabled. Please run the database migration." },
          { status: 503 }
        );
      }
      throw insertError;
    }

    // Update trust scores
    // Confirmer gets credit
    await getSupabaseService().from("user_trust_scores").upsert(
      {
        user_id: userId,
        city: city || vibe.city || "Unknown",
        confirmations_given: 1,
        contradictions_given: action === "contradict" ? 1 : 0,
      },
      {
        onConflict: "user_id,city",
      }
    );

    // Original author gets confirmation or contradiction
    if (vibe.user_id) {
      const updateField = action === "confirm" ? "vibes_confirmed" : "vibes_contradicted";

      // Get current stats
      const { data: authorStats } = await getSupabaseService()
        .from("user_trust_scores")
        .select("*")
        .eq("user_id", vibe.user_id)
        .eq("city", city || vibe.city || "Unknown")
        .single();

      if (authorStats) {
        // Update existing
        const newVibesConfirmed =
          authorStats.vibes_confirmed + (action === "confirm" ? 1 : 0);
        const newVibesContradicted =
          authorStats.vibes_contradicted + (action === "contradict" ? 1 : 0);

        // Calculate new trust score
        const newTrustScore = Math.min(
          100,
          Math.max(
            0,
            50 +
            newVibesConfirmed * 2 -
            newVibesContradicted * 3 +
            Math.floor(authorStats.total_vibes_submitted / 10)
          )
        );

        await getSupabaseService()
          .from("user_trust_scores")
          .update({
            [updateField]: authorStats[updateField] + 1,
            trust_score: newTrustScore,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", vibe.user_id)
          .eq("city", city || vibe.city || "Unknown");
      } else {
        // Create new
        await getSupabaseService().from("user_trust_scores").insert({
          user_id: vibe.user_id,
          city: city || vibe.city || "Unknown",
          vibes_confirmed: action === "confirm" ? 1 : 0,
          vibes_contradicted: action === "contradict" ? 1 : 0,
          total_vibes_submitted: 1,
          trust_score: action === "confirm" ? 52 : 47,
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("[vibe-confirm] Error confirming vibe:", error);
    return NextResponse.json({ error: "Failed to confirm vibe" }, { status: 500 });
  }
}

/**
 * GET /api/vibe-confirm/leaderboard?city=...
 * Get trust leaderboard for a city
 */
export async function getLeaderboard(city: string, limit: number = 10) {
  const { data, error } = await getSupabaseService()
    .from("user_trust_scores")
    .select("user_id, trust_score, total_vibes_submitted, vibes_confirmed")
    .eq("city", city)
    .order("trust_score", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data?.map((row) => ({
    userId: row.user_id,
    trustScore: row.trust_score,
    badge:
      row.trust_score >= 90
        ? "local_hero"
        : row.trust_score >= 75
          ? "trusted_local"
          : row.trust_score >= 60
            ? "regular"
            : row.trust_score >= 40
              ? "newcomer"
              : "learning",
    totalVibes: row.total_vibes_submitted,
    confirmations: row.vibes_confirmed,
  }));
}

