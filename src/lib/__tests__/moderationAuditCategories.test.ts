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
// Category 6: Dangerous Misinformation
// ============================================================================
describe("Category 6: Dangerous Misinformation", () => {
  it("blocks medical misinformation", () => {
    expectBlocked("drink bleach to cure covid", "drink-bleach");
    expectBlocked("vaccines cause autism in kids", "antivax");
    expectBlocked("5g causes covid spread", "5g-covid");
    expectBlocked("miracle cure for cancer", "miracle-cure");
  });

  it("blocks fake emergencies / bomb threats", () => {
    expectBlocked("bomb at the school downtown", "bomb-threat");
    expectBlocked("active shooter at the mall", "shooter");
    expectBlocked("there's a bomb in the building", "bomb-building");
  });

  it("blocks election misinformation", () => {
    expectBlocked("the election is rigged", "election-rigged");
    expectBlocked("voting machines are hacked", "voting-hacked");
    expectBlocked("stop the steal", "stop-steal");
  });

  it("allows legitimate content", () => {
    expectAllowed("The weather forecast looks great today", "clean-weather");
    expectAllowed("Election day is coming up, go vote!", "clean-election");
  });
});

// ============================================================================
// Category 7: Spam & Manipulation
// ============================================================================
describe("Category 7: Spam & Manipulation", () => {
  it("blocks crypto pump schemes", () => {
    const r1 = detectPII("crypto pump happening now!");
    expect(r1.blocked).toBe(true);
    expect(r1.categories).toContain("scam");
  });

  it("blocks fake giveaways and engagement bait", () => {
    const r1 = detectPII("free iphone giveaway just follow and share");
    expect(r1.blocked).toBe(true);

    const r2 = detectPII("like and share to win a free gift card");
    expect(r2.blocked).toBe(true);

    const r3 = detectPII("tag 3 friends to enter");
    expect(r3.blocked).toBe(true);
  });

  it("blocks follow-for-follow spam", () => {
    const r1 = detectPII("follow for follow anyone? f4f");
    expect(r1.blocked).toBe(true);
  });

  it("allows legitimate content", () => {
    const r1 = detectPII("I love this community event");
    expect(r1.blocked).toBe(false);
  });
});

// ============================================================================
// Category 8: Personal Information Exposure
// ============================================================================
describe("Category 8: Personal Information Exposure", () => {
  it("blocks email addresses", () => {
    const r = detectPII("email me at test@example.com");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("email");
  });

  it("blocks obfuscated emails", () => {
    const r = detectPII("reach me at test (at) example (dot) com");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("email");
  });

  it("blocks SSN with context", () => {
    const r = detectPII("my ssn is 123-45-6789");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("ssn");
  });

  it("blocks credit card numbers (Luhn valid)", () => {
    const r = detectPII("my card is 4111 1111 1111 1111");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("credit_card");
  });

  it("blocks phone numbers with context", () => {
    const r = detectPII("text me at 512-555-1234");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("phone");
  });

  it("blocks addresses with context", () => {
    const r = detectPII("I live at 123 Main Street");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("address");
  });

  it("blocks social handles", () => {
    const r = detectPII("follow me on instagram: @myhandle");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("social_handle");
  });
});

// ============================================================================
// Category 9: Illegal Activity
// ============================================================================
describe("Category 9: Illegal Activity", () => {
  it("blocks drug sales", () => {
    expectBlocked("selling weed hit me up", "drug-sale-weed");
    expectBlocked("got molly for sale", "drug-sale-molly");
    expectBlocked("plug for xans hmu", "drug-plug");
  });

  it("blocks weapons trafficking", () => {
    expectBlocked("ghost gun for sale no serial", "ghost-gun");
    expectBlocked("selling guns no background check", "gun-sale");
  });

  it("blocks stolen goods", () => {
    expectBlocked("selling stolen phones cheap", "stolen-phones");
    expectBlocked("buy stolen laptops here", "stolen-laptops");
  });

  it("blocks fake ID offers", () => {
    expectBlocked("buy fake ids here", "fake-id");
    expectBlocked("selling fake passport", "fake-passport");
  });

  it("allows legitimate content", () => {
    expectAllowed("New city ordinance approved today", "clean-ordinance");
    expectAllowed("Community health event at the park", "clean-health");
  });
});

// ============================================================================
// Category 10: Platform Manipulation
// ============================================================================
describe("Category 10: Platform Manipulation", () => {
  it("blocks impersonation", () => {
    expectBlocked("I'm the admin of this app", "impersonation-admin");
    expectBlocked("this is the official moderator speaking", "impersonation-mod");
    expectBlocked("official admin announcement", "fake-announcement");
  });

  it("blocks fake authority claims", () => {
    expectBlocked("law enforcement warning: evacuate now", "fake-law-enforcement");
    expectBlocked("official statement from the police department", "fake-official");
  });

  it("allows legitimate content", () => {
    expectAllowed("The admin at my school is nice", "clean-admin");
    expectAllowed("I asked the moderator a question on Reddit", "clean-mod");
  });
});

// ============================================================================
// Unicode / Zero-width evasion
// ============================================================================
describe("Unicode & Zero-width Evasion", () => {
  it("blocks profanity with zero-width chars", () => {
    expectBlocked("f\u200Buck this", "zero-width-fuck");
    expectBlocked("s\u200Bh\u200Bi\u200Bt", "zero-width-shit");
  });

  it("blocks Cyrillic homoglyphs", () => {
    // "fuсk" with Cyrillic 'с'
    expectBlocked("fu\u0441k this", "cyrillic-c-fuck");
    // "аss" with Cyrillic 'а'
    expectBlocked("\u0430sshole", "cyrillic-a-asshole");
  });

  it("blocks emoji substitution in sexual context via blocklist", () => {
    // Sexual emoji combos are caught by blocklist layer's detectSexualEmojiContext
    // Testing that the PII layer catches emoji-only spam
    const r = detectPII("🍆🍑💦");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("spam");
  });

  it("blocks URL shorteners hiding malicious links", () => {
    const r = detectPII("check out this deal at bit.ly/scam123");
    expect(r.blocked).toBe(true);
    expect(r.categories).toContain("scam");
  });

  it("blocks multilingual slurs — Spanish", () => {
    expectBlocked("eres un pinche pendejo", "spanish-slur");
    expectBlocked("hijo de puta", "spanish-puta");
  });

  it("blocks multilingual slurs — Hindi", () => {
    expectBlocked("tu chutiya hai", "hindi-chutiya");
    expectBlocked("madarchod saala", "hindi-mc");
  });
});
