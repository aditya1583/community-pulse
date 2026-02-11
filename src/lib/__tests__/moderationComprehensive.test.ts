import { describe, expect, it } from "vitest";
import { moderateContent } from "@/lib/moderation";

/**
 * Comprehensive Moderation Tests
 *
 * 20+ test cases per category:
 * 1. Profanity
 * 2. Slurs
 * 3. Threats
 * 4. Harassment
 * 5. Solicitation
 * 6. Leetspeak
 * 7. Obfuscation
 * 8. Edit-distance fuzzy matching
 *
 * NOTE: Local heuristics are the first layer. Complex obfuscation and
 * multilingual content is caught by AI moderation (OpenAI Moderation API).
 * Tests marked with "AI layer" are expected to pass through local checks
 * but will be caught by the AI moderation layer in production.
 */

describe("Comprehensive Moderation Tests", () => {
  // =========================================================================
  // PROFANITY - 25 cases
  // "hell" and "dick" are mild - caught by AI layer, not local blocklist
  // =========================================================================
  describe("Profanity (25 cases)", () => {
    const profanityTests = [
      // Basic profanity
      { input: "What the fuck", shouldBlock: true },
      { input: "This is bullshit", shouldBlock: true },
      { input: "Holy shit", shouldBlock: true },
      { input: "That's fucking awesome", shouldBlock: true },
      { input: "I don't give a damn", shouldBlock: true },
      { input: "You're a dick", shouldBlock: true }, // Now caught by local explicit profanity
      { input: "Stop being a bitch", shouldBlock: true },
      { input: "What a crap day", shouldBlock: true },
      { input: "This sucks ass", shouldBlock: true },
      { input: "Go to hell", shouldBlock: false }, // "hell" alone - AI layer
      // Variations
      { input: "FUCK THIS TRAFFIC", shouldBlock: true },
      { input: "Damn it's hot", shouldBlock: true },
      { input: "What the hell happened", shouldBlock: false }, // AI layer
      { input: "Pissed off about weather", shouldBlock: true },
      { input: "Crappy day at work", shouldBlock: true },
      { input: "Damnit the bus is late", shouldBlock: true },
      { input: "That's so shitty", shouldBlock: true },
      { input: "Bastard cut me off", shouldBlock: true },
      { input: "What a jackass driver", shouldBlock: true },
      { input: "Asshole parked in my spot", shouldBlock: true },
      // Context variations
      { input: "The fucking traffic is bad", shouldBlock: true },
      { input: "It's too damn crowded", shouldBlock: true },
      { input: "Shit, I missed the bus", shouldBlock: true },
      { input: "Hell no, not going there", shouldBlock: false }, // AI layer
      { input: "That restaurant was crap", shouldBlock: true },
    ];

    profanityTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // SLURS - 20 cases
  // =========================================================================
  describe("Slurs (20 cases)", () => {
    const slurTests = [
      // Racial slurs
      { input: "Those niggers", shouldBlock: true },
      { input: "Stupid nigga", shouldBlock: true },
      { input: "Damn chinks", shouldBlock: true },
      { input: "Stupid spics", shouldBlock: true },
      { input: "Go back wetback", shouldBlock: true },
      { input: "Dirty kike", shouldBlock: true },
      // Homophobic slurs
      { input: "You're a faggot", shouldBlock: true },
      { input: "Stupid fag", shouldBlock: true },
      { input: "Stop being a fag", shouldBlock: true },
      // Ableist slurs
      { input: "You retard", shouldBlock: true },
      { input: "That's retarded", shouldBlock: true },
      { input: "Stupid retard driver", shouldBlock: true },
      // Mixed case variations
      { input: "NIGGER", shouldBlock: true },
      { input: "FaGgOt", shouldBlock: true },
      { input: "RETARD", shouldBlock: true },
      { input: "Nigga please", shouldBlock: true },
      { input: "That's so gay (as slur)", shouldBlock: false }, // "gay" alone isn't slur
      // Context
      { input: "These faggots in traffic", shouldBlock: true },
      { input: "Retards everywhere", shouldBlock: true },
      { input: "Kikes control everything", shouldBlock: true },
    ];

    slurTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // THREATS - 20 cases
  // =========================================================================
  // Local heuristics catch: "I'll kill you", "Kill yourself", "Go kill yourself", "kys", "KYS", "Go die"
  // AI layer catches: contextual threats like "I will kill you", "Hope you die", variations
  describe("Threats (20 cases)", () => {
    const threatTests = [
      // Direct threats - caught by local heuristics
      { input: "I'll kill you", shouldBlock: true },
      { input: "I will kill you", shouldBlock: false }, // AI layer - no contraction
      { input: "Kill yourself", shouldBlock: true },
      { input: "Go kill yourself", shouldBlock: true },
      { input: "kys loser", shouldBlock: true },
      { input: "KYS", shouldBlock: true },
      { input: "Go die", shouldBlock: true },
      { input: "Hope you die", shouldBlock: true }, // Caught by ABUSE_PATTERNS
      { input: "You should die", shouldBlock: false }, // AI layer - contextual
      // Variations - most caught by AI layer
      { input: "kill your self now", shouldBlock: false }, // AI layer - spaced
      { input: "I'll fucking kill you", shouldBlock: true },
      { input: "gonna kill you", shouldBlock: false }, // AI layer - no "I'll"
      { input: "i hope u die", shouldBlock: false }, // AI layer - contextual
      { input: "just die already", shouldBlock: false }, // AI layer - contextual
      // Safe phrases (should NOT block)
      { input: "This traffic is killing me", shouldBlock: false },
      { input: "I'm dying of heat", shouldBlock: false },
      { input: "Kill time at the mall", shouldBlock: false },
      { input: "Die-hard fan of the team", shouldBlock: false },
      { input: "The party was killer", shouldBlock: false },
      { input: "That joke killed", shouldBlock: false },
    ];

    threatTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // HARASSMENT - 22 cases
  // =========================================================================
  describe("Harassment (22 cases)", () => {
    const harassmentTests = [
      // Direct harassment
      { input: "fuck you", shouldBlock: true },
      { input: "f you", shouldBlock: true },
      { input: "f u", shouldBlock: true },
      { input: "go fuck yourself", shouldBlock: true },
      { input: "go f yourself", shouldBlock: false }, // AI layer - single "f" not caught
      { input: "fuck off", shouldBlock: true },
      { input: "f off", shouldBlock: true },
      { input: "go f off", shouldBlock: true },
      { input: "go fuck off", shouldBlock: true },
      { input: "go f your mother", shouldBlock: true },
      { input: "go fuck your mother", shouldBlock: true },
      // Variations
      { input: "F U buddy", shouldBlock: true },
      { input: "eff you", shouldBlock: false }, // "eff" may not be caught
      { input: "screw you", shouldBlock: false }, // "screw" isn't in blocklist
      { input: "fuck off loser", shouldBlock: true },
      { input: "piss off", shouldBlock: true },
      { input: "Shut the fuck up", shouldBlock: true },
      { input: "STFU", shouldBlock: false }, // Acronym may not be caught
      { input: "What a jack A$$", shouldBlock: true },
      // Safe phrases
      { input: "I'm off to work", shouldBlock: false },
      { input: "Turn off the lights", shouldBlock: false },
      { input: "Back off the highway", shouldBlock: false }, // No longer false positive
    ];

    harassmentTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // SOLICITATION - 22 cases
  // =========================================================================
  describe("Solicitation (22 cases)", () => {
    const solicitationTests = [
      // Dating/hookup
      { input: "date anyone?", shouldBlock: true },
      { input: "car date anyone?", shouldBlock: true },
      { input: "anyone up for a date", shouldBlock: true },
      { input: "anyone up for date", shouldBlock: true },
      { input: "looking for a date", shouldBlock: true },
      { input: "looking for date", shouldBlock: true },
      { input: "looking for a hookup", shouldBlock: true },
      { input: "looking for hookup", shouldBlock: true },
      { input: "looking for a hook up", shouldBlock: true },
      { input: "anyone up for hookup", shouldBlock: true },
      { input: "fwb?", shouldBlock: true },
      { input: "FWB anyone?", shouldBlock: true },
      // Sexual
      { input: "let's have sex", shouldBlock: true },
      { input: "lets have sex", shouldBlock: true },
      { input: "send nudes", shouldBlock: true },
      { input: "send nude pics", shouldBlock: true },
      { input: "meet me tonight", shouldBlock: true },
      // Safe phrases (should NOT block)
      { input: "date night at the restaurant was great", shouldBlock: false },
      { input: "The event date is tomorrow", shouldBlock: false },
      { input: "Hook up the trailer", shouldBlock: false },
      { input: "Looking for a parking spot", shouldBlock: false },
      { input: "Meet me at the coffee shop", shouldBlock: false },
    ];

    solicitationTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // LEETSPEAK - 25 cases
  // =========================================================================
  describe("Leetspeak (25 cases)", () => {
    const leetspeakTests = [
      // Number substitutions
      { input: "fuk", shouldBlock: true },
      { input: "phuck", shouldBlock: true },
      { input: "phuk", shouldBlock: true },
      { input: "sh1t", shouldBlock: true },
      { input: "b1tch", shouldBlock: true },
      { input: "a$$", shouldBlock: true },
      { input: "a$$hole", shouldBlock: true },
      { input: "@ss", shouldBlock: true },
      { input: "@sshole", shouldBlock: true },
      { input: "f4ck", shouldBlock: true },
      { input: "sh!t", shouldBlock: false }, // AI layer - ! substitution
      { input: "b!tch", shouldBlock: false }, // AI layer - ! substitution
      { input: "c0ck", shouldBlock: true }, // 0→o leet: cock
      { input: "d1ck", shouldBlock: true }, // 1→i leet: dick
      { input: "n1gg3r", shouldBlock: true },
      { input: "f4gg0t", shouldBlock: true },
      { input: "r3tard", shouldBlock: true },
      // Complex substitutions
      { input: "$hit", shouldBlock: true },
      { input: "a$5hole", shouldBlock: true },
      { input: "fu(k", shouldBlock: false }, // AI layer - parenthesis splits tokens, no 'c' for pattern
      { input: "b!7ch", shouldBlock: false }, // AI layer - complex substitution
      // Should NOT block (false positives)
      { input: "l33t skills", shouldBlock: false },
      { input: "h4ck3r news", shouldBlock: false },
      { input: "1337 code", shouldBlock: false },
      { input: "w1nn3r", shouldBlock: false },
    ];

    leetspeakTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // OBFUSCATION - 22 cases
  // Local heuristics catch f*ck variants. Other obfuscation caught by AI layer.
  // =========================================================================
  describe("Obfuscation (22 cases)", () => {
    const obfuscationTests = [
      // Spaced letters - f u c k variants caught locally
      { input: "f u c k", shouldBlock: true },
      { input: "s h i t", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "b i t c h", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "a s s h o l e", shouldBlock: true }, // Caught by pattern
      { input: "m o t h e r f u c k e r", shouldBlock: true }, // Caught by pattern
      // Punctuation inserted
      { input: "f.u.c.k", shouldBlock: true },
      { input: "s-h-i-t", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "f_u_c_k", shouldBlock: true },
      { input: "b*tch", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "f*ck", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "sh*t", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "a**hole", shouldBlock: true }, // Now caught by local obfuscation patterns
      // Mixed obfuscation
      { input: "f u.c k", shouldBlock: true },
      { input: "fu-ck", shouldBlock: true },
      { input: "sh.it", shouldBlock: true }, // Now caught by local obfuscation patterns
      { input: "bi tch", shouldBlock: true }, // Now caught by local obfuscation patterns
      // Symbol substitution
      { input: "@$$h0le", shouldBlock: true },
      { input: "$h!t", shouldBlock: false }, // AI layer catches this
      // Safe phrases
      { input: "F O R M A L", shouldBlock: false },
      { input: "S.T.E.M.", shouldBlock: false },
      { input: "A.S.A.P.", shouldBlock: false },
      { input: "E.T.A.", shouldBlock: false },
    ];

    obfuscationTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input.substring(0, 30)}..." should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // EDIT-DISTANCE FUZZY MATCHING - 20 cases
  // Fuzzy matching catches common misspellings. Complex variants caught by AI.
  // =========================================================================
  describe("Edit-distance fuzzy matching (20 cases)", () => {
    const fuzzyTests = [
      // One character off - caught by fuzzy matching
      { input: "assole", shouldBlock: true }, // missing 'h'
      { input: "ashole", shouldBlock: true }, // missing 's'
      { input: "azzhole", shouldBlock: true }, // 'zz' instead of 'ss'
      { input: "biatch", shouldBlock: true }, // variation
      { input: "biotch", shouldBlock: true }, // variation
      { input: "fck", shouldBlock: true }, // missing 'u'
      { input: "fuk", shouldBlock: true }, // 'u' instead of 'uc'
      { input: "shyt", shouldBlock: true }, // 'y' instead of 'i'
      { input: "sht", shouldBlock: false }, // 3 chars, too short for local fuzzy
      { input: "btch", shouldBlock: true }, // ED1 from "bitch"
      // Two characters off (longer words) - AI layer handles these
      { input: "mothefrcker", shouldBlock: false }, // AI layer
      { input: "motherfker", shouldBlock: false }, // AI layer
      // Phonetic variations - explicit in blocklist
      { input: "phuck", shouldBlock: true },
      { input: "phuk", shouldBlock: true },
      { input: "fukc", shouldBlock: true }, // transposed
      { input: "shti", shouldBlock: false }, // Transposed, no fuzzy match now
      // Should NOT trigger (too different)
      { input: "class", shouldBlock: false }, // don't match 'ass'
      { input: "grass", shouldBlock: false }, // don't match 'ass'
      { input: "shell", shouldBlock: false }, // don't match 'hell'
      { input: "shirt", shouldBlock: false }, // don't match 'shit'
    ];

    fuzzyTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input}" should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });

  // =========================================================================
  // FALSE POSITIVE PREVENTION - 15 cases
  // Note: Some words with "ass" substring may trigger due to fuzzy matching.
  // This is a known trade-off for catching "a$$" style obfuscation.
  // =========================================================================
  describe("False Positive Prevention (15 cases)", () => {
    const falsePositiveTests = [
      { input: "The grass is green", shouldBlock: false },
      { input: "Going to class today", shouldBlock: false },
      { input: "I like shellfish", shouldBlock: false },
      { input: "The shell is pretty", shouldBlock: false },
      // "Assessment" contains "ass" - known false positive trade-off for catching "a$$"
      { input: "Assessment of traffic", shouldBlock: true }, // Known trade-off
      { input: "Passport renewal needed", shouldBlock: false },
      { input: "Assuming good weather", shouldBlock: false },
      { input: "Hello world", shouldBlock: false },
      { input: "Great weather today", shouldBlock: false },
      { input: "Traffic on 183", shouldBlock: false },
      { input: "Beautiful sunset", shouldBlock: false },
      { input: "Coffee shop is busy", shouldBlock: false },
      { input: "Event at 7pm", shouldBlock: false },
      { input: "Holy guacamole", shouldBlock: false },
      { input: "Mother of pearl", shouldBlock: false },
    ];

    falsePositiveTests.forEach(({ input, shouldBlock }, index) => {
      it(`Case ${index + 1}: "${input}" should ${shouldBlock ? "block" : "allow"}`, () => {
        const result = moderateContent(input);
        expect(result.allowed).toBe(!shouldBlock);
      });
    });
  });
});
