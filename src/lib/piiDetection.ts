/**
 * PII Detection Module - Comprehensive Bypass Prevention
 *
 * Server-authoritative detection of personally identifiable information.
 * This module runs BEFORE AI moderation in the pipeline to catch PII early.
 *
 * Design Principles:
 * 1. Block obfuscated PII: spaces, (at)/(dot), spaced letters, etc.
 * 2. Minimize false positives - traffic mentions like "183 N hwy" must pass
 * 3. Context-gating for ambiguous patterns (addresses, SSN, phone)
 * 4. Luhn validation for credit cards
 * 5. Block spam/nonsense content
 * 6. Never log raw user text - only categories and hashes
 *
 * Categories Detected:
 * - email: Email addresses including obfuscated variants
 * - phone: Phone numbers with context gating
 * - ssn: Social Security Numbers with context gating
 * - credit_card: Credit card numbers (Luhn validated)
 * - address: Physical addresses (only with context phrases)
 * - self_identification: "my name is", "I am <First Last>"
 * - social_handle: @username, instagram:, snap:, DM me, etc.
 * - contact_phrase: "call me", "text me", "reach me at"
 * - spam: nonsense, emoji-only, punctuation-only, repeated chars
 *
 * Environment Variables:
 * - PII_FAIL_OPEN: "true" to allow content when detection fails (default: "false")
 * - PII_TIMEOUT_MS: Timeout for optional cloud DLP (default: 1500)
 * - PII_BLOCK_SOCIAL_HANDLES: "false" to allow social handles (default: "true")
 * - PII_ALLOW_NAMES: "true" to allow "my name is" patterns (default: "false")
 * - GOOGLE_DLP_API_KEY: Optional, enables Google Cloud DLP integration
 */

import crypto from "crypto";

// PII categories for telemetry
export type PIICategory =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "address"
  | "self_identification"
  | "social_handle"
  | "contact_phrase"
  | "spam";

export type PIIDetectionResult = {
  blocked: boolean;
  categories: PIICategory[];
  reason: string;
};

// Friendly message shown to users - does not reveal which pattern triggered
const FRIENDLY_PII_MESSAGE =
  "Please don't share personal contact details or addresses. Keep it anonymous.";

// Configuration from environment
function getConfig() {
  return {
    failOpen: process.env.PII_FAIL_OPEN === "true",
    timeoutMs: parseInt(process.env.PII_TIMEOUT_MS || "1500", 10),
    blockSocialHandles: process.env.PII_BLOCK_SOCIAL_HANDLES !== "false",
    allowNames: process.env.PII_ALLOW_NAMES === "true",
    cloudDLPEnabled: !!process.env.GOOGLE_DLP_API_KEY,
  };
}

// ============================================================================
// Text Normalization Utilities
// ============================================================================

/**
 * Strip diacritics and normalize unicode
 */
