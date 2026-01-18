# Architecture

**Analysis Date:** 2026-01-17

## Pattern Overview

**Overall:** Next.js App Router with Server-Client Hybrid

**Key Characteristics:**
- Server-side API routes with strict security boundaries (service role vs anon key)
- Fail-closed moderation pipeline (PII detection -> blocklist -> local -> AI -> Perspective)
- Client-side React components with custom hooks for state management
- Supabase as backend-as-a-service (auth, database, real-time)
- Intelligent bot system for content seeding based on real-time external data

## Layers

**Presentation Layer:**
- Purpose: User interface and interaction handling
- Location: `src/components/`, `src/app/page.tsx`
- Contains: React components (TSX), UI state management
- Depends on: Hooks, types, Supabase client
- Used by: End users via browser

**API Layer:**
- Purpose: Server-side business logic, authentication, data operations
- Location: `src/app/api/`
- Contains: Next.js Route Handlers (GET/POST/DELETE)
- Depends on: Supabase (service role), moderation pipeline, external APIs
- Used by: Frontend components via fetch()

**Business Logic Layer:**
- Purpose: Domain logic, validation, computations
- Location: `src/lib/`
- Contains: Moderation, gamification, geocoding, rate limiting, intelligent bots
- Depends on: External APIs (OpenAI, TomTom, Open-Meteo, Ticketmaster)
- Used by: API routes, some client components

**Data Access Layer:**
- Purpose: Database operations and real-time subscriptions
- Location: `lib/supabaseClient.ts` (client), inline in API routes (service role)
- Contains: Supabase client configuration
- Depends on: Supabase JS SDK
- Used by: API routes (service role), client components (anon key)

**Hooks Layer:**
- Purpose: Reusable stateful logic for client components
- Location: `src/hooks/`
- Contains: Custom React hooks for geolocation, gamification, events, push notifications
- Depends on: React, API layer
- Used by: Page components

## Data Flow

**Pulse Creation Flow:**

1. User submits pulse via `PulseInput` component
2. Client calls `POST /api/pulses` with auth bearer token
3. Server validates auth via user Supabase client
4. Rate limiting checked (5 pulses/hour/user)
5. PII detection runs first (blocks emails, phones, SSNs)
6. Moderation pipeline: blocklist -> local heuristics -> AI (Claude Haiku) -> optional Perspective API
7. If all pass, service role client inserts into `pulses` table (bypasses RLS)
8. Real-time subscription pushes update to all clients

**Intelligent Bot Seeding Flow:**

1. Cron job or admin triggers `POST /api/intelligent-seed`
2. System fetches real-time data: TomTom traffic, Open-Meteo weather, Ticketmaster events, USDA/OSM farmers markets
3. `buildSituationContext()` analyzes conditions (rush hour, weather, events)
4. `analyzeForPost()` decides if post is warranted (truth-first principle)
5. Cooldown system prevents spam (configurable per post type)
6. `generatePost()` creates contextual content with AI-powered fun facts
7. Posts inserted with `is_bot: true` flag, coordinates for radius filtering

**State Management:**
- Local component state via `useState` for UI interactions
- `useGamification` hook for user stats, badges, XP, tier
- `useGeolocation` hook for device location with localStorage caching (24h)
- Real-time pulse updates via Supabase subscription channel
- `sessionStorage` for tab state persistence across navigation

## Key Abstractions

**Pulse:**
- Purpose: Core content unit representing community updates
- Examples: `src/components/types.ts` (Pulse type), `src/app/api/pulses/route.ts`
- Pattern: Ephemeral content with category-based expiration (Traffic: 2h, Weather: 4h, Events/General: 24h)

**Moderation Pipeline:**
- Purpose: Multi-layer content safety system
- Examples: `src/lib/moderationPipeline.ts`, `src/lib/piiDetection.ts`, `src/lib/aiModeration.ts`
- Pattern: Fail-closed with three layers: deterministic (PII/blocklist/local) -> AI (Claude Haiku) -> optional Perspective API

**City Configuration:**
- Purpose: Hyperlocal content generation with real landmarks
- Examples: `src/lib/intelligent-bots/city-configs/austin.ts`, `src/lib/intelligent-bots/city-configs/leander.ts`
- Pattern: Pre-configured cities get hyperlocal content; others get dynamic configs from coordinates

**Gamification System:**
- Purpose: User engagement through XP, levels, tiers, badges
- Examples: `src/lib/gamification.ts`, `src/hooks/useGamification.ts`
- Pattern: XP-based progression (sqrt curve), weekly leaderboard tiers (Diamond/Gold/Silver/Bronze)

**Venue Vibe System:**
- Purpose: Crowd-sourced real-time venue atmosphere data
- Examples: `src/components/types.ts` (VenueVibe types), `src/app/api/venue-vibe/`
- Pattern: Trust scoring with confirmation/contradiction actions

## Entry Points

**Main Page:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Dashboard with tabs (Pulse, Events, Traffic, Local, Status), pulse feed, real-time updates

**API Routes:**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP requests from frontend
- Responsibilities: Authentication, data operations, external API integration

**Intelligent Seed:**
- Location: `src/app/api/intelligent-seed/route.ts`
- Triggers: Cron job, admin manual trigger
- Responsibilities: Generate contextual bot posts based on real-time conditions

**Cron Refresh:**
- Location: `src/app/api/cron/refresh-content/route.ts`
- Triggers: Scheduled execution (Vercel cron)
- Responsibilities: Content refresh, stale data cleanup

## Error Handling

**Strategy:** Fail-closed for security-critical paths, graceful degradation for features

**Patterns:**
- Moderation: Service errors return 503 (unavailable), content blocks return 400 (rejected)
- External APIs: Fallback to defaults when TomTom/Ticketmaster fail (e.g., hardcoded gas stations)
- Auth: 401 for missing/invalid tokens, 403 for ownership violations
- Rate limiting: 429 with `X-RateLimit-*` headers and reset time

## Cross-Cutting Concerns

**Logging:** `src/lib/logger.ts` - Structured logging with service/action context, privacy-safe (no PII in production logs)

**Validation:** Schema validation in API routes, type definitions in `src/components/types.ts`

**Authentication:** Supabase Auth with anonymous users, bearer token in Authorization header, service role for privileged operations

**Caching:**
- Weather API: 15 minutes (`Cache-Control: s-maxage=900`)
- Traffic data: 5 minutes (revalidate: 300)
- User rank: 5 minutes (client-side Map cache)
- Geolocation: 24 hours (localStorage)

**Rate Limiting:** In-memory LRU store (`src/lib/rateLimit.ts`), configurable per endpoint:
- Pulse creation: 50/hour (relaxed for testing, TODO: reduce to 5 for GA)
- Reporting: 10/day
- Venue vibe: 10/hour
- Global: 100/minute/IP

---

*Architecture analysis: 2026-01-17*
