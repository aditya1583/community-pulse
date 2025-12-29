/**
 * Shared types for Neon Theme Dashboard components
 */

export const DASHBOARD_TABS = [
  { id: "pulse", label: "Pulse" },
  { id: "events", label: "Events" },
  { id: "traffic", label: "Traffic" },
  { id: "news", label: "News" },
  { id: "local", label: "Local" },
  { id: "status", label: "Status" },
] as const;

export type TabId = (typeof DASHBOARD_TABS)[number]["id"];

export type LocalSection = "deals" | "gas" | "markets";

export type LocalDeal = {
  id: string;
  name: string;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  priceLevel: string | null;
  categories: string[];
  address: string;
  distance: number | null;
  isOpen: boolean;
  transactions: string[];
  url: string;
  phone: string | null;
};

export type GasPrices = {
  regular: number;
  regularChange: number | null;
  midgrade: number;
  premium: number;
  diesel: number;
  region?: string;
  regionName: string;
  stateAvg: number | null;
  nationalAvg: number;
  lastUpdated: string;
};

export type FarmersMarket = {
  id: string;
  name: string;
  address: string;
  schedule: string;
  products: string[];
  isOpenToday: boolean;
  distance: number | null;
  website: string | null;
  facebook: string | null;
};

export type ReactionType = "fire" | "eyes" | "check";

export type ReactionCounts = Record<ReactionType, number>;

export type WeatherInfo = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
  cityName: string;
};

export type Pulse = {
  id: number;
  city: string;
  neighborhood?: string | null;
  mood: string;
  tag: string;
  message: string;
  author: string;
  createdAt: string;
  user_id?: string;
  /** ISO timestamp when this pulse expires. Used for ephemeral content decay. */
  expiresAt?: string | null;
};

/**
 * Expiry status for pulse display
 */
export type PulseExpiryStatus = "active" | "expiring-soon" | "fading" | "expired";

/**
 * Lifespan configuration per category (in hours)
 */
export const PULSE_LIFESPAN_HOURS: Record<PulseCategory, number> = {
  Traffic: 2,
  Weather: 4,
  Events: 24,
  General: 24,
};

/**
 * Grace period after expiry where pulse remains visible but faded (in hours)
 */
export const PULSE_GRACE_PERIOD_HOURS = 1;

/**
 * Threshold for "expiring soon" warning (in minutes)
 */
export const EXPIRING_SOON_THRESHOLD_MINUTES = 30;

export type MoodScore = {
  mood: string;
  count: number;
  percent: number;
};

export type TagScore = {
  tag: string;
  count: number;
  percent: number;
};

export type VibeIntensity = "quiet" | "active" | "buzzing" | "intense";

export type CityMood = {
  dominantMood: string | null;
  scores: MoodScore[];
  pulseCount: number;
  // New vibe system fields
  tagScores?: TagScore[];
  dominantTag?: string | null;
  vibeHeadline?: string;
  vibeSubtext?: string;
  vibeEmotion?: string;
  vibeIntensity?: VibeIntensity;
};

export type TrafficLevel = "Light" | "Moderate" | "Heavy";

export const MOODS = ["😊", "😐", "😢", "😡", "😴", "🤩"] as const;
export type Mood = (typeof MOODS)[number];

export const TAGS = ["All", "Traffic", "Weather", "Events", "General"] as const;
export type Tag = (typeof TAGS)[number];

export const POST_TAGS = ["Traffic", "Weather", "Events", "General"] as const;
export type PostTag = (typeof POST_TAGS)[number];

/**
 * Category-specific mood mappings for pulse creation
 */
export type PulseCategory = "Traffic" | "Weather" | "Events" | "General";

export const CATEGORY_MOODS: Record<PulseCategory, { emoji: string; label: string }[]> = {
  Traffic: [
    { emoji: "😤", label: "Frustrated" },
    { emoji: "🏃", label: "Rushed" },
    { emoji: "😌", label: "Chill" },
    { emoji: "🛑", label: "Stuck" },
  ],
  Weather: [
    { emoji: "☀️", label: "Blessed" },
    { emoji: "🏠", label: "Cozy" },
    { emoji: "🥵", label: "Hot" },
    { emoji: "🥶", label: "Cold" },
  ],
  Events: [
    { emoji: "🎉", label: "Excited" },
    { emoji: "🤔", label: "Interested" },
    { emoji: "😅", label: "Busy" },
  ],
  General: [
    { emoji: "😌", label: "Chill" },
    { emoji: "😊", label: "Blessed" },
    { emoji: "🎉", label: "Excited" },
    { emoji: "😤", label: "Frustrated" },
    { emoji: "😴", label: "Tired" },
  ],
};

// =====================================================
// VENUE VIBE CHECK SYSTEM
// =====================================================
// Real-time crowd-sourced venue atmosphere data
// This is hyper-local intelligence that Google doesn't have

export const VENUE_VIBE_TYPES = [
  // Crowd level
  { id: "busy", emoji: "🔥", label: "Busy", category: "crowd" },
  { id: "moderate", emoji: "👥", label: "Moderate", category: "crowd" },
  { id: "quiet", emoji: "🤫", label: "Quiet", category: "crowd" },
  // Atmosphere
  { id: "live_music", emoji: "🎵", label: "Live Music", category: "atmosphere" },
  { id: "great_vibes", emoji: "✨", label: "Great Vibes", category: "atmosphere" },
  { id: "chill", emoji: "😌", label: "Chill", category: "atmosphere" },
  // Service
  { id: "long_wait", emoji: "⏳", label: "Long Wait", category: "service" },
  { id: "fast_service", emoji: "⚡", label: "Fast Service", category: "service" },
  // Quality signals
  { id: "worth_it", emoji: "👍", label: "Worth It", category: "quality" },
  { id: "skip_it", emoji: "👎", label: "Skip It", category: "quality" },
] as const;

export type VenueVibeType = (typeof VENUE_VIBE_TYPES)[number]["id"];

export type VenueVibeCategory = "crowd" | "atmosphere" | "service" | "quality";

export type VenueVibe = {
  id: string;
  venueId: string;
  venueName: string;
  vibeType: VenueVibeType;
  userId?: string;
  createdAt: string;
  expiresAt: string;
};

export type VenueVibeAggregate = {
  vibeType: VenueVibeType;
  count: number;
  latestAt: string;
};

/**
 * Get the display info for a vibe type
 */
export function getVibeTypeInfo(vibeType: VenueVibeType) {
  return VENUE_VIBE_TYPES.find(v => v.id === vibeType) || VENUE_VIBE_TYPES[0];
}
