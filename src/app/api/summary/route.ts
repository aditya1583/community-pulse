type PulseInput = {
  mood: string;
  tag: string;
  message: string;
  author: string;
  createdAt: string;
};

type EventInput = {
  name: string;
  venue: string;
  date?: string;
  time?: string;
};

type NewsInput = {
  title: string;
  source?: string;
};

type SummaryContext = "all" | "pulse" | "events" | "traffic" | "news";

type SummaryRequestBody = {
  city: string;
  context?: SummaryContext;
  pulses?: PulseInput[];
  events?: EventInput[];
  news?: NewsInput[];
  trafficLevel?: "Light" | "Moderate" | "Heavy" | null;
  weatherCondition?: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: SummaryRequestBody = await req.json();
    const {
      city,
      context = "all",
      pulses = [],
      events = [],
      news = [],
      trafficLevel,
      weatherCondition,
    } = body;

    if (!city) {
      return new Response(
        JSON.stringify({ error: "City parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build context-specific prompt
    let prompt = "";
    const displayCity = city.split(",")[0]?.trim() || city;

    if (context === "all") {
      // Master summary - synthesize all data sources
      const sections: string[] = [];

      // Pulses section
      if (pulses.length > 0) {
        const pulseLines = pulses
          .slice(0, 15)
          .map(
            (p) =>
              `- [${p.tag}] (${p.mood}) by ${p.author || "Anonymous"}: ${p.message}`
          )
          .join("\n");
        sections.push(`COMMUNITY PULSES (${pulses.length} recent):\n${pulseLines}`);
      }

      // Events section
      if (events.length > 0) {
        const eventLines = events
          .slice(0, 5)
          .map((e) => {
            const dateStr = e.date
              ? new Date(e.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
              : "";
            return `- ${e.name} at ${e.venue}${dateStr ? ` (${dateStr})` : ""}`;
          })
          .join("\n");
        sections.push(`UPCOMING EVENTS (${events.length} total):\n${eventLines}`);
      }

      // News section
      if (news.length > 0) {
        const newsLines = news
          .slice(0, 5)
          .map((n) => `- ${n.title}${n.source ? ` (${n.source})` : ""}`)
          .join("\n");
        sections.push(`TOP NEWS HEADLINES:\n${newsLines}`);
      }

      // Traffic and weather
      const conditions: string[] = [];
      if (trafficLevel) {
        conditions.push(`Traffic: ${trafficLevel}`);
      }
      if (weatherCondition) {
        conditions.push(`Weather: ${weatherCondition}`);
      }
      if (conditions.length > 0) {
        sections.push(`CURRENT CONDITIONS:\n${conditions.join("\n")}`);
      }

      if (sections.length === 0) {
        return new Response(
          JSON.stringify({ error: "No data available to summarize" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      prompt = `
You are a well-connected neighborhood insider for ${displayCity}. Summarize the data provided below for a hyperlocal dashboard called "Voxlo". 

CRITICAL RULES:
- ONLY mention information explicitly present in the data below.
- NEVER invent facts, laws, politics, or statistics.
- If a section is empty, skip it.
- Use a conversational, "punchy" tone. Think "Morning Brew" meets a friendly neighbors' group chat.
- Add exactly 1 appropriate emoji per sentence to make it feel alive.

Here's the data for ${displayCity}:
${sections.join("\n\n")}

Task:
1. Write 2-3 fast-paced sentences synthesizing this info.
2. Lead with the "headline" - the most useful or interesting thing happening right now.
3. Use phrases like "Neighbors are reporting," "Local word is," or "Heads up for those near..."
4. Keep it focused on the 10-mile neighborhood vibe.

Example: "🚦 Heads up neighbors, traffic is slowing down near the old oak district. 🎵 On the bright side, the jazz fest kicks off at the park tonight! ☀️ Weather's perfect for it, so grab a blanket."

Return ONLY the summary text.
      `.trim();
    } else if (context === "pulse") {
      // Pulse-specific summary
      if (pulses.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pulses available to summarize" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const pulseLines = pulses
        .slice(0, 30)
        .map(
          (p) =>
            `- [${p.tag}] (${p.mood}) by ${p.author || "Anonymous"}: ${p.message}`
        )
        .join("\n");

      prompt = `
You are the neighborhood "vibe checker" for ${city}. Summarize these community updates for a local dashboard.

CRITICAL RULES:
- ONLY summarize the pulses below.
- NEVER invent facts, laws, or statistics.
- Use a punchy, conversational tone with 1-2 emojis.
- Focus on the *mood* and *common threads* of what people are saying.

The Neighborhood Pulse:
${pulseLines}

Example: "✨ The neighborhood is feeling high-energy today! 🌮 Lots of love for the new taco spot on 4th, though some are reporting delays near the intersection."

Return ONLY the summary text.
      `.trim();
    } else if (context === "events") {
      // Events-specific summary
      if (events.length === 0) {
        return new Response(JSON.stringify({ summary: "No upcoming events in the area." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const eventLines = events
        .slice(0, 10)
        .map((e) => {
          const dateStr = e.date
            ? new Date(e.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
            : "";
          return `- ${e.name} at ${e.venue}${dateStr ? ` (${dateStr})` : ""}`;
        })
        .join("\n");

      prompt = `
You are the local social scout for ${displayCity}. Summarize these upcoming events.

Rules:
- 1-2 punchy sentences.
- Add some "local excitement" flair.
- Include 1-2 emojis.

The Scene:
${eventLines}

Example: "🎟️ The weekend is looking packed with ${events.length} events! 🎸 Don't miss the local band showcase and the farmers market on Saturday."

Return ONLY the summary text.
      `.trim();
    } else if (context === "traffic") {
      const level = trafficLevel || "Unknown";
      return new Response(
        JSON.stringify({
          summary: `Current traffic in ${displayCity}: ${level}. ${level === "Light"
              ? "Roads are clear. Great time to travel."
              : level === "Moderate"
                ? "Some congestion in busy areas. Allow extra time."
                : level === "Heavy"
                  ? "Significant delays expected. Consider alternate routes."
                  : "Traffic data is being gathered."
            }`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else if (context === "news") {
      // News-specific summary
      if (news.length === 0) {
        return new Response(
          JSON.stringify({ summary: `No local news currently available for ${displayCity}.` }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const newsLines = news
        .slice(0, 8)
        .map((n) => `- ${n.title}`)
        .join("\n");

      prompt = `
You are a hyperlocal news aggregator for ${displayCity}. Summarize the top headlines.

Rules:
- 1-2 short, professional but conversational sentences.
- No speculation.
- Use 1 emoji.

The Headlines:
${newsLines}

Return ONLY the summary text.
      `.trim();
    }

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
              "You're a friendly local giving quick updates to neighbors. CRITICAL: You must ONLY summarize the data provided - never invent facts, legislation, statistics, or claims not in the input. If something isn't in the data, don't mention it. Use hedging language like 'neighbors report' or 'some are saying'. Be conversational but accurate.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3, // Lower temperature for more factual output
        max_tokens: 150,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI error:", data);
      return new Response(
        JSON.stringify({
          error:
            data.error?.message || "OpenAI API returned an error response.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const summary: string =
      data.choices?.[0]?.message?.content?.trim() ||
      "Unable to generate a summary right now.";

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate summary";
    console.error("Error in /api/summary:", err);
    return new Response(
      JSON.stringify({
        error: message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
