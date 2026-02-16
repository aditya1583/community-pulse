# FIXES_LOG — Voxlo GA Blockers (2026-02-11)

---

## Commit: TBD (2026-02-14) — 3 fixes: CORS, delete, green banner

### FIX 1: Posting broken on iOS/Capacitor — CORS headers missing on API responses ✅
**Files:** `src/middleware.ts`
**Root cause:** Middleware handled OPTIONS preflight with `Access-Control-Allow-Origin: *` but did NOT add CORS headers to the actual POST/GET responses. WKWebView (Capacitor) sends requests from `capacitor://` origin to `https://voxlo-theta.vercel.app`, which is cross-origin. Browser allows the preflight but blocks the actual response because it lacks `Access-Control-Allow-Origin`.
**What changed:** Added CORS headers to ALL `/api/*` responses via middleware, not just OPTIONS preflight.
**Impact:** ALL posting was broken on iOS. Web unaffected (same-origin). Ady confirmed fix works.

### FIX 2: Delete pulse does nothing on iOS/Capacitor ✅
**Files:** `src/app/page.tsx`
**Root cause:** `handleDeletePulse` used `supabase.from("pulses").delete()` directly. On Capacitor, auth goes through `authBridge`/`serverAuth` — the Supabase JS client has NO active session. So the delete fires with no auth token, RLS silently blocks it, and no error is returned.
**What changed:** Replaced direct Supabase client call with `fetch(getApiUrl("/api/pulses?id=X"), { method: "DELETE", headers: { Authorization: Bearer token } })` using `authBridge.getAccessToken()`. Same pattern as posting.
**Impact:** Delete was silently failing on iOS for ALL users.

### FIX 3: Green/gray banner at top of iOS app ✅
**Files:** `public/manifest.webmanifest`, `src/app/layout.tsx`, `capacitor.config.ts`
**Root cause:** `manifest.webmanifest` had `theme_color: "#10b981"` (emerald). First fix changed to `#09090b` but that was still visible as a gray bar against the content background. The safe-area zone behind the status bar needs to be pure black to be invisible.
**What changed:** Set ALL background/theme colors to `#000000` — manifest theme_color, manifest background_color, viewport themeColor, Capacitor backgroundColor, body class (bg-black).
**Impact:** Cosmetic — visible colored bar at top of every screen on iOS.

### FIX 4: Events tab shows "Sign in to share" even when signed in ✅
**Files:** `src/app/page.tsx`
**Root cause:** `isSignedIn={!!sessionUser}` — on app launch, Events is the default tab and renders before auth resolves. `sessionUser` starts null, so `isSignedIn=false` → "Sign in to share" flashes. On Capacitor with authBridge, this delay is longer.
**What changed:** Changed all 4 instances of `isSignedIn={!!sessionUser}` to `isSignedIn={authStatus !== "signed_out"}`. During "loading" state, assumes signed in (no flash). Shows sign-in prompt only after auth explicitly resolves to signed_out.

---

## Commit: 2d0fba1 (2026-02-12) — 4 Bug Fixes

### FIX 1: Weather post deduplication not working ✅
**Files:** `src/app/api/cron/refresh-content/route.ts`
**What changed:** Extended dedup window from 2 hours to 3 hours. Now uses normalized city name comparison (splits on comma, compares first segment case-insensitively) so "Leander, Texas, US" and "Leander, Texas" match. Checks for ANY bot post with the same tag for that city within 3 hours, regardless of exact content or timestamp.

### FIX 2: Duplicate user posts in feed ✅
**Files:** `src/app/page.tsx`
**What changed:** Added frontend dedup in `visiblePulses` memo. After filtering expired pulses, removes posts with identical `author + message` content within a 5-minute window. Uses a Map to track seen content keys with timestamps. React keys were already using `pulse.id` (not index), so this was a data-level issue.

### FIX 3: Storm alert contradictory data ("0 inches of rain" + "thunderstorms") ✅
**Files:** `src/lib/intelligent-bots/situation-analyzer.ts`, `src/lib/intelligent-bots/template-engine.ts`, `src/lib/intelligent-bots/engagement-posts.ts`
**What changed:** Three-layer fix:
1. **situation-analyzer.ts:** If weather code says "storm" but `precipitation < 0.1mm`, downgrades to a mild weather post (priority 3, perfectWeather template) instead of a dramatic storm alert (priority 9).
2. **template-engine.ts:** `getWeatherCategory()` returns empty string (skip weather post) when storm code has `precipitation < 0.1mm`.
3. **engagement-posts.ts:** `generateWeatherAlertPost()` and `analyzeForEngagement()` now require `precipitationMm > 2.5` (~0.1 inches) before generating storm alerts. Weather codes 80-99 (thunderstorms) with 0mm precip no longer trigger STORM ALERT posts.

