import { NextRequest, NextResponse } from "next/server";
import { findCity, getNearbyCities } from "../../data/cities";
import { generateNewsSummary, NewsArticleSummaryInput } from "@/lib/ai";
import { deduplicateArticles } from "./deduplication";
import type {
  LocalNewsArticle,
  LocalNewsResponse,
  LocalNewsSummary,
} from "@/types/news";

export type { LocalNewsArticle, LocalNewsResponse, LocalNewsSummary } from "@/types/news";

// GNews API (primary)
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

// NewsAPI (fallback)
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// API endpoints
const GNEWS_API_URL = "https://gnews.io/api/v4/search";
const NEWS_API_EVERYTHING_URL = "https://newsapi.org/v2/everything";

// Article scaling + fallback tuning
const MINIMUM_ARTICLES = 3;
const IDEAL_ARTICLES = 6;
const MAX_ARTICLES = 8;
const FALLBACK_RADIUS_MILES = 100;
const FALLBACK_MIN_POPULATION = 50000;

// Filter out only severe negative content
const NEGATIVE_KEYWORDS = [
  "murder",
  "killed in",
  "fatal shooting",
  "mass shooting",
  "terrorism",
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
  "local",
  "area",
  "district",
];

type RawNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

// GNews API article format
type GNewsArticle = {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
};

function toLocalNewsArticle(
  article: RawNewsArticle,
  fallbackSource?: string
): LocalNewsArticle {
  return {
    title: article.title,
    source: article.source.name,
    publishedAt: article.publishedAt,
    url: article.url,
    description: article.description,
    urlToImage: article.urlToImage,
    _fallbackSource: fallbackSource,
  };
}

function isGeographicallyRelevant(
  article: RawNewsArticle,
  cityName: string,
  state?: string
): boolean {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const cityLower = cityName.toLowerCase();
  const stateLower = state?.toLowerCase();
  const sourceName = article.source.name.toLowerCase();

  // Must mention the city somewhere
  if (!text.includes(cityLower)) {
    return false;
  }

  // If we have a state, articles mentioning both city and state are highly relevant
  if (stateLower && text.includes(stateLower)) {
    return true;
  }

  // Check for state abbreviation (e.g., "TX", "CA")
  const stateAbbreviations: Record<string, string> = {
    tx: "texas", ca: "california", ny: "new york", fl: "florida",
    il: "illinois", pa: "pennsylvania", oh: "ohio", ga: "georgia",
    nc: "north carolina", mi: "michigan", nj: "new jersey", va: "virginia",
    wa: "washington", az: "arizona", ma: "massachusetts", tn: "tennessee",
    in: "indiana", mo: "missouri", md: "maryland", wi: "wisconsin",
    co: "colorado", mn: "minnesota", sc: "south carolina", al: "alabama",
    la: "louisiana", ky: "kentucky", or: "oregon", ok: "oklahoma",
    ct: "connecticut", ut: "utah", ia: "iowa", nv: "nevada",
    ar: "arkansas", ms: "mississippi", ks: "kansas", nm: "new mexico",
  };

  if (stateLower && stateAbbreviations[stateLower]) {
    // Check for patterns like "Austin, TX" or "Austin TX" or "Austin, Texas"
    const statePattern = new RegExp(`${cityLower}[,\\s]+${stateLower}\\b`, 'i');
    if (statePattern.test(text)) {
      return true;
    }
  }

  // Check for local news source names
  const localSourcePatterns = [
    cityLower,
    stateLower || "",
    "local",
    "chronicle",
    "tribune",
    "times",
    "journal",
    "post",
    "news",
    "observer",
  ].filter(Boolean);

  const hasLocalSource = localSourcePatterns.some((pattern) =>
    sourceName.includes(pattern as string)
  );

  if (hasLocalSource && text.includes(cityLower)) {
    return true;
  }

  // For cities with common names (Austin, Portland, etc.), be more lenient
  // Accept if article mentions the city and doesn't mention other major cities prominently
  const otherMajorCities = [
    "new york city",
    "los angeles",
    "chicago",
    "houston",
    "phoenix",
    "philadelphia",
    "san antonio",
    "san diego",
    "san jose",
    "san francisco",
    "seattle",
    "boston",
    "miami",
    "atlanta",
    "denver",
    "las vegas",
    "detroit",
    "nashville",
    "baltimore",
    "washington dc",
    "washington d.c.",
  ].filter((city) => !city.includes(cityLower));

  // Only filter if ANOTHER major city is prominently mentioned in the title
  const titleLower = article.title.toLowerCase();
  const mentionsOtherCityInTitle = otherMajorCities.some((city) =>
    titleLower.includes(city)
  );

  if (mentionsOtherCityInTitle) {
    return false;
  }

  // Accept if the article mentions the city - the API query already filters by city
  return true;
}

