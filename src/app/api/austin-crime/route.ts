import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const CRIME_API_URL = "https://data.austintexas.gov/resource/fdj4-gpfu.json";

interface CrimeReport {
  incident_report_number: string;
  crime_type: string;
  date: string;
  time: string;
  location_type: string;
  address: string;
  census_block_group: string;
  latitude?: number;
  longitude?: number;
}

interface FormattedCrimeReport {
  id: string;
  type: string;
  date: string;
  time: string;
  locationType: string;
  area: string; // census block, NOT exact address for privacy
  lat: number | null;
  lon: number | null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = params.get("lat") ? parseFloat(params.get("lat")!) : null;
  const lon = params.get("lon") ? parseFloat(params.get("lon")!) : null;
  const limit = Math.min(parseInt(params.get("limit") || "25"), 50);

  try {
    // Build Socrata SoQL query — recent incidents within bounding box
    const queryParams = new URLSearchParams();
    queryParams.set("$limit", String(limit));
    queryParams.set("$order", "date DESC");

    // Last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateFilter = sevenDaysAgo.toISOString().split("T")[0];
    
    let whereClause = `date >= '${dateFilter}'`;

    // If we have coordinates, filter to ~12 mile bounding box
    if (lat != null && lon != null) {
      const latDelta = 0.175;
      const lonDelta = 0.21;
      whereClause += ` AND latitude >= '${lat - latDelta}' AND latitude <= '${lat + latDelta}' AND longitude >= '${lon - lonDelta}' AND longitude <= '${lon + lonDelta}'`;
    }

    queryParams.set("$where", whereClause);

    const url = `${CRIME_API_URL}?${queryParams}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Crime data API error: ${res.status}` }, { status: 502 });
    }

    const raw: CrimeReport[] = await res.json();

    // Format and sanitize — use census block, NOT exact addresses
    const reports: FormattedCrimeReport[] = raw.map((r) => ({
      id: r.incident_report_number || "",
      type: r.crime_type || "Unknown",
      date: r.date || "",
      time: r.time || "",
      locationType: r.location_type || "",
      area: r.census_block_group || "Austin Metro",
      lat: r.latitude ? parseFloat(String(r.latitude)) : null,
      lon: r.longitude ? parseFloat(String(r.longitude)) : null,
    }));

    return NextResponse.json(
      { reports, count: reports.length, source: "Austin PD Open Data", updatedAt: new Date().toISOString(),
        disclaimer: "Austin PD data only. Does not cover Leander/Cedar Park PD jurisdictions." },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    console.error("[Austin Crime] API error:", err);
    return NextResponse.json({ error: "Failed to fetch crime data" }, { status: 500 });
  }
}
