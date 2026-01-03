# Community Pulse - Technical Documentation

> **Version:** 0.6.0
> **Last Updated:** January 3, 2026
> **Stack:** Next.js 14 + Supabase + OpenAI + Tailwind CSS

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Sources & Legal Compliance](#data-sources--legal-compliance)
4. [API Reference](#api-reference)
5. [Fallback Systems](#fallback-systems)
6. [Database Schema](#database-schema)
7. [Components](#components)
8. [Hooks](#hooks)
9. [Libraries & Utilities](#libraries--utilities)
10. [Security & Moderation](#security--moderation)
11. [Gamification System](#gamification-system)
12. [Environment Variables](#environment-variables)
13. [Version History](#version-history)
14. [Deployment Checklist](#deployment-checklist)

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
5. **Legal compliance** - Only use APIs with permissive terms of service

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
│  /weather        → Open-Meteo API (FREE)                        │
│  /events         → Ticketmaster API (with metro fallback)       │
│  /news           → GNews API                                    │
│  /gas-prices     → EIA API + OSM Gas Stations                   │
│  /local-deals    → Foursquare → OSM Overpass (fallback)         │
│  /farmers-markets→ USDA → Foursquare → OSM (fallback chain)     │
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

## Data Sources & Legal Compliance

### Why We Removed Yelp

**Yelp Fusion API was removed in v0.6.0** due to Terms of Service restrictions:

| Issue | Risk |
|-------|------|
| **Commercial use restrictions** | Yelp prohibits use in apps that compete with their core business |
| **Display requirements** | Must show Yelp branding prominently, can't mix with other data sources |
| **Caching limitations** | 24-hour max cache, complicates offline/PWA functionality |
| **Attribution requirements** | Complex logo/link requirements for every data display |
| **Lawsuit history** | Yelp has sued companies for TOS violations |

**Resolution:** Replaced with OpenStreetMap (completely free, open data) and Foursquare (permissive API terms).

---

### Current Data Sources

| Data Type | Primary Source | Fallback 1 | Fallback 2 | License |
|-----------|---------------|------------|------------|---------|
| **Weather** | Open-Meteo | - | - | Free, no API key |
| **Air Quality** | Open-Meteo | - | - | Free, no API key |
| **Events** | Ticketmaster | Metro fallback | - | API key required |
| **News** | GNews | Google News search | - | API key required |
| **Gas Prices** | EIA (federal) | - | - | Public domain |
| **Gas Stations** | OpenStreetMap | - | - | ODbL (free) |
| **Local Places** | Foursquare | OpenStreetMap | - | API key / ODbL |
| **Farmers Markets** | USDA | Foursquare | OpenStreetMap | Public domain / ODbL |
| **Traffic** | TomTom | Community pulses | - | API key required |
| **Geocoding** | OpenCage | - | - | API key required |

---

### OpenStreetMap (OSM) Integration

**Why OSM?**
- **Completely free** - No API costs, no rate limits (reasonable use)
- **Open data** - ODbL license allows commercial use with attribution
- **Global coverage** - Community-maintained worldwide
- **No API key** - Uses Overpass API for queries

**Implementation:**
```
src/app/api/osm/places/route.ts     - Local places via Overpass API
src/app/api/gas-stations/route.ts   - Gas stations with OSM fallback
src/app/api/farmers-markets/route.ts - Markets with OSM fallback
```

**Overpass API Mirrors (for reliability):**
1. `https://overpass-api.de/api/interpreter` (primary)
2. `https://overpass.kumi.systems/api/interpreter` (backup)

**Attribution Requirement:**
All OSM data displays include: "Powered by OpenStreetMap" with link to openstreetmap.org

---

### Open-Meteo Weather Integration

**Replaced OpenWeatherMap** in v0.6.0:

| Feature | Open-Meteo | OpenWeatherMap |
|---------|------------|----------------|
| **Cost** | Free forever | $0 for 1K calls/day, then paid |
| **API Key** | Not required | Required |
| **Rate Limits** | 10K/day (generous) | 1K/day free tier |
| **AQI Data** | Included free | Separate paid API |
| **Forecast** | 16 days free | 5 days free |

**Data provided:**
- Current temperature, feels-like, humidity
- Weather conditions and icons
- Air Quality Index (US EPA standard)
- AQI category and health recommendations

---

### Foursquare Places API

**Why Foursquare over Yelp?**
- More permissive TOS for aggregator apps
- No strict display requirements
- Better international coverage
- Cleaner API design

**Current Status:** API key returning 401 errors (invalid key issue)

**Fallback:** OpenStreetMap Overpass API provides full coverage when Foursquare fails

---

### Google Maps Integration

**Usage:** Deep links only (no API calls)
- **No API key required** - Using URL scheme, not Maps API
- **No cost** - Public URL format
- **No TOS issues** - Standard web links

**URL Patterns:**
```
Search:     https://www.google.com/maps/search/?api=1&query=ENCODED_QUERY
Directions: https://www.google.com/maps/dir/?api=1&destination=ENCODED_DEST
```

**Used in:**
- Gas station "Get Directions" buttons
- Farmers market address links
- Local deals venue cards
- Event venue directions

---

## Fallback Systems

### Events (Ticketmaster Metro Fallback)

**Problem:** Small towns (e.g., Leander, TX; Irwin, IL) return 0 events

**Solution:** Detect state, find nearest major metro, search there

```typescript
// State → Metro mapping
const STATE_TO_METROS = {
  TX: [
    { name: "Austin", lat: 30.2672, lon: -97.7431 },
    { name: "Houston", lat: 29.7604, lon: -95.3698 },
    { name: "Dallas", lat: 32.7767, lon: -96.7970 },
    // ...
  ],
  IL: [
    { name: "Chicago", lat: 41.8781, lon: -87.6298 },
    { name: "St. Louis", lat: 38.6270, lon: -90.1994 },
    // ...
  ],
  // 50 states covered
};
```

**Flow:**
1. Search user's city (25mi radius)
2. If 0 results → detect state
3. Find nearest metro using Haversine distance
4. Search metro (50mi radius)
5. Return events with attribution: "Events near Chicago (111 mi away)"

**Caching:** In-memory cache stores fallback metadata for UI display

---

### Local Places (Foursquare → OSM)

**Fallback Chain:**
```
1. Try Foursquare Places API
   ↓ (if 401/error/empty)
2. Query OpenStreetMap Overpass API
   - Amenities: cafe, restaurant, bar, fast_food, pub, nightclub
   - Shops: supermarket, convenience, grocery, greengrocer
   ↓ (if empty)
3. Show "No places found" with Google Maps search link
```

**Category Mapping:**
| UI Category | Foursquare | OSM Amenity | OSM Shop |
|-------------|------------|-------------|----------|
| All | various | cafe, restaurant, bar, fast_food | - |
| Coffee | 13035 | cafe | - |
| Food | 13065 | restaurant, fast_food | - |
| Bars | 13003 | bar, pub, nightclub | - |
| Grocery | 17069 | - | supermarket, convenience, grocery |

---

### Farmers Markets (USDA → Foursquare → OSM)

**Triple Fallback:**
```
1. USDA Local Food Directories API (authoritative federal data)
   ↓ (if empty - common for many cities)
2. Foursquare Places API (category 17069)
   ↓ (if 401/error/empty)
3. OpenStreetMap Overpass API
   - amenity=marketplace
   - shop=farm
   - name~"farmer|market|produce"
   ↓ (if empty)
4. Show Google Maps search link
```

**Note:** OSM may return general "markets" (convenience stores with "market" in name) rather than true farmers markets. Attribution indicates data source.

---

### News (GNews → Google News)

**Hierarchical Fallback:**
```
1. Search: "City, State" (e.g., "Leander, TX")
   ↓ (if < 3 articles)
2. Search: "County, State" (e.g., "Williamson County, TX")
   ↓ (if < 3 articles)
3. Search: "Metro area" (e.g., "Austin area")
   ↓ (if < 3 articles)
4. Search: "State news" (e.g., "Texas")
   ↓ (if still empty)
5. Show Google News fallback link
```

**Deduplication:** Articles deduplicated by normalized title to prevent showing same story from multiple sources.

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
  "neighborhood": "Downtown",
  "mood": "frustrated",
  "tag": "Traffic",
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
  "created_at": "2026-01-03T10:00:00Z",
  "expires_at": "2026-01-03T12:00:00Z"
}
```

**Errors:**
- `400` - Validation failed or content blocked by moderation
- `401` - Not authenticated
- `429` - Rate limit exceeded (5 pulses/hour)
- `503` - Moderation service unavailable (fail-closed)

---

#### GET /api/events/ticketmaster
Events with metro fallback for small towns.

**Query:** `?city=Leander&state=TX&lat=30.5788&lon=-97.8531&radius=25`

**Response:**
```json
{
  "events": [...],
  "total": 20,
  "cached": true,
  "fallback": {
    "metro": "Austin",
    "distance": 26
  }
}
```

**Fallback info** included when events are from nearby metro, not user's city.

---

#### GET /api/osm/places
Local places via OpenStreetMap (free fallback).

**Query:** `?lat=30.2672&lon=-97.7431&category=coffee&radius=5000`

**Categories:** `all`, `coffee`, `restaurants`, `bars`, `grocery`

**Response:**
```json
{
  "places": [
    {
      "id": "osm-node-123456",
      "name": "Starbucks",
      "category": "cafe",
      "address": "123 Congress Ave, Austin",
      "lat": 30.2650,
      "lon": -97.7420,
      "distance": 245,
      "openingHours": "Mo-Fr 06:00-20:00"
    }
  ],
  "source": "openstreetmap"
}
```

---

#### GET /api/gas-stations
Nearby gas stations via OpenStreetMap.

**Query:** `?lat=30.2672&lon=-97.7431`

**Response:**
```json
{
  "stations": [
    {
      "id": "osm-node-789",
      "name": "7-Eleven",
      "brand": "7-Eleven",
      "address": "500 E 6th St, Austin",
      "lat": 30.2680,
      "lon": -97.7380,
      "distance": 0.3,
      "amenities": ["convenience_store", "atm"]
    }
  ],
  "source": "openstreetmap"
}
```

---

#### GET /api/farmers-markets
Markets with triple fallback (USDA → Foursquare → OSM).

**Query:** `?city=Austin&state=TX&lat=30.2672&lon=-97.7431`

**Response:**
```json
{
  "markets": [
    {
      "id": "usda-123",
      "name": "Austin Farmers Market",
      "address": "422 Guadalupe St",
      "schedule": "Sat 9am-1pm",
      "products": ["Organic", "Vegetables", "Eggs"],
      "isOpenToday": true,
      "distance": 1.2,
      "source": "usda"
    }
  ],
  "total": 5,
  "source": "usda"
}
```

**Source values:** `usda`, `foursquare`, `osm`

---

#### POST /api/weather
Weather and AQI via Open-Meteo (free, no API key).

**Body:**
```json
{
  "lat": 30.2672,
  "lon": -97.7431
}
```

**Response:**
```json
{
  "temp": 75,
  "feelsLike": 78,
  "humidity": 45,
  "description": "Partly cloudy",
  "icon": "02d",
  "aqi": {
    "value": 42,
    "category": "Good",
    "color": "#00e400"
  }
}
```

---

### Auto-Seeding Bot API

#### POST /api/auto-seed
Generate realistic bot pulses for empty cities.

**Headers:** `x-cron-secret: <CRON_SECRET>`

**Body:**
```json
{
  "city": "Leander",
  "state": "TX",
  "lat": 30.5788,
  "lon": -97.8531
}
```

**Features:**
- Weather-aware messages (checks actual conditions)
- Time-of-day appropriate content (commute times, lunch, evening)
- Varied bot personas with distinct voices
- Traffic pulse frequency based on time
- Never seeds duplicate content

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
  current_streak_days INT DEFAULT 0,
  longest_streak_days INT DEFAULT 0,
  level INT DEFAULT 1,
  xp_total INT DEFAULT 0
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  badge_id UUID REFERENCES badge_definitions(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
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
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '4 hours'
);

CREATE TABLE pulse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id UUID REFERENCES pulses(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Components

### Content Display

| Component | Location | Purpose |
|-----------|----------|---------|
| `PulseCard` | `src/components/PulseCard.tsx` | Individual pulse with expiry, reactions |
| `EventCard` | `src/components/EventCard.tsx` | Event with Calendar/Directions/Share + metro fallback |
| `NewsCard` | `src/components/NewsCard.tsx` | Clickable news article |
| `GasPricesCard` | `src/components/GasPricesCard.tsx` | Gas prices + nearby stations |
| `LocalDealsSection` | `src/components/LocalDealsSection.tsx` | Local places with OSM fallback |
| `FarmersMarketsSection` | `src/components/FarmersMarketsSection.tsx` | Markets with Google Maps links |
| `VenueVibeCheck` | `src/components/VenueVibeCheck.tsx` | Atmosphere check-in modal |

### Navigation & Layout

| Component | Location | Purpose |
|-----------|----------|---------|
| `LocalTab` | `src/components/LocalTab.tsx` | Explore/Gas/Markets segmented control |
| `LiveVibes` | `src/components/LiveVibes.tsx` | Venue vibe display + "Log Vibe" CTA |

---

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useGamification` | `src/hooks/useGamification.ts` | Fetch user stats, badges, tier |
| `useLeaderboard` | `src/hooks/useLeaderboard.ts` | Fetch leaderboard with pagination |
| `useGeolocation` | `src/hooks/useGeolocation.ts` | Browser geolocation API |
| `useEvents` | `src/hooks/useEvents.ts` | Fetch events with fallback info |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts` | Push notification management |

---

## Security & Moderation

### Moderation Pipeline

```
User Input
    │
    ▼
┌─────────────────────────────────────┐
│ 1. PII Detection                    │
│    - Emails, phones, SSNs           │
│    - Physical addresses             │
│    - Social media handles           │
└─────────────────────────────────────┘
    │ PASS
    ▼
┌─────────────────────────────────────┐
│ 2. Local Heuristics                 │
│    - Blocklist terms                │
│    - Profanity (with leetspeak)     │
│    - Threat detection               │
└─────────────────────────────────────┘
    │ PASS
    ▼
┌─────────────────────────────────────┐
│ 3. AI Moderation (OpenAI)           │
│    - Hate speech, violence          │
│    - Sexual content, self-harm      │
└─────────────────────────────────────┘
    │ PASS
    ▼
  ALLOWED
```

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/pulses | 5 | 1 hour |
| POST /api/report-pulse | 10 | 24 hours |
| POST /api/venue-vibe | 5 | 1 hour |

---

## Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (required for moderation + summaries)
OPENAI_API_KEY=sk-...
```

### External APIs

```env
# Events
TICKETMASTER_API_KEY=xxx

# News
GNEWS_API_KEY=xxx

# Geocoding
NEXT_PUBLIC_GEOCODING_API_KEY=xxx

# Traffic
TOMTOM_API_KEY=xxx

# Local Places (optional - OSM fallback available)
FOURSQUARE_API_KEY=xxx
```

### Free APIs (No Key Required)

```env
# These don't need API keys:
# - Open-Meteo (weather + AQI)
# - OpenStreetMap Overpass (places, gas stations)
# - USDA Local Food Directories (farmers markets)
# - EIA (gas prices - public domain)
```

---

## Version History

### v0.6.0 - The Data Independence Update (Jan 3, 2026)

**Major Changes:**
- **Removed Yelp integration** - TOS compliance concerns
- **Added OpenStreetMap** as primary fallback for all location data
- **Switched to Open-Meteo** for weather/AQI (free, no API key)
- **Implemented triple fallback** for farmers markets (USDA → Foursquare → OSM)
- **Added metro fallback** for Ticketmaster events in small towns
- **Google Maps deep links** throughout (free, no API)

**New Features:**
- Colorful category-based thumbnails for places (gradient backgrounds)
- "Directions" button on all venue cards
- Clickable addresses open Google Maps
- Metro attribution for fallback events ("Events near Austin, 26 mi away")
- Bot seeding for empty cities with weather-aware content

**Legal/Compliance:**
- All data sources now have permissive licenses
- OSM attribution displayed where required
- No scraping or TOS-violating API usage

### v0.5.1 - Clickable Actions (Dec 31, 2025)
- Gas prices card → opens Google Maps for nearby stations
- Event cards → Add to Calendar / Directions / Share buttons
- ICS file generation for calendar events

### v0.5.0 - Safety & Moderation Hardening (Dec 31, 2025)
- Rate limiting: 5 pulses/hour, 10 reports/day
- Mod queue admin API
- 191 comprehensive moderation tests

### v0.4.x - The Engagement Update (Dec 25-30, 2025)
- Venue vibe checks
- Suggestion chips
- News fallback hierarchy
- Device geolocation

---

## Deployment Checklist

### Pre-Launch

- [ ] All environment variables set in Vercel
- [ ] Supabase RLS policies verified
- [ ] MODERATION_FAIL_OPEN=false in production
- [ ] Rate limiting tested
- [ ] OSM attribution visible on all maps/places

### External Services

- [ ] OpenAI API key with sufficient quota
- [ ] Ticketmaster API approved for production
- [ ] GNews API key active
- [ ] (Optional) Foursquare API key

### Free Services (No Setup)

- [x] Open-Meteo - works without key
- [x] OpenStreetMap Overpass - works without key
- [x] USDA Local Food - works without key
- [x] EIA Gas Prices - works without key
- [x] Google Maps links - no API needed

---

## File Structure

```
community-pulse/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── pulses/
│   │   │   ├── events/ticketmaster/    # With metro fallback
│   │   │   ├── osm/places/             # NEW: OpenStreetMap places
│   │   │   ├── gas-stations/           # With OSM fallback
│   │   │   ├── farmers-markets/        # Triple fallback
│   │   │   ├── weather/                # Open-Meteo
│   │   │   ├── news/
│   │   │   ├── auto-seed/              # Bot seeding
│   │   │   └── ...
│   │   ├── page.tsx
│   │   ├── privacy/
│   │   └── terms/
│   ├── components/
│   │   ├── LocalDealsSection.tsx       # NEW: With OSM fallback
│   │   ├── FarmersMarketsSection.tsx   # Updated: Google Maps links
│   │   ├── EventCard.tsx               # Updated: Metro fallback display
│   │   └── ...
│   ├── hooks/
│   │   ├── useEvents.ts                # Updated: Fallback info
│   │   └── ...
│   └── lib/
├── CLAUDE.md
├── DOCUMENTATION.md
└── package.json
```

---

*Generated with Claude Code - January 3, 2026*
