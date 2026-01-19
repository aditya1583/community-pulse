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

/**
 * Landmark with optional location specificity
 * Can be a simple string OR an object with address details
 */
export type LandmarkEntry = string | {
  name: string;
  area?: string;      // e.g., "on Hero Way", "near 183A"
  address?: string;   // Full address for directions
};

export interface CityLandmarks {
  shopping: LandmarkEntry[];   // HEB, Target, etc. - with location details
  venues: LandmarkEntry[];     // Concert halls, parks
  restaurants: LandmarkEntry[]; // Popular spots
}

/**
 * Helper to get display name from a landmark entry
 */
export function getLandmarkName(entry: LandmarkEntry): string {
  return typeof entry === 'string' ? entry : entry.name;
}

/**
 * Helper to get full display string (name + area) for a landmark
 * e.g., "HEB Plus on Hero Way" or just "HEB Plus"
 */
export function getLandmarkDisplay(entry: LandmarkEntry): string {
  if (typeof entry === 'string') return entry;
  return entry.area ? `${entry.name} ${entry.area}` : entry.name;
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
  isOpenTomorrow?: boolean; // For "upcoming market" posts
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
  /** Prediction metadata - transforms a poll into a prediction with stakes */
  prediction?: PredictionMetadata;
}

/**
 * Prediction categories for bot-generated predictions
 */
export type PredictionCategory = 'weather' | 'traffic' | 'events' | 'civic' | 'local';

/**
 * Data source for prediction auto-resolution
 * - manual: Admin resolves manually
 * - openweather: Auto-resolve via OpenWeather API
 * - civic_api: Resolve after civic meeting outcomes
 * - traffic_api: Resolve via TomTom traffic data
 * - community: Community votes on outcome after deadline passes
 */
export type PredictionDataSource = 'manual' | 'openweather' | 'civic_api' | 'traffic_api' | 'community';

/**
 * Metadata for prediction posts
 * Predictions are polls with stakes - correct voters earn XP
 */
export interface PredictionMetadata {
  /** When the prediction deadline passes */
  resolvesAt: Date;
  /** XP reward for correct predictors (default 25) */
  xpReward: number;
  /** Category for analytics and generation */
  category: PredictionCategory;
  /** Data source for auto-resolution */
  dataSource: PredictionDataSource;
  /** Optional: Key for auto-resolution (e.g., weather condition code) */
  resolutionKey?: string;
}

export interface CooldownState {
  lastPostTime: number;
  lastPostType: PostType | null;
  postsToday: number;
  postsByType: Record<PostType, number>;
}

// ============================================================================
// CHALLENGE TYPES
// ============================================================================

/**
 * Challenge types for GPS-verified check-ins
 */
export type ChallengeType = "checkin" | "photo" | "trail";

/**
 * Metadata for challenge posts
 * Challenges are GPS-verified check-ins that reward XP for visiting locations
 */
export interface ChallengeMetadata {
  /** Target location coordinates */
  targetLat: number;
  targetLng: number;
  /** Verification radius in meters (default 150m) */
  radiusMeters: number;
  /** Human-readable location name */
  locationName: string;
  /** Optional street address */
  locationAddress?: string;
  /** XP reward for completion (10-200) */
  xpReward: number;
  /** Maximum claims allowed (null = unlimited) */
  maxClaims?: number | null;
  /** When the challenge expires */
  expiresAt: Date;
  /** Type of challenge */
  challengeType: ChallengeType;
  /** For trail challenges: the trail this belongs to */
  trailId?: string;
  /** For trail challenges: order in sequence (1, 2, 3...) */
  trailOrder?: number;
  /** City this challenge belongs to */
  city: string;
}

/**
 * Trail metadata for multi-stop challenges
 */
export interface TrailMetadata {
  /** Unique trail identifier */
  id: string;
  /** Trail title (e.g., "Taco Trail") */
  title: string;
  /** Trail description */
  description: string;
  /** Number of stops required to complete */
  requiredStops: number;
  /** Bonus XP for completing the entire trail */
  completionBonusXp: number;
  /** City this trail belongs to */
  city: string;
  /** When the trail expires */
  expiresAt?: Date;
}

// ============================================================================
// CIVIC TL;DR TYPES
// ============================================================================

/**
 * Stakes level for civic topics - determines formatting and urgency
 */
export type CivicStakes = 'high' | 'medium' | 'low';

/**
 * Topic on a civic meeting agenda
 */
export interface CivicTopic {
  /** Topic title (e.g., "Faubion Elementary Consolidation Vote") */
  title: string;
  /** Brief summary in plain English */
  summary: string;
  /** Stakes level - high gets special formatting */
  stakes: CivicStakes;
}

/**
 * Entity types for civic meetings
 */
export type CivicEntityType = 'school_district' | 'city_council' | 'committee' | 'county' | 'utility';

/**
 * Meeting types
 */
export type CivicMeetingType = 'board' | 'council' | 'special' | 'workshop' | 'hearing' | 'budget';

/**
 * Civic meeting - manually entered meeting data
 */
export interface CivicMeeting {
  /** Unique meeting ID */
  id: string;
  /** City this meeting affects */
  city: string;
  /** Entity holding the meeting (e.g., "LISD", "City of Leander") */
  entity: string;
  /** Type of entity */
  entityType: CivicEntityType;
  /** Type of meeting */
  meetingType: CivicMeetingType;
  /** Optional custom title (overrides auto-generated) */
  title?: string;
  /** When the meeting occurs */
  meetingDate: Date;
  /** Topics on the agenda */
  topics: CivicTopic[];
  /** Livestream URL if available */
  livestreamUrl?: string;
  /** Agenda PDF/document URL */
  agendaUrl?: string;
  /** Physical location */
  location?: string;
}

/**
 * Decision outcomes for post-meeting summaries
 */
export type CivicDecisionOutcome = 'approved' | 'denied' | 'tabled' | 'amended' | 'withdrawn' | 'no_action';

/**
 * Decision made on a civic topic
 */
export interface CivicDecision {
  /** Link to the meeting */
  meetingId: string;
  /** Topic this decision addresses */
  topicTitle: string;
  /** What happened */
  decision: CivicDecisionOutcome;
  /** Votes in favor */
  voteFor?: number;
  /** Votes against */
  voteAgainst?: number;
  /** Abstentions */
  voteAbstain?: number;
  /** Plain-English summary of the decision */
  summary?: string;
  /** Notable moment for "the drama" sections */
  notableMoment?: string;
  /** Impact summary for high-stakes decisions */
  impactSummary?: string;
}
