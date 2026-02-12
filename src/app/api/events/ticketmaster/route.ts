import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ============================================================================
// Ticketmaster Events API Route
// ============================================================================
// Fetches real events from Ticketmaster Discovery API to solve cold-start.
// Uses in-memory caching with 5-minute TTL to reduce API calls.
// For small towns with no events, falls back to nearest major metro.
// ============================================================================

// --- Metro Fallback Map ---
// Maps states to their major metros with coordinates for event fallback
// Used when small towns have no events within 100 miles
const STATE_METRO_FALLBACK: Record<string, { name: string; lat: number; lng: number }[]> = {
  // Illinois - Chicago dominates, but St. Louis serves southern IL
  IL: [
    { name: "Chicago", lat: 41.8781, lng: -87.6298 },
    { name: "St. Louis", lat: 38.627, lng: -90.1994 },
  ],
  // Indiana
  IN: [
    { name: "Indianapolis", lat: 39.7684, lng: -86.1581 },
    { name: "Chicago", lat: 41.8781, lng: -87.6298 },
  ],
  // Texas - large state needs multiple metros
  TX: [
    { name: "Austin", lat: 30.2672, lng: -97.7431 },
    { name: "Dallas", lat: 32.7767, lng: -96.797 },
    { name: "Houston", lat: 29.7604, lng: -95.3698 },
    { name: "San Antonio", lat: 29.4241, lng: -98.4936 },
  ],
  // California
  CA: [
    { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
    { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
    { name: "San Diego", lat: 32.7157, lng: -117.1611 },
  ],
  // New York
  NY: [
    { name: "New York City", lat: 40.7128, lng: -74.006 },
    { name: "Buffalo", lat: 42.8864, lng: -78.8784 },
  ],
  // Florida
  FL: [
    { name: "Miami", lat: 25.7617, lng: -80.1918 },
    { name: "Orlando", lat: 28.5383, lng: -81.3792 },
    { name: "Tampa", lat: 27.9506, lng: -82.4572 },
  ],
  // Nevada
  NV: [
    { name: "Las Vegas", lat: 36.1699, lng: -115.1398 },
    { name: "Reno", lat: 39.5296, lng: -119.8138 },
  ],
  // Arizona
  AZ: [
    { name: "Phoenix", lat: 33.4484, lng: -112.074 },
    { name: "Tucson", lat: 32.2226, lng: -110.9747 },
  ],
  // Georgia
  GA: [
    { name: "Atlanta", lat: 33.749, lng: -84.388 },
  ],
  // Pennsylvania
  PA: [
    { name: "Philadelphia", lat: 39.9526, lng: -75.1652 },
    { name: "Pittsburgh", lat: 40.4406, lng: -79.9959 },
  ],
  // Ohio
  OH: [
    { name: "Columbus", lat: 39.9612, lng: -82.9988 },
    { name: "Cleveland", lat: 41.4993, lng: -81.6944 },
    { name: "Cincinnati", lat: 39.1031, lng: -84.512 },
  ],
  // Michigan
  MI: [
    { name: "Detroit", lat: 42.3314, lng: -83.0458 },
    { name: "Grand Rapids", lat: 42.9634, lng: -85.6681 },
  ],
  // North Carolina
  NC: [
    { name: "Charlotte", lat: 35.2271, lng: -80.8431 },
    { name: "Raleigh", lat: 35.7796, lng: -78.6382 },
  ],
  // Washington
  WA: [
    { name: "Seattle", lat: 47.6062, lng: -122.3321 },
  ],
  // Colorado
  CO: [
    { name: "Denver", lat: 39.7392, lng: -104.9903 },
  ],
  // Massachusetts
  MA: [
    { name: "Boston", lat: 42.3601, lng: -71.0589 },
  ],
  // Tennessee
  TN: [
    { name: "Nashville", lat: 36.1627, lng: -86.7816 },
    { name: "Memphis", lat: 35.1495, lng: -90.049 },
  ],
  // Missouri
  MO: [
    { name: "St. Louis", lat: 38.627, lng: -90.1994 },
    { name: "Kansas City", lat: 39.0997, lng: -94.5786 },
  ],
  // Minnesota
  MN: [
    { name: "Minneapolis", lat: 44.9778, lng: -93.265 },
  ],
  // Oregon
  OR: [
    { name: "Portland", lat: 45.5152, lng: -122.6784 },
  ],
  // Louisiana
  LA: [
    { name: "New Orleans", lat: 29.9511, lng: -90.0715 },
  ],
};

// Helper to calculate distance between two points (Haversine formula)
function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearest metro for a given location and state
function findNearestMetro(lat: number, lng: number, state: string): { name: string; lat: number; lng: number; distance: number } | null {
  const metros = STATE_METRO_FALLBACK[state];
  if (!metros || metros.length === 0) return null;

  let nearest = metros[0];
  let minDistance = getDistanceMiles(lat, lng, nearest.lat, nearest.lng);

  for (const metro of metros.slice(1)) {
    const distance = getDistanceMiles(lat, lng, metro.lat, metro.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = metro;
    }
  }

  return { ...nearest, distance: Math.round(minDistance) };
}

// --- Types ---

export type TicketmasterEvent = {
  id: string;
  name: string;
  date: string; // ISO date string
  time: string | null; // e.g., "19:30" or null if TBD
  venue: string;
  venueAddress: string | null;
  /** City where the venue is located */
  venueCity: string | null;
  priceRange: string | null; // e.g., "$25 - $150" or null
  category: string | null;
  url: string;
  imageUrl: string | null;
  /** Venue coordinates for distance calculation */
  venueCoords: { lat: number; lng: number } | null;
  /** Distance from user's location in miles */
  distanceMiles: number | null;
};

// Response type with optional fallback info
export type TicketmasterResponse = {
  events: TicketmasterEvent[];
  cached?: boolean;
  total?: number;
  error?: string;
  // Fallback info when events come from a nearby metro
  fallback?: {
    metro: string;
    distance: number; // miles
  };
};

type CacheEntry = {
  events: TicketmasterEvent[];
  timestamp: number;
  fallback?: { metro: string; distance: number };
};

// --- In-Memory Cache ---
// Key format: "lat,lng,radius" or "city"
//
// TICKETMASTER ToS COMPLIANCE:
// - No permanent storage of event data allowed
// - Cache TTL must be < 24 hours (we use 5 minutes for freshness)
// - All event links must go directly to Ticketmaster
// - Attribution required in UI ("Event data provided by Ticketmaster")
//
const eventCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - compliant with ToS (< 24h)

function getCacheKey(params: {
  lat?: number;
  lng?: number;
  radius?: number;
  city?: string;
}): string {
  if (params.lat !== undefined && params.lng !== undefined) {
    return `${params.lat.toFixed(4)},${params.lng.toFixed(4)},${params.radius ?? 5}`;
  }
  return params.city?.toLowerCase().trim() ?? "unknown";
}

function getCachedEntry(key: string): CacheEntry | null {
  const entry = eventCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    eventCache.delete(key);
    return null;
  }

  return entry;
}

function setCachedEntry(key: string, events: TicketmasterEvent[], fallback?: { metro: string; distance: number }): void {
  eventCache.set(key, {
    events,
    timestamp: Date.now(),
    fallback,
  });

  // Limit cache size to prevent memory issues
  if (eventCache.size > 100) {
    const oldestKey = eventCache.keys().next().value;
    if (oldestKey) {
      eventCache.delete(oldestKey);
    }
  }
}

// --- Ticketmaster API Response Types ---

type TicketmasterApiEvent = {
  id: string;
  name: string;
  url: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
    };
  };
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  images?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      address?: { line1?: string };
      city?: { name?: string };
      state?: { stateCode?: string };
      location?: {
        latitude?: string;
        longitude?: string;
      };
    }>;
  };
};

