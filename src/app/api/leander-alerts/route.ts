import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const ALERT_RSS_URL = "https://www.leandertx.gov/Rss.aspx";

interface AlertItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
}

export async function GET() {
  try {
    const res = await fetch(ALERT_RSS_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Voxlo/1.0 (community feed aggregator)" },
    });

    if (!res.ok) {
      // Leander alert feed returns empty when no active alerts — that's OK
      return NextResponse.json(
        { items: [], count: 0, source: "City of Leander Alerts", updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    const xml = await res.text();
    const items = parseRSSItems(xml).slice(0, 20);

    return NextResponse.json(
      { items, count: items.length, source: "City of Leander Alerts", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("[Leander Alerts] RSS fetch error:", err);
    // Fail gracefully — alerts feed being down shouldn't break the app
    return NextResponse.json(
      { items: [], count: 0, source: "City of Leander Alerts", error: "temporarily unavailable" },
      { status: 200 }
    );
  }
}

function parseRSSItems(xml: string): AlertItem[] {
  const items: AlertItem[] = [];
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
