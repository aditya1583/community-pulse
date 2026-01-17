/**
 * Data Fetchers - Real-time data from external APIs
 *
 * Fetches traffic, weather, and event data to inform bot posts
 */

import type { CityCoords, TrafficData, WeatherData, EventData, TrafficIncident, FarmersMarketData } from "./types";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { calculateDistanceMiles } from "@/lib/geo/distance";

// Read API keys lazily to support dynamic env loading (e.g., dotenv)
function getTomTomApiKey(): string | undefined {
  return process.env.TOMTOM_API_KEY;
}

function getTicketmasterApiKey(): string | undefined {
  return process.env.TICKETMASTER_API_KEY || process.env.TICKETMASTER_CONSUMER_KEY;
}

/**
 * Fetch real-time traffic data from TomTom
 */
export async function fetchTrafficData(coords: CityCoords): Promise<TrafficData> {
  const TOMTOM_API_KEY = getTomTomApiKey();
  if (!TOMTOM_API_KEY) {
    console.warn("[IntelligentBots] No TomTom API key, using fallback");
    return getDefaultTrafficData();
  }

  try {
    // Use TomTom Traffic Flow API
    const { lat, lon } = coords;
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${TOMTOM_API_KEY}`;

    const response = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache

    if (!response.ok) {
      console.error(`[IntelligentBots] TomTom API error: ${response.status}`);
      return getDefaultTrafficData();
    }

    const data = await response.json();
    const flow = data.flowSegmentData;

    if (!flow) {
      return getDefaultTrafficData();
    }

    // Calculate congestion level (0-1)
    const freeFlow = flow.freeFlowSpeed || 60;
    const current = flow.currentSpeed || freeFlow;
    const congestion = Math.max(0, Math.min(1, 1 - current / freeFlow));

    return {
      congestionLevel: congestion,
      freeFlowSpeed: freeFlow,
      currentSpeed: current,
      incidents: [], // Would need separate API call for incidents
    };
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch traffic:", error);
    return getDefaultTrafficData();
  }
}

/**
 * Fetch traffic incidents from TomTom (separate endpoint)
 * Uses 10-mile (16km) radius from RADIUS_CONFIG
 */
export async function fetchTrafficIncidents(
  coords: CityCoords,
  radiusKm: number = RADIUS_CONFIG.PRIMARY_RADIUS_KM
): Promise<TrafficIncident[]> {
  const TOMTOM_API_KEY = getTomTomApiKey();
  if (!TOMTOM_API_KEY) {
    return [];
  }

  try {
    const { lat, lon } = coords;
    // TomTom Traffic Incidents API
    const bbox = getBoundingBox(lat, lon, radiusKm);
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${TOMTOM_API_KEY}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}`;

    const response = await fetch(url, { next: { revalidate: 300 } });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const incidents = data.incidents || [];

    return incidents.slice(0, 5).map((inc: Record<string, unknown>) => {
      const props = inc.properties as Record<string, unknown>;
      return {
        type: mapIncidentType(props?.iconCategory as number),
        severity: mapSeverity(props?.magnitudeOfDelay as number),
        road: (props?.from as string) || "Unknown road",
        description: getIncidentDescription(props),
      };
    });
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch incidents:", error);
    return [];
  }
}

/**
 * Fetch weather data from Open-Meteo (free, no API key needed)
 */
export async function fetchWeatherData(coords: CityCoords): Promise<WeatherData> {
  try {
    const { lat, lon } = coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

    const response = await fetch(url, { next: { revalidate: 600 } }); // 10 min cache

    if (!response.ok) {
      console.error(`[IntelligentBots] Open-Meteo API error: ${response.status}`);
      return getDefaultWeatherData();
    }

    const data = await response.json();
    const current = data.current;

    if (!current) {
      return getDefaultWeatherData();
    }

    return {
      condition: mapWeatherCode(current.weather_code),
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      uvIndex: current.uv_index || 0,
      windSpeed: Math.round(current.wind_speed_10m),
      precipitation: current.precipitation || 0,
    };
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch weather:", error);
    return getDefaultWeatherData();
  }
}

/**
 * Fetch upcoming events from Ticketmaster
 * Searches by lat/lng with extended radius, then calculates distance for each event
 *
 * Returns events with distance information so bots can include distance callouts
 * for out-of-radius events (e.g., "Bruno Mars in Austin, 15mi away")
 *
 * IMPORTANT: Includes sanity checking to filter out nonsensical event-venue pairings
 * (e.g., "VIP Backstage Experience" at a library is clearly wrong data)
 */
