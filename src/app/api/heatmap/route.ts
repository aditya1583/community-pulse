/**
 * API route for Sentiment Heatmap data
 *
 * Aggregates venue vibe data into geographic grid cells for heatmap visualization.
 * Uses Supabase (PostGIS-compatible) for spatial queries.
 *
 * Data Sources (all free):
 * - venue_vibes table (has lat/lon coordinates)
 *
 * Privacy Protection:
 * - Requires minimum 3 data points per grid cell to prevent de-anonymization
 * - Only returns aggregated data, never individual submissions
 *
 * Cost: $0 (uses existing Supabase free tier)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Grid cell size in degrees (roughly 1km at mid-latitudes)
const GRID_SIZE = 0.01;

// Minimum data points per cell to show (privacy protection)
const MIN_POINTS_PER_CELL = 3;

// Valid time windows
const TIME_WINDOWS = {
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;

type TimeWindow = keyof typeof TIME_WINDOWS;

// Vibe type to sentiment score mapping
const VIBE_SENTIMENT: Record<string, number> = {
  // Positive vibes (higher = more activity/positive)
  busy: 0.8,
  live_music: 0.9,
  great_vibes: 1.0,
  worth_it: 0.9,
  fast_service: 0.7,
  // Neutral vibes
  moderate: 0.5,
  chill: 0.5,
  quiet: 0.3,
  // Negative signals
  long_wait: 0.6, // Still activity, just crowded
  skip_it: 0.2,
};

/**
 * GET /api/heatmap
 *
 * Query params:
 * - lat: Center latitude
 * - lon: Center longitude
 * - radius: Search radius in km (default 10)
 * - timeWindow: "2h" | "4h" | "24h" | "7d" (default "4h")
 * - city: Optional city filter
 *
 * Returns:
 * - points: Array of {lat, lon, intensity, count, dominantVibe}
 * - metadata: {timeWindow, totalPoints, gridSize}
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");
  const radius = parseFloat(searchParams.get("radius") || "10"); // km
  const timeWindow = (searchParams.get("timeWindow") || "4h") as TimeWindow;
  const city = searchParams.get("city");

  // Validate coordinates
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "Valid lat and lon coordinates are required" },
      { status: 400 }
    );
  }

  // Validate time window
  if (!TIME_WINDOWS[timeWindow]) {
    return NextResponse.json(
      { error: `Invalid timeWindow. Use: ${Object.keys(TIME_WINDOWS).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const cutoffTime = new Date(Date.now() - TIME_WINDOWS[timeWindow]).toISOString();

    console.log(`[heatmap] Query params: lat=${lat}, lon=${lon}, city="${city}", timeWindow=${timeWindow}`);

    // Calculate bounding box from center + radius
    // 1 degree latitude ≈ 111km
    // 1 degree longitude ≈ 111km * cos(latitude)
    const latDelta = radius / 111;
    const lonDelta = radius / (111 * Math.cos(lat * Math.PI / 180));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    // Query venue_vibes within bounding box and time window
    let query = supabase
      .from("venue_vibes")
      .select("venue_lat, venue_lon, vibe_type, created_at")
      .gte("venue_lat", minLat)
      .lte("venue_lat", maxLat)
      .gte("venue_lon", minLon)
      .lte("venue_lon", maxLon)
      .gte("created_at", cutoffTime)
      .not("venue_lat", "is", null)
      .not("venue_lon", "is", null);

    // Optional city filter - use ILIKE for partial match since city names vary
    // e.g., "Austin" vs "Austin, Texas, US" vs "Austin, TX"
    if (city) {
      // Extract first part of city name (before comma) for flexible matching
      const cityBase = city.split(",")[0].trim();
      query = query.ilike("city", `%${cityBase}%`);
    }

    const { data: vibes, error } = await query;

    console.log(`[heatmap] Query returned ${vibes?.length ?? 0} vibes, error: ${error?.message ?? 'none'}`);

    if (error) {
      // Handle table not existing gracefully
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({
          points: [],
          metadata: {
            timeWindow,
            totalPoints: 0,
            gridSize: GRID_SIZE,
            message: "No heatmap data available yet",
          },
        });
      }
      throw error;
    }

    if (!vibes || vibes.length === 0) {
      return NextResponse.json({
        points: [],
        metadata: {
          timeWindow,
          totalPoints: 0,
          gridSize: GRID_SIZE,
        },
      });
    }

    // Aggregate into grid cells
    const gridCells = new Map<string, {
      lat: number;
      lon: number;
      vibes: string[];
      sentimentSum: number;
    }>();

    for (const vibe of vibes) {
      if (vibe.venue_lat === null || vibe.venue_lon === null) continue;

      // Snap to grid
      const gridLat = Math.floor(vibe.venue_lat / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      const gridLon = Math.floor(vibe.venue_lon / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
      const cellKey = `${gridLat.toFixed(4)},${gridLon.toFixed(4)}`;

      if (!gridCells.has(cellKey)) {
        gridCells.set(cellKey, {
          lat: gridLat,
          lon: gridLon,
          vibes: [],
          sentimentSum: 0,
        });
      }

      const cell = gridCells.get(cellKey)!;
      cell.vibes.push(vibe.vibe_type);
      cell.sentimentSum += VIBE_SENTIMENT[vibe.vibe_type] || 0.5;
    }

    // Convert to array, filter by minimum points, calculate intensity
    const points = Array.from(gridCells.values())
      .filter(cell => cell.vibes.length >= MIN_POINTS_PER_CELL)
      .map(cell => {
        // Find dominant vibe
        const vibeCounts = cell.vibes.reduce((acc, vibe) => {
          acc[vibe] = (acc[vibe] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const dominantVibe = Object.entries(vibeCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || "moderate";

        // Calculate intensity (0-1 scale)
        // Based on: activity count + sentiment average
        const avgSentiment = cell.sentimentSum / cell.vibes.length;
        const activityBoost = Math.min(1, cell.vibes.length / 10); // More activity = higher intensity
        const intensity = (avgSentiment * 0.6) + (activityBoost * 0.4);

        return {
          lat: cell.lat,
          lon: cell.lon,
          intensity: Math.round(intensity * 100) / 100,
          count: cell.vibes.length,
          dominantVibe,
        };
      });

    return NextResponse.json({
      points,
      metadata: {
        timeWindow,
        totalPoints: vibes.length,
        gridSize: GRID_SIZE,
        cellsWithData: points.length,
        privacyThreshold: MIN_POINTS_PER_CELL,
      },
    });
  } catch (error) {
    console.error("[heatmap] Error fetching heatmap data:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
