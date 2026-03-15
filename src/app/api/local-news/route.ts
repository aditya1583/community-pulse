import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

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

  // Find all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
    const block = match[1];

    const rawTitle = extractTagContent(block, "title");
    const title = stripHTML(decodeHTMLEntities(extractCDATAOrText(rawTitle)));

    // Google News RSS wraps the real link in <link> after a comment — extract raw link
    const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(block) ??
      /<link\s*\/>/i.exec(block);
    let link = "";
    if (linkMatch) {
      link = extractCDATAOrText(linkMatch[1] ?? "").trim();
    }
    // Fallback: guid
    if (!link) {
      const guidRaw = extractTagContent(block, "guid");
      link = extractCDATAOrText(guidRaw).trim();
    }

    const pubDateRaw = extractTagContent(block, "pubDate");
    const pubDate = pubDateRaw.trim();

    // Source name — Google RSS uses <source url="...">Source Name</source>
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") ?? "";
  const state = searchParams.get("state") ?? "";

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=14400",
  };

  if (!city.trim()) {
    return NextResponse.json([], { headers: cacheHeaders });
  }

  const query = [city, state].filter(Boolean).join(" ");
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Voxlo/1.0; +https://voxlo.app)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) {
      return NextResponse.json([], { headers: cacheHeaders });
    }

    const xml = await res.text();
    const items = parseNewsItems(xml);

    return NextResponse.json(items, { headers: cacheHeaders });
  } catch {
    return NextResponse.json([], { headers: cacheHeaders });
  }
}