type TicketmasterApiResponse = {
  _embedded?: {
    events?: TicketmasterApiEvent[];
  };
  page?: {
    totalElements?: number;
  };
};

// --- Helper Functions ---

function formatPriceRange(
  priceRanges?: TicketmasterApiEvent["priceRanges"]
): string | null {
  if (!priceRanges || priceRanges.length === 0) return null;

  const range = priceRanges[0];
  if (!range.min && !range.max) return null;

  const currency = range.currency === "USD" ? "$" : range.currency ?? "$";

  if (range.min && range.max && range.min !== range.max) {
    return `${currency}${Math.round(range.min)} - ${currency}${Math.round(range.max)}`;
  }

  if (range.min) {
    return `From ${currency}${Math.round(range.min)}`;
  }

  if (range.max) {
    return `Up to ${currency}${Math.round(range.max)}`;
  }

  return null;
}

function extractCategory(
  classifications?: TicketmasterApiEvent["classifications"]
): string | null {
  if (!classifications || classifications.length === 0) return null;

  const classification = classifications[0];
  return (
    classification.segment?.name ||
    classification.genre?.name ||
    null
  );
}

function extractVenueInfo(embedded?: TicketmasterApiEvent["_embedded"]): {
  venue: string;
  venueAddress: string | null;
  venueCity: string | null;
  venueCoords: { lat: number; lng: number } | null;
} {
  if (!embedded?.venues || embedded.venues.length === 0) {
    return { venue: "Venue TBD", venueAddress: null, venueCity: null, venueCoords: null };
  }

  const venueData = embedded.venues[0];
  const venue = venueData.name || "Venue TBD";
  const venueCity = venueData.city?.name || null;

  let venueAddress: string | null = null;
  const addressParts: string[] = [];

  if (venueData.address?.line1) addressParts.push(venueData.address.line1);
  if (venueData.city?.name) addressParts.push(venueData.city.name);
  if (venueData.state?.stateCode) addressParts.push(venueData.state.stateCode);

  if (addressParts.length > 0) {
    venueAddress = addressParts.join(", ");
  }

  // Extract venue coordinates for distance calculation
  let venueCoords: { lat: number; lng: number } | null = null;
  if (venueData.location?.latitude && venueData.location?.longitude) {
    venueCoords = {
      lat: parseFloat(venueData.location.latitude),
      lng: parseFloat(venueData.location.longitude),
    };
  }

  return { venue, venueAddress, venueCity, venueCoords };
}