function stripDiacritics(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize text: lowercase, strip diacritics, collapse whitespace
 */
function normalizeText(input: string): string {
  return stripDiacritics(input.toLowerCase()).replace(/\s+/g, " ").trim();
}

/**
 * Collapse spaced-out letters: "t e s t" -> "test"
 * Only applies to sequences of single letters separated by spaces
 */
function collapseSpacedLetters(input: string): string {
  // e.g., "t e s t" -> "test", "h e l l o" -> "hello"
  // This regex repeatedly removes spaces between single-letter tokens.
  return input.replace(/\b([a-z])\s+(?=[a-z]\b)/gi, "$1");
}

/**
 * Normalize for email detection:
 * - Collapse spaces around @ and .
 * - Handle (at)/(dot) variants
 * - Collapse spaced letters if @ or " at " is present
 */
function normalizeForEmail(input: string): string {
  let text = normalizeText(input);

  // Check if this might be an obfuscated email (contains @ or " at ")
  const mightBeEmail = text.includes("@") || /\bat\b/i.test(text);
  if (mightBeEmail) {
    // Collapse spaced letters: "t e s t @ e x a m p l e . c o m" -> "test@example.com"
    text = collapseSpacedLetters(text);
  }

  // Handle (at) and (dot) variants first
  text = text.replace(/\s*\(at\)\s*/gi, "@");
  text = text.replace(/\s*\(dot\)\s*/gi, ".");

  // Handle word variants " at " and " dot "
  text = text.replace(/\s+at\s+/gi, "@");
  text = text.replace(/\s+dot\s+/gi, ".");

  // Remove spaces around @ and dots
  text = text.replace(/\s*@\s*/g, "@");
  text = text.replace(/\s*\.\s*/g, ".");

  return text;
}

/**
 * Extract all digits from text
 */
function extractDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Extract digit groups preserving position context
 */
function extractDigitGroups(input: string): string[] {
  const groups: string[] = [];
  const normalized = normalizeText(input);

  // Match groups of digits (with optional spaces/dashes/dots between them)
  // e.g., "5 1 2 5 5 5 1 2 1 2", "512-555-1212", "5 1 2 - 5 5 5 - 1 2 1 2"
  const spacedDigitPattern = /(?:\d[\s\-\.]*){4,}/g;
  let match: RegExpExecArray | null;
  while ((match = spacedDigitPattern.exec(normalized)) !== null) {
    groups.push(match[0]);
  }

  return groups;
}

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Email pattern - standard email format
 * Applied to normalized text (spaces collapsed, at/dot converted)
 */
const EMAIL_PATTERN = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;

/**
 * Phone context words - must be present to block phone numbers
 * This prevents false positives on benign number sequences
 */
const PHONE_CONTEXT_WORDS: RegExp[] = [
  /\btext\s*me\b/i,
  /\bcall\s*(me|at)?\b/i,
  /\bphone\b/i,
  /\bnumber\b/i,
  /#\s*is\b/i, // "# is" - hash can't use \b before
  /\bmy\s*#/i, // "my #" - hash doesn't need \b after
  /\bsms\b/i,
  /\bwhatsapp\b/i,
  /\bwa\b/i,
  /\bcontact\b/i,
  /\breach\s*me\b/i,
  /\bdm\b/i,
  /\btalk\b/i,
  /\bcell\b/i,
  /\bmobile\b/i,
];

/**
 * SSN context words - must be present to block SSN patterns
 */
const SSN_CONTEXT_WORDS: RegExp[] = [
  /\bssn\b/i,
  /\bsocial\b/i,
  /\bmy\s+social\b/i,
  /\bsocial\s*security\b/i,
  /\bsoc\s*sec\b/i,
];

/**
 * Context phrases that indicate address self-doxxing intent
 */
const ADDRESS_CONTEXT_PHRASES: RegExp[] = [
  /\bmy\s+address\s*(is)?\b/i,
  /\baddress\s*[:\-]/i,
  /\bi\s+live\s+at\b/i,
  /\blive\s+at\s*:/i,
  /\bfind\s+me\s+at\b/i,
  /\blocated\s+at\b/i,
  /\bcome\s+to\b/i,
  /\bmy\s+apartment\s*(is)?\b/i,
  /\bmy\s+place\s*(is)?\b/i,
];

/**
 * Street suffixes for address detection
 */
const STREET_SUFFIXES =
  /\b(?:st(?:reet)?|rd|road|ave(?:nue)?|blvd|boulevard|ln|lane|dr(?:ive)?|ct|court|hwy|highway|pkwy|parkway|way|pl(?:ace)?|cir(?:cle)?|ter(?:race)?)\b/i;

/**
 * Apartment/unit markers
 */
const UNIT_MARKERS = /\b(?:apt|apartment|unit|suite|ste|#)\s*[a-z0-9]+/i;

/**
 * Address-like pattern - number + direction + street name + suffix
 * Only blocks when combined with context phrases
 */
const ADDRESS_LIKE_PATTERN =
  /\b\d{1,5}\s+(?:[NSEW]\.?(?:\s+))?[a-zA-Z][a-zA-Z\s]{1,30}\s+(?:st(?:reet)?|rd|road|ave(?:nue)?|blvd|boulevard|ln|lane|dr(?:ive)?|ct|court|hwy|highway|pkwy|parkway|way|pl(?:ace)?|cir(?:cle)?|ter(?:race)?)\b/i;

/**
 * Self-identification phrases
 */
const SELF_ID_PATTERNS: RegExp[] = [
  /\bmy\s+name\s+is\b/i,
  /\b[Ii]\s+am\s+[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/,
  /\bmy\s+full\s+name\b/i,
  /\bcall\s+me\s+[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/i,
];

/**
 * Contact invitation phrases
 */
const CONTACT_PHRASES: RegExp[] = [
  /\bcall\s+me\s+at\b/i,
  /\btext\s+me\s+at\b/i,
  /\breach\s+me\s+at\b/i,
  /\bcontact\s+me\s+at\b/i,
  /\bmy\s+(?:phone|cell|mobile)\s+(?:is|number)\b/i,
  /\bmy\s+email\s+is\b/i,
  /\bemail\s+me\s+at\b/i,
];

/**
 * Contact intent patterns (strict) - blocks attempts to take conversation off-platform
 */
const CONTACT_INTENT_PATTERNS: RegExp[] = [
  /\blet(?:['’])?s\s+talk\b/i,
  /\bdm\b/i,
  /\bd\s*[.\s]\s*m\b/i,
  /\bdirect\s+message(?:\s+me)?\b/i,
  /\bpm\b/i,
  /\bp\s*[.\s]\s*m\b/i,
  /\bprivate\s+message(?:\s+me)?\b/i,
  /\binbox\s+me\b/i,
  /\bhit\s+me\s+up\b/i,
  /\breach\s+out\b/i,
  /\breach\s+me\b/i,
  /\bmessage\s+me\b/i,
  /\bmsg\s+me\b/i,
  /\badd\s+me\b/i,
  /\bconnect\s+with\s+me\b/i,
  /\btext\s+me\b/i,
  /\bcall\s+me\b/i,
];

/**
 * Social handle patterns - including space after @
 */
const SOCIAL_HANDLE_PATTERNS: RegExp[] = [
  // @username or @ username (with optional space)
  /(?:^|[\s,;])@\s*[a-zA-Z][a-zA-Z0-9_]{2,}/,
  // Platform prefixes with handles
  /\b(?:instagram|insta|ig)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  /\b(?:snapchat|snap)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  /\b(?:twitter|x)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  /\b(?:tiktok|tt)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  /\b(?:facebook|fb)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  /\b(?:telegram|tg)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.]+/i,
  // WhatsApp - require delimiter after "wa" to avoid false positives like "watch"
  /\b(?:whatsapp)\s*[:\-]?\s*[@+]?\s*[a-zA-Z0-9_.]+/i,
  /\bwa\s*[:\-@+]\s*[a-zA-Z0-9_.]+/i,
  /\b(?:discord)\s*[:\-]?\s*@?\s*[a-zA-Z0-9_.#]+/i,
  // Platform context + "is" + handle: "IG is @myhandle" or "IG is @ myhandle"
  /\b(?:ig|instagram|snap|snapchat|tt|tiktok|twitter|x|fb|facebook|telegram|tg)\s+is\s+@?\s*[a-zA-Z0-9_]+/i,
  // Contact invitations
  /\bDM\s+me\b/i,
  /\bhit\s+me\s+up\b/i,
  /\bslide\s+(?:in|into)\s+(?:my\s+)?DMs?\b/i,
  /\badd\s+me\s+on\b/i,
  /\bfollow\s+me\s+(?:on|at)\b/i,
];

// ============================================================================
// Spam/Nonsense Detection
// ============================================================================

/**
 * Known spam/offensive words that aren't caught by other filters
 */
const SPAM_WORDS: RegExp[] = [
  // Hindi profanity
  /\blanjodka\b/i,
  /\bchutiya\b/i,
  /\bbhosdike?\b/i,
  /\bmadarchod\b/i,
  /\bbenchod\b/i,
  /\bgaand\b/i,
  /\brandi\b/i,
  /\bharami\b/i,
  /\bsaala?\b/i,
  /\bkutta\b/i,
  /\bkamina\b/i,
  // Telugu profanity
  /\bmodda\b/i,
  /\bcheeku\b/i,  // Often paired with modda
  /\blanja\b/i,
  /\bdengey?\b/i,
  /\bpodha\b/i,
  /\bpukulo\b/i,
  /\bbokka\b/i,
  // Tamil profanity
  /\bthevadiya\b/i,
  /\botha\b/i,
  /\bpunda\b/i,
  /\bmayiru?\b/i,
  // Spanish profanity (common in TX)
  /\bputa\b/i,
  /\bcabron\b/i,
  /\bpendejo\b/i,
  /\bchinga\b/i,
  /\bmierda\b/i,
  /\bpinche\b/i,
];

/**
 * Detect spam/nonsense content
 */
function detectSpam(text: string): boolean {
  const trimmed = text.trim();

  // Empty or whitespace-only
  if (!trimmed) return false; // Let validation handle empty

  // Known spam words
  for (const pattern of SPAM_WORDS) {
    if (pattern.test(trimmed)) return true;
  }

  // Punctuation-only: "#^*&^!@#^!@#", ".", "!!!!"
  if (/^[^\w\s]+$/.test(trimmed)) return true;

  // Emoji-only (Unicode emoji ranges)
  const emojiPattern =
    /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\s]+$/u;
  if (emojiPattern.test(trimmed)) return true;

  // Repeated character only: "aaaaaaaaaa" (more than 4 repeats of same char)
  const letterContent = trimmed.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (letterContent.length >= 5) {
    const firstChar = letterContent[0];
    if (letterContent.split("").every((c) => c === firstChar)) return true;
  }

  // Low-information content (tunable)
  const minLetters = 2;
  if (letterContent.length > 0 && letterContent.length < minLetters) {
    if (trimmed.length > 3) return true;
  }

  return false;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Luhn algorithm for credit card validation
 */
function isValidLuhn(digits: string): boolean {
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length < 13 || cleaned.length > 19) return false;

  // Reject obvious non-card patterns like all same digit
  if (/^(.)\1+$/.test(cleaned)) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]!, 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Check for email addresses (including obfuscated)
 */
function detectEmail(text: string): boolean {
  const normalized = normalizeForEmail(text);
  if (EMAIL_PATTERN.test(normalized)) return true;

  // Handle "+" spacing in emails like "hello + cp @ domain . co"
  const plusVariant = normalized.replace(/\s*\+\s*/g, "+");
  return EMAIL_PATTERN.test(plusVariant);
}

/**
 * Check for phone numbers WITH context gating
 */
function detectPhone(text: string): boolean {
  const digitsTotal = (text.match(/\d/g) || []).length;

  // Context triggers: existing patterns OR special-case '@' when digits>=10
  const hasPhoneContext =
    PHONE_CONTEXT_WORDS.some((pattern) => pattern.test(text)) ||
    (text.includes("@") && digitsTotal >= 10);

  if (!hasPhoneContext) {
    // No context = do not treat digit sequences as phone numbers
    return false;
  }

  // Phone context found - now check for digit sequences
  const digitGroups = extractDigitGroups(text);
  for (const group of digitGroups) {
    const digits = extractDigits(group);
    // US phone: 10 digits, international can be 10-15
    if (digits.length >= 10 && digits.length <= 15) return true;
  }

  // E.164 format: +1234567890
  if (/\+\d{10,15}/.test(text)) return true;

  // Standard patterns like (555) 123-4567
  const phonePatterns = [
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
    /\d{10,11}/,
  ];
  if (phonePatterns.some((p) => p.test(text))) return true;

  // Total digit count check (catches spaced-out numbers)
  const allDigits = extractDigits(text);
  if (allDigits.length >= 10 && allDigits.length <= 15) return true;

  return false;
}

/**
 * Check for SSN patterns WITH context gating
 */
function detectSSN(text: string): boolean {
  const hasSSNContext = SSN_CONTEXT_WORDS.some((pattern) => pattern.test(text));
  if (!hasSSNContext) return false;

  const normalized = normalizeText(text);

  // SSN with separators: 123-45-6789, 123 45 6789, 123.45.6789
  if (/\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/.test(normalized)) return true;

  // SSN spaced out: "1 2 3 4 5 6 7 8 9"
  const allDigits = extractDigits(normalized);
  return allDigits.length === 9;
}

/**
 * Check for credit card numbers with Luhn validation
 */
function detectCreditCard(text: string): boolean {
  const normalized = normalizeText(text);
  const matches = normalized.match(/(?:\d[\s\-\.]*){13,19}/g);
  if (!matches) return false;

  for (const match of matches) {
    const digits = extractDigits(match);
    if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for address patterns WITH context phrases
 */
function detectAddress(text: string): boolean {
  const hasContextPhrase = ADDRESS_CONTEXT_PHRASES.some((pattern) =>
    pattern.test(text)
  );
  if (!hasContextPhrase) return false;

  // Address-like content
  if (ADDRESS_LIKE_PATTERN.test(text)) return true;
  if (UNIT_MARKERS.test(text)) return true;

  // Any street suffix + any number
  if (STREET_SUFFIXES.test(text) && /\b\d+\b/.test(text)) return true;

  return false;
}

/**
 * Check for self-identification patterns
 */
function detectSelfIdentification(text: string): boolean {
  const config = getConfig();
  if (config.allowNames) return false;
  return SELF_ID_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check for social handles and contact invitations
 */
function detectSocialHandle(text: string): boolean {
  const config = getConfig();
  if (!config.blockSocialHandles) return false;
  return SOCIAL_HANDLE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check for contact phrases
 */
function detectContactPhrase(text: string): boolean {
  return CONTACT_PHRASES.some((pattern) => pattern.test(text));
}

/**
 * Check for contact intent phrases (strict)
 */
function detectContactIntent(text: string): boolean {
  const normalized = normalizeText(text);
  return CONTACT_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect PII in text content
 */
export function detectPII(text: string): PIIDetectionResult {
  if (!text || typeof text !== "string") {
    return { blocked: false, categories: [], reason: "" };
  }

  const detectedCategories: PIICategory[] = [];
  const addCategory = (category: PIICategory) => {
    if (!detectedCategories.includes(category)) detectedCategories.push(category);
  };

  // Spam first
  if (detectSpam(text)) addCategory("spam");

  // Strict: any contact intent should be blocked early (before moderation/insert)
  if (detectContactIntent(text)) addCategory("contact_phrase");

  // PII detectors
  if (detectEmail(text)) addCategory("email");
  if (detectPhone(text)) addCategory("phone");
  if (detectSSN(text)) addCategory("ssn");
  if (detectCreditCard(text)) addCategory("credit_card");
  if (detectAddress(text)) addCategory("address");
  if (detectSelfIdentification(text))
    addCategory("self_identification");
  if (detectSocialHandle(text)) addCategory("social_handle");
  if (detectContactPhrase(text)) addCategory("contact_phrase");

  const blocked = detectedCategories.length > 0;
  return {
    blocked,
    categories: detectedCategories,
    reason: blocked ? FRIENDLY_PII_MESSAGE : "",
  };
}

// ============================================================================
// Telemetry Helpers (for route integration)
// ============================================================================

/**
 * Hash content for privacy-safe logging
 */
export function hashContentForLogging(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Log PII detection result (privacy-safe)
 */
export function logPIIDetection(
  requestId: string,
  result: PIIDetectionResult,
  contentHash: string
): void {
  const logData = {
    requestId,
    layer: "pii",
    decision: result.blocked ? "deny" : "allow",
    categories: result.categories,
    contentHash,
  };

  console.log(`[pii-detection] ${JSON.stringify(logData)}`);
}

// ============================================================================
// Configuration Status (for health checks)
// ============================================================================

/**
 * Get PII detection configuration status
 */
export function getPIIDetectionStatus(): {
  enabled: boolean;
  config: {
    failOpen: boolean;
    timeoutMs: number;
    blockSocialHandles: boolean;
    allowNames: boolean;
    cloudDLPEnabled: boolean;
  };
} {
  const config = getConfig();
  return {
    enabled: true,
    config,
  };
}
