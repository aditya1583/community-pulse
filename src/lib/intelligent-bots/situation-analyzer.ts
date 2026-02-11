/**
 * Situation Analyzer - Determines WHEN and WHAT to post
 *
 * Core principle: Only post when there's something genuinely useful to share.
 * Silence is better than noise.
 */

import type {
  CityConfig,
  TrafficData,
  WeatherData,
  EventData,
  FarmersMarketData,
  TimeContext,
  SituationContext,
  PostDecision,
  PostType,
} from "./types";

/**
 * Build complete situation context from all data sources
 */
export function buildSituationContext(
  city: CityConfig,
  traffic: TrafficData,
  weather: WeatherData,
  events: EventData[],
  farmersMarkets: FarmersMarketData[] = []
): SituationContext {
  const now = new Date();

  return {
    timestamp: now,
    city,
    traffic,
    weather,
    events,
    farmersMarkets,
    time: buildTimeContext(now, city),
  };
}

/**
 * Build time context for a given timestamp
 */
export function buildTimeContext(now: Date, city: CityConfig): TimeContext {
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isWeekend = !isWeekday;

  const { morning, evening, schoolDismissal } = city.rushHours;

  const isMorningRush = hour >= morning.start && hour < morning.end;
  const isEveningRush = hour >= evening.start && hour < evening.end;
  const isRushHour = isWeekday && (isMorningRush || isEveningRush);

  const isSchoolHours = isWeekday && hour >= 8 && hour < 15;
  const isSchoolDismissal = isWeekday && hour >= schoolDismissal && hour < schoolDismissal + 1;

  const isLateNight = hour >= 22 || hour < 6;

  return {
    hour,
    dayOfWeek,
    isWeekday,
    isRushHour,
    rushHourType: isMorningRush ? "morning" : isEveningRush ? "evening" : null,
    isSchoolHours,
    isSchoolDismissal,
    isLateNight,
    isWeekend,
  };
}

/**
 * Analyze situation and decide what (if anything) to post
 */
export function analyzeForPost(ctx: SituationContext): PostDecision {
  // Check each category in priority order
  const decisions = [
    checkForTrafficPost(ctx),
    checkForWeatherPost(ctx),
    checkForEventPost(ctx),
    checkForGeneralPost(ctx),
  ];

  // Find highest priority post that should be made
  const bestDecision = decisions
    .filter((d) => d.shouldPost)
    .sort((a, b) => b.priority - a.priority)[0];

  if (bestDecision) {
    return bestDecision;
  }

  // Nothing to post
  return {
    shouldPost: false,
    postType: null,
    reason: "No noteworthy situation detected",
    priority: 0,
    templateCategory: "",
  };
}

/**
 * Check if traffic conditions warrant a post
 */
function checkForTrafficPost(ctx: SituationContext): PostDecision {
  const { traffic, time, events } = ctx;

  // High congestion (>30%) always warrants a post
  if (traffic.congestionLevel > 0.3) {
    return {
      shouldPost: true,
      postType: "Traffic",
      reason: `High congestion (${Math.round(traffic.congestionLevel * 100)}%)`,
      priority: 8,
      templateCategory: time.isRushHour
        ? `rushHour.${time.rushHourType}`
        : "general",
    };
  }

  // Major incidents always warrant a post
  const majorIncident = traffic.incidents.find((i) => i.severity === "major");
  if (majorIncident) {
    return {
      shouldPost: true,
      postType: "Traffic",
      reason: `Major incident: ${majorIncident.description}`,
      priority: 9,
      templateCategory: "incident",
    };
  }

  // Rush hour + moderate congestion (>20%)
  if (time.isRushHour && traffic.congestionLevel > 0.2) {
    return {
      shouldPost: true,
      postType: "Traffic",
      reason: `Rush hour congestion (${Math.round(traffic.congestionLevel * 100)}%)`,
      priority: 7,
      templateCategory: `rushHour.${time.rushHourType}`,
    };
  }

  // School dismissal + any congestion (>15%)
  if (time.isSchoolDismissal && traffic.congestionLevel > 0.15) {
    return {
      shouldPost: true,
      postType: "Traffic",
      reason: "School dismissal traffic",
      priority: 6,
      templateCategory: "schoolZone",
    };
  }

  // Event ending soon (>1000 expected attendance)
  const endingSoon = events.find((e) => {
    if (!e.endTime) return false;
    const minsUntilEnd = (e.endTime.getTime() - ctx.timestamp.getTime()) / 60000;
    return minsUntilEnd > 0 && minsUntilEnd < 60 && (e.expectedAttendance || 0) > 1000;
  });

  if (endingSoon) {
    return {
      shouldPost: true,
      postType: "Traffic",
      reason: `Event ending: ${endingSoon.name}`,
      priority: 7,
      templateCategory: "event",
    };
  }

  return {
    shouldPost: false,
    postType: "Traffic",
    reason: "Traffic conditions normal",
    priority: 0,
    templateCategory: "",
  };
}