function selectBestImage(
  images?: TicketmasterApiEvent["images"]
): string | null {
  if (!images || images.length === 0) return null;

  // Prefer images around 300-600px width for cards
  const sorted = [...images].sort((a, b) => {
    const aScore = Math.abs(a.width - 400);
    const bScore = Math.abs(b.width - 400);
    return aScore - bScore;
  });

  return sorted[0]?.url ?? null;
}

function normalizeEvent(
  apiEvent: TicketmasterApiEvent,
  userLat?: number,
  userLng?: number
): TicketmasterEvent {
  const { venue, venueAddress, venueCity, venueCoords } = extractVenueInfo(apiEvent._embedded);

  // Calculate distance from user's location if we have both coordinates
  let distanceMiles: number | null = null;
  if (userLat !== undefined && userLng !== undefined && venueCoords) {
    distanceMiles = Math.round(
      getDistanceMiles(userLat, userLng, venueCoords.lat, venueCoords.lng) * 10
    ) / 10; // Round to 1 decimal place
  }

  return {
    id: apiEvent.id,
    name: apiEvent.name,
    date: apiEvent.dates?.start?.localDate || "",
    time: apiEvent.dates?.start?.localTime || null,
    venue,
    venueAddress,
    venueCity,
    priceRange: formatPriceRange(apiEvent.priceRanges),
    category: extractCategory(apiEvent.classifications),
    url: apiEvent.url,
    imageUrl: selectBestImage(apiEvent.images),
    venueCoords,
    distanceMiles,
  };
}

// --- API Route Handler ---

