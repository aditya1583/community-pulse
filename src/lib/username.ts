/**
 * Username generation utilities for creating unique anonymous usernames
 * B10 FIX: Ensures uniqueness by checking existing profiles
 *
 * Features:
 * - PascalCase format (no spaces or special characters)
 * - Built-in profanity filter
 * - Witty, creative word combinations
 */

// Witty adjectives - personality vibes
const ADJECTIVES = [
  // Classic vibes
  "Chill", "Spicy", "Sleepy", "Curious", "Salty", "Hyper", "Zen", "Chaotic",
  "Sunny", "Mellow", "Peppy", "Quirky", "Cozy", "Breezy", "Funky", "Jazzy",
  "Snappy", "Zesty", "Dreamy", "Sparkly", "Frosty", "Misty", "Wispy", "Lucky",
  // Wittier additions
  "Caffeinated", "Wandering", "Mysterious", "Sneaky", "Cosmic", "Turbo",
  "Neon", "Pixel", "Fuzzy", "Grumpy", "Jolly", "Sassy", "Witty", "Clever",
  "Silent", "Loud", "Swift", "Lazy", "Eager", "Bold", "Shy", "Wild",
  "Urban", "Rustic", "Retro", "Vintage", "Stealth", "Nimble", "Bouncy",
];

// Fun nouns - creatures and things
const NOUNS = [
  // Animals
  "Coyote", "Otter", "Panda", "Falcon", "Capybara", "Llama", "Raccoon", "Fox",
  "Penguin", "Koala", "Dolphin", "Eagle", "Tiger", "Bear", "Wolf", "Owl",
  "Rabbit", "Deer", "Swan", "Crane", "Turtle", "Lynx", "Hawk", "Raven",
  // Wittier additions
  "Narwhal", "Platypus", "Axolotl", "Quokka", "Pangolin", "Lemur", "Sloth",
  "Phoenix", "Dragon", "Unicorn", "Griffin", "Yeti", "Kraken", "Sphinx",
  // Objects/concepts
  "Wanderer", "Voyager", "Nomad", "Dreamer", "Thinker", "Seeker", "Drifter",
  "Ninja", "Wizard", "Pirate", "Knight", "Rebel", "Scout", "Ranger",
  "Byte", "Pixel", "Glitch", "Echo", "Spark", "Vortex", "Nebula",
];

// Built-in profanity list for immediate protection
// This runs before the dynamic blocklist for fail-safe protection
// Terms are checked with word boundary awareness to avoid false positives
// (e.g., "sassy" won't match "ass", "class" won't match "ass")
const PROFANITY_EXACT = [
  // Short words that need exact matching to avoid false positives
  "ass", "fag", "fuk", "fck",
];

const PROFANITY_CONTAINS = [
  // Longer profanity that can be safely substring-matched
  "fuck", "fucker", "fucking", "fucked", "fuking", "fack", // fack catches f@ck
  "shit", "shitting", "shitty", "bullshit", "shiit", "siit", // siit catches $h1t
  "asshole", "assholes",
  "bitch", "bitches", "bitchy",
  "dickhead", "dicks", "dick",
  "cocks", "cock",
  "pussy", "pussies",
  "cunts", "cunt",
  "bastard", "bastards",
  "whore", "whores",
  "slut", "sluts",
  "nigger", "nigga",
  "faggot", "fags",
  "retard", "retarded",
  "crappy", "crap",
  "pissed", "piss",
  "damn", "damned", "dammit",
  "penis", "vagina", "boobs", "tits", "boob",
  "porn", "porno",
  "rapist", "rape",
  "nazi", "hitler",
];

/**
 * Check if text contains profanity (built-in fast check)
 * Normalizes input and checks against built-in list
 */
export function containsProfanity(text: string): boolean {
  // Normalize: lowercase first
  let normalized = text.toLowerCase();

  // Apply character substitutions (common leetspeak)
  normalized = normalized
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/!/g, "i")
    .replace(/\|/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/@/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/7/g, "t");

  // Now strip everything except letters and spaces
  const normalizedForSubstring = normalized.replace(/[^a-z]/g, "");

  // Check substring-safe profanity (longer words)
  for (const term of PROFANITY_CONTAINS) {
    if (normalizedForSubstring.includes(term)) {
      return true;
    }
  }

  // For short words, check word boundaries to avoid false positives
  // Split into words and check each individually
  const words = normalized.replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (PROFANITY_EXACT.includes(word)) {
      return true;
    }
  }

  // Also check if the entire normalized string (no spaces) is exactly a short profanity
  if (PROFANITY_EXACT.includes(normalizedForSubstring)) {
    return true;
  }

  return false;
}

/**
 * Sanitize text for use in usernames
 * Removes profanity and returns cleaned words
 */
export function sanitizeForUsername(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  return words.filter(word => {
    const clean = word.replace(/[^a-zA-Z0-9]/g, "");
    return clean.length > 0 && !containsProfanity(clean);
  });
}

/**
 * Generate a random fun username in PascalCase format (e.g., "ChillOtter42")
 * Does NOT guarantee uniqueness - use generateUniqueUsername for that
 */
export function generateFunUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99

  return `${adj}${noun}${num}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Check if a username already exists in the profiles table
 */
export async function isUsernameUnique(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("anon_name", username)
    .single();

  // If no data found (error with code PGRST116), username is unique
  if (error) return true;
  return !data;
}

/**
 * Generate a unique username by checking against existing profiles
 * Retries up to maxAttempts times, then falls back to UUID suffix
 *
 * B10 FIX: This ensures no two users get the same anon username
 */
export async function generateUniqueUsername(
  supabase: SupabaseClient,
  maxAttempts: number = 10
): Promise<string> {
  // Try random generation up to maxAttempts
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateFunUsername();
    const isUnique = await isUsernameUnique(supabase, candidate);

    if (isUnique) {
      return candidate;
    }
  }

  // Fallback: add a unique suffix if all random attempts collided
  // This should be extremely rare given the combinatorics
  const baseName = generateFunUsername();
  const uniqueSuffix = Date.now().toString(36).slice(-4);
  return `${baseName.replace(/\d+$/, '')}${uniqueSuffix}`;
}

/**
 * Export word lists for testing purposes
 */
export const USERNAME_ADJECTIVES = ADJECTIVES;
export const USERNAME_NOUNS = NOUNS;
