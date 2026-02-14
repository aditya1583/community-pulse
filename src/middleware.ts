import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-identifier",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
  // Handle CORS preflight for Capacitor iOS app
  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Add CORS headers to all API responses (not just preflight)
  // Without this, WKWebView blocks the actual response even though preflight passed
  const response = NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
