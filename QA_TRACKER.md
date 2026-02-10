# QA Tracker — Voxlo

Track all verified issues and fixes. **DO NOT touch items marked ✅ VERIFIED.**

## Build 45 — Verified by Ady (2026-02-10)

### ✅ VERIFIED WORKING
- [x] App icon updated (neon green radar V) — **GOOD**

### 🐛 ISSUES FOUND
- [ ] **Padding problem returned** — app shifts down after pull-to-refresh
- [ ] **"Share Today's Brief" still visible** — was in `AISummaryStories.tsx` (not just `AISummaryCard.tsx`). Fixed in next build.
- [ ] **Stale AI content** — "Christmas lights on Crystal Falls Pkwy" template in `spicy-templates.ts`. It's February. Replaced with season-neutral template.

### ⚠️ KNOWN BLOCKERS (GA)
- [ ] **Posting in WKWebView** — auth pipeline is wired server-side, needs device testing to confirm it works
- [ ] **Pull-to-refresh flaky** — works sometimes, hangs other times
- [ ] **Location prompt flow** — first-launch 10-mile radius setup not wired

---

## Rules
1. Items marked ✅ VERIFIED are locked — do not modify or regress them
2. Every build tested by Ady gets a new section
3. Log exact symptoms, file paths, and fix status
