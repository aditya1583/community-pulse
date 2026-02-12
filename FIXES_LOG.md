# FIXES_LOG — Voxlo GA Blockers (2026-02-11)

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
