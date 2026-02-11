# FIXES_LOG — Voxlo GA Blockers (2026-02-11)

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
