import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase client - must be defined before vi.mock calls
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

// Mock the moderationPipeline module
vi.mock("@/lib/moderationPipeline", () => ({
  runModerationPipeline: vi.fn(),
  quickModerateContent: vi.fn().mockReturnValue({ allowed: true }),
}));

// Mock the moderation module (local checks)
vi.mock("@/lib/moderation", () => ({
  serverModerateContent: vi.fn().mockReturnValue({ allowed: true }),
}));

// Mock PII detection - we test real detection in piiDetection.test.ts
// These route tests verify integration behavior
vi.mock("@/lib/piiDetection", () => ({
  detectPII: vi.fn(),
  hashContentForLogging: vi.fn().mockReturnValue("mock-hash"),
  logPIIDetection: vi.fn(),
}));

// Track which client type was used for each call
let lastClientType: "user" | "service" | null = null;

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation((url: string, key: string) => {
    // Detect if this is the service role client or user client
    const isServiceRole = key === "test-service-role-key";
    lastClientType = isServiceRole ? "service" : "user";

    return {
      auth: {
        getUser: mockGetUser,
      },
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };
  }),
}));

// Import after mocks are set up
import { POST } from "../route";
import { runModerationPipeline, quickModerateContent } from "@/lib/moderationPipeline";
import { detectPII } from "@/lib/piiDetection";

// Cast to mock for type safety
const mockRunModerationPipeline = runModerationPipeline as ReturnType<typeof vi.fn>;
const mockQuickModerateContent = quickModerateContent as ReturnType<typeof vi.fn>;
const mockDetectPII = detectPII as ReturnType<typeof vi.fn>;