/**
 * Check if weather conditions warrant a post
 */
function checkForWeatherPost(ctx: SituationContext): PostDecision {
  const { weather, time } = ctx;

  // Active precipitation
  if (["rain", "storm", "snow"].includes(weather.condition)) {
    return {
      shouldPost: true,
      postType: "Weather",
      reason: `Active ${weather.condition}`,
      priority: weather.condition === "storm" ? 9 : 7,
      templateCategory: weather.condition,
    };
  }

  // Extreme heat (>100°F)
  if (weather.temperature > 100) {
    return {
      shouldPost: true,
      postType: "Weather",
      reason: `Extreme heat (${weather.temperature}°F)`,
      priority: 8,
      templateCategory: "heat",
    };
  }

  // Extreme cold (<32°F)
  if (weather.temperature < 32) {
    return {
      shouldPost: true,
      postType: "Weather",
      reason: `Freezing conditions (${weather.temperature}°F)`,
      priority: 8,
      templateCategory: "cold",
    };
  }

  // High UV during daytime (≥8)
  if (weather.uvIndex >= 8 && !time.isLateNight) {
    return {
      shouldPost: true,
      postType: "Weather",
      reason: `High UV index (${weather.uvIndex})`,
      priority: 5,
      templateCategory: "uvAlert",
    };
  }

  // Fog (safety concern)
  if (weather.condition === "fog") {
    return {
      shouldPost: true,
      postType: "Weather",
      reason: "Foggy conditions",
      priority: 6,
      templateCategory: "fog",
    };
  }

  // --- FORECAST CHECKS (Tomorrow) ---
  if (weather.forecast && weather.forecast.length > 0) {
    const tomorrow = weather.forecast[0];

    // Tomorrow: Rain/Storm/Snow
    if (["rain", "storm", "snow"].includes(tomorrow.condition)) {
      return {
        shouldPost: true,
        postType: "Weather",
        reason: `Forecast: ${tomorrow.condition} tomorrow`,
        priority: 6,
        templateCategory: "forecast",
      };
    }

    // Tomorrow: Perfect Weather
    if (tomorrow.condition === "clear" && tomorrow.tempHigh >= 70 && tomorrow.tempHigh <= 85) {
      return {
        shouldPost: true,
        postType: "Weather",
        reason: "Forecast: Perfect weather tomorrow",
        priority: 5,
        templateCategory: "forecast",
      };
    }

    // Tomorrow: Big Temp Drop (Cold Front)
    if (weather.temperature - tomorrow.tempHigh > 15) {
      return {
        shouldPost: true,
        postType: "Weather",
        reason: `Forecast: Big temp drop (${weather.temperature}°F -> ${tomorrow.tempHigh}°F)`,
        priority: 7,
        templateCategory: "forecast",
      };
    }

    // Tomorrow: General Forecast (Low priority filler)
    if (Math.random() < 0.3) {
      return {
        shouldPost: true,
        postType: "Weather",
        reason: "General forecast",
        priority: 4,
        templateCategory: "forecast",
      };
    }
  }

  return {
    shouldPost: false,
    postType: "Weather",
    reason: "Weather conditions normal",
    priority: 0,
    templateCategory: "",
  };
}

