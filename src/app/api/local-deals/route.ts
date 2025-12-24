import { NextRequest, NextResponse } from "next/server";

/**
 * Yelp Local Deals API Route
 *
 * Fetches local businesses from Yelp Fusion API
 * Supports category filtering and sorting by rating
 */

export type LocalDealBusiness = {
  id: string;
  name: string;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  priceLevel: string | null;
  categories: string[];
  address: string;
  distance: number | null;
  isOpen: boolean;
  transactions: string[];
  url: string;
  phone: string | null;
};

export type LocalDealsResponse = {
  businesses: LocalDealBusiness[];
  total: number;
  region: string;
};

// Yelp category mappings
const CATEGORY_MAP: Record<string, string> = {
  restaurants: "restaurants",
  bars: "bars,pubs,cocktailbars",
  coffee: "coffee,coffeeshops",
  shopping: "shopping",
  beauty: "beautysvc,hairsalons,spas",
  fitness: "fitness,gyms",
  all: "restaurants,bars,coffee,shopping",
};

// City coordinates fallback
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "austin": { lat: 30.2672, lon: -97.7431 },
  "houston": { lat: 29.7604, lon: -95.3698 },
  "dallas": { lat: 32.7767, lon: -96.7970 },
  "san antonio": { lat: 29.4241, lon: -98.4936 },
  "new york": { lat: 40.7128, lon: -74.0060 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  "chicago": { lat: 41.8781, lon: -87.6298 },
  "phoenix": { lat: 33.4484, lon: -112.0740 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  "seattle": { lat: 47.6062, lon: -122.3321 },
  "denver": { lat: 39.7392, lon: -104.9903 },
  "boston": { lat: 42.3601, lon: -71.0589 },
  "atlanta": { lat: 33.7490, lon: -84.3880 },
  "miami": { lat: 25.7617, lon: -80.1918 },
};

function getCoordinatesForCity(cityName: string): { lat: number; lon: number } | null {
  const normalizedCity = cityName.split(",")[0].toLowerCase().trim();
  return CITY_COORDINATES[normalizedCity] || null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "";
  const category = searchParams.get("category") || "all";
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const sortBy = searchParams.get("sort") || "rating";

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Yelp API key not configured", businesses: [], total: 0 },
      { status: 200 }
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

    // Build Yelp API URL
    const yelpUrl = new URL("https://api.yelp.com/v3/businesses/search");

    if (coords) {
      yelpUrl.searchParams.set("latitude", coords.lat.toString());
      yelpUrl.searchParams.set("longitude", coords.lon.toString());
    } else if (city) {
      yelpUrl.searchParams.set("location", city);
    } else {
      return NextResponse.json(
        { error: "City or coordinates required", businesses: [], total: 0 },
        { status: 400 }
      );
    }

    // Set category
    const yelpCategory = CATEGORY_MAP[category] || CATEGORY_MAP.all;
    yelpUrl.searchParams.set("categories", yelpCategory);
    yelpUrl.searchParams.set("limit", Math.min(limit, 50).toString());
    yelpUrl.searchParams.set("sort_by", sortBy === "rating" ? "rating" : "distance");

    const response = await fetch(yelpUrl.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Yelp API error:", response.status, errorData);

      // Return graceful fallback
      return NextResponse.json({
        businesses: [],
        total: 0,
        region: city,
        error: "Unable to fetch local deals at this time",
      });
    }

    const data = await response.json();

    // Transform Yelp response to our format
    const businesses: LocalDealBusiness[] = (data.businesses || []).map((biz: Record<string, unknown>) => {
      const location = biz.location as Record<string, unknown> || {};
      const addressParts = [
        location.address1,
        location.city,
        location.state,
      ].filter(Boolean);

      return {
        id: biz.id as string,
        name: biz.name as string,
        imageUrl: biz.image_url as string || null,
        rating: biz.rating as number || 0,
        reviewCount: biz.review_count as number || 0,
        priceLevel: biz.price as string || null,
        categories: ((biz.categories as Array<{ title: string }>) || []).map((c) => c.title),
        address: addressParts.join(", "),
        distance: biz.distance ? Math.round((biz.distance as number) * 0.000621371 * 10) / 10 : null, // Convert meters to miles
        isOpen: !(biz.is_closed as boolean),
        transactions: (biz.transactions as string[]) || [],
        url: biz.url as string,
        phone: biz.display_phone as string || null,
      };
    });

    const result: LocalDealsResponse = {
      businesses,
      total: data.total || businesses.length,
      region: city || "your area",
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error("Error fetching Yelp data:", error);
    return NextResponse.json({
      businesses: [],
      total: 0,
      region: city,
      error: "Failed to fetch local deals",
    });
  }
}
