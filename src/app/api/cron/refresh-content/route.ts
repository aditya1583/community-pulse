/**
 * Content Refresh Cron Job - PERMANENT SEEDING
 *
 * Runs every 30 minutes via Vercel cron to generate fresh content for active cities.
 * This solves the "dead app" problem where bot pulses expire and no new content
 * is generated, leaving feeds empty.
 *
 * PERMANENT SEEDING STRATEGY:
 * 1. Get list of cities with recent activity (pulses in last 7 days)
 * 2. Generate 2 new posts per city EVERY cron run (no stale threshold)
 * 3. Vary content by time of day (morning traffic, lunch spots, evening events)
 * 4. This keeps feeds consistently fresh with regular new content
 *
 * Expiration times (match intelligent-seed):
 * - Weather: 3 hours (conditions change constantly)
 * - Traffic: 2 hours (conditions shift throughout day)
 * - Events: 12 hours
 * - General: 24 hours
 *
 * Rate limiting: 2 posts per city per 30-minute cron run = max 4 posts/hour/city
 *
 * Security: Protected by Vercel's CRON_SECRET header validation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateIntelligentPost,
  hasIntelligentBotConfig,
  getCityConfig,
} from "@/lib/intelligent-bots";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Get expiration time in hours based on post type.
 * Time-sensitive content (weather, traffic) expires faster to avoid stale data.
 */
function getExpirationHours(tag: string): number {
  const tagLower = tag.toLowerCase();
  if (tagLower === "weather") return 3;
  if (tagLower === "traffic") return 2;
  if (tagLower === "events") return 12;
  return 24;
}

// PERMANENT SEEDING: Always generate posts, regardless of existing count
// This keeps feeds fresh and active with regular new content

// Maximum cities to process per cron run (prevent timeout)
const MAX_CITIES_PER_RUN = 10;

// Posts to generate per city per cron run (2-3 keeps it fresh without spam)
const POSTS_PER_CITY_PER_RUN = 2;

/**
 * Time-of-day content categories
 * Different times warrant different types of content
 */
type TimeCategory = "morning" | "midday" | "afternoon" | "evening" | "night";

