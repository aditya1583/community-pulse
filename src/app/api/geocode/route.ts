import { NextRequest, NextResponse } from "next/server";
import { GeocodedCity, mapOpenWeatherResult } from "@/lib/geocoding";

// US state abbreviation to full name mapping
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

/**
 * Expand US state abbreviations in city queries
 * "Leander, TX" -> "Leander, Texas"
 * "Austin, tx" -> "Austin, Texas"
 */
function expandStateAbbreviation(query: string): string {
  // Match pattern: "City, XX" where XX is 2 letters
  const match = query.match(/^(.+),\s*([A-Za-z]{2})$/);
  if (!match) return query;

  const [, city, stateAbbr] = match;
  const fullState = US_STATE_ABBREVIATIONS[stateAbbr.toUpperCase()];

  if (fullState) {
    return `${city}, ${fullState}`;
  }

  return query;
}

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
  const rawQuery = searchParams.get("query")?.trim();
  const limitParam = Number(searchParams.get("limit") || "7");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 10))
    : 7;

  if (!rawQuery || rawQuery.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!GEOCODING_API_KEY) {
    return NextResponse.json(
      { results: [], error: "Geocoding API key not configured" },
      { status: 500 }
    );
  }

  // Expand US state abbreviations: "Leander, TX" -> "Leander, Texas"
  const query = expandStateAbbreviation(rawQuery);

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