describe("/api/pulses POST route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    lastClientType = null;

    // Reset all mocks
    mockGetUser.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
    mockRunModerationPipeline.mockReset();
    mockQuickModerateContent.mockReset();
    mockDetectPII.mockReset();

    // Default mock implementations
    mockQuickModerateContent.mockReturnValue({ allowed: true });
    // Default: PII detection passes (no PII found)
    mockDetectPII.mockReturnValue({ blocked: false, categories: [], reason: "" });

    // Default mock chain for successful insert
    mockSingle.mockResolvedValue({
      data: {
        id: "test-pulse-id",
        message: "Test message",
        city: "Austin",
        mood: "happy",
        tag: "General",
        author: "TestUser",
        user_id: "test-user-id",
      },
      error: null,
    });

    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * Helper to create a POST request
   */
  function createPostRequest(
    body: Record<string, unknown>,
    authHeader?: string
  ): NextRequest {
    const headers = new Headers();
    headers.set("content-type", "application/json");
    if (authHeader) {
      headers.set("authorization", authHeader);
    }

    return new NextRequest("http://localhost/api/pulses", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  describe("authentication", () => {
    it("returns 401 when no authorization header", async () => {
      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello world",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("returns 401 when authorization header is invalid format", async () => {
      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Hello world",
          author: "TestUser",
        },
        "InvalidFormat token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("returns 401 when token is invalid", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Hello world",
          author: "TestUser",
        },
        "Bearer invalid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid or expired session");
    });
  });

  describe("moderation pipeline", () => {
    beforeEach(() => {
      // Set up authenticated user
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });
    });

    it("returns 400 with friendly message when moderation blocks content", async () => {
      // Pipeline blocks the content
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "ASSOHLE",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Please keep your message friendly and respectful.");
      expect(data.code).toBe("MODERATION_FAILED");
    });

    it("returns 400 for obfuscated profanity 'go f your mother'", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "go f your mother",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");
    });

    it("returns 400 for Spanish profanity 'Mierda'", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Mierda",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");
    });

    it("returns 400 for blocklist match", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        _telemetry: { layer: "blocklist" },
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "blocklisted term",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");
    });

    it("returns 400 and does NOT insert for solicitation 'car date anyone?'", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        _telemetry: { layer: "local" },
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "car date anyone?",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("allows friendly message through moderation", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({ allowed: true });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Beautiful weather today!",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pulse).toBeDefined();
    });

    it("blocks content when moderation service fails (fail-closed)", async () => {
      // Simulate moderation failure with fail-closed behavior
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Test message during outage",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");
    });

    it("blocks profane author names", async () => {
      mockRunModerationPipeline.mockResolvedValueOnce({ allowed: true });
      mockQuickModerateContent.mockReturnValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Hello world",
          author: "ProfaneUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Author name violates content guidelines");
    });
  });

  describe("PII detection", () => {
    beforeEach(() => {
      // Set up authenticated user
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });
    });

    it("returns 400 with PII_DETECTED code when email is detected", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["email"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Contact me at john@example.com",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
      expect(data.error).toBe("Please don't share personal contact details or addresses. Keep it anonymous.");
    });

    it("returns 400 when phone number is detected", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["phone"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Call me at (555) 123-4567",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("returns 400 when SSN is detected", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["ssn"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "My SSN is 123-45-6789",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("returns 400 when credit card is detected", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["credit_card"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "My card is 4111111111111111",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("returns 400 when address with context is detected", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["address"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "my address is 183 N hwy Austin TX",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("allows traffic messages mentioning highways (no false positives)", async () => {
      // PII detection should NOT block this - traffic mentions are allowed
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });
      mockRunModerationPipeline.mockResolvedValueOnce({ allowed: true });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "neutral",
          tag: "Traffic",
          message: "Traffic on 183 is heavy today",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pulse).toBeDefined();
    });

    it("allows '183 N hwy is jammed' without context phrase", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });
      mockRunModerationPipeline.mockResolvedValueOnce({ allowed: true });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "frustrated",
          tag: "Traffic",
          message: "183 N hwy is jammed",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pulse).toBeDefined();
    });

    it("blocks 'my address is 183 N hwy' with context phrase", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["address"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "my address is 183 N hwy",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("blocks social handles", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["social_handle"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Follow me @johndoe",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
    });

    it("does NOT reveal which PII pattern triggered in error message", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["email"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Email: test@example.com",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      // Error should NOT reveal that it was an email specifically
      expect(data.error).not.toContain("email");
      expect(data.error).not.toContain("test@example.com");
    });

    it("PII detection runs BEFORE moderation pipeline", async () => {
      // If PII is detected, moderation should NOT be called
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["phone"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Call 555-123-4567",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      await POST(request);

      // Moderation pipeline should NOT have been called
      expect(mockRunModerationPipeline).not.toHaveBeenCalled();
    });
  });

  describe("successful pulse creation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });
      mockRunModerationPipeline.mockResolvedValue({ allowed: true });
    });

    it("creates pulse with all required fields", async () => {
      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "Traffic",
          message: "Traffic is light today",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pulse).toBeDefined();
      expect(mockInsert).toHaveBeenCalled();
    });

    it("creates pulse with optional neighborhood", async () => {
      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: "Hello from downtown!",
          author: "TestUser",
          neighborhood: "Downtown",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });
      mockRunModerationPipeline.mockResolvedValue({ allowed: true });
    });

    it("returns 400 for missing city", async () => {
      const request = createPostRequest(
        {
          mood: "happy",
          tag: "General",
          message: "Hello world",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("City is required");
    });

    it("returns 400 for invalid tag", async () => {
      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "InvalidTag",
          message: "Hello world",
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid tag");
    });

    it("returns 400 for message exceeding 240 characters", async () => {
      const longMessage = "a".repeat(241);

      const request = createPostRequest(
        {
          city: "Austin",
          mood: "happy",
          tag: "General",
          message: longMessage,
          author: "TestUser",
        },
        "Bearer valid-token"
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Message exceeds 240 character limit");
    });
  });
});