function scoreArticle(
  article: RawNewsArticle,
  cityName: string,
  state?: string
): {
  score: number;
  isValid: boolean;
} {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const cityLower = cityName.toLowerCase();
  const stateLower = state?.toLowerCase();

  // Check geographic relevance first
  if (!isGeographicallyRelevant(article, cityName, state)) {
    return { score: 0, isValid: false };
  }

  // Filter out severe negative content
  const isPositive = !NEGATIVE_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  // Filter out non-local sports
  const isNonLocalSports = NON_LOCAL_SPORTS_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  if (!isPositive || isNonLocalSports) {
    return { score: 0, isValid: false };
  }

  // Calculate score
  let score = 5; // Base score

  // Bonus for city + state mention
  if (stateLower && text.includes(cityLower) && text.includes(stateLower)) {
    score += 15;
  }

  // Bonus for local topic keywords
  const localTopicCount = LOCAL_TOPIC_KEYWORDS.filter((keyword) =>
    text.includes(keyword)
  ).length;
  score += localTopicCount * 3;

  // Bonus for local news sources
  if (article.source.name.toLowerCase().includes(cityLower)) {
    score += 10;
  }

  return {
    score,
    isValid: true,
  };
}

// Map state abbreviations to full names for better search
const STATE_FULL_NAMES: Record<string, string> = {
  tx: "Texas", ca: "California", ny: "New York", fl: "Florida",
  il: "Illinois", pa: "Pennsylvania", oh: "Ohio", ga: "Georgia",
  nc: "North Carolina", mi: "Michigan", nj: "New Jersey", va: "Virginia",
  wa: "Washington", az: "Arizona", ma: "Massachusetts", tn: "Tennessee",
  in: "Indiana", mo: "Missouri", md: "Maryland", wi: "Wisconsin",
  co: "Colorado", mn: "Minnesota", sc: "South Carolina", al: "Alabama",
  la: "Louisiana", ky: "Kentucky", or: "Oregon", ok: "Oklahoma",
  ct: "Connecticut", ut: "Utah", ia: "Iowa", nv: "Nevada",
  ar: "Arkansas", ms: "Mississippi", ks: "Kansas", nm: "New Mexico",
};

/**
 * Parsed result from a comma-separated city string
 */
export type ParsedCityString = {
  cityName: string;
  region?: string;
  country?: string;
};

/**
 * Parse a comma-separated city string into its components.
 * Handles formats like:
 *   - "Austin, TX, US" -> { cityName: "Austin", region: "TX", country: "US" }
 *   - "Austin, Texas, US" -> { cityName: "Austin", region: "Texas", country: "US" }
 *   - "Austin, TX" -> { cityName: "Austin", region: "TX" }
 *   - "Austin" -> { cityName: "Austin" }
 */
export function parseCityString(cityString: string): ParsedCityString {
  const parts = cityString.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { cityName: cityString.trim() || "" };
  }

  if (parts.length === 1) {
    return { cityName: parts[0] };
  }

  if (parts.length === 2) {
    return { cityName: parts[0], region: parts[1] };
  }

  // 3+ parts: first is city, second is region, third is country
  return {
    cityName: parts[0],
    region: parts[1],
    country: parts[2],
  };
}

