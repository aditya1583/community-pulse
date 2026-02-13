import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Bundled /api/pulse endpoint
 * Aggregates weather + feed + traffic-live into a single response.
 * Accepts: ?lat={lat}&lon={lon}&city={city}&limit={limit}
 * Returns: { weather, feed, traffic, timestamp }
 * Partial data is OK — returns whatever succeeded.
 */

// ---- Weather (Open-Meteo, free, no key) ----

const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "01d" },
  1: { description: "Mainly clear", icon: "01d" },
  2: { description: "Partly cloudy", icon: "02d" },
  3: { description: "Overcast", icon: "03d" },
  45: { description: "Foggy", icon: "50d" },
  48: { description: "Depositing rime fog", icon: "50d" },
  51: { description: "Light drizzle", icon: "09d" },
  53: { description: "Moderate drizzle", icon: "09d" },
  55: { description: "Dense drizzle", icon: "09d" },
  56: { description: "Freezing drizzle", icon: "09d" },
  57: { description: "Heavy freezing drizzle", icon: "09d" },
  61: { description: "Slight rain", icon: "10d" },
  63: { description: "Moderate rain", icon: "10d" },
  65: { description: "Heavy rain", icon: "10d" },
  66: { description: "Freezing rain", icon: "13d" },
  67: { description: "Heavy freezing rain", icon: "13d" },
  71: { description: "Slight snow", icon: "13d" },
  73: { description: "Moderate snow", icon: "13d" },
  75: { description: "Heavy snow", icon: "13d" },
  77: { description: "Snow grains", icon: "13d" },
  80: { description: "Slight rain showers", icon: "09d" },
  81: { description: "Moderate rain showers", icon: "09d" },
  82: { description: "Violent rain showers", icon: "09d" },
  85: { description: "Slight snow showers", icon: "13d" },
  86: { description: "Heavy snow showers", icon: "13d" },
  95: { description: "Thunderstorm", icon: "11d" },
  96: { description: "Thunderstorm with hail", icon: "11d" },
  99: { description: "Thunderstorm with heavy hail", icon: "11d" },
};

async function fetchWeather(city: string, lat?: number, lon?: number) {
  let latitude = lat;
  let longitude = lon;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geocodeRes = await fetch(geocodeUrl, { signal: AbortSignal.timeout(4000) });
    const geocodeData = await geocodeRes.json();
    if (!geocodeData.results?.length) return null;
    latitude = geocodeData.results[0].latitude;
    longitude = geocodeData.results[0].longitude;
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
  const weatherData = await weatherRes.json();

  if (!weatherRes.ok || !weatherData.current) return null;

  const current = weatherData.current;
  const info = WMO_CODES[current.weather_code] || { description: "Unknown", icon: "01d" };

  return {
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    description: info.description,
    icon: info.icon,
    cityName: city.split(",")[0].trim(),
  };
}

// ---- Feed/Pulses (Supabase) ----

async function fetchFeed(city: string, lat?: number, lon?: number, limit = 26) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[pulse] Missing Supabase config");
    return { pulses: [] };
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const query = supabase
    .from("pulses")
    .select("id, author, message, tag, city, lat, lon, likes, created_at, expires_at, is_bot, image_url, poll_options, poll_votes, user_id")
    .eq("city", city)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[pulse] Feed fetch error:", error.message);
    return { pulses: [], error: error.message };
  }

  return { pulses: data || [] };
}

// ---- Traffic (TomTom live) ----

const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "austin": { lat: 30.2672, lon: -97.7431 },
  "houston": { lat: 29.7604, lon: -95.3698 },
  "dallas": { lat: 32.7767, lon: -96.7970 },
  "san antonio": { lat: 29.4241, lon: -98.4936 },
  "new york": { lat: 40.7128, lon: -74.0060 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  "chicago": { lat: 41.8781, lon: -87.6298 },
  "phoenix": { lat: 33.4484, lon: -112.0740 },
  "seattle": { lat: 47.6062, lon: -122.3321 },
  "denver": { lat: 39.7392, lon: -104.9903 },
};

