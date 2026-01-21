/**
 * AI-powered content moderation using Claude Haiku
 *
 * This module provides authoritative server-side moderation for pulse content.
 * It uses Claude 3.5 Haiku to detect:
 * - Profanity and vulgarity (including obfuscated: "f u c k", "sh1t")
 * - Harassment and hate speech
 * - Sexual content and solicitation ("body rub", "massage parlor", "car date")
 * - Contact/off-platform solicitation ("DM me", "text me")
 * - Spam and nonsense (symbol spam, keyboard mashing)
 * - Dangerous content (threats, self-harm, illegal activity)
 *
 * Why Haiku over OpenAI Moderation API:
 * - Context awareness: Understands "body rub massage parlor" is solicitation
 * - Typo tolerance: Recognizes "ayone" as misspelled "anyone"
 * - Custom rules: System prompt encodes app-specific policies
 * - Better spam detection: Identifies nonsense/garbage posts
 *
 * Features:
 * - Timeout with configurable duration (default 3000ms)
 * - Retry with exponential backoff (1 retry by default)
 * - In-memory cache for identical content (short TTL)
 * - Fail-closed by default (blocks on error unless MODERATION_FAIL_OPEN=true)
 * - Production ALWAYS fails closed regardless of config
 *
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Required. Your Anthropic API key.
 * - MODERATION_FAIL_OPEN: Optional. Default "false". If "true", allows content when API fails (non-production only).
 * - MODERATION_TIMEOUT_MS: Optional. Default 3000. Timeout for API calls in milliseconds.
 */

import Anthropic from "@anthropic-ai/sdk";

// Friendly message shown to users when content is blocked
const FRIENDLY_MODERATION_MESSAGE =
  "Please keep your message friendly and respectful.";

// Default configuration values
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_COUNT = 1;
const RETRY_BACKOFF_MS = 500;

// In-memory cache for moderation results (TTL: 60 seconds)
const CACHE_TTL_MS = 60_000;
const moderationCache = new Map<
  string,
  { result: AIModerationResult; timestamp: number }
>();

export type AIModerationResult = {
  allowed: boolean;
  reason?: string;
  /**
   * Indicates the moderation service encountered an error.
   * When true, the route should return 503 instead of 400.
   * This distinguishes "content was blocked" from "service unavailable".
   */
  serviceError?: boolean;
  /**
   * Internal debug info (not exposed to client).
   * Contains moderation details for logging/debugging.
   */
  _debug?: {
    decision: "ALLOW" | "BLOCK";
    category: string;
    confidence: number;
    reason?: string;
    cacheHit?: boolean;
  };
};

/**
 * Haiku moderation response format
 */
type HaikuModerationResponse = {
  decision: "ALLOW" | "BLOCK";
  category: string;
  confidence: number;
  reason?: string;
};

/**
 * Generate a cache key from content
 */
function getCacheKey(content: string): string {
  // Simple hash using content itself (for short content, this is efficient)
  // For production with high volume, consider using a proper hash function
  return content.slice(0, 500).toLowerCase().trim();
}

/**
 * Check cache for existing moderation result
 */
function checkCache(content: string): AIModerationResult | null {
  const key = getCacheKey(content);
  const cached = moderationCache.get(key);

  if (!cached) return null;

  // Check if cache entry has expired
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    moderationCache.delete(key);
    return null;
  }

  // Return cached result with cache hit indicator
  return {
    ...cached.result,
    _debug: cached.result._debug
      ? { ...cached.result._debug, cacheHit: true }
      : undefined,
  };
}

/**
 * Store moderation result in cache
 */
function setCache(content: string, result: AIModerationResult): void {
  const key = getCacheKey(content);
  moderationCache.set(key, { result, timestamp: Date.now() });

  // Cleanup old entries periodically (simple LRU-like behavior)
  if (moderationCache.size > 1000) {
    const entries = Array.from(moderationCache.entries());
    // Remove oldest 200 entries
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 200)
      .forEach(([k]) => moderationCache.delete(k));
  }
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the system prompt for Haiku moderation
 *
 * This prompt encodes Voxlo's specific content policies.
 * It's designed to catch content that fixed-category APIs miss.
 */
