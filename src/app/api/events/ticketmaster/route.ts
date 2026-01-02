import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Ticketmaster Events API Route
// ============================================================================
// Fetches real events from Ticketmaster Discovery API to solve cold-start.
// Uses in-memory caching with 5-minute TTL to reduce API calls.
// ============================================================================

// --- Types ---

export type TicketmasterEvent = {
  id: string;
  name: string;
  date: string; // ISO date string
  time: string | null; // e.g., "19:30" or null if TBD
  venue: string;
  venueAddress: string | null;
  priceRange: string | null; // e.g., "$25 - $150" or null
  category: string | null;
  url: string;
  imageUrl: string | null;
};

type CacheEntry = {
  events: TicketmasterEvent[];
  timestamp: number;
};

// --- In-Memory Cache ---
// Key format: "lat,lng,radius" or "city"
const eventCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

function getCachedEvents(key: string): TicketmasterEvent[] | null {
  const entry = eventCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    eventCache.delete(key);
    return null;
  }

  return entry.events;
}

function setCachedEvents(key: string, events: TicketmasterEvent[]): void {
  eventCache.set(key, {
    events,
    timestamp: Date.now(),
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
} {
  if (!embedded?.venues || embedded.venues.length === 0) {
    return { venue: "Venue TBD", venueAddress: null };
  }

  const venueData = embedded.venues[0];
  const venue = venueData.name || "Venue TBD";

  let venueAddress: string | null = null;
  const addressParts: string[] = [];

  if (venueData.address?.line1) addressParts.push(venueData.address.line1);
  if (venueData.city?.name) addressParts.push(venueData.city.name);
  if (venueData.state?.stateCode) addressParts.push(venueData.state.stateCode);

  if (addressParts.length > 0) {
    venueAddress = addressParts.join(", ");
  }

  return { venue, venueAddress };
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

function normalizeEvent(apiEvent: TicketmasterApiEvent): TicketmasterEvent {
  const { venue, venueAddress } = extractVenueInfo(apiEvent._embedded);

  return {
    id: apiEvent.id,
    name: apiEvent.name,
    date: apiEvent.dates?.start?.localDate || "",
    time: apiEvent.dates?.start?.localTime || null,
    venue,
    venueAddress,
    priceRange: formatPriceRange(apiEvent.priceRanges),
    category: extractCategory(apiEvent.classifications),
    url: apiEvent.url,
    imageUrl: selectBestImage(apiEvent.images),
  };
}

// --- API Route Handler ---

export async function GET(req: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    console.error("TICKETMASTER_API_KEY not configured");
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

  const parsedLat = lat ? parseFloat(lat) : undefined;
  const parsedLng = lng ? parseFloat(lng) : undefined;
  const parsedRadius = radius ? parseInt(radius, 10) : 25; // Default 25 miles

  // Check cache first
  const cacheKey = getCacheKey({
    lat: parsedLat,
    lng: parsedLng,
    radius: parsedRadius,
    city: city || undefined,
  });

  const cachedEvents = getCachedEvents(cacheKey);
  if (cachedEvents) {
    return NextResponse.json({
      events: cachedEvents,
      cached: true,
    });
  }

  try {
    // Build Ticketmaster API URL
    const baseUrl = "https://app.ticketmaster.com/discovery/v2/events.json";
    const params = new URLSearchParams({
      apikey: apiKey,
      size: "20", // Limit to 20 events
      sort: "date,asc", // Sort by date, soonest first
    });

    // Use lat/lng for geo-based search, or city for keyword search
    if (parsedLat !== undefined && parsedLng !== undefined) {
      params.set("latlong", `${parsedLat},${parsedLng}`);
      params.set("radius", String(Math.min(parsedRadius, 100))); // Cap at 100 miles
      params.set("unit", "miles");
    } else if (city) {
      // Extract city name for keyword search
      const cityName = city.split(",")[0].trim();
      params.set("keyword", cityName);
      params.set("locale", "*"); // Search all locales
    }

    const url = `${baseUrl}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      // Set a reasonable timeout
      signal: AbortSignal.timeout(10000),
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

    // Get today's date string in YYYY-MM-DD format for comparison
    const today = new Date().toISOString().split("T")[0];

    // Normalize events to our format and filter out past events
    const events = apiEvents
      .filter((e) => {
        const eventDate = e.dates?.start?.localDate;
        // Only include events with dates that are today or in the future
        return eventDate && eventDate >= today;
      })
      .map(normalizeEvent);

    // Cache the results
    setCachedEvents(cacheKey, events);

    return NextResponse.json({
      events,
      cached: false,
      total: data.page?.totalElements ?? events.length,
    });
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
