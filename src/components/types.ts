/**
 * Shared types for Neon Theme Dashboard components
 */

export const DASHBOARD_TABS = [
  { id: "pulse", label: "Pulse" },
  { id: "events", label: "Events" },
  { id: "traffic", label: "Traffic" },
  { id: "local", label: "Local" },
  { id: "status", label: "Status" },
] as const;

// Primary tabs shown in bottom navigation
export const PRIMARY_TABS = ["pulse", "events", "traffic", "local"] as const;

// Secondary tabs shown in inline tab bar
export const SECONDARY_TABS = [
  { id: "status", label: "Status" },
] as const;

export type TabId = (typeof DASHBOARD_TABS)[number]["id"];

export type LocalSection = "deals" | "gas" | "markets" | "heatmap";

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
  /** True if this pulse was created by a bot (for seeding) */
  is_bot?: boolean;
  /** Poll options for "This or That" style voting (e.g., ["🤠 Whataburger", "🍔 In-N-Out"]) */
  poll_options?: string[] | null;
  /** Latitude where the pulse was created (for distance filtering) */
  lat?: number | null;
  /** Longitude where the pulse was created (for distance filtering) */
  lon?: number | null;
  /** Distance from user's location in miles (calculated client-side) */
  distanceMiles?: number | null;

  // ========== PREDICTION FIELDS ==========
  /** True if this pulse is a prediction with XP stakes */
  is_prediction?: boolean;
  /** ISO timestamp when the prediction deadline passes */
  prediction_resolves_at?: string | null;
  /** ISO timestamp when the prediction was resolved (null if pending) */
  prediction_resolved_at?: string | null;
  /** Index of the winning option after resolution (null if pending) */
  prediction_winning_option?: number | null;
  /** XP reward for correct predictors (default 25) */
  prediction_xp_reward?: number;
  /** Category: weather, traffic, events, civic, local */
  prediction_category?: string | null;
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

/**
 * Real-time traffic incident from TomTom
 */
export type TrafficIncident = {
  id: string;
  type: "accident" | "roadwork" | "closure" | "congestion" | "other";
  description: string;
  roadName?: string;
  delay?: number; // delay in seconds
  severity: 1 | 2 | 3 | 4; // 1=minor, 4=major
};

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

// =====================================================
// TRUST & VERIFICATION SYSTEM
// =====================================================
// "The Waze for Lifestyle" - gamification through verification
// Users confirm or contradict existing vibes, building reputation

export type ConfirmationAction = "confirm" | "contradict" | "update";

export type TrustBadge = "local_hero" | "trusted_local" | "regular" | "newcomer" | "learning";

export const TRUST_BADGE_INFO: Record<TrustBadge, { emoji: string; label: string; minScore: number; color: string }> = {
  local_hero: { emoji: "🏆", label: "Local Hero", minScore: 90, color: "text-amber-400" },
  trusted_local: { emoji: "⭐", label: "Trusted Local", minScore: 75, color: "text-emerald-400" },
  regular: { emoji: "✓", label: "Regular", minScore: 60, color: "text-blue-400" },
  newcomer: { emoji: "👋", label: "Newcomer", minScore: 40, color: "text-slate-400" },
  learning: { emoji: "🌱", label: "Learning", minScore: 0, color: "text-slate-500" },
};

export type UserTrustScore = {
  userId: string;
  city: string;
  totalVibesSubmitted: number;
  vibesConfirmed: number;
  vibesContradicted: number;
  confirmationsGiven: number;
  contradictionsGiven: number;
  confirmationAccuracy: number | null;
  trustScore: number;
  badges: string[];
  createdAt: string;
  updatedAt: string;
};

export type VibeConfirmation = {
  id: string;
  vibeId: string;
  venueId: string;
  originalVibeType: VenueVibeType;
  confirmerUserId: string;
  action: ConfirmationAction;
  updatedVibeType?: VenueVibeType;
  city?: string;
  createdAt: string;
};

export type VibeWithTrust = VenueVibe & {
  authorTrustScore?: number;
  authorBadge?: TrustBadge;
  confirmCount: number;
  contradictCount: number;
};

export type VibeConfirmationStats = {
  confirms: number;
  contradicts: number;
  majorityAction: "confirm" | "contradict" | "split";
};

/**
 * Get trust badge based on score
 */
export function getTrustBadge(trustScore: number): TrustBadge {
  if (trustScore >= 90) return "local_hero";
  if (trustScore >= 75) return "trusted_local";
  if (trustScore >= 60) return "regular";
  if (trustScore >= 40) return "newcomer";
  return "learning";
}

/**
 * Get trust badge display info
 */
export function getTrustBadgeInfo(badge: TrustBadge) {
  return TRUST_BADGE_INFO[badge];
}