function buildSystemPrompt(): string {
  return `You are a content moderator for Voxlo, a hyper-local social app where users post short messages about what's happening in their city.

Your job is to classify user-submitted content as ALLOW or BLOCK.

BLOCK content that falls into these categories:

1. PROFANITY & VULGARITY (ANY LANGUAGE)
   - English profanity: fuck, shit, ass, bitch, etc.
   - Obfuscated English: "f u c k", "sh1t", "a$$", "f*ck", "@ss"
   - Hindi/Urdu: chutiya, madarchod, benchod, gaand, randi, harami
   - Telugu: modda, lanja, dengey, pukulo, cheeku
   - Tamil: thevadiya, otha, punda, mayiru
   - Spanish: puta, cabron, pendejo, chinga, mierda, pinche
   - ANY other non-English profanity in any language
   - Transpositions: "ASSOHLE", "fcuk"
   - Symbol substitutions: "#", "*", "@" replacing letters

2. HARASSMENT & HATE
   - Personal attacks, insults, name-calling
   - Hate speech targeting race, gender, religion, etc.
   - Threatening language

3. PII & DOXXING (CRITICAL)
   - Naming a PRIVATE INDIVIDUAL combined with their location: "John Smith on Highland Hills"
   - Sharing someone's address, license plate, or identifying details
   - "I saw [Name] at [Location]" when clearly identifying a private person
   - EXCEPTION: Public figures, businesses, or fictional characters are OK

4. SEXUAL CONTENT & SOLICITATION
   - Explicit sexual content
   - Sexual solicitation: "body rub", "massage parlor", "happy ending"
   - Escort-style language: "car date", "looking for fun", "good time"
   - Objectifying comments: "Stacy is hot and sexy", "she's a 10"
   - Adult services ads

5. CONTACT & OFF-PLATFORM SOLICITATION
   - "DM me", "text me", "call me"
   - Sharing contact info for hookups
   - Directing users off-platform for inappropriate purposes

6. SPAM & NONSENSE
   - Symbol spam: "&*&^^%*&% Steve!"
   - Keyboard mashing: "asdfjkl;", "qwerty"
   - Meaningless character sequences
   - Excessive punctuation without meaning

7. DANGEROUS CONTENT
   - Threats of violence
   - Self-harm encouragement
   - Illegal activity promotion
   - Drug dealing

IMPORTANT RULES:
- Be TYPO-TOLERANT: "car date ayone?" is solicitation (ayone = anyone)
- Be MULTILINGUAL: Block profanity in ALL languages, not just English
- Context matters: "body rub massage parlor" is solicitation, not a business review
- "Hot and sexy" about people is inappropriate for a community board
- Symbol-heavy messages with no clear meaning are spam
- DOXXING: If someone is publicly identifying a private individual with location info, BLOCK it

ALLOW content that is:
- Normal community updates: traffic, weather, events, local news
- Questions about local services, restaurants, businesses
- Friendly conversation, greetings, positive messages
- Constructive feedback or complaints about local issues
- Mentioning PUBLIC figures (celebrities, politicians) or BUSINESSES

Respond with ONLY valid JSON in this exact format:
{"decision":"ALLOW","category":"clean","confidence":0.95}
or
{"decision":"BLOCK","category":"<category>","confidence":0.9,"reason":"<brief reason>"}

Categories for BLOCK: profanity, harassment, hate, sexual_solicitation, spam, dangerous, contact_solicitation, doxxing
Category for ALLOW: clean

Do not include any text outside the JSON object.`;
}

/**
 * Parse Haiku's response into a structured format
 */
function parseHaikuResponse(text: string): HaikuModerationResponse | null {
  try {
    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.decision || !parsed.category || typeof parsed.confidence !== "number") {
      return null;
    }

    return {
      decision: parsed.decision as "ALLOW" | "BLOCK",
      category: parsed.category,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

/**
 * Call Claude Haiku API with retry and timeout
 */
async function callHaikuModerationAPI(
  content: string,
  apiKey: string,
  timeoutMs: number
): Promise<HaikuModerationResponse> {
  const client = new Anthropic({ apiKey });
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DEFAULT_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff
        await sleep(RETRY_BACKOFF_MS * attempt);
      }

      const message = await client.messages.create(
        {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 150,
          system: buildSystemPrompt(),
          messages: [
            {
              role: "user",
              content: `Moderate this community post:\n\n"${content}"`,
            },
          ],
        },
        {
          timeout: timeoutMs,
        }
      );

      // Extract text from response
      const responseText =
        message.content[0]?.type === "text" ? message.content[0].text : "";

      const parsed = parseHaikuResponse(responseText);
      if (!parsed) {
        throw new Error(`Invalid Haiku response format: ${responseText.slice(0, 100)}`);
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for timeout (Anthropic SDK throws APIConnectionTimeoutError)
      if (lastError.name === "APIConnectionTimeoutError" || lastError.message.includes("timeout")) {
        throw new Error(`Haiku API timeout after ${timeoutMs}ms`);
      }

      // Log retry attempt
      if (attempt < DEFAULT_RETRY_COUNT) {
        console.warn(
          `[aiModeration] Retry ${attempt + 1}/${DEFAULT_RETRY_COUNT} after error: ${lastError.message}`
        );
      }
    }
  }

  throw lastError || new Error("Unknown error in Haiku API call");
}

