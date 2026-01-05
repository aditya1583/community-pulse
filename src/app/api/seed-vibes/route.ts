/**
 * Seed Venue Vibes API - Generates test data for heatmap visualization
 *
 * Usage:
 * GET /api/seed-vibes?lat=30.2672&lon=-97.7431&city=Austin&count=20
 *
 * This creates random venue vibes around the given location to test the heatmap.
 * For development/testing only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Vibe types with weights (more common vibes have higher weights)
const VIBE_TYPES = [
  { type: "busy", weight: 25 },
  { type: "quiet", weight: 15 },
  { type: "moderate", weight: 20 },
  { type: "live_music", weight: 10 },
  { type: "great_vibes", weight: 15 },
  { type: "chill", weight: 15 },
  { type: "long_wait", weight: 10 },
  { type: "fast_service", weight: 10 },
  { type: "worth_it", weight: 15 },
  { type: "skip_it", weight: 5 },
];

// Sample venue names for realistic data
const VENUE_PREFIXES = [
  "The", "Lucky", "Golden", "Blue", "Red", "Green", "Silver", "Old",
  "New", "Central", "Downtown", "Uptown", "Corner", "Main Street",
];

const VENUE_TYPES = [
  "Coffee", "Cafe", "Bistro", "Bar", "Pub", "Grill", "Kitchen",
  "Eatery", "Diner", "Lounge", "Tavern", "Brewery", "Bakery",
];

function getRandomVibeType(): string {
  const totalWeight = VIBE_TYPES.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const vibe of VIBE_TYPES) {
    random -= vibe.weight;
    if (random <= 0) return vibe.type;
  }
  return "moderate";
}

function getRandomVenueName(): string {
  const prefix = VENUE_PREFIXES[Math.floor(Math.random() * VENUE_PREFIXES.length)];
  const type = VENUE_TYPES[Math.floor(Math.random() * VENUE_TYPES.length)];
  return `${prefix} ${type}`;
}

function generateRandomCoordinate(center: number, radiusKm: number): number {
  // 1 degree ≈ 111km
  const radiusDeg = radiusKm / 111;
  const offset = (Math.random() - 0.5) * 2 * radiusDeg;
  return center + offset;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");
  const city = searchParams.get("city") || "Unknown";
  const count = Math.min(parseInt(searchParams.get("count") || "20"), 100);
  const radiusKm = parseFloat(searchParams.get("radius") || "5");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "lat and lon are required. Usage: /api/seed-vibes?lat=30.27&lon=-97.74&city=Austin&count=20" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[seed-vibes] Starting seed for ${city} at (${lat}, ${lon}) with ${count} vibes`);

  try {
    // Generate random venue vibes clustered around the center
    const vibes = [];
    const now = Date.now();

    // Create clusters (hotspots) for more realistic heatmap
    const numClusters = Math.ceil(count / 5);
    const clusterCenters = Array.from({ length: numClusters }, () => ({
      lat: generateRandomCoordinate(lat, radiusKm * 0.7),
      lon: generateRandomCoordinate(lon, radiusKm * 0.7),
    }));

    for (let i = 0; i < count; i++) {
      // Pick a random cluster
      const cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];

      // Generate point near cluster center (tighter radius for clustering)
      const venueLat = generateRandomCoordinate(cluster.lat, 0.5);
      const venueLon = generateRandomCoordinate(cluster.lon, 0.5);

      // Random timestamp within last 4 hours
      const createdAt = new Date(now - Math.random() * 4 * 60 * 60 * 1000);
      const expiresAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);

      const venueId = `seed-venue-${Date.now()}-${i}`;
      const venueName = getRandomVenueName();

      vibes.push({
        venue_id: venueId,
        venue_name: venueName,
        venue_lat: venueLat,
        venue_lon: venueLon,
        vibe_type: getRandomVibeType(),
        city: city,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        // No user_id for seeded data (anonymous)
      });
    }

    console.log(`[seed-vibes] Generated ${vibes.length} vibes across ${numClusters} clusters`);
    console.log(`[seed-vibes] Sample vibe:`, JSON.stringify(vibes[0], null, 2));

    // Insert into database
    const { data, error } = await supabase
      .from("venue_vibes")
      .insert(vibes)
      .select("id, venue_name, vibe_type, venue_lat, venue_lon");

    if (error) {
      console.error("[seed-vibes] Error inserting vibes:", error);
      return NextResponse.json(
        { error: "Failed to seed vibes", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[seed-vibes] SUCCESS! Inserted ${data.length} vibes for ${city}`);

    return NextResponse.json({
      success: true,
      message: `Seeded ${data.length} venue vibes around ${city}`,
      count: data.length,
      center: { lat, lon },
      radiusKm,
      clusters: numClusters,
      vibes: data.slice(0, 10), // Return first 10 for preview
    });
  } catch (error) {
    console.error("[seed-vibes] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to seed vibes" },
      { status: 500 }
    );
  }
}
