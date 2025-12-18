/**
 * Google Perspective API Integration for Content Moderation
 *
 * This module provides optional secondary toxicity classification using
 * Google's Perspective API. It is designed as a supplementary signal,
 * not the primary moderation gate.
 *
 * Use cases:
 * - When OpenAI moderation is unavailable
 * - When OpenAI returns borderline/uncertain scores
 * - To increase confidence for harassment/toxicity detection
 *
 * This module is feature-flagged: it only runs if PERSPECTIVE_API_KEY is set.
 *
 * Environment Variables:
 * - PERSPECTIVE_API_KEY: Required for Perspective API. If not set, module is disabled.
 * - PERSPECTIVE_TOXICITY_THRESHOLD: Optional. Default 0.7. Score threshold for blocking.
 * - PERSPECTIVE_SEVERE_TOXICITY_THRESHOLD: Optional. Default 0.5.
 * - PERSPECTIVE_TIMEOUT_MS: Optional. Default 2000. Timeout for API calls.
 */

// Friendly message shown to users when content is blocked
const FRIENDLY_PERSPECTIVE_MESSAGE =
  "Please keep your message friendly and respectful.";

// Default configuration
const DEFAULT_TOXICITY_THRESHOLD = 0.7;
const DEFAULT_SEVERE_TOXICITY_THRESHOLD = 0.5;
const DEFAULT_TIMEOUT_MS = 2000;

// Perspective API endpoint
const PERSPECTIVE_API_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

export type PerspectiveResult = {
  allowed: boolean;
  reason?: string;
  scores?: {
    toxicity: number;
    severeToxicity: number;
    identityAttack?: number;
    insult?: number;
    threat?: number;
  };
  error?: string;
};

/**
 * Perspective API response types
 */
type PerspectiveAttributeScore = {
  summaryScore: {
    value: number;
    type: string;
  };
};

type PerspectiveAPIResponse = {
  attributeScores?: {
    TOXICITY?: PerspectiveAttributeScore;
    SEVERE_TOXICITY?: PerspectiveAttributeScore;
    IDENTITY_ATTACK?: PerspectiveAttributeScore;
    INSULT?: PerspectiveAttributeScore;
    THREAT?: PerspectiveAttributeScore;
  };
  error?: {
    message: string;
    code: number;
  };
};

/**
 * Check if Perspective API is enabled
 */
export function isPerspectiveEnabled(): boolean {
  return !!process.env.PERSPECTIVE_API_KEY;
}

/**
 * Make a fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analyze content using Google Perspective API
 *
 * @param content - The text content to analyze
 * @returns PerspectiveResult with toxicity scores
 */
export async function analyzeWithPerspective(
  content: string
): Promise<PerspectiveResult> {
  const apiKey = process.env.PERSPECTIVE_API_KEY;

  // If no API key, Perspective is disabled - allow content through
  if (!apiKey) {
    return { allowed: true, error: "Perspective API not configured" };
  }

  const toxicityThreshold =
    parseFloat(process.env.PERSPECTIVE_TOXICITY_THRESHOLD || "") ||
    DEFAULT_TOXICITY_THRESHOLD;
  const severeToxicityThreshold =
    parseFloat(process.env.PERSPECTIVE_SEVERE_TOXICITY_THRESHOLD || "") ||
    DEFAULT_SEVERE_TOXICITY_THRESHOLD;
  const timeoutMs =
    parseInt(process.env.PERSPECTIVE_TIMEOUT_MS || "", 10) || DEFAULT_TIMEOUT_MS;

  try {
    const requestBody = {
      comment: { text: content },
      languages: ["en"], // Add more languages as needed
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        INSULT: {},
        THREAT: {},
      },
    };

    const response = await fetchWithTimeout(
      `${PERSPECTIVE_API_URL}?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Perspective API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as PerspectiveAPIResponse;

    if (data.error) {
      throw new Error(`Perspective API error: ${data.error.message}`);
    }

    // Extract scores
    const scores = {
      toxicity:
        data.attributeScores?.TOXICITY?.summaryScore?.value || 0,
      severeToxicity:
        data.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value || 0,
      identityAttack:
        data.attributeScores?.IDENTITY_ATTACK?.summaryScore?.value,
      insult: data.attributeScores?.INSULT?.summaryScore?.value,
      threat: data.attributeScores?.THREAT?.summaryScore?.value,
    };

    // Log scores for monitoring (non-production only)
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction) {
      console.log(
        `[perspective] Scores: toxicity=${scores.toxicity.toFixed(3)}, severe=${scores.severeToxicity.toFixed(3)}`
      );
    }

    // Decision based on thresholds
    if (scores.severeToxicity >= severeToxicityThreshold) {
      logPerspectiveBlock(
        `severe_toxicity=${scores.severeToxicity.toFixed(3)} >= ${severeToxicityThreshold}`
      );
      return {
        allowed: false,
        reason: FRIENDLY_PERSPECTIVE_MESSAGE,
        scores,
      };
    }

    if (scores.toxicity >= toxicityThreshold) {
      logPerspectiveBlock(
        `toxicity=${scores.toxicity.toFixed(3)} >= ${toxicityThreshold}`
      );
      return {
        allowed: false,
        reason: FRIENDLY_PERSPECTIVE_MESSAGE,
        scores,
      };
    }

    // Content passed Perspective checks
    return { allowed: true, scores };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[perspective] API error:", errorMessage);

    // Perspective is supplementary, so we allow content on error
    // The primary OpenAI moderation should handle blocking
    return { allowed: true, error: errorMessage };
  }
}

/**
 * Log Perspective block (server-side only)
 */
function logPerspectiveBlock(reason: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log(`[perspective] Content blocked: ${reason}`);
  } else {
    console.log(`[perspective] Content blocked: ${reason}`);
  }
}

/**
 * Get Perspective analysis as secondary signal
 *
 * This is a convenience wrapper that returns toxicity scores
 * without making blocking decisions. Useful when you want to
 * combine with other moderation signals.
 *
 * @param content - The text content to analyze
 * @returns Toxicity scores or null if unavailable
 */
export async function getPerspectiveScores(
  content: string
): Promise<PerspectiveResult["scores"] | null> {
  if (!isPerspectiveEnabled()) {
    return null;
  }

  const result = await analyzeWithPerspective(content);
  return result.scores || null;
}
