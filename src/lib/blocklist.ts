/**
 * Dynamic Blocklist for Content Moderation
 *
 * This module provides a server-side dynamic blocklist that can be updated
 * without code changes. It supports both Supabase table and JSON env var fallback.
 *
 * The blocklist runs BEFORE AI moderation as a cheap first-pass filter to catch
 * known problematic terms that may not be detected by AI classifiers.
 *
 * Features:
 * - Supabase table storage with caching (TTL: 60s)
 * - JSON env var fallback for simple deployments
 * - Normalized matching (lowercase, no diacritics, collapsed repeats)
 * - Token-substring matching with word boundary safety
 * - Support for exact phrase and partial matching
 *
 * Environment Variables:
 * - MODERATION_BLOCKLIST_JSON: Optional. JSON array of blocklist entries for env-based config.
 *   Format: [{"phrase": "word", "severity": "block"}, ...]
 *
 * Supabase Table:
 * - Table name: moderation_blocklist
 * - Columns: phrase (text), language (text, optional), severity (enum: block/warn), created_at
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Friendly message shown to users when content is blocked by blocklist
const FRIENDLY_BLOCKLIST_MESSAGE =
  "Please keep your message friendly and respectful.";

// Cache configuration
const CACHE_TTL_MS = 60_000; // 60 seconds

// Blocklist entry type
export type BlocklistEntry = {
  phrase: string;
  language?: string;
  severity: "block" | "warn";
};

export type BlocklistResult = {
  allowed: boolean;
  reason?: string;
  matchedPhrase?: string;
  severity?: "block" | "warn";
};

// Cache for blocklist entries
let blocklistCache: {
  entries: BlocklistEntry[];
  timestamp: number;
} | null = null;

// Singleton Supabase client for blocklist queries
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client for blocklist queries
 */
function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // For blocklist reads, we can use anon key if service key not available
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

/**
 * Normalize text for blocklist comparison
 *
 * - Convert to lowercase
 * - Strip diacritics
 * - Collapse repeated characters (3+ -> 1)
 * - Remove common obfuscation characters
 */
/**
 * Unicode homoglyph map — Cyrillic/Greek/other chars that look like Latin
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic
  'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'і': 'i',
  'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
  'у': 'y', 'ё': 'e', 'А': 'a', 'В': 'b', 'С': 'c', 'Е': 'e',
  'К': 'k', 'М': 'm', 'О': 'o', 'Р': 'p', 'Т': 't', 'Х': 'x',
  // Greek
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k',
  'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  // Fullwidth Latin
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', 'ｆ': 'f',
  'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l',
  'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o', 'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r',
  'ｓ': 's', 'ｔ': 't', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x',
  'ｙ': 'y', 'ｚ': 'z',
};

/**
 * Strip zero-width characters and other invisible Unicode
 */
function stripZeroWidth(input: string): string {
  return input.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u034F\u061C\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206A\u206B\u206C\u206D\u206E\u206F]/g, "");
}

/**
 * Replace Unicode homoglyphs with Latin equivalents
 */
function replaceHomoglyphs(input: string): string {
  let result = "";
  for (const char of input) {
    result += HOMOGLYPH_MAP[char] || char;
  }
  return result;
}

export function normalizeForBlocklist(input: string): string {
  // Strip zero-width characters first
  let normalized = stripZeroWidth(input);

  // Replace Unicode homoglyphs
  normalized = replaceHomoglyphs(normalized);

  normalized = normalized.toLowerCase();

  // Strip diacritics using NFKD normalization
  normalized = normalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Leet speak normalization
  normalized = normalized
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[9]/g, "g")
    .replace(/\+/g, "t");

  // Remove non-alphanumeric characters for matching, but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, "");

  // Collapse repeated characters (3+ -> 1)
  normalized = normalized.replace(/([a-z0-9])\1{2,}/g, "$1");

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Extract tokens from normalized text
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Check if text contains a blocklist phrase with safe word boundaries
 *
 * For exact phrases: uses word boundary matching
 * For single words: checks token-level matching to avoid false positives
 */
