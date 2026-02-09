# Community Pulse (Voxlo) — Project Status
Updated: 2026-02-09

## Current Version
- Web: Vercel (https://voxlo-theta.vercel.app/)
- iOS: v1.0.28 Build 28 (TestFlight)

## Recent Changes
- 2026-02-08: Feed fixed via server-side API endpoint (bypass Supabase JS client hang in WKWebView)
- 2026-02-08: Removed debug overlay, feed confirmed working
- 2026-02-07: Bumped to v1.0.27 build 27 — lean cron + API cache + maxDuration fixes
- 2026-02-07: Added maxDuration=60 to auto-seed, intelligent-seed, summary endpoints
- 2026-02-07: Cron now only seeds cities with real user activity (last 48h)
- 2026-02-06: Pull-to-refresh hang fix — extract fetchPulses, await directly, add try/finally
- 2026-02-06: Reduced bot posts to 5 per city, delete old beyond limit
- 2026-02-06: Cleanup endpoint, reduced expiration times (weather/traffic 2h, events 12h, general 8h)

## Known Issues
- AI summaries not triggering + irrelevant when they do — TOP PRIORITY
- Pull-to-refresh still broken in some cases
- Posting broken — auth hangs in WKWebView, needs server-side fix (same pattern as feed)
- Supabase JS client completely broken in Capacitor WKWebView (architecture constraint)

## Next Up
1. Fix AI summary generation (trigger + relevance)
2. Fix pull-to-refresh
3. Fix posting via server-side auth endpoint
4. Phase 1 CORE LOCK features (location prompt, city display, weather glance, scroll sections)
