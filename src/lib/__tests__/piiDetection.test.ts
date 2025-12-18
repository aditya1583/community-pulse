import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  detectPII,
  hashContentForLogging,
  logPIIDetection,
  getPIIDetectionStatus,
  type PIIDetectionResult,
} from "@/lib/piiDetection";

/**
 * PII Detection Tests - Comprehensive Bypass Prevention
 *
 * These tests verify the PII detection layer that runs BEFORE content moderation.
 * Tests cover ALL bypass cases from the requirements:
 *
 * Email Detection (must BLOCK all):
 * - test @ example.com
 * - test@ example.com
 * - test @ example . com
 * - test(at)example(dot)com
 * - test at example dot com
 * - reach me: t e s t @ e x a m p l e . c o m
 * - my mail is hello + cp @ domain . co
 *
 * Phone Detection (must BLOCK all, context-gated):
 * - text me 5 1 2 5 5 5 1 2 1 2
 * - call at 5 1 2 - 5 5 5 - 1 2 1 2
 * - my # is 5 1 2 5 5 5 1 2 1 2
 *
 * SSN Detection (must BLOCK, context-gated):
 * - SSN 123456789
 * - SSN: 1 2 3 - 4 5 - 6 7 8 9
 * - my social is 1 2 3 4 5 6 7 8 9
 *
 * False Positive Fix (must ALLOW):
 * - my score is 123 45 6789
 * - I ran 123 45 6789 steps
 *
 * Credit Card Detection (must BLOCK):
 * - card: 4 0 1 2 - 8 8 8 8 - 8 8 8 8 - 1 8 8 1 (Luhn valid)
 *
 * Social Handles (must BLOCK):
 * - IG is @myhandle
 * - IG is @ myhandle
 *
 * Addresses (must BLOCK with context):
 * - address - 183 N hwy
 * - come to 183 N hwy
 * - my apartment is 183 N hwy
 *
 * Spam/Nonsense (must BLOCK):
 * - #^*&^!@#^!@#
 * - .
 * - !!!!
 * - aaaaaaaaaaaaaaaaaaaa
 * - lanjodka
 */

