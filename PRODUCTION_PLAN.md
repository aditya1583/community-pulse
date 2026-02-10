# VOXLO — PRODUCTION LAUNCH PLAN
*Created: 2026-02-10 by Dude*

---

## BRANCH STRATEGY

```
main              ← production code (Vercel auto-deploys)
stable-pre-production  ← snapshot of current state (rollback target)
```

If something breaks after launch: `git checkout stable-pre-production` and push to main.

---

## PRE-LAUNCH CHECKLIST

### 🔴 MUST FIX BEFORE LAUNCH

| # | Issue | Status | Effort |
|---|-------|--------|--------|
| 1 | **Posting works on iOS** | ⚠️ Works sometimes, auth flaky in WKWebView | 2-4h |
| 2 | **Pull-to-refresh reliable** | ⚠️ Flaky — works sometimes, hangs others | 2h |
| 3 | **Header overlap on initial load** | ⚠️ Safe area timing issue in Capacitor | 1h |
| 4 | **App icon** | ⚠️ Needs clean version with black bg | 1h |
| 5 | **"Lea..." truncation** | ⚠️ Compacted header, needs testing | Done? |

### 🟡 SHOULD FIX

| # | Issue | Effort |
|---|-------|--------|
| 1 | GPS accuracy for Local tab (sometimes stale) | 2h |
| 2 | "Address unknown" on some venues | 1h (Foursquare data quality) |
| 3 | Content quality — ensure no fabricated claims | Ongoing |
| 4 | Onboarding flow polish (first-time user experience) | 3h |

### 🟢 NICE TO HAVE

| # | Feature | Effort |
|---|---------|--------|
| 1 | Push notifications for nearby alerts | 4h |
| 2 | Dark mode toggle (currently dark-only, which is fine) | — |
| 3 | Sharing individual pulses | 2h |

---

## LAUNCH PHASES

### Phase 0: Final Polish (This Week — Feb 10-14)
- [ ] Fix remaining UI issues (header, padding, icon)
- [ ] Ensure posting works reliably on iOS
- [ ] Ensure pull-to-refresh is solid
- [ ] Delete any remaining fabricated bot content
- [ ] Test full flow: install → location prompt → browse → post → see post
- [ ] Verify content expiration is working (old bot posts auto-clean)
- **Deliverable:** Build that passes full flow test

### Phase 1: Soft Launch / Friends & Family (Feb 15-21)
- [ ] Invite 5-10 trusted testers via TestFlight
- [ ] Get them in the Leander/Cedar Park area
- [ ] Monitor: Do posts appear correctly? Is GPS accurate? Any crashes?
- [ ] Collect feedback on UX flow
- [ ] Fix anything they break
- **Goal:** 20+ real user posts across testers, no critical bugs

### Phase 2: Local Beta (Feb 22 - Mar 7)
- [ ] Expand TestFlight to ~50 users
- [ ] Focus on Leander/Cedar Park/Georgetown corridor
- [ ] Enable push notifications for nearby activity
- [ ] Monitor Supabase: row counts, API latency, error rates
- [ ] Start measuring: DAU, posts per day, retention
- **Goal:** Daily active usage, at least 10 posts/day organically

### Phase 3: App Store Submission (Mar 8-14)
- [ ] App Store listing: screenshots, description, keywords
- [ ] Privacy policy and terms (already have /privacy, /terms)
- [ ] App Review prep: ensure compliance with guidelines
- [ ] Set up App Store Connect: pricing (free), categories, age rating
- [ ] Submit for review
- **Goal:** Approved on App Store

### Phase 4: Public Launch (Mar 15+)
- [ ] voxlo.app landing page with App Store badge
- [ ] Social media announcement
- [ ] Local community outreach (Leander/Cedar Park Facebook groups, Nextdoor)
- [ ] Monitor scaling: Supabase limits, Vercel limits, API rate limits
- [ ] Enable Flash Drops (Phase 2 feature) for local business outreach
- **Goal:** 100+ downloads first week, 20+ DAU

---

## INFRASTRUCTURE FOR PRODUCTION

### Already Done ✅
- Vercel deployment (auto on push to main)
- Supabase DB + auth
- TestFlight build pipeline (autonomous)
- Content moderation (2-layer, fail-closed)
- Content expiration + cleanup cron
- API caching (Supabase api_cache table)
- Legal pages (/terms, /privacy, /legal)

### Needs Attention ⚠️
- **Supabase limits**: Check free tier limits vs expected usage
- **Vercel limits**: Serverless function invocations, bandwidth
- **API rate limits**: Foursquare, TomTom, OpenAI, Ticketmaster
- **Error monitoring**: Add Sentry or similar for crash reporting
- **Analytics**: Add basic event tracking (PostHog, Mixpanel, or simple Supabase logging)

### Cost Estimate (Monthly at 100 DAU)
- Vercel Pro: $20/mo (if needed, free tier may suffice initially)
- Supabase: Free tier (500MB DB, 2GB bandwidth) — probably fine to start
- OpenAI (content gen): ~$5-10/mo at current usage
- TomTom: Free tier (2,500 req/day) — fine
- Foursquare: Free tier (99,500 calls/mo) — fine
- Apple Developer: $99/yr (already paid)
- **Total: ~$25-30/mo to start**

---

## APP STORE LISTING (Draft)

**Name:** Voxlo
**Subtitle:** What's happening near you?
**Category:** Social Networking (primary), Lifestyle (secondary)
**Keywords:** local, hyperlocal, neighborhood, community, nearby, events, traffic, vibe, pulse

**Description:**
> Voxlo shows you what's happening in your neighborhood right now — not yesterday, not on some review site from 2019. Real people. Real-time. Within your 10-mile radius.
>
> See live traffic alerts, local events, weather, and community vibes. Drop a pulse to share what you're seeing. Know if the coffee shop is packed before you drive there.
>
> Google tells you what exists. Voxlo tells you what's happening.

---

## MONETIZATION (Future — Not for Launch)

1. **Flash Drops** — Local businesses pay for real-time deal placement ($10-25/mo)
2. **Verified Business Program** — Analytics + engagement tools ($25-50/mo)
3. **Premium features** — Extended radius, historical data, priority alerts
4. **Never:** Banner ads, data selling, sponsored content disguised as organic

---

*Updated by Dude | Next review: after Phase 0 completion*