// Map full state names to abbreviations (reverse of STATE_FULL_NAMES)
const STATE_ABBREVS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FULL_NAMES).map(([abbrev, full]) => [full.toLowerCase(), abbrev.toUpperCase()])
);

// In-memory cache for news results
const newsCache = new Map<string, { data: RawNewsArticle[]; provider: "gnews" | "newsapi" | null; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch news from GNews API (primary)
 */
async function fetchFromGNewsAPI(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!GNEWS_API_KEY) {
    return [];
  }

  // Build search query - city name with state for better locality
  let query = cityName;
  if (state) {
    const stateLower = state.toLowerCase();
    const stateFull = STATE_FULL_NAMES[stateLower] || state;
    query = `${cityName} ${stateFull}`;
  }

  const params = new URLSearchParams({
    q: query,
    token: GNEWS_API_KEY,
    lang: "en",
    country: "us",
    max: "10",
    sortby: "publishedAt",
  });

  try {
    const response = await fetch(`${GNEWS_API_URL}?${params}`, {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GNews API error:", response.status, errorData);
      return [];
    }

    const data = await response.json();

    // Transform GNews API response to our format
    const articles: RawNewsArticle[] = (data.articles || [])
      .filter(
        (article: GNewsArticle) =>
          article.title &&
          article.title !== "[Removed]" &&
          article.description
      )
      .map((article: GNewsArticle) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publishedAt,
        source: { name: article.source?.name || "Unknown" },
      }));

    // Filter, score, and sort articles
    const validArticles = articles
      .map((article: RawNewsArticle) => ({
        article,
        ...scoreArticle(article, cityName, state),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((item: { article: RawNewsArticle }) => item.article);

    return validArticles;
  } catch (error) {
    console.error("Error fetching from GNews API:", error);
    return [];
  }
}

/**
 * Fetch news from NewsAPI (fallback)
 */
async function fetchFromNewsAPI(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!NEWS_API_KEY) {
    return [];
  }

  // Build search query - use city name with OR for state variations
  let stateFull: string | undefined;
  let stateAbbrev: string | undefined;

  if (state) {
    const stateLower = state.toLowerCase();
    if (STATE_FULL_NAMES[stateLower]) {
      stateFull = STATE_FULL_NAMES[stateLower];
      stateAbbrev = state.toUpperCase();
    } else if (STATE_ABBREVS[stateLower]) {
      stateAbbrev = STATE_ABBREVS[stateLower];
      stateFull = state;
    } else {
      stateFull = state;
      stateAbbrev = state;
    }
  }

  let searchQuery = `"${cityName}"`;
  if (stateFull && stateAbbrev) {
    searchQuery = `"${cityName}" AND (${stateFull} OR ${stateAbbrev})`;
  } else if (stateFull) {
    searchQuery = `"${cityName}" AND ${stateFull}`;
  }

  const params = new URLSearchParams({
    q: searchQuery,
    apiKey: NEWS_API_KEY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "100",
  });

  try {
    const response = await fetch(`${NEWS_API_EVERYTHING_URL}?${params}`, {
      headers: {
        "User-Agent": "CommunityPulse/1.0",
      },
      next: { revalidate: 300 },
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
        ...scoreArticle(article, cityName, state),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((item: { article: RawNewsArticle }) => item.article);

    return validArticles;
  } catch (error) {
    console.error("Error fetching from NewsAPI:", error);
    return [];
  }
}

/**
 * Fetch news using available API (prefers GNews, falls back to NewsAPI)
 */
async function fetchNewsForCity(
  cityName: string,
  state?: string
): Promise<{ articles: RawNewsArticle[]; provider: "gnews" | "newsapi" | null }> {
  // Check cache first
  const cacheKey = `${cityName}-${state || ""}`.toLowerCase();
  const cached = newsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return { articles: cached.data, provider: cached.provider };
  }

  // Try GNews API first (primary)
  if (GNEWS_API_KEY) {
    const articles = await fetchFromGNewsAPI(cityName, state);
    if (articles.length > 0) {
      newsCache.set(cacheKey, { data: articles, provider: "gnews", timestamp: Date.now() });
      return { articles, provider: "gnews" };
    }
  }

  // Fall back to NewsAPI
  if (NEWS_API_KEY) {
    const articles = await fetchFromNewsAPI(cityName, state);
    if (articles.length > 0) {
      newsCache.set(cacheKey, { data: articles, provider: "newsapi", timestamp: Date.now() });
      return { articles, provider: "newsapi" };
    }
  }

  return { articles: [], provider: null };
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

  // Check if any news API is configured
  if (!NEWS_API_KEY && !GNEWS_API_KEY) {
    const response: LocalNewsResponse = {
      articles: [],
      aiSummary: null,
      city: cityParam,
      sourceCity: cityParam,
      fallbackSources: [],
      isNearbyFallback: false,
      fetchedAt: new Date().toISOString(),
      notConfigured: true,
    };
    return NextResponse.json(response);
  }

  // Parse the city string to extract components
  const parsed = parseCityString(cityParam);

  // Try to find the city in our database
  const city = findCity(parsed.cityName) || findCity(cityParam);

  // Use city database values if found, otherwise fall back to parsed values
  const cityName = city?.name || parsed.cityName;
  const state = city?.state || parsed.region;

  // Fetch news
  const primary = await fetchNewsForCity(cityName, state);
  let provider = primary.provider;
  let articles: LocalNewsArticle[] = primary.articles.map((a) => toLocalNewsArticle(a));
  const sourceCity = city?.displayName || cityParam;
  const fallbackSources: string[] = [];

  // Aggressive nearby-city scaling when content is sparse
  if (articles.length < MINIMUM_ARTICLES && city) {
    const nearbyCities = getNearbyCities(
      cityParam,
      FALLBACK_RADIUS_MILES,
      FALLBACK_MIN_POPULATION
    );

    const existingUrls = new Set(articles.map((a) => a.url));

    for (const nearbyCity of nearbyCities) {
      if (articles.length >= IDEAL_ARTICLES) break;

      const nearby = await fetchNewsForCity(nearbyCity.name, nearbyCity.state);

      if (!provider && nearby.provider) {
        provider = nearby.provider;
      }

      const newArticles = nearby.articles
        .filter((a) => !existingUrls.has(a.url))
        .map((a) => toLocalNewsArticle(a, nearbyCity.displayName));

      if (newArticles.length > 0) {
        for (const a of newArticles) existingUrls.add(a.url);
        articles = [...articles, ...newArticles];
        fallbackSources.push(nearbyCity.displayName);
      }
    }
  }

  // Deduplicate articles BEFORE slicing to final count
  // This removes duplicate AP wire stories that appear from multiple sources
  const dedupeResult = deduplicateArticles(articles, false);
  articles = dedupeResult.articles;
  const duplicatesRemoved = dedupeResult.duplicatesRemoved;
  if (duplicatesRemoved > 0) {
    console.log("[NEWS] Removed " + duplicatesRemoved + " duplicate article(s) for " + cityParam);
  }

  // Limit to MAX articles
  articles = articles.slice(0, MAX_ARTICLES);

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
    }
  }

  const response: LocalNewsResponse = {
    articles,
    aiSummary,
    city: city?.displayName || cityParam,
    sourceCity,
    fallbackSources: Array.from(new Set(fallbackSources)),
    isNearbyFallback: fallbackSources.length > 0 && articles.length > 0,
    fetchedAt: new Date().toISOString(),
    provider: provider || undefined,
    _duplicatesRemoved: duplicatesRemoved > 0 ? duplicatesRemoved : undefined,
  };

  return NextResponse.json(response);
}
