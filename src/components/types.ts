/**
 * Shared types for Neon Theme Dashboard components
 */

export type TabId = "pulse" | "events" | "traffic" | "news" | "local";

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

export type TrafficLevel = "Light" | "Moderate" | "Heavy" | "Severe";

// Traffic incident from TomTom API
export type TrafficIncident = {
  id: string;
  type: "accident" | "roadwork" | "closure" | "congestion" | "other";
  description: string;
  roadName?: string;
  delay?: number;
  severity: 1 | 2 | 3 | 4;
};

// Live traffic data response
export type TrafficLiveData = {
  level: TrafficLevel;
  flowPercent: number;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  incidents: TrafficIncident[];
  hasRoadClosure: boolean;
  lastUpdated: string;
  source: "tomtom";
  error?: string;
};

// Air Quality Index data
export type AirQualityData = {
  aqi: 1 | 2 | 3 | 4 | 5;
  label: "Good" | "Fair" | "Moderate" | "Poor" | "Very Poor";
  color: string;
  components: {
    pm2_5: number;
    pm10: number;
    o3: number;
    no2: number;
    co: number;
  };
  healthAdvice?: string;
};

// Local Deals (Yelp)
export type LocalDeal = {
  id: string;
  name: string;
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  priceLevel?: string;
  categories: string[];
  address: string;
  distance?: number;
  isOpen: boolean;
  transactions: string[];
  url: string;
};

// Gas Prices
export type GasPrices = {
  regular: number;
  midgrade: number;
  premium: number;
  diesel: number;
  regularChange?: number;
  region: string;
  regionName?: string;
  stateAvg?: number;
  nationalAvg: number;
  lastUpdated: string;
};

// Farmers Market
export type FarmersMarket = {
  id: string;
  name: string;
  address: string;
  schedule: string;
  products: string[];
  isOpenToday: boolean;
  distance?: number;
  website?: string;
  facebook?: string;
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

// Local tab section types
export type LocalSection = "deals" | "gas" | "markets";
