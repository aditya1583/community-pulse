/**
 * API Route: Get Active Challenges
 *
 * GET /api/challenges?city=Leander&userIdentifier=abc123
 *
 * Returns all active, non-expired challenges for a city.
 * Includes user claim status when userIdentifier is provided.
 *
 * Philosophy: Challenges should feel like discoveries, not obligations.
 * The API returns just enough to spark curiosity without overwhelming.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Safe getter for Supabase client (runtime only)
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// ============================================================================
// TYPES
// ============================================================================

interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  target_lat: number;
  target_lng: number;
  radius_meters: number;
  location_name: string;
  location_address: string | null;
  xp_reward: number;
  max_claims: number | null;
  claims_count: number;
  spots_remaining: number | null;
  expires_at: string;
  challenge_type: "checkin" | "photo" | "trail";
  trail_id: string | null;
  trail_title: string | null;
  trail_order: number | null;
  user_has_claimed: boolean;
}

interface FormattedChallenge {
  id: string;
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  locationName: string;
  locationAddress: string | null;
  xpReward: number;
  maxClaims: number | null;
  claimsCount: number;
  spotsRemaining: number | null;
  expiresAt: string;
  challengeType: "checkin" | "photo" | "trail";
  trailId: string | null;
  trailTitle: string | null;
  trailOrder: number | null;
  userHasClaimed: boolean;
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const userIdentifier = searchParams.get("userIdentifier") || null;

  // Validate city parameter
  if (!city) {
    return NextResponse.json(
      { error: "City parameter is required", challenges: [] },
      { status: 400 }
    );
  }

  try {
    // Call the database function to get active challenges
    const { data, error } = await getSupabase().rpc("get_active_challenges", {
      p_city: city,
      p_user_identifier: userIdentifier,
    });

    if (error) {
      console.error("[challenges] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch challenges", challenges: [] },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase for frontend consumption
    const challenges: FormattedChallenge[] = (data as ChallengeRow[] || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      targetLat: row.target_lat,
      targetLng: row.target_lng,
      radiusMeters: row.radius_meters,
      locationName: row.location_name,
      locationAddress: row.location_address,
      xpReward: row.xp_reward,
      maxClaims: row.max_claims,
      claimsCount: row.claims_count,
      spotsRemaining: row.spots_remaining,
      expiresAt: row.expires_at,
      challengeType: row.challenge_type,
      trailId: row.trail_id,
      trailTitle: row.trail_title,
      trailOrder: row.trail_order,
      userHasClaimed: row.user_has_claimed,
    }));

    console.log(
      `[challenges] Fetched ${challenges.length} challenges for ${city}` +
      (userIdentifier ? ` (user: ${userIdentifier.slice(0, 8)}...)` : "")
    );

    return NextResponse.json({
      city,
      challenges,
      count: challenges.length,
    });

  } catch (err) {
    console.error("[challenges] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch challenges", challenges: [] },
      { status: 500 }
    );
  }
}