### FIX 4: Local tab reliability — API timing out ✅
**Files:** `src/app/api/foursquare/places/route.ts`, `src/components/LocalDealsSection.tsx`
**What changed:**
1. **Foursquare route:** Reduced `AbortSignal.timeout` from 10s to 5s.
2. **LocalDealsSection:** Added retry mechanism — if first OSM fetch fails/times out (5s), retries once more.
3. **localStorage cache:** Added 1-hour localStorage persistence alongside 15-min in-memory cache. On fetch failure after both retries, falls back to stale localStorage data instead of showing "Search on Google Maps".
4. **Cache promotion:** localStorage entries are promoted to in-memory cache on hit for faster subsequent reads.

### Build Status
✅ `npm run build` passes clean

### Push Status
✅ Pushed to origin/main

---

## Commit: 4b155b0 (2026-02-12) — 5 Critical Bug Fixes

### FIX 1: Top Padding — Double safe area inset ✅
**Files:** `capacitor.config.ts`, `ios/App/App/capacitor.config.json`
**What changed:** Changed `contentInset: 'always'` to `contentInset: 'automatic'`. The native WebView was adding safe area insets AND the CSS `env(safe-area-inset-top)` was adding them again, doubling the top padding. With `automatic`, only the CSS env() handles it.

### FIX 2: Auth — signUp with existing email shows "Account created" ✅
**Files:** `src/app/page.tsx`
**What changed:** Added `created_at` timestamp check alongside existing empty-identities detection. If `signUpData.user.created_at` is more than 1 minute old AND no session was returned, the account already existed. Shows "already registered" and switches to sign-in tab. This catches cases where Supabase returns non-empty identities for existing confirmed emails.

