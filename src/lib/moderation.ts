/**
 * Content moderation utilities for pulse posts
 * Server-side guardrail to prevent profanity and abusive content
 */

// Comprehensive profanity list - explicit words that should NEVER be allowed
const EXPLICIT_PROFANITY = [
  // Common explicit words
  "fuck", "fucking", "fucked", "fucker", "fuckers", "fucks",
  "shit", "shits", "shitty", "shitting", "bullshit",
  "ass", "asshole", "assholes", "asses",
  "bitch", "bitches", "bitchy", "bitching",
  "damn", "damned", "damnit", "goddamn", "goddamnit",
  "bastard", "bastards",
  "crap", "crappy",
  "dick", "dicks", "dickhead", "dickheads",
  "cock", "cocks", "cocksucker",
  "cunt", "cunts",
  "piss", "pissed", "pissing",
  "whore", "whores",
  "slut", "sluts", "slutty",
  "motherfucker", "motherfuckers", "motherfucking",
  "nigger", "niggers", "nigga", "niggas",
  "faggot", "faggots", "fag", "fags",
  "retard", "retards", "retarded",
  "kike", "kikes",
  "spic", "spics",
  "chink", "chinks",
  "wetback", "wetbacks",
  // Variations and leetspeak
  "f*ck", "f**k", "f***", "sh*t", "sh1t", "a$$", "b1tch",
  "fuk", "phuck", "phuk",
];

// Patterns for more complex detection (hate speech, threats)
const ABUSE_PATTERNS = [
  /kill\s+(your)?self/i,
  /go\s+die/i,
  /i('ll)?\s+kill\s+you/i,
  /hope\s+you\s+die/i,
  /kys\b/i, // "kill yourself" abbreviation
];

export type ModerationResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if content passes moderation
 * Returns { allowed: true } if content is clean
 * Returns { allowed: false, reason: "..." } if content violates rules
 */
export function moderateContent(content: string): ModerationResult {
  if (!content || typeof content !== "string") {
    return { allowed: false, reason: "Content is required" };
  }

  const text = content.toLowerCase().trim();

  if (!text) {
    return { allowed: false, reason: "Content cannot be empty" };
  }

  // Check explicit profanity
  for (const word of EXPLICIT_PROFANITY) {
    // Use word boundary check to avoid false positives
    // e.g., "grass" shouldn't match "ass"
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (regex.test(text)) {
      return {
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      };
    }
  }

  // Check abuse patterns
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason: "This type of content is not allowed.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Server-side moderation check that can be called from API routes
 * This is the authoritative check - client-side checks are for UX only
 */
export function serverModerateContent(content: string): ModerationResult {
  return moderateContent(content);
}

// Export the profanity list for testing purposes only
export const PROFANITY_LIST_FOR_TESTING = EXPLICIT_PROFANITY;
