import { NextRequest, NextResponse } from "next/server";

/**
 * Gas Stations API Route
 *
 * Uses OpenStreetMap Overpass API (100% FREE) to find nearby gas stations
 * Combined with EIA regional prices for a complete picture
 *
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export type GasStation = {
  id: string;
  name: string;
  brand: string | null;
  address: string | null;
  distance: number; // meters
  lat: number;
  lon: number;
  amenities: string[];
  openingHours: string | null;
};

export type GasStationsResponse = {
  stations: GasStation[];
  total: number;
  radius: number;
};

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Convert meters to miles
function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.34) * 10) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") || "10000"; // meters, default 10km (~6.2 miles)
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat/lon coordinates", stations: [] },
      { status: 400 }
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  const searchRadius = Math.min(parseInt(radius), 25000); // Max 25km

  try {
    // Overpass API query for fuel stations
    // Uses 'nwr' (node, way, relation) for a more comprehensive search
    // We also explicitly search for H-E-B to ensure our primary local anchor isn't missed
    const overpassQuery = `
      [out:json][timeout:15];
      (
        nwr["amenity"="fuel"](around:${searchRadius},${latitude},${longitude});
        nwr["brand"~"H-E-B",i](around:${searchRadius},${latitude},${longitude});
        nwr["name"~"H-E-B",i](around:${searchRadius},${latitude},${longitude});
        nwr["brand"~"HEB",i](around:${searchRadius},${latitude},${longitude});
        nwr["name"~"HEB",i](around:${searchRadius},${latitude},${longitude});
      );
      out center body;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "CommunityPulse/1.0 (https://communitypulse.app)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("Overpass API error:", response.status);
      return NextResponse.json(
        { error: "Unable to fetch gas stations", stations: [] },
        { status: 200 }
      );
    }

    const data = await response.json();
    const elements = data.elements || [];

    // Transform OSM elements to our format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stations: GasStation[] = elements
      .map((element: any) => {
        const tags = element.tags || {};

        // Get coordinates (for ways, use center point)
        const stationLat = element.lat || element.center?.lat;
        const stationLon = element.lon || element.center?.lon;

        if (!stationLat || !stationLon) return null;

        // Build address from available tags
        const addressParts = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"],
          tags["addr:state"],
        ].filter(Boolean);

        // Collect amenities
        const amenities: string[] = [];
        if (tags.shop === "convenience" || tags.convenience === "yes") {
          amenities.push("Convenience Store");
        }
        if (tags.car_wash === "yes") {
          amenities.push("Car Wash");
        }
        if (tags.compressed_air === "yes") {
          amenities.push("Air Pump");
        }
        if (tags.atm === "yes") {
          amenities.push("ATM");
        }

        return {
          id: `osm-${element.id}`,
          name: tags.name || tags.brand || tags.operator || "Gas Station",
          brand: tags.brand || tags.operator || null,
          address: addressParts.length > 0 ? addressParts.join(" ") : null,
          distance: calculateDistance(latitude, longitude, stationLat, stationLon),
          lat: stationLat,
          lon: stationLon,
          amenities,
          openingHours: tags.opening_hours || null,
        };
      })
      .filter(Boolean)
      .sort((a: GasStation, b: GasStation) => a.distance - b.distance)
      .slice(0, limit);

    // Add miles conversion to response
    const stationsWithMiles = stations.map(s => ({
      ...s,
      distanceMiles: metersToMiles(s.distance),
    }));

    return NextResponse.json({
      stations: stationsWithMiles,
      total: stationsWithMiles.length,
      radius: searchRadius,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800", // 1 hour cache
      },
    });

  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out", stations: [] },
        { status: 200 }
      );
    }

    console.error("Gas stations API error:", error);
    return NextResponse.json(
      { error: "Unable to fetch gas stations", stations: [] },
      { status: 200 }
    );
  }
}
