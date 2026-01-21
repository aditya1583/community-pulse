/**
 * Weather API - Using Open-Meteo (100% free, no API key, no attribution required)
 * https://open-meteo.com/
 */

type WeatherResponse = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
  cityName: string;
};

type WeatherRequest = {
  city: string;
  lat?: number;
  lon?: number;
  country?: string | null;
  state?: string | null;
};

// WMO Weather interpretation codes to descriptions and icons
// https://open-meteo.com/en/docs#weathervariables
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

function getWeatherInfo(code: number): { description: string; icon: string } {
  return WMO_CODES[code] || { description: "Unknown", icon: "01d" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { city, lat, lon } = body as WeatherRequest;

    if (!city || !city.trim()) {
      return new Response(
        JSON.stringify({ error: "City is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let latitude = lat;
    let longitude = lon;

    // If no coordinates provided, geocode the city using Open-Meteo's geocoding
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geocodeRes = await fetch(geocodeUrl);
      const geocodeData = await geocodeRes.json();

      if (!geocodeData.results || geocodeData.results.length === 0) {
        return new Response(
          JSON.stringify({ error: "City not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      latitude = geocodeData.results[0].latitude;
      longitude = geocodeData.results[0].longitude;
    }

    // Fetch weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    if (!weatherRes.ok || !weatherData.current) {
      console.error("Open-Meteo error:", weatherData);
      return new Response(
        JSON.stringify({ error: "Weather service error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const current = weatherData.current;
    const weatherInfo = getWeatherInfo(current.weather_code);

    const payload: WeatherResponse = {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      description: weatherInfo.description,
      icon: weatherInfo.icon,
      cityName: city.split(",")[0].trim(), // Use the city name from request
    };

    // --- ALERT TRIGGER ---
    // 56/57 (Freezing Drizzle), 66/67 (Freezing Rain), 75 (Heavy Snow), 86 (Heavy Snow Showers), 95/96/99 (Thunderstorm)
    const SEVERE_CODES = [56, 57, 66, 67, 75, 86, 95, 96, 99];

    if (SEVERE_CODES.includes(current.weather_code)) {
      Promise.resolve().then(async () => {
        try {
          // Dynamic import to avoid circular deps if any
          const { sendCityNotification } = await import("@/lib/pushNotifications");
          const isSevere = [67, 75, 96, 99].includes(current.weather_code);

          await sendCityNotification(city, "weather_alert", {
            type: "weather_alert",
            city: city,
            condition: weatherInfo.description,
            description: `Current condition: ${weatherInfo.description}. Stay safe!`,
            severity: isSevere ? "severe" : "moderate"
          });
        } catch (err) {
          console.error("Failed to send weather notification:", err);
        }
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache for 15 minutes
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800"
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch weather";
    console.error("Error in /api/weather:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
