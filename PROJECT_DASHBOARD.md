# VOXLO — PROJECT DASHBOARD
Updated: 2026-02-09 12:23 CST

---

## CURRENT STATE: v1.0.28 Build 28 (TestFlight)
Web: https://voxlo-theta.vercel.app/
Domain: voxlo.app (owned)

---

## PHASE 1: CORE LOCK — The Only Things That Matter Right Now

### 🔴 CRITICAL BLOCKERS (ship-stopping)

| # | Issue | Status | What's Wrong | Fix Approach |
|---|-------|--------|--------------|--------------|
| 1 | **Posting broken** | ❌ BROKEN | Auth hangs in WKWebView — same root cause as feed | Server-side auth endpoint (same pattern that fixed feed) |
| 2 | **AI summaries dead** | ❌ BROKEN | Not triggering + irrelevant when they do | Debug `/api/summary` route, fix trigger logic, improve prompts |
| 3 | **Pull-to-refresh** | ⚠️ FLAKY | Works sometimes, hangs other times | Needs investigation — may be related to WKWebView networking |

### 🟡 CORE FEATURES (Phase 1 scope from Ady — 2026-02-06)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | User logs in → 10-mile radius prompt | ⚠️ PARTIAL | `LocationPrompt` component exists but needs wiring |
| 2 | Show city name (never coordinates) | ✅ DONE | Fixed city name resolution (coordinate bounding box) |
| 3 | Emoji vibe / mood indicator | ⚠️ EXISTS | `CurrentVibeCard`, `StatusRing` built — needs feed integration |
| 4 | Weather glance at top | ⚠️ EXISTS | Weather API route works, needs top-of-feed placement |
| 5 | Scroll sections: Traffic, Weather, Local | ⚠️ PARTIAL | Components exist (`TrafficContent`, `LocalTab`, `FarmersMarketsSection`) — not in sectioned layout |
| 6 | User posts = GOLD (encourage posting) | ❌ BLOCKED | Can't post (see blocker #1) |
| 7 | Bot post limits (5-7 per city) | ✅ DONE | Cleanup endpoint + expiration rules in place |

---

## WHAT WORKS RIGHT NOW ✅

- Feed loads on iOS (server-side endpoint fix)
- Feed loads on web
- Bot content generation (intelligent bots + auto-seed)
- Content expiration/cleanup
- Cron runs (refresh-content every 30 min, active cities only)
- API response caching (Supabase api_cache table)
- Content moderation pipeline (2-layer, fail-closed)
- Gamification system (XP, badges, leaderboard)
- Push notifications infrastructure
- Reverse geocoding
- Maps/heatmap
- TestFlight build pipeline (autonomous)
- Vercel deployment (auto on push to `apple` remote)

## WHAT'S BUILT BUT NOT WIRED 🔧

- Challenges system
- Venue vibe check
- Live vibes
- QR codes
- Air quality
- Gas prices
- Farmers markets
- Event cards (Ticketmaster)
- Foursquare places
- City mood
- Civic meetings
- Poll voting
- Prediction cards

## THE ROOT CAUSE OF EVERYTHING 🏗️

**Supabase JS client is BROKEN in Capacitor WKWebView.**

Every feature that touches the DB or auth from iOS must go through server-side API routes. This is the architecture constraint. Feed was fixed this way. Posting and auth need the same treatment.

**Pattern**: Client → `/api/[feature]/route.ts` (server-side, uses service role key) → Supabase

---

## PRIORITY ORDER (what to do next)

```
Week of Feb 9-15:
├── 1. FIX POSTING (server-side auth + post endpoint)  ← unblocks everything
├── 2. FIX AI SUMMARIES (trigger + relevance)
├── 3. FIX PULL-TO-REFRESH (reliability)
└── 4. WIRE PHASE 1 LAYOUT
    ├── Location prompt on first launch
    ├── Weather glance at top
    ├── Sectioned scroll (Traffic → Weather → Local)
    └── Emoji vibe on feed

Week of Feb 16-22:
├── 5. Polish + test full Phase 1 flow
├── 6. Beta testers on TestFlight
└── 7. Prep for broader launch (any city)

Backlog (after Phase 1):
├── Wire up built-but-unused features
├── Event integration (Ticketmaster)
├── Gas prices, farmers markets
├── Challenges + social features
└── Performance optimization
```

---

## TECH STACK QUICK REF

- **Frontend**: Next.js 16, React 19, Tailwind 4, Framer Motion
- **iOS**: Capacitor 8 → WKWebView → Vercel URL
- **Backend**: Next.js API routes on Vercel
- **DB**: Supabase (Postgres + auth)
- **AI**: OpenAI GPT-4o-mini (content gen + moderation)
- **Maps**: Leaflet + react-leaflet
- **Traffic**: TomTom API
- **Deployment**: Vercel (web) + TestFlight (iOS)
- **Secrets**: macOS Keychain (OpenAI, Supabase, TomTom keys)

---

## BUILD HISTORY (recent)

| Build | Date | Result | Key Changes |
|-------|------|--------|-------------|
| 28 | Feb 8 | ✅ | Feed fixed (server-side API) |
| 27 | Feb 7 | ✅ | Lean cron + API cache + maxDuration |
| 26 | Feb 7 | ✅ | Auto-seed fix |
| 25 | Feb 6 | ✅ | Pull-to-refresh fix, security cleanup |
| 24 | Feb 6 | ✅ | Posting timeout, refresh, card overflow |

---

*This dashboard is maintained by Dude. Updated after every significant change.*
