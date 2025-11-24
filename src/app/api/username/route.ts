import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// Local fallback generator in case OpenAI fails
function makeLocalUsername(prompt: string): string {
  const words = prompt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);

  if (words.length === 0) return "VibeTraveler01";

  const base = words
    .map((w) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, "");
      if (!clean) return "";
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    })
    .join("");

  const sanitized = base || "VibeTraveler";
  const num = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${sanitized}${num}`;
}

export async function POST(req: Request) {
  let prompt = "";

  try {
    const body = (await req.json().catch(() => null)) as { prompt?: string } | null;

    if (!body || !body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    prompt = body.prompt.trim();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set; using local username fallback.");
      const username = makeLocalUsername(prompt);
      return NextResponse.json({ username });
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `
You generate fun, anonymous usernames for a local community app.

Rules:
- Return EXACTLY ONE username.
- It MUST be a single token like DrowsyByteWizard or NeonOtter09.
- No spaces, no emojis, no punctuation.
- Use PascalCase style, letters and optional digits only.
- You may optionally append a 2-digit number.
- Do NOT include quotes or explanations.
`.trim();

    const userPrompt = `
Mood description from user:
"${prompt}"

Create ONE playful anonymous username that matches this mood.
Remember: One word, PascalCase, no spaces. Example: SleepyCaffeinatedOwl24
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16,
      temperature: 0.9,
    });

    const raw =
      completion.choices[0]?.message?.content?.trim() ?? "";

    // Sanitize to letters+digits only, no spaces
    const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").trim();

    const username =
      cleaned && cleaned.length >= 3
        ? cleaned
        : makeLocalUsername(prompt);

    return NextResponse.json({ username });
  } catch (err) {
    console.error("[/api/username] error:", err);
    const fallback = makeLocalUsername(prompt || "Vibe Traveler");
    return NextResponse.json(
      { username: fallback, error: "fallback_used" },
      { status: 200 }
    );
  }
}
