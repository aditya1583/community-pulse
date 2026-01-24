import { NextRequest, NextResponse } from "next/server";
import { mapOpenWeatherResult } from "@/lib/geocoding";

const GEOCODING_API_KEY =
    process.env.NEXT_PUBLIC_GEOCODING_API_KEY ||
    process.env.OPENWEATHER_API_KEY ||
    process.env.WEATHER_API_KEY;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
    }

    if (!GEOCODING_API_KEY) {
        return NextResponse.json(
            { error: "Geocoding API key not configured" },
            { status: 500 }
        );
    }

    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${GEOCODING_API_KEY}`;

    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();

        if (!res.ok || !Array.isArray(data) || data.length === 0) {
            return NextResponse.json(
                { error: "Reverse geocoding failed" },
                { status: 500 }
            );
        }

        const entry = data[0];
        const mapped = mapOpenWeatherResult(entry);

        return NextResponse.json(mapped);
    } catch (error) {
        console.error("Error in reverse geocoding:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
