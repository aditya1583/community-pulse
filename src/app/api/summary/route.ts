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
You are summarizing ONLY the data provided below for ${displayCity}. Write like you're giving a quick heads-up to a neighbor.

CRITICAL RULES - MUST FOLLOW:
- ONLY mention information explicitly present in the data below
- NEVER invent facts, statistics, laws, legislation, government actions, or claims
- NEVER speculate about causes or consequences not mentioned in the data
- If a topic isn't in the data, don't mention it at all
- Use phrases like "residents report" or "some neighbors say" when summarizing community posts

Here's the ACTUAL data:

${sections.join("\n\n")}

Task:
1. In 2-3 short sentences, summarize ONLY what's in the data above.
2. Lead with the most interesting or useful info (events, community reports, conditions).
3. Sound like a helpful neighbor, not a news anchor. Use casual phrasing.
4. Skip formalities - get straight to the useful info. No emojis.

Example tone: "Heads up, a few neighbors are reporting traffic building near downtown. There's a show at the arena tonight. Weather's looking good."

Return ONLY the summary text, nothing else.
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
You are summarizing short, real-time status updates for a city board called "Voxlo".

City: ${city}

CRITICAL RULES - MUST FOLLOW:
- ONLY summarize what's actually in the pulses below
- NEVER invent facts, claims about laws, government actions, or statistics
- NEVER speculate beyond what people actually said
- Use "some neighbors report" or "residents are saying" language

Here are recent pulses:
${pulseLines}

Task:
1. In 1-2 sentences, summarize ONLY what's in the pulses above.
2. Mention traffic / weather / events only if they explicitly appear in the pulses.
3. Keep it neutral, informative, and concise. No emojis.

Return ONLY the summary text, nothing else.
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
Summarize the upcoming events in ${displayCity}:

${eventLines}

Task:
1. In 1-2 sentences, highlight the most notable upcoming events.
2. Mention the total count and variety of events.
3. Keep it informative and concise. No emojis.

Return ONLY the summary text, nothing else.
      `.trim();
    } else if (context === "traffic") {
      const level = trafficLevel || "Unknown";
      return new Response(
        JSON.stringify({
          summary: `Current traffic in ${displayCity}: ${level}. ${
            level === "Light"
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
Summarize the top local news for ${displayCity}:

${newsLines}

Task:
1. In 1-2 sentences, highlight the key themes or stories.
2. Keep it neutral and informative. No emojis.

Return ONLY the summary text, nothing else.
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
