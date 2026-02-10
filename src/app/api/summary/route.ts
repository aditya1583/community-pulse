export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

// ============================================================================
// SYSTEM PROMPT — Anti-hallucination, data-only summaries
// ============================================================================
const SYSTEM_PROMPT = `You are the Community Pulse summarizer. Your ONLY job is to generate short, friendly, and accurate summaries based strictly on the data provided to you.

You must NEVER fabricate, guess, infer, or add any information that is not explicitly present in the provided data.

## YOUR CATEGORIES

You summarize data for exactly four categories:

### 1. WEATHER
- Summarize the current or forecasted weather using ONLY the data provided (temperature, conditions, humidity, wind, etc.)
- Write a brief, natural sentence that a neighbor might say.
- Use ONLY the exact numbers and conditions from the data. Do NOT estimate or round unless the data is already rounded.
- If specific data points are missing (e.g., no wind info), do NOT mention them at all.

### 2. TRAFFIC
- Summarize traffic conditions using ONLY the data provided (road names, incident types, delays, travel times, etc.)
- Keep it practical and actionable.
- Do NOT invent road names, delay times, or incidents.
- If no traffic data is provided, say: "No traffic updates available right now."

### 3. EVENTS
- Summarize local events using ONLY the data provided (event name, date, time, location, description).
- Mention the key details: what, when, and where.
- Do NOT create or suggest events that are not in the data.
- If no events data is provided, say: "No upcoming events to share right now."

### 4. LOCAL (Retail, Dining, Coffee, etc.)
- Summarize local business updates using ONLY the data provided (store name, offer, hours, new openings, etc.)
- Keep it conversational and relevant.
- Do NOT invent business names, deals, menu items, or locations. Only state what the data tells you.
- If no local data is provided, say: "No local business updates at the moment."

## STRICT RULES — DO NOT BREAK THESE
1. ONLY use information explicitly present in the provided data. If it's not in the data, it does not exist.
2. NEVER fabricate names, numbers, locations, dates, events, businesses, weather conditions, or any other detail.
3. NEVER assume or infer. If the data says it's 51°F, do NOT say "it might rain" unless rain is explicitly mentioned.
4. If a category has no data, say so plainly. Do not fill the gap with made-up content.
5. Keep each summary to 1-3 sentences max. Be concise, friendly, and direct.
6. Use a warm, neighborly tone — like a helpful community bulletin, not a news broadcast.
7. Include exact numbers and names from the data — do not paraphrase numbers or rename places.`;

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
      // Build structured data sections for the AI
      const dataSections: string[] = [];

      // Weather data
      if (weatherCondition) {
        dataSections.push(`<weather_data>\n${weatherCondition}\n</weather_data>`);
      } else {
        dataSections.push(`<weather_data>\nNo weather data available.\n</weather_data>`);
      }

      // Traffic data
      if (trafficLevel) {
        dataSections.push(`<traffic_data>\nTraffic level: ${trafficLevel}\n</traffic_data>`);
      } else {
        dataSections.push(`<traffic_data>\nNo traffic data available.\n</traffic_data>`);
      }

      // Events data
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
        dataSections.push(`<events_data>\n${events.length} upcoming events:\n${eventLines}\n</events_data>`);
      } else {
        dataSections.push(`<events_data>\nNo events data available.\n</events_data>`);
      }

      // Local/community data (from pulses)
      if (pulses.length > 0) {
        const pulseLines = pulses
          .slice(0, 15)
          .map(
            (p) =>
              `- [${p.tag}] (${p.mood}) by ${p.author || "Anonymous"}: ${p.message}`
          )
          .join("\n");
        dataSections.push(`<local_data>\n${pulses.length} community reports:\n${pulseLines}\n</local_data>`);
      } else {
        dataSections.push(`<local_data>\nNo local community data available.\n</local_data>`);
      }

      if (!weatherCondition && !trafficLevel && events.length === 0 && pulses.length === 0) {
        return new Response(
          JSON.stringify({ error: "No data available to summarize" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      prompt = `Summarize the following data for ${displayCity}. Use the structured output format:

**☀️ Weather**
{1-2 sentence summary}

**🚗 Traffic**
{1-2 sentence summary}

**🎉 Events**
{1-3 sentence summary}

**🏪 Local**
{1-3 sentence summary}

Here is the data:

${dataSections.join("\n\n")}

Remember: ONLY use information from the data above. If a section says "No data available", use the fallback message for that category.`;

    } else if (context === "pulse") {
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

      prompt = `Summarize these community updates for ${displayCity}. Focus on the mood and common threads. Keep it to 2-3 sentences max.

<local_data>
${pulseLines}
</local_data>

Remember: ONLY summarize what's in the data above. Never invent facts.`;

    } else if (context === "events") {
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

      prompt = `Summarize these upcoming events for ${displayCity}. Keep it to 1-2 sentences.

<events_data>
${eventLines}
</events_data>

Remember: ONLY mention events listed above. Never invent events.`;

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

      prompt = `Summarize these headlines for ${displayCity}. Keep it to 1-2 sentences.

${newsLines}

Remember: ONLY summarize what's listed above.`;
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2, // Low temperature for factual accuracy
        max_tokens: 300,
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
