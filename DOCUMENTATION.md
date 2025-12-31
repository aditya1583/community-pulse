# Community Pulse - Technical Documentation

> **Version:** 0.5.1
> **Last Updated:** December 31, 2025
> **Stack:** Next.js 14 + Supabase + OpenAI + Tailwind CSS

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Database Schema](#database-schema)
5. [Components](#components)
6. [Hooks](#hooks)
7. [Libraries & Utilities](#libraries--utilities)
8. [Security & Moderation](#security--moderation)
9. [Gamification System](#gamification-system)
10. [Environment Variables](#environment-variables)
11. [Version History](#version-history)
12. [Deployment Checklist](#deployment-checklist)

---

## Overview

Community Pulse is a hyperlocal community app that surfaces real-time city vibes through:

- **Pulses**: Short, ephemeral posts about traffic, weather, events, and general happenings
- **AI Summaries**: GPT-powered city briefs synthesizing all local data
- **External Data**: News, events, gas prices, air quality, farmers markets, local deals
- **Gamification**: XP, levels, badges, and leaderboards to drive engagement
- **Venue Vibes**: Crowd-sourced atmosphere check-ins for local businesses

### Core Philosophy

1. **Server-authoritative writes** - All pulses go through API with moderation
2. **Fail-closed moderation** - If moderation service fails, content is rejected
3. **Ephemeral content** - Pulses expire (2-24 hours based on tag)
4. **Privacy-first** - No PII in pulses, anonymous usernames

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  Components          Hooks              Pages                   │
│  ├─ PulseCard       ├─ useGamification  ├─ / (main dashboard)  │
│  ├─ EventCard       ├─ useLeaderboard   ├─ /privacy            │
│  ├─ NewsCard        ├─ useGeolocation   └─ /terms              │
│  └─ ...             └─ ...                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (/api/*)                        │
├─────────────────────────────────────────────────────────────────┤
│  /pulses         POST → Moderation Pipeline → Supabase Insert   │
│  /weather        → OpenWeatherMap API                           │
│  /events         → Ticketmaster API                             │
│  /news           → GNews / NewsAPI                              │
│  /gas-prices     → EIA API                                      │
│  /summary        → OpenAI GPT-4o-mini                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MODERATION PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│  1. PII Detection (emails, phones, SSNs, addresses)             │
│  2. Local Heuristics (blocklist, profanity, leetspeak)          │
│  3. AI Moderation (OpenAI Moderation API)                       │
│  4. Perspective API (optional toxicity layer)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                      │
├─────────────────────────────────────────────────────────────────┤
│  Tables: pulses, profiles, events, user_stats, user_badges,     │
│          venue_vibes, pulse_reports, notification_preferences   │
│  RLS: Enforced - users can READ, only service-role can WRITE    │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### Core Content APIs

#### POST /api/pulses
Create a new pulse (community post).

**Headers:**
```
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

**Body:**
```json
{
  "city": "Austin",
  "neighborhood": "Downtown",  // optional
  "mood": "frustrated",
  "tag": "Traffic",            // Traffic | Weather | Events | General
  "message": "I-35 is a parking lot right now",
  "author": "LocalCommuter"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "city": "Austin",
  "mood": "frustrated",
  "tag": "Traffic",
  "message": "I-35 is a parking lot right now",
  "author": "LocalCommuter",
  "created_at": "2025-12-31T10:00:00Z",
  "expires_at": "2025-12-31T12:00:00Z"
}
```

**Errors:**
- `400` - Validation failed or content blocked by moderation
- `401` - Not authenticated
- `429` - Rate limit exceeded (5 pulses/hour)
- `503` - Moderation service unavailable (fail-closed)

---

#### GET /api/city-mood
Get aggregated city vibe analysis.

**Query:**
```
?city=Austin&eventsCount=5&trafficLevel=moderate&weatherCondition=sunny
```

**Response:**
```json
{
  "dominantMood": "happy",
  "vibeHeadline": "Austin is Buzzing",
  "vibeSubtext": "5 events happening today",
  "vibeIntensity": 0.75,
  "tagScores": {
    "Traffic": 0.3,
    "Events": 0.5,
    "Weather": 0.2
  }
}
```

---

#### GET /api/traffic
Get traffic level classification.

**Query:** `?city=Austin`

**Response:**
```json
{
  "level": "Moderate",
  "source": "ai",
  "pulseCount": 12,
  "dominantMood": "frustrated"
}
```

---

#### POST /api/weather
Get weather data for location.

**Body:**
```json
{
  "city": "Austin",
  "lat": 30.2672,
  "lon": -97.7431,
  "country": "US",
  "state": "TX"
}
```

**Response:**
```json
{
  "temp": 75,
  "feelsLike": 78,
  "description": "Partly cloudy",
  "icon": "02d",
  "cityName": "Austin"
}
```

---

#### POST /api/summary
Generate AI summary of city data.

**Body:**
```json
{
  "city": "Austin",
  "context": "all",  // "all" | "pulse" | "events" | "traffic" | "news"
  "pulses": [...],
  "events": [...],
  "news": [...],
  "weather": {...}
}
```

**Response:**
```json
{
  "summary": "Austin is having a busy Tuesday..."
}
```

---

### Information APIs

#### GET /api/news
Local news articles.

**Query:** `?city=Austin&state=TX`

**Response:**
```json
{
  "articles": [
    {
      "title": "...",
      "description": "...",
      "url": "https://...",
      "source": "Austin American-Statesman",
      "publishedAt": "2025-12-31T08:00:00Z"
    }
  ],
  "provider": "gnews"
}
```

---

#### GET /api/events/ticketmaster
Events from Ticketmaster.

**Query:** `?city=Austin&lat=30.2672&lon=-97.7431&radius=25`

**Response:**
```json
{
  "events": [
    {
      "id": "...",
      "name": "Austin City Limits",
      "date": "2025-12-31",
      "time": "19:00:00",
      "venue": "Zilker Park",
      "category": "Music",
      "priceRange": "$50 - $150",
      "url": "https://ticketmaster.com/..."
    }
  ],
  "cached": false
}
```

---

#### GET /api/gas-prices
Regional gas prices.

**Query:** `?state=TX`

**Response:**
```json
{
  "regular": 2.89,
  "midgrade": 3.29,
  "premium": 3.69,
  "diesel": 3.49,
  "regularChange": -0.05,
  "stateAvg": 2.95,
  "nationalAvg": 3.15,
  "regionName": "Texas",
  "lastUpdated": "2025-12-31T00:00:00Z"
}
```

---

### Gamification APIs

#### GET /api/gamification/stats
User statistics and badges.

**Query:** `?userId=<uuid>`

**Response:**
```json
{
  "stats": {
    "pulse_count_total": 42,
    "pulse_count_traffic": 15,
    "reactions_received_total": 128,
    "current_streak_days": 7,
    "level": 12,
    "xp_total": 1450
  },
  "badges": [
    {
      "name": "Traffic Titan",
      "description": "Posted 10 traffic reports",
      "icon": "🚗",
      "earned_at": "2025-12-25T10:00:00Z"
    }
  ],
  "tier": "Gold",
  "weeklyRank": 8
}
```

---

#### GET /api/gamification/leaderboard
Leaderboard rankings.

**Query:** `?period=weekly&city=Austin&limit=10`

**Response:**
```json
{
  "entries": [
    {
      "rank": 1,
      "username": "CityExplorer",
      "score": 450,
      "pulseCount": 35,
      "reactionCount": 180
    }
  ],
  "userRank": 8,
  "totalUsers": 156
}
```

---

### Engagement APIs

#### POST /api/venue-vibe
Submit venue atmosphere check-in.

**Body:**
```json
{
  "venue_id": "yelp-abc123",
  "venue_name": "Jo's Coffee",
  "vibe_type": "busy",
  "venue_lat": 30.2500,
  "venue_lon": -97.7500,
  "city": "Austin"
}
```

**Valid vibe_type values:**
- `busy`, `quiet`, `moderate`
- `live_music`, `great_vibes`, `chill`
- `long_wait`, `fast_service`
- `worth_it`, `skip_it`

**Rate Limits:**
- 1 vibe per venue per 30 minutes (per device)
- 5 vibes per hour globally (per user)

---

#### POST /api/report-pulse
Report inappropriate content.

**Body:**
```json
{
  "pulse_id": "uuid",
  "reason": "harassment"
}
```

---

### Admin APIs

#### GET /api/admin/reports
List reported pulses (mod queue).

**Headers:** `x-admin-key: <ADMIN_API_KEY>`

**Query:** `?status=pending&page=1&limit=20`

**Response:**
```json
{
  "reports": [...],
  "total": 45,
  "page": 1,
  "hasMore": true
}
```

---

#### POST /api/admin/reports/[id]
Take action on report.

**Body:**
```json
{
  "action": "approve"  // "approve" | "dismiss" | "ban_user"
}
```

---

## Database Schema

### Core Tables

```sql
-- Community posts
CREATE TABLE pulses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  neighborhood TEXT,
  mood TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('Traffic', 'Weather', 'Events', 'General')),
  message TEXT NOT NULL CHECK (char_length(message) <= 240),
  author TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_bot BOOLEAN DEFAULT false
);

-- RLS Policies
ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON pulses FOR SELECT USING (true);
CREATE POLICY "Owner delete" ON pulses FOR DELETE USING (auth.uid() = user_id);
-- No INSERT policy - service role only

-- Indexes
CREATE INDEX idx_pulses_city_created ON pulses(city, created_at DESC);
CREATE INDEX idx_pulses_tag ON pulses(tag);
CREATE INDEX idx_pulses_user_id ON pulses(user_id);
```

### Gamification Tables

```sql
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  pulse_count_total INT DEFAULT 0,
  pulse_count_traffic INT DEFAULT 0,
  pulse_count_weather INT DEFAULT 0,
  pulse_count_events INT DEFAULT 0,
  pulse_count_general INT DEFAULT 0,
  reactions_received_total INT DEFAULT 0,
  reactions_received_fire INT DEFAULT 0,
  reactions_received_eyes INT DEFAULT 0,
  reactions_received_check INT DEFAULT 0,
  current_streak_days INT DEFAULT 0,
  longest_streak_days INT DEFAULT 0,
  last_pulse_date DATE,
  level INT DEFAULT 1,
  xp_total INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT CHECK (category IN ('category', 'achievement', 'streak', 'milestone')),
  required_tag TEXT,
  tier INT DEFAULT 1,
  required_pulse_count INT,
  required_reaction_count INT,
  required_streak_days INT,
  special_condition TEXT,
  display_order INT DEFAULT 0
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  badge_id UUID REFERENCES badge_definitions(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  current_progress INT DEFAULT 0,
  UNIQUE(user_id, badge_id)
);
```

### Venue & Safety Tables

```sql
CREATE TABLE venue_vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  vibe_type TEXT NOT NULL,
  venue_lat DOUBLE PRECISION,
  venue_lon DOUBLE PRECISION,
  device_fingerprint TEXT,
  city TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '4 hours'
);

CREATE TABLE pulse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id UUID REFERENCES pulses(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pulse_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id UUID REFERENCES pulses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  reaction_type TEXT CHECK (reaction_type IN ('fire', 'eyes', 'check')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pulse_id, user_id, reaction_type)
);
```

---

## Components

### Content Display

| Component | Location | Purpose |
|-----------|----------|---------|
| `PulseCard` | `src/components/PulseCard.tsx` | Individual pulse with expiry, reactions, delete/report |
| `EventCard` | `src/components/EventCard.tsx` | Event with Calendar/Directions/Share actions |
| `NewsCard` | `src/components/NewsCard.tsx` | Clickable news article |
| `GasPricesCard` | `src/components/GasPricesCard.tsx` | Gas prices with "Find stations" link |
| `VenueVibeCheck` | `src/components/VenueVibeCheck.tsx` | Atmosphere check-in modal |

### Input & Forms

| Component | Location | Purpose |
|-----------|----------|---------|
| `PulseInput` | `src/components/PulseInput.tsx` | Create pulse form |
| `PulseModal` | `src/components/PulseModal.tsx` | Modal wrapper for pulse creation |
| `SuggestionChips` | `src/components/SuggestionChips.tsx` | Time-based prompt suggestions |

### Navigation & Layout

| Component | Location | Purpose |
|-----------|----------|---------|
| `TabNavigation` | `src/components/TabNavigation.tsx` | Main tab bar (Pulse/Events/Local/News) |
| `Header` | `src/components/Header.tsx` | App header with city selector |
| `FAB` | `src/components/FAB.tsx` | Floating action button |

### Gamification

| Component | Location | Purpose |
|-----------|----------|---------|
| `Leaderboard` | `src/components/Leaderboard.tsx` | Weekly/monthly rankings |
| `BadgeDisplay` | `src/components/BadgeDisplay.tsx` | Earned badges grid |
| `XPProgressBadge` | `src/components/XPProgressBadge.tsx` | Level/XP indicator |
| `StatusRing` | `src/components/StatusRing.tsx` | Tier visual indicator |

---

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useGamification` | `src/hooks/useGamification.ts` | Fetch user stats, badges, tier |
| `useLeaderboard` | `src/hooks/useLeaderboard.ts` | Fetch leaderboard with pagination |
| `useUserRank` | `src/hooks/useUserRank.ts` | Get single user's rank |
| `useGeolocation` | `src/hooks/useGeolocation.ts` | Browser geolocation API |
| `useGeocodingAutocomplete` | `src/hooks/useGeocodingAutocomplete.ts` | City name autocomplete |
| `useEvents` | `src/hooks/useEvents.ts` | Fetch events for city |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts` | Push notification management |
| `useExpiryCountdown` | `src/hooks/useExpiryCountdown.ts` | Time remaining for ephemeral content |

---

## Libraries & Utilities

### Moderation (`src/lib/`)

| File | Purpose |
|------|---------|
| `moderationPipeline.ts` | Orchestrates all moderation layers |
| `piiDetection.ts` | Detects emails, phones, SSNs, addresses, social handles |
| `aiModeration.ts` | OpenAI Moderation API integration |
| `perspectiveModeration.ts` | Google Perspective API (toxicity) |
| `blocklist.ts` | Dynamic blocked terms from database |
| `moderation.ts` | Local heuristics (profanity, obfuscations, leetspeak) |

### Rate Limiting (`src/lib/rateLimit.ts`)

```typescript
// Rate limit configurations
RATE_LIMITS = {
  PULSE_CREATE: { limit: 5, windowSeconds: 3600 },      // 5/hour
  REPORT: { limit: 10, windowSeconds: 86400 },          // 10/day
  VENUE_VIBE: { limit: 5, windowSeconds: 3600 },        // 5/hour
  GLOBAL: { limit: 100, windowSeconds: 60 }             // 100/min
}
```

### Gamification (`src/lib/gamification.ts`)

```typescript
// XP rewards
PULSE_XP = 10
REACTION_XP = { fire: 5, eyes: 3, check: 2 }

// Level calculation (sqrt curve)
calculateLevel(xp) = Math.floor(Math.sqrt(xp / 10)) + 1

// Tiers (based on weekly rank)
TIERS = {
  Diamond: ranks 1-3,
  Gold: ranks 4-10,
  Silver: ranks 11-25,
  Bronze: ranks 26-50,
  None: ranks 51+
}
```

### Content Lifespan (`src/lib/pulses.ts`)

```typescript
PULSE_LIFESPAN = {
  Traffic: 2 hours,
  Weather: 24 hours,
  Events: 24 hours,
  General: 24 hours
}

GRACE_PERIOD = 30 minutes  // Before expiry warning
```

---

## Security & Moderation

### Moderation Pipeline

```
User Input
    │
    ▼
┌─────────────────────────────────────┐
│ 1. PII Detection                    │
│    - Emails (including obfuscated)  │
│    - Phone numbers                  │
│    - SSNs                           │
│    - Physical addresses             │
│    - Social media handles           │
└─────────────────────────────────────┘
    │ PASS
    ▼
┌─────────────────────────────────────┐
│ 2. Local Heuristics                 │
│    - Blocklist terms                │
│    - Profanity (with leetspeak)     │
│    - Threats ("kys", "kill you")    │
│    - Obfuscation detection          │
└─────────────────────────────────────┘
    │ PASS
    ▼
┌─────────────────────────────────────┐
│ 3. AI Moderation (OpenAI)           │
│    - Hate speech                    │
│    - Violence                       │
│    - Sexual content                 │
│    - Self-harm                      │
└─────────────────────────────────────┘
    │ PASS
    ▼
┌─────────────────────────────────────┐
│ 4. Perspective API (optional)       │
│    - Toxicity scoring               │
│    - Severe toxicity                │
└─────────────────────────────────────┘
    │ PASS
    ▼
  ALLOWED
```

### Fail-Closed Guarantee

```typescript
// In production, if any moderation service fails:
if (process.env.NODE_ENV === 'production') {
  // ALWAYS reject - never allow unmoderated content
  return { allowed: false, reason: 'Moderation unavailable' };
}
```

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/pulses | 5 | 1 hour |
| POST /api/report-pulse | 10 | 24 hours |
| POST /api/venue-vibe | 5 | 1 hour |

---

## Gamification System

### Levels

- XP earned from pulses (10 XP) and reactions received (2-5 XP)
- Level = √(XP/10) + 1
- Max level: 100

### Tiers

Based on weekly leaderboard rank:

| Tier | Rank Range | Visual |
|------|------------|--------|
| Diamond | 1-3 | 💎 |
| Gold | 4-10 | 🥇 |
| Silver | 11-25 | 🥈 |
| Bronze | 26-50 | 🥉 |
| None | 51+ | - |

### Badges

Categories:
- **Category**: Tag-specific achievements (Traffic Titan, Weather Watcher)
- **Achievement**: Special accomplishments
- **Streak**: Consecutive day posting
- **Milestone**: Cumulative totals

---

## Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (required for moderation)
OPENAI_API_KEY=sk-...
```

### External APIs

```env
# Weather
WEATHER_API_KEY=xxx

# Events
TICKETMASTER_API_KEY=xxx

# News
NEWS_API_KEY=xxx
GNEWS_API_KEY=xxx

# Geocoding
NEXT_PUBLIC_GEOCODING_API_KEY=xxx

# Gas Prices
EIA_API_KEY=xxx

# Maps
TOMTOM_API_KEY=xxx
```

### Moderation (optional)

```env
# Google Perspective (optional toxicity layer)
PERSPECTIVE_API_KEY=xxx
PERSPECTIVE_TOXICITY_THRESHOLD=0.8
PERSPECTIVE_SEVERE_TOXICITY_THRESHOLD=0.5
PERSPECTIVE_TIMEOUT_MS=2000

# Moderation behavior
MODERATION_FAIL_OPEN=false  # NEVER true in production
MODERATION_TIMEOUT_MS=2000
```

### Admin

```env
ADMIN_API_KEY=xxx
ADMIN_SECRET=xxx
CRON_SECRET=xxx
```

### Notifications

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

---

## Version History

### v0.5.1 - Clickable Actions (Dec 31, 2025)
- Gas prices card → opens Google Maps for nearby stations
- Event cards → Add to Calendar / Directions / Share buttons
- ICS file generation for calendar events

### v0.5.0 - Safety, Moderation & Privacy Hardening (Dec 31, 2025)
- Rate limiting: 5 pulses/hour, 10 reports/day, 5 vibes/hour
- Mod queue admin API (GET/POST /api/admin/reports)
- Explicit field selection (no SELECT * for privacy)
- 191 comprehensive moderation tests

### v0.4.9 - Device Geolocation & Location Accuracy (Dec 30, 2025)
- Browser geolocation API integration
- Reverse geocoding to city name
- Location accuracy indicators

### v0.4.8 - Trust, Provenance & UX Polish (Dec 29, 2025)
- Pulse metadata (is_bot flag)
- Enhanced timestamps
- UI polish fixes

### v0.4.3 - Engagement Prompts (Dec 28, 2025)
- Tappable suggestion chips
- Time-based prompts (morning, lunch, evening)
- 6-hour cooldown between prompts

### v0.4.2 - UX Polish & Smart News Fallback (Dec 27, 2025)
- Vibrant "Log Vibe" button with gradient
- Fixed vibe modal click issue (React Portal)
- Hierarchical news fallback (City → County → Metro → State)

### v0.4.1 - Venue Vibe Checks (Dec 26, 2025)
- Real-time crowd-sourced atmosphere reporting
- Vibe picker modal with categories
- Integration with Yelp venue cards

### v0.4.0 - The Engagement Update (Dec 25, 2025)
- Local tab UI restoration
- Hyperlocal API endpoints
- Pulse reports migration
- News deduplication system

---

## Deployment Checklist

### Pre-Launch

- [ ] All environment variables set in Vercel
- [ ] Supabase RLS policies verified
- [ ] MODERATION_FAIL_OPEN=false in production
- [ ] ADMIN_API_KEY set and secured
- [ ] Rate limiting tested
- [ ] All 569 tests passing

### External Services

- [ ] OpenAI API key with sufficient quota
- [ ] Ticketmaster API approved for production
- [ ] NewsAPI/GNews API keys active
- [ ] OpenWeatherMap API key
- [ ] VAPID keys for push notifications

### Monitoring

- [ ] Vercel Analytics enabled
- [ ] OpenAI usage alerts configured
- [ ] Supabase query performance monitored
- [ ] Error tracking (optional: Sentry)

### Post-Launch

- [ ] Seed one city with 5-10 real users
- [ ] Kill AI sample pulses
- [ ] Track D1/D7 retention
- [ ] Monitor moderation queue

---

## File Structure

```
community-pulse/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── pulses/
│   │   │   ├── events/
│   │   │   ├── news/
│   │   │   ├── weather/
│   │   │   ├── gamification/
│   │   │   ├── admin/
│   │   │   └── ...
│   │   ├── page.tsx          # Main dashboard
│   │   ├── privacy/
│   │   └── terms/
│   ├── components/           # 37 React components
│   ├── hooks/                # 8 custom hooks
│   ├── lib/                  # 16 utility modules
│   └── types/
├── supabase/
│   └── migrations/           # Database migrations
├── public/
│   └── sw.js                 # Service worker
├── CLAUDE.md                 # AI assistant instructions
├── DOCUMENTATION.md          # This file
└── package.json
```

---

*Generated with Claude Code - December 31, 2025*
