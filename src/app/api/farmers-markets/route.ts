import { NextRequest, NextResponse } from "next/server";

/**
 * Farmers Markets API Route
 *
 * Fetches farmers market data from USDA Local Food Directories API
 * No API key required
 */

export type FarmersMarketData = {
  id: string;
  name: string;
  address: string;
  schedule: string;
  products: string[];
  isOpenToday: boolean;
  distance: number | null;
  website: string | null;
  facebook: string | null;
};

export type FarmersMarketsResponse = {
  markets: FarmersMarketData[];
  total: number;
  region: string;
};

// Day name mapping for schedule parsing
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTodayDayName(): string {
  return DAY_NAMES[new Date().getDay()];
}

function checkIfOpenToday(schedule: string): boolean {
  const today = getTodayDayName().toLowerCase();
  const todayAbbrev = DAY_ABBREVS[new Date().getDay()].toLowerCase();
  const scheduleLower = schedule.toLowerCase();

  // Check for common patterns
  if (scheduleLower.includes(today) || scheduleLower.includes(todayAbbrev)) {
    return true;
  }

  // Check for patterns like "Saturday" or "Sat"
  if (scheduleLower.includes("daily") || scheduleLower.includes("every day")) {
    return true;
  }

  // Check for weekend patterns
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  if (isWeekend && scheduleLower.includes("weekend")) {
    return true;
  }

  return false;
}

function parseProducts(productsString: string): string[] {
  if (!productsString) return [];

  // Common product categories from USDA data
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
  const state = searchParams.get("state") || "";
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") || "20"; // miles

  try {
    // Determine coordinates
    let coords: { lat: number; lon: number } | null = null;

    if (lat && lon) {
      coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
    } else if (city) {
      coords = getCoordinatesForCity(city);
    }

    if (!coords && !city) {
      return NextResponse.json({
        markets: [],
        total: 0,
        region: city || "Unknown",
        error: "City or coordinates required",
      });
    }

    // USDA API endpoint - using zip code or location search
    // Note: USDA API can be unreliable, so we'll use a fallback approach
    let apiUrl: string;

    if (coords) {
      apiUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=${coords.lat}&lng=${coords.lon}`;
    } else {
      // Use city/state search
      const searchTerm = state ? `${city}, ${state}` : city;
      apiUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=${encodeURIComponent(searchTerm)}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("USDA API error:", response.status);

      // Return mock data for graceful degradation
      return NextResponse.json({
        markets: generateMockMarkets(city),
        total: 5,
        region: city || "your area",
        note: "Showing sample markets - USDA service temporarily unavailable",
      });
    }

    const data = await response.json();

    // Parse USDA response format
    const marketsRaw = data.results || [];
    const markets: FarmersMarketData[] = [];

    for (const market of marketsRaw.slice(0, 15)) {
      // Fetch market details if we have an ID
      if (market.id) {
        try {
          const detailsUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${market.id}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          const details = detailsData.marketdetails || {};

          const schedule = details.Schedule || market.schedule || "Schedule varies";
          const address = details.Address || market.Address || "";
          const products = details.Products || "";

          markets.push({
            id: market.id.toString(),
            name: market.marketname || "Farmers Market",
            address: address,
            schedule: schedule,
            products: parseProducts(products),
            isOpenToday: checkIfOpenToday(schedule),
            distance: market.distance ? parseFloat(market.distance) : null,
            website: details.Website || null,
            facebook: details.Facebook || null,
          });
        } catch (detailError) {
          // If details fetch fails, use basic info
          markets.push({
            id: market.id.toString(),
            name: market.marketname || "Farmers Market",
            address: market.Address || "",
            schedule: market.schedule || "Schedule varies",
            products: ["Fresh Produce"],
            isOpenToday: false,
            distance: market.distance ? parseFloat(market.distance) : null,
            website: null,
            facebook: null,
          });
        }
      }
    }

    // Sort: open today first, then by distance
    markets.sort((a, b) => {
      if (a.isOpenToday && !b.isOpenToday) return -1;
      if (!a.isOpenToday && b.isOpenToday) return 1;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    const result: FarmersMarketsResponse = {
      markets,
      total: markets.length,
      region: city || "your area",
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200" // Cache for 24 hours
      }
    });

  } catch (error) {
    console.error("Error fetching farmers markets:", error);

    // Return mock data for graceful degradation
    return NextResponse.json({
      markets: generateMockMarkets(city),
      total: 5,
      region: city || "your area",
      error: "Unable to fetch markets - showing sample data",
    });
  }
}

// Generate mock markets for graceful degradation
function generateMockMarkets(city: string): FarmersMarketData[] {
  const today = getTodayDayName();

  return [
    {
      id: "mock-1",
      name: `${city} Downtown Farmers Market`,
      address: `Main Street, ${city}`,
      schedule: `${today}s 8am - 1pm`,
      products: ["Vegetables", "Fruits", "Organic", "Baked Goods"],
      isOpenToday: true,
      distance: 1.2,
      website: null,
      facebook: null,
    },
    {
      id: "mock-2",
      name: `${city} Community Market`,
      address: `Oak Plaza, ${city}`,
      schedule: "Saturdays 9am - 2pm",
      products: ["Fresh Produce", "Honey", "Eggs"],
      isOpenToday: new Date().getDay() === 6,
      distance: 2.5,
      website: null,
      facebook: null,
    },
    {
      id: "mock-3",
      name: `${city} Organic Farmers Collective`,
      address: `Green Street, ${city}`,
      schedule: "Sundays 10am - 3pm",
      products: ["Organic", "Vegetables", "Dairy"],
      isOpenToday: new Date().getDay() === 0,
      distance: 3.8,
      website: null,
      facebook: null,
    },
  ];
}
