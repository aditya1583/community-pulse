# Testing Patterns

**Analysis Date:** 2026-01-17

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest's built-in `expect` (Jest-compatible)
- Extended with `@testing-library/jest-dom` for DOM assertions

**Run Commands:**
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

## Test File Organization

**Location:**
- Co-located `__tests__` directories alongside source files
- Pattern: `src/{feature}/__tests__/{name}.test.ts`

**Naming:**
- `{name}.test.ts` for utility/lib tests
- `{name}.test.tsx` for React component tests

**Structure:**
```
src/
├── app/
│   ├── __tests__/
│   │   └── page.test.tsx
│   └── api/
│       ├── pulses/
│       │   └── __tests__/
│       │       └── route.test.ts
│       └── gamification/
│           └── __tests__/
│               ├── leaderboard.test.ts
│               └── stats.test.ts
├── components/
│   └── __tests__/
│       ├── StatCard.test.tsx
│       └── StatusRing.test.tsx
├── hooks/
│   └── __tests__/
│       └── useGeocodingAutocomplete.test.tsx
└── lib/
    └── __tests__/
        ├── moderation.test.ts
        ├── pulses.test.ts
        ├── gamification.test.ts
        ├── piiDetection.test.ts
        └── time.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Module Name Tests
 *
 * Description of what this test file covers and any
 * important notes about scope or limitations.
 */
describe("Module/Feature Name", () => {
  describe("functionName", () => {
    it("describes expected behavior in plain English", () => {
      // Arrange
      const input = "test value";

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe(expectedValue);
    });

    it("handles edge case description", () => { ... });
  });

  describe("another function", () => { ... });
});
```

**Patterns:**
- Group tests by function/feature in nested `describe` blocks
- Use descriptive `it` statements: "returns diamond tier for ranks 1-3"
- Setup: `beforeEach` for repeated initialization
- Teardown: `afterEach` for cleanup (timers, mocks, env vars)
- Arrange-Act-Assert pattern within tests

## Mocking

**Framework:** Vitest's built-in `vi` mock utilities

**Patterns:**

**Module Mocking:**
```typescript
// Mock entire module before imports
vi.mock("@/lib/moderationPipeline", () => ({
  runModerationPipeline: vi.fn(),
  quickModerateContent: vi.fn().mockReturnValue({ allowed: true }),
}));

// Import after mocks
import { runModerationPipeline } from "@/lib/moderationPipeline";

// Cast for type safety
const mockRunModerationPipeline = runModerationPipeline as ReturnType<typeof vi.fn>;

// Reset in beforeEach
beforeEach(() => {
  mockRunModerationPipeline.mockReset();
});
```

**Supabase Client Mocking:**
```typescript
const mockGetUser = vi.fn();
const mockInsert = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
    }),
  })),
}));
```

**Environment Variable Mocking:**
```typescript
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.OPENAI_API_KEY = "test-key";
});

afterEach(() => {
  process.env = originalEnv;
});
```

**Timer Mocking:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});
```

**What to Mock:**
- External services (Supabase, OpenAI, APIs)
- Environment variables
- Time/Date for deterministic tests
- localStorage/sessionStorage

**What NOT to Mock:**
- Pure functions being tested
- Internal utility functions (test integration)
- Type definitions

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function for consistent test data
const createBadge = (
  id: string,
  tier: number,
  displayOrder: number
): UserBadge => ({
  id,
  badgeId: id,
  earnedAt: new Date().toISOString(),
  badge: {
    id,
    name: `Badge ${id}`,
    description: "Test badge",
    icon: "trophy",
    category: "achievement",
    tier,
    displayOrder,
  } as BadgeDefinition,
});

// Default props for component tests
const defaultProps = {
  icon: <span data-testid="test-icon">chart</span>,
  value: "42",
  label: "Test Stat",
  onClick: vi.fn(),
};
```

**Request Helpers:**
```typescript
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
```

