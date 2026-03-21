import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

// ============================================================================
// Curated RSS feeds per known metro (lowercase keys)
// ============================================================================

const CURATED_FEEDS: Record<string, string[]> = {
  leander: [
    "https://www.communityimpact.com/austin/leander-cedar-park/feed/",
    "https://kvue.com/feeds/rss/news/local",
    "https://www.kxan.com/news/local/williamson-county/feed/",
  ],
  "cedar park": [
    "https://www.communityimpact.com/austin/leander-cedar-park/feed/",
    "https://kvue.com/feeds/rss/news/local",
  ],
  austin: [
    "https://www.kvue.com/feeds/rss/news/local",
    "https://www.kxan.com/news/local/austin/feed/",
    "https://communityimpact.com/austin/feed/",
  ],
  "round rock": [
    "https://www.communityimpact.com/austin/round-rock-pflugerville-hutto/feed/",
    "https://kvue.com/feeds/rss/news/local",
  ],
};

// County mapping for relevance scoring
const CITY_COUNTY: Record<string, string> = {
  leander: "Williamson",
  "cedar park": "Williamson",
  "round rock": "Williamson",
  austin: "Travis",
};

// Blacklisted sources (score -10)
const BLACKLISTED_SOURCES = [
  "legacy.com",
  "dignitymemorial",
  "obituaries",
  "funeral",
  "floridatoday",
];

// Blacklisted title keywords (score -5)
const BLACKLISTED_TITLE_TERMS = [
  "obituary",
  "obituaries",
  "in memoriam",
  "passed away",
  "memorial service",
];

// ============================================================================
// HTML / XML helpers (kept from original)
// ============================================================================

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCharCode(parseInt(dec, 10))
    );
}

function stripHTML(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function extractTagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = re.exec(xml);
  return match ? match[1].trim() : "";
}

function extractCDATAOrText(raw: string): string {
  const cdataMatch = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw.trim());
  if (cdataMatch) return cdataMatch[1].trim();
  return stripHTML(decodeHTMLEntities(raw));
}

function parseNewsItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
    const block = match[1];

    const rawTitle = extractTagContent(block, "title");
    const title = stripHTML(decodeHTMLEntities(extractCDATAOrText(rawTitle)));

    const linkMatch =
      /<link>([\s\S]*?)<\/link>/i.exec(block) ??
      /<link\s*\/>/i.exec(block);
    let link = "";
    if (linkMatch) {
      link = extractCDATAOrText(linkMatch[1] ?? "").trim();
    }
    if (!link) {
      const guidRaw = extractTagContent(block, "guid");
      link = extractCDATAOrText(guidRaw).trim();
    }

    const pubDateRaw = extractTagContent(block, "pubDate");
    const pubDate = pubDateRaw.trim();

    const sourceRaw = extractTagContent(block, "source");
    const source = sourceRaw
      ? stripHTML(decodeHTMLEntities(extractCDATAOrText(sourceRaw)))
      : "";

    if (title && link) {
      items.push({ title, link, source, pubDate });
    }
  }

  return items;
}

// ============================================================================
// Relevance scoring
// ============================================================================

interface ScoredItem extends NewsItem {
  score: number;
}

function scoreItem(item: NewsItem, cityLower: string, countyName: string, stateName?: string): number {
  let score = 0;
  const titleLower = item.title.toLowerCase();
  const sourceLower = (item.source ?? "").toLowerCase();

  // Positive signals
  if (titleLower.includes(cityLower)) score += 3;
  if (countyName && titleLower.includes(countyName.toLowerCase())) score += 2;
  if (titleLower.includes("texas") || titleLower.includes(" tx ") || titleLower.endsWith(" tx")) score += 1;
  if (stateName && stateName.length > 0 && titleLower.includes(stateName.toLowerCase())) score += 1;

  // Source blacklist (-10)
  for (const blocked of BLACKLISTED_SOURCES) {
    if (sourceLower.includes(blocked)) {
      score -= 10;
      break;
    }
  }

  // Title blacklist (-5)
  for (const term of BLACKLISTED_TITLE_TERMS) {
    if (titleLower.includes(term)) {
      score -= 5;
      break;
    }
  }

  // Name-only title detection (likely obituary)
  // Pattern: 2-4 words, all capitalized, no common news verbs/nouns
  const words = item.title.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    const allCapitalized = words.every((w) => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]\.$/.test(w));
    const noNewsWords = !titleLower.match(
      /\b(police|fire|school|city|council|vote|crash|arrest|open|close|win|lose|game|new|plan|build|road|water|tax|budget|storm|flood|election|update|report|crime|traffic|weather|park|library|hospital|downtown|office|business|store)\b/
    );
    if (allCapitalized && noNewsWords) {
      score -= 8; // Almost certainly an obituary or person profile
    }
  }

  return score;
}

