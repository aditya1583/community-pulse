/**
 * GET /api/health
 *
 * Health check endpoint for monitoring systems.
 * Returns status of critical dependencies:
 * - Database connectivity (Supabase)
 * - AI moderation service availability
 *
 * Use this endpoint for:
 * - Load balancer health checks
 * - Uptime monitoring (Pingdom, UptimeRobot, etc.)
 * - Kubernetes/Docker health probes
 * - Deployment verification
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Timeout for dependency checks (ms)
const CHECK_TIMEOUT = 5000;

type HealthStatus = "healthy" | "degraded" | "unhealthy";

type DependencyCheck = {
  status: HealthStatus;
  latency_ms?: number;
  error?: string;
};

type HealthResponse = {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime_seconds: number;
  dependencies: {
    database: DependencyCheck;
    moderation: DependencyCheck;
  };
  environment: string;
};

// Track server start time
const serverStartTime = Date.now();

/**
 * Check Supabase database connectivity
 */
async function checkDatabase(): Promise<DependencyCheck> {
  const start = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: "unhealthy",
        error: "Missing Supabase configuration",
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to verify connectivity
    const { error } = await Promise.race([
      supabase.from("pulses").select("id").limit(1),
      new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject({ error: new Error("Timeout") }), CHECK_TIMEOUT)
      ),
    ]);

    const latency = Date.now() - start;

    if (error) {
      return {
        status: "unhealthy",
        latency_ms: latency,
        error: error.message,
      };
    }

    return {
      status: latency > 2000 ? "degraded" : "healthy",
      latency_ms: latency,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check AI moderation service availability
 */
async function checkModeration(): Promise<DependencyCheck> {
  const start = Date.now();

  try {
    // Check for required API keys
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (!hasAnthropic && !hasOpenAI) {
      return {
        status: "unhealthy",
        error: "No moderation API keys configured",
      };
    }

    // We don't actually call the API to avoid costs
    // Just verify configuration is in place
    const latency = Date.now() - start;

    return {
      status: "healthy",
      latency_ms: latency,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Determine overall health status
 */
function getOverallStatus(
  database: DependencyCheck,
  moderation: DependencyCheck
): HealthStatus {
  // If any critical service is unhealthy, overall is unhealthy
  if (database.status === "unhealthy" || moderation.status === "unhealthy") {
    return "unhealthy";
  }

  // If any service is degraded, overall is degraded
  if (database.status === "degraded" || moderation.status === "degraded") {
    return "degraded";
  }

  return "healthy";
}

export async function GET() {
  const [database, moderation] = await Promise.all([
    checkDatabase(),
    checkModeration(),
  ]);

  const status = getOverallStatus(database, moderation);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
    dependencies: {
      database,
      moderation,
    },
    environment: process.env.NODE_ENV || "development",
  };

  // Return appropriate HTTP status code
  const httpStatus = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
