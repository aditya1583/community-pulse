type WeatherResponse = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string; // e.g. "01d"
  cityName: string;
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
    const { city } = body as { city: string };

    if (!city || !city.trim()) {
      return new Response(
        JSON.stringify({ error: "City is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle "City, ST" format - convert to OpenWeatherMap format "City,ST,US"
    let weatherQuery = city.trim();
    const cityStateMatch = weatherQuery.match(/^(.+),\s*([A-Z]{2})$/);
    if (cityStateMatch) {
      const [, cityName, stateCode] = cityStateMatch;
      weatherQuery = `${cityName},${stateCode},US`;
    }

    const q = encodeURIComponent(weatherQuery);

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${apiKey}&units=imperial`;

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
  } catch (err: any) {
    console.error("Error in /api/weather:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Failed to fetch weather",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
