# QA Tracker — Voxlo

## E2E Test Report — Build 46 + Vercel Deploy (2026-02-10 6:30PM CST)

### ✅ PASSING
| Feature | Status | Notes |
|---------|--------|-------|
| **Sign-in** | ✅ PASS | Works on web (was broken before fix) |
| **Sign-up** | ✅ PASS | Creates account, email confirmation required |
| **Posting** | ✅ PASS | Ady confirmed on iOS TestFlight (build 46) |
| **Pulse Feed** | ✅ PASS | 5 AI posts loaded, sorted by distance |
| **Events Tab** | ✅ PASS | 20 Ticketmaster events, Calendar/Map/Share buttons |
| **Traffic Tab** | ✅ PASS | TomTom data, road closures, congestion level |
| **Local Tab** | ✅ PASS | 12 places from Foursquare, distance + category filters |
| **Legal Page** | ✅ PASS | All attributions, data sources, contact |
| **Terms/Privacy** | ✅ PASS | Pages load |
| **App Icon** | ✅ PASS | Neon green radar V (Ady confirmed) |
| **RESIDENT badge** | ✅ PASS | User posts show green RESIDENT badge |
| **AI GENERATED badge** | ✅ PASS | Bot posts show AI GENERATED badge |
| **Onboarding checklist** | ✅ PASS | Welcome 25% Done with 4 steps |
| **Traffic Alert banner** | ✅ PASS | Shows real road closures with pulse animation |
| **City search** | ✅ PASS | Autocomplete in search bar |
| **Bottom nav** | ✅ PASS | Pulse/Events/Post/Traffic/Local all navigate correctly |
| **Poll voting** | ✅ PASS | Vibe Check polls render with voting buttons |

### ⚠️ ISSUES FOUND
| Issue | Severity | Status |
|-------|----------|--------|
| "BEYOND 10 MILES" on own post | Medium | Fixed — same-city posts forced in-radius |
| Header truncation ("Leand...") | Low | Known, needs redesign |
| Username truncation ("SUNNYH...") | Low | Header space issue |
| Raw markdown in brief (`**☀️ Weather**`) | Low | Needs strip markdown |
| "Share Today's Brief" removed | ✅ Fixed | Was in AISummaryStories.tsx |
| Stale AI content (Christmas lights) | ✅ Fixed | Template replaced |

Track all verified issues and fixes. **DO NOT touch items marked ✅ VERIFIED.**

## Build 45 — Verified by Ady (2026-02-10)

### ✅ VERIFIED WORKING
- [x] App icon updated (neon green radar V) — **GOOD**

### 🐛 ISSUES FOUND
- [ ] **Padding problem returned** — app shifts down after pull-to-refresh
- [ ] **"Share Today's Brief" still visible** — was in `AISummaryStories.tsx` (not just `AISummaryCard.tsx`). Fixed in next build.
- [ ] **Stale AI content** — "Christmas lights on Crystal Falls Pkwy" template in `spicy-templates.ts`. It's February. Replaced with season-neutral template.

### 🔥 CRITICAL FIX (Build 46 → Vercel deploy)
- [x] **Sign-in broken on ALL platforms** — `CapacitorProvider.tsx` fetch interceptor used `window.Capacitor` (truthy on web because JS is bundled). Redirected Supabase auth calls, causing sign-in to hang forever. Fixed to use `isNativePlatform()`. Pushed to main, Vercel deploying.

### ⚠️ KNOWN BLOCKERS (GA)
- [ ] **Sign-in verification** — need to confirm fix after Vercel deploy
- [ ] **Posting end-to-end** — can't test until sign-in works
- [ ] **Pull-to-refresh flaky** — works sometimes, hangs other times
- [ ] **Location prompt flow** — first-launch 10-mile radius setup not wired

### 📝 OTHER ISSUES FOUND IN TESTING
- [ ] **Markdown in brief** — `**☀️ Weather**` shows raw asterisks in pulse summary card
- [ ] **AI content quality** — "Hidden gem: food trailer behind Target" and "Best kept secret near Lowe's" are likely fabricated
- [ ] **CORS on vote endpoint** — `x-user-identifier` header not in Access-Control-Allow-Headers
- [ ] **Profile loading timeout** — "Profile loading timeout - forcing ready state" warning fires on sign-in
- [ ] **React polling too aggressive** — `/api/pulses/{id}/react` called every 10 seconds per pulse (5 pulses = 50 API calls/min)

---

## Rules
1. Items marked ✅ VERIFIED are locked — do not modify or regress them
2. Every build tested by Ady gets a new section
3. Log exact symptoms, file paths, and fix status
