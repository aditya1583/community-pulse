type PulseInput = {
  mood: string;
  tag: string;
  message: string;
  author: string;
  createdAt: string;
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

    const body = await req.json();
    const { city, pulses } = body as {
      city: string;
      pulses: PulseInput[];
    };

    if (!city || !Array.isArray(pulses) || pulses.length === 0) {
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

    const prompt = `
You are summarizing short, real-time status updates for a city board called "Community Pulse".

City: ${city}

Here are recent pulses:
${pulseLines}

Task:
1. In 1–2 sentences, summarize the overall vibe in this city right now.
2. Mention traffic / weather / events only if they appear in the pulses.
3. Keep it neutral, informative, and concise. No emojis.

Return ONLY the summary text, nothing else.
    `.trim();

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
              "You summarize local city vibes from short user posts. Be concise and neutral.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 120,
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
