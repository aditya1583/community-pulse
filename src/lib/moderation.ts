/**
 * Content moderation utilities for pulse posts
 * Server-side guardrail to prevent profanity and abusive content
 * ENHANCED VERSION with better obfuscation detection
 */

const FRIENDLY_DISALLOWED_LANGUAGE =
  "Please keep your message friendly and respectful.";
const FRIENDLY_DISALLOWED_CONTENT = "This type of content is not allowed.";

// Comprehensive profanity list - explicit words that should NEVER be allowed
// NOTE: keep these canonical (a-z only) because we run them against normalized text.
const EXPLICIT_PROFANITY = [
  // Common explicit words
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "fuckers",
  "fucks",
  "shit",
  "shits",
  "shitty",
  "shitting",
  "bullshit",
  "ass",
  "asshole",
  "assholes",
  "asses",
  "jackass",
  "jackasses",
  "bitch",
  "bitches",
  "bitchy",
  "bitching",
  "damn",
  "damned",
  "damnit",
  "goddamn",
  "goddamnit",
  "bastard",
  "bastards",
  "crap",
  "crappy",
  "dick",
  "dicks",
  "dickhead",
  "dickheads",
  "cock",
  "cocks",
  "cocksucker",
  "cunt",
  "cunts",
  "piss",
  "pissed",
  "pissing",
  "whore",
  "whores",
  "slut",
  "sluts",
  "slutty",
  "motherfucker",
  "motherfuckers",
  "motherfucking",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "fag",
  "fags",
  "retard",
  "retards",
  "retarded",
  "kike",
  "kikes",
  "spic",
  "spics",
  "chink",
  "chinks",
  "wetback",
  "wetbacks",
  // Common variants (kept small on purpose)
  "fuk",
  "phuck",
  "phuk",
];

const EXPLICIT_PROFANITY_TOKEN_REGEXES = EXPLICIT_PROFANITY.map(
  (word) => new RegExp(`\\b${escapeRegex(word)}\\b`, "i")
);

// Regexes for spaced / punctuated / lightly-obfuscated profanity.
// Run these on a leetspeak-normalized string that still retains separators.
const SEP = "[^a-z0-9]*";
const OBFUSCATED_PROFANITY_PATTERNS = [
  // f u c k, f*ck, f__ck, etc.
  new RegExp(`f${SEP}(?:u+${SEP})?c${SEP}k`, "i"),
  // m o t h e r f u c k e r, m*therf*cker, etc.
  new RegExp(
    `m${SEP}(?:o${SEP})?t${SEP}h${SEP}e${SEP}r${SEP}f${SEP}(?:u${SEP})?c${SEP}k${SEP}e${SEP}r`,
    "i"
  ),
  // a s s h o l e, @$$hole, etc.
  new RegExp(`a${SEP}s${SEP}s${SEP}(?:h${SEP})?o${SEP}l${SEP}e`, "i"),
  // Enhanced: b i t c h
  new RegExp(`b${SEP}i${SEP}t${SEP}c${SEP}h`, "i"),
  // Enhanced: s h i t
  new RegExp(`s${SEP}h${SEP}i${SEP}t`, "i"),
];

// Harassment phrases we want to block even when the user uses shorthand "f".
const HARASSMENT_SEQUENCES: Array<readonly string[]> = [
  ["go", "f", "off"],
  ["go", "fuck", "off"],
  ["f", "off"],
  ["fuck", "off"],
  ["go", "f", "your"],
  ["go", "fuck", "your"],
  ["f", "you"],
  ["fuck", "you"],
  ["f", "u"],
  ["fuck", "u"],
];

// ENHANCED: Extended fuzzy matching targets with phonetic variations
const FUZZY_TARGETS = [
  "asshole",
  "ashole", // common typo
  "azzhole",
  "ahole",
  "bitch",
  "biatch",
  "biotch",
  "fuck",
  "fuk",
  "fck",
  "shit",
  "shyt",
  "sht",
];

// ENHANCED: Phonetic similarity map for character substitutions
// Maps confusable characters to their canonical form
const PHONETIC_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/[óòöôõ]/g, "o"],
  [/[áàäâã]/g, "a"],
  [/[éèëê]/g, "e"],
  [/[íìïî]/g, "i"],
  [/[úùüû]/g, "u"],
  [/[ñ]/g, "n"],
  [/[ç]/g, "c"],
  // Cyrillic lookalikes
  [/[а]/g, "a"], // Cyrillic 'a'
  [/[е]/g, "e"], // Cyrillic 'e'
  [/[о]/g, "o"], // Cyrillic 'o'
  [/[р]/g, "p"], // Cyrillic 'r'
  [/[с]/g, "c"], // Cyrillic 's'
  [/[х]/g, "x"], // Cyrillic 'h'
  // Greek lookalikes
  [/[α]/g, "a"],
  [/[ε]/g, "e"],
  [/[ο]/g, "o"],
  // Visual confusion pairs
  [/[₀]/g, "0"],
  [/[¹]/g, "1"],
  // Common letter substitutions for obfuscation
  [/[h]/g, ""], // 'h' is often silent or used for spacing: "asshole" → "assole"
];