**Location:**
- Inline in test files for simple cases
- Shared factory functions at top of test file
- No dedicated fixtures directory

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
npm test -- --coverage
```

**Current Test Coverage Areas:**
- Content moderation (extensive): `moderation.test.ts`, `moderationPipeline.test.ts`
- PII detection: `piiDetection.test.ts`
- Pulse utilities: `pulses.test.ts`
- Gamification: `gamification.test.ts`
- API routes: `route.test.ts` (pulses, gamification, weather)
- React components: `StatCard.test.tsx`, `StatusRing.test.tsx`
- Hooks: `useGeocodingAutocomplete.test.tsx`
- Time utilities: `time.test.ts`

## Test Types

**Unit Tests:**
- Primary focus of test suite
- Test pure functions in isolation
- Fast execution, no external dependencies
- Files: All `*.test.ts` files in `src/lib/__tests__/`

**Integration Tests:**
- API route tests exercise multiple layers
- Mock external services, test internal integration
- Files: `src/app/api/*/__tests__/route.test.ts`

**Component Tests:**
- Use `@testing-library/react` for DOM testing
- Test user interactions with `fireEvent`
- Test accessibility (roles, aria-labels)
- Files: `src/components/__tests__/*.test.tsx`

**E2E Tests:**
- Not implemented
- No Playwright/Cypress configuration detected

## Common Patterns

**Async Testing:**
```typescript
it("returns 400 when moderation blocks content", async () => {
  mockRunModerationPipeline.mockResolvedValueOnce({
    allowed: false,
    reason: "Content blocked",
  });

  const request = createPostRequest({ message: "test" }, "Bearer token");
  const response = await POST(request);
  const data = await response.json();

  expect(response.status).toBe(400);
  expect(data.code).toBe("MODERATION_FAILED");
});
```

**Error Testing:**
```typescript
it("handles null/undefined gracefully", () => {
  expect(moderateContent(null as unknown as string).allowed).toBe(false);
  expect(moderateContent(undefined as unknown as string).allowed).toBe(false);
});

it("returns null for invalid date strings", () => {
  const now = new Date();
  expect(getRemainingSeconds("not-a-date", now)).toBeNull();
});
```

**React Component Testing:**
```typescript
import { render, screen, fireEvent } from "@testing-library/react";

describe("StatCard", () => {
  it("renders icon, value, and label", () => {
    render(<StatCard {...defaultProps} />);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Test Stat")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<StatCard {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has accessible button role", () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

**Parameterized Testing:**
```typescript
it("blocks common explicit profanity words (direct usage)", () => {
  const directProfanity = ["word1", "word2", "word3"];

  for (const word of directProfanity) {
    const result = moderateContent(`test ${word} test`);
    expect(result.allowed).toBe(false);
  }
});
```

**State Verification:**
```typescript
it("does not mutate original array", () => {
  const badges = [badge1, badge2, badge3];
  const originalOrder = [...badges];

  getTopBadge(badges);

  expect(badges).toEqual(originalOrder);
});
```

## Test Configuration

**Vitest Config (`vitest.config.ts`):**
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,                           // No imports needed for describe/it/expect
    environment: "jsdom",                    // DOM environment for component tests
    setupFiles: "./vitest.setup.ts",         // Global setup
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Match tsconfig paths
    },
  },
});
```

**Setup File (`vitest.setup.ts`):**
```typescript
import "@testing-library/jest-dom";
```

## Critical Test Scenarios

**Security Tests (Fail-Closed Guarantee):**
```typescript
describe("Fail-Closed Guarantee Tests", () => {
  it("rejects PII with 400 and does NOT call insert or moderation", async () => {
    // Setup: PII detection blocks
    // Assert: 400 status, mockInsert NOT called, mockModeration NOT called
  });

  it("returns 503 when moderation service errors", async () => {
    // Setup: Moderation returns serviceError: true
    // Assert: 503 status, insert NOT called
  });

  it("production ALWAYS fails closed even with MODERATION_FAIL_OPEN=true", async () => {
    // Setup: NODE_ENV = "production", MODERATION_FAIL_OPEN = "true"
    // Assert: Still blocks on service error
  });
});
```

These guarantee tests verify the non-negotiable security requirements documented in `src/app/api/pulses/route.ts`.

---

*Testing analysis: 2026-01-17*
