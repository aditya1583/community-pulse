import { NextRequest, NextResponse } from "next/server";
import { findCity, getNearbyCities, City } from "../../data/cities"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { generateNewsSummary, NewsArticleSummaryInput } from "@/lib/ai";

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2/everything";

/**
 * Shape of a single news article
 */
export type LocalNewsArticle = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string | null;
  urlToImage: string | null;
};

/**
 * AI-generated summary of local news
 */
export type LocalNewsSummary = {
  paragraph: string;
  bulletPoints: string[];
};

/**
 * Full response from the local-news API
 */
export type LocalNewsResponse = {
  articles: LocalNewsArticle[];
  aiSummary: LocalNewsSummary | null;
  city: string;
  sourceCity: string;
  isNearbyFallback: boolean;
  fetchedAt: string;
  notConfigured?: boolean;
};

// Filter out negative/doomscrolling content
const NEGATIVE_KEYWORDS = [
  "death",
  "killed",
  "murder",
  "shooting",
  "attack",
  "crash",
  "fatal",
  "tragedy",
  "disaster",
  "victim",
  "crime",
  "threat",
  "war",
  "bombing",
];

// Filter out non-local sports news
const NON_LOCAL_SPORTS_KEYWORDS = [
  "penn state",
  "ohio state",
  "michigan state",
  "florida state",
  "ncaa tournament",
  "ncaa women",
  "ncaa men",
  "bowl game",
  "march madness",
  "final four",
  "college football playoff",
];

// Local community topics to prioritize
const LOCAL_TOPIC_KEYWORDS = [
  "city council",
  "school district",
  "local business",
  "downtown",
  "traffic",
  "road closure",
  "construction",
  "weather",
  "festival",
  "community",
  "neighborhood",
  "residents",
  "mayor",
  "election",
  "development",
  "new restaurant",
  "opening",
  "library",
  "park",
];

type RawNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

function scoreArticle(article: RawNewsArticle): {
  score: number;
  isValid: boolean;
} {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();

  // Filter out negative content
  const isPositive = !NEGATIVE_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  // Filter out non-local sports
  const isNonLocalSports = NON_LOCAL_SPORTS_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  // Calculate local topic relevance score
  const localTopicScore = LOCAL_TOPIC_KEYWORDS.filter((keyword) =>
    text.includes(keyword)
  ).length;

  return {
    score: localTopicScore,
    isValid: isPositive && !isNonLocalSports,
  };
}

async function fetchNewsForCity(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!NEWS_API_KEY) {
    console.error("NEWS_API_KEY not configured");
    return [];
  }

  // Build search query - include state for better results
  const searchQuery = state
    ? `"${cityName}" AND "${state}"`
    : `"${cityName}"`;

  const params = new URLSearchParams({
    q: searchQuery,
    apiKey: NEWS_API_KEY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "50", // Fetch more to filter better
  });

  try {
    const response = await fetch(`${NEWS_API_URL}?${params}`, {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("NewsAPI error:", response.status, errorData);
      return [];
    }

    const data = await response.json();

    // Filter, score, and sort articles
    const validArticles = (data.articles || [])
      .filter(
        (article: RawNewsArticle) =>
          article.title &&
          article.title !== "[Removed]" &&
          article.description &&
          article.description !== "[Removed]"
      )
      .map((article: RawNewsArticle) => ({
        article,
        ...scoreArticle(article),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort(
        (a: { score: number }, b: { score: number }) => b.score - a.score
      )
      .map((item: { article: RawNewsArticle }) => item.article);

    return validArticles;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get("city");

  if (!cityParam) {
    return NextResponse.json(
      { error: "City parameter is required" },
      { status: 400 }
    );
  }

  if (!NEWS_API_KEY) {
    // Return empty response instead of error when API key not configured
    const response: LocalNewsResponse = {
      articles: [],
      aiSummary: null,
      city: cityParam,
      sourceCity: cityParam,
      isNearbyFallback: false,
      fetchedAt: new Date().toISOString(),
      notConfigured: true,
    };
    return NextResponse.json(response);
  }

  // Try to find the city in our database
  const city = findCity(cityParam);
  const cityName = city?.name || cityParam;
  const state = city?.state;

  // First, try to fetch news for the requested city
  let rawArticles = await fetchNewsForCity(cityName, state);
  let sourceCity = city?.displayName || cityParam;
  let isNearbyFallback = false;

  // If we don't have enough articles (less than 3), try nearby larger cities
  if (rawArticles.length < 3 && city) {
    const nearbyCities = getNearbyCities(cityParam, 75, 100000); // 75 miles, 100k+ population

    for (const nearbyCity of nearbyCities) {
      if (rawArticles.length >= 5) break;

      const nearbyArticles = await fetchNewsForCity(
        nearbyCity.name,
        nearbyCity.state
      );

      if (nearbyArticles.length > 0) {
        // Add nearby city articles, avoiding duplicates
        const existingUrls = new Set(rawArticles.map((a) => a.url));
        const newArticles = nearbyArticles.filter(
          (a) => !existingUrls.has(a.url)
        );

        if (newArticles.length > 0) {
          rawArticles = [...rawArticles, ...newArticles];
          if (rawArticles.length <= 3) {
            sourceCity = nearbyCity.displayName;
            isNearbyFallback = true;
          }
        }
      }
    }
  }

  // Limit to 8 articles max for display
  rawArticles = rawArticles.slice(0, 8);

  // Transform to our response format
  const articles: LocalNewsArticle[] = rawArticles.map((article) => ({
    title: article.title,
    source: article.source.name,
    publishedAt: article.publishedAt,
    url: article.url,
    description: article.description,
    urlToImage: article.urlToImage,
  }));

  // Generate AI summary if we have articles
  let aiSummary: LocalNewsSummary | null = null;
  if (articles.length > 0) {
    try {
      const summaryInput: NewsArticleSummaryInput[] = articles.map((a) => ({
        title: a.title,
        description: a.description,
        source: a.source,
        publishedAt: a.publishedAt,
      }));
      aiSummary = await generateNewsSummary(cityName, summaryInput);
    } catch (error) {
      console.error("Error generating AI summary:", error);
      // Continue without summary - don't fail the whole request
    }
  }

  const response: LocalNewsResponse = {
    articles,
    aiSummary,
    city: city?.displayName || cityParam,
    sourceCity: isNearbyFallback && rawArticles.length > 0 ? sourceCity : (city?.displayName || cityParam),
    isNearbyFallback: isNearbyFallback && rawArticles.length > 0,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