describe("PII Detection - Bypass Prevention Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PII_FAIL_OPEN;
    delete process.env.PII_BLOCK_SOCIAL_HANDLES;
    delete process.env.PII_ALLOW_NAMES;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ===========================================================================
  // EMAIL DETECTION - Must block ALL obfuscated variants
  // ===========================================================================
  describe("Email Detection - Obfuscation Bypass Prevention", () => {
    it("blocks 'test @ example.com' (space before @)", () => {
      const result = detectPII("test @ example.com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'test@ example.com' (space after @)", () => {
      const result = detectPII("test@ example.com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'test @ example . com' (spaces around @ and .)", () => {
      const result = detectPII("test @ example . com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'test(at)example(dot)com' (parenthetical at/dot)", () => {
      const result = detectPII("test(at)example(dot)com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'test at example dot com' (word at/dot)", () => {
      const result = detectPII("test at example dot com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'reach me: t e s t @ e x a m p l e . c o m' (spaced letters)", () => {
      const result = detectPII("reach me: t e s t @ e x a m p l e . c o m");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks 'my mail is hello + cp @ domain . co' (plus sign in email)", () => {
      const result = detectPII("my mail is hello + cp @ domain . co");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks standard email addresses", () => {
      const result = detectPII("Contact me at john@example.com");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("blocks email with subdomain", () => {
      const result = detectPII("Email: user.name@mail.company.co.uk");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("allows text without email addresses", () => {
      const result = detectPII("Great weather today!");
      expect(result.blocked).toBe(false);
      expect(result.categories).not.toContain("email");
    });
  });

  // ===========================================================================
  // PHONE DETECTION - Context-gated to prevent false positives
  // ===========================================================================
  describe("Phone Detection - Context-Gated Obfuscation", () => {
    it("blocks 'text me 5 1 2 5 5 5 1 2 1 2' (spaced digits with context)", () => {
      const result = detectPII("text me 5 1 2 5 5 5 1 2 1 2");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("blocks 'call at 5 1 2 - 5 5 5 - 1 2 1 2' (spaced with dashes)", () => {
      const result = detectPII("call at 5 1 2 - 5 5 5 - 1 2 1 2");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("blocks 'my # is 5 1 2 5 5 5 1 2 1 2' (hash symbol context)", () => {
      const result = detectPII("my # is 5 1 2 5 5 5 1 2 1 2");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("blocks 'my number: 5125551212' (standard format with context)", () => {
      const result = detectPII("my number: 5125551212");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("blocks 'Call me at (555) 123-4567'", () => {
      const result = detectPII("Call me at (555) 123-4567");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("blocks 'WhatsApp: +15551234567' (E.164)", () => {
      const result = detectPII("WhatsApp: +15551234567");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("ALLOWS 'my score is 123 45 6789' (NO phone context)", () => {
      const result = detectPII("my score is 123 45 6789");
      expect(result.categories).not.toContain("phone");
    });

    it("ALLOWS 'I ran 123 45 6789 steps' (NO phone context)", () => {
      const result = detectPII("I ran 123 45 6789 steps");
      expect(result.categories).not.toContain("phone");
    });

    it("ALLOWS 'Traffic on 512' (no phone context)", () => {
      const result = detectPII("Traffic on 512");
      expect(result.categories).not.toContain("phone");
    });

    it("ALLOWS 'bus 512 arrives at 3pm' (no phone context)", () => {
      const result = detectPII("bus 512 arrives at 3pm");
      expect(result.categories).not.toContain("phone");
    });
  });

  // ===========================================================================
  // SSN DETECTION - Context-gated
  // ===========================================================================
  describe("SSN Detection - Context-Gated", () => {
    it("blocks 'SSN 123456789' (SSN context, 9 digits)", () => {
      const result = detectPII("SSN 123456789");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("blocks 'SSN: 1 2 3 - 4 5 - 6 7 8 9' (spaced with dashes)", () => {
      const result = detectPII("SSN: 1 2 3 - 4 5 - 6 7 8 9");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("blocks 'my social is 1 2 3 4 5 6 7 8 9' (spaced digits)", () => {
      const result = detectPII("my social is 1 2 3 4 5 6 7 8 9");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("blocks 'SSN: 123-45-6789' (standard format)", () => {
      const result = detectPII("SSN: 123-45-6789");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("blocks 'My social security is 123 45 6789'", () => {
      const result = detectPII("My social security is 123 45 6789");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("ALLOWS 'my score is 123 45 6789' (NO SSN context)", () => {
      const result = detectPII("my score is 123 45 6789");
      expect(result.categories).not.toContain("ssn");
    });

    it("ALLOWS 'I ran 123 45 6789 steps' (NO SSN context)", () => {
      const result = detectPII("I ran 123 45 6789 steps");
      expect(result.categories).not.toContain("ssn");
    });

    it("ALLOWS 'Transaction ID: 123456789' (NO SSN context)", () => {
      const result = detectPII("Transaction ID: 123456789");
      expect(result.categories).not.toContain("ssn");
    });
  });

  // ===========================================================================
  // CREDIT CARD DETECTION - Luhn validated
  // ===========================================================================
  describe("Credit Card Detection - Luhn Validation", () => {
    it("blocks 'card: 4 0 1 2 - 8 8 8 8 - 8 8 8 8 - 1 8 8 1' (spaced valid card)", () => {
      // 4012888888881881 passes Luhn
      const result = detectPII("card: 4 0 1 2 - 8 8 8 8 - 8 8 8 8 - 1 8 8 1");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("credit_card");
    });

    it("blocks valid Visa: 4111111111111111", () => {
      const result = detectPII("Card: 4111111111111111");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("credit_card");
    });

    it("blocks valid Visa with spaces: 4111 1111 1111 1111", () => {
      const result = detectPII("Pay with 4111 1111 1111 1111");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("credit_card");
    });

    it("blocks valid Mastercard: 5500000000000004", () => {
      const result = detectPII("MC: 5500000000000004");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("credit_card");
    });

    it("blocks valid Amex: 340000000000009", () => {
      const result = detectPII("Amex: 340000000000009");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("credit_card");
    });

    it("ALLOWS invalid card (Luhn fails): 1234567890123456", () => {
      const result = detectPII("Number: 1234567890123456");
      expect(result.categories).not.toContain("credit_card");
    });

    it("ALLOWS random 16-digit number: 9999999999999999", () => {
      const result = detectPII("ID: 9999999999999999");
      expect(result.categories).not.toContain("credit_card");
    });
  });

  // ===========================================================================
  // SOCIAL HANDLE DETECTION - Including spaced @
  // ===========================================================================
  describe("Social Handle Detection - Space After @", () => {
    it("blocks 'IG is @myhandle' (standard format)", () => {
      const result = detectPII("IG is @myhandle");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'IG is @ myhandle' (space after @)", () => {
      const result = detectPII("IG is @ myhandle");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'instagram: cooluser123'", () => {
      const result = detectPII("instagram: cooluser123");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'snap: mysnap'", () => {
      const result = detectPII("snap: mysnap");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'DM me'", () => {
      const result = detectPII("DM me for details");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'hit me up'", () => {
      const result = detectPII("hit me up for more info");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("blocks 'telegram: @myhandle'", () => {
      const result = detectPII("telegram: @myhandle");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("social_handle");
    });

    it("ALLOWS when PII_BLOCK_SOCIAL_HANDLES is false", () => {
      process.env.PII_BLOCK_SOCIAL_HANDLES = "false";
      const result = detectPII("Follow me @johndoe");
      expect(result.categories).not.toContain("social_handle");
    });
  });

  // ===========================================================================
  // ADDRESS DETECTION - Context-gated
  // ===========================================================================
  describe("Address Detection - Context-Gated", () => {
    it("blocks 'address - 183 N hwy' (address context)", () => {
      const result = detectPII("address - 183 N hwy");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("address");
    });

    it("blocks 'come to 183 N hwy' (come to context)", () => {
      const result = detectPII("come to 183 N hwy");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("address");
    });

    it("blocks 'my apartment is 183 N hwy' (apartment context)", () => {
      const result = detectPII("my apartment is 183 N hwy");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("address");
    });

    it("blocks 'my address is 183 N hwy'", () => {
      const result = detectPII("my address is 183 N hwy");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("address");
    });

    it("blocks 'I live at 456 Oak Ave'", () => {
      const result = detectPII("I live at 456 Oak Ave");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("address");
    });

    it("ALLOWS 'Traffic on 183' (NO address context)", () => {
      const result = detectPII("Traffic on 183");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS '183 N hwy is jammed' (NO address context)", () => {
      const result = detectPII("183 N hwy is jammed");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS 'Crash on MoPac at 45th st' (NO address context)", () => {
      const result = detectPII("Crash on MoPac at 45th st");
      expect(result.blocked).toBe(false);
    });
  });

  // ===========================================================================
  // SPAM/NONSENSE DETECTION
  // ===========================================================================
  describe("Spam/Nonsense Detection", () => {
    it("blocks '#^*&^!@#^!@#' (punctuation only)", () => {
      const result = detectPII("#^*&^!@#^!@#");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("blocks '.' (single punctuation)", () => {
      const result = detectPII(".");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("blocks '!!!!' (repeated punctuation)", () => {
      const result = detectPII("!!!!");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("blocks 'aaaaaaaaaaaaaaaaaaaa' (repeated character)", () => {
      const result = detectPII("aaaaaaaaaaaaaaaaaaaa");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("blocks 'lanjodka' (offensive word)", () => {
      const result = detectPII("lanjodka");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("blocks emoji-only content", () => {
      const result = detectPII("\uD83E\uDDCC\uD83E\uDDCC\uD83E\uDDCC\uD83E\uDDCC\uD83E\uDDCC");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("spam");
    });

    it("ALLOWS normal content", () => {
      const result = detectPII("Beautiful weather today in Austin!");
      expect(result.categories).not.toContain("spam");
    });
  });

  // ===========================================================================
  // FALSE POSITIVE PREVENTION - Critical for user experience
  // ===========================================================================
  describe("False Positive Prevention", () => {
    it("ALLOWS 'my score is 123 45 6789'", () => {
      const result = detectPII("my score is 123 45 6789");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS 'I ran 123 45 6789 steps'", () => {
      const result = detectPII("I ran 123 45 6789 steps");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS weather reports", () => {
      const result = detectPII("Beautiful sunny day in Austin!");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS traffic reports without addresses", () => {
      const result = detectPII("Heavy traffic on I-35 northbound");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS event announcements", () => {
      const result = detectPII("Free concert at Zilker Park tonight");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS numbers in normal context", () => {
      const result = detectPII("The event starts at 7pm and has 500 attendees");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS zip codes alone", () => {
      const result = detectPII("Weather in 78701 area is nice");
      expect(result.blocked).toBe(false);
    });
  });

  // ===========================================================================
  // CONTACT INTENT - Strict Option C
  // ===========================================================================
  describe("Contact Intent - Strict Option C", () => {
    it("blocks 'lets talk'", () => {
      const result = detectPII("lets talk");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks \"let's talk\"", () => {
      const result = detectPII("let's talk");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'lets talk @ 7 one 7 8 8 8 8 9 8'", () => {
      const result = detectPII("lets talk @ 7 one 7 8 8 8 8 9 8");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'dm me'", () => {
      const result = detectPII("dm me");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'DM @ 71 seven 787 6767'", () => {
      const result = detectPII("DM @ 71 seven 787 6767");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'd m @ 71 seven 787 6767'", () => {
      const result = detectPII("d m @ 71 seven 787 6767");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'direct message me'", () => {
      const result = detectPII("direct message me");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'pm me'", () => {
      const result = detectPII("pm me");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'hit me up'", () => {
      const result = detectPII("hit me up");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'reach out'", () => {
      const result = detectPII("reach out");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'message me'", () => {
      const result = detectPII("message me");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'add me on ig' (should remain blocked)", () => {
      const result = detectPII("add me on ig");
      expect(result.blocked).toBe(true);
    });

    it("ALLOWS 'Traffic on 183 is terrible'", () => {
      const result = detectPII("Traffic on 183 is terrible");
      expect(result.blocked).toBe(false);
    });

    it("ALLOWS 'I ran 123 45 6789 steps'", () => {
      const result = detectPII("I ran 123 45 6789 steps");
      expect(result.blocked).toBe(false);
    });
  });

  // ===========================================================================
  // CONTACT PHRASE DETECTION
  // ===========================================================================
  describe("Contact Phrase Detection", () => {
    it("blocks 'call me at'", () => {
      const result = detectPII("call me at noon");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'text me at'", () => {
      const result = detectPII("text me at 5pm");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'reach me at'", () => {
      const result = detectPII("reach me at the office");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });

    it("blocks 'my email is'", () => {
      const result = detectPII("my email is personal");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("contact_phrase");
    });
  });

  // ===========================================================================
  // SELF-IDENTIFICATION DETECTION
  // ===========================================================================
  describe("Self-Identification Detection", () => {
    it("blocks 'my name is John Smith'", () => {
      const result = detectPII("my name is John Smith");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("self_identification");
    });

    it("blocks 'I am Jane Doe reporting'", () => {
      const result = detectPII("I am Jane Doe reporting");
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("self_identification");
    });

    it("ALLOWS when PII_ALLOW_NAMES is true", () => {
      process.env.PII_ALLOW_NAMES = "true";
      const result = detectPII("my name is John Smith");
      expect(result.categories).not.toContain("self_identification");
    });

    it("ALLOWS casual self-references", () => {
      const result = detectPII("I am excited about this");
      expect(result.categories).not.toContain("self_identification");
    });
  });

  // ===========================================================================
  // FRIENDLY ERROR MESSAGE
  // ===========================================================================
  describe("Friendly Error Message", () => {
    it("returns friendly message when blocked", () => {
      const result = detectPII("My email is test@example.com");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe(
        "Please don't share personal contact details or addresses. Keep it anonymous."
      );
    });

    it("does not reveal which pattern triggered", () => {
      const result = detectPII("My email is test@example.com");
      expect(result.reason).not.toContain("email");
      expect(result.reason).not.toContain("test@example.com");
    });

    it("returns empty reason when not blocked", () => {
      const result = detectPII("Beautiful day!");
      expect(result.reason).toBe("");
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================
  describe("Edge Cases", () => {
    it("handles empty string", () => {
      const result = detectPII("");
      expect(result.blocked).toBe(false);
      expect(result.categories).toHaveLength(0);
    });

    it("handles null gracefully", () => {
      const result = detectPII(null as unknown as string);
      expect(result.blocked).toBe(false);
    });

    it("handles undefined gracefully", () => {
      const result = detectPII(undefined as unknown as string);
      expect(result.blocked).toBe(false);
    });

    it("handles whitespace-only string", () => {
      const result = detectPII("   ");
      expect(result.blocked).toBe(false);
    });
  });

  // ===========================================================================
  // MULTIPLE CATEGORIES
  // ===========================================================================
  describe("Multiple PII Categories", () => {
    it("detects multiple categories in one message", () => {
      const result = detectPII(
        "Contact john@example.com or call (555) 123-4567"
      );
      expect(result.blocked).toBe(true);
      expect(result.categories).toContain("email");
      // Phone requires context, but "call" provides it
      expect(result.categories).toContain("phone");
    });
  });
});

// ===========================================================================
// UTILITY TESTS
// ===========================================================================
describe("PII Detection Utilities", () => {
  describe("hashContentForLogging", () => {
    it("produces consistent hash for same input", () => {
      const hash1 = hashContentForLogging("test content");
      const hash2 = hashContentForLogging("test content");
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different input", () => {
      const hash1 = hashContentForLogging("content 1");
      const hash2 = hashContentForLogging("content 2");
      expect(hash1).not.toBe(hash2);
    });

    it("returns 16 character hex string", () => {
      const hash = hashContentForLogging("test");
      expect(hash).toHaveLength(16);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe("logPIIDetection", () => {
    it("logs in expected format", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: PIIDetectionResult = {
        blocked: true,
        categories: ["email", "phone"],
        reason: "Test reason",
      };

      logPIIDetection("req-123", result, "abc123");

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain("[pii-detection]");
      expect(logCall).toContain("req-123");
      expect(logCall).toContain("deny");

      consoleSpy.mockRestore();
    });
  });

  describe("getPIIDetectionStatus", () => {
    it("returns configuration status", () => {
      const status = getPIIDetectionStatus();
      expect(status.enabled).toBe(true);
      expect(status.config).toHaveProperty("failOpen");
      expect(status.config).toHaveProperty("blockSocialHandles");
    });
  });
});

// ===========================================================================
// LUHN ALGORITHM VALIDATION
// ===========================================================================
describe("Luhn Algorithm Validation", () => {
  const testCases = [
    { number: "4111111111111111", valid: true, name: "Visa test" },
    { number: "5500000000000004", valid: true, name: "Mastercard test" },
    { number: "340000000000009", valid: true, name: "Amex test" },
    { number: "6011000000000004", valid: true, name: "Discover test" },
    { number: "4012888888881881", valid: true, name: "Visa test 2" },
    { number: "1234567890123456", valid: false, name: "Sequential invalid" },
    { number: "4111111111111112", valid: false, name: "Visa wrong check" },
    { number: "9999999999999999", valid: false, name: "All 9s" },
    { number: "0000000000000000", valid: false, name: "All 0s" },
  ];

  testCases.forEach(({ number, valid, name }) => {
    it(`${valid ? "blocks" : "allows"} ${name} (${number})`, () => {
      const result = detectPII(`Card: ${number}`);
      if (valid) {
        expect(result.categories).toContain("credit_card");
      } else {
        expect(result.categories).not.toContain("credit_card");
      }
    });
  });
});
