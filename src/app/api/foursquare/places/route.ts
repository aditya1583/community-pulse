import { NextRequest, NextResponse } from "next/server";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

export const dynamic = "force-dynamic";

/**
 * Foursquare Places API Route
 *
 * Uses Foursquare Places API v3 for local business discovery
 * - $200 FREE credits/month for developer accounts
 * - 100M+ POIs worldwide
 * - Categories: restaurants, cafes, farmers markets, etc.
 *
 * @see https://docs.foursquare.com/developer/reference/place-search
 */

export type FoursquarePlace = {
  id: string;
  name: string;
  category: string;
  categoryIcon?: string;
  address: string;
  distance: number | null;
  rating?: number;
  price?: number; // 1-4 scale
  hours?: {
    isOpen: boolean;
    openNow: string;
  };
  photos?: string[];
  url?: string;
  phone?: string;
  lat: number;
  lon: number;
};

export type FoursquarePlacesResponse = {
  places: FoursquarePlace[];
  total: number;
  query: string;
};

// Category mappings for common searches
const CATEGORY_IDS: Record<string, string> = {
  // Food & Drink
  restaurants: "13065", // Restaurants
  cafes: "13032", // Coffee Shops
  bars: "13003", // Bars

  // Shopping & Markets
  "farmers-markets": "17069", // Farmers Markets
  groceries: "17110", // Grocery Stores

  // Services
  "gas-stations": "19007", // Gas Stations (backup)

  // Entertainment
  entertainment: "10000", // Arts & Entertainment
};

export async function GET(req: NextRequest) {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Foursquare API not configured. Add FOURSQUARE_API_KEY to environment.",
        places: [],
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const query = searchParams.get("query") || "";
  const category = searchParams.get("category") || "";
  const radius = searchParams.get("radius") || String(RADIUS_CONFIG.PRIMARY_RADIUS_METERS);
  const limit = searchParams.get("limit") || "15";

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat/lon coordinates", places: [] },
      { status: 400 }
    );
  }

  try {
    // Build Foursquare API URL
    const baseUrl = "https://api.foursquare.com/v3/places/search";
    const params = new URLSearchParams({
      ll: `${lat},${lon}`,
      radius: String(Math.min(parseInt(radius), 50000)), // Max 50km
      limit: String(Math.min(parseInt(limit), 50)), // Max 50
      sort: "DISTANCE",
    });

    // Add query or category filter
    if (query) {
      params.set("query", query);
    }

    if (category && CATEGORY_IDS[category]) {
      params.set("categories", CATEGORY_IDS[category]);
    }

    // Request fields we need
    params.set("fields", "fsq_id,name,categories,location,distance,rating,price,hours,photos,tel,website");

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      console.error("Foursquare API key invalid");
      return NextResponse.json(
        { error: "API configuration error", places: [] },
        { status: 200 }
      );
    }

    if (response.status === 429) {
      console.error("Foursquare rate limited");
      return NextResponse.json(
        { error: "Service busy, try again later", places: [], rateLimited: true },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Foursquare API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Unable to fetch places", places: [] },
        { status: 200 }
      );
    }

    const data = await response.json();
    const results = data.results || [];

    // Transform to our format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places: FoursquarePlace[] = results.map((place: any) => {
      const primaryCategory = place.categories?.[0];
      const location = place.location || {};

      // Get best photo if available
      const photo = place.photos?.[0];
      const photoUrl = photo
        ? `${photo.prefix}300x300${photo.suffix}`
        : undefined;

      return {
        id: place.fsq_id,
        name: place.name,
        category: primaryCategory?.name || "Business",
        categoryIcon: primaryCategory?.icon
          ? `${primaryCategory.icon.prefix}32${primaryCategory.icon.suffix}`
          : undefined,
        address: [
          location.address,
          location.locality,
          location.region,
        ].filter(Boolean).join(", "),
        distance: place.distance || null,
        rating: place.rating ? place.rating / 2 : undefined, // Foursquare uses 0-10, convert to 0-5
        price: place.price,
        hours: place.hours ? {
          isOpen: place.hours.open_now ?? false,
          openNow: place.hours.display || "",
        } : undefined,
        photos: photoUrl ? [photoUrl] : undefined,
        url: place.website,
        phone: place.tel,
        lat: location.latitude,
        lon: location.longitude,
      };
    });

    return NextResponse.json({
      places,
      total: places.length,
      query: query || category || "nearby",
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900", // 30 min cache
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out", places: [] },
        { status: 200 }
      );
    }

    console.error("Foursquare API error:", error);
    return NextResponse.json(
      { error: "Unable to fetch places", places: [] },
      { status: 200 }
    );
  }
}
