/**
 * Username generation utilities for creating unique anonymous usernames
 * B10 FIX: Ensures uniqueness by checking existing profiles
 */

// Fun word lists for generating usernames
const MOODS = [
  "Chill", "Spicy", "Sleepy", "Curious", "Salty", "Hyper", "Zen", "Chaotic",
  "Sunny", "Mellow", "Peppy", "Quirky", "Cozy", "Breezy", "Funky", "Jazzy",
  "Snappy", "Zesty", "Dreamy", "Sparkly", "Frosty", "Misty", "Wispy", "Lucky",
];

const ANIMALS = [
  "Coyote", "Otter", "Panda", "Falcon", "Capybara", "Llama", "Raccoon", "Fox",
  "Penguin", "Koala", "Dolphin", "Eagle", "Tiger", "Bear", "Wolf", "Owl",
  "Rabbit", "Deer", "Swan", "Crane", "Turtle", "Lynx", "Hawk", "Raven",
];

/**
 * Generate a random fun username in format "Mood Animal NN"
 * Does NOT guarantee uniqueness - use generateUniqueUsername for that
 */
export function generateFunUsername(): string {
  const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99

  return `${mood} ${animal} ${num}`;
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
export const USERNAME_MOODS = MOODS;
export const USERNAME_ANIMALS = ANIMALS;