/**
 * Check content against Claude Haiku
 *
 * @param content - The text content to moderate (only the message, no metadata)
 * @returns AIModerationResult indicating if content is allowed
 *
 * IMPORTANT: Production is ALWAYS fail-closed, regardless of MODERATION_FAIL_OPEN.
 * This is a security invariant that cannot be overridden by configuration.
 */
export async function moderateWithAI(
  content: string
): Promise<AIModerationResult> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  // SECURITY: Production ALWAYS fails closed, regardless of env var
  const failOpen = isProduction ? false : process.env.MODERATION_FAIL_OPEN === "true";
  const timeoutMs =
    parseInt(process.env.MODERATION_TIMEOUT_MS || "", 10) || DEFAULT_TIMEOUT_MS;

  // Check cache first
  const cachedResult = checkCache(content);
  if (cachedResult) {
    return cachedResult;
  }

  // If no API key, fail closed (production) or fail open (if configured)
  if (!anthropicApiKey) {
    console.error("[aiModeration] ANTHROPIC_API_KEY is not configured");
    if (failOpen) {
      console.warn(
        "[aiModeration] MODERATION_FAIL_OPEN=true, allowing content"
      );
      return { allowed: true };
    }
    // serviceError=true indicates this is a configuration/service issue, not content rejection
    return { allowed: false, reason: FRIENDLY_MODERATION_MESSAGE, serviceError: true };
  }

  try {
    const moderation = await callHaikuModerationAPI(
      content,
      anthropicApiKey,
      timeoutMs
    );

    const { decision, category, confidence, reason } = moderation;

    // Build debug info (for server logs, not client)
    const debugInfo = {
      decision,
      category,
      confidence,
      reason,
    };

    // Decision: Haiku says BLOCK
    if (decision === "BLOCK") {
      logModerationBlock(`category=${category}`, content.slice(0, 50), reason);
      const blockResult: AIModerationResult = {
        allowed: false,
        reason: FRIENDLY_MODERATION_MESSAGE,
        _debug: debugInfo,
      };
      setCache(content, blockResult);
      return blockResult;
    }

    // Content passed - Haiku says ALLOW
    const allowResult: AIModerationResult = { allowed: true, _debug: debugInfo };
    setCache(content, allowResult);
    return allowResult;
  } catch (error) {
    // Log error without exposing user content in production
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[aiModeration] Haiku API error:", errorMessage);

    // Fail-safe: closed by default, open only if explicitly configured
    if (failOpen) {
      console.warn(
        "[aiModeration] MODERATION_FAIL_OPEN=true, allowing content despite error"
      );
      return { allowed: true };
    }

    // serviceError=true indicates this is a service/network issue, not content rejection
    return { allowed: false, reason: FRIENDLY_MODERATION_MESSAGE, serviceError: true };
  }
}

/**
 * Log moderation block (server-side only, no user content in production)
 */
function logModerationBlock(category: string, contentPreview: string, reason?: string): void {
  // In production, don't log content to avoid privacy issues
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log(`[aiModeration] Content blocked: ${category}${reason ? ` - ${reason}` : ""}`);
  } else {
    console.log(
      `[aiModeration] Content blocked: ${category} | preview: "${contentPreview}..."${reason ? ` | reason: ${reason}` : ""}`
    );
  }
}

/**
 * Combined moderation check: local heuristics + AI moderation
 *
 * This is the recommended entry point for server-side moderation.
 * It runs local checks first (fast), then AI checks (authoritative).
 *
 * @param content - The text content to moderate
 * @param localModerateFunc - The local moderation function (from moderation.ts)
 * @returns Combined moderation result
 */
export async function moderateContentWithAI(
  content: string,
  localModerateFunc: (text: string) => { allowed: boolean; reason?: string }
): Promise<AIModerationResult> {
  // Step 1: Run local heuristics first (fast, catches obvious cases)
  const localResult = localModerateFunc(content);
  if (!localResult.allowed) {
    return {
      allowed: false,
      reason: localResult.reason,
    };
  }

  // Step 2: Run AI moderation (authoritative, catches context + typos + multilingual)
  return moderateWithAI(content);
}

/**
 * Clear the moderation cache (useful for testing)
 */
export function clearModerationCache(): void {
  moderationCache.clear();
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getModerationCacheStats(): { size: number; maxSize: number } {
  return {
    size: moderationCache.size,
    maxSize: 1000,
  };
}