async function fetchTraffic(city: string, lat?: number, lon?: number) {
  const apiKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || process.env.TRAFFIC_API_KEY;
  if (!apiKey) return null;

  let coords: { lat: number; lon: number } | null = null;
  if (typeof lat === "number" && typeof lon === "number") {
    coords = { lat, lon };
  } else {
    const normalized = city.split(",")[0].toLowerCase().trim();
    coords = CITY_COORDINATES[normalized] || null;
  }
  if (!coords) return null;

  // Fetch flow + incidents in parallel (same as traffic-live)
  const flowUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${coords.lat},${coords.lon}&key=${apiKey}`;
  const delta = 0.08;
  const bbox = `${coords.lon - delta},${coords.lat - delta},${coords.lon + delta},${coords.lat + delta}`;
  const incidentsUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${apiKey}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,aci{probabilityOfOccurrence,numberOfReports,lastReportTime}}}}`;

  const [flowRes, incRes] = await Promise.allSettled([
    fetch(flowUrl, { signal: AbortSignal.timeout(4000) }),
    fetch(incidentsUrl, { signal: AbortSignal.timeout(4000) }),
  ]);

  let flowPercent = 75;
  let currentSpeed: number | undefined;
  let freeFlowSpeed: number | undefined;

  if (flowRes.status === "fulfilled" && flowRes.value.ok) {
    try {
      const data = await flowRes.value.json();
      if (data.flowSegmentData) {
        currentSpeed = data.flowSegmentData.currentSpeed;
        freeFlowSpeed = data.flowSegmentData.freeFlowSpeed;
        if (currentSpeed !== undefined && freeFlowSpeed && freeFlowSpeed > 0) {
          flowPercent = Math.round((currentSpeed / freeFlowSpeed) * 100);
        }
      }
    } catch { /* ignore */ }
  }

  type IncidentItem = {
    type?: string;
    properties?: {
      iconCategory?: number;
      magnitudeOfDelay?: number;
      events?: Array<{ description?: string; code?: number }>;
      from?: string;
      to?: string;
      delay?: number;
      roadNumbers?: string[];
    };
  };

  const incidents: Array<{
    id: string;
    type: string;
    description: string;
    roadName?: string;
    delay?: number;
    severity: number;
  }> = [];
  let hasRoadClosure = false;

  if (incRes.status === "fulfilled" && incRes.value.ok) {
    try {
      const data = await incRes.value.json();
      if (data.incidents && Array.isArray(data.incidents)) {
        for (const inc of (data.incidents as IncidentItem[]).slice(0, 10)) {
          const props = inc.properties || {};
          const events = props.events || [];
          const description = events.length > 0
            ? events.map((e) => e.description || "").join("; ")
            : "Traffic incident reported";

          const iconCat = props.iconCategory || 0;
          let incType = "other";
          if (iconCat === 2) incType = "accident";
          else if (iconCat === 7) incType = "congestion";
          else if (iconCat === 8 || iconCat === 9) { incType = "closure"; hasRoadClosure = true; }
          else if (iconCat === 10) incType = "roadwork";

          const mag = props.magnitudeOfDelay || 0;
          let severity = 1;
          if (mag >= 3) severity = 4;
          else if (mag >= 2) severity = 3;
          else if (mag >= 1) severity = 2;

          const roadNumbers = props.roadNumbers || [];
          incidents.push({
            id: `${inc.type || "incident"}-${incidents.length}`,
            type: incType,
            description: description || "Traffic incident",
            roadName: roadNumbers.length > 0 ? roadNumbers.join(", ") : (props.from || undefined),
            delay: props.delay,
            severity,
          });
        }
      }
    } catch { /* ignore */ }
  }

  // Calculate level
  let level: string;
  if (hasRoadClosure) level = "Severe";
  else if (flowPercent >= 80) level = "Light";
  else if (flowPercent >= 60) level = "Moderate";
  else if (flowPercent >= 40) level = "Heavy";
  else level = "Severe";

  return {
    level,
    flowPercent,
    currentSpeed,
    freeFlowSpeed,
    incidents,
    hasRoadClosure,
    lastUpdated: new Date().toISOString(),
    source: "tomtom" as const,
  };
}

// ---- Main handler ----

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
  const lon = searchParams.get("lon") ? parseFloat(searchParams.get("lon")!) : undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 26;

  if (!city) {
    return NextResponse.json({ error: "Missing city parameter" }, { status: 400 });
  }

  // Fetch all three in parallel — partial results are fine
  const [weatherResult, feedResult, trafficResult] = await Promise.allSettled([
    fetchWeather(city, lat, lon),
    fetchFeed(city, lat, lon, limit),
    fetchTraffic(city, lat, lon),
  ]);

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const feed = feedResult.status === "fulfilled" ? feedResult.value : { pulses: [] };
  const traffic = trafficResult.status === "fulfilled" ? trafficResult.value : null;

  return NextResponse.json(
    { weather, feed, traffic, timestamp: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
