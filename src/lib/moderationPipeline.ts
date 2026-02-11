/**
 * Unified Moderation Pipeline
 *
 * This module orchestrates the two-layer moderation architecture:
 *
 * Layer A (Fast, Local):
 * 1. Dynamic blocklist - catches known problematic terms
 * 2. Local heuristics - catches obvious English profanity/obfuscations
 *
 * Layer B (Authoritative, AI):
 * 3. Claude Haiku - catches multilingual, context, obfuscation, typos
 * 4. Google Perspective API (optional) - supplementary toxicity signal
 *
 * The pipeline runs in order and short-circuits on any block decision.
 * All layers produce consistent user-facing error messages.
 *
 * Telemetry:
 * - Logs moderation path taken (blocklist/local/AI/perspective)
 * - Logs allow/deny decision
 * - Logs category if available
 * - Does NOT log user content in production (privacy)
 */

// Phone detection (context-gated)
/*const digits = (input.match(/\d/g) || []).length;

// Expand context triggers safely
const phoneContext =
  /\b(text|call|phone|number|sms|whatsapp|contact|dm|talk)\b/i.test(input) ||
  /\breach\s+me\b/i.test(input) ||
  // Treat "@" as phone context only if it looks like a phone number overall
  (input.includes("@") && digits >= 10);

if (phoneContext && digits >= 10) {
  return {
    blocked: true,
    reason: FRIENDLY_PII_MESSAGE,
    categories: ["phone"],
  };
}

import { describe, it, expect } from "vitest";
import { detectPII } from "../piiDetection"; // adjust path if needed

describe("PII phone context hardening", () => {
  it("blocks phone number when prefixed with @", () => {
    const r = detectPII("for good times let's talk @717 888 8898");
    expect(r.blocked).toBe(true);
  });

  it("does NOT block normal social handle", () => {
    const r = detectPII("IG is @myhandle");
    // (this might be blocked by your social handle rule; if so, change message to "@myhandle is cool")
    // If you already intentionally block IG handles, use a neutral handle example:
    // const r = detectPII("hello @myhandle");
    expect(r.blocked).toBe(false);
  });

  it("does NOT block benign traffic number", () => {
    const r = detectPII("Traffic on 183 is terrible");
    expect(r.blocked).toBe(false);
  });
});
*/
import { serverModerateContent, type ModerationResult } from "./moderation";
import { moderateWithAI, type AIModerationResult } from "./aiModeration";
import { checkBlocklist, type BlocklistResult } from "./blocklist";
import {
  analyzeWithPerspective,
  isPerspectiveEnabled,
  type PerspectiveResult,
} from "./perspectiveModeration";
import { logModerationEvent } from "./moderationLogger";
import crypto from "crypto";

// Friendly message shown to users when content is blocked
const FRIENDLY_MODERATION_MESSAGE =
  "Please keep your message friendly and respectful.";

// Moderation layers for telemetry
export type ModerationLayer =
  | "blocklist"
  | "local"
  | "haiku"
  | "perspective"
  | "none";

export type ModerationCategory =
  | "profanity"
  | "harassment"
  | "hate"
  | "violence"
  | "toxicity"
  | "blocklist"
  | "unknown";

export type PipelineResult = {
  allowed: boolean;
  reason?: string;
  /**
   * Indicates the moderation service encountered an error.
   * When true, the route should return 503 instead of 400.
   * This distinguishes "content was blocked" from "service unavailable".
   */
  serviceError?: boolean;
  /**
   * Internal telemetry data - not exposed to client
   */
  _telemetry?: {
    requestId: string;
    layer: ModerationLayer;
    category?: ModerationCategory;
    durationMs: number;
    contentHash?: string;
  };
};

/**
 * Generate a request ID for telemetry
 */
