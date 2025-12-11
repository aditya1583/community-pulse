import { NextRequest, NextResponse } from "next/server";
import { GeocodedCity, mapOpenWeatherResult } from "@/lib/geocoding";

const GEOCODING_API_KEY =
  process.env.NEXT_PUBLIC_GEOCODING_API_KEY ||
  process.env.OPENWEATHER_API_KEY ||
  process.env.WEATHER_API_KEY;

type OpenWeatherGeoResultPartial = {
  name?: string;
  lat?: number;
  lon?: number;
  country?: string;
  state?: string;
};

type OpenWeatherGeoResultValid = {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
};

function isValidGeoResult(entry: OpenWeatherGeoResultPartial): entry is OpenWeatherGeoResultValid {
  return (
    typeof entry.name === "string" &&
    typeof entry.lat === "number" &&
    typeof entry.lon === "number"
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const limitParam = Number(searchParams.get("limit") || "7");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 10))
    : 7;

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!GEOCODING_API_KEY) {
    return NextResponse.json(
      { results: [], error: "Geocoding API key not configured" },
      { status: 500 }
    );
  }

  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
    query
  )}&limit=${limit}&appid=${GEOCODING_API_KEY}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = (await res.json()) as unknown;

    if (!res.ok || !Array.isArray(data)) {
      return NextResponse.json(
        { results: [], error: "Geocoding lookup failed" },
        { status: 500 }
      );
    }

    const seen = new Set<string>();
    const results: GeocodedCity[] = [];

    for (const entry of data) {
      const partialEntry = entry as OpenWeatherGeoResultPartial;
      if (!isValidGeoResult(partialEntry)) continue;
      const mapped = mapOpenWeatherResult(partialEntry);
      if (seen.has(mapped.displayName)) continue;
      seen.add(mapped.displayName);
      results.push(mapped);
      if (results.length >= limit) break;
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error fetching geocoding results:", error);
    return NextResponse.json(
      { results: [], error: "Unable to fetch city suggestions right now." },
      { status: 500 }
    );
  }
}
