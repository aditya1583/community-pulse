# External Integrations

**Analysis Date:** 2026-01-17

## APIs & External Services

### AI & Moderation

**Anthropic Claude (Primary AI Moderation):**
- SDK: `@anthropic-ai/sdk` 0.71.2
- Model: Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
- Auth: `ANTHROPIC_API_KEY`
- Files: `src/lib/aiModeration.ts`
- Usage: Content moderation, context-aware toxicity detection
- Features: Timeout with retry, in-memory caching (60s TTL), fail-closed in production

**OpenAI:**
- SDK: `openai` 6.9.1
- Models: GPT-4o-mini (traffic classification)
- Auth: `OPENAI_API_KEY`
- Files: `src/app/api/traffic/route.ts`, `src/lib/moderationPipeline.ts`
- Usage: Traffic level classification, moderation pipeline

**Google Perspective API (Optional):**
- Type: REST API
- Auth: `PERSPECTIVE_API_KEY`
- Files: `src/lib/perspectiveModeration.ts`
- Usage: Supplementary toxicity scoring (TOXICITY, SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, THREAT)
- Behavior: Returns scores, allows content if unavailable

### Events & Entertainment

**Ticketmaster Discovery API:**
- Type: REST API
- Auth: `TICKETMASTER_API_KEY`
- Files: `src/app/api/events/ticketmaster/route.ts`, `src/lib/intelligent-bots/data-fetchers.ts`
- Usage: Local events discovery, venue search
- Features: In-memory cache (5 min TTL), metro fallback for small towns, distance calculation
- Endpoint: `https://app.ticketmaster.com/discovery/v2/events.json`

### Traffic & Navigation

**TomTom Traffic API:**
- Type: REST API
- Auth: `TOMTOM_API_KEY`
- Files: `src/app/api/traffic-live/route.ts`, `src/lib/intelligent-bots/data-fetchers.ts`
- Usage: Real-time traffic flow, incidents, road closures
- Features: In-memory cache (1 min TTL for QPS protection), graceful fallback
- Endpoints:
  - Flow: `https://api.tomtom.com/traffic/services/4/flowSegmentData/`
  - Incidents: `https://api.tomtom.com/traffic/services/5/incidentDetails`

### Weather & Environment

**Open-Meteo Weather API (Free, No Key):**
- Type: REST API
- Auth: None required
- Files: `src/app/api/weather/route.ts`, `src/lib/intelligent-bots/data-fetchers.ts`
- Usage: Current weather, temperature, conditions
- Features: Geocoding included, 15-min cache
- Endpoints:
  - Weather: `https://api.open-meteo.com/v1/forecast`
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search`

**Open-Meteo Air Quality API (Free, No Key):**
- Type: REST API
- Auth: None required
- Files: `src/app/api/air-quality/route.ts`
- Usage: AQI, PM2.5, PM10, pollutant levels
- Features: 30-min cache
- Endpoint: `https://air-quality-api.open-meteo.com/v1/air-quality`

### Places & Local Discovery

**Foursquare Places API v3:**
- Type: REST API
- Auth: `FOURSQUARE_API_KEY`
- Files: `src/app/api/foursquare/places/route.ts`
- Usage: Local business discovery (restaurants, cafes, markets, gas stations)
- Features: Category filtering, distance sorting, 30-min cache
- Endpoint: `https://api.foursquare.com/v3/places/search`

**OpenStreetMap Overpass API (Fallback, Free):**
- Type: REST API
- Auth: None required
- Files: `src/app/api/osm/places/route.ts`, `src/lib/intelligent-bots/data-fetchers.ts`
- Usage: Fallback for places when Foursquare fails, farmers markets
- Features: Multiple mirrors for reliability, 1-hour cache
- Endpoints:
  - Primary: `https://overpass-api.de/api/interpreter`
  - Fallback: `https://overpass.kumi.systems/api/interpreter`

**Nominatim Geocoding (Free):**
- Type: REST API
- Auth: None required
- Files: `src/app/api/events/ticketmaster/route.ts`
- Usage: City name to coordinates conversion
- Endpoint: `https://nominatim.openstreetmap.org/search`

