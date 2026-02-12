/**
 * Content Refresh Cron Job - LEAN & FAST
 *
 * Runs every 30 minutes via Vercel cron.
 * Processes MAX 2 cities per run to stay within Vercel timeout limits.
 * Each city: fetch real data → generate 2 posts → cleanup old ones.
 *
 * Vercel Hobby = 10s timeout, Pro = 60s. We aim for <8s total.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateIntelligentPost,
  getCityConfig,
  getOrCreateCityConfig,
} from "@/lib/intelligent-bots";

export const dynamic = "force-dynamic";
// Vercel Pro: set to 60. Hobby: this is ignored (hard 10s limit).
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_CITIES_PER_RUN = 2;
const POSTS_PER_CITY = 2;
const MAX_BOT_POSTS_PER_CITY = 7;

function getExpirationHours(tag: string): number {
  const t = tag.toLowerCase();
  if (t === "weather") return 2;
  if (t === "traffic") return 2;
  if (t === "events") return 12;
  return 8;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isManual = request.nextUrl.searchParams.get("manual") === "true";
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && authHeader !== `Bearer ${cronSecret}` && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const start = Date.now();

  try {
    // ONLY refresh cities with REAL USER activity in last 48 hours.
    // No user posts = no seeding. We don't waste resources on dormant cities.
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: cityData, error: cityError } = await supabase
      .from("pulses")
      .select("city, lat, lon")
      .gte("created_at", twoDaysAgo)
      .or("is_bot.is.null,is_bot.eq.false")  // ONLY real user posts
      .order("created_at", { ascending: false });

    if (cityError) {
      return NextResponse.json({ error: "Failed to fetch cities", details: cityError.message }, { status: 500 });
    }

    // Dedupe cities by normalized name (first segment before comma)
    // This prevents "Leander, Texas, US" and "Leander, Texas" from being treated as separate cities
    const cityMap = new Map<string, { city: string; lat: number | null; lon: number | null }>();
    for (const p of cityData || []) {
      const normalizedKey = p.city.split(",")[0].trim().toLowerCase();
      if (!cityMap.has(normalizedKey)) {
        cityMap.set(normalizedKey, { city: p.city, lat: p.lat, lon: p.lon });
      }
    }

    if (cityMap.size === 0) {
      return NextResponse.json({ success: true, message: "No active cities with real users", postsCreated: 0, durationMs: Date.now() - start });
    }

    // STEP 0: Delete ALL expired bot posts globally (any city)
    const now = new Date().toISOString();
    const { data: expiredPosts, error: expiredErr } = await supabase
      .from("pulses")
      .select("id")
      .eq("is_bot", true)
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    let expiredDeleted = 0;
    if (!expiredErr && expiredPosts && expiredPosts.length > 0) {
      const expiredIds = expiredPosts.map(p => p.id);
      // Delete in batches of 100
      for (let i = 0; i < expiredIds.length; i += 100) {
        const batch = expiredIds.slice(i, i + 100);
        const { error: delErr } = await supabase.from("pulses").delete().in("id", batch);
        if (!delErr) expiredDeleted += batch.length;
      }
      console.log(`[Cron] Deleted ${expiredDeleted} expired bot posts`);
    }

    // Pick the cities that need content most — find ones with fewest recent bot posts
    const cities = Array.from(cityMap.values());
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // For each city, count recent bot posts
    const cityScores: { city: typeof cities[0]; recentBotPosts: number }[] = [];
    for (const c of cities.slice(0, 10)) { // Check at most 10
      const { count } = await supabase
        .from("pulses")
        .select("*", { count: "exact", head: true })
        .eq("city", c.city)
        .eq("is_bot", true)
        .gte("created_at", twoHoursAgo);
      cityScores.push({ city: c, recentBotPosts: count || 0 });
    }

    // Sort by fewest recent posts (neediest first)
    cityScores.sort((a, b) => a.recentBotPosts - b.recentBotPosts);
    const citiesToProcess = cityScores.slice(0, MAX_CITIES_PER_RUN);

    const results: Array<{ city: string; postsCreated: number; cleaned: number; error?: string }> = [];
    let totalCreated = 0;

    for (const { city: cityInfo } of citiesToProcess) {
      const cityName = cityInfo.city.split(",")[0].trim();
      let postsCreated = 0;
      let cleaned = 0;

      try {
        // Resolve coordinates
        const cityConfig = getCityConfig(cityName);
        const lat = cityConfig?.coords.lat ?? cityInfo.lat;
        const lon = cityConfig?.coords.lon ?? cityInfo.lon;

        if (lat == null || lon == null) {
          results.push({ city: cityInfo.city, postsCreated: 0, cleaned: 0, error: "No coordinates" });
          continue;
        }

        // Generate posts (each call fetches real data internally)
        for (let i = 0; i < POSTS_PER_CITY; i++) {
          try {
            const result = await generateIntelligentPost(cityName, {
              force: true,
              coords: { lat, lon },
              includeEngagement: true,
            });

            if (result.posted && result.post) {
              // DEDUP: Check if a bot post with the same tag exists in the last 2 hours
              const twoHrsAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
              const { count: recentCount } = await supabase
                .from("pulses")
                .select("*", { count: "exact", head: true })
                .eq("city", cityInfo.city)
                .eq("is_bot", true)
                .eq("tag", result.post.tag)
                .gte("created_at", twoHrsAgo);

              if ((recentCount ?? 0) > 0) {
                console.log(`[Cron] Skipping duplicate ${result.post.tag} post for ${cityInfo.city} (exists within 2h)`);
                continue;
              }

              const expirationHours = getExpirationHours(result.post.tag);
              const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

              const { error: insertError } = await supabase
                .from("pulses")
                .insert({
                  city: cityInfo.city,
                  message: result.post.message,
                  tag: result.post.tag,
                  mood: result.post.mood,
                  author: result.post.author,
                  user_id: null,
                  is_bot: true,
                  hidden: false,
                  created_at: new Date().toISOString(),
                  expires_at: expiresAt,
                  poll_options: (result.post as { options?: string[] }).options || null,
                  lat,
                  lon,
                });

              if (!insertError) {
                postsCreated++;
                totalCreated++;
              }
            }
          } catch (postErr) {
            console.error(`[Cron] Post generation failed for ${cityInfo.city}:`, postErr);
          }
        }

        // Cleanup: delete oldest bot posts beyond limit
        const { data: oldPosts } = await supabase
          .from("pulses")
          .select("id")
          .eq("city", cityInfo.city)
          .eq("is_bot", true)
          .order("created_at", { ascending: false });

        if (oldPosts && oldPosts.length > MAX_BOT_POSTS_PER_CITY) {
          const idsToDelete = oldPosts.slice(MAX_BOT_POSTS_PER_CITY).map(p => p.id);
          const { error: delErr } = await supabase.from("pulses").delete().in("id", idsToDelete);
          if (!delErr) cleaned = idsToDelete.length;
        }

        results.push({ city: cityInfo.city, postsCreated, cleaned });
      } catch (cityErr) {
        results.push({ city: cityInfo.city, postsCreated, cleaned, error: String(cityErr) });
      }
    }

    return NextResponse.json({
      success: true,
      expiredDeleted,
      postsCreated: totalCreated,
      citiesProcessed: citiesToProcess.length,
      results,
      durationMs: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Cron failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST - Manual trigger for a specific city
 */
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const targetCity = body.city;
    if (!targetCity) {
      return NextResponse.json({ error: "city required" }, { status: 400 });
    }

    const cityName = targetCity.split(",")[0].trim();
    const cityConfig = getCityConfig(cityName);

    // Get coords from config or DB
    let lat = cityConfig?.coords.lat ?? null;
    let lon = cityConfig?.coords.lon ?? null;

    if (lat == null || lon == null) {
      const { data } = await supabase
        .from("pulses")
        .select("lat, lon")
        .eq("city", targetCity)
        .not("lat", "is", null)
        .limit(1);
      lat = data?.[0]?.lat ?? null;
      lon = data?.[0]?.lon ?? null;
    }

    if (lat == null || lon == null) {
      return NextResponse.json({ error: "No coordinates for city" }, { status: 400 });
    }

    let postsCreated = 0;
    for (let i = 0; i < POSTS_PER_CITY; i++) {
      const result = await generateIntelligentPost(cityName, {
        force: true,
        coords: { lat, lon },
        includeEngagement: true,
      });

      if (result.posted && result.post) {
        const expirationHours = getExpirationHours(result.post.tag);
        const { error } = await supabase.from("pulses").insert({
          city: targetCity,
          message: result.post.message,
          tag: result.post.tag,
          mood: result.post.mood,
          author: result.post.author,
          user_id: null,
          is_bot: true,
          hidden: false,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
          poll_options: (result.post as { options?: string[] }).options || null,
          lat,
          lon,
        });
        if (!error) postsCreated++;
      }
    }

    return NextResponse.json({ success: true, city: targetCity, postsCreated });
  } catch (error) {
    return NextResponse.json(
      { error: "Manual refresh failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
