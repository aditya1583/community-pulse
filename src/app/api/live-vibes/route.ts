import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/live-vibes?city=...
 * Fetches recent venue vibes for display on the home screen
 * Returns vibes from the last 4 hours, grouped by venue
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

  if (!city) {
    return NextResponse.json(
      { error: "city is required" },
      { status: 400 }
    );
  }

  try {
    // Get recent non-expired vibes filtered by city
    // Using .ilike for case-insensitive city matching
    let query = supabase
      .from("venue_vibes")
      .select("id, venue_id, venue_name, vibe_type, created_at, expires_at, city")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50); // Fetch more, then filter/aggregate

    // Filter by city if provided - extract just the city name
    const cityName = city.split(",")[0].trim();
    query = query.ilike("city", `%${cityName}%`);

    const { data, error } = await query;

    if (error) {
      // Table might not exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ vibes: [], hasVibes: false });
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ vibes: [], hasVibes: false });
    }

    // Group by venue and get the most recent/popular vibe for each
    const venueMap = new Map<string, {
      venueId: string;
      venueName: string;
      vibeType: string;
      vibeCount: number;
      latestAt: string;
      allVibes: Map<string, number>;
    }>();

    for (const row of data) {
      const existing = venueMap.get(row.venue_id);
      if (existing) {
        existing.vibeCount++;
        const currentCount = existing.allVibes.get(row.vibe_type) || 0;
        existing.allVibes.set(row.vibe_type, currentCount + 1);
        // Update to most popular vibe
        let maxCount = 0;
        let topVibe = existing.vibeType;
        existing.allVibes.forEach((count, vibe) => {
          if (count > maxCount) {
            maxCount = count;
            topVibe = vibe;
          }
        });
        existing.vibeType = topVibe;
      } else {
        const allVibes = new Map<string, number>();
        allVibes.set(row.vibe_type, 1);
        venueMap.set(row.venue_id, {
          venueId: row.venue_id,
          venueName: row.venue_name,
          vibeType: row.vibe_type,
          vibeCount: 1,
          latestAt: row.created_at,
          allVibes,
        });
      }
    }

    // Convert to array and sort by recency
    const vibes = Array.from(venueMap.values())
      .map(({ venueId, venueName, vibeType, vibeCount, latestAt }) => ({
        venueId,
        venueName,
        vibeType,
        vibeCount,
        latestAt,
      }))
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
      .slice(0, limit);

    return NextResponse.json({
      vibes,
      hasVibes: vibes.length > 0,
      totalVenues: venueMap.size,
    });
  } catch (error) {
    console.error("[live-vibes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live vibes", vibes: [], hasVibes: false },
      { status: 500 }
    );
  }
}
