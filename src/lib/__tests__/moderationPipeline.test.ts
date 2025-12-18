import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the dependent modules
vi.mock("@/lib/moderation", () => ({
  serverModerateContent: vi.fn(),
}));

vi.mock("@/lib/aiModeration", () => ({
  moderateWithAI: vi.fn(),
  clearModerationCache: vi.fn(),
}));

vi.mock("@/lib/blocklist", () => ({
  checkBlocklist: vi.fn(),
  clearBlocklistCache: vi.fn(),
}));

vi.mock("@/lib/perspectiveModeration", () => ({
  isPerspectiveEnabled: vi.fn(),
  analyzeWithPerspective: vi.fn(),
}));

// Import after mocks
import {
  runModerationPipeline,
  quickModerateContent,
  getModerationPipelineStatus,
} from "@/lib/moderationPipeline";
import { serverModerateContent } from "@/lib/moderation";
import { moderateWithAI } from "@/lib/aiModeration";
import { checkBlocklist } from "@/lib/blocklist";
import {
  isPerspectiveEnabled,
  analyzeWithPerspective,
} from "@/lib/perspectiveModeration";

// Cast mocks
const mockServerModerateContent = serverModerateContent as ReturnType<typeof vi.fn>;
const mockModerateWithAI = moderateWithAI as ReturnType<typeof vi.fn>;
const mockCheckBlocklist = checkBlocklist as ReturnType<typeof vi.fn>;
const mockIsPerspectiveEnabled = isPerspectiveEnabled as ReturnType<typeof vi.fn>;
const mockAnalyzeWithPerspective = analyzeWithPerspective as ReturnType<typeof vi.fn>;

describe("Moderation Pipeline - runModerationPipeline", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = "test-api-key";

    // Reset all mocks
    mockServerModerateContent.mockReset();
    mockModerateWithAI.mockReset();
    mockCheckBlocklist.mockReset();
    mockIsPerspectiveEnabled.mockReset();
    mockAnalyzeWithPerspective.mockReset();

    // Default mock implementations
    mockCheckBlocklist.mockResolvedValue({ allowed: true });
    mockServerModerateContent.mockReturnValue({ allowed: true });
    mockModerateWithAI.mockResolvedValue({ allowed: true });
    mockIsPerspectiveEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("pipeline order", () => {
    it("runs blocklist check first", async () => {
      mockCheckBlocklist.mockResolvedValue({
        allowed: false,
        reason: "Blocklist match",
        severity: "block",
      });

      const result = await runModerationPipeline("blocked term");

      expect(result.allowed).toBe(false);
      expect(result._telemetry?.layer).toBe("blocklist");
      expect(mockCheckBlocklist).toHaveBeenCalled();
      expect(mockServerModerateContent).not.toHaveBeenCalled();
      expect(mockModerateWithAI).not.toHaveBeenCalled();
    });

    it("runs local heuristics after blocklist passes", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({
        allowed: false,
        reason: "Local profanity",
      });

      const result = await runModerationPipeline("fuck");

      expect(result.allowed).toBe(false);
      expect(result._telemetry?.layer).toBe("local");
      expect(mockCheckBlocklist).toHaveBeenCalled();
      expect(mockServerModerateContent).toHaveBeenCalled();
      expect(mockModerateWithAI).not.toHaveBeenCalled();
    });

    it("runs AI moderation after local passes", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({
        allowed: false,
        reason: "AI detected harassment",
        _debug: { decision: "BLOCK", category: "harassment", confidence: 0.9 },
      });

      const result = await runModerationPipeline("subtle harassment");

      expect(result.allowed).toBe(false);
      expect(result._telemetry?.layer).toBe("haiku");
      expect(mockCheckBlocklist).toHaveBeenCalled();
      expect(mockServerModerateContent).toHaveBeenCalled();
      expect(mockModerateWithAI).toHaveBeenCalled();
    });

    it("allows content when all layers pass", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({ allowed: true });

      const result = await runModerationPipeline("Hello world");

      expect(result.allowed).toBe(true);
      expect(result._telemetry?.layer).toBe("none");
    });
  });

  describe("Perspective API integration", () => {
    it("skips Perspective when not enabled", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({ allowed: true });
      mockIsPerspectiveEnabled.mockReturnValue(false);

      await runModerationPipeline("Test");

      expect(mockAnalyzeWithPerspective).not.toHaveBeenCalled();
    });

    it("runs Perspective when enabled and AI has borderline confidence", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({
        allowed: true,
        _debug: { decision: "ALLOW", category: "clean", confidence: 0.80 }, // Below 0.85 threshold
      });
      mockIsPerspectiveEnabled.mockReturnValue(true);
      mockAnalyzeWithPerspective.mockResolvedValue({
        allowed: false,
        reason: "Perspective toxicity",
      });

      const result = await runModerationPipeline("Borderline content");

      expect(result.allowed).toBe(false);
      expect(result._telemetry?.layer).toBe("perspective");
      expect(mockAnalyzeWithPerspective).toHaveBeenCalled();
    });

    it("does not run Perspective when AI confidence is high", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({
        allowed: true,
        _debug: { decision: "ALLOW", category: "clean", confidence: 0.95 }, // Above 0.85 threshold
      });
      mockIsPerspectiveEnabled.mockReturnValue(true);

      await runModerationPipeline("Clean content");

      expect(mockAnalyzeWithPerspective).not.toHaveBeenCalled();
    });
  });

  describe("telemetry", () => {
    it("includes requestId in result", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({ allowed: true });

      const result = await runModerationPipeline("Test");

      expect(result._telemetry?.requestId).toBeDefined();
      expect(result._telemetry?.requestId.length).toBe(16); // 8 bytes hex = 16 chars
    });

    it("includes durationMs in result", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({ allowed: true });

      const result = await runModerationPipeline("Test");

      expect(result._telemetry?.durationMs).toBeDefined();
      expect(result._telemetry?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("includes category for blocked content", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({
        allowed: false,
        _debug: { decision: "BLOCK", category: "hate", confidence: 0.9 },
      });

      const result = await runModerationPipeline("Hate speech");

      expect(result._telemetry?.category).toBe("hate");
    });
  });

  describe("error handling", () => {
    it("continues when blocklist throws error", async () => {
      mockCheckBlocklist.mockRejectedValue(new Error("Blocklist error"));
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({ allowed: true });

      const result = await runModerationPipeline("Test");

      expect(result.allowed).toBe(true);
      expect(mockServerModerateContent).toHaveBeenCalled();
    });

    it("continues when Perspective throws error", async () => {
      mockCheckBlocklist.mockResolvedValue({ allowed: true });
      mockServerModerateContent.mockReturnValue({ allowed: true });
      mockModerateWithAI.mockResolvedValue({
        allowed: true,
        _debug: { decision: "ALLOW", category: "clean", confidence: 0.80 }, // Below 0.85 to trigger Perspective
      });
      mockIsPerspectiveEnabled.mockReturnValue(true);
      mockAnalyzeWithPerspective.mockRejectedValue(new Error("Perspective error"));

      const result = await runModerationPipeline("Test");

      // Should still allow since Perspective error doesn't block
      expect(result.allowed).toBe(true);
    });
  });
});

