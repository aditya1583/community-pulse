import { NextRequest, NextResponse } from "next/server";

/**
 * TomTom Traffic Live API Route
 *
 * Fetches real-time traffic data including:
 * - Traffic flow (current speed vs free flow speed)
 * - Traffic incidents (accidents, road work, closures)
 * - Calculated traffic level based on flow percentage
 *
 * TOMTOM ToS COMPLIANCE:
 * - Cache TTL: 5 min HTTP + 1 min in-memory (compliant with 30-day max)
 * - Real-time data: No historical storage, ephemeral only
 * - Attribution: "Traffic by TomTom" link required in UI
 * - Request deduplication: Same-area requests share cache (QPS protection)
 * - Graceful fallback: Returns estimated data if API fails
 */

// --- In-Memory Cache for QPS Protection ---
// TomTom has 5-50 QPS limits. During "pulse events" (local emergency, festival),
// hundreds of users may open the app simultaneously. This cache prevents
// thundering herd by deduplicating requests for the same ~1km area.
type TrafficCacheEntry = {
  data: TrafficLiveResponse;
  timestamp: number;
};
const trafficCache = new Map<string, TrafficCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

// Generate cache key from coordinates (rounded to ~1km precision)
function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

// Clean expired cache entries periodically
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of trafficCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      trafficCache.delete(key);
    }
  }
}

