import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export interface AQIResult {
  aqi: number | null;
  category: string;
  color: string;
  pollutant: string;
  timestamp: string;
  error?: string;
}

interface AirNowObservation {
  AQI?: number;
  Category?: { Name?: string };
  ParameterName?: string;
  DateObserved?: string;
  HourObserved?: number;
}

function getAQICategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: "Good", color: "green" };
  if (aqi <= 100) return { category: "Moderate", color: "yellow" };
  if (aqi <= 150) return { category: "Unhealthy for Sensitive Groups", color: "orange" };
  if (aqi <= 200) return { category: "Unhealthy", color: "red" };
  if (aqi <= 300) return { category: "Very Unhealthy", color: "purple" };
  return { category: "Hazardous", color: "maroon" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const apiKey = process.env.AIRNOW_API_KEY;

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
  };

  if (!apiKey) {
    const result: AQIResult = {
      aqi: null,
      category: "",
      color: "",
      pollutant: "",
      timestamp: new Date().toISOString(),
      error: "AQI unavailable",
    };
    return NextResponse.json(result, { headers: cacheHeaders });
  }

  if (!lat || !lon) {
    const result: AQIResult = {
      aqi: null,
      category: "",
      color: "",
      pollutant: "",
      timestamp: new Date().toISOString(),
      error: "AQI unavailable",
    };
    return NextResponse.json(result, { headers: cacheHeaders });
  }

  try {
    const url = new URL("https://www.airnowapi.org/aq/observation/latLong/current/");
    url.searchParams.set("format", "application/json");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("distance", "50");
    url.searchParams.set("API_KEY", apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const result: AQIResult = {
        aqi: null,
        category: "",
        color: "",
        pollutant: "",
        timestamp: new Date().toISOString(),
        error: "AQI unavailable",
      };
      return NextResponse.json(result, { headers: cacheHeaders });
    }

    const observations: AirNowObservation[] = await res.json();

    if (!Array.isArray(observations) || observations.length === 0) {
      const result: AQIResult = {
        aqi: null,
        category: "No data",
        color: "gray",
        pollutant: "",
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(result, { headers: cacheHeaders });
    }

    // Pick the observation with the highest AQI (worst air quality)
    const worst = observations.reduce<AirNowObservation>((prev, curr) => {
      return (curr.AQI ?? 0) > (prev.AQI ?? 0) ? curr : prev;
    }, observations[0]);

    const aqiVal = worst.AQI ?? 0;
    const { category, color } = getAQICategory(aqiVal);

    // Build timestamp from observation date
    const dateStr = worst.DateObserved?.trim() ?? "";
    const hour = worst.HourObserved ?? 0;
    const timestamp = dateStr
      ? new Date(`${dateStr} ${String(hour).padStart(2, "0")}:00`).toISOString()
      : new Date().toISOString();

    const result: AQIResult = {
      aqi: aqiVal,
      category,
      color,
      pollutant: worst.ParameterName ?? "PM2.5",
      timestamp,
    };

    return NextResponse.json(result, { headers: cacheHeaders });
  } catch {
    const result: AQIResult = {
      aqi: null,
      category: "",
      color: "",
      pollutant: "",
      timestamp: new Date().toISOString(),
      error: "AQI unavailable",
    };
    return NextResponse.json(result, { headers: cacheHeaders });
  }
}
