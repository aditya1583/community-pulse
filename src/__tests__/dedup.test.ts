/**
 * Dedup Logic Tests
 * 
 * Tests the fingerprinting and dedup logic used in refresh-content and auto-seed
 * to prevent duplicate bot posts.
 */

// ============================================================================
// COPY OF PRODUCTION LOGIC (from refresh-content/route.ts)
// ============================================================================

const STOP_WORDS = new Set([
  "the", "a", "an", "at", "in", "on", "for", "of", "to", "and", "or", "is",
  "its", "gonna", "be", "been", "who", "else", "going", "this", "good", "get",
  "lets", "let", "see", "yall", "there", "finally", "something", "fun",
  "happening", "locally", "anyone", "need", "plus", "one", "waiting", "loud",
  "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
  "suites", "vs", "v", "from", "with", "how", "are", "you", "watching",
  "today", "tomorrow", "tonight", "near", "update", "traffic", "weather",
  "alert", "closed", "clear", "mph", "congestion", "data", "open-meteo",
]);

function extractEventFingerprint(message: string): string[] {
  const clean = message
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}:?\s*/gi, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = clean.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort();
}

function fingerprintOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const smaller = Math.min(setA.size, setB.size);
  return intersection / smaller;
}

function isDuplicate(newMsg: string, existingMsg: string, threshold = 0.6): boolean {
  const newFP = extractEventFingerprint(newMsg);
  const existFP = extractEventFingerprint(existingMsg);
  const overlap = fingerprintOverlap(newFP, existFP);
  return overlap >= threshold;
}

function normalizeCity(city: string): string {
  return city.split(",")[0].trim().toLowerCase();
}

// ============================================================================
// AUTO-SEED FINGERPRINT (slightly different implementation)
// ============================================================================

function extractFP_autoSeed(msg: string): string[] {
  const cleaned = msg
    .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}:?\s*/gi, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, "")
    .replace(/[^\w\s]/g, " ").toLowerCase();
  const stops = new Set(["the","a","an","at","in","on","is","and","or","for","to","of","its","was","has","have","been","are","this","that","with","from","your","but","not","all","can","had","her","his","how","its","may","new","now","old","our","own","say","she","too","use","today","tomorrow","tonight","near","update","traffic","weather","alert","closed","clear","mph","congestion"]);
  return [...new Set(cleaned.split(/\s+/).filter(w => w.length > 2 && !stops.has(w) && !/^\d+$/.test(w)))].sort();
}

function fpOverlap_autoSeed(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const inter = a.filter(w => setB.has(w)).length;
  return inter / Math.min(a.length, b.length);
}

function isDuplicate_autoSeed(newMsg: string, existingMsg: string, threshold = 0.6): boolean {
  const newFP = extractFP_autoSeed(newMsg);
  const existFP = extractFP_autoSeed(existingMsg);
  return fpOverlap_autoSeed(newFP, existFP) >= threshold;
}

// ============================================================================
// TESTS
// ============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}`);
  }
}

function section(name: string) {
  console.log(`\n📋 ${name}`);
}

// --- EVENT DEDUP TESTS ---

section("Event Dedup — Same event, different dates");
assert(isDuplicate(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .",
  "Feb 19: Mardi Gras Mambo - The Dirty Dozen Brass Band @ Antone's Nightclub."
), "Mardi Gras Mambo Feb 19 vs Feb 20 (different dates, at vs @)");

assert(isDuplicate(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .",
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub ."
), "Exact same event post");

assert(isDuplicate(
  "Feb 20: Los Lonely Boys w/ Texican Legacy @ Antone's Nightclub.",
  "Feb 21: Los Lonely Boys w/ Texican Legacy at Antone's Nightclub."
), "Los Lonely Boys different dates");

section("Event Dedup — Different events should NOT match");
assert(!isDuplicate(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub",
  "Feb 20: Los Lonely Boys w/ Texican Legacy @ Antone's Nightclub"
), "Mardi Gras vs Los Lonely Boys (different events, same venue)");

assert(!isDuplicate(
  "🚗 Lamar Blvd: 14 mph near The Domain.",
  "☀️ 84°F and clear in Austin."
), "Traffic vs Weather (completely different)");

assert(!isDuplicate(
  "Cimarron Trl: Closed",
  "W Ben White Blvd / Victory Dr: Closed"
), "Different road closures");

// --- WEATHER DEDUP TESTS ---

section("Weather Dedup — Same info, different wording");
assert(isDuplicate(
  "☀️ 84°F and clear in Austin.",
  "Cloudy today, no precipitation in the forecast."
) === false, "Different weather conditions should NOT match");

assert(isDuplicate(
  "☀️ 84°F and clear in Austin.",
  "☀️ 85°F and clear in Austin."
), "Nearly identical weather (1 degree diff)");

// --- TRAFFIC DEDUP TESTS ---

section("Traffic Dedup — Same road");
assert(isDuplicate(
  "🚗 Lamar Blvd: 14 mph near The Domain.",
  "🚗 Lamar Blvd: 18 mph near The Domain."
), "Same road, different speed");

assert(isDuplicate(
  "🚗 San Gabriel Pkwy at 25% congestion near Lowe's on 183.",
  "🚗 San Gabriel Pkwy at 30% congestion near Lowe's on 183."
), "Same road, different congestion %");

