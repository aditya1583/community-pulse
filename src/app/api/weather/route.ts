type WeatherResponse = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string; // e.g. "01d"
  cityName: string;
};

type WeatherRequest = {
  city: string;
  lat?: number;
  lon?: number;
  country?: string | null;
  state?: string | null;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Weather API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { city, lat, lon, country, state } = body as WeatherRequest;

    if (!city || !city.trim()) {
      return new Response(
        JSON.stringify({ error: "City is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prefer coordinates for accuracy; fall back to text query
    let url = "";
    if (typeof lat === "number" && typeof lon === "number") {
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    } else {
      // Handle "City, ST" format - convert to OpenWeatherMap format "City,ST,COUNTRY"
      let weatherQuery = city.trim();
      const cityStateMatch = weatherQuery.match(/^(.+),\s*([A-Z]{2})$/);
      if (cityStateMatch && (country === "US" || !country)) {
        const [, cityName, stateCode] = cityStateMatch;
        weatherQuery = `${cityName},${stateCode},US`;
      } else if (country && !weatherQuery.toLowerCase().includes(country.toLowerCase())) {
        weatherQuery = `${weatherQuery},${country}`;
      } else if (state && !weatherQuery.toLowerCase().includes(state.toLowerCase())) {
        weatherQuery = `${weatherQuery},${state}`;
      }

      const q = encodeURIComponent(weatherQuery);
      url = `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${apiKey}&units=imperial`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error("OpenWeather error:", data);
      return new Response(
        JSON.stringify({
          error:
            data.message || "Weather service error. Please check the city name.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload: WeatherResponse = {
      temp: data.main?.temp,
      feelsLike: data.main?.feels_like,
      description: data.weather?.[0]?.description || "Unknown",
      icon: data.weather?.[0]?.icon || "01d",
      cityName: data.name || city,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch weather";
    console.error("Error in /api/weather:", err);
    return new Response(
      JSON.stringify({
        error: message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
