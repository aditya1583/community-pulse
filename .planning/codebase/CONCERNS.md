# Codebase Concerns

**Analysis Date:** 2026-01-17

## Tech Debt

**Rate Limiting Relaxed for Testing:**
- Issue: Rate limit for pulse creation is set to 50/hour instead of production 5/hour
- Files: `src/lib/rateLimit.ts:45-50`
- Impact: Allows potential spam abuse if deployed to production without adjustment
- Fix approach: Reduce `PULSE_CREATE.limit` back to 5 before GA launch (marked with TODO comment in code)

**In-Memory Rate Limiting (No Distributed Support):**
- Issue: Rate limiting uses in-memory Map, does not work across multiple server instances
- Files: `src/lib/rateLimit.ts:24-26`
- Impact: Users can bypass rate limits by hitting different server instances in multi-instance deployment
- Fix approach: Migrate to Redis or Supabase-backed rate limiting for production at scale

**Type Safety Bypasses in Multiple Files:**
- Issue: Use of `any` type and `eslint-disable` comments
- Files:
  - `src/lib/username.ts:146-147` - SupabaseClient typed as `any`
  - `src/app/venue/[id]/page.tsx:19,22` - venue and sessionUser typed as `any`
  - `src/components/LocalDealsSection.tsx:166` - OSM place data typed as `any`
  - `src/hooks/useEvents.ts:141` - eslint-disable for react-hooks/exhaustive-deps
  - `src/app/page.tsx:1661` - eslint-disable for react-hooks/exhaustive-deps
- Impact: Reduced type safety, potential runtime errors
- Fix approach: Create proper type definitions for Supabase client, venue data, and API responses

**Duplicate Supabase Client Initialization:**
- Issue: Supabase client is created in multiple locations instead of using shared client
- Files:
  - `lib/supabaseClient.ts` - Shared client (correct approach)
  - `src/app/venue/[id]/page.tsx:8-11` - Creates new client inline
- Impact: Inconsistent client configuration, harder to maintain
- Fix approach: Import from `lib/supabaseClient.ts` in venue page

**Pending Database Migrations:**
- Issue: Several migrations may not be applied in all environments
- Files: `PENDING_TODOS.md:9-21`
- Impact: Gamification, notifications, and venue features may not work without migrations
- Fix approach: Document migration status, consider automated migration tracking

## Known Bugs

**No explicit bugs documented in code**
- The codebase uses robust error handling with try/catch blocks throughout
- Console logging is used extensively for debugging rather than a structured logging system

## Security Considerations

**Environment Variable Exposure Risk:**
- Risk: Non-null assertions (`!`) used when accessing env vars without validation
- Files:
  - `lib/supabaseClient.ts:3-4`
  - `src/app/venue/[id]/page.tsx:9-10`
  - `src/app/api/pulses/route.ts:78-79`
- Current mitigation: `.env.example` documents required variables
- Recommendations: Add runtime validation for required env vars at startup

**Fail-Closed Moderation (Correctly Implemented):**
- Files: `src/app/api/pulses/route.ts:10-16`
- Current state: Production ALWAYS fails closed regardless of env var settings - this is correct
- Notes: Well-documented security model with PII detection, AI moderation, and blocklist

**API Key Exposure Prevention:**
- Files: `.env.example:1-157`
- Current mitigation: Clear documentation of which keys are public vs secret
- Recommendations: Continue current practices

## Performance Bottlenecks

**Massive Main Page Component:**
- Problem: `src/app/page.tsx` is 3925 lines - extremely large single component
- Files: `src/app/page.tsx`
- Cause: All dashboard logic, state, and UI in one file
- Improvement path: Break into smaller components, extract custom hooks for state management

**Large Engagement Posts Module:**
- Problem: `src/lib/intelligent-bots/engagement-posts.ts` is 3244 lines
- Files: `src/lib/intelligent-bots/engagement-posts.ts`
- Cause: All engagement post logic in single file
- Improvement path: Split by engagement type into separate modules

**Console Logging in Production Code:**
- Problem: ~80+ console.log/error/warn statements in source code
- Files: Multiple files in `src/` (see grep results)
- Cause: Debug logging left in production code
- Improvement path: Replace with structured logger (already exists at `src/lib/logger.ts`), remove debug logs

