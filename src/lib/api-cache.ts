/**
 * API Response Cache Layer
 *
 * Caches external API responses in Supabase to avoid re-fetching
 * during time-sensitive Vercel function execution.
 *
 * Cache durations (aligned with content expiry):
 * - Weather: 30 min (changes moderately)
 * - Traffic: 15 min (changes fast)
 * - Events: 2 hours (don't change often)
 * - Farmers Markets: 6 hours (static data)
 *
 * TOS Compliance:
 * - Ticketmaster: Short-term cache only, never permanent storage
 * - TomTom: Caching for display purposes allowed
 * - Open-Meteo: Open source, no restrictions
 * - USDA: Public domain government data
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type CacheCategory = "weather" | "traffic" | "events" | "farmers_markets";

// Cache TTL in minutes
const CACHE_TTL: Record<CacheCategory, number> = {
  weather: 30,
  traffic: 15,
  events: 120,
  farmers_markets: 360,
};

function getCacheKey(category: CacheCategory, city: string, lat?: number, lon?: number): string {
  if (lat != null && lon != null) {
    // Round to 2 decimal places to group nearby locations
    return `${category}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  }
  return `${category}:${city.toLowerCase().trim()}`;
}

/**
 * Get cached API response. Returns null if expired or not found.
 */
export async function getCached<T>(
  category: CacheCategory,
  city: string,
  lat?: number,
  lon?: number
): Promise<T | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const key = getCacheKey(category, city, lat, lon);

    const { data, error } = await supabase
      .from("api_cache")
      .select("data, expires_at")
      .eq("cache_key", key)
      .single();

    if (error || !data) return null;

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Don't block on cleanup
      supabase.from("api_cache").delete().eq("cache_key", key).then(() => {});
      return null;
    }

    return data.data as T;
  } catch {
    return null;
  }
}

/**
 * Store API response in cache.
 */
export async function setCache<T>(
  category: CacheCategory,
  city: string,
  data: T,
  lat?: number,
  lon?: number
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const key = getCacheKey(category, city, lat, lon);
    const ttlMinutes = CACHE_TTL[category];
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    await supabase
      .from("api_cache")
      .upsert({
        cache_key: key,
        category,
        city: city.toLowerCase().trim(),
        data,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: "cache_key" });
  } catch (err) {
    console.error(`[Cache] Failed to write ${category} cache for ${city}:`, err);
  }
}

/**
 * Wrap a fetch function with caching. Tries cache first, falls back to fetch.
 */
export async function cachedFetch<T>(
  category: CacheCategory,
  city: string,
  fetchFn: () => Promise<T>,
  lat?: number,
  lon?: number
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(category, city, lat, lon);
  if (cached !== null) {
    console.log(`[Cache] HIT ${category} for ${city}`);
    return cached;
  }

  console.log(`[Cache] MISS ${category} for ${city}, fetching...`);

  // Fetch fresh data
  const fresh = await fetchFn();

  // Store in cache (non-blocking)
  setCache(category, city, fresh, lat, lon).catch(() => {});

  return fresh;
}
