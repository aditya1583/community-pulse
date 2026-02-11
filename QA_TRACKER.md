# QA Tracker — Voxlo

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
