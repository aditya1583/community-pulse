import { NextRequest, NextResponse } from "next/server";
import { findCity, getNearbyCities, City } from "../../data/cities"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { generateNewsSummary, NewsArticleSummaryInput } from "@/lib/ai";

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_EVERYTHING_URL = "https://newsapi.org/v2/everything";
const NEWS_API_TOP_HEADLINES_URL = "https://newsapi.org/v2/top-headlines";

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
/**
 * Article with optional fallback source metadata
 */
export type LocalNewsArticleWithFallback = LocalNewsArticle & {
  _fallbackSource?: string;
};

/**
 * Full response from the local-news API
 */
export type LocalNewsResponse = {
  articles: LocalNewsArticleWithFallback[];
  aiSummary: LocalNewsSummary | null;
  city: string;
  sourceCity: string;
  isNearbyFallback: boolean;
  fallbackSources: string[];
  fetchedAt: string;
  notConfigured?: boolean;
};

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

  // Accept if the article mentions the city - the NewsAPI query already filters by city
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

async function fetchNewsForCity(
  cityName: string,
  state?: string
): Promise<RawNewsArticle[]> {
  if (!NEWS_API_KEY) {
    console.error("NEWS_API_KEY not configured");
    return [];
  }

  // Build search query - use city name with OR for state variations
  // This helps get more results for cities with common names
  let stateFull: string | undefined;
  let stateAbbrev: string | undefined;

  if (state) {
    const stateLower = state.toLowerCase();
    // Check if state is an abbreviation (e.g., "TX")
    if (STATE_FULL_NAMES[stateLower]) {
      stateFull = STATE_FULL_NAMES[stateLower];
      stateAbbrev = state.toUpperCase();
    } else if (STATE_ABBREVS[stateLower]) {
      // State is a full name (e.g., "Texas")
      stateAbbrev = STATE_ABBREVS[stateLower];
      stateFull = state;
    } else {
      // Unknown state format - use as-is
      stateFull = state;
      stateAbbrev = state;
    }
  }

  let searchQuery = `"${cityName}"`;
  if (stateFull && stateAbbrev) {
    // Search for "Austin" AND (Texas OR TX) to get local news
    searchQuery = `"${cityName}" AND (${stateFull} OR ${stateAbbrev})`;
  } else if (stateFull) {
    searchQuery = `"${cityName}" AND ${stateFull}`;
  }

  const params = new URLSearchParams({
    q: searchQuery,
    apiKey: NEWS_API_KEY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "100", // Fetch more since we'll filter aggressively
  });

  try {
    const response = await fetch(`${NEWS_API_EVERYTHING_URL}?${params}`, {
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
        ...scoreArticle(article, cityName, state),
      }))
      .filter((item: { isValid: boolean }) => item.isValid)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
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
    const response: LocalNewsResponse = {
      articles: [],
      aiSummary: null,
      city: cityParam,
      sourceCity: cityParam,
      isNearbyFallback: false,
      fallbackSources: [],
      fetchedAt: new Date().toISOString(),
      notConfigured: true,
    };
    return NextResponse.json(response);
  }

  // Parse the city string to extract components (handles "Austin, TX, US" format)
  const parsed = parseCityString(cityParam);

  // Try to find the city in our database using just the city name
  const city = findCity(parsed.cityName) || findCity(cityParam);

  // Use city database values if found, otherwise fall back to parsed values
  const cityName = city?.name || parsed.cityName;
  // Use parsed region if city not found in database (supports both abbrev and full state names)
  const state = city?.state || parsed.region;

  // Track articles with their source city for fallback attribution
  type ArticleWithSource = RawNewsArticle & { _sourceCity?: string };

  // First, try to fetch news for the requested city
  let rawArticles: ArticleWithSource[] = await fetchNewsForCity(cityName, state);
  const fallbackSourcesSet = new Set<string>();
  let isNearbyFallback = false;

  // MINIMUM 3 ARTICLES: If we don't have enough articles, try nearby cities more aggressively
  // Increased radius to 100 miles and lowered population threshold to 50k
  const FALLBACK_RADIUS_MILES = 100;
  const FALLBACK_MIN_POPULATION = 50000;
  const MIN_ARTICLES_TARGET = 3;

  if (rawArticles.length < MIN_ARTICLES_TARGET && city) {
    const nearbyCities = getNearbyCities(cityParam, FALLBACK_RADIUS_MILES, FALLBACK_MIN_POPULATION);

    for (const nearbyCity of nearbyCities) {
      // Stop when we have enough articles
      if (rawArticles.length >= MIN_ARTICLES_TARGET + 2) break; // Target 5 for buffer

      const nearbyArticles = await fetchNewsForCity(
        nearbyCity.name,
        nearbyCity.state
      );

      if (nearbyArticles.length > 0) {
        // Add nearby city articles, avoiding duplicates
        const existingUrls = new Set(rawArticles.map((a) => a.url));
        const newArticles = nearbyArticles
          .filter((a) => !existingUrls.has(a.url))
          .map((a) => ({
            ...a,
            _sourceCity: nearbyCity.displayName, // Tag with source city
          }));

        if (newArticles.length > 0) {
          rawArticles = [...rawArticles, ...newArticles];
          fallbackSourcesSet.add(nearbyCity.displayName);
          isNearbyFallback = true;
        }
      }
    }
  }

  // Limit to 8 articles max for display
  rawArticles = rawArticles.slice(0, 8);

  // Transform to our response format with fallback source tracking
  const articles: LocalNewsArticleWithFallback[] = rawArticles.map((article) => ({
    title: article.title,
    source: article.source.name,
    publishedAt: article.publishedAt,
    url: article.url,
    description: article.description,
    urlToImage: article.urlToImage,
    // Include fallback source if article came from a nearby city
    ...(article._sourceCity ? { _fallbackSource: article._sourceCity } : {}),
  }));

  // Convert fallback sources set to array
  const fallbackSources = Array.from(fallbackSourcesSet);

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
    sourceCity: city?.displayName || cityParam,
    isNearbyFallback: isNearbyFallback && fallbackSources.length > 0,
    fallbackSources,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