describe("/api/pulses - Direct API access (curl/postman)", () => {
  /**
   * These tests verify that direct API calls (not just UI) are properly blocked.
   * This ensures security even when bypassing the frontend.
   */

  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    mockGetUser.mockReset();
    mockRunModerationPipeline.mockReset();
    mockDetectPII.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
    mockDetectPII.mockReturnValue({ blocked: false, categories: [], reason: "" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("blocks profane content even from direct API calls", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    mockRunModerationPipeline.mockResolvedValueOnce({
      allowed: false,
      reason: "Please keep your message friendly and respectful.",
    });

    // Simulate a curl/postman request (same as UI, just verifying server-side check)
    const headers = new Headers();
    headers.set("content-type", "application/json");
    headers.set("authorization", "Bearer test-token");

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        city: "Austin",
        mood: "angry",
        tag: "General",
        message: "f*** you all",
        author: "Bypasser",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("MODERATION_FAILED");
  });

  it("rejects unauthenticated direct API calls", async () => {
    const headers = new Headers();
    headers.set("content-type", "application/json");
    // No authorization header

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello",
        author: "TestUser",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });
});

/**
 * ==================================================================================
 * FAIL-CLOSED GUARANTEE TESTS
 * ==================================================================================
 * These tests verify the NON-NEGOTIABLE principle:
 * - If deterministic checks fail -> reject and DO NOT INSERT
 * - If moderation blocks -> reject and DO NOT INSERT
 * - If moderation errors/times out/misconfigured -> reject and DO NOT INSERT
 * - Production ALWAYS fails closed regardless of MODERATION_FAIL_OPEN env var
 */
describe("/api/pulses - Fail-Closed Guarantee Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Reset all mocks
    mockGetUser.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
    mockRunModerationPipeline.mockReset();
    mockQuickModerateContent.mockReset();
    mockDetectPII.mockReset();

    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    // Default: author name passes moderation
    mockQuickModerateContent.mockReturnValue({ allowed: true });

    // Default mock chain for successful insert
    mockSingle.mockResolvedValue({
      data: {
        id: "test-pulse-id",
        message: "Test message",
        city: "Austin",
        mood: "happy",
        tag: "General",
        author: "TestUser",
        user_id: "test-user-id",
      },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createPostRequest(body: Record<string, unknown>): NextRequest {
    const headers = new Headers();
    headers.set("content-type", "application/json");
    headers.set("authorization", "Bearer valid-token");

    return new NextRequest("http://localhost/api/pulses", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  describe("1) Deterministic fails -> reject and insert NOT called", () => {
    it("rejects PII (obfuscated email) with 400 and does NOT call insert or moderation", async () => {
      // Setup: PII detection blocks the content
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["email"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "reach me: t e s t @ e x a m p l e . c o m",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: 400 with friendly PII message
      expect(response.status).toBe(400);
      expect(data.code).toBe("PII_DETECTED");
      expect(data.error).toBe("Please don't share personal contact details or addresses. Keep it anonymous.");

      // Assert: insert NOT called
      expect(mockInsert).not.toHaveBeenCalled();

      // Assert: moderation NOT called (because deterministic failed first)
      expect(mockRunModerationPipeline).not.toHaveBeenCalled();
    });

    it("rejects spam content with 400 and does NOT call insert or moderation", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: true,
        categories: ["spam"],
        reason: "Please don't share personal contact details or addresses. Keep it anonymous.",
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "!!!!!!!!",
        author: "TestUser",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockRunModerationPipeline).not.toHaveBeenCalled();
    });
  });

  describe("2) Deterministic passes but moderation blocks -> reject and insert NOT called", () => {
    it("rejects hate speech with 400 and does NOT call insert", async () => {
      // Setup: PII detection passes
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Setup: Moderation blocks the content
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "angry",
        tag: "General",
        message: "I hate everyone",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: 400 with generic moderation rejection
      expect(response.status).toBe(400);
      expect(data.code).toBe("MODERATION_FAILED");

      // Assert: insert NOT called
      expect(mockInsert).not.toHaveBeenCalled();

      // Assert: moderation WAS called exactly once
      expect(mockRunModerationPipeline).toHaveBeenCalledTimes(1);
    });

    it("rejects obfuscated profanity with 400 and does NOT call insert", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "@$$hole driver on I-35",
        author: "TestUser",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockRunModerationPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe("3) Moderation throws/error/missing key -> fail-closed with 503 and insert NOT called", () => {
    it("returns 503 when moderation service has error and does NOT call insert", async () => {
      // Setup: PII detection passes
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Setup: Moderation returns serviceError (simulating API timeout/error)
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        serviceError: true,
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello Austin!",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: 503 Service Unavailable
      expect(response.status).toBe(503);
      expect(data.code).toBe("SERVICE_UNAVAILABLE");
      expect(data.error).toBe("Posting is temporarily unavailable. Please try again.");

      // Assert: insert NOT called
      expect(mockInsert).not.toHaveBeenCalled();

      // Assert: moderation WAS called
      expect(mockRunModerationPipeline).toHaveBeenCalledTimes(1);
    });

    it("returns 503 when moderation API times out and does NOT call insert", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Simulate timeout - serviceError indicates the service had an issue
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        serviceError: true,
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "neutral",
        tag: "Weather",
        message: "Nice weather today",
        author: "TestUser",
      });

      const response = await POST(request);

      expect(response.status).toBe(503);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("4) Happy path -> deterministic passes + moderation passes -> insert called once", () => {
    it("inserts pulse when all checks pass", async () => {
      // Setup: PII detection passes
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Setup: Moderation passes
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: true,
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello Austin!",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: 200 success
      expect(response.status).toBe(200);
      expect(data.pulse).toBeDefined();

      // Assert: insert WAS called exactly once
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Verify the insert was called with correct data
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Hello Austin!",
          city: "Austin",
          user_id: "test-user-id",
        }),
      ]);
    });

    it("sets user_id from verified auth, not from request body", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: true,
      });

      // Try to spoof user_id in request body
      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello!",
        author: "TestUser",
        user_id: "spoofed-user-id", // This should be ignored
      });

      await POST(request);

      // Insert should use the verified user_id from auth, not the spoofed one
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: "test-user-id", // From mockGetUser, not "spoofed-user-id"
        }),
      ]);
    });
  });

  describe("5) Production safety lock test", () => {
    it("production ALWAYS fails closed even when MODERATION_FAIL_OPEN=true", async () => {
      // Setup: Production environment with MODERATION_FAIL_OPEN=true
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.MODERATION_FAIL_OPEN = "true";

      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Moderation returns serviceError (simulating API unavailable)
      // In production, this should STILL block even with MODERATION_FAIL_OPEN=true
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        serviceError: true,
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello Austin!",
        author: "TestUser",
      });

      const response = await POST(request);

      // Assert: Still blocked (503) even in production with MODERATION_FAIL_OPEN=true
      expect(response.status).toBe(503);

      // Assert: insert NOT called
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("content rejection still returns 400 in production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      // Moderation actively blocks content (not a service error)
      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
        serviceError: false, // explicitly false - content was blocked, not service error
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "angry",
        tag: "General",
        message: "Bad content",
        author: "TestUser",
      });

      const response = await POST(request);

      // Assert: 400 for content rejection
      expect(response.status).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("Error message security", () => {
    it("does NOT reveal which moderation rule triggered the block", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        reason: "Please keep your message friendly and respectful.",
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "hate speech content here",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Error should be generic, not revealing which rule triggered
      expect(data.error).toBe("Please keep your message friendly and respectful.");
      expect(data.error).not.toContain("hate");
      expect(data.error).not.toContain("harassment");
      expect(data.error).not.toContain("OpenAI");
    });

    it("service unavailable message does NOT reveal the specific error", async () => {
      mockDetectPII.mockReturnValueOnce({
        blocked: false,
        categories: [],
        reason: "",
      });

      mockRunModerationPipeline.mockResolvedValueOnce({
        allowed: false,
        serviceError: true,
      });

      const request = createPostRequest({
        city: "Austin",
        mood: "happy",
        tag: "General",
        message: "Hello",
        author: "TestUser",
      });

      const response = await POST(request);
      const data = await response.json();

      // Error should be generic
      expect(data.error).toBe("Posting is temporarily unavailable. Please try again.");
      expect(data.error).not.toContain("API");
      expect(data.error).not.toContain("timeout");
      expect(data.error).not.toContain("key");
      expect(data.error).not.toContain("OpenAI");
    });
  });
});
