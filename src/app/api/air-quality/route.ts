import { NextRequest, NextResponse } from "next/server";

/**
 * Air Quality Index API Route
 *
 * Using Open-Meteo Air Quality API (100% free, no API key required)
 * https://open-meteo.com/en/docs/air-quality-api
 *
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

// Convert European AQI (0-100+) to 1-5 scale
function convertEuropeanAQI(eaqi: number): 1 | 2 | 3 | 4 | 5 {
  if (eaqi <= 20) return 1;      // Good
  if (eaqi <= 40) return 2;      // Fair
  if (eaqi <= 60) return 3;      // Moderate
  if (eaqi <= 80) return 4;      // Poor
  return 5;                       // Very Poor
}

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

  try {
    // Open-Meteo Air Quality API - completely free, no API key needed
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.current) {
      console.error("Open-Meteo AQI error:", data);
      return NextResponse.json(
        { error: "Failed to fetch air quality data" },
        { status: 500 }
      );
    }

    const current = data.current;
    const aqi = convertEuropeanAQI(current.european_aqi || 0);
    const config = AQI_CONFIG[aqi];

    const result: AirQualityResponse = {
      aqi,
      label: config.label,
      color: config.color,
      components: {
        pm2_5: Math.round((current.pm2_5 || 0) * 10) / 10,
        pm10: Math.round((current.pm10 || 0) * 10) / 10,
        o3: Math.round((current.ozone || 0) * 10) / 10,
        no2: Math.round((current.nitrogen_dioxide || 0) * 10) / 10,
        co: Math.round((current.carbon_monoxide || 0) * 10) / 10,
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
