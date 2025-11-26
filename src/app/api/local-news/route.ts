const SEED_HEADLINES = [
  "{city} council weighs budget priorities ahead of next fiscal year",
  "Neighborhood cleanup planned this weekend in central {city}",
  "Weekend traffic shifts expected near downtown {city} construction",
  "Local businesses in {city} report steady foot traffic despite heat",
  "Parks department unveils new trail lighting upgrade in {city}",
  "Transit officials in {city} consider adding late-night bus service",
  "Community fundraiser supports youth arts programs across {city}",
];

function buildSyntheticSeeds(city: string) {
  return SEED_HEADLINES
    .map((h) => h.replaceAll("{city}", city))
    .sort(() => 0.5 - Math.random())
    .slice(0, 4);
}

function parseBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

export async function GET(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city")?.trim();

    if (!city) {
      return new Response(JSON.stringify({ error: "City is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const seeds = buildSyntheticSeeds(city);

    const prompt = `You will turn rough local headlines into 2-3 concise bullet summaries tailored to a city.\nCity: ${city}\nHeadlines:\n${seeds
      .map((h) => `- ${h}`)
      .join("\n")}\nInstructions:\n- Return 2-3 bullets.\n- Each bullet should be short, neutral, and relevant to the city.\n- Do not invent facts beyond the seeds.\nProvide only the bullet points, each on its own line.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You rewrite local headlines into ultra-short factual bullet summaries. Keep them city-specific.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 180,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI error:", data);
      return new Response(
        JSON.stringify({
          error: data.error?.message || "OpenAI API returned an error response.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const content: string =
      data.choices?.[0]?.message?.content?.trim() || "";

    const bullets = parseBullets(content);

    const fallbackBullets = seeds.slice(0, 3).map((seed) => `${seed}.`);

    return new Response(
      JSON.stringify({ bullets: bullets.length ? bullets : fallbackBullets }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Error in /api/local-news:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Failed to generate local news",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
