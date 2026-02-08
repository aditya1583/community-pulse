# VOXLO PROJECT DASHBOARD
**Last Updated:** 2026-02-08 12:24 CST
**Live:** https://voxlo-theta.vercel.app
**Repo:** https://github.com/aditya1583/community-pulse.git
**Build:** ✅ Compiles clean | **Health:** ✅ Production healthy (690ms DB latency)
**TestFlight:** Build 26 (v1.0.26)

---

## CURRENT STATE: Honest Assessment

The app has **massive feature sprawl**. 30+ API routes, 50+ components, gamification, heatmaps, venue vibes, challenges, leaderboards — but the CORE experience (hyperlocal feed with fresh, relevant content) still isn't solid. That's the problem.

### What Works
- [x] App loads, deploys, builds
- [x] User location detection + geocoding
- [x] Pulse posting (user-generated content)
- [x] Pull-to-refresh (fixed build 26)
- [x] AI summary generation
- [x] Bot seeding cron (every 30min)
- [x] Content expiration system
- [x] TestFlight distribution
- [x] iOS native via Capacitor

### What's Broken / Incomplete
- [ ] **AI content quality** — bot posts feel generic, not truly local
- [ ] **Content freshness** — cron generates but content may feel stale/repetitive
- [ ] **Onboarding** — 10-mile radius prompt not enforced properly
- [ ] **City display** — may still show coordinates instead of city names in edge cases
- [ ] **DB migrations not run** — Gamification, Bat Signal, Venue Vibes tables PENDING
- [ ] **Push notifications** — VAPID keys not configured
- [ ] **Empty feed problem** — new cities have no content until cron catches up

---

## THE PLAN: 3 Phases to Production

### PHASE 1: CORE LOCK (Week 1 — Feb 8-14)
**Goal:** The feed works perfectly for ONE user in ONE city. Nothing else matters.

| # | Task | Est. Hours | Status |
|---|------|-----------|--------|
| 1.1 | Audit refresh-content cron — verify it actually produces good local content | 2h | ⬜ |
| 1.2 | Fix AI prompts to use REAL local data (weather API, traffic API, local landmarks) | 4h | ⬜ |
| 1.3 | Enforce onboarding flow: location → 10mi radius → city name display | 2h | ⬜ |
| 1.4 | Kill duplicate/stale content — enforce MAX 5 bot posts, proper expiry deletion | 2h | ⬜ |
| 1.5 | Test full cycle: fresh install → onboard → see feed → post → refresh → see new content | 2h | ⬜ |
| 1.6 | Strip or hide ALL unfinished features (gamification UI, heatmap, venue vibes, challenges) | 3h | ⬜ |

**Exit Criteria:** A new user installs, sees their city name, gets 5-7 fresh relevant posts, can post their own, pull-to-refresh works. No dead screens.

---

### PHASE 2: POLISH & RELIABILITY (Week 2 — Feb 15-21)
**Goal:** App feels finished. No rough edges.

| # | Task | Est. Hours | Status |
|---|------|-----------|--------|
| 2.1 | Weather widget at top of feed (real data, not AI summary) | 3h | ⬜ |
| 2.2 | Traffic section with real-time data | 3h | ⬜ |
| 2.3 | Scroll sections: Traffic → Weather → Local (retail, farmers market) | 4h | ⬜ |
| 2.4 | Emoji mood indicator per post | 2h | ⬜ |
| 2.5 | User post prominence — user posts above AI summaries | 2h | ⬜ |
| 2.6 | Error handling: offline state, API failures, empty states | 3h | ⬜ |
| 2.7 | Performance pass: lazy loading, image optimization | 2h | ⬜ |

**Exit Criteria:** App feels like a real product. Sections are clear. Data is real. No loading spinners that never resolve.

---

### PHASE 3: LAUNCH PREP (Week 3 — Feb 22-28)
**Goal:** App Store submission ready.

| # | Task | Est. Hours | Status |
|---|------|-----------|--------|
| 3.1 | Run pending DB migrations (gamification, notifications) | 1h | ⬜ |
| 3.2 | Configure VAPID keys + push notifications | 2h | ⬜ |
| 3.3 | App Store screenshots + description | 3h | ⬜ |
| 3.4 | Privacy policy + terms update | 1h | ⬜ |
| 3.5 | TestFlight beta with 5-10 real users | 2h | ⬜ |
| 3.6 | Fix bugs from beta feedback | 4h | ⬜ |
| 3.7 | App Store submission | 2h | ⬜ |

**Exit Criteria:** App submitted to App Store. Beta testers confirm core loop works.

---

## FEATURE TRIAGE: Keep / Hide / Kill

| Feature | Verdict | Reason |
|---------|---------|--------|
| Pulse Feed | **KEEP** | Core product |
| AI Summaries | **KEEP** | Core value prop — but limit to 5-7 per city |
| Weather Widget | **KEEP** | Core requirement |
| Traffic Section | **KEEP** | Core requirement |
| Local Section | **KEEP** | Core requirement |
| User Posts | **KEEP** | "Gold" — the real value |
| Pull-to-Refresh | **KEEP** | Fixed, working |
| Gamification/XP | **HIDE** | DB not migrated, not core for launch |
| Heatmap | **HIDE** | Cool but not core |
| Venue Vibes | **HIDE** | DB not migrated |
| Challenges | **HIDE** | Unnecessary complexity |
| Leaderboard | **HIDE** | Needs users first |
| Bat Signal | **HIDE** | Push notifications not configured |
| Bot Lab | **HIDE** | Dev tool, not user-facing |
| QR Code | **HIDE** | Nice-to-have, not launch critical |

---

## API ROUTES AUDIT

**Keep Active (Core):**
- `/api/pulses` — CRUD
- `/api/cron/refresh-content` — Bot seeding
- `/api/cron/seed-cities` — City discovery
- `/api/weather` — Real weather data
- `/api/traffic` / `/api/traffic-live` — Real traffic
- `/api/geocode` — Location resolution
- `/api/summary` — AI summaries
- `/api/health` — Monitoring

**Disable/Remove for Launch:**
- `/api/gamification/*` — Not migrated
- `/api/challenges/*` — Not migrated  
- `/api/venue-vibe` — Not migrated
- `/api/heatmap` — Not core
- `/api/qr-code` — Not core
- `/api/foursquare` — Not core
- `/api/live-vibes` — Redundant with main feed

---

## DECISIONS NEEDED FROM ADY

1. **Target launch city?** (Leander/Cedar Park/Austin — or all Texas?)
2. **Beta testers?** (Who are the 5-10 people for TestFlight?)
3. **App Store account** — Is it ready for submission under current Apple Dev ID?
4. **Monetization plan?** (Free launch? Ads later? Premium?)
5. **Domain?** (voxlo.app? voxlo.io? Currently on vercel.app subdomain)

---

## DAILY STANDUP LOG

### 2026-02-08
- Dashboard created
- Build compiles clean, production healthy
- Awaiting Ady's go on Phase 1 execution
