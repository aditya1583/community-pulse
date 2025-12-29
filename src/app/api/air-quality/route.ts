import { NextRequest, NextResponse } from "next/server";

/**
 * Air Quality Index API Route
 *
 * Fetches AQI data from OpenWeather Air Pollution API
 * Returns AQI level (1-5), label, color coding, components, and health advice
 */

export type AirQualityResponse = {
  aqi: 1 | 2 | 3 | 4 | 5;
  label: "Good" | "Fair" | "Moderate" | "Poor" | "Very Poor";
  color: string;
  components: {
    pm2_5: number;
    pm10: number;
    o3: number;
    no2: number;
    co: number;
  };
  healthAdvice?: string;
};

const AQI_CONFIG: Record<1 | 2 | 3 | 4 | 5, { label: AirQualityResponse["label"]; color: string; healthAdvice?: string }> = {
  1: { label: "Good", color: "emerald" },
  2: { label: "Fair", color: "lime" },
  3: { label: "Moderate", color: "amber", healthAdvice: "Sensitive groups should limit prolonged outdoor exertion" },
  4: { label: "Poor", color: "orange", healthAdvice: "Everyone may begin to experience health effects. Limit outdoor activity" },
  5: { label: "Very Poor", color: "red", healthAdvice: "Health alert! Everyone may experience serious health effects. Avoid outdoor activity" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat/lon coordinates" },
      { status: 400 }
    );
  }

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Weather API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("OpenWeather AQI error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to fetch air quality data" },
        { status: 500 }
      );
    }

    // OpenWeather returns list with current pollution data
    const pollution = data.list?.[0];
    if (!pollution) {
      return NextResponse.json(
        { error: "No air quality data available" },
        { status: 404 }
      );
    }

    const aqi = pollution.main?.aqi as 1 | 2 | 3 | 4 | 5;
    const components = pollution.components || {};
    const config = AQI_CONFIG[aqi] || AQI_CONFIG[3];

    const result: AirQualityResponse = {
      aqi,
      label: config.label,
      color: config.color,
      components: {
        pm2_5: Math.round((components.pm2_5 || 0) * 10) / 10,
        pm10: Math.round((components.pm10 || 0) * 10) / 10,
        o3: Math.round((components.o3 || 0) * 10) / 10,
        no2: Math.round((components.no2 || 0) * 10) / 10,
        co: Math.round((components.co || 0) * 10) / 10,
      },
      healthAdvice: config.healthAdvice,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" // Cache for 30 minutes
      }
    });

  } catch (error) {
    console.error("Error fetching air quality data:", error);
    return NextResponse.json(
      { error: "Failed to fetch air quality data" },
      { status: 500 }
    );
  }
}
