import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const ISD_RSS_URL = "https://www.leanderisd.org/feed/";

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
}

export async function GET() {
  try {
    const res = await fetch(ISD_RSS_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Voxlo/1.0 (community feed aggregator)" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `RSS fetch failed: ${res.status}` }, { status: 502 });
    }

    const xml = await res.text();
    const items = parseRSSItems(xml).slice(0, 10);

    return NextResponse.json(
      { items, count: items.length, source: "Leander ISD", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    console.error("[Leander ISD] RSS fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch school updates" }, { status: 500 });
  }
}

function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const description = stripHtml(extractTag(itemXml, "description"));
    const pubDate = extractTag(itemXml, "pubDate");
    const category = extractTag(itemXml, "category");

    if (title) {
      items.push({ title, link, description, pubDate, category: category || undefined });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
}