/**
 * Determine event template category from event data
 *
 * IMPORTANT: Order matters! More specific patterns (food, festival) must be
 * checked BEFORE broader patterns (concert/music) to avoid false matches.
 */
function getEventTemplateCategory(event: EventData): string {
  const nameLower = event.name.toLowerCase();
  const categoryLower = event.category.toLowerCase();

  // Food detection (check BEFORE festival - "Food & Wine Festival" should be food)
  if (
    categoryLower.includes("food") ||
    categoryLower.includes("culinary") ||
    nameLower.includes("food") ||
    nameLower.includes("tasting") ||
    nameLower.includes("cook") ||
    nameLower.includes("bbq")
  ) {
    return "food";
  }

  // Festival detection (check BEFORE concert - "ACL Fest" should be festival, not concert)
  if (
    categoryLower.includes("festival") ||
    nameLower.includes("festival") ||
    nameLower.includes("fest") ||
    nameLower.includes("sxsw") ||
    nameLower.includes("acl")
  ) {
    return "festival";
  }

  // Sports detection
  if (
    categoryLower.includes("sport") ||
    categoryLower.includes("game") ||
    nameLower.includes("vs") ||
    nameLower.includes("game") ||
    nameLower.includes("match") ||
    nameLower.includes("football") ||
    nameLower.includes("basketball") ||
    nameLower.includes("soccer") ||
    nameLower.includes("hockey") ||
    nameLower.includes("baseball") ||
    nameLower.includes("stars") ||
    nameLower.includes("spurs") ||
    nameLower.includes("longhorns")
  ) {
    return "sports";
  }

  // Comedy detection
  if (
    categoryLower.includes("comedy") ||
    nameLower.includes("comedy") ||
    nameLower.includes("standup") ||
    nameLower.includes("stand-up") ||
    nameLower.includes("comedian")
  ) {
    return "comedy";
  }

  // Arts/Theater detection
  if (
    categoryLower.includes("theater") ||
    categoryLower.includes("theatre") ||
    categoryLower.includes("arts") ||
    nameLower.includes("theater") ||
    nameLower.includes("theatre") ||
    nameLower.includes("ballet") ||
    nameLower.includes("symphony") ||
    nameLower.includes("opera") ||
    nameLower.includes("broadway")
  ) {
    return "arts";
  }

  // Music/Concert detection (check AFTER more specific categories)
  if (
    categoryLower.includes("music") ||
    categoryLower.includes("concert") ||
    nameLower.includes("concert") ||
    nameLower.includes("live music") ||
    nameLower.includes("tour") ||
    nameLower.includes("band")
  ) {
    return "concert";
  }

  // Community detection
  if (
    categoryLower.includes("community") ||
    categoryLower.includes("family") ||
    nameLower.includes("community") ||
    nameLower.includes("family") ||
    nameLower.includes("market") ||
    nameLower.includes("fair") ||
    nameLower.includes("farmers")
  ) {
    return "community";
  }

  // Default
  return "general";
}

/**
 * Check if events warrant a post
 */
