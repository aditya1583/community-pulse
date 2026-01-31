/**
 * API route for generating venue QR codes
 *
 * Generates a QR code that links to the venue detail page.
 * Uses goqr.me API (free, no API key required).
 *
 * For partner venues, also tracks QR scans.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://communitypulse.app";

/**
 * GET /api/qr-code
 *
 * Generate a QR code for a venue.
 *
 * Query params:
 * - venue: Venue name or slug
 * - size: QR code size in pixels (default: 300)
 * - format: "png" | "svg" (default: "png")
 *
 * Returns:
 * - qr_url: URL to the QR code image
 * - venue_url: URL the QR code links to
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const venue = searchParams.get("venue");
  const size = parseInt(searchParams.get("size") || "300");
  const format = searchParams.get("format") || "png";

  if (!venue) {
    return NextResponse.json(
      { error: "venue parameter is required" },
      { status: 400 }
    );
  }

  // Validate size
  const validSize = Math.min(Math.max(size, 100), 1000);

  // Create URL-friendly slug
  const slug = venue
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // The URL the QR code will link to
  const venueUrl = `${APP_BASE_URL}/venue/${slug}`;

  // Generate QR code using goqr.me API (free, no key needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${validSize}x${validSize}&data=${encodeURIComponent(venueUrl)}&format=${format}&margin=10`;

  return NextResponse.json({
    venue_name: venue,
    venue_slug: slug,
    venue_url: venueUrl,
    qr_url: qrUrl,
    size: validSize,
    format,
  });
}

/**
 * POST /api/qr-code
 *
 * Generate a printable QR code card for a partner venue.
 * Returns HTML that can be printed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { venue_name, venue_slug, tagline } = body;

    if (!venue_name) {
      return NextResponse.json(
        { error: "venue_name is required" },
        { status: 400 }
      );
    }

    // Create slug if not provided
    const slug = venue_slug || venue_name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    const venueUrl = `${APP_BASE_URL}/venue/${slug}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(venueUrl)}&format=png&margin=10`;

    // Generate printable HTML card
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Code - ${venue_name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f5f5;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      max-width: 320px;
      width: 100%;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 8px;
    }
    .tagline {
      font-size: 18px;
      color: #334155;
      margin-bottom: 24px;
      font-weight: 500;
    }
    .qr-container {
      background: white;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 20px;
    }
    .qr-container img {
      display: block;
    }
    .cta {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .venue-name {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .branding {
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body {
        background: white;
      }
      .card {
        box-shadow: none;
        border: 1px solid #e2e8f0;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Voxlo</div>
    <div class="tagline">${tagline || "How's the vibe today?"}</div>
    <div class="qr-container">
      <img src="${qrUrl}" alt="QR Code" width="200" height="200">
    </div>
    <div class="cta">Scan to check in & share the vibe</div>
    <div class="venue-name">${venue_name}</div>
    <div class="branding">voxlo.app</div>
  </div>
</body>
</html>
    `.trim();

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (err) {
    console.error("[qr-code] Error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
