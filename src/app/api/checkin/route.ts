/**
 * API route for venue check-ins
 *
 * Allows authenticated users to check in at venues.
 * Check-ins are limited to once per venue per day per user.
 *
 * Used by:
 * - QR code scans at partner venues
 * - Manual check-in from venue detail page
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseService } from "../../../lib/supabaseServer";

type CheckInRequest = {
  venue_name: string;
  venue_id?: string;
  venue_lat?: number;
  venue_lon?: number;
  city?: string;
  user_id: string;
};

/**
 * POST /api/checkin
 *
 * Create a check-in for a user at a venue.
 * Returns 409 if user already checked in today.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CheckInRequest = await request.json();

    // Validate required fields
    if (!body.venue_name || !body.user_id) {
      return NextResponse.json(
        { error: "venue_name and user_id are required" },
        { status: 400 }
      );
    }

    // Check for existing check-in today using checkin_date field
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: existingCheckin } = await getSupabaseService()
      .from("venue_checkins")
      .select("id")
      .eq("user_id", body.user_id)
      .eq("venue_name", body.venue_name)
      .eq("checkin_date", today)
      .single();

    if (existingCheckin) {
      return NextResponse.json(
        { error: "Already checked in today", alreadyCheckedIn: true },
        { status: 409 }
      );
    }

    // Create check-in (checkin_date defaults to CURRENT_DATE in DB)
    const { data, error } = await getSupabaseService()
      .from("venue_checkins")
      .insert({
        user_id: body.user_id,
        venue_name: body.venue_name,
        venue_id: body.venue_id || null,
        venue_lat: body.venue_lat || null,
        venue_lon: body.venue_lon || null,
        city: body.city || null,
        checkin_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      })
      .select()
      .single();

    if (error) {
      console.error("[checkin] Insert error:", error);

      // Handle unique constraint violation (duplicate check-in)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already checked in today", alreadyCheckedIn: true },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to check in" },
        { status: 500 }
      );
    }

    console.log(`[checkin] User ${body.user_id} checked in at ${body.venue_name}`);

    return NextResponse.json({
      success: true,
      checkin: data,
    });
  } catch (err) {
    console.error("[checkin] Unexpected error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/checkin
 *
 * Get check-in stats for a venue.
 *
 * Query params:
 * - venue_name: Name of the venue
 * - period: "today" | "week" | "month" (default: "today")
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const venueName = searchParams.get("venue_name");
  const period = searchParams.get("period") || "today";

  if (!venueName) {
    return NextResponse.json(
      { error: "venue_name is required" },
      { status: 400 }
    );
  }

  // Calculate date range based on period
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  try {
    let query = getSupabaseService()
      .from("venue_checkins")
      .select("id, created_at, checkin_date", { count: "exact" })
      .eq("venue_name", venueName)
      .order("created_at", { ascending: false });

    // Filter by period
    if (period === "today") {
      query = query.eq("checkin_date", today);
    } else if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte("checkin_date", weekAgo);
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte("checkin_date", monthAgo);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[checkin] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch check-ins" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      venue_name: venueName,
      period,
      count: count || 0,
      checkins: data || [],
    });
  } catch (err) {
    console.error("[checkin] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch check-ins" },
      { status: 500 }
    );
  }
}


