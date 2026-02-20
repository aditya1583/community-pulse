/**
 * GET /api/pulses/feed
 *
 * Server-side pulse feed endpoint. Bypasses Supabase JS client which
 * hangs in Capacitor WKWebView. Uses service role key server-side.
 *
 * Query params:
 *   lat, lon - coordinates for bounding box query
 *   city - fallback city name match
 *   limit - max results (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = params.get("lat") ? parseFloat(params.get("lat")!) : null;
  const lon = params.get("lon") ? parseFloat(params.get("lon")!) : null;
  const city = params.get("city") || "";
  const limit = Math.min(parseInt(params.get("limit") || "50"), 100);

  if (!lat && !lon && !city) {
    return NextResponse.json({ error: "lat/lon or city required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    let query = supabase
      .from("pulses")
      .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at, is_bot, poll_options, lat, lon")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .or(`expires_at.is.null,expires_at.gt.${gracePeriod}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    // ALWAYS filter by city name — prevents cross-city bleed from bounding box
    // Lat/lon used only for distance sorting below
    if (city) {
      const cityBase = city.split(",")[0].trim();
      query = query.ilike("city", `${cityBase}%`);
    } else if (lat != null && lon != null) {
      // No city name — fall back to bounding box (rare: GPS-only, no reverse geocode)
      const latDelta = 0.175;
      const lonDelta = 0.21;
      query = query
        .gte("lat", lat - latDelta)
        .lte("lat", lat + latDelta)
        .gte("lon", lon - lonDelta)
        .lte("lon", lon + lonDelta);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Feed API] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hide AI-generated (bot) posts older than 24 hours — keeps feed fresh
    // Resident (user) posts show regardless of age
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const filtered = (data || []).filter((pulse: { is_bot?: boolean; created_at: string }) => {
      if (!pulse.is_bot) return true; // resident posts always show
      return pulse.created_at >= twentyFourHoursAgo;
    });

    // Sort: nearby posts first, then by recency within each distance band
    // Posts within ~5 miles come before posts 5-12 miles away
    if (lat != null && lon != null) {
      const NEAR_THRESHOLD = 0.072; // ~5 miles in degrees
      filtered.sort((a: { lat?: number; lon?: number; created_at: string }, b: { lat?: number; lon?: number; created_at: string }) => {
        const distA = (a.lat != null && a.lon != null)
          ? Math.abs(a.lat - lat) + Math.abs(a.lon - lon)
          : 999;
        const distB = (b.lat != null && b.lon != null)
          ? Math.abs(b.lat - lat) + Math.abs(b.lon - lon)
          : 999;
        const nearA = distA <= NEAR_THRESHOLD ? 0 : 1;
        const nearB = distB <= NEAR_THRESHOLD ? 0 : 1;
        if (nearA !== nearB) return nearA - nearB; // nearby first
        // Within same band, sort by recency
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // On-demand content generation: if feed is empty and we have coords, trigger async seeding
    // Don't block the response — seed in background so next refresh has content
    if (filtered.length === 0 && city && lat != null && lon != null) {
      const cityBase = city.split(",")[0].trim();
      // Fire-and-forget: generate content for this city
      const seedUrl = new URL("/api/cron/refresh-content", request.url);
      seedUrl.searchParams.set("manual", "true");
      seedUrl.searchParams.set("seedCity", cityBase);
      seedUrl.searchParams.set("seedLat", String(lat));
      seedUrl.searchParams.set("seedLon", String(lon));
      fetch(seedUrl.toString()).catch(() => {/* fire and forget */});
      console.log(`[Feed API] Empty feed for "${cityBase}" — triggered background seed`);
    }

    return NextResponse.json({ pulses: filtered, count: filtered.length });
  } catch (err) {
    console.error("[Feed API] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