export async function fetchEventData(
  cityName: string,
  state: string = "TX",
  coords?: { lat: number; lon: number }
): Promise<EventData[]> {
  const TICKETMASTER_API_KEY = getTicketmasterApiKey();
  if (!TICKETMASTER_API_KEY) {
    console.warn("[IntelligentBots] No Ticketmaster API key");
    return [];
  }

  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Next 48 hours for better coverage

    // Use lat/lng search for suburbs (better coverage), fall back to city name
    const params = new URLSearchParams({
      apikey: TICKETMASTER_API_KEY,
      startDateTime: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      endDateTime: endDate.toISOString().replace(/\.\d{3}Z$/, "Z"),
      size: "15",
      sort: "date,asc",
    });

    // Prefer lat/lng search with extended radius for suburbs like Leander
    // We fetch from extended radius and include distance info for callouts
    if (coords) {
      params.set("latlong", `${coords.lat},${coords.lon}`);
      params.set("radius", String(RADIUS_CONFIG.EXTENDED_RADIUS_MILES));
      params.set("unit", "miles");
    } else {
      params.set("city", cityName);
      params.set("stateCode", state);
    }

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
    const response = await fetch(url, { next: { revalidate: 600 } });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const events = data._embedded?.events || [];

    const mappedEvents = events.map((event: Record<string, unknown>) => {
      const embedded = event._embedded as Record<string, unknown[]> | undefined;
      const venue = embedded?.venues?.[0] as Record<string, unknown> | undefined;
      const venueLocation = venue?.location as Record<string, string> | undefined;
      const dates = event.dates as Record<string, Record<string, string>>;

      // Extract venue coordinates for distance calculation
      const eventCoords = venueLocation?.latitude && venueLocation?.longitude
        ? {
            lat: parseFloat(venueLocation.latitude),
            lon: parseFloat(venueLocation.longitude),
          }
        : undefined;

      // Calculate distance from user's location
      let distanceMiles: number | undefined;
      if (coords && eventCoords) {
        distanceMiles = calculateDistanceMiles(
          { lat: coords.lat, lon: coords.lon },
          eventCoords
        );
      }

      return {
        name: event.name as string,
        venue: (venue?.name as string) || "Unknown venue",
        startTime: new Date(dates?.start?.dateTime || dates?.start?.localDate || ""),
        category: ((event.classifications as Record<string, Record<string, string>>[])?.[0]?.segment?.name) || "Event",
        coords: eventCoords,
        distanceMiles,
      };
    });

    // Filter out nonsensical event-venue pairings
    const validEvents = mappedEvents.filter((event: EventData) => isValidEventVenuePairing(event));

    // Sort by distance - LOCAL events first (hyperlocal priority!)
    validEvents.sort((a: EventData, b: EventData) => {
      const distA = a.distanceMiles ?? 999;
      const distB = b.distanceMiles ?? 999;
      return distA - distB;
    });

    console.log(`[IntelligentBots] Events sorted by distance: ${validEvents.slice(0, 3).map((e: EventData) => `${e.name} (${e.distanceMiles?.toFixed(1) || '?'}mi)`).join(', ')}`);

    return validEvents;
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch events:", error);
    return [];
  }
}

/**
 * Sanity check for event-venue pairings
 *
 * Filters out obviously wrong combinations like:
 * - "VIP Backstage Experience" at a library (VIP packages without real venues)
 * - Entertainment events at civic/government buildings
 * - Concert packages at non-entertainment venues
 *
 * This prevents bot posts from looking nonsensical to users.
 */