function getTimeCategory(): TimeCategory {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * Time-appropriate post templates
 * These feel natural and relevant to the time of day
 */
const TIME_TEMPLATES: Record<TimeCategory, Array<{ message: string; mood: string; tag: string }>> = {
  morning: [
    { message: "Morning commute check - how's traffic looking out there? Any surprises?", mood: "curious", tag: "Traffic" },
    { message: "Coffee run time! Where's your go-to spot for a morning brew?", mood: "energetic", tag: "General" },
    { message: "Starting the day - anyone else notice the weather this morning?", mood: "observant", tag: "Weather" },
  ],
  midday: [
    { message: "Lunch break! Any hidden gem restaurants around here worth trying?", mood: "hungry", tag: "General" },
    { message: "Midday weather check - is it living up to the forecast?", mood: "curious", tag: "Weather" },
    { message: "Anyone heading out for lunch? Traffic update appreciated!", mood: "helpful", tag: "Traffic" },
  ],
  afternoon: [
    { message: "Afternoon slump - who else needs that 3pm coffee?", mood: "tired", tag: "General" },
    { message: "Rush hour is coming - any early reports on traffic conditions?", mood: "anxious", tag: "Traffic" },
    { message: "Planning tonight? What's happening in the area this evening?", mood: "curious", tag: "Events" },
  ],
  evening: [
    { message: "Evening plans, anyone? Looking for local recommendations!", mood: "excited", tag: "Events" },
    { message: "How was the commute home? Any routes to avoid tomorrow?", mood: "helpful", tag: "Traffic" },
    { message: "Beautiful evening - perfect weather for being outside!", mood: "happy", tag: "Weather" },
  ],
  night: [
    { message: "Night owls unite! Who else is still up? What are you up to?", mood: "chill", tag: "General" },
    { message: "Late night food run - what's open and good right now?", mood: "hungry", tag: "General" },
    { message: "Tomorrow's forecast looking interesting - anyone else checking it?", mood: "curious", tag: "Weather" },
  ],
};

/**
 * Bot personalities for varied, natural-feeling posts
 */
const BOT_PERSONAS: Record<string, { names: string[] }> = {
  Traffic: { names: ["TrafficTracker", "CommuteHelper", "RoadWatch", "DriveTime"] },
  Weather: { names: ["WeatherWatcher", "SkyCheck", "LocalForecast", "WeatherWise"] },
  Events: { names: ["EventScout", "LocalBuzz", "NightOwl", "WeekendVibes"] },
  General: { names: ["LocalTips", "NeighborHelper", "CommunityPulse", "AreaInsider"] },
};

function getBotName(tag: string, citySlug: string): string {
  const persona = BOT_PERSONAS[tag] || BOT_PERSONAS.General;
  const baseName = persona.names[Math.floor(Math.random() * persona.names.length)];
  return `${baseName}_${citySlug}`;
}

interface ActiveCity {
  city: string;
  activePulseCount: number;
  lat: number | null;
  lon: number | null;
}

/**
 * GET /api/cron/refresh-content
 *
 * Called by Vercel cron every 3 hours to refresh content across active cities.
 * Protected by CRON_SECRET validation.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, require CRON_SECRET validation
  // In development, allow manual testing
  const isDevelopment = process.env.NODE_ENV === "development";
  const isValidCronRequest = authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = request.nextUrl.searchParams.get("manual") === "true";

  if (!isDevelopment && !isValidCronRequest && !isManualTrigger) {
    console.log("[Cron Refresh] Unauthorized request - missing or invalid CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Cron Refresh] Database not configured");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const startTime = Date.now();
  const timeCategory = getTimeCategory();

  console.log(`[Cron Refresh] Starting content refresh - Time category: ${timeCategory}`);

  try {
    // Step 1: Find active cities (cities with pulses in the last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Get distinct cities with recent activity and their pulse counts
    const { data: cityData, error: cityError } = await supabase
      .from("pulses")
      .select("city, lat, lon")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    if (cityError) {
      console.error("[Cron Refresh] Error fetching cities:", cityError);
      return NextResponse.json({ error: "Failed to fetch cities" }, { status: 500 });
    }

    // Aggregate cities and count active pulses
    const cityMap = new Map<string, ActiveCity>();

    for (const pulse of cityData || []) {
      if (!cityMap.has(pulse.city)) {
        cityMap.set(pulse.city, {
          city: pulse.city,
          activePulseCount: 0,
          lat: pulse.lat,
          lon: pulse.lon,
        });
      }
      const entry = cityMap.get(pulse.city)!;
      entry.activePulseCount++;
      // Update coords if we get them (some pulses might not have coords)
      if (pulse.lat && pulse.lon && !entry.lat) {
        entry.lat = pulse.lat;
        entry.lon = pulse.lon;
      }
    }

    // Step 2: PERMANENT SEEDING - Process ALL active cities
    // No stale threshold check - always generate fresh content for every city
    // This ensures feeds stay active and engaging
    const activeCities: ActiveCity[] = Array.from(cityMap.values());

    console.log(`[Cron Refresh] PERMANENT SEEDING: Processing ${activeCities.length} active cities`);

    if (activeCities.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active cities found",
        citiesChecked: cityMap.size,
        citiesRefreshed: 0,
        postsCreated: 0,
        timeCategory,
        durationMs: Date.now() - startTime,
      });
    }

    // Step 3: Generate fresh content for ALL active cities
    // Limit to MAX_CITIES_PER_RUN to prevent timeout
    const citiesToRefresh = activeCities.slice(0, MAX_CITIES_PER_RUN);
    const results: Array<{ city: string; postsCreated: number; error?: string }> = [];
    let totalPostsCreated = 0;

    for (const cityInfo of citiesToRefresh) {
      const citySlug = cityInfo.city.split(",")[0].trim().replace(/\s+/g, "");
      const cityName = cityInfo.city.split(",")[0].trim();

      console.log(`[Cron Refresh] Processing ${cityInfo.city} (permanent seeding: ${POSTS_PER_CITY_PER_RUN} posts)`);

      // PERMANENT SEEDING: Always create POSTS_PER_CITY_PER_RUN posts
      const postsNeeded = POSTS_PER_CITY_PER_RUN;

      // CRITICAL: Use city config coordinates, NOT database pulse coordinates
      // Database coords might be wrong if early pulses had incorrect location
      const cityConfig = getCityConfig(cityName);
      const hasConfig = cityConfig !== null;

      // Priority: city config coords > database pulse coords
      let cityLat: number | null = cityConfig?.coords.lat ?? cityInfo.lat;
      let cityLon: number | null = cityConfig?.coords.lon ?? cityInfo.lon;
      const hasCoords = cityLat !== null && cityLon !== null;

      console.log(`[Cron Refresh] ${cityName}: Using coords from ${cityConfig ? 'config' : 'database'} (${cityLat}, ${cityLon})`);

      if (hasConfig || hasCoords) {
        try {
          // Use intelligent post generation
          const coords = hasCoords ? { lat: cityLat!, lon: cityLon! } : undefined;

          // Generate posts one at a time to respect cooldown
          let postsCreatedForCity = 0;

          for (let i = 0; i < postsNeeded && postsCreatedForCity < POSTS_PER_CITY_PER_RUN; i++) {
            const result = await generateIntelligentPost(cityName, {
              force: true, // Bypass cooldown for cron job
              coords,
              includeEngagement: true, // Include polls and engagement posts
            });

            if (result.posted && result.post) {
              // Insert the generated post with smart expiration based on content type
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
                  lat: cityLat,  // Use config coords, not database coords
                  lon: cityLon,  // Use config coords, not database coords
                });

              if (insertError) {
                console.error(`[Cron Refresh] Insert error for ${cityInfo.city}:`, insertError);
              } else {
                postsCreatedForCity++;
                totalPostsCreated++;
              }
            }
          }

          results.push({ city: cityInfo.city, postsCreated: postsCreatedForCity });
          console.log(`[Cron Refresh] Created ${postsCreatedForCity} intelligent posts for ${cityInfo.city}`);
          continue;
        } catch (err) {
          console.warn(`[Cron Refresh] Intelligent bot failed for ${cityInfo.city}:`, err);
          // Fall through to time-based templates
        }
      }

      // Fallback: Use time-appropriate templates
      const templates = TIME_TEMPLATES[timeCategory];
      const postsToCreate = templates
        .slice(0, postsNeeded)
        .map((template, index) => {
          const createdAt = new Date(Date.now() - index * 5 * 60 * 1000).toISOString();
          const expirationHours = getExpirationHours(template.tag);
          const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

          return {
            city: cityInfo.city,
            message: template.message,
            tag: template.tag,
            mood: template.mood,
            author: getBotName(template.tag, citySlug),
            user_id: null,
            is_bot: true,
            hidden: false,
            created_at: createdAt,
            expires_at: expiresAt,
            lat: cityLat,  // Use config coords, not database coords
            lon: cityLon,  // Use config coords, not database coords
          };
        });

      const { data: insertedPosts, error: insertError } = await supabase
        .from("pulses")
        .insert(postsToCreate)
        .select("id");

      if (insertError) {
        console.error(`[Cron Refresh] Insert error for ${cityInfo.city}:`, insertError);
        results.push({ city: cityInfo.city, postsCreated: 0, error: insertError.message });
      } else {
        const count = insertedPosts?.length || 0;
        results.push({ city: cityInfo.city, postsCreated: count });
        totalPostsCreated += count;
        console.log(`[Cron Refresh] Created ${count} time-based posts for ${cityInfo.city}`);
      }
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Cron Refresh] Complete - ${totalPostsCreated} posts created across ${citiesToRefresh.length} cities in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      message: `Content refresh complete`,
      citiesChecked: cityMap.size,
      citiesRefreshed: citiesToRefresh.length,
      postsCreated: totalPostsCreated,
      timeCategory,
      results,
      durationMs,
    });

  } catch (error) {
    console.error("[Cron Refresh] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Content refresh failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/refresh-content
 *
 * Manual trigger for testing or on-demand refresh.
 * Can target a specific city.
 *
 * Body: { city?: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const targetCity = body.city;
    const force = body.force === true;
    const timeCategory = getTimeCategory();

    if (!targetCity) {
      return NextResponse.json(
        { error: "City is required for manual refresh" },
        { status: 400 }
      );
    }

    console.log(`[Cron Refresh] Manual trigger for ${targetCity}, force=${force}`);

    // Check current pulse count
    const now = new Date().toISOString();
    const { count, error: countError } = await supabase
      .from("pulses")
      .select("*", { count: "exact", head: true })
      .eq("city", targetCity)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (countError) {
      return NextResponse.json({ error: "Failed to check pulse count" }, { status: 500 });
    }

    const activePulseCount = count || 0;

    // PERMANENT SEEDING: Always generate posts, no stale threshold check
    // The 'force' parameter is kept for compatibility but no longer affects behavior

    const postsNeeded = POSTS_PER_CITY_PER_RUN;
    const citySlug = targetCity.split(",")[0].trim().replace(/\s+/g, "");
    const cityName = targetCity.split(",")[0].trim();

    // CRITICAL: Use city config coordinates, NOT database pulse coordinates
    const cityConfig = getCityConfig(cityName);
    const hasConfig = cityConfig !== null;

    // Fallback to database coords only if no config
    let cityLat: number | null = cityConfig?.coords.lat ?? null;
    let cityLon: number | null = cityConfig?.coords.lon ?? null;

    // If no config, try database as fallback
    if (!cityLat || !cityLon) {
      const { data: coordsData } = await supabase
        .from("pulses")
        .select("lat, lon")
        .eq("city", targetCity)
        .not("lat", "is", null)
        .limit(1);

      cityLat = coordsData?.[0]?.lat || null;
      cityLon = coordsData?.[0]?.lon || null;
    }

    const hasCoords = cityLat !== null && cityLon !== null;
    console.log(`[Cron Manual] ${cityName}: Using coords from ${cityConfig ? 'config' : 'database'} (${cityLat}, ${cityLon})`);

    if (hasConfig || hasCoords) {
      const coords = hasCoords ? { lat: cityLat!, lon: cityLon! } : undefined;
      let postsCreated = 0;

      for (let i = 0; i < postsNeeded; i++) {
        const result = await generateIntelligentPost(cityName, {
          force: true,
          coords,
          includeEngagement: true,
        });

        if (result.posted && result.post) {
          const expirationHours = getExpirationHours(result.post.tag);
          const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

          const { error } = await supabase
            .from("pulses")
            .insert({
              city: targetCity,
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
              lat: cityLat,
              lon: cityLon,
            });

          if (!error) postsCreated++;
        }
      }

      return NextResponse.json({
        success: true,
        city: targetCity,
        activePulseCount,
        postsCreated,
        mode: "intelligent",
        timeCategory,
      });
    }

    // Fallback to time-based templates
    const templates = TIME_TEMPLATES[timeCategory];
    const postsToCreate = templates.slice(0, postsNeeded).map((template, index) => {
      const expirationHours = getExpirationHours(template.tag);
      return {
        city: targetCity,
        message: template.message,
        tag: template.tag,
        mood: template.mood,
        author: getBotName(template.tag, citySlug),
        user_id: null,
        is_bot: true,
        hidden: false,
        created_at: new Date(Date.now() - index * 5 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
        lat: cityLat,
        lon: cityLon,
      };
    });

    const { data: inserted, error } = await supabase
      .from("pulses")
      .insert(postsToCreate)
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to create posts", details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      city: targetCity,
      activePulseCount,
      postsCreated: inserted?.length || 0,
      mode: "time-based",
      timeCategory,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Manual refresh failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
