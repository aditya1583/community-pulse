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
You are summarizing the current state of ${displayCity} for a city dashboard called "Community Pulse".

Here is the available data:

${sections.join("\n\n")}

Task:
1. In 2-3 sentences, provide a comprehensive overview of what's happening in ${displayCity} right now.
2. Synthesize information from all available sources (pulses, events, news, conditions).
3. Prioritize the most interesting or impactful information.
4. Keep it informative, engaging, and concise. No emojis.

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
You are summarizing short, real-time status updates for a city board called "Community Pulse".

City: ${city}

Here are recent pulses:
${pulseLines}

Task:
1. In 1-2 sentences, summarize the overall vibe in this city right now.
2. Mention traffic / weather / events only if they appear in the pulses.
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
              "You summarize local city information from multiple sources. Be concise, informative, and neutral.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
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
