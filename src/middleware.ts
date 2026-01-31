import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Handle CORS preflight for Capacitor iOS app
  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
