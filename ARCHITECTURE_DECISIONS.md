# Architecture Decision Log

## 2026-02-08 - Server-Side API Endpoints Instead of Supabase JS Client
**Context:** Supabase JS client queries and auth hang indefinitely in Capacitor WKWebView on iOS. Feed would never load.
**Decision:** Bypass Supabase JS entirely in the mobile app. All DB reads/writes go through Next.js API routes (`/api/pulses/feed`, etc.) which use the Supabase service role key server-side.
**Alternatives:** Tried debugging WKWebView directly, adding timeouts, debug overlays. Root cause is WKWebView's networking stack incompatibility with Supabase realtime/auth.
**Outcome:** Feed loads reliably. Same pattern must be applied to auth and posting.

## 2026-02-07 - API Response Caching in Supabase
**Context:** External API calls (TomTom, weather, USDA) were causing Vercel function timeouts on the cron endpoint.
**Decision:** Cache all external API responses in a Supabase `api_cache` table. Check cache first, only call external API if stale.
**Alternatives:** Reduce API calls by limiting cities. Chose caching as more scalable.
**Outcome:** Cron runs complete within Vercel's time limits.

## 2026-02-07 - maxDuration=60 on External API Routes
**Context:** Vercel's default 10s timeout was killing routes that call external APIs.
**Decision:** Add `maxDuration = 60` to all route handlers that make external API calls.
**Alternatives:** Could split into background jobs, but overkill for current scale.
**Outcome:** No more random timeouts on seed/summary endpoints.

## 2026-02-06 - Lean Cron: Only Seed Active Cities
**Context:** Cron was trying to generate content for every city in the DB, most with zero users.
**Decision:** Only seed cities with real user activity in the last 48 hours.
**Alternatives:** Seed all cities on a slower schedule. Chose activity-based as more efficient.
**Outcome:** Cron runs faster, less API spend, more relevant content.

## 2026-02-06 - Bot Post Limits and Expiration
**Context:** AI-generated posts were flooding the feed, making it feel spammy.
**Decision:** Max 5-7 bot posts per city. Old bot posts are DELETED (not hidden). Expiration: weather/traffic 2-3h, events 12-24h, general 6-12h.
**Alternatives:** Just hiding old posts. Ady was clear: delete, don't hide.
**Outcome:** Cleaner feed, forces freshness.
