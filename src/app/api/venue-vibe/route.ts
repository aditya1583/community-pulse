import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RATE_LIMITS, buildRateLimitHeaders } from "@/lib/rateLimit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Valid vibe types
const VALID_VIBE_TYPES = [
  "busy", "quiet", "moderate",
  "live_music", "great_vibes", "chill",
  "long_wait", "fast_service",
  "worth_it", "skip_it",
] as const;

type VibeType = typeof VALID_VIBE_TYPES[number];

/**
 * GET /api/venue-vibe?venue_name=...
 * GET /api/venue-vibe?venue_id=... (legacy, falls back to venue_name if no results)
 * Fetches aggregated vibes for a venue
 *
 * NOTE: venue_name is the canonical identifier since Foursquare/OSM IDs vary
 * but venue names are consistent when users submit vibes.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const venueName = searchParams.get("venue_name");
  const venueId = searchParams.get("venue_id");

  if (!venueName && !venueId) {
    return NextResponse.json(
      { error: "venue_name or venue_id is required" },
      { status: 400 }
    );
  }

  try {
    // Query by venue_name (canonical) since place IDs from Foursquare/OSM
    // don't match what's stored when users submit vibes
    let query = supabase
      .from("venue_vibes")
      .select("vibe_type, created_at")
      .gt("expires_at", new Date().toISOString());

    if (venueName) {
      // Primary: query by venue name (case-insensitive for robustness)
      query = query.ilike("venue_name", venueName);
    } else if (venueId) {
      // Fallback: try venue_id first, then venue_name
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ vibes: [], totalCount: 0 });
      }
      throw error;
    }

    // Aggregate vibes by type
    const vibeMap = new Map<string, { count: number; latestAt: string }>();

    for (const row of data || []) {
      const existing = vibeMap.get(row.vibe_type);
      if (existing) {
        existing.count++;
        if (new Date(row.created_at) > new Date(existing.latestAt)) {
          existing.latestAt = row.created_at;
        }
      } else {
        vibeMap.set(row.vibe_type, {
          count: 1,
          latestAt: row.created_at,
        });
      }
    }

    // Convert to array sorted by count
    const vibes = Array.from(vibeMap.entries())
      .map(([vibeType, stats]) => ({
        vibeType,
        count: stats.count,
        latestAt: stats.latestAt,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      vibes,
      totalCount: data?.length || 0,
    });
  } catch (error) {
    console.error("[venue-vibe] Error fetching vibes:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue vibes", vibes: [], totalCount: 0 },
      { status: 500 }
    );
  }
}

/**
 * POST /api/venue-vibe
 * Submit a vibe check for a venue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      venueId,
      venueName,
      vibeType,
      venueLat,
      venueLon,
      deviceFingerprint,
      city, // City where the venue is located
      userId, // User ID for auth (required)
    } = body;

    // Require authentication
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required to log vibes" },
        { status: 401 }
      );
    }

    // Global rate limiting - 5 vibes per hour per user (across all venues)
    const rateLimitResult = checkRateLimit(userId, RATE_LIMITS.VENUE_VIBE);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: `You've logged too many vibes recently. Try again in ${Math.ceil(rateLimitResult.resetInSeconds / 60)} minutes.`,
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Validation
    if (!venueId || !venueName || !vibeType) {
      return NextResponse.json(
        { error: "venueId, venueName, and vibeType are required" },
        { status: 400 }
      );
    }

    if (!VALID_VIBE_TYPES.includes(vibeType as VibeType)) {
      return NextResponse.json(
        { error: `Invalid vibeType. Must be one of: ${VALID_VIBE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Rate limiting check (1 vibe per venue per 30 minutes per device)
    if (deviceFingerprint) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const { data: recentVibes } = await supabase
        .from("venue_vibes")
        .select("id")
        .eq("venue_id", venueId)
        .eq("device_fingerprint", deviceFingerprint)
        .gt("created_at", thirtyMinutesAgo)
        .limit(1);

      if (recentVibes && recentVibes.length > 0) {
        return NextResponse.json(
          { error: "You've already submitted a vibe for this venue recently. Try again in 30 minutes." },
          { status: 429 }
        );
      }
    }

    // Insert the vibe
    const { data, error } = await supabase
      .from("venue_vibes")
      .insert({
        venue_id: venueId,
        venue_name: venueName,
        vibe_type: vibeType,
        venue_lat: venueLat || null,
        venue_lon: venueLon || null,
        device_fingerprint: deviceFingerprint || null,
        city: city || null, // Store city for filtering
        user_id: userId, // Track who submitted the vibe
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      })
      .select()
      .single();

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Venue vibe feature not yet enabled. Please run the database migration." },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      vibe: {
        id: data.id,
        venueId: data.venue_id,
        venueName: data.venue_name,
        vibeType: data.vibe_type,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      },
    });
  } catch (error) {
    console.error("[venue-vibe] Error submitting vibe:", error);
    return NextResponse.json(
      { error: "Failed to submit venue vibe" },
      { status: 500 }
    );
  }
}
