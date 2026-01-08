/**
 * Data Fetchers - Real-time data from external APIs
 *
 * Fetches traffic, weather, and event data to inform bot posts
 */

import type { CityCoords, TrafficData, WeatherData, EventData, TrafficIncident } from "./types";

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
 */
export async function fetchTrafficIncidents(coords: CityCoords, radiusKm: number = 10): Promise<TrafficIncident[]> {
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
 * Searches by lat/lng with 30-mile radius for better coverage in suburbs
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

    // Prefer lat/lng search with radius for suburbs like Leander
    if (coords) {
      params.set("latlong", `${coords.lat},${coords.lon}`);
      params.set("radius", "30"); // 30 mile radius to include nearby events
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

    return events.map((event: Record<string, unknown>) => {
      const venue = (event._embedded as Record<string, unknown[]>)?.venues?.[0] as Record<string, string> | undefined;
      const dates = event.dates as Record<string, Record<string, string>>;

      return {
        name: event.name as string,
        venue: venue?.name || "Unknown venue",
        startTime: new Date(dates?.start?.dateTime || dates?.start?.localDate || ""),
        category: ((event.classifications as Record<string, Record<string, string>>[])?.[0]?.segment?.name) || "Event",
      };
    });
  } catch (error) {
    console.error("[IntelligentBots] Failed to fetch events:", error);
    return [];
  }
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