### FIX 3: Events — "No events nearby" for Leander TX ✅
**Files:** `src/app/api/events/ticketmaster/route.ts`
**What changed:** Removed `stateCode` parameter from Ticketmaster latlong queries. When `stateCode` is combined with `latlong`, it can filter OUT valid events (Ticketmaster's stateCode works best with keyword searches, not geo queries). The latlong+radius already constrains results geographically. State param is still used for metro fallback detection (finding nearest metro like Austin when Leander returns 0 events).

### FIX 4: Coffee Shops — Wrong location / city center instead of GPS ✅
**Files:** `src/app/page.tsx`
**What changed:** `localLat`/`localLon` now prefer `geolocation.lat`/`geolocation.lon` (exact GPS) over `selectedCity` coords (city center). This means the Local tab's Foursquare places API gets the user's actual position instead of Leander city center (~30.5788, -97.8531), returning genuinely nearby coffee shops.

### FIX 5: Location Permission Not Prompting ✅
**Files:** `src/hooks/useGeolocation.ts`
**What changed:** After loading cached location from localStorage, the hook now verifies actual native Capacitor geolocation permission. If the cache exists but native permission is still "prompt" (never granted to the iOS app), the cache is cleared and `permissionStatus` is set to "prompt", allowing the LocationPrompt component to display. This fixes the case where a web-session cache prevents the native app from ever showing the location prompt.

### Build Status
✅ `npm run build` passes clean
✅ `npx cap sync ios` completed

### Push Status
✅ Pushed to origin/main

---

## Commit: a65f208 (2026-02-12) — 5 Bug Fixes

### FIX 1: Auth — Sign-in shows "Account created" for existing accounts ✅
**Files:** `src/app/page.tsx`
**What changed:** Supabase's `signUp()` on an already-registered email returns a user object with `identities: []` (empty array) instead of an error. The code was falling through to the "Account created! Check your email" branch. Now detects empty identities array and shows "This email is already registered. Please sign in instead." and auto-switches to the Sign In tab.

### FIX 2: Duplicate weather posts (STORM ALERT ×3) ✅
**Files:** `src/app/api/cron/refresh-content/route.ts`
**What changed:** The cron route was generating posts via `generateIntelligentPost()` and inserting directly, bypassing the auto-seed dedup logic. Added per-tag dedup check before insert: queries `pulses` for `is_bot = true AND tag = {tag} AND created_at > now() - 2h` for the same city. If a matching post exists, skips insertion.

### FIX 3: Data attribution inline in post body ✅
**Files:** `src/components/PulseCard.tsx`
**What changed:** The `📡 Data: Open-Meteo • timestamp` text was rendered inline in the message body. Now the PulseCard detects the `📡 Data:` prefix, splits it from the main message, and renders it as a 9px muted footer (`text-white/20`) below the card content, visually separated from the post.

### FIX 4: Excess top padding on iOS ✅
**Files:** `src/app/page.tsx`
**What changed:** Reduced `pt-[env(safe-area-inset-top,0.5rem)]` default fallback from `0.5rem` to `0.25rem`. The `env(safe-area-inset-top)` still provides proper spacing on notched iPhones; the fallback is only for non-notch devices where 0.5rem was excessive.

### FIX 5: Events showing wrong Leander (WV instead of TX) ✅
**Files:** `src/app/api/events/ticketmaster/route.ts`, `src/hooks/useEvents.ts`, `src/app/page.tsx`
**What changed:**
1. Added `state` option to `useEvents` hook, passed from `selectedCity.state`
2. Hook sends `state` query param to the Ticketmaster API route
3. API route uses `stateCode` param in Ticketmaster Discovery API query to filter results by state
4. Nominatim geocoding query now includes state (e.g., "Leander, TX, US") to avoid matching wrong city

### FIX 6: Timestamps showing UTC instead of local timezone ✅
**Files:** `src/components/PulseCard.tsx`, `src/lib/pulses.ts`
**What changed:**
1. `formatPulseDateTime()` now includes AM/PM (e.g., "2/12/26 12:00 PM" instead of "2/12/26 12:00")
2. PulseCard data attribution footer: parses the server-generated "2026-02-12 18:00:42 UTC" string and converts to user's local time via `toLocaleString()` (e.g., "Feb 12, 12:00 PM"). No "UTC" ever shown to users.
3. Verified other timestamp displays (AISummaryCard, EventCard, comments) already use local time methods.

### Build Status
✅ `npm run build` passes clean

### Push Status
✅ Pushed to origin/main

## Commit: 0e95b78

### BLOCKER 1: Location prompt flow ✅
**Status:** Already wired and functional; persistence improved
**Files:** `src/hooks/useGeolocation.ts`
**What changed:** Location cache extended from 5 minutes to 24 hours. The location prompt was already correctly gated in `src/app/page.tsx` (lines 2946-2985) — shows LocationPrompt when `permissionStatus === "prompt"` and no cached location. The 10-mile radius filtering uses `RADIUS_CONFIG` from `src/lib/constants/radius.ts`. The issue was the 5-minute cache caused location to be re-requested too aggressively, making it seem "not wired."

### BLOCKER 2: React polling too aggressive ✅
**Status:** Fixed
**Files:** `src/components/PulseLikeButton.tsx`
**What changed:** `setInterval` polling reduced from 10,000ms (10s) to 60,000ms (60s). The polling was in `PulseLikeButton.tsx` (not `PulseReactions.tsx` as originally suspected). With 5 visible pulses: 50 API calls/min → 5 API calls/min. Realtime subscription is also present as primary update mechanism.

### BLOCKER 3: Raw markdown in briefs ✅
**Status:** Fixed (prompt + rendering)
**Files:** `src/app/api/summary/route.ts`, `src/components/AISummaryCard.tsx`, `src/components/AISummaryStories.tsx`, `src/components/PulseCard.tsx`
**What changed:**
1. Summary API prompt changed from `**☀️ Weather**` markdown headers to plain `☀️ Weather:` format
2. Added `stripMarkdown()` utility in AISummaryCard and AISummaryStories
3. PulseCard now strips `**bold**`, `__bold__`, `*italic*`, `_italic_` inline in message rendering

### BLOCKER 4: AI content fabrication validation ✅
**Status:** Tightened
**Files:** `src/lib/intelligent-bots/fun-facts-ai.ts`, `src/lib/intelligent-bots/engagement-posts.ts`
**What changed:**
1. Fun facts system prompt: Added explicit anti-fabrication rules — no invented business names, no "hidden gem" claims, no fabricated locations/addresses
2. Event fun facts prompt: Added anti-fabrication clause
3. Engagement posts: Replaced 6 insider-tip templates that claimed specific businesses/deals with community question formats
4. Replaced nostalgia template referencing `{closedBusiness}` with open-ended question
5. Replaced 5 discovery templates that fabricated restaurant claims with question-based alternatives
**Existing protections verified:** `src/app/api/summary/route.ts` (comprehensive SYSTEM_PROMPT), `src/lib/ai.ts` (news summary anti-hallucination), `src/lib/intelligent-bots/spicy-templates.ts` (header rules)

### BLOCKER 5: CORS on vote endpoint ✅
**Status:** Fixed
**Files:** `src/middleware.ts`
**What changed:** Added `x-user-identifier` to `Access-Control-Allow-Headers` in the CORS preflight handler. This applies to ALL `/api/*` routes via the middleware matcher.

---

## Build Status
✅ `npm run build` passes clean (no errors, no warnings)

## Push Status
⚠️ Git push to origin/main failed — permission denied (403). Needs repo owner to push or grant access.

---

## Commit: (2026-02-12) — Static Content Removal & Data Grounding

### BLOCKER 6: Remove all static/fabricated pulse content ✅
**Status:** Fixed — comprehensive data grounding enforced

#### New File: `src/lib/intelligent-bots/data-grounding.ts`
Central module that defines which engagement types are data-grounded vs fabricating:
- `DATA_GROUNDED_ENGAGEMENT_TYPES`: Set of allowed types backed by real API data
- `FABRICATING_ENGAGEMENT_TYPES`: Set of blocked types that invent specific details
- `checkDataAvailability()`: Checks which APIs actually returned real data
- `addDataAttribution()`: Adds `📡 Data: source • timestamp` to every bot post
- `getPostDataSources()`: Maps post types to their API data sources

#### Files Changed:

**`src/lib/intelligent-bots/engagement-posts.ts`**
- Imported data-grounding module
- `analyzeForEngagement()`: Added `isAllowed()` gate — only data-grounded types can be selected
- **DISABLED** engagement types that fabricate details:
  - `hot_take` — fabricates claims about specific restaurants/roads
  - `insider_tip` — fabricates "secret menu items", specific parking tips
  - `nostalgia_trigger` — fabricates specific memories, old business names
  - `community_callout` — fabricates specific actions at specific locations
  - `fomo_alert` — fabricates happy hour times, restaurant wait times
  - `weekly_roundup` — fabricates trending topics, weather summaries
  - `local_spotlight` — fabricates restaurant appreciation claims
  - `venue_checkin` — references venues from city config as verified
  - `landmark_food` — fabricates specific food recommendations
- **KEPT** data-grounded types:
  - `this_or_that` — uses real weather temp from Open-Meteo
  - `prediction` — uses real weather/traffic data
  - `weather_alert` — uses real forecast from Open-Meteo
  - `route_pulse` — uses real TomTom congestion data
  - `school_alert` — time-based with real road names
  - `farmers_market` — uses real USDA/OSM market data
  - `confession_booth` — generic community questions, no fabrication
  - `neighbor_challenge` — generic CTAs, no fabrication
  - `would_you_rather` — clearly hypothetical scenarios
  - `civic_alert` — civic awareness questions
  - `poll` — asks questions, doesn't claim facts
  - `recommendation` — asks questions, doesn't claim facts
- `generateEngagementPost()`: Added hard block on non-grounded types + data attribution
- `generateEngagementSeedPosts()`: Removed all fabricating types from priority list

**`src/lib/intelligent-bots/template-engine.ts`**
- Imported data-grounding module
- `generatePost()`: Added data source attribution to all regular posts (Traffic → TomTom, Weather → Open-Meteo, Events → Ticketmaster)

**`src/lib/intelligent-bots/index.ts`**
- Exported data-grounding module
- `generateColdStartPosts()`: Added minimum 2-post threshold — if fewer than 2 posts can be generated from real data, returns "Nothing happening right now — check back later" instead of fabricated content

**`src/app/api/auto-seed/route.ts`**
- DISABLED generic fallback traffic/weather/local templates that generated fabricated content without any API data
- Generic `TRAFFIC_TEMPLATES` (morning_rush, evening_rush, light) — fabricated congestion claims
- Generic `LOCAL_TEMPLATES` — fabricated community claims
- Posts only generated when real event/weather data is passed in

**`src/app/api/pulses/seed/route.ts`**
- DEPRECATED entire endpoint (returns 410 Gone)
- This endpoint had fully static `PULSE_TEMPLATES` with fabricated content like "Roads are looking clear!" and "Beautiful day out here!" without any API data
- Redirects to /api/auto-seed or /api/intelligent-seed

#### What's Still Allowed (Real Data Sources):
| Source | API | Key Required | Status |
|--------|-----|-------------|--------|
| Traffic | TomTom Flow API | Yes (TOMTOM_API_KEY) | ✅ Configured |
| Weather | Open-Meteo Forecast | No (free) | ✅ Always available |
| Farmers Markets | USDA + OSM | No (free) | ✅ Always available |
| Events | Ticketmaster | Yes (TICKETMASTER_CONSUMER_KEY) | ❌ Not configured |

#### Every Bot Post Now Includes:
```
📡 Data: TomTom, Open-Meteo • 2026-02-12 16:48:23 UTC
```
This enables freshness auditing — you can see exactly what data backed each post and when.

#### Build Status
✅ `npm run build` passes clean (also fixed pre-existing `@capacitor/app` missing dependency)

---

## Commit: 510784a (2026-02-13) — Phase 1 Dead Code Removal

### CHANGE 1: 19 Bot Personas → Single Pulse Bot 🤖 ✅
**Files:** `src/lib/intelligent-bots/template-engine.ts`, `src/app/api/auto-seed/route.ts`
**What changed:** Replaced 19 randomized bot personas (TrafficGrump, EventHyper, munching_bot, etc.) with a single "Pulse Bot 🤖" persona. All bot posts now use consistent `{city} Pulse Bot 🤖` author name. Removed BOT_PERSONAS record, simplified getBotName/getBotPersona to always return Pulse Bot.

### CHANGE 2: Dead Components Removed (6 files, ~2,925 lines) ✅
**Files deleted:** `VenueVibeCheck.tsx` (964), `ChallengeCard.tsx` (614), `NotificationSettings.tsx` (448), `AISummaryCard.tsx` (316), `ShareableSummaryCard.tsx` (360), `PulseReactions.tsx` (223)
**What changed:** All confirmed dead — no imports found in codebase. Removed dead import of ShareableSummaryCard from AISummaryStories.tsx.

### CHANGE 3: Dead API Routes Removed (6 routes, ~1,600 lines) ✅
**Files deleted:** `/api/challenges/route.ts`, `/api/challenges/[id]/claim/route.ts`, `/api/civic/meetings/route.ts`, `/api/civic/meetings/[id]/decisions/route.ts`, `/api/pulses/seed/route.ts` (was already 410), `/api/vibe-confirm/route.ts`
**What changed:** All confirmed dead — no frontend references found. Civic meeting routes had no data source anyway.

### CHANGE 4: Intelligent Bots System Gutted ✅
**Files deleted:** `spicy-templates.ts` (345), `challenge-generator.ts` (595), `civic-templates.ts` (539)
**Files rewritten:** `engagement-posts.ts` (3,628 → 928), `template-engine.ts` (1,098 → 902)
**What changed:** Removed all fabricated engagement types and their handlers. Kept only data-grounded types: weather_alert, route_pulse, this_or_that, prediction, school_alert, farmers_market, confession_booth, neighbor_challenge, would_you_rather, civic_alert, poll, recommendation. Removed spicy template system entirely — all posts now use standard data-backed templates.

### Totals
- Total codebase: 62,223 → 53,431 lines (**-8,792 lines**)
- Intelligent bots: 9,464 → 6,080 lines
- Components: 50 → 44
- API routes: 58 → 52

### Build Status
✅ `npm run build` passes clean

### Push Status
✅ Pushed to apple/main

---

## Commit: 530d67c (2026-02-14) — Sign-out redirect + iOS gap fix

### FIX 1: Sign-out redirects to login screen (not Events page) ✅
**Files:** `src/app/page.tsx`
**What changed:** Sign-out handler changed from `window.location.reload()` to `window.location.href = "/?signed_out=1"`. On load, `?signed_out=1` param triggers auth modal and sets active tab to Pulse. URL cleaned via `history.replaceState`. Both sign-out handlers updated (Pulse header + Status tab).
**Root cause:** Default tab was `"events"` — after reload, user landed on Events with no sign-in prompt.

### FIX 2: Pure black background for iOS safe-area gap ✅
**Files:** `src/app/page.tsx`, `src/app/globals.css`
**What changed:** Fixed background div `bg-[#09090b]` → `bg-black` in page.tsx. CSS `--background: #09090b` → `--background: #000000` in globals.css.
**Root cause:** `#09090b` (dark gray) was visible through the transparent iOS status bar, creating a subtle gap/bar at the top.

### Build Status
✅ `npm run build` passes clean
✅ 7/8 E2E tests pass (1 skipped)

### Deploy Status
✅ Pushed to apple/main, Vercel auto-deployed
✅ Verified on https://voxlo-theta.vercel.app/?signed_out=1 — auth modal shows, Pulse tab active

---

## Commit: 86eb8f4 (2026-02-14) — Default tab = Pulse, cache-busting

### FIX 1: Default landing page changed from Events → Pulse ✅
**Files:** `src/app/page.tsx`, `e2e/core-flows.spec.ts`
**What changed:** `useState<TabId>("events")` → `useState<TabId>("pulse")`. Fallback also updated. E2E test updated to verify Pulse loads as default (city search bar visible).
**Root cause:** Events was hardcoded as default tab. Ady wants Pulse (the main feed) as the landing page.

### FIX 2: Cache-busting headers for WKWebView ✅
**Files:** `next.config.ts`
**What changed:** Added `Cache-Control: no-cache, no-store, must-revalidate` header for all routes. Prevents WKWebView from serving stale HTML/JS after deploys.

### Verification
- ✅ Fresh load → Location prompt → Pulse tab (not Events)
- ✅ Signed-in load → Pulse tab with dashboard + feed
- ✅ Sign-out → Auth modal on Pulse tab
- ✅ 7/8 E2E tests pass on deployed Vercel URL
- ✅ `npm run build` clean

### Deploy Status
✅ Pushed to apple/main, Vercel deployed

---

## Commit: d648985 (2026-02-14) — Distance badges + action bar fix

### FIX 1: Distance badge shows on ALL pulses with distance ✅
**Files:** `src/components/PulseCard.tsx`
**What changed:** DistanceBadge now uses `showAlways` prop and shows for any pulse with `distanceMiles > 0`. Previously only showed for >10mi. Now in-radius events show green distance, out-of-radius show amber/orange.

### FIX 2: Action bar overlap reduced ✅
**Files:** `src/components/PulseCard.tsx`
**What changed:** Footer restructured from single row to flex-col with inner justify-between. Reduced gap from 3 to 2. Timestamp font reduced to 10px.

### Build/Test Status
✅ `npm run build` clean, 7/8 E2E pass

---

## Commit: (2026-02-16) — Dead code cleanup, bot audit, session fallback

### Task 1: Bot fun facts audit ✅
**Status:** No changes needed
**Finding:** `fun-facts-ai.ts` uses GPT-4o-mini with comprehensive anti-fabrication rules in system prompts. No hardcoded facts — all generated dynamically from real context (events, weather, traffic). Prompts are well-structured with explicit rules against inventing business names, deals, or locations.

### Task 2: Dead code removal ✅
**Files:** `src/components/PulseCard.tsx`, `src/lib/pulses.ts`, `src/lib/__tests__/pulses.test.ts`
**What changed:**
1. Removed `ExpiryBadge` component and its `ClockIcon` helper from PulseCard.tsx (~70 lines). Neither was referenced anywhere in the codebase.
2. Removed `formatPulseDateTime` export from `pulses.ts` (~15 lines) — no callers outside its own test file.
3. Updated test file to remove `formatPulseDateTime` import and test cases.

### Task 3: Local tab dead code cleanup ✅
**Files:** `src/components/LocalDealsSection.tsx`
**What changed:** Removed 4 unused category entries from `DEAL_CATEGORIES` (coffee, food, bars, groceries). The filter pills UI was already removed in commit 2bc0710, but the data array still had the entries. `activeCategory` is hardcoded to `"all"` so only the "all" entry is needed. `CATEGORY_ICONS` kept — still used for rendering place cards.

### Task 4: Delete button session fallback ✅
**Files:** `src/app/page.tsx`
**What changed:** Added defensive `useEffect` that re-fetches the user from `authBridge.getUser()` when `authStatus === "signed_in"` but `sessionUser` is null. This handles the Capacitor/WKWebView race condition where `onAuthStateChange` fires SIGNED_IN before `getUser()` resolves, leaving `sessionUser` null and breaking `isOwnPulse` checks (delete button hidden on own posts).

### Build Status
✅ `npm run build` passes clean
