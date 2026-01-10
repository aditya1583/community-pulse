import { NextRequest, NextResponse } from "next/server";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

/**
 * Farmers Markets API Route
 *
 * Primary: USDA Local Food Directories API (free, no key)
 * Fallback: Foursquare Places API (if USDA returns empty)
 *
 * This dual approach ensures we always have data to show
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
  source: "usda" | "foursquare" | "osm";
};

export type FarmersMarketsResponse = {
  markets: FarmersMarketData[];
  total: number;
  region: string;
  source?: string;
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

function parseProducts(productsString: string): string[] {
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

// Fallback: Fetch from OpenStreetMap Overpass API (FREE, no API key!)
async function fetchFromOSM(
  lat: number,
  lon: number,
  city: string
): Promise<FarmersMarketData[]> {
  console.log(`[FarmersMarkets] OSM fallback: Searching near ${lat},${lon}`);

  try {
    // Query for marketplaces, farm shops, and places with "market" in name
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
      console.log("[FarmersMarkets] OSM fallback failed");
      return [];
    }

    const data = await response.json();
    const elements = data.elements || [];

    console.log(`[FarmersMarkets] OSM found ${elements.length} results`);

    // Calculate distance using haversine
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c * 0.621371; // Convert to miles
    };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    return elements
      .filter((el: any) => el.tags?.name)
      .map((el: any) => {
        /* eslint-enable @typescript-eslint/no-explicit-any */
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
        const isOpen = openingHours !== "Schedule varies" && checkIfOpenToday(openingHours);

        // Determine products based on tags
        const products: string[] = ["Fresh Produce"];
        if (tags.organic === "yes") products.push("Organic");
        if (tags.cuisine) products.push("Prepared Foods");

        return {
          id: `osm-${el.type}-${el.id}`,
          name: tags.name,
          address: addressParts.join(", ") || city,
          schedule: openingHours,
          products,
          isOpenToday: isOpen,
          distance: Math.round(haversineDistance(lat, lon, elLat, elLon) * 10) / 10,
          website: tags.website || tags["contact:website"] || null,
          facebook: tags["contact:facebook"] || null,
          source: "osm" as const,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[FarmersMarkets] OSM fallback error:", error);
    return [];
  }
}

// Fallback: Fetch from Foursquare Places API
async function fetchFromFoursquare(
  lat: number,
  lon: number,
  city: string
): Promise<FarmersMarketData[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;

  if (!apiKey) {
    console.log("Foursquare fallback: No API key configured");
    return [];
  }

  console.log(`Foursquare fallback: Searching near ${lat},${lon} for ${city}`);

  try {
    // Foursquare category ID for Farmers Markets: 17069
    // Also include: 17070 (Flea Markets), 17068 (Food & Drink Markets)
    const params = new URLSearchParams({
      ll: `${lat},${lon}`,
      radius: String(RADIUS_CONFIG.PRIMARY_RADIUS_METERS),
      categories: "17069,17070,17068", // Farmers Markets, Flea Markets, Food Markets
      limit: "15",
      fields: "fsq_id,name,location,distance,hours,website,tel",
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params.toString()}`,
      {
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Foursquare fallback error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    const results = data.results || [];

    console.log(`Foursquare fallback: Found ${results.length} results`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((place: any) => {
      const location = place.location || {};
      const hours = place.hours;

      // Build address
      const addressParts = [
        location.address,
        location.locality,
        location.region,
      ].filter(Boolean);

      // Determine if open today from Foursquare hours
      let isOpen = false;
      let scheduleStr = "Schedule varies";

      if (hours?.display) {
        scheduleStr = hours.display;
        isOpen = hours.open_now ?? false;
      }

      return {
        id: `fsq-${place.fsq_id}`,
        name: place.name,
        address: addressParts.join(", ") || city,
        schedule: scheduleStr,
        products: ["Fresh Produce", "Local Goods"],
        isOpenToday: isOpen,
        distance: place.distance ? Math.round(place.distance / 1609.34 * 10) / 10 : null, // meters to miles
        website: place.website || null,
        facebook: null,
        source: "foursquare" as const,
      };
    });
  } catch (error) {
    console.error("Foursquare fallback error:", error);
    return [];
  }
}

// City coordinates fallback
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "austin": { lat: 30.2672, lon: -97.7431 },
  "houston": { lat: 29.7604, lon: -95.3698 },
  "dallas": { lat: 32.7767, lon: -96.7970 },
  "san antonio": { lat: 29.4241, lon: -98.4936 },
  "leander": { lat: 30.5788, lon: -97.8531 },
  "cedar park": { lat: 30.5052, lon: -97.8203 },
  "round rock": { lat: 30.5083, lon: -97.6789 },
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

    // Try USDA API first
    let markets: FarmersMarketData[] = [];
    let source = "usda";

    if (coords) {
      const apiUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=${coords.lat}&lng=${coords.lon}`;

      try {
        const response = await fetch(apiUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = await response.json();
          const marketsRaw = data.results || [];

          for (const market of marketsRaw.slice(0, 10)) {
            if (market.id) {
              try {
                const detailsUrl = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${market.id}`;
                const detailsResponse = await fetch(detailsUrl, {
                  signal: AbortSignal.timeout(5000),
                });
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
                  source: "usda",
                });
              } catch {
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
                  source: "usda",
                });
              }
            }
          }
        }
      } catch (usdaError) {
        console.error("USDA API error:", usdaError);
      }
    }

    // If USDA returned no results, try Foursquare
    if (markets.length === 0 && coords) {
      console.log("USDA returned no results, trying Foursquare fallback...");
      markets = await fetchFromFoursquare(coords.lat, coords.lon, city);
      if (markets.length > 0) {
        source = "foursquare";
      }
    }

    // If Foursquare also failed, try OpenStreetMap (FREE!)
    if (markets.length === 0 && coords) {
      console.log("Foursquare returned no results, trying OSM fallback...");
      markets = await fetchFromOSM(coords.lat, coords.lon, city);
      if (markets.length > 0) {
        source = "osm";
      }
    }

    // If still no results, return with search URL
    if (markets.length === 0) {
      return NextResponse.json({
        markets: [],
        total: 0,
        region: city || "your area",
        error: "No farmers markets found in this area.",
        searchUrl: `https://www.google.com/maps/search/farmers+markets+near+${encodeURIComponent(city || "me")}`,
      });
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
      source,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200"
      }
    });

  } catch (error) {
    console.error("Error fetching farmers markets:", error);

    return NextResponse.json({
      markets: [],
      total: 0,
      region: city || "your area",
      error: "Unable to fetch farmers market data.",
      searchUrl: `https://www.google.com/maps/search/farmers+markets+near+${encodeURIComponent(city || "me")}`,
    });
  }
}
