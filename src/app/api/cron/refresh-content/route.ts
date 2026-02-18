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

// ============================================================================
// Event Dedup — Extract semantic fingerprint and match against recent posts
// ============================================================================

/** Stop words to strip when building fingerprint */
const STOP_WORDS = new Set([
  "the", "a", "an", "at", "in", "on", "for", "of", "to", "and", "or", "is",
  "its", "gonna", "be", "been", "who", "else", "going", "this", "good", "get",
  "lets", "let", "see", "yall", "there", "finally", "something", "fun",
  "happening", "locally", "anyone", "need", "plus", "one", "waiting", "loud",
  "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "suites", "vs", "v", "from", "with", "how", "are", "you", "watching",
]);

/**
 * Extract a normalized fingerprint from a post message.
 * Keeps: proper nouns (capitalized words), venue names, dates.
 * Returns sorted unique key words for order-independent matching.
 */
function extractEventFingerprint(message: string): string[] {
  // Strip emoji and special chars, normalize whitespace
  const clean = message
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = clean.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // Extract date pattern (e.g., "20" from "feb 20")
  const dateMatch = message.match(/(?:feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/i);
  if (dateMatch) words.push(`date${dateMatch[1]}`);

  return [...new Set(words)].sort();
}

/**
 * Calculate word overlap ratio between two fingerprints.
 * Returns 0-1 where 1 = identical.
 */
function fingerprintOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const smaller = Math.min(setA.size, setB.size);
  return intersection / smaller;
}

/**
 * Check if a post is a duplicate of any recent bot post.
 * Uses semantic fingerprint matching with 80% overlap threshold.
 */
async function checkEventDuplicate(
  supabase: ReturnType<typeof createClient>,
  city: string,
  message: string,
  tag: string
): Promise<boolean> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Fetch all recent bot posts for this city (ANY tag — same event can be tagged differently)
  const { data: recentPosts } = await supabase
    .from("pulses")
    .select("id, message")
    .eq("city", city)
    .eq("is_bot", true)
    .gte("created_at", twoDaysAgo);

  if (!recentPosts || recentPosts.length === 0) return false;

  const newFP = extractEventFingerprint(message);
  if (newFP.length < 3) return false; // too short to fingerprint

  for (const post of recentPosts) {
    const existingFP = extractEventFingerprint(post.message);
    const overlap = fingerprintOverlap(newFP, existingFP);
    if (overlap >= 0.8) {
      console.log(`[Dedup] 🚫 ${overlap.toFixed(2)} overlap with post ${post.id}: "${post.message.slice(0, 50)}..."`);
      return true;
    }
  }

  return false;
}
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_CITIES_PER_RUN = 2;
const POSTS_PER_CITY = 1;
const MAX_BOT_POSTS_PER_CITY = 5;

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
              // DEDUP: Check last 24h bot posts for same city — tag match OR content similarity
              const twentyFourHrsAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
              const normalizedCity = cityInfo.city.split(",")[0].trim();
              const { data: recentPosts } = await supabase
                .from("pulses")
                .select("id, message, city, tag, created_at")
                .eq("is_bot", true)
                .gte("created_at", twentyFourHrsAgo);

              const cityPosts = (recentPosts || []).filter(p => 
                p.city.split(",")[0].trim().toLowerCase() === normalizedCity.toLowerCase()
              );

              // Check 1: Same tag in last 6 hours = skip
              const sixHrsAgo = Date.now() - 6 * 60 * 60 * 1000;
              const sameTagRecent = cityPosts.filter(p => 
                p.tag === result.post.tag && new Date(p.created_at || 0).getTime() > sixHrsAgo
              );
              if (sameTagRecent.length > 0) {
                console.log(`[Cron] Skipping: ${result.post.tag} already posted for ${normalizedCity} within 6h`);
                continue;
              }

              // Check 2: Event name dedup — extract event-like names and match against existing posts
              // Matches "Texas Longhorns vs LSU Tigers" even with completely different wording
              const newMsg = result.post.message.toLowerCase();
              const eventNamePatterns = [
                // "X vs Y" or "X vs. Y"
                /(\w[\w\s]+?)\s+vs\.?\s+(\w[\w\s]+?)(?:\s+at\s|\s+in\s|\s+tonight|\s+today|[.!,]|$)/i,
                // Event names in quotes or after common prefixes
                /(?:game day|event|tonight|kicking off)[:\s]*([^.!?]+)/i,
              ];
              const extractEventKey = (msg: string): string | null => {
                for (const pattern of eventNamePatterns) {
                  const match = msg.match(pattern);
                  if (match) return match[0].toLowerCase().replace(/[^\w\s]/g, '').trim();
                }
                return null;
              };
              const newEventKey = extractEventKey(newMsg);
              if (newEventKey) {
                const eventWords = newEventKey.split(/\s+/).filter(w => w.length > 2);
                const hasEventDupe = cityPosts.some(p => {
                  const existingMsg = p.message.toLowerCase();
                  // Check if >60% of event key words appear in existing post
                  const matchCount = eventWords.filter(w => existingMsg.includes(w)).length;
                  return matchCount / Math.max(eventWords.length, 1) > 0.6;
                });
                if (hasEventDupe) {
                  console.log(`[Cron] Skipping: event "${newEventKey}" already covered for ${normalizedCity}`);
                  continue;
                }
              }

              // Check 3: General content similarity — word overlap
              const newWords = new Set(newMsg.replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3));
              const isDuplicate = cityPosts.some(p => {
                const existingWords = new Set(p.message.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3));
                const overlap = [...newWords].filter(w => existingWords.has(w)).length;
                const similarity = overlap / Math.max(newWords.size, 1);
                return similarity > 0.5; // >50% word overlap = duplicate
              });
              if (isDuplicate) {
                console.log(`[Cron] Skipping: content too similar to existing post for ${normalizedCity}`);
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
        // DB-level dedup: extract key nouns from the message and check against
        // ALL bot posts from the last 48 hours. This catches the same event
        // posted with different template wording.
        const isDuplicate = await checkEventDuplicate(
          supabase, targetCity, result.post.message, result.post.tag
        );
        if (isDuplicate) {
          console.log(`[RefreshContent] Skipping duplicate event post`);
          continue;
        }

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