// ENHANCED: Common character substitution patterns
const SUBSTITUTION_MAP: { [key: string]: string[] } = {
  a: ["4", "@", "а", "α"],
  e: ["3", "е", "ε"],
  i: ["1", "!", "l", "í", "ì"],
  o: ["0", "о", "ο", "ó", "ò"],
  s: ["5", "$", "с"],
  t: ["7", "+"],
  b: ["8", "в"],
  g: ["9", "6"],
  l: ["1", "!", "|"],
  z: ["2"],
};

// Patterns for more complex detection (hate speech, threats)
const ABUSE_PATTERNS = [
  /kill\s+(your)?self/i,
  /go\s+die/i,
  /i('ll)?\s+kill\s+you/i,
  /hope\s+you\s+die/i,
  /kys\b/i, // "kill yourself" abbreviation
];

const SOLICITATION_TOKEN_SEQUENCES: Array<readonly string[]> = [
  ["date", "anyone"],
  ["anyone", "up", "for", "a", "date"],
  ["anyone", "up", "for", "date"],
  ["looking", "for", "a", "date"],
  ["looking", "for", "date"],

  ["looking", "for", "a", "hookup"],
  ["looking", "for", "hookup"],
  ["looking", "for", "a", "hook", "up"],
  ["looking", "for", "hook", "up"],
  ["anyone", "up", "for", "a", "hookup"],
  ["anyone", "up", "for", "hookup"],
  ["anyone", "up", "for", "a", "hook", "up"],
  ["anyone", "up", "for", "hook", "up"],
  ["f", "w", "b"],

  ["let", "s", "have", "sex"],
  ["lets", "have", "sex"],
  ["send", "nudes"],
  ["send", "nude"],
  ["meet", "me", "tonight"],
];

const SOLICITATION_SINGLE_TOKENS = ["fwb"];

export type ModerationResult = {
  allowed: boolean;
  reason?: string;
};

type ModerationView = {
  leet: string;
  normalized: string;
  tokens: string[];
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

  const trimmed = content.trim();
  const text = normalizeBase(trimmed);

  if (!text) {
    return { allowed: false, reason: "Content cannot be empty" };
  }

  const views = buildModerationViews(text);

  for (const view of views) {
    if (detectSolicitationIntent(view.tokens)) {
      return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
    }

    // Check abuse patterns (threats, self-harm, etc.)
    for (const pattern of ABUSE_PATTERNS) {
      if (pattern.test(view.leet)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_CONTENT };
      }
    }

    // Check harassment phrases ("go f off", "f you", etc.)
    for (const seq of HARASSMENT_SEQUENCES) {
      if (includesTokenSequence(view.tokens, seq)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }

    // Check spaced/punctuated profanity attempts
    for (const pattern of OBFUSCATED_PROFANITY_PATTERNS) {
      if (pattern.test(view.leet)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }

    // Check explicit profanity against tokenized text (word boundary safe)
    const tokenText = view.tokens.join(" ");
    for (const regex of EXPLICIT_PROFANITY_TOKEN_REGEXES) {
      if (regex.test(tokenText)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }

    // Check explicit profanity in fully-normalized string to catch spaced-out letters.
    // Avoid short substrings (e.g., "ass") to prevent false positives like "grass".
    for (const word of EXPLICIT_PROFANITY) {
      if (word.length < 4) continue;
      if (view.normalized.includes(word)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }

    // ENHANCED: Check for phonetically similar profanity
    const phoneticText = applyPhoneticNormalization(view.normalized);
    for (const word of EXPLICIT_PROFANITY) {
      if (word.length < 4) continue;
      if (phoneticText.includes(word)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }

    // Extended fuzzy match for common misspellings and substitutions
    for (const token of view.tokens) {
      for (const target of FUZZY_TARGETS) {
        if (token === target) continue;
        // Check edit distance
        if (isEditDistanceAtMost1(token, target)) {
          return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
        }
        // ENHANCED: Check edit distance of 2 for longer words
        if (target.length >= 6 && isEditDistanceAtMost2(token, target)) {
          return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
        }
      }
    }

    // ENHANCED: Check for character-by-character substitution patterns
    for (const token of view.tokens) {
      if (token.length < 4) continue;
      if (hasSubstitutionPattern(token)) {
        return { allowed: false, reason: FRIENDLY_DISALLOWED_LANGUAGE };
      }
    }
  }

  return { allowed: true };
}

/**
 * ENHANCED: Apply phonetic normalization to catch lookalike characters
 */
function applyPhoneticNormalization(text: string): string {
  let normalized = text;
  for (const [pattern, replacement] of PHONETIC_SUBSTITUTIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

/**
 * ENHANCED: Check if a token matches profanity with character substitutions
 */
function hasSubstitutionPattern(token: string): boolean {
  // Generate variations of the token by reversing common substitutions
  const variations = generateSubstitutionVariations(token);

  for (const variation of variations) {
    for (const profanity of EXPLICIT_PROFANITY) {
      if (profanity.length < 4) continue;
      if (variation === profanity) {
        return true;
      }
      // Also check with edit distance for robustness
      if (profanity.length >= 6 && isEditDistanceAtMost1(variation, profanity)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * ENHANCED: Generate variations of a token based on substitution patterns
 */
function generateSubstitutionVariations(token: string): string[] {
  const variations = new Set<string>();
  variations.add(token);

  // Apply reverse substitutions (e.g., "4" -> "a", "0" -> "o")
  let current = token;
  current = current
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g");
  variations.add(current);

  // Try removing common spacing characters (h is often used: "asshole" -> "ashole")
  if (token.includes("h")) {
    variations.add(token.replace(/h/g, ""));
  }

  // Try common phonetic substitutions
  const phonetic = current
    .replace(/ph/g, "f")
    .replace(/kn/g, "n")
    .replace(/ck/g, "k");
  variations.add(phonetic);

  return Array.from(variations);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBase(input: string): string {
  let normalized = stripDiacritics(input.toLowerCase());
  // ENHANCED: Apply phonetic normalization early
  normalized = applyPhoneticNormalization(normalized);
  return normalized;
}

function stripDiacritics(input: string): string {
  // NFKD splits diacritics into separate codepoints; strip common combining marks.
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function applyLeetspeakReplacements(
  input: string,
  oneReplacement: "i" | "l"
): string {
  // ENHANCED: More comprehensive character substitution
  return input
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, oneReplacement)
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    // Phonetic/visual substitutions
    .replace(/ph/g, "f")
    .replace(/kn/g, "n")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw");
}

function collapseRepeatedChars(input: string): string {
  // Collapse long repeated runs: "fuuuck" -> "fuck" (keep legitimate doubles like "off").
  return input.replace(/([a-z0-9])\1{2,}/g, "$1");
}

function buildModerationViews(text: string): ModerationView[] {
  // Requirement: 1 -> i/l. We generate both variants to reduce false negatives.
  const variants: Array<"i" | "l"> = text.includes("1") ? ["i", "l"] : ["i"];

  return variants.map((oneReplacement) => {
    const leet = applyLeetspeakReplacements(text, oneReplacement);

    const tokens = leet
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => collapseRepeatedChars(t));

    const normalized = collapseRepeatedChars(leet.replace(/[^a-z0-9]+/g, ""));

    return { leet, normalized, tokens };
  });
}

function includesTokenSequence(tokens: string[], sequence: readonly string[]) {
  if (sequence.length === 0) return false;
  if (tokens.length < sequence.length) return false;

  for (let i = 0; i <= tokens.length - sequence.length; i += 1) {
    let ok = true;
    for (let j = 0; j < sequence.length; j += 1) {
      if (tokens[i + j] !== sequence[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function detectSolicitationIntent(tokens: string[]): boolean {
  const normalizeToken = (token: string) => token.toLowerCase().replace(/h/g, "");
  const normalizedTokens = tokens.map(normalizeToken);

  for (const token of SOLICITATION_SINGLE_TOKENS) {
    if (normalizedTokens.includes(normalizeToken(token))) return true;
  }

  for (const seq of SOLICITATION_TOKEN_SEQUENCES) {
    const normalizedSeq = seq.map(normalizeToken);
    if (includesTokenSequence(normalizedTokens, normalizedSeq)) return true;
  }

  return false;
}

function isEditDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;

  const lenA = a.length;
  const lenB = b.length;
  const diff = Math.abs(lenA - lenB);
  if (diff > 1) return false;

  const shorter = lenA <= lenB ? a : b;
  const longer = lenA <= lenB ? b : a;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (shorter.length === longer.length) {
      // substitution
      i += 1;
      j += 1;
    } else {
      // insertion/deletion
      j += 1;
    }
  }

  // Account for trailing character
  if (j < longer.length || i < shorter.length) edits += 1;
  return edits <= 1;
}

/**
 * ENHANCED: Check if edit distance is at most 2
 */
function isEditDistanceAtMost2(a: string, b: string): boolean {
  if (a === b) return true;

  const lenA = a.length;
  const lenB = b.length;
  const diff = Math.abs(lenA - lenB);
  if (diff > 2) return false;

  // Use dynamic programming for edit distance up to 2
  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[lenA][lenB] <= 2;
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