function generateRequestId(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Hash content for logging (privacy-safe)
 */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Log moderation telemetry
 */
function logTelemetry(
  requestId: string,
  layer: ModerationLayer,
  allowed: boolean,
  category?: ModerationCategory,
  durationMs?: number,
  contentHash?: string
): void {
  const isProduction = process.env.NODE_ENV === "production";

  const logData = {
    requestId,
    layer,
    decision: allowed ? "allow" : "deny",
    category: category || "none",
    durationMs: durationMs || 0,
    // Only include content hash in non-production for debugging
    ...(isProduction ? {} : { contentHash }),
  };

  console.log(`[moderation] ${JSON.stringify(logData)}`);
}

/**
 * Determine category from AI moderation debug info
 *
 * Maps Haiku's category names to our internal ModerationCategory type.
 */
function getCategoryFromAIResult(result: AIModerationResult): ModerationCategory {
  if (!result._debug) return "unknown";

  const { category } = result._debug;

  // Map Haiku categories to our internal categories
  switch (category) {
    case "hate":
      return "hate";
    case "harassment":
      return "harassment";
    case "profanity":
      return "profanity";
    case "sexual_solicitation":
    case "contact_solicitation":
    case "dangerous":
    case "spam":
      // These map to our toxicity/unknown since we don't have exact matches
      return "toxicity";
    default:
      return "unknown";
  }
}

/**
 * Run the full moderation pipeline
 *
 * Order of execution:
 * 1. Dynamic blocklist (cheap, catches known terms)
 * 2. Local heuristics (fast, catches obvious profanity)
 * 3. OpenAI Moderation API (authoritative, catches multilingual/obfuscation)
 * 4. Perspective API (optional, supplementary toxicity signal)
 *
 * @param content - The text content to moderate
 * @param options - Optional metadata for logging (endpoint, userId)
 * @returns PipelineResult with allowed status and telemetry
 */
export async function runModerationPipeline(
  content: string,
  options?: { endpoint?: string; userId?: string }
): Promise<PipelineResult> {
  const requestId = generateRequestId();
  const contentHash = hashContent(content);
  const startTime = Date.now();

  // Helper to fire-and-forget log blocked content
  const logBlock = (layer: string, category: string, confidence?: number) => {
    logModerationEvent({
      content,
      userId: options?.userId,
      category,
      confidenceScore: confidence,
      layer,
      action: "blocked",
      endpoint: options?.endpoint,
    }).catch(() => {});
  };

  // --- LAYER 1: Dynamic Blocklist (cheap first-pass) ---
  try {
    const blocklistResult: BlocklistResult = await checkBlocklist(content);

    if (!blocklistResult.allowed) {
      const durationMs = Date.now() - startTime;
      logTelemetry(requestId, "blocklist", false, "blocklist", durationMs, contentHash);
      logBlock("blocklist", "blocklist");

      return {
        allowed: false,
        reason: blocklistResult.reason || FRIENDLY_MODERATION_MESSAGE,
        _telemetry: {
          requestId,
          layer: "blocklist",
          category: "blocklist",
          durationMs,
          contentHash,
        },
      };
    }
  } catch (error) {
    // Blocklist errors should not block content - log and continue
    console.error(
      "[moderation] Blocklist error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  // --- LAYER 2: Local Heuristics (fast, English profanity) ---
  const localResult: ModerationResult = serverModerateContent(content);

  if (!localResult.allowed) {
    const durationMs = Date.now() - startTime;
    logTelemetry(requestId, "local", false, "profanity", durationMs, contentHash);
    logBlock("local", "profanity");

    return {
      allowed: false,
      reason: localResult.reason || FRIENDLY_MODERATION_MESSAGE,
      _telemetry: {
        requestId,
        layer: "local",
        category: "profanity",
        durationMs,
        contentHash,
      },
    };
  }

  // --- LAYER 3: Claude Haiku (authoritative) ---
  const aiResult: AIModerationResult = await moderateWithAI(content);

  if (!aiResult.allowed) {
    const durationMs = Date.now() - startTime;
    const category = getCategoryFromAIResult(aiResult);
    logTelemetry(requestId, "haiku", false, category, durationMs, contentHash);
    logBlock("ai", category, aiResult._debug?.confidence);

    return {
      allowed: false,
      reason: aiResult.reason || FRIENDLY_MODERATION_MESSAGE,
      // Propagate serviceError flag to allow route to return appropriate status code
      serviceError: aiResult.serviceError,
      _telemetry: {
        requestId,
        layer: "haiku",
        category,
        durationMs,
        contentHash,
      },
    };
  }

  // --- LAYER 4: Perspective API (optional supplementary signal) ---
  // Only run if:
  // - Perspective is enabled
  // - Haiku allowed but with lower confidence (borderline cases)
  const shouldRunPerspective =
    isPerspectiveEnabled() &&
    aiResult._debug?.confidence !== undefined &&
    aiResult._debug.confidence < 0.85;

  if (shouldRunPerspective) {
    try {
      const perspectiveResult: PerspectiveResult =
        await analyzeWithPerspective(content);

      if (!perspectiveResult.allowed) {
        const durationMs = Date.now() - startTime;
        logTelemetry(
          requestId,
          "perspective",
          false,
          "toxicity",
          durationMs,
          contentHash
        );
        logBlock("perspective", "toxicity");

        return {
          allowed: false,
          reason: perspectiveResult.reason || FRIENDLY_MODERATION_MESSAGE,
          _telemetry: {
            requestId,
            layer: "perspective",
            category: "toxicity",
            durationMs,
            contentHash,
          },
        };
      }
    } catch (error) {
      // Perspective errors should not block content - log and continue
      console.error(
        "[moderation] Perspective error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // --- Content passed all checks ---
  const durationMs = Date.now() - startTime;
  logTelemetry(requestId, "none", true, undefined, durationMs, contentHash);

  return {
    allowed: true,
    _telemetry: {
      requestId,
      layer: "none",
      durationMs,
      contentHash,
    },
  };
}

/**
 * Quick moderation check (local heuristics only)
 *
 * Use this for client-side UX hints. The server must still run
 * the full pipeline for authoritative decisions.
 *
 * @param content - The text content to check
 * @returns ModerationResult from local heuristics
 */
export function quickModerateContent(content: string): ModerationResult {
  return serverModerateContent(content);
}

/**
 * Get moderation pipeline status
 *
 * Useful for health checks and monitoring.
 */
export function getModerationPipelineStatus(): {
  layers: {
    blocklist: boolean;
    local: boolean;
    haiku: boolean;
    perspective: boolean;
  };
  config: {
    failOpen: boolean;
    timeoutMs: number;
  };
} {
  return {
    layers: {
      blocklist: true, // Always enabled (may be empty)
      local: true, // Always enabled
      haiku: !!process.env.ANTHROPIC_API_KEY,
      perspective: isPerspectiveEnabled(),
    },
    config: {
      failOpen: process.env.MODERATION_FAIL_OPEN === "true",
      timeoutMs:
        parseInt(process.env.MODERATION_TIMEOUT_MS || "", 10) || 3000,
    },
  };
}
