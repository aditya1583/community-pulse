/**
 * API Route: Claim a Challenge
 *
 * POST /api/challenges/[id]/claim
 *
 * Verifies GPS coordinates, checks eligibility, awards XP, and updates stats.
 * Uses the database function `claim_challenge` for atomic operations.
 *
 * Philosophy: Trust but verify. GPS coordinates are the handshake between
 * digital intent and physical presence. When users show up, we reward them.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper to get supabase client safely (runtime only)
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// ============================================================================
// TYPES
// ============================================================================

interface ClaimRequest {
  userIdentifier: string;
  userId?: string; // Optional UUID for authenticated users
  verificationLat: number;
  verificationLng: number;
  photoPulseId?: number; // For photo challenges
}

interface ClaimResult {
  success: boolean;
  message: string;
  xp_awarded: number;
  new_total_xp: number | null;
  badge_earned: string | null;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate GPS coordinates are within reasonable bounds
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: challengeId } = await params;

    // Validate challenge ID format
    if (!challengeId || !isValidUUID(challengeId)) {
      return NextResponse.json(
        { success: false, message: "Invalid challenge ID" },
        { status: 400 }
      );
    }

    // Parse request body
    let body: ClaimRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.userIdentifier) {
      return NextResponse.json(
        { success: false, message: "User identifier is required" },
        { status: 400 }
      );
    }

    // Validate GPS coordinates
    if (!isValidCoordinate(body.verificationLat, body.verificationLng)) {
      return NextResponse.json(
        { success: false, message: "Invalid GPS coordinates" },
        { status: 400 }
      );
    }

    // Prepare user ID for database (NULL if not provided/invalid)
    const userId = body.userId && isValidUUID(body.userId) ? body.userId : null;

    // Call the database function to claim the challenge
    // This handles all validation, distance checks, and XP awards atomically
    const { data, error } = await getSupabase().rpc("claim_challenge", {
      p_challenge_id: challengeId,
      p_user_identifier: body.userIdentifier,
      p_user_id: userId,
      p_verification_lat: body.verificationLat,
      p_verification_lng: body.verificationLng,
    });

    if (error) {
      console.error("[challenges/claim] Database error:", error);
      return NextResponse.json(
        { success: false, message: "Failed to claim challenge. Please try again." },
        { status: 500 }
      );
    }

    // Extract result from database function
    const result: ClaimResult = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Unexpected error processing claim" },
        { status: 500 }
      );
    }

    // Log the result
    const elapsed = Date.now() - startTime;
    console.log(
      `[challenges/claim] ${result.success ? "SUCCESS" : "FAILED"} ` +
      `challenge=${challengeId} user=${body.userIdentifier} ` +
      `xp=${result.xp_awarded || 0} badge=${result.badge_earned || "none"} ` +
      `time=${elapsed}ms`
    );

    // Return appropriate response based on success
    if (!result.success) {
      // Determine appropriate HTTP status code
      const message = result.message.toLowerCase();
      let status = 400;

      if (message.includes("not found")) status = 404;
      else if (message.includes("expired")) status = 410;
      else if (message.includes("already claimed")) status = 409;
      else if (message.includes("spots") || message.includes("claimed")) status = 409;
      else if (message.includes("meters away")) status = 403;

      return NextResponse.json(
        { success: false, message: result.message },
        { status }
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: result.message,
      xpAwarded: result.xp_awarded,
      newTotalXp: result.new_total_xp,
      badgeEarned: result.badge_earned,
    });

  } catch (err) {
    console.error("[challenges/claim] Unexpected error:", err);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
