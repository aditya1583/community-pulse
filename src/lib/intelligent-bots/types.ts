/**
 * Intelligent Bots - Type Definitions
 *
 * Core types for situationally-aware bot posting system
 */

export interface CityCoords {
  lat: number;
  lon: number;
}

export interface CityRoads {
  major: string[];      // Main arterial roads (Ronald Reagan, Crystal Falls)
  highways: string[];   // Freeways, toll roads (183, 183A)
  schoolZones: string[]; // Roads near schools
}

export interface CityLandmarks {
  shopping: string[];   // HEB, Target, etc.
  venues: string[];     // Concert halls, parks
  restaurants: string[]; // Popular spots
}

export interface CityFunFacts {
  traffic: string[];    // Road history, highway trivia
  weather: string[];    // Local climate records, weather quirks
  events: string[];     // Venue history, local event trivia
  local: string[];      // City history, population facts
  cuisine: {            // Food/drink category facts
    tacos: string[];
    bbq: string[];
    coffee: string[];
    pizza: string[];
    burgers: string[];
    general: string[];
  };
}

export interface CitySchools {
  high: string[];
  middle: string[];
  elementary: string[];
}

export interface RushHours {
  morning: { start: number; end: number };
  evening: { start: number; end: number };
  schoolDismissal: number;
}

export interface CityConfig {
  name: string;
  state: string;
  coords: CityCoords;
  timezone: string;
  roads: CityRoads;
  landmarks: CityLandmarks;
  schools: CitySchools;
  rushHours: RushHours;
  altRoutes: Record<string, string>; // "Ronald Reagan" -> "183A Toll"
  funFacts?: CityFunFacts;           // Optional fun facts for engagement
}

export interface TrafficData {
  congestionLevel: number;  // 0-1 (0 = free flow, 1 = gridlock)
  freeFlowSpeed: number;    // mph
  currentSpeed: number;     // mph
  incidents: TrafficIncident[];
}

export interface TrafficIncident {
  type: 'accident' | 'construction' | 'congestion' | 'road_closed';
  severity: 'minor' | 'moderate' | 'major';
  road: string;
  description: string;
}

export interface WeatherData {
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
  temperature: number;      // Fahrenheit
  feelsLike: number;
  humidity: number;
  uvIndex: number;
  windSpeed: number;
  precipitation: number;    // mm in last hour
}

export interface EventData {
  name: string;
  venue: string;
  startTime: Date;
  endTime?: Date;
  category: string;
  expectedAttendance?: number;
  /** Event venue coordinates for distance calculation */
  coords?: { lat: number; lon: number };
  /** Distance from user's location in miles */
  distanceMiles?: number;
}

export interface FarmersMarketData {
  name: string;
  address: string;
  schedule: string;       // e.g., "Saturdays 9am-1pm"
  products: string[];     // e.g., ["Fresh Produce", "Local Honey"]
  isOpenToday: boolean;
  distance?: number;      // Miles from user
  lat?: number;           // Latitude for directions
  lon?: number;           // Longitude for directions
  website?: string | null; // Market website
}

export interface TimeContext {
  hour: number;
  dayOfWeek: number;        // 0 = Sunday
  isWeekday: boolean;
  isRushHour: boolean;
  rushHourType: 'morning' | 'evening' | null;
  isSchoolHours: boolean;
  isSchoolDismissal: boolean;
  isLateNight: boolean;
  isWeekend: boolean;
}

export interface SituationContext {
  timestamp: Date;
  city: CityConfig;
  traffic: TrafficData;
  weather: WeatherData;
  events: EventData[];
  farmersMarkets: FarmersMarketData[];
  time: TimeContext;
}

export type PostType = 'Traffic' | 'Weather' | 'Events' | 'General';

export interface PostDecision {
  shouldPost: boolean;
  postType: PostType | null;
  reason: string;
  priority: number;  // 1-10, higher = more important
  templateCategory: string;
}

export interface GeneratedPost {
  message: string;
  tag: PostType;
  mood: string;
  author: string;
  is_bot: true;
  hidden: false;
  /** Poll options for "This or That" posts (e.g., ["🍖 BBQ", "🍗 Fried Chicken"]) */
  options?: string[];
}

export interface CooldownState {
  lastPostTime: number;
  lastPostType: PostType | null;
  postsToday: number;
  postsByType: Record<PostType, number>;
}
