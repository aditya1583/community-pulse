# Coding Conventions

**Analysis Date:** 2026-01-17

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `PulseCard.tsx`, `StatusRing.tsx`)
- API routes: `route.ts` within Next.js App Router directory structure (e.g., `src/app/api/pulses/route.ts`)
- Utility/lib files: camelCase with `.ts` extension (e.g., `moderation.ts`, `pulses.ts`)
- Test files: `{name}.test.ts` or `{name}.test.tsx` in co-located `__tests__` directories
- Hooks: `use{Name}.ts` with camelCase (e.g., `useGeolocation.ts`, `useExpiryCountdown.ts`)
- Constants: camelCase files with SCREAMING_SNAKE_CASE exports (e.g., `radius.ts` exports `RADIUS_CONFIG`)

**Functions:**
- camelCase for all functions: `moderateContent()`, `formatPulseDateTime()`, `getPulseExpiryStatus()`
- Predicate functions use `is`/`has`/`should` prefix: `isPostEnabled()`, `hasShownFirstPulseModalThisSession()`, `shouldLog()`
- Event handlers use `on` prefix: `onDelete()`, `onToggleFavorite()`
- Factory/builder functions use descriptive verbs: `buildModerationViews()`, `createPostRequest()`

**Variables:**
- camelCase for all variables: `trimmedMessage`, `authorRank`, `remainingSeconds`
- Boolean variables use `is`/`has`/`should` prefix: `isOwnPulse`, `isFavorite`, `hasMarketEmoji`
- Constants: SCREAMING_SNAKE_CASE: `EXPLICIT_PROFANITY`, `PULSE_LIFESPAN_HOURS`, `RATE_LIMITS`

**Types:**
- PascalCase for types and interfaces: `Pulse`, `ModerationResult`, `GeolocationState`
- Props types: `{ComponentName}Props` (e.g., `PulseCardProps`)
- Enums/union types: PascalCase (e.g., `PulseExpiryStatus`, `TabId`)

## Code Style

**Formatting:**
- No Prettier config file detected - relies on ESLint for formatting
- 2-space indentation (TypeScript/TSX)
- Double quotes for strings
- Semicolons required
- Trailing commas in multi-line arrays/objects

**Linting:**
- ESLint with `eslint-config-next` (core-web-vitals + typescript)
- Config location: `eslint.config.mjs`
- Globals defined for test files: `vi`, `describe`, `it`, `expect`, `beforeEach`, `afterEach`
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. React/Next.js core imports: `"use client"`, `import React`, `import { useState }`
2. Next.js modules: `import { NextRequest, NextResponse } from "next/server"`
3. External packages: `import { createClient } from "@supabase/supabase-js"`
4. Internal aliases: `import { moderateContent } from "@/lib/moderation"`
5. Relative imports: `import type { Pulse } from "./types"`
6. Type imports: Use `import type` for type-only imports

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Always prefer `@/` over relative paths for cross-directory imports
- Use relative imports only within the same feature/directory

## Error Handling

**Patterns:**
- API routes return structured JSON errors with status codes:
```typescript
return NextResponse.json(
  { error: "Authentication required" },
  { status: 401 }
);
```

- Error codes for client categorization:
```typescript
return NextResponse.json(
  { error: "Message violates content guidelines", code: "MODERATION_FAILED" },
  { status: 400 }
);
```

- Try-catch with fallback for non-critical operations:
```typescript
try {
  storage.setItem(key, value);
} catch {
  // ignore storage errors (private mode, disabled storage, etc.)
}
```

- Explicit error type checking:
```typescript
if (err instanceof Error) {
  logger.error("Error", { error: err.message });
}
```

- Null coalescing for defaults: `lifespanHours ?? 24`
- Optional chaining for nested access: `pulse.poll_options?.length`

## Logging

**Framework:** Custom structured logger at `src/lib/logger.ts`

