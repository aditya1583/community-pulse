import { NextRequest, NextResponse } from "next/server";
import { findCity, getNearbyCities, City } from "../../data/cities";

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2/everything";

type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

type NewsResponse = {
  articles: NewsArticle[];
  sourceCity: string;
  originalCity: string;
  isNearbyFallback: boolean;
};

// Filter out negative/doomscrolling content
const NEGATIVE_KEYWORDS = [
  'death', 'killed', 'murder', 'shooting', 'attack', 'crash', 'fatal',
  'tragedy', 'disaster', 'victim', 'crime', 'threat', 'war', 'bombing'
];

// Filter out non-local sports news
const NON_LOCAL_SPORTS_KEYWORDS = [
  'penn state', 'ohio state', 'michigan state', 'florida state',
  'ncaa tournament', 'ncaa women', 'ncaa men', 'bowl game',
  'march madness', 'final four', 'college football playoff'
];

// Local community topics to prioritize
const LOCAL_TOPIC_KEYWORDS = [
  'city council', 'school district', 'local business', 'downtown',
  'traffic', 'road closure', 'construction', 'weather', 'festival',
  'community', 'neighborhood', 'residents', 'mayor', 'election',
  'development', 'new restaurant', 'opening', 'library', 'park'
];

function scoreArticle(article: NewsArticle): { score: number; isValid: boolean } {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  // Filter out negative content
  const isPositive = !NEGATIVE_KEYWORDS.some(keyword => text.includes(keyword));

  // Filter out non-local sports
  const isNonLocalSports = NON_LOCAL_SPORTS_KEYWORDS.some(keyword => text.includes(keyword));

  // Calculate local topic relevance score
  const localTopicScore = LOCAL_TOPIC_KEYWORDS.filter(keyword => text.includes(keyword)).length;

  return {
    score: localTopicScore,
    isValid: isPositive && !isNonLocalSports
  };
}

async function fetchNewsForCity(cityName: string, state?: string): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) {
    console.error("NEWS_API_KEY not configured");
    return [];
  }

  // Build search query - include state for better results
  const searchQuery = state ? `"${cityName}" AND "${state}"` : `"${cityName}"`;

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
      .filter((article: NewsArticle) =>
        article.title &&
        article.title !== "[Removed]" &&
        article.description &&
        article.description !== "[Removed]"
      )
      .map((article: NewsArticle) => ({
        article,
        ...scoreArticle(article)
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((item: { article: NewsArticle }) => item.article);

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
    return NextResponse.json({
      articles: [],
      sourceCity: cityParam,
      originalCity: cityParam,
      isNearbyFallback: false,
      notConfigured: true,
    });
  }

  // Try to find the city in our database
  const city = findCity(cityParam);
  const cityName = city?.name || cityParam;
  const state = city?.state;

  // First, try to fetch news for the requested city
  let articles = await fetchNewsForCity(cityName, state);
  let sourceCity = city?.displayName || cityParam;
  let isNearbyFallback = false;

  // If we don't have enough articles (less than 3), try nearby larger cities
  if (articles.length < 3 && city) {
    const nearbyCities = getNearbyCities(cityParam, 75, 100000); // 75 miles, 100k+ population

    for (const nearbyCity of nearbyCities) {
      if (articles.length >= 3) break;

      const nearbyArticles = await fetchNewsForCity(nearbyCity.name, nearbyCity.state);

      if (nearbyArticles.length > 0) {
        // Add nearby city articles, avoiding duplicates
        const existingUrls = new Set(articles.map(a => a.url));
        const newArticles = nearbyArticles.filter(a => !existingUrls.has(a.url));

        if (newArticles.length > 0) {
          articles = [...articles, ...newArticles];
          sourceCity = nearbyCity.displayName;
          isNearbyFallback = true;
        }
      }
    }
  }

  // Limit to 5 articles max
  articles = articles.slice(0, 5);

  const response: NewsResponse = {
    articles: articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source,
    })),
    sourceCity,
    originalCity: city?.displayName || cityParam,
    isNearbyFallback: isNearbyFallback && articles.length > 0,
  };

  return NextResponse.json(response);
}
