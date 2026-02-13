# PRODUCT_ROADMAP.md — Voxlo Fresh Build

## Vision
Events + Vibe Reactions as the wedge. One metric: "Did a real human post a vibe today?"
AI content = scaffolding, not the building.

## Current State (Phase 0 Audit)
- 62,223 lines total
- page.tsx: 3,858 lines (god file — ALL app logic, 17 fetch() calls)
- 58 API routes, 50 components, 27 Supabase tables
- 19 bot personas in template-engine.ts
- Dead components: ~2,565 lines
- Intelligent bots system: 9,464 lines (target: ~500)
- Polling: setInterval every 2 min (no Realtime)
- "Posting unavailable" bug: OpenAI Moderation API timeout → fails closed → blocks ALL user posting

## Performance Budget
- FCP < 1.5s
- TTI < 3s
- Max 3 API calls on home screen load

---

## Phase 1: Dead Code & Simplification (IN PROGRESS)
**Goal:** Remove ~8,000 lines of dead/fabricated code. Zero behavior regressions.

### 1a. Dead Component Removal
- [ ] VenueVibeCheck.tsx (964 lines) — unused
- [ ] ChallengeCard.tsx (614 lines) — unused
- [ ] NotificationSettings.tsx (448 lines) — unused
- [ ] PredictionCard.tsx (630 lines) — unused
- [ ] ShareableSummaryCard.tsx (360 lines) — unused
- [ ] challenge-generator.ts (595 lines) — unused
- [ ] civic-templates.ts (539 lines) — unused
- [ ] Audit remaining components for dead imports

### 1b. Bot Persona Consolidation
- [ ] Kill 19 bot personas → single "Pulse Bot 🤖"
- [ ] Remove per-type persona randomization
- [ ] All bot posts use consistent name + avatar

### 1c. Intelligent Bots Gut
- [ ] Remove disabled engagement types entirely (not just gated)
- [ ] Remove spicy-templates.ts (345 lines)
- [ ] Simplify template-engine.ts (1,098 → ~200 lines)
- [ ] Simplify engagement-posts.ts (3,628 → ~300 lines)
- [ ] Keep: data-fetchers.ts, data-grounding.ts, situation-analyzer.ts (trimmed)

### 1d. Dead API Routes
- [ ] Remove /api/pulses/seed (already returns 410)
- [ ] Audit all 58 routes for dead/unused ones

---

## Phase 2: Core Architecture
**Goal:** Bundled API, fix moderation, Realtime.

### 2a. Bundled /api/pulse Endpoint
- [ ] Single server-side aggregation endpoint
- [ ] Combines: feed, weather, traffic into one response
- [ ] Max 3 API calls server-side, 1 fetch from client
- [ ] Replace 17 client-side fetch() calls

### 2b. Fix Moderation (Posting Blocker)
- [ ] OpenAI moderation timeout → fail OPEN with local filter fallback
- [ ] Local heuristics (Layer A) sufficient for non-AI moderation
- [ ] Remove hard dependency on OpenAI API for posting

### 2c. Supabase Realtime
- [ ] Replace setInterval polling with Realtime subscription
- [ ] Feed updates push instantly
- [ ] Remove 2-min poll interval

---

## Phase 3: page.tsx Decomposition
**Goal:** Break 3,858-line god file into modules.

- [ ] Extract auth logic → useAuth hook
- [ ] Extract feed logic → useFeed hook
- [ ] Extract tab rendering → separate components
- [ ] Extract posting form → PostComposer component
- [ ] Target: page.tsx < 500 lines

---

## Phase 4: UX Polish
- [ ] Events as primary tab (not Pulse)
- [ ] Vibe Reactions on posts
- [ ] Encourage user posting (CTAs, empty states)
- [ ] GPT-4o-mini for all AI features (not Opus)

---

## Rules
- Every commit: `npm run build` clean before push
- FIXES_LOG.md: read before editing, log after every fix
- No new dependencies without Ady's approval
- Atomic commits, conventional format
