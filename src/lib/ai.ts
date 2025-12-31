/**
 * AI utility functions for generating summaries and processing content
 * Uses OpenAI's GPT-4o-mini model for cost-effective, fast processing
 */
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type NewsArticleSummaryInput = {
  title: string;
  description: string | null;
  source: string;
  publishedAt: string;
};

export type NewsSummaryResult = {
  paragraph: string;
  bulletPoints: string[];
};

/**
 * Generates an AI summary of local news articles
 * Creates a concise paragraph and key bullet points
 */
export async function generateNewsSummary(
  city: string,
  articles: NewsArticleSummaryInput[]
): Promise<NewsSummaryResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  if (articles.length === 0) {
    return {
      paragraph: "No recent news articles available for this area.",
      bulletPoints: [],
    };
  }

  // Take top 8 articles for summary generation
  const topArticles = articles.slice(0, 8);

  const articlesList = topArticles
    .map(
      (article, idx) =>
        `${idx + 1}. "${article.title}" (${article.source}, ${new Date(
          article.publishedAt
        ).toLocaleDateString()})\n   ${article.description || "No description"}`
    )
    .join("\n\n");

  const prompt = `You are summarizing local news for a city-focused community app called "Community Pulse".

City: ${city}

CRITICAL RULES - MUST FOLLOW:
- ONLY summarize what's actually in the headlines and descriptions below
- NEVER invent facts, claims about laws, government actions, statistics, or policy changes
- NEVER add details not present in the articles (you don't have the full text)
- Use hedging language: "according to local reports" or "headlines indicate"
- If headlines are unclear, keep the summary vague rather than inventing specifics
- NEVER fabricate legislative claims - this is legally dangerous

Recent local news articles:
${articlesList}

Task:
1. Write a 2-3 sentence summary ONLY using what's in the headlines above. Be informative, neutral, and conversational.
2. Extract 3-5 key story bullet points (use actual headline text, don't embellish).
3. Focus on local relevance - what matters to residents.
4. Avoid sensationalism and keep the tone friendly and informative.
5. Do not include any emojis.

Return ONLY a JSON object in this exact format:
{
  "paragraph": "Your summary paragraph here...",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a local news summarizer that outputs strict JSON. CRITICAL: Only summarize what's in the provided headlines - never invent facts, legislation, or claims. If uncertain, be vague rather than specific. Use hedging language like 'reports indicate'. Be concise, neutral, and accurate.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more factual output
      max_tokens: 300,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      throw new Error("Empty AI response for news summary");
    }

    const parsed = JSON.parse(raw) as {
      paragraph?: string;
      bulletPoints?: string[];
    };

    return {
      paragraph:
        parsed.paragraph || "Unable to generate a summary at this time.",
      bulletPoints: Array.isArray(parsed.bulletPoints)
        ? parsed.bulletPoints.slice(0, 5)
        : [],
    };
  } catch (error) {
    console.error("Error generating news summary:", error);
    // Return a graceful fallback instead of throwing
    return {
      paragraph: "Check out the latest local headlines below.",
      bulletPoints: topArticles.slice(0, 3).map((a) => a.title),
    };
  }
}
