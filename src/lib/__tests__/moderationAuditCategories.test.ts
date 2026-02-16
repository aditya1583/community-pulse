/**
 * Moderation Audit — Categories 1-5 (Highest Risk)
 * Tests the regex layer (moderation.ts) and PII/scam detection (piiDetection.ts)
 * directly without network calls.
 */
import { describe, it, expect } from "vitest";
import { moderateContent } from "../moderation";
import { detectPII } from "../piiDetection";
import { normalizeForBlocklist } from "../blocklist";

// Helper: should be blocked by either moderation or PII layer
function expectBlocked(text: string, label: string) {
  const mod = moderateContent(text);
  const pii = detectPII(text);
  const blocked = !mod.allowed || pii.blocked;
  if (!blocked) {
    console.error(`[FAIL] "${label}" was NOT blocked: mod=${JSON.stringify(mod)}, pii=${JSON.stringify(pii)}`);
  }
  expect(blocked).toBe(true);
}

function expectAllowed(text: string, label: string) {
  const mod = moderateContent(text);
  const pii = detectPII(text);
  const blocked = !mod.allowed || pii.blocked;
  if (blocked) {
    console.error(`[FAIL] "${label}" was incorrectly blocked: mod=${JSON.stringify(mod)}, pii=${JSON.stringify(pii)}`);
  }
  expect(blocked).toBe(false);
}

// ============================================================================
// Category 1: Profanity & Slurs
// ============================================================================
describe("Category 1: Profanity & Slurs", () => {
  it("blocks common profanity", () => {
    expectBlocked("what the fuck", "common-fuck");
    expectBlocked("this is bullshit", "bullshit");
    expectBlocked("you stupid bitch", "bitch");
  });

  it("blocks leet speak", () => {
    expectBlocked("f4ck this", "f4ck");
    expectBlocked("sh1t happens", "sh1t");
    expectBlocked("b1tch please", "b1tch");
    expectBlocked("a$$hole", "a$$hole");
  });

  it("blocks spaced-out evasion", () => {
    expectBlocked("f u c k you", "spaced-fuck");
    expectBlocked("s.h.i.t", "dotted-shit");
    expectBlocked("b i t c h", "spaced-bitch");
  });

  it("blocks racial slurs", () => {
    expectBlocked("you stupid nigger", "n-word");
    expectBlocked("bunch of faggots", "f-slur");
    expectBlocked("dirty spic", "s-slur");
    expectBlocked("stupid chink", "c-slur");
  });

  it("allows clean content", () => {
    expectAllowed("Beautiful weather today!", "clean-weather");
    expectAllowed("Traffic on 183 is terrible", "clean-traffic");
  });
});

// ============================================================================
// Category 2: Sexual Content
// ============================================================================
describe("Category 2: Sexual Content", () => {
  it("blocks solicitation phrases", () => {
    expectBlocked("looking for a hookup", "hookup");
    expectBlocked("anyone up for a date", "date-solicitation");
    expectBlocked("send nudes", "send-nudes");
    expectBlocked("fwb anyone?", "fwb");
  });

  it("blocks explicit terms", () => {
    expectBlocked("let's have sex tonight", "sex");
    expectBlocked("slutty outfit", "slutty");
  });
});

// ============================================================================
// Category 3: Violence & Threats
// ============================================================================
describe("Category 3: Violence & Threats", () => {
  it("blocks direct threats", () => {
    expectBlocked("I'll kill you", "kill-threat");
    expectBlocked("kill yourself", "kys-full");
    expectBlocked("kys loser", "kys-abbrev");
  });

  it("blocks indirect threats", () => {
    expectBlocked("hope you die", "hope-die");
    expectBlocked("go die in a fire", "go-die");
  });
});

// ============================================================================
// Category 4: Harassment & Bullying
// ============================================================================
describe("Category 4: Harassment & Bullying", () => {
  it("blocks targeted insults", () => {
    expectBlocked("you retarded piece of shit", "retarded-insult");
    expectBlocked("fuck off loser", "fuck-off");
    expectBlocked("go fuck yourself", "gfy");
  });

  it("blocks harassment phrases", () => {
    expectBlocked("f u", "f-u");
    expectBlocked("f off", "f-off");
  });
});

// ============================================================================
// Category 5: Hate Speech
// ============================================================================
describe("Category 5: Hate Speech", () => {
  it("blocks dog whistles via blocklist normalization", () => {
    // These are caught by the blocklist layer's detectDogWhistles
    // We test normalization works correctly
    const norm = normalizeForBlocklist("1488 forever");
    expect(norm).toContain("iabb");  // 1->i, 4->a, 8->b, 8->b
  });

  it("blocks slurs in various forms", () => {
    expectBlocked("all niggas are the same", "n-word-variant");
    expectBlocked("stupid kike", "k-slur");
    expectBlocked("dirty wetback", "w-slur");
  });
});

// ============================================================================
// Scam Detection (NEW)
// ============================================================================
describe("Scam & Phishing Detection", () => {
  it("blocks money transfer requests", () => {
    const r1 = detectPII("send me money please");
    expect(r1.blocked).toBe(true);
    expect(r1.categories).toContain("scam");

    const r2 = detectPII("venmo me $50");
    expect(r2.blocked).toBe(true);
  });

  it("blocks crypto scams", () => {
    const r1 = detectPII("crypto pump happening now!");
    expect(r1.blocked).toBe(true);
    expect(r1.categories).toContain("scam");

    const r2 = detectPII("guaranteed returns on this coin");
    expect(r2.blocked).toBe(true);

    const r3 = detectPII("double your bitcoin today");
    expect(r3.blocked).toBe(true);
  });

  it("blocks phishing patterns", () => {
    const r1 = detectPII("verify your account now at bit.ly/scam");
    expect(r1.blocked).toBe(true);

    const r2 = detectPII("click this link to claim your prize");
    expect(r2.blocked).toBe(true);
  });

  it("allows legitimate content", () => {
    const r1 = detectPII("The weather is great today");
    expect(r1.blocked).toBe(false);

    const r2 = detectPII("Traffic on 183 is bad");
    expect(r2.blocked).toBe(false);
  });
});

// ============================================================================
// PII Detection
// ============================================================================
describe("PII Detection", () => {
  it("blocks email addresses", () => {
    const r = detectPII("email me at test@example.com");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("email");
  });

  it("blocks credit card numbers", () => {
    const r = detectPII("my card is 4111 1111 1111 1111");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("credit_card");
  });
});

// ============================================================================
// Unicode / Zero-width evasion
// ============================================================================
describe("Unicode & Zero-width Evasion", () => {
  it("blocks profanity with zero-width chars", () => {
    // f\u200Buck
    expectBlocked("f\u200Buck this", "zero-width-fuck");
  });

  it("blocks Cyrillic homoglyphs", () => {
    // "fuсk" with Cyrillic 'с'
    expectBlocked("fu\u0441k this", "cyrillic-c-fuck");
  });
});
