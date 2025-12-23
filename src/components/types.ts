/**
 * Shared types for Neon Theme Dashboard components
 */

export type TabId = "pulse" | "events" | "traffic" | "news";

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
};

export type MoodScore = {
  mood: string;
  count: number;
  percent: number;
};

export type CityMood = {
  dominantMood: string | null;
  scores: MoodScore[];
  pulseCount: number;
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