function containsBlocklistPhrase(
  normalizedText: string,
  normalizedPhrase: string
): boolean {
  // If phrase contains spaces, do exact substring match
  if (normalizedPhrase.includes(" ")) {
    return normalizedText.includes(normalizedPhrase);
  }

  // For single words, check token-level to avoid false positives
  // e.g., "ass" should not match "grass" or "class"
  const tokens = tokenize(normalizedText);
  return tokens.some((token) => {
    // Exact match
    if (token === normalizedPhrase) return true;

    // Allow matching if phrase is at start/end of token with min length
    // This catches obfuscated versions like "asshole123"
    if (normalizedPhrase.length >= 4) {
      if (
        token.startsWith(normalizedPhrase) ||
        token.endsWith(normalizedPhrase)
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Fetch blocklist entries from Supabase
 */
async function fetchBlocklistFromSupabase(): Promise<BlocklistEntry[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("moderation_blocklist")
      .select("phrase, language, severity")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[blocklist] Supabase fetch error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      phrase: row.phrase,
      language: row.language || undefined,
      severity: row.severity === "warn" ? "warn" : "block",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[blocklist] Supabase fetch exception:", message);
    return [];
  }
}

/**
 * Parse blocklist from JSON environment variable
 */
function parseBlocklistFromEnv(): BlocklistEntry[] {
  const jsonStr = process.env.MODERATION_BLOCKLIST_JSON;
  if (!jsonStr) return [];

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.error("[blocklist] MODERATION_BLOCKLIST_JSON must be an array");
      return [];
    }

    return parsed
      .filter(
        (entry): entry is { phrase: string; severity?: string } =>
          typeof entry === "object" && entry !== null && typeof entry.phrase === "string"
      )
      .map((entry) => ({
        phrase: entry.phrase,
        severity: entry.severity === "warn" ? "warn" : "block",
      }));
  } catch (error) {
    console.error("[blocklist] Failed to parse MODERATION_BLOCKLIST_JSON:", error);
    return [];
  }
}

/**
 * Get blocklist entries with caching
 *
 * Priority:
 * 1. Check cache (if not expired)
 * 2. Fetch from Supabase (if configured)
 * 3. Fall back to env var JSON
 */
export async function getBlocklistEntries(): Promise<BlocklistEntry[]> {
  // Check cache
  if (blocklistCache && Date.now() - blocklistCache.timestamp < CACHE_TTL_MS) {
    return blocklistCache.entries;
  }

  // Try Supabase first
  let entries = await fetchBlocklistFromSupabase();

  // If no entries from Supabase, try env var
  if (entries.length === 0) {
    entries = parseBlocklistFromEnv();
  }

  // Update cache
  blocklistCache = {
    entries,
    timestamp: Date.now(),
  };

  return entries;
}

/**
 * Check content against the dynamic blocklist
 *
 * @param content - The text content to check
 * @returns BlocklistResult with allowed status and matched phrase if blocked
 */
export async function checkBlocklist(content: string): Promise<BlocklistResult> {
  const entries = await getBlocklistEntries();

  if (entries.length === 0) {
    return { allowed: true };
  }

  const normalizedContent = normalizeForBlocklist(content);

  for (const entry of entries) {
    const normalizedPhrase = normalizeForBlocklist(entry.phrase);

    if (containsBlocklistPhrase(normalizedContent, normalizedPhrase)) {
      // Log match (without revealing the content in production)
      const isProduction = process.env.NODE_ENV === "production";
      if (isProduction) {
        console.log(
          `[blocklist] Content matched blocklist entry (severity: ${entry.severity})`
        );
      } else {
        console.log(
          `[blocklist] Content matched: "${entry.phrase}" (severity: ${entry.severity})`
        );
      }

      if (entry.severity === "block") {
        return {
          allowed: false,
          reason: FRIENDLY_BLOCKLIST_MESSAGE,
          matchedPhrase: entry.phrase,
          severity: "block",
        };
      } else {
        // For "warn" severity, we just flag it but allow
        // This could be used for logging/review queue
        return {
          allowed: true,
          matchedPhrase: entry.phrase,
          severity: "warn",
        };
      }
    }
  }

  // --- Spaced-out evasion detection ---
  // Collapse all spaces/separators and re-check: "f u c k" → "fuck"
  const collapsed = normalizeForBlocklist(
    stripZeroWidth(replaceHomoglyphs(content)).replace(/[\s.\-_*#!@^&()]+/g, "")
  );
  for (const entry of entries) {
    const normalizedPhrase = normalizeForBlocklist(entry.phrase);
    if (normalizedPhrase.length >= 4 && collapsed.includes(normalizedPhrase)) {
      if (entry.severity === "block") {
        return {
          allowed: false,
          reason: FRIENDLY_BLOCKLIST_MESSAGE,
          matchedPhrase: entry.phrase,
          severity: "block",
        };
      }
    }
  }

  // --- Reversed text detection ---
  const reversed = normalizedContent.split("").reverse().join("");
  for (const entry of entries) {
    const normalizedPhrase = normalizeForBlocklist(entry.phrase);
    if (normalizedPhrase.length >= 4 && reversed.includes(normalizedPhrase)) {
      if (entry.severity === "block") {
        return {
          allowed: false,
          reason: FRIENDLY_BLOCKLIST_MESSAGE,
          matchedPhrase: entry.phrase,
          severity: "block",
        };
      }
    }
  }

  // --- Dog whistle / coded hate detection ---
  const dogWhistleResult = detectDogWhistles(content);
  if (dogWhistleResult) {
    return {
      allowed: false,
      reason: FRIENDLY_BLOCKLIST_MESSAGE,
      matchedPhrase: dogWhistleResult,
      severity: "block",
    };
  }

  // --- Emoji context detection ---
  const emojiResult = detectSexualEmojiContext(content);
  if (emojiResult) {
    return {
      allowed: false,
      reason: FRIENDLY_BLOCKLIST_MESSAGE,
      matchedPhrase: emojiResult,
      severity: "block",
    };
  }

  return { allowed: true };
}

/**
 * Detect coded hate speech / dog whistles
 */
function detectDogWhistles(content: string): string | null {
  const text = content.toLowerCase();

  // 1488 (14 words + 88/HH)
  if (/\b14\s*[\/\-]?\s*88\b/.test(text) || /\b1488\b/.test(text)) return "1488";

  // Triple parentheses (((target)))
  if (/\({3,}.*\){3,}/.test(content)) return "triple parentheses";

  // Other numeric dog whistles
  if (/\b88\b/.test(text) && /\bheil\b/i.test(text)) return "88+heil";

  return null;
}

/**
 * Detect sexual emoji patterns
 */
function detectSexualEmojiContext(content: string): string | null {
  // Eggplant + peach combo (sexual innuendo)
  if (/🍆\s*🍑/.test(content) || /🍑\s*🍆/.test(content)) {
    // Only block if it's a standalone emoji message or clearly sexual context
    const textOnly = content.replace(/[\u{1F300}-\u{1FFFF}\s]/gu, "").trim();
    if (textOnly.length < 10) return "sexual emoji pattern";
  }

  // Sweat + tongue + eggplant/peach combos
  if (/[💦🥵👅]{2,}/.test(content) && /[🍆🍑]/.test(content)) {
    return "sexual emoji pattern";
  }

  return null;
}

/**
 * Clear the blocklist cache (useful for testing or forced refresh)
 */
export function clearBlocklistCache(): void {
  blocklistCache = null;
}

/**
 * Get blocklist cache status (useful for monitoring)
 */
export function getBlocklistCacheStatus(): {
  cached: boolean;
  entryCount: number;
  ageMs: number;
} {
  if (!blocklistCache) {
    return { cached: false, entryCount: 0, ageMs: 0 };
  }

  return {
    cached: true,
    entryCount: blocklistCache.entries.length,
    ageMs: Date.now() - blocklistCache.timestamp,
  };
}

/**
 * Add an entry to the blocklist (requires service role key)
 *
 * @param entry - The blocklist entry to add
 * @returns true if successful, false otherwise
 */
export async function addBlocklistEntry(
  entry: Omit<BlocklistEntry, "language"> & { language?: string }
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    console.error("[blocklist] Cannot add entry: Supabase not configured");
    return false;
  }

  try {
    const { error } = await client.from("moderation_blocklist").insert([
      {
        phrase: entry.phrase.toLowerCase().trim(),
        language: entry.language || null,
        severity: entry.severity,
      },
    ]);

    if (error) {
      console.error("[blocklist] Failed to add entry:", error.message);
      return false;
    }

    // Clear cache to pick up new entry
    clearBlocklistCache();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[blocklist] Exception adding entry:", message);
    return false;
  }
}
