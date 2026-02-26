/**
 * insertBotPulse — THE SINGLE GATEKEEPER for all bot pulse inserts.
 *
 * Every code path that wants to insert a bot-generated pulse MUST go through
 * this function. It handles:
 *   1. Fingerprint-based dedup against DB (last 48h, same city)
 *   2. In-memory buffer dedup (catches same-run/same-cycle duplicates)
 *   3. Per-tag limits (Weather: 1, Traffic: 1, Events: 2 per 2h window)
 *   4. Expiration timestamps
 *   5. MAX_BOT_POSTS_PER_CITY cleanup
 *
 * If you bypass this function to insert a bot pulse, you are the bug.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface BotPulseInput {
  city: string;
  message: string;
  tag: string;
  mood: string;
  author: string;
  lat: number | null;
  lon: number | null;
  pollOptions?: string[] | null;
  /** Override created_at (for staggered seed timing). Defaults to now. */
  createdAt?: string;
}

export interface InsertResult {
  success: boolean;
  /** If false, reason will explain why */
  reason?: "duplicate_fingerprint" | "duplicate_local" | "tag_limit" | "insert_error" | "too_short";
  id?: number;
}

// ============================================================================
// Fingerprinting (same logic as before, centralized)
// ============================================================================

const STOP_WORDS = new Set([
  "the", "a", "an", "at", "in", "on", "for", "of", "to", "and", "or", "is",
  "its", "gonna", "be", "been", "who", "else", "going", "this", "good", "get",
  "lets", "let", "see", "yall", "there", "finally", "something", "fun",
  "happening", "locally", "anyone", "need", "plus", "one", "waiting", "loud",
  "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
  "suites", "vs", "v", "from", "with", "how", "are", "you", "watching",
  "today", "tomorrow", "tonight", "near", "update", "traffic", "weather",
  "alert", "closed", "clear", "mph", "congestion", "data", "open-meteo",
]);

function extractFingerprint(message: string): string[] {
  const clean = message
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}:?\s*/gi, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = clean
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  return [...new Set(words)].sort();
}

function fingerprintOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const smaller = Math.min(setA.size, setB.size);
  return intersection / smaller;
}

function normalizeCity(city: string): string {
  return city.split(",")[0].trim().toLowerCase();
}

// ============================================================================
// In-memory buffer — tracks all inserts within current process lifetime
// (covers same-run, same-cycle, rapid successive API calls)
// ============================================================================

interface BufferEntry {
  fingerprint: string[];
  city: string;
  tag: string;
  timestamp: number;
}

const recentInsertBuffer: BufferEntry[] = [];
const BUFFER_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const BUFFER_MAX_SIZE = 200;

function pruneBuffer() {
  const cutoff = Date.now() - BUFFER_MAX_AGE_MS;
  while (recentInsertBuffer.length > 0 && recentInsertBuffer[0].timestamp < cutoff) {
    recentInsertBuffer.shift();
  }
  // Hard cap
  while (recentInsertBuffer.length > BUFFER_MAX_SIZE) {
    recentInsertBuffer.shift();
  }
}

function isLocalDuplicate(fingerprint: string[], city: string): boolean {
  pruneBuffer();
  const normCity = normalizeCity(city);
  return recentInsertBuffer.some(
    (entry) =>
      normalizeCity(entry.city) === normCity &&
      fingerprintOverlap(fingerprint, entry.fingerprint) >= 0.6
  );
}

function getLocalTagCount(city: string, tag: string, windowMs: number): number {
  pruneBuffer();
  const normCity = normalizeCity(city);
  const cutoff = Date.now() - windowMs;
  return recentInsertBuffer.filter(
    (entry) =>
      normalizeCity(entry.city) === normCity &&
      entry.tag === tag &&
      entry.timestamp >= cutoff
  ).length;
}

// ============================================================================
// DB dedup check
// ============================================================================

async function isDBDuplicate(
  supabase: SupabaseClient,
  city: string,
  fingerprint: string[]
): Promise<boolean> {
  if (fingerprint.length < 3) return false; // too short to fingerprint reliably

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const normCity = normalizeCity(city);

  const { data: recentPosts } = await supabase
    .from("pulses")
    .select("id, message, city")
    .eq("is_bot", true)
    .gte("created_at", twoDaysAgo);

  if (!recentPosts || recentPosts.length === 0) return false;

  const cityPosts = recentPosts.filter(
    (p) => normalizeCity(p.city) === normCity
  );

  for (const post of cityPosts) {
    const existingFP = extractFingerprint(post.message);
    const overlap = fingerprintOverlap(fingerprint, existingFP);
    if (overlap >= 0.6) {
      console.log(
        `[insertBotPulse] 🚫 DB duplicate (${overlap.toFixed(2)} overlap) with post ${post.id}`
      );
      return true;
    }
  }

  return false;
}