function isValidEventVenuePairing(event: EventData): boolean {
  const nameLower = event.name.toLowerCase();
  const venueLower = event.venue.toLowerCase();

  // Patterns that indicate "add-on" packages (often have wrong/missing venues)
  const addOnPatterns = [
    "vip",
    "backstage",
    "meet & greet",
    "meet and greet",
    "m&g",
    "upgrade",
    "premium",
    "package",
    "bundle",
    "experience only",
    "add-on",
    "parking pass",
  ];

  // Venues that should NOT host entertainment events
  const nonEntertainmentVenues = [
    "library",
    "city hall",
    "municipal",
    "courthouse",
    "dmv",
    "post office",
    "police station",
    "fire station",
    "school",
    "elementary",
    "middle school",
    "high school",
    "church", // unless explicitly a concert at a church
    "hospital",
    "clinic",
    "bank",
    "unknown venue",
  ];

  // Check if this looks like an add-on package
  const isAddOn = addOnPatterns.some(pattern => nameLower.includes(pattern));

  // Check if venue is non-entertainment
  const isNonEntertainmentVenue = nonEntertainmentVenues.some(pattern =>
    venueLower.includes(pattern)
  );

  // Add-on packages at non-entertainment venues are always suspicious
  if (isAddOn && isNonEntertainmentVenue) {
    console.log(`[IntelligentBots] Filtered suspicious event: "${event.name}" at "${event.venue}"`);
    return false;
  }

  // Entertainment events at clearly wrong venues
  const entertainmentCategories = ["music", "concert", "comedy", "sports", "theatre", "festival"];
  const isEntertainment = entertainmentCategories.some(cat =>
    event.category.toLowerCase().includes(cat)
  );

  if (isEntertainment && isNonEntertainmentVenue) {
    // Exception: Some churches host concerts, community centers host events
    const exceptions = ["community center", "civic center", "amphitheater", "auditorium"];
    const hasException = exceptions.some(ex => venueLower.includes(ex));

    if (!hasException) {
      console.log(`[IntelligentBots] Filtered mismatched event: "${event.name}" at "${event.venue}"`);
      return false;
    }
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultTrafficData(): TrafficData {
  return {
    congestionLevel: 0.1, // Assume light traffic
    freeFlowSpeed: 45,
    currentSpeed: 40,
    incidents: [],
  };
}

function getDefaultWeatherData(): WeatherData {
  return {
    condition: "clear",
    temperature: 75,
    feelsLike: 75,
    humidity: 50,
    uvIndex: 5,
    windSpeed: 5,
    precipitation: 0,
  };
}

function getBoundingBox(lat: number, lon: number, radiusKm: number): string {
  // Approximate degrees per km
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  const minLon = lon - lonDelta;
  const minLat = lat - latDelta;
  const maxLon = lon + lonDelta;
  const maxLat = lat + latDelta;

  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

function mapIncidentType(iconCategory: number): TrafficIncident["type"] {
  // TomTom icon categories
  // 1-6: Congestion, 7-9: Construction, 10+: Accidents
  if (iconCategory >= 10) return "accident";
  if (iconCategory >= 7) return "construction";
  return "congestion";
}

function mapSeverity(magnitudeOfDelay: number): TrafficIncident["severity"] {
  // 0-1: minor, 2-3: moderate, 4+: major
  if (magnitudeOfDelay >= 4) return "major";
  if (magnitudeOfDelay >= 2) return "moderate";
  return "minor";
}

function getIncidentDescription(props: Record<string, unknown>): string {
  const events = props?.events as { description?: string }[];
  if (events?.length > 0 && events[0].description) {
    return events[0].description;
  }
  return "Traffic incident reported";
}

function mapWeatherCode(code: number): WeatherData["condition"] {
  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 49) return "fog";
  if (code <= 69) return "rain";
  if (code <= 79) return "snow";
  if (code <= 99) return "storm";
  return "clear";
}

// ============================================================================
// Farmers Markets - Direct API calls (no internal HTTP dependency)
// ============================================================================

// Day name mappings for schedule parsing
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTodayDayName(): string {
  return DAY_NAMES[new Date().getDay()];
}

function getTomorrowDayName(): string {
  return DAY_NAMES[(new Date().getDay() + 1) % 7];
}

/**
 * Check if a market is open today based on its schedule string
 */
function checkIfOpenToday(schedule: string): boolean {
  const today = getTodayDayName().toLowerCase();
  const todayAbbrev = DAY_ABBREVS[new Date().getDay()].toLowerCase();
  const scheduleLower = schedule.toLowerCase();

  if (scheduleLower.includes(today) || scheduleLower.includes(todayAbbrev)) {
    return true;
  }

  if (scheduleLower.includes("daily") || scheduleLower.includes("every day")) {
    return true;
  }

  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  if (isWeekend && scheduleLower.includes("weekend")) {
    return true;
  }

  return false;
}

/**
 * Check if a market is open tomorrow based on its schedule string
 */
function checkIfOpenTomorrow(schedule: string): boolean {
  const tomorrow = getTomorrowDayName().toLowerCase();
  const tomorrowAbbrev = DAY_ABBREVS[(new Date().getDay() + 1) % 7].toLowerCase();
  const scheduleLower = schedule.toLowerCase();

  if (scheduleLower.includes(tomorrow) || scheduleLower.includes(tomorrowAbbrev)) {
    return true;
  }

  if (scheduleLower.includes("daily") || scheduleLower.includes("every day")) {
    return true;
  }

  const isTomorrowWeekend = (new Date().getDay() + 1) % 7 === 0 || (new Date().getDay() + 1) % 7 === 6;
  if (isTomorrowWeekend && scheduleLower.includes("weekend")) {
    return true;
  }

  return false;
}

/**
 * Parse product list from USDA products string
 */
function parseMarketProducts(productsString: string): string[] {
  if (!productsString) return [];

  const products: string[] = [];
  const productsLower = productsString.toLowerCase();

  if (productsLower.includes("organic")) products.push("Organic");
  if (productsLower.includes("vegetable") || productsLower.includes("produce")) products.push("Vegetables");
  if (productsLower.includes("fruit")) products.push("Fruits");
  if (productsLower.includes("meat") || productsLower.includes("beef") || productsLower.includes("pork")) products.push("Meat");
  if (productsLower.includes("egg")) products.push("Eggs");
  if (productsLower.includes("dairy") || productsLower.includes("cheese") || productsLower.includes("milk")) products.push("Dairy");
  if (productsLower.includes("honey")) products.push("Honey");
  if (productsLower.includes("baked") || productsLower.includes("bread")) products.push("Baked Goods");
  if (productsLower.includes("flower") || productsLower.includes("plant")) products.push("Plants");
  if (productsLower.includes("craft") || productsLower.includes("artisan")) products.push("Crafts");

  return products.length > 0 ? products : ["Fresh Produce"];
}

/**
 * Fetch farmers markets from USDA Local Food Directories API
 * This is the primary data source - free, no API key required
 */
async function fetchFromUSDA(
  lat: number,
  lon: number
): Promise<FarmersMarketData[]> {
  try {
    const apiUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=${lat}&lng=${lon}`;

    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.log(`[IntelligentBots] USDA API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const marketsRaw = data.results || [];

    if (marketsRaw.length === 0) {
      return [];
    }

    console.log(`[IntelligentBots] USDA found ${marketsRaw.length} markets`);

    const markets: FarmersMarketData[] = [];

    // Fetch details for first 10 markets (to get schedule, products)
    for (const market of marketsRaw.slice(0, 10)) {
      if (!market.id) continue;

      try {
        const detailsUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${market.id}`;
        const detailsResponse = await fetch(detailsUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (!detailsResponse.ok) continue;

        const detailsData = await detailsResponse.json();
        const details = detailsData.marketdetails || {};

        const schedule = details.Schedule || market.schedule || "Schedule varies";
        const address = details.Address || market.Address || "";
        const products = details.Products || "";
        const distance = market.distance ? parseFloat(market.distance) : undefined;

        // Only include markets within 10-mile radius
        if (distance !== undefined && distance > RADIUS_CONFIG.PRIMARY_RADIUS_MILES) {
          continue;
        }

        const isOpenToday = checkIfOpenToday(schedule);
        const isOpenTomorrow = checkIfOpenTomorrow(schedule);

        // For farmers market posts, we want markets that are open today or tomorrow
        // This makes the content timely and actionable
        markets.push({
          name: market.marketname?.replace(/^\d+\.\d+\s*/, "") || "Farmers Market", // Remove distance prefix from name
          address,
          schedule,
          products: parseMarketProducts(products),
          isOpenToday,
          isOpenTomorrow,
          distance,
          lat: undefined, // USDA doesn't provide coordinates
          lon: undefined,
          website: details.Website || undefined,
        });
      } catch {
        // If details fetch fails, skip this market
        continue;
      }
    }

    return markets;
  } catch (error) {
    console.error("[IntelligentBots] USDA fetch error:", error);
    return [];
  }
}

/**
 * Fetch farmers markets from OpenStreetMap Overpass API
 * This is the fallback - completely free, no API key required
 */
async function fetchFromOSM(
  lat: number,
  lon: number
): Promise<FarmersMarketData[]> {
  console.log(`[IntelligentBots] OSM fallback: Searching near ${lat},${lon}`);

  try {
    const radiusMeters = RADIUS_CONFIG.PRIMARY_RADIUS_METERS;
    const query = `
      [out:json][timeout:15];
      (
        node["amenity"="marketplace"](around:${radiusMeters},${lat},${lon});
        way["amenity"="marketplace"](around:${radiusMeters},${lat},${lon});
        node["shop"="farm"](around:${radiusMeters},${lat},${lon});
        way["shop"="farm"](around:${radiusMeters},${lat},${lon});
        node["name"~"farmer|market|produce",i]["shop"](around:${radiusMeters},${lat},${lon});
        way["name"~"farmer|market|produce",i]["shop"](around:${radiusMeters},${lat},${lon});
      );
      out center body 20;
    `.trim();

    const overpassMirrors = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    let response: Response | null = null;

    for (const overpassUrl of overpassMirrors) {
      try {
        response = await fetch(overpassUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CommunityPulse/1.0",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) break;
      } catch {
        response = null;
      }
    }

    if (!response || !response.ok) {
      console.log("[IntelligentBots] OSM fallback failed");
      return [];
    }

    const data = await response.json();
    const elements = data.elements || [];

    console.log(`[IntelligentBots] OSM found ${elements.length} results`);

    interface OSMElement {
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }

    return elements
      .filter((el: OSMElement) => el.tags?.name)
      .map((el: OSMElement) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;

        const tags = el.tags || {};

        // Build address
        const addressParts: string[] = [];
        if (tags["addr:housenumber"] && tags["addr:street"]) {
          addressParts.push(`${tags["addr:housenumber"]} ${tags["addr:street"]}`);
        } else if (tags["addr:street"]) {
          addressParts.push(tags["addr:street"]);
        }
        if (tags["addr:city"]) {
          addressParts.push(tags["addr:city"]);
        }

        // Parse opening hours
        const openingHours = tags.opening_hours || "Schedule varies";
        const isOpenToday = openingHours !== "Schedule varies" && checkIfOpenToday(openingHours);
        const isOpenTomorrow = openingHours !== "Schedule varies" && checkIfOpenTomorrow(openingHours);

        // Determine products based on tags
        const products: string[] = ["Fresh Produce"];
        if (tags.organic === "yes") products.push("Organic");
        if (tags.cuisine) products.push("Prepared Foods");

        // Calculate distance
        const distance = calculateDistanceMiles({ lat, lon }, { lat: elLat, lon: elLon });

        return {
          name: tags.name,
          address: addressParts.join(", ") || "Address not available",
          schedule: openingHours,
          products,
          isOpenToday,
          isOpenTomorrow,
          distance: Math.round(distance * 10) / 10,
          lat: elLat,
          lon: elLon,
          website: tags.website || tags["contact:website"] || undefined,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[IntelligentBots] OSM fallback error:", error);
    return [];
  }
}

/**
 * Fetch farmers markets near a location
 *
 * Calls external APIs directly (no internal HTTP dependency) for reliability.
 * Uses USDA as primary source, with OSM as fallback.
 *
 * Returns markets sorted by: open today first, then by distance
 */
export async function fetchFarmersMarkets(
  cityName: string,
  state: string = "TX",
  coords?: CityCoords
): Promise<FarmersMarketData[]> {
  // Without coordinates, we cannot fetch farmers markets
  if (!coords) {
    console.log(`[IntelligentBots] No coordinates provided for ${cityName}, ${state} - skipping farmers markets`);
    return [];
  }

  const { lat, lon } = coords;

  try {
    // Try USDA first (best data quality)
    let markets = await fetchFromUSDA(lat, lon);

    // If USDA returned nothing, try OSM
    if (markets.length === 0) {
      markets = await fetchFromOSM(lat, lon);
    }

    if (markets.length === 0) {
      console.log(`[IntelligentBots] No farmers markets found near ${cityName}`);
      return [];
    }

    // Sort: open today first, then open tomorrow, then by distance
    markets.sort((a, b) => {
      // Open today is highest priority
      if (a.isOpenToday && !b.isOpenToday) return -1;
      if (!a.isOpenToday && b.isOpenToday) return 1;

      // Open tomorrow is second priority
      if (a.isOpenTomorrow && !b.isOpenTomorrow) return -1;
      if (!a.isOpenTomorrow && b.isOpenTomorrow) return 1;

      // Then sort by distance
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });

    console.log(`[IntelligentBots] Found ${markets.length} farmers markets near ${cityName}` +
      (markets.some(m => m.isOpenToday) ? ` (${markets.filter(m => m.isOpenToday).length} open today)` : '') +
      (markets.some(m => m.isOpenTomorrow) ? ` (${markets.filter(m => m.isOpenTomorrow).length} open tomorrow)` : ''));

    return markets.slice(0, 5); // Return top 5 markets
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch farmers markets:", error);
    return [];
  }
}
