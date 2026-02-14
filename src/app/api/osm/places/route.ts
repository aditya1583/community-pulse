import { NextRequest, NextResponse } from "next/server";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

export const dynamic = "force-dynamic";

/**
 * OpenStreetMap Overpass API Route
 *
 * FREE fallback for local places when Foursquare fails.
 * Uses Overpass API - no API key required!
 *
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export type OSMPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: number | null;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  openingHours?: string;
};

export type OSMPlacesResponse = {
  places: OSMPlace[];
  total: number;
  source: "openstreetmap";
};

// OSM tags for different categories
// Note: amenity vs shop tags vary by POI type
type CategoryConfig = {
  amenities?: string[];
  shops?: string[];
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  all: { amenities: ["cafe", "restaurant", "bar", "fast_food", "pub", "ice_cream", "bakery"] },
  coffee: { amenities: ["cafe"] },
  restaurants: { amenities: ["restaurant", "fast_food"] },
  bars: { amenities: ["bar", "pub", "nightclub"] },
  grocery: { shops: ["supermarket", "convenience", "grocery", "greengrocer"] },
};

// Human-readable category names
const TAG_LABELS: Record<string, string> = {
  // Amenities
  cafe: "Coffee Shop",
  restaurant: "Restaurant",
  bar: "Bar",
  fast_food: "Fast Food",
  pub: "Pub",
  ice_cream: "Ice Cream",
  bakery: "Bakery",
  nightclub: "Nightclub",
  // Shops
  supermarket: "Supermarket",
  convenience: "Convenience Store",
  grocery: "Grocery Store",
  greengrocer: "Grocery Store",
};

// Calculate distance in meters between two points
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Server-side cache: places barely change, Overpass is slow (~5s)
// Key: rounded lat/lon (3 decimals ≈ 110m) + category
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const placesCache = new Map<string, { data: OSMPlacesResponse; ts: number }>();

function getCacheKey(lat: number, lon: number, category: string, radius: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)},${category},${radius}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const category = searchParams.get("category") || "all";
  const radiusMeters = parseInt(searchParams.get("radius") || String(RADIUS_CONFIG.PRIMARY_RADIUS_METERS));
  const limit = parseInt(searchParams.get("limit") || "15");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat/lon coordinates", places: [], source: "openstreetmap" },
      { status: 400 }
    );
  }

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);

  // Check server-side cache first (saves 4-5s Overpass round-trip)
  const cacheKey = getCacheKey(parsedLat, parsedLon, category, radiusMeters);
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    // Get category config (amenities and/or shops)
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.all;

    // Build query parts for both amenity and shop tags
    const queryParts: string[] = [];

    if (config.amenities && config.amenities.length > 0) {
      const amenityRegex = config.amenities.join("|");
      queryParts.push(`node["amenity"~"^(${amenityRegex})$"](around:${radiusMeters},${parsedLat},${parsedLon});`);
      queryParts.push(`way["amenity"~"^(${amenityRegex})$"](around:${radiusMeters},${parsedLat},${parsedLon});`);
    }

    if (config.shops && config.shops.length > 0) {
      const shopRegex = config.shops.join("|");
      queryParts.push(`node["shop"~"^(${shopRegex})$"](around:${radiusMeters},${parsedLat},${parsedLon});`);
      queryParts.push(`way["shop"~"^(${shopRegex})$"](around:${radiusMeters},${parsedLat},${parsedLon});`);
    }

    // Build Overpass QL query
    const query = `
      [out:json][timeout:15];
      (
        ${queryParts.join("\n        ")}
      );
      out center body ${limit * 2};
    `.trim();

    // Use Overpass API (try multiple mirrors for reliability)
    const overpassMirrors = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const overpassUrl of overpassMirrors) {
      try {
        console.log(`[OSM] Trying Overpass mirror: ${overpassUrl}`);
        response = await fetch(overpassUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CommunityPulse/1.0",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          console.log(`[OSM] Success with mirror: ${overpassUrl}`);
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[OSM] Mirror ${overpassUrl} failed:`, lastError.message);
        response = null;
      }
    }

    if (!response) {
      throw lastError || new Error("All Overpass mirrors failed");
    }

    if (!response.ok) {
      console.error("[OSM] Overpass API error:", response.status);
      return NextResponse.json(
        { error: "OpenStreetMap service unavailable", places: [], source: "openstreetmap" },
        { status: 200 }
      );
    }

    interface OSMElement {
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: {
        name?: string;
        brand?: string;
        operator?: string;
        amenity?: string;
        shop?: string;
        "addr:housenumber"?: string;
        "addr:street"?: string;
        "addr:city"?: string;
        phone?: string;
        "contact:phone"?: string;
        website?: string;
        "contact:website"?: string;
        opening_hours?: string;
      };
    }

    const data = (await response.json()) as { elements?: OSMElement[] };
    const elements = data.elements || [];

    // Transform OSM elements to our format
    const places: OSMPlace[] = elements
      .filter((el) => el.tags?.name) // Must have a name
      .map((el) => {
        // For ways, use the center coordinates
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;

        if (!elLat || !elLon) return null;

        const tags = el.tags || {};
        const amenity = tags.amenity || tags.shop || "place";

        // Build address from available tags
        const addressParts: string[] = [];
        if (tags["addr:housenumber"] && tags["addr:street"]) {
          addressParts.push(`${tags["addr:housenumber"]} ${tags["addr:street"]}`);
        } else if (tags["addr:street"]) {
          addressParts.push(tags["addr:street"]);
        }
        if (tags["addr:city"]) {
          addressParts.push(tags["addr:city"]);
        }

        return {
          id: `osm-${el.id}`,
          name: tags.name || tags.brand || tags.operator || "Place",
          category: TAG_LABELS[amenity] || amenity,
          address: addressParts.length > 0 ? addressParts.join(", ") : null,
          distance: haversineDistance(parsedLat, parsedLon, elLat, elLon),
          lat: elLat,
          lon: elLon,
          phone: tags.phone || tags["contact:phone"],
          website: tags.website || tags["contact:website"],
          openingHours: tags.opening_hours,
        } as OSMPlace;
      })
      .filter((s): s is OSMPlace => s !== null)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      // Limit results
      .slice(0, limit);

    const responseData: OSMPlacesResponse = {
      places,
      total: places.length,
      source: "openstreetmap",
    };

    // Store in server-side cache
    placesCache.set(cacheKey, { data: responseData, ts: Date.now() });
    // Evict old entries if cache gets large
    if (placesCache.size > 200) {
      const oldest = [...placesCache.entries()]
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(0, 50);
      oldest.forEach(([k]) => placesCache.delete(k));
    }

    return NextResponse.json(responseData, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("[OSM] Request timeout");
      return NextResponse.json(
        { error: "Request timed out", places: [], source: "openstreetmap" },
        { status: 200 }
      );
    }

    console.error("[OSM] Error:", error);
    return NextResponse.json(
      { error: "Unable to fetch places", places: [], source: "openstreetmap" },
      { status: 200 }
    );
  }
}