// City coordinates for common cities (fallback when no lat/lon provided)
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "austin": { lat: 30.2672, lon: -97.7431 },
  "houston": { lat: 29.7604, lon: -95.3698 },
  "dallas": { lat: 32.7767, lon: -96.7970 },
  "san antonio": { lat: 29.4241, lon: -98.4936 },
  "new york": { lat: 40.7128, lon: -74.0060 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  "chicago": { lat: 41.8781, lon: -87.6298 },
  "phoenix": { lat: 33.4484, lon: -112.0740 },
  "philadelphia": { lat: 39.9526, lon: -75.1652 },
  "san diego": { lat: 32.7157, lon: -117.1611 },
  "san jose": { lat: 37.3382, lon: -121.8863 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  "seattle": { lat: 47.6062, lon: -122.3321 },
  "denver": { lat: 39.7392, lon: -104.9903 },
  "boston": { lat: 42.3601, lon: -71.0589 },
  "atlanta": { lat: 33.7490, lon: -84.3880 },
  "miami": { lat: 25.7617, lon: -80.1918 },
  "detroit": { lat: 42.3314, lon: -83.0458 },
  "portland": { lat: 45.5152, lon: -122.6784 },
  "las vegas": { lat: 36.1699, lon: -115.1398 },
};

export type TrafficIncident = {
  id: string;
  type: "accident" | "roadwork" | "closure" | "congestion" | "other";
  description: string;
  roadName?: string;
  delay?: number; // delay in seconds
  severity: 1 | 2 | 3 | 4; // 1=minor, 4=major
};

export type TrafficLiveResponse = {
  level: "Light" | "Moderate" | "Heavy" | "Severe";
  flowPercent: number; // Current speed as % of free flow speed
  currentSpeed?: number;
  freeFlowSpeed?: number;
  incidents: TrafficIncident[];
  hasRoadClosure: boolean;
  lastUpdated: string;
  source: "tomtom";
};

function getCoordinatesForCity(cityName: string): { lat: number; lon: number } | null {
  // Normalize city name - extract just the city part before comma
  const normalizedCity = cityName.split(",")[0].toLowerCase().trim();
  return CITY_COORDINATES[normalizedCity] || null;
}

function calculateTrafficLevel(flowPercent: number, hasRoadClosure: boolean): "Light" | "Moderate" | "Heavy" | "Severe" {
  if (hasRoadClosure) return "Severe";
  if (flowPercent >= 80) return "Light";
  if (flowPercent >= 60) return "Moderate";
  if (flowPercent >= 40) return "Heavy";
  return "Severe";
}

function mapIncidentType(category: string): TrafficIncident["type"] {
  const categoryLower = category?.toLowerCase() || "";
  if (categoryLower.includes("accident") || categoryLower.includes("collision")) return "accident";
  if (categoryLower.includes("road") && categoryLower.includes("work")) return "roadwork";
  if (categoryLower.includes("closure") || categoryLower.includes("closed")) return "closure";
  if (categoryLower.includes("congestion") || categoryLower.includes("jam")) return "congestion";
  return "other";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!city && (!lat || !lon)) {
    return NextResponse.json(
      { error: "Missing city or coordinates parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TomTom API key not configured (checked TOMTOM_API_KEY, NEXT_PUBLIC_TOMTOM_API_KEY, TRAFFIC_API_KEY)" },
      { status: 500 }
    );
  }

  try {
    // Determine coordinates
    let coords: { lat: number; lon: number } | null = null;

    if (lat && lon) {
      coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
    } else if (city) {
      coords = getCoordinatesForCity(city);
    }

    if (!coords) {
      // If we can't find coordinates, return a graceful fallback
      return NextResponse.json({
        level: "Moderate",
        flowPercent: 75,
        incidents: [],
        hasRoadClosure: false,
        lastUpdated: new Date().toISOString(),
        source: "tomtom",
        message: "Using estimated data - city coordinates not found"
      });
    }

    // --- QPS Protection: Check in-memory cache first ---
    // This prevents thundering herd when many users request same area simultaneously
    cleanExpiredCache();
    const cacheKey = getCacheKey(coords.lat, coords.lon);
    const cached = trafficCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
          "X-Cache": "HIT"
        }
      });
    }

    // Create bounding box around city center (approximately 5 miles)
    const delta = 0.08; // ~5 miles in degrees
    const minLon = coords.lon - delta;
    const minLat = coords.lat - delta;
    const maxLon = coords.lon + delta;
    const maxLat = coords.lat + delta;
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    // Fetch traffic flow data
    const flowUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${coords.lat},${coords.lon}&key=${apiKey}`;

    // Fetch traffic incidents
    const incidentsUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${apiKey}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,aci{probabilityOfOccurrence,numberOfReports,lastReportTime}}}}`;

    const [flowResponse, incidentsResponse] = await Promise.allSettled([
      fetch(flowUrl),
      fetch(incidentsUrl)
    ]);

    let flowPercent = 75; // Default
    let currentSpeed: number | undefined;
    let freeFlowSpeed: number | undefined;

    // Process flow data
    if (flowResponse.status === "fulfilled" && flowResponse.value.ok) {
      try {
        const flowData = await flowResponse.value.json();
        if (flowData.flowSegmentData) {
          currentSpeed = flowData.flowSegmentData.currentSpeed;
          freeFlowSpeed = flowData.flowSegmentData.freeFlowSpeed;
          if (currentSpeed !== undefined && freeFlowSpeed && freeFlowSpeed > 0) {
            flowPercent = Math.round((currentSpeed / freeFlowSpeed) * 100);
          }
        }
      } catch (e) {
        console.error("Error parsing flow data:", e);
      }
    }

    // Process incidents data
    const incidents: TrafficIncident[] = [];
    let hasRoadClosure = false;

    if (incidentsResponse.status === "fulfilled" && incidentsResponse.value.ok) {
      try {
        const incidentsData = await incidentsResponse.value.json();

        if (incidentsData.incidents && Array.isArray(incidentsData.incidents)) {
          for (const incident of incidentsData.incidents.slice(0, 10)) { // Limit to 10 incidents
            const props = incident.properties || {};
            const events = props.events || [];

            // Get description from events
            const description = events.length > 0
              ? events.map((e: { description?: string }) => e.description || "").join("; ")
              : "Traffic incident reported";

            // Map icon category to incident type
            const iconCategory = props.iconCategory || 0;
            let incidentType: TrafficIncident["type"] = "other";

            // TomTom icon categories: 1=Unknown, 2=Accident, 3=Fog, 4=Dangerous, 5=Rain,
            // 6=Ice, 7=Jam, 8=Lane closed, 9=Road closed, 10=Road works, 11=Wind, 14=Broken down vehicle
            switch (iconCategory) {
              case 2: incidentType = "accident"; break;
              case 7: incidentType = "congestion"; break;
              case 8:
              case 9:
                incidentType = "closure";
                hasRoadClosure = true;
                break;
              case 10: incidentType = "roadwork"; break;
              default: incidentType = "other";
            }

            // Severity based on magnitude of delay (0-4)
            const magnitude = props.magnitudeOfDelay || 0;
            let severity: 1 | 2 | 3 | 4 = 1;
            if (magnitude >= 3) severity = 4;
            else if (magnitude >= 2) severity = 3;
            else if (magnitude >= 1) severity = 2;

            // Road name from properties
            const roadNumbers = props.roadNumbers || [];
            const roadName = roadNumbers.length > 0 ? roadNumbers.join(", ") : (props.from || undefined);

            incidents.push({
              id: `${incident.type || "incident"}-${incidents.length}`,
              type: incidentType,
              description: description || "Traffic incident",
              roadName,
              delay: props.delay,
              severity
            });
          }
        }
      } catch (e) {
        console.error("Error parsing incidents data:", e);
      }
    }

    // Calculate traffic level
    const level = calculateTrafficLevel(flowPercent, hasRoadClosure);

    const response: TrafficLiveResponse = {
      level,
      flowPercent,
      currentSpeed,
      freeFlowSpeed,
      incidents,
      hasRoadClosure,
      lastUpdated: new Date().toISOString(),
      source: "tomtom"
    };

    // --- ALERT TRIGGER ---
    // If there is a road closure, asynchronously trigger a notification
    // We don't await this to keep the API response fast
    if (hasRoadClosure && incidents.length > 0) {
      const closure = incidents.find(i => i.type === "closure");
      if (closure && city) {
        // Fire and forget (in a real serverless env, use waitUntil or after())
        // For standard Node/Vercel functions, this might complete if fast enough
        // or require background handling.
        Promise.resolve().then(async () => {
          try {
            const { sendCityNotification } = await import("@/lib/pushNotifications");
            await sendCityNotification(city, "road_closure", {
              type: "road_closure",
              city: city,
              roadName: closure.roadName || "Road",
              description: closure.description || "Traffic blocked due to closure"
            });
          } catch (err) {
            console.error("Failed to send closure notification:", err);
          }
        });
      }
    }

    // --- QPS Protection: Cache the response ---
    trafficCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60", // 5 min CDN cache
        "X-Cache": "MISS"
      }
    });

  } catch (error) {
    console.error("Error fetching TomTom traffic data:", error);

    // Return graceful fallback on error
    return NextResponse.json({
      level: "Moderate",
      flowPercent: 70,
      incidents: [],
      hasRoadClosure: false,
      lastUpdated: new Date().toISOString(),
      source: "tomtom",
      error: "Traffic data temporarily unavailable"
    });
  }
}