// ============================================================================
// Tag limits
// ============================================================================

const TAG_LIMITS: Record<string, number> = {
  Weather: 1,
  Traffic: 1,
  Events: 2,
};
const TAG_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

async function isTagLimitReached(
  supabase: SupabaseClient,
  city: string,
  tag: string
): Promise<boolean> {
  const limit = TAG_LIMITS[tag] ?? 2;

  // Check local buffer first
  const localCount = getLocalTagCount(city, tag, TAG_WINDOW_MS);
  if (localCount >= limit) return true;

  // Check DB
  const twoHoursAgo = new Date(Date.now() - TAG_WINDOW_MS).toISOString();
  const normCity = normalizeCity(city);

  const { data: recentPosts } = await supabase
    .from("pulses")
    .select("id, city, tag")
    .eq("is_bot", true)
    .eq("tag", tag)
    .gte("created_at", twoHoursAgo);

  const dbCount = (recentPosts || []).filter(
    (p) => normalizeCity(p.city) === normCity
  ).length;

  return dbCount + localCount >= limit;
}

// ============================================================================
// Expiration
// ============================================================================

function getExpirationHours(tag: string): number {
  const t = tag.toLowerCase();
  if (t === "weather") return 2;
  if (t === "traffic") return 2;
  if (t === "events") return 12;
  return 8;
}

// ============================================================================
// MAX BOT POSTS cleanup
// ============================================================================

const MAX_BOT_POSTS_PER_CITY = 3;

async function cleanupExcess(supabase: SupabaseClient, city: string): Promise<number> {
  const { data: oldPosts } = await supabase
    .from("pulses")
    .select("id")
    .eq("city", city)
    .eq("is_bot", true)
    .order("created_at", { ascending: false });

  if (oldPosts && oldPosts.length > MAX_BOT_POSTS_PER_CITY) {
    const idsToDelete = oldPosts.slice(MAX_BOT_POSTS_PER_CITY).map((p) => p.id);
    const { error } = await supabase.from("pulses").delete().in("id", idsToDelete);
    if (!error) return idsToDelete.length;
  }
  return 0;
}

// ============================================================================
// THE GATEKEEPER
// ============================================================================

export async function insertBotPulse(
  supabase: SupabaseClient,
  input: BotPulseInput
): Promise<InsertResult> {
  const fingerprint = extractFingerprint(input.message);

  // Gate 1: Fingerprint too short — can't reliably dedup, but allow very short posts
  // (weather one-liners etc.)

  // Gate 2: Local buffer dedup (same process, catches same-run dupes)
  if (isLocalDuplicate(fingerprint, input.city)) {
    console.log(`[insertBotPulse] 🚫 Local duplicate for ${normalizeCity(input.city)}`);
    return { success: false, reason: "duplicate_local" };
  }

  // Gate 3: Tag limit check (local + DB combined)
  if (await isTagLimitReached(supabase, input.city, input.tag)) {
    console.log(`[insertBotPulse] 🚫 Tag limit reached: ${input.tag} for ${normalizeCity(input.city)}`);
    return { success: false, reason: "tag_limit" };
  }

  // Gate 4: DB fingerprint dedup (last 48h)
  if (await isDBDuplicate(supabase, input.city, fingerprint)) {
    return { success: false, reason: "duplicate_fingerprint" };
  }

  // All gates passed — insert
  const expiresAt = new Date(
    Date.now() + getExpirationHours(input.tag) * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("pulses")
    .insert({
      city: input.city,
      message: input.message,
      tag: input.tag,
      mood: input.mood,
      author: input.author,
      user_id: null,
      is_bot: true,
      hidden: false,
      created_at: input.createdAt || new Date().toISOString(),
      expires_at: expiresAt,
      poll_options: input.pollOptions || null,
      lat: input.lat,
      lon: input.lon,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[insertBotPulse] ✗ Insert failed:`, error.message);
    return { success: false, reason: "insert_error" };
  }

  // Record in local buffer
  recentInsertBuffer.push({
    fingerprint,
    city: input.city,
    tag: input.tag,
    timestamp: Date.now(),
  });

  // Cleanup excess bot posts for this city
  await cleanupExcess(supabase, input.city);

  console.log(`[insertBotPulse] ✅ Inserted pulse ${data.id} (${input.tag}) for ${normalizeCity(input.city)}`);
  return { success: true, id: data.id };
}

// Re-export helpers that other modules may need
export { getExpirationHours, extractFingerprint, fingerprintOverlap, normalizeCity };
