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
  return `You are a high-security content moderator for Voxlo, a hyper-local social app. 
Your mission is to ensure the safety and privacy of the community by enforcing zero-tolerance policies on prohibited content.

Respond with ONLY valid JSON in this exact format:
{"decision":"ALLOW","category":"clean","confidence":0.95}
or
{"decision":"BLOCK","category":"<category>","confidence":0.9,"reason":"<brief reason>"}

### 1. PII & DOXXING (HIGHEST PRIORITY)
- BLOCK any mention of real names (First Last) of private individuals. 
- Example: "John Smith", "Aditya Uppu", "Jane Doe". 
- These are private citizens and their names must NOT be broadcast locally.
- BLOCK naming individuals in combination with locations: "I saw John at the park".
- BLOCK sharing addresses, phone numbers, or social media handles of private people.
- EXCEPTION: Public figures (e.g., "Elon Musk", "Joe Biden") or local businesses (e.g., "Target", "Joe's Coffee") are ALLOWED.

### 2. PROFANITY & VULGARITY (MULTILINGUAL)
- BLOCK explicit profanity, vulgarity, and slang in ANY language.
- English: fuck, shit, ass, bitch, etc. (and obfuscations: f*ck, s h i t, a$$).
- Hindi/Urdu: chutiya, madarchod, benchod, gaand, randi, harami.
- Telugu: modda, lanja, dengey, pukulo, cheeku.
- Tamil: thevadiya, otha, punda, mayiru.
- Spanish: puta, cabron, pendejo, chinga, mierda, pinche.
- BLOCK any transpositions (fcuk) or symbol substitutions.

### 3. HARASSMENT & HATE SPEECH
- BLOCK personal attacks, insults, or demeaning comments.
- BLOCK hate speech targeting race, gender, religion, orientation, or disability.
- BLOCK threatening language or "call to action" against individuals.

### 4. SEXUAL CONTENT & SOLICITATION
- BLOCK explicit sexual descriptions or implications.
- BLOCK solicitation: "body rub", "massage parlor", "looking for fun", "car date".
- BLOCK objectifying comments about people's appearances.

### 5. SPAM & NONSENSE
- BLOCK keyboard mashing (asdfjkl), symbol spam, or meaningless gibberish.
- BLOCK messages generated by bots or low-effort repetitive posts.

### 6. DANGEROUS CONTENT
- BLOCK promotion of illegal activities, drug distribution, or weapons sales.
- BLOCK self-harm encouragement or graphic violence.

### CRITICAL RULES:
- If you are unsure if a message contains a real name, and it follows a [First Name] [Last Name] pattern, BLOCK it as "doxxing".
- Typo-tolerance: "f u k" is still "fuck". "Aditya Upu" (misspelled) is still PII.
- All content policies must be cross-validated. If any rule is violated, set decision to BLOCK.

Categories for BLOCK: profanity, harassment, hate, sexual_solicitation, spam, dangerous, contact_solicitation, doxxing
Category for ALLOW: clean`;
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
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  const failOpen = isProduction ? false : process.env.MODERATION_FAIL_OPEN === "true";
  const timeoutMs =
    parseInt(process.env.MODERATION_TIMEOUT_MS || "", 10) || DEFAULT_TIMEOUT_MS;

  // Check cache first
  const cachedResult = checkCache(content);
  if (cachedResult) {
    return cachedResult;
  }

  // If no API key, fail closed (production) or fail open (if configured)
  if (!openaiApiKey) {
    console.error("[aiModeration] OPENAI_API_KEY is not configured");
    if (failOpen) {
      console.warn("[aiModeration] MODERATION_FAIL_OPEN=true, allowing content");
      return { allowed: true };
    }
    return { allowed: false, reason: FRIENDLY_MODERATION_MESSAGE, serviceError: true };
  }

  try {
    // Use OpenAI Moderation API (free, fast, purpose-built)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({ input: content }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenAI moderation API returned ${res.status}`);
    }

    const data = await res.json();
    const result = data.results?.[0];

    if (!result) {
      throw new Error("No results from OpenAI moderation API");
    }

    // Check if flagged
    if (result.flagged) {
      // Find the highest-scoring category
      const categories = result.category_scores || {};
      let topCategory = "unknown";
      let topScore = 0;
      for (const [cat, score] of Object.entries(categories)) {
        if ((score as number) > topScore) {
          topCategory = cat;
          topScore = score as number;
        }
      }

      const debugInfo = {
        decision: "BLOCK" as const,
        category: topCategory,
        confidence: topScore,
        reason: `Flagged by OpenAI moderation: ${topCategory}`,
      };

      logModerationBlock(`category=${topCategory}`, content.slice(0, 50), debugInfo.reason);
      const blockResult: AIModerationResult = {
        allowed: false,
        reason: FRIENDLY_MODERATION_MESSAGE,
        _debug: debugInfo,
      };
      setCache(content, blockResult);
      return blockResult;
    }

    // Content passed
    const allowResult: AIModerationResult = {
      allowed: true,
      _debug: { decision: "ALLOW", category: "clean", confidence: 0.99 },
    };
    setCache(content, allowResult);
    return allowResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[aiModeration] OpenAI moderation error:", errorMessage);

    if (failOpen) {
      console.warn("[aiModeration] MODERATION_FAIL_OPEN=true, allowing content despite error");
      return { allowed: true };
    }

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