/** Safely coerce startTime to Date (survives JSON cache round-trip) */
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function checkForEventPost(ctx: SituationContext): PostDecision {
  const { events, timestamp } = ctx;

  // Find events starting within 4 hours (expanded window for better coverage)
  const startingSoon = events.filter((e) => {
    const minsUntilStart = (toDate(e.startTime).getTime() - timestamp.getTime()) / 60000;
    return minsUntilStart > 0 && minsUntilStart < 240; // 4 hours
  });

  if (startingSoon.length > 0) {
    // Sort by time (soonest first) then by attendance
    const sortedEvents = startingSoon.sort((a, b) => {
      const timeDiff = toDate(a.startTime).getTime() - toDate(b.startTime).getTime();
      if (Math.abs(timeDiff) < 30 * 60 * 1000) {
        // Within 30 mins, prioritize by attendance
        return (b.expectedAttendance || 0) - (a.expectedAttendance || 0);
      }
      return timeDiff;
    });

    const event = sortedEvents[0];
    const minsUntilStart = (toDate(event.startTime).getTime() - timestamp.getTime()) / 60000;
    const templateCategory = getEventTemplateCategory(event);

    // Higher priority for events starting very soon
    const priority = minsUntilStart < 60 ? 7 : minsUntilStart < 120 ? 6 : 5;

    return {
      shouldPost: true,
      postType: "Events",
      reason: `Event starting in ${Math.round(minsUntilStart)} mins: ${event.name}`,
      priority,
      templateCategory,
    };
  }

  // Also check for events happening today (broader awareness)
  const todayEvents = events.filter((e) => {
    const today = new Date(timestamp);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDate(e.startTime) >= today && toDate(e.startTime) < tomorrow;
  });

  if (todayEvents.length > 0 && Math.random() < 0.3) {
    // 30% chance to post about today's events
    const event = todayEvents[Math.floor(Math.random() * todayEvents.length)];
    const templateCategory = getEventTemplateCategory(event);

    return {
      shouldPost: true,
      postType: "Events",
      reason: `Event happening today: ${event.name}`,
      priority: 4,
      templateCategory,
    };
  }

  return {
    shouldPost: false,
    postType: "Events",
    reason: "No notable events",
    priority: 0,
    templateCategory: "",
  };
}



/**
 * Check if a general mood post is appropriate
 * Only during nice conditions, with low probability
 */
function checkForGeneralPost(ctx: SituationContext): PostDecision {
  const { weather, traffic, time } = ctx;

  // Skip if there's anything noteworthy (other posts should handle it)
  if (traffic.congestionLevel > 0.2) {
    return { shouldPost: false, postType: null, reason: "", priority: 0, templateCategory: "" };
  }

  // Nice morning conditions
  if (
    time.hour >= 6 &&
    time.hour <= 9 &&
    weather.condition === "clear" &&
    weather.temperature >= 60 &&
    weather.temperature <= 85
  ) {
    // 20% chance to post good morning
    if (Math.random() < 0.2) {
      return {
        shouldPost: true,
        postType: "General",
        reason: "Nice morning conditions",
        priority: 3,
        templateCategory: "goodMorning",
      };
    }
  }

  // Weekend + nice weather
  if (
    time.isWeekend &&
    weather.condition === "clear" &&
    weather.temperature >= 65 &&
    weather.temperature <= 90
  ) {
    // 15% chance to post weekend vibes
    if (Math.random() < 0.15) {
      return {
        shouldPost: true,
        postType: "General",
        reason: "Nice weekend weather",
        priority: 2,
        templateCategory: "weekend",
      };
    }
  }

  return {
    shouldPost: false,
    postType: null,
    reason: "No general post needed",
    priority: 0,
    templateCategory: "",
  };
}

/**
 * Get a human-readable summary of the current situation
 */
export function getSituationSummary(ctx: SituationContext): string {
  const parts: string[] = [];

  // Traffic
  const congestionPct = Math.round(ctx.traffic.congestionLevel * 100);
  if (congestionPct > 20) {
    parts.push(`Traffic: ${congestionPct}% congestion`);
  } else {
    parts.push("Traffic: Light");
  }

  // Weather
  parts.push(`Weather: ${ctx.weather.temperature}°F, ${ctx.weather.condition}`);

  // Time
  if (ctx.time.isRushHour) {
    parts.push(`Time: ${ctx.time.rushHourType} rush hour`);
  } else if (ctx.time.isSchoolDismissal) {
    parts.push("Time: School dismissal");
  } else if (ctx.time.isLateNight) {
    parts.push("Time: Late night");
  }

  // Events
  if (ctx.events.length > 0) {
    parts.push(`Events: ${ctx.events.length} upcoming`);
  }

  return parts.join(" | ");
}