export async function GET(req: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY || process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY || process.env.NEWS_API_KEY;

  if (!apiKey) {
    console.error("Ticketmaster API key not configured (checked TICKETMASTER_API_KEY, NEXT_PUBLIC_TICKETMASTER_API_KEY, NEWS_API_KEY)");
    return NextResponse.json(
      {
        error: "Events service not configured",
        events: [],
      },
      { status: 200 } // Return 200 with empty events for graceful degradation
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius");
  const city = searchParams.get("city");

  // Validate parameters - need either lat/lng or city
  if ((!lat || !lng) && !city) {
    return NextResponse.json(
      {
        error: "Missing location. Provide lat/lng or city parameter.",
        events: [],
      },
      { status: 400 }
    );
  }

  let parsedLat = lat ? parseFloat(lat) : undefined;
  let parsedLng = lng ? parseFloat(lng) : undefined;
  const parsedRadius = radius ? parseInt(radius, 10) : 25; // Default 25 miles
  const stateParam = searchParams.get("state"); // e.g., "TX"

  // If only city is provided, geocode it to get lat/lng
  // Ticketmaster API doesn't have a "city" parameter - it only supports latlong
  // Use Nominatim directly (avoids server-to-server API call issues)
  if (parsedLat === undefined && parsedLng === undefined && city) {
    try {
      // Include state in geocoding query to avoid matching wrong city (e.g., Leander WV vs TX)
      const geocodeQuery = stateParam ? `${city}, ${stateParam}, US` : city;
      console.log(`[Ticketmaster] Geocoding city via Nominatim: ${geocodeQuery}`);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geocodeQuery)}&format=json&limit=1&countrycodes=us`;
      const geocodeRes = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "CommunityPulse/1.0",
        },
        // MOBILE FIX: Add 4-second timeout for mobile reliability
        signal: AbortSignal.timeout(4000),
      });

      if (geocodeRes.ok) {
        const geoData = await geocodeRes.json();
        if (geoData && geoData.length > 0) {
          parsedLat = parseFloat(geoData[0].lat);
          parsedLng = parseFloat(geoData[0].lon);
          console.log(`[Ticketmaster] Geocoded ${city} → ${parsedLat}, ${parsedLng}`);
        }
      }
    } catch (err) {
      console.error(`[Ticketmaster] Geocoding failed for ${city}:`, err);
    }

    // If geocoding failed, return empty events gracefully
    if (parsedLat === undefined || parsedLng === undefined) {
      console.warn(`[Ticketmaster] Could not geocode city: ${city}`);
      return NextResponse.json({
        events: [],
        error: "Could not determine location coordinates",
      });
    }
  }

  // Check cache first
  const cacheKey = getCacheKey({
    lat: parsedLat,
    lng: parsedLng,
    radius: parsedRadius,
    city: city || undefined,
  });

  const cachedEntry = getCachedEntry(cacheKey);
  if (cachedEntry) {
    const response: TicketmasterResponse = {
      events: cachedEntry.events,
      cached: true,
    };
    if (cachedEntry.fallback) {
      response.fallback = cachedEntry.fallback;
    }
    return NextResponse.json(response);
  }

  try {
    // Build Ticketmaster API URL
    const baseUrl = "https://app.ticketmaster.com/discovery/v2/events.json";

    // Get today's date in Ticketmaster format: YYYY-MM-DDTHH:mm:ssZ
    const now = new Date();
    const startDateTime = now.toISOString().split(".")[0] + "Z";

    const params = new URLSearchParams({
      apikey: apiKey,
      size: "20", // Limit to 20 events
      sort: "date,asc", // Sort by date, soonest first
      startDateTime: startDateTime, // Only get future events
    });
    console.log(`[Ticketmaster] Using startDateTime: ${startDateTime}`);

    // Always use latlong - we geocode cities above if needed
    // Ticketmaster doesn't support a "city" parameter
    if (parsedLat !== undefined && parsedLng !== undefined) {
      params.set("latlong", `${parsedLat},${parsedLng}`);
      params.set("radius", String(Math.min(parsedRadius, 100))); // Cap at 100 miles
      params.set("unit", "miles");
      console.log(`[Ticketmaster] Searching at ${parsedLat},${parsedLng} radius ${parsedRadius}mi`);
    }

    // Add stateCode filter to prevent wrong-state matches (e.g., Leander WV vs TX)
    if (stateParam) {
      params.set("stateCode", stateParam.toUpperCase());
      console.log(`[Ticketmaster] Filtering by stateCode: ${stateParam.toUpperCase()}`);
    }

    const url = `${baseUrl}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      // MOBILE FIX: Reduced timeout for mobile reliability (was 10s, now 6s)
      signal: AbortSignal.timeout(6000),
    });

    // Handle rate limiting
    if (response.status === 429) {
      console.warn("Ticketmaster API rate limited");
      return NextResponse.json(
        {
          error: "Events service is busy. Please try again later.",
          events: [],
          rateLimited: true,
        },
        { status: 200 } // Return 200 for graceful degradation
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ticketmaster API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Unable to fetch events right now.",
          events: [],
        },
        { status: 200 }
      );
    }

    const data: TicketmasterApiResponse = await response.json();
    const apiEvents = data._embedded?.events || [];

    console.log(`[Ticketmaster] Raw API returned ${apiEvents.length} events`);

    // Normalize events to our format with distance calculation
    // Note: We already filter by startDateTime in the API request, so no client-side date filtering needed
    let events = apiEvents
      .filter((e) => e.dates?.start?.localDate) // Just ensure date exists
      .map((e) => normalizeEvent(e, parsedLat, parsedLng));

    // Sort by distance (closest first), then by date for events at same distance
    events.sort((a, b) => {
      // Events without distance go last
      if (a.distanceMiles === null && b.distanceMiles === null) {
        // Both have no distance - sort by date
        return (a.date || "").localeCompare(b.date || "");
      }
      if (a.distanceMiles === null) return 1;
      if (b.distanceMiles === null) return -1;

      // Sort by distance (closest first)
      if (a.distanceMiles !== b.distanceMiles) {
        return a.distanceMiles - b.distanceMiles;
      }

      // Same distance - sort by date
      return (a.date || "").localeCompare(b.date || "");
    });

    console.log(`[Ticketmaster] Final events count: ${events.length}, sorted by distance`);

    // --- METRO FALLBACK for small towns ---
    // If no events found, try nearest major metro
    let fallbackInfo: { metro: string; distance: number } | undefined;

    if (events.length === 0 && parsedLat !== undefined && parsedLng !== undefined) {
      // Extract state from city parameter (e.g., "Irwin, Illinois, US" → "IL")
      let stateCode: string | null = null;
      if (city) {
        // Try to find state name or code in the city string
        const STATE_NAMES: Record<string, string> = {
          alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
          colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
          hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
          kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
          massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
          montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
          "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
          ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
          "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
          vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
          wisconsin: "WI", wyoming: "WY",
        };

        const cityLower = city.toLowerCase();
        // Check for state name
        for (const [name, code] of Object.entries(STATE_NAMES)) {
          if (cityLower.includes(name)) {
            stateCode = code;
            break;
          }
        }
        // Also check for state code (e.g., ", IL," or ", IL" at end)
        if (!stateCode) {
          const stateMatch = city.match(/,\s*([A-Z]{2})(?:\s*[,\s]|$)/i);
          if (stateMatch) {
            stateCode = stateMatch[1].toUpperCase();
          }
        }
      }

      if (stateCode) {
        const nearestMetro = findNearestMetro(parsedLat, parsedLng, stateCode);

        if (nearestMetro) {
          console.log(`[Ticketmaster] No local events, trying metro fallback: ${nearestMetro.name} (${nearestMetro.distance}mi away)`);

          // Search the metro area
          const metroParams = new URLSearchParams({
            apikey: apiKey,
            size: "20",
            sort: "date,asc",
            startDateTime: startDateTime,
            latlong: `${nearestMetro.lat},${nearestMetro.lng}`,
            radius: "50",
            unit: "miles",
          });

          try {
            const metroResponse = await fetch(`${baseUrl}?${metroParams.toString()}`, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(10000),
            });

            if (metroResponse.ok) {
              const metroData: TicketmasterApiResponse = await metroResponse.json();
              const metroApiEvents = metroData._embedded?.events || [];

              events = metroApiEvents
                .filter((e) => e.dates?.start?.localDate)
                .map((e) => normalizeEvent(e, parsedLat, parsedLng));

              // Sort metro fallback events by distance too
              events.sort((a, b) => {
                if (a.distanceMiles === null && b.distanceMiles === null) {
                  return (a.date || "").localeCompare(b.date || "");
                }
                if (a.distanceMiles === null) return 1;
                if (b.distanceMiles === null) return -1;
                if (a.distanceMiles !== b.distanceMiles) {
                  return a.distanceMiles - b.distanceMiles;
                }
                return (a.date || "").localeCompare(b.date || "");
              });

              if (events.length > 0) {
                fallbackInfo = {
                  metro: nearestMetro.name,
                  distance: nearestMetro.distance,
                };
                console.log(`[Ticketmaster] Found ${events.length} events from ${nearestMetro.name}`);
              }
            }
          } catch (metroErr) {
            console.error(`[Ticketmaster] Metro fallback failed:`, metroErr);
          }
        }
      }
    }

    // Cache the results (including fallback info)
    setCachedEntry(cacheKey, events, fallbackInfo);

    const response_data: TicketmasterResponse = {
      events,
      cached: false,
      total: data.page?.totalElements ?? events.length,
    };

    if (fallbackInfo) {
      response_data.fallback = fallbackInfo;
    }

    return NextResponse.json(response_data);
  } catch (error) {
    // Handle timeout and other errors gracefully
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("Ticketmaster API timeout");
      return NextResponse.json(
        {
          error: "Events service timed out. Please try again.",
          events: [],
        },
        { status: 200 }
      );
    }

    console.error("Unexpected error fetching events:", error);
    return NextResponse.json(
      {
        error: "Unable to fetch events right now.",
        events: [],
      },
      { status: 200 }
    );
  }
}