**No Request Caching for External APIs:**
- Problem: Every request to external APIs (weather, events, gas stations) is a fresh fetch
- Files: `src/app/page.tsx` (weather, gas station fetches)
- Cause: No client-side or server-side caching layer
- Improvement path: Add SWR/React Query for client caching, consider edge caching for API routes

## Fragile Areas

**Main Page State Management:**
- Files: `src/app/page.tsx:153-186`
- Why fragile: 30+ useState hooks in single component, complex interdependencies
- Safe modification: Extract related state into custom hooks
- Test coverage: Single test file `src/app/__tests__/page.test.tsx` - limited coverage

**Intelligent Bots System:**
- Files:
  - `src/lib/intelligent-bots/engagement-posts.ts`
  - `src/lib/intelligent-bots/template-engine.ts` (963 lines)
  - `src/lib/intelligent-bots/data-fetchers.ts` (916 lines)
- Why fragile: Complex interdependencies between context, templates, and data fetchers
- Safe modification: Extensive test coverage exists at `src/lib/__tests__/intelligentBots.test.ts`
- Test coverage: Good unit tests for bot logic

**Geolocation to City Sync:**
- Files: `src/app/page.tsx:1187-1230`
- Why fragile: Complex coordination between geolocation hook, localStorage, and state
- Safe modification: Test thoroughly in multiple scenarios (fresh load, manual location, permission denied)
- Test coverage: Limited

## Scaling Limits

**In-Memory Rate Limit Store:**
- Current capacity: 10,000 entries (MAX_STORE_SIZE)
- Limit: Single instance only; evicts oldest 10% when full
- Scaling path: Redis or database-backed rate limiting

**Real-time Subscriptions:**
- Current capacity: Depends on Supabase plan limits
- Limit: Connection limits per plan
- Scaling path: Monitor Supabase connection usage

## Dependencies at Risk

**No Critical Dependency Risks Identified:**
- Stack uses stable, well-maintained packages
- Supabase, Next.js, and Anthropic SDK are all actively developed

## Missing Critical Features

**No Admin Dashboard:**
- Problem: Admin functions (reports, moderation) accessible only via API
- Files: `src/app/api/admin/` routes exist but no UI
- Blocks: Efficient content moderation at scale

**No Offline Support:**
- Problem: Service worker registered but no offline data caching
- Files: `src/components/ServiceWorkerRegister.tsx`
- Blocks: Usage in poor connectivity areas

## Test Coverage Gaps

**Main Page Integration Tests:**
- What's not tested: Full page rendering with real Supabase calls
- Files: `src/app/__tests__/page.test.tsx` - skeleton tests only
- Risk: UI regressions in complex state scenarios
- Priority: Medium

**Venue Page:**
- What's not tested: No test file exists for venue page
- Files: `src/app/venue/[id]/page.tsx`
- Risk: Breaking changes to venue detail flow
- Priority: Medium

**Component Tests:**
- What's not tested: Most UI components lack unit tests
- Files: `src/components/` - 40+ components, few with tests
- Risk: UI regressions from refactoring
- Priority: Low (visual testing may be more appropriate)

**API Route Tests:**
- What's tested well:
  - `src/app/api/pulses/__tests__/route.test.ts` (1366 lines - comprehensive)
  - `src/app/api/gamification/__tests__/` (stats and leaderboard)
  - `src/app/api/weather/__tests__/route.test.ts`
- What's not tested: Most other API routes
- Risk: Breaking changes to API contracts
- Priority: High for critical paths (pulses, auth)

**Moderation Pipeline:**
- What's tested well: Comprehensive test coverage
- Files:
  - `src/lib/__tests__/moderation.test.ts`
  - `src/lib/__tests__/moderationPipeline.test.ts`
  - `src/lib/__tests__/moderationComprehensive.test.ts`
  - `src/lib/__tests__/aiModeration.test.ts`
  - `src/lib/__tests__/piiDetection.test.ts` (775 lines)
- Risk: Low - well tested
- Priority: Maintain current coverage

---

*Concerns audit: 2026-01-17*