// ============================================================================
// NewsData.io API
// ============================================================================

interface NewsDataArticle {
  title: string | null;
  link: string | null;
  source_id: string | null;
  pubDate: string | null;
}

interface NewsDataResponse {
  results?: NewsDataArticle[];
}

async function fetchNewsDataIO(city: string, apiKey: string): Promise<NewsItem[]> {
  const url = `https://newsdata.io/api/1/news?apikey=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}&country=us&language=en&category=top`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as NewsDataResponse;
    const results = data.results ?? [];

    return results
      .filter((a): a is NewsDataArticle & { title: string; link: string } =>
        typeof a.title === "string" && typeof a.link === "string"
      )
      .map((a) => ({
        title: a.title,
        link: a.link,
        source: a.source_id ?? "",
        pubDate: a.pubDate ?? "",
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// Google News RSS fallback
// ============================================================================

async function fetchGoogleNewsRSS(city: string, state: string): Promise<NewsItem[]> {
  const query = state.trim() ? `${city} ${state}` : city;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Voxlo/1.0; +https://voxlo.app)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const xml = await res.text();
    return xml ? parseNewsItems(xml) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Route handler
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") ?? "";
  const state = searchParams.get("state") ?? "";

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
  };

  if (!city.trim()) {
    return NextResponse.json([], { headers: cacheHeaders });
  }

  const cityLower = city.trim().toLowerCase();
  const countyName = CITY_COUNTY[cityLower] ?? "";

  // 1. Curated RSS feeds (parallel)
  const curatedUrls = CURATED_FEEDS[cityLower] ?? [];
  const rssResults = await Promise.allSettled(
    curatedUrls.map((url) =>
      fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Voxlo/1.0; +https://voxlo.app)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      })
        .then((r) => (r.ok ? r.text() : ""))
        .then((xml) => (xml ? parseNewsItems(xml) : []))
        .catch(() => [] as NewsItem[])
    )
  );

  const rssItems: NewsItem[] = rssResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  // 2. Google News RSS (primary, free, no key) + NewsData.io (fallback)
  const googleItems = await fetchGoogleNewsRSS(city.trim(), state.trim());

  // Only hit NewsData.io if Google News returned fewer than 3 items
  let apiItems: NewsItem[] = [];
  if (googleItems.length < 3) {
    const newsDataKey = process.env.NEWSDATA_API_KEY ?? "";
    if (newsDataKey) {
      apiItems = await fetchNewsDataIO(city.trim(), newsDataKey);
    }
  }

  // 3. Merge + deduplicate by exact title (priority: curated RSS → Google News → NewsData.io)
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of [...rssItems, ...googleItems, ...apiItems]) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      merged.push(item);
    }
  }

  // 4. Score, filter, sort
  const stateLower = state.trim().toLowerCase();
  const scored: ScoredItem[] = merged.map((item) => ({
    ...item,
    score: scoreItem(item, cityLower, countyName, stateLower || undefined),
  }));

  const filtered = scored.filter((item) => item.score > -4);

  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Secondary: pubDate desc
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return dateB - dateA;
  });

  // 5. Return top 10 (strip score field)
  const top10: NewsItem[] = filtered.slice(0, 10).map(({ score: _score, ...item }) => item);

  return NextResponse.json(top10, { headers: cacheHeaders });
}