**Patterns:**
```typescript
import { logger } from "@/lib/logger";

// Simple logging with context object
logger.info("User action", { userId: "xxx", action: "pulse_created" });
logger.error("API failed", { service: "openai", error: err.message });

// API request logging
logger.apiRequest("POST", "/api/pulses", 200, 150, { userId: "xxx" });

// Service call logging
logger.serviceCall("openai", "moderation", true, 85, { requestId: "abc" });
```

**Log levels:**
- `debug`: Development-only verbose output
- `info`: Normal operations (production minimum)
- `warn`: Recoverable issues
- `error`: Failures requiring attention

**Security:** Never log PII, tokens, or sensitive content. Use hashing: `hashContentForLogging(content)`

## Comments

**When to Comment:**
- Complex algorithms/business logic (moderation, scoring)
- Security-critical code blocks with `SECURITY:` prefix
- Non-obvious patterns with reasoning
- Function/file headers for major modules

**JSDoc/TSDoc:**
- Used for public library functions:
```typescript
/**
 * Check if content passes moderation
 * Returns { allowed: true } if content is clean
 * Returns { allowed: false, reason: "..." } if content violates rules
 */
export function moderateContent(content: string): ModerationResult
```

- Test file headers explaining scope:
```typescript
/**
 * Local Moderation Tests
 *
 * These tests verify the LOCAL heuristic moderation layer.
 * This is a fast first-pass that catches obvious explicit English profanity.
 */
```

## Function Design

**Size:**
- Functions stay under 50 lines where practical
- Complex functions are broken into helper functions (e.g., `buildModerationViews`, `applyLeetspeakReplacements`)

**Parameters:**
- Object destructuring for 3+ params:
```typescript
export function shouldShowFirstPulseOnboarding(args: {
  authStatus: AuthStatus;
  identityReady: boolean;
  pulseCountResolved: boolean;
  userPulseCount: number;
  onboardingCompleted: boolean;
  hasShownThisSession: boolean;
})
```

- Default parameters for optional values: `now: Date = new Date()`
- Type-only extraction: `Pick<Storage, "getItem">`

**Return Values:**
- Early returns for guard clauses
- Result objects for operations that can fail:
```typescript
type ModerationResult = {
  allowed: boolean;
  reason?: string;
};
```
- Explicit null/undefined handling with dedicated functions

## Module Design

**Exports:**
- Named exports preferred over default exports for utilities
- Default exports for React components
- `export const` for constants
- `export type` for type-only exports

**Barrel Files:**
- Not used - direct imports from module files
- Types defined close to usage (e.g., `src/components/types.ts` for component types)

## React Component Patterns

**Component Structure:**
```typescript
"use client";

import React, { useState, useMemo } from "react";
import type { ComponentProps } from "./types";

// Helper functions before component
function parseActionableContent(message: string): ParsedData { ... }

// Type definitions
type ComponentNameProps = { ... };

// Main component with default export
export default function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // State hooks first
  const [state, setState] = useState();

  // Computed values with useMemo
  const computed = useMemo(() => ..., [deps]);

  // Early returns for edge cases
  if (shouldNotRender) return null;

  // Render
  return <div>...</div>;
}
```

**State Management:**
- React hooks for local state
- No global state library (Redux, Zustand)
- Props drilling with context for deeply nested data
- localStorage for persistence (with try-catch wrappers)

**Event Handlers:**
- Inline for simple operations: `onClick={() => setValue(x)}`
- Extracted functions for complex logic
- `e.stopPropagation()` for nested clickable elements

## API Route Patterns

**Structure:**
```typescript
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Authentication check
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // 2. Input validation
  const body = await req.json().catch(() => null);
  if (!body) { ... }

  // 3. Business logic
  const result = await processData(body);

  // 4. Response
  return NextResponse.json({ data: result });
}
```

**Security Patterns:**
- Server-authoritative design: clients cannot bypass validation
- Service role key for privileged operations
- User ID from verified auth, never from request body
- Rate limiting with `checkRateLimit()`
- Fail-closed for moderation: block on error, not allow

---

*Convention analysis: 2026-01-17*