### Fuel Prices

**EIA (Energy Information Administration) API:**
- Type: REST API
- Auth: `EIA_API_KEY`
- Files: `src/app/api/gas-prices/route.ts`
- Usage: Regional gas price averages by PADD region
- Features: Hardcoded fallback prices, 1-hour cache
- Endpoint: `https://api.eia.gov/v2/petroleum/pri/gnd/data/`

### Farmers Markets

**USDA Local Food Directories API (Free, No Key):**
- Type: REST API
- Auth: None required
- Files: `src/lib/intelligent-bots/data-fetchers.ts`
- Usage: Farmers market locations, schedules, products
- Features: Detail fetch per market, local hardcoded fallback for Central Texas
- Endpoints:
  - Search: `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch`
  - Details: `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail`

## Data Storage

**Database:**
- Supabase (PostgreSQL)
- Connection: `NEXT_PUBLIC_SUPABASE_URL`
- Client: `@supabase/supabase-js`
- Auth Keys:
  - Anon (client): `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Service (server): `SUPABASE_SERVICE_ROLE_KEY`
- Files: Client created inline in API routes via `createClient()`
- Features: Row Level Security (RLS), real-time subscriptions, stored procedures

**Migrations:**
- Location: `supabase/migrations/`
- Key tables: pulses, push_subscriptions, notification_log, venue_vibes, user_stats, challenges

**File Storage:**
- Not used (no file uploads in current implementation)

**Caching:**
- In-memory caches throughout API routes
- HTTP Cache-Control headers for CDN caching
- No Redis or external cache service

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
- Implementation: Bearer token in Authorization header
- Files: `src/app/api/pulses/route.ts` (example pattern)
- Pattern: Extract token, create client with token, call `auth.getUser()`

**Session Management:**
- Client-side: Supabase client handles refresh
- Server-side: Token validation per request

## Push Notifications

**Web Push (VAPID):**
- Library: `web-push` 3.6.7
- Auth:
  - `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (mailto: URL)
- Files: `src/lib/pushNotifications.ts`, `src/lib/batSignal.ts`
- Features: Subscription management, quiet hours, cooldowns, failure tracking

## Monitoring & Observability

**Error Tracking:**
- Console logging with structured format
- Files: `src/lib/logger.ts`
- No external service (Sentry, etc.)

**Logs:**
- Console-based logging
- Production: Limited content exposure for privacy
- Development: Full debug output

## CI/CD & Deployment

**Hosting:**
- Vercel

**CI Pipeline:**
- Not explicitly configured (Vercel auto-deploy from git)

**Cron Jobs:**
- Vercel Cron via `vercel.json`
- Protected by `CRON_SECRET` header validation

## Environment Configuration

**Required env vars:**
```
# Database (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI Moderation (REQUIRED - fail-closed)
OPENAI_API_KEY
ANTHROPIC_API_KEY

# Push Notifications (IMPORTANT)
VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT

# Cron/Admin (IMPORTANT)
CRON_SECRET
ADMIN_SECRET
```

**Optional env vars:**
```
# External APIs (have fallbacks)
TICKETMASTER_API_KEY
TOMTOM_API_KEY
FOURSQUARE_API_KEY
EIA_API_KEY
PERSPECTIVE_API_KEY

# Moderation config
MODERATION_TIMEOUT_MS (default: 3000)
MODERATION_HARASSMENT_SCORE_THRESHOLD (default: 0.01)
PERSPECTIVE_TOXICITY_THRESHOLD (default: 0.7)
PII_BLOCK_SOCIAL_HANDLES (default: true)
```

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel Environment Variables dashboard

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Web Push notifications via `web-push` library

## Rate Limiting

**Implementation:**
- In-memory rate limiting: `src/lib/rateLimit.ts`
- Pulse creation: 5 per hour per user
- No external rate limit service

## Graceful Degradation Pattern

Most external API integrations follow this pattern:
1. Try primary API with timeout
2. Return cached data if available
3. Fall back to secondary API or hardcoded data
4. Return 200 with empty data rather than 5xx

This ensures the app remains functional even when external services fail.

---

*Integration audit: 2026-01-17*
