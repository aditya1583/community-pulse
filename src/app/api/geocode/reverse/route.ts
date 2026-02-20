import { NextRequest, NextResponse } from "next/server";
import { mapOpenWeatherResult } from "@/lib/geocoding";

export const dynamic = "force-dynamic";

const GEOCODING_API_KEY =
    process.env.NEXT_PUBLIC_GEOCODING_API_KEY ||
    process.env.OPENWEATHER_API_KEY ||
    process.env.WEATHER_API_KEY;

/**
 * Reverse geocode using Nominatim (OpenStreetMap) — better suburb resolution.
 * Uses zoom=16 for neighborhood-level detail, then extracts the best city name.
 */
async function nominatimReverse(lat: string, lon: string) {
    try {
        // zoom=16 gives us postcode + neighborhood for unincorporated areas
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`;
        const res = await fetch(url, {
            headers: { "User-Agent": "Voxlo/1.0 (contact@voxlo.app)" },
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data?.address;
        if (!addr) return null;

        // Prefer city > town > village > suburb > hamlet
        let name = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet;

        // If no city found but we have a postcode, try a second lookup to resolve ZIP → city
        if (!name && addr.postcode) {
            try {
                const zipUrl = `https://nominatim.openstreetmap.org/search?postalcode=${addr.postcode}&country=${addr.country_code || "us"}&format=json&limit=1&addressdetails=1`;
                const zipRes = await fetch(zipUrl, {
                    headers: { "User-Agent": "Voxlo/1.0 (contact@voxlo.app)" },
                    signal: AbortSignal.timeout(2000),
                });
                if (zipRes.ok) {
                    const zipData = await zipRes.json();
                    if (zipData?.[0]?.address) {
                        const za = zipData[0].address;
                        name = za.city || za.town || za.village;
                    }
                }
            } catch {
                // ZIP lookup failed, continue without
            }
        }

        if (!name) return null;

        const state = addr.state || undefined;
        const country = addr.country_code?.toUpperCase() || undefined;

        return { name, state, country, lat: parseFloat(lat), lon: parseFloat(lon) };
    } catch {
        return null;
    }
}

function buildResponse(name: string, state?: string, country?: string, lat?: number, lon?: number) {
    const displayParts = [name];
    if (state) displayParts.push(state);
    if (country) displayParts.push(country);

    return {
        id: `${name}-${state ?? "unknown"}-${country ?? "unknown"}-${lat}-${lon}`,
        name,
        state,
        country,
        lat,
        lon,
        displayName: displayParts.join(", "),
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
    }

    // Try Nominatim first (better suburb-level accuracy)
    const nomResult = await nominatimReverse(lat, lon);
    if (nomResult) {
        return NextResponse.json(
            buildResponse(nomResult.name, nomResult.state, nomResult.country, nomResult.lat, nomResult.lon)
        );
    }

    // Fallback to OpenWeatherMap
    if (!GEOCODING_API_KEY) {
        return NextResponse.json(
            { error: "Geocoding API key not configured" },
            { status: 500 }
        );
    }

    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${GEOCODING_API_KEY}`;

    try {
        const res = await fetch(url, {
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(4000),
        });
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