describe("Moderation Pipeline - quickModerateContent", () => {
  beforeEach(() => {
    mockServerModerateContent.mockReset();
  });

  it("calls local moderation only", () => {
    mockServerModerateContent.mockReturnValue({ allowed: true });

    const result = quickModerateContent("Test");

    expect(result.allowed).toBe(true);
    expect(mockServerModerateContent).toHaveBeenCalledWith("Test");
  });

  it("returns local moderation result", () => {
    mockServerModerateContent.mockReturnValue({
      allowed: false,
      reason: "Profanity detected",
    });

    const result = quickModerateContent("fuck");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Profanity detected");
  });
});

describe("Moderation Pipeline - getModerationPipelineStatus", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns layer status", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockIsPerspectiveEnabled.mockReturnValue(true);

    const status = getModerationPipelineStatus();

    expect(status.layers.blocklist).toBe(true);
    expect(status.layers.local).toBe(true);
    expect(status.layers.haiku).toBe(true);
    expect(status.layers.perspective).toBe(true);
  });

  it("reflects missing Anthropic key", () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockIsPerspectiveEnabled.mockReturnValue(false);

    const status = getModerationPipelineStatus();

    expect(status.layers.haiku).toBe(false);
  });

  it("returns config values", () => {
    process.env.MODERATION_FAIL_OPEN = "true";
    process.env.MODERATION_TIMEOUT_MS = "5000";

    const status = getModerationPipelineStatus();

    expect(status.config.failOpen).toBe(true);
    expect(status.config.timeoutMs).toBe(5000);
  });

  it("returns default config when env vars not set", () => {
    delete process.env.MODERATION_FAIL_OPEN;
    delete process.env.MODERATION_TIMEOUT_MS;

    const status = getModerationPipelineStatus();

    expect(status.config.failOpen).toBe(false);
    expect(status.config.timeoutMs).toBe(3000); // Updated default for Haiku
  });
});