assert(!isDuplicate(
  "🚗 Lamar Blvd: 14 mph near The Domain.",
  "🚗 San Gabriel Pkwy at 25% congestion near Lowe's on 183."
), "Different roads should NOT match");

// --- CITY NORMALIZATION TESTS ---

section("City Normalization");
assert(normalizeCity("Austin, Texas") === "austin", "Austin, Texas → austin");
assert(normalizeCity("Austin, TX, US") === "austin", "Austin, TX, US → austin");
assert(normalizeCity("Leander, Texas, US") === "leander", "Leander, Texas, US → leander");
assert(normalizeCity("Gandipet mandal, Telangana") === "gandipet mandal", "Gandipet mandal, Telangana");
assert(
  normalizeCity("Austin, Texas") === normalizeCity("Austin, TX, US"),
  "Austin, Texas === Austin, TX, US after normalization"
);
assert(
  normalizeCity("Austin, Texas") !== normalizeCity("Leander, Texas"),
  "Austin !== Leander"
);

// --- DATE STRIPPING TESTS ---

section("Date Stripping in Fingerprints");
const fp1 = extractEventFingerprint("Feb 19: Mardi Gras Mambo - The Dirty Dozen Brass Band @ Antone's Nightclub.");
const fp2 = extractEventFingerprint("Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .");
assert(
  JSON.stringify(fp1) === JSON.stringify(fp2),
  `Fingerprints identical after date strip: [${fp1.join(",")}] vs [${fp2.join(",")}]`
);

const fp3 = extractEventFingerprint("🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .");
assert(
  JSON.stringify(fp1) === JSON.stringify(fp3),
  "Emoji prefix doesn't affect fingerprint"
);

// --- AUTO-SEED DEDUP (separate implementation) ---

section("Auto-Seed Dedup — Same tests with auto-seed implementation");
assert(isDuplicate_autoSeed(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .",
  "Feb 19: Mardi Gras Mambo - The Dirty Dozen Brass Band @ Antone's Nightclub."
), "Auto-seed: Mardi Gras Feb 19 vs Feb 20");

assert(!isDuplicate_autoSeed(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub",
  "Feb 20: Los Lonely Boys w/ Texican Legacy @ Antone's Nightclub"
), "Auto-seed: Different events at same venue");

// --- FUN FACT DETECTION ---

section("Fun Fact / Engagement Bait Detection");
const funFactPatterns = ["BTW:", "Fun fact:", "Did you know?", "Trivia:", "Random fact:"];
function containsFunFact(msg: string): boolean {
  return funFactPatterns.some(p => msg.includes(p));
}

assert(containsFunFact("🚗 Lamar Blvd: 14 mph near The Domain.\n\n✨ BTW: Lamar Blvd is named after..."), "Detects BTW fun fact");
assert(containsFunFact("💡 Fun fact: Leander averages 229 sunny days per year"), "Detects Fun fact");
assert(containsFunFact("🤓 Did you know? South 1st St..."), "Detects Did you know");
assert(!containsFunFact("☀️ 84°F and clear in Austin."), "Clean weather post — no fun fact");
assert(!containsFunFact("🚗 Lamar Blvd: 14 mph near The Domain."), "Clean traffic post — no fun fact");

// --- EXPIRATION LOGIC ---

section("Expiration Logic");
function getExpirationHours(tag: string): number {
  const t = tag.toLowerCase();
  if (t === "weather") return 3;
  if (t === "traffic") return 3;
  if (t === "events") return 12;
  return 8;
}

assert(getExpirationHours("Weather") === 3, "Weather expires in 3h");
assert(getExpirationHours("Traffic") === 3, "Traffic expires in 3h");
assert(getExpirationHours("Events") === 12, "Events expires in 12h");
assert(getExpirationHours("General") === 8, "General expires in 8h");

// --- EDGE CASES ---

section("Edge Cases");
assert(!isDuplicate("", ""), "Empty strings don't crash");
assert(!isDuplicate("hi", "hello"), "Very short messages don't false-positive");
assert(!isDuplicate(
  "🚗 Crystal Falls Pkwy: 44 mph near HEB Plus on Hero Way.",
  "🌧️ Rain — reduced visibility on RM 2243."
), "Traffic vs Weather alert — different content");

// --- REGRESSION: The actual duplicates Ady saw ---

section("REGRESSION — Actual duplicates from production");
assert(isDuplicate(
  "🎵 Feb 20: Mardi Gras Mambo - The Dirty Dozen Brass Band at Antone's Nightclub .",
  "Feb 19: Mardi Gras Mambo - The Dirty Dozen Brass Band @ Antone's Nightclub."
), "REGRESSION: Mardi Gras duplicate that appeared in feed");

assert(isDuplicate(
  "🚗 Lamar Blvd: 14 mph near The Domain.\n\n✨ BTW: Lamar Blvd is named after Mirabeau B. Lamar",
  "🚗 Lamar Blvd: 14 mph near The Domain."
), "REGRESSION: Same traffic post with vs without fun fact");

assert(isDuplicate(
  "🚗 Bagdad Rd at 0% congestion near Lowe's on 183.\n\n💡 Fun fact: Bagdad Rd in Leander...",
  "🚗 Bagdad Rd at 0% congestion near Lowe's on 183."
), "REGRESSION: Bagdad Rd with vs without fun fact");

// ============================================================================
// RESULTS
// ============================================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length > 0) {
  console.log(`\nFAILURES:`);
  failures.forEach(f => console.log(`  ❌ ${f}`));
}
console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
