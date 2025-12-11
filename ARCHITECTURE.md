# Community Pulse - Complete Architecture & Feature Documentation

**Last Updated:** December 10, 2025
**Version:** Beta 0.1.0
**Purpose:** Comprehensive technical documentation for developers and AI agents

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Data Flow & Communication](#data-flow--communication)
8. [Feature Documentation](#feature-documentation)
9. [API Endpoints](#api-endpoints)
10. [GUI Layout & Components](#gui-layout--components)
11. [Environment Variables](#environment-variables)
12. [Development Setup](#development-setup)

---

## Project Overview

**Community Pulse** is a real-time, city-based social microblogging platform designed to capture and share hyperlocal community vibes. It focuses on authentic, quick status updates ("pulses") about what's happening in a specific city right now - traffic conditions, weather observations, local events, and general community sentiment.

### Core Concept
- **Hyperlocal Focus:** All content is city-specific
- **Real-time Updates:** Live feed using Supabase real-time subscriptions
- **Anonymous Culture:** AI-generated fun usernames instead of real identities
- **Anti-Doomscroll:** Short messages (240 char max), filtered content, positive focus
- **AI-Enhanced:** Summaries, traffic analysis, username generation via OpenAI

### Target Use Case
Users want to quickly check "what's the vibe in [city] right now?" before commuting, planning activities, or just staying connected to their local community without algorithmic feeds or endless scrolling.

---

## Technology Stack

### Frontend
- **Framework:** Next.js 16.0.3 (App Router)
- **UI Library:** React 19.2.0
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 with PostCSS
- **Compiler:** React Compiler (Babel plugin) - experimental optimization
- **Client-Side State:** React hooks (useState, useEffect, useCallback, useRef)

### Backend
- **Runtime:** Node.js (Next.js API Routes)
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Real-time subscriptions (PostgreSQL LISTEN/NOTIFY)
- **Authentication:** Supabase Auth (email/password)
- **AI Services:** OpenAI API (GPT-4o-mini)
- **External APIs:**
  - OpenWeatherMap API (weather data)
  - NewsAPI.org (local news)
  - Google Maps (event location links)

### Development Tools
- **Linter:** ESLint 9
- **Type Checking:** TypeScript compiler
- **Package Manager:** npm

---

## Architecture Overview

### Architectural Pattern
Community Pulse follows a **serverless full-stack architecture** using Next.js App Router:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │   React Components (src/app/page.tsx)              │     │
│  │   - Real-time UI updates                           │     │
│  │   - Form handling                                  │     │
│  │   - Local state management                         │     │
│  └─────────────┬──────────────────────────────────────┘     │
│                │                                             │
└────────────────┼─────────────────────────────────────────────┘
                 │
                 │ HTTP/WebSocket
                 │
┌────────────────┼─────────────────────────────────────────────┐
│                ▼         NEXT.JS SERVER                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Routes (src/app/api/*/route.ts)                │    │
│  │  - Serverless functions                             │    │
│  │  - Business logic                                   │    │
│  │  - External API integration                         │    │
│  └────┬──────────────┬──────────────┬──────────────┬───┘    │
│       │              │              │              │         │
└───────┼──────────────┼──────────────┼──────────────┼─────────┘
        │              │              │              │
        │              │              │              │
   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │Supabase │    │ OpenAI  │   │ Weather │   │  News   │
   │Database │    │   API   │   │   API   │   │   API   │
   │+ Auth   │    │         │   │         │   │         │
   │+ RT     │    └─────────┘   └─────────┘   └─────────┘
   └─────────┘
```

### Key Architectural Decisions

1. **Monolithic Frontend Component**
   - Single 2200+ line component (src/app/page.tsx)
   - All state managed in one place
   - Rationale: Prototype/beta stage, easier state coordination for real-time features
   - Future refactoring opportunity: Split into smaller components

2. **Serverless API Routes**
   - Each feature has dedicated API route
   - Stateless request handlers
   - Edge-ready (can deploy to Vercel Edge)

3. **Real-time First**
   - Supabase real-time subscriptions for instant updates
   - Optimistic UI updates
   - No polling required

4. **AI Integration Pattern**
   - Graceful degradation: All AI features have fallbacks
   - Server-side AI calls (API keys never exposed to client)
   - Streaming not implemented (uses complete responses)

---

## Frontend Architecture

### Component Structure

The entire application lives in a single client component: **[src/app/page.tsx](src/app/page.tsx)**

#### State Management

The component uses React hooks to manage 40+ state variables grouped by feature:

```typescript
// Core State
const [city, setCity] = useState("Austin");
const [tagFilter, setTagFilter] = useState("All");
const [pulses, setPulses] = useState<Pulse[]>([]);

// Auth State
const [sessionUser, setSessionUser] = useState<User | null>(null);
const [profile, setProfile] = useState<Profile | null>(null);
const [showAuthModal, setShowAuthModal] = useState(false);

// Feature States
const [weather, setWeather] = useState<WeatherInfo | null>(null);
const [news, setNews] = useState<NewsData | null>(null);
const [events, setEvents] = useState<EventItem[]>([]);
const [summary, setSummary] = useState<string | null>(null);
const [trafficLevel, setTrafficLevel] = useState<...>(null);
const [cityMood, setCityMood] = useState<...>(null);

// UI State
const [loading, setLoading] = useState(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
// ... 30+ more state variables
```

#### Effects & Side Effects

The component uses **15+ useEffect hooks** for:
1. Real-time pulse subscription
2. Initial data fetching on city change
3. Periodic data updates
4. Local storage persistence
5. Outside-click handlers
6. Session management

Example - Real-time Subscription (lines 301-337):
```typescript
useEffect(() => {
  if (!city) return;

  const channel = supabase
    .channel("pulses-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pulses",
        filter: `city=eq.${city}`,
      },
      (payload) => {
        const row = payload.new as DBPulse;
        const pulse = mapDBPulseToPulse(row);

        setPulses((prev) => {
          const exists = prev.some((p) => String(p.id) === String(pulse.id));
          if (exists) return prev;
          return [pulse, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [city, setPulses]);
```

### Data Types

All TypeScript types are defined inline in page.tsx:

```typescript
type Pulse = {
  id: number;
  city: string;
  mood: string;      // Emoji
  tag: string;       // Traffic/Weather/Events/General
  message: string;
  author: string;
  createdAt: string;
};

type WeatherInfo = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;       // OpenWeather icon code
  cityName: string;
};

type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  starts_at: string;
  ends_at?: string | null;
  is_sponsored?: boolean | null;
};

type Profile = {
  anon_name: string;
  name_locked?: boolean | null;
};

type StreakInfo = {
  currentStreak: number;
  lastActiveDate: string | null;
};
```

### Client-Side Validation

**Content Moderation (lines 11-16):**
```typescript
const BANNED_WORDS = ["badword1", "badword2", "badword3"];

function isCleanMessage(text: string) {
  const lowered = text.toLowerCase();
  return !BANNED_WORDS.some((w) => lowered.includes(w));
}
```

**Password Validation (lines 970-988):**
- Minimum 8 characters
- Must contain lowercase letter
- Must contain uppercase letter
- Must contain number

**Message Length:**
- Maximum 240 characters (enforced in textarea)

---

## Backend Architecture

### API Routes Structure

All API routes follow Next.js App Router conventions:

```
src/app/api/
├── city-mood/route.ts      # GET - City mood analytics
├── events/route.ts          # GET, POST - Event management
├── news/route.ts            # GET - News aggregation
├── summary/route.ts         # POST - AI pulse summary
├── traffic/route.ts         # GET - Traffic estimation
├── username/route.ts        # POST - AI username generation
└── weather/route.ts         # POST - Weather data
```

Each route is a serverless function that:
1. Validates input
2. Performs business logic
3. Returns JSON response
4. Handles errors gracefully

---

## Database Schema

### Supabase PostgreSQL Tables

#### 1. **pulses** (Main Content Table)
```sql
CREATE TABLE pulses (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  mood TEXT NOT NULL,           -- Emoji (😊, 😐, 😢, 😡, 😴, 🤩)
  tag TEXT NOT NULL,             -- Traffic, Weather, Events, General
  message TEXT NOT NULL,         -- Max 240 chars (client-enforced)
  author TEXT NOT NULL,          -- Anonymous username
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pulses_city ON pulses(city);
CREATE INDEX idx_pulses_created_at ON pulses(created_at);
CREATE INDEX idx_pulses_city_created ON pulses(city, created_at DESC);
CREATE INDEX idx_pulses_user_id ON pulses(user_id);
```

**Purpose:** Stores all user posts
**Real-time Enabled:** Yes (INSERT events trigger browser updates)

#### 2. **profiles** (User Profiles)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  anon_name TEXT NOT NULL,       -- AI-generated username
  name_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores anonymous user profiles
**Row-Level Security:** Users can only update their own profile

#### 3. **favorites** (Bookmarked Pulses)
```sql
CREATE TABLE favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pulse_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_pulse ON favorites(pulse_id);
```

**Purpose:** User's saved/favorited pulses

#### 4. **events** (Community Events)
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_sponsored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_city ON events(city);
CREATE INDEX idx_events_starts_at ON events(starts_at);
```

**Purpose:** Local events calendar

#### 5. **auth.users** (Supabase Auth Table)
Managed by Supabase Auth:
- Email/password authentication
- Email confirmation optional (configurable)
- UUID primary key

---

## Data Flow & Communication

### 1. Initial Page Load

```
User navigates to app
    │
    ├─→ Load session from Supabase Auth
    │   └─→ If logged in: Load user profile from DB
    │
    ├─→ Check localStorage for saved city
    │   └─→ setCity(savedCity || "Austin")
    │
    └─→ Trigger parallel data fetches:
        ├─→ Fetch pulses for city (Supabase query)
        ├─→ Subscribe to real-time pulse updates
        ├─→ Fetch weather (API call)
        ├─→ Fetch news (API call)
        ├─→ Fetch events (API call)
        ├─→ Calculate city mood (API call)
        ├─→ Calculate traffic (API call)
        └─→ Generate AI summary (API call)
```

### 2. User Posts a Pulse

```
User types message & clicks "Post pulse"
    │
    ├─→ Client-side validation
    │   ├─→ Check message not empty
    │   ├─→ Check banned words
    │   └─→ Check length ≤ 240 chars
    │
    ├─→ Insert into Supabase pulses table
    │   {
    │     city: "Austin",
    │     mood: "😊",
    │     tag: "Traffic",
    │     message: "Roads are clear!",
    │     author: "ChillCoyote42",
    │     user_id: <uuid>
    │   }
    │
    └─→ Supabase broadcasts INSERT event
        │
        └─→ All connected clients receive update
            └─→ Real-time listener adds pulse to feed
                └─→ Triggers AI summary refresh
                    └─→ Triggers traffic recalculation
```

### 3. Real-time Subscription Flow

```
Component mounts
    │
    └─→ Create Supabase channel subscription
        │
        supabase.channel("pulses-realtime")
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "pulses",
            filter: `city=eq.${city}`
          }, handleNewPulse)
          .subscribe()
        │
        │ [PostgreSQL NOTIFY triggers WebSocket message]
        │
        └─→ handleNewPulse(payload) {
              - Map DB row to Pulse type
              - Check if already in state (dedupe)
              - Add to pulses array
              - Sort by timestamp
              - Re-render UI
            }

Component unmounts
    │
    └─→ Cleanup: supabase.removeChannel(channel)
```

### 4. City Change Flow

```
User types in city input → autocomplete suggestions appear
    │
    └─→ searchCities(input, 8) [client-side]
        - Filter US_CITIES array
        - Match by name prefix
        - Sort by population
        - Return top 8 matches
    │
User selects "Denver, CO"
    │
    ├─→ setCity("Denver, CO")
    ├─→ Save to localStorage
    │
    └─→ Triggers all useEffect dependencies:
        ├─→ Unsubscribe from "Austin" real-time channel
        ├─→ Subscribe to "Denver, CO" real-time channel
        ├─→ Fetch pulses for Denver
        ├─→ Fetch weather for Denver
        ├─→ Fetch news for Denver
        ├─→ Fetch events for Denver
        ├─→ Calculate city mood for Denver
        └─→ Calculate traffic for Denver
```

### 5. Authentication Flow

**Sign Up:**
```
User clicks "Sign in" → modal opens → switches to "Create Account"
    │
    ├─→ User enters email + password
    ├─→ Client validates password strength
    │   └─→ 8+ chars, uppercase, lowercase, number
    │
    └─→ supabase.auth.signUp({ email, password })
        │
        ├─→ [If email confirmation enabled]
        │   └─→ Show "Check your email" message
        │
        └─→ [If auto-login enabled]
            ├─→ Session created
            ├─→ Generate random username: generateFunUsername()
            ├─→ Insert into profiles table
            └─→ setSessionUser(user)
                └─→ setProfile({ anon_name, name_locked: false })
```

**Sign In:**
```
User enters credentials
    │
    └─→ supabase.auth.signInWithPassword({ email, password })
        │
        ├─→ Load profile from DB
        │   └─→ If no profile: create one (legacy users)
        │
        └─→ setSessionUser(user)
            └─→ Load user's favorites
                └─→ Load user's streak data
```

### 6. AI Username Generation Flow

```
User clicks "Edit vibe name" → enters mood description
    │
    ├─→ Client validation: min 3 words
    │
    └─→ POST /api/username { prompt: "sleepy sarcastic caffeinated" }
        │
        ├─→ [Server] Check OPENAI_API_KEY exists
        │   │
        │   ├─→ [If missing] Return local fallback
        │   │   └─→ makeLocalUsername(prompt)
        │   │       - Split words, capitalize, concat
        │   │       - Append random 2-digit number
        │   │       - Return "SleepySarcasticCaffeinated42"
        │   │
        │   └─→ [If available] Call OpenAI API
        │       └─→ GPT-4o-mini with system prompt
        │           - Model: gpt-4o-mini
        │           - Max tokens: 16
        │           - Temperature: 0.9
        │           - Rules: PascalCase, no spaces, no emojis
        │           - Example: "DrowsyCaffeinatedOwl24"
        │
        └─→ Client receives { username: "..." }
            ├─→ Save lastAnonName (for undo)
            ├─→ Update local state
            └─→ Update Supabase profile
```

---

## Feature Documentation

### Feature 1: Real-time Pulse Feed

**Location:** [src/app/page.tsx:301-337](src/app/page.tsx#L301-L337)

**Description:**
Live updating feed of community posts. New pulses appear instantly without page refresh.

**Technology:**
- Supabase real-time subscriptions (PostgreSQL LISTEN/NOTIFY over WebSocket)
- React state updates trigger re-render

**How It Works:**
1. Component subscribes to `pulses` table INSERTs filtered by city
2. When any user posts a pulse, PostgreSQL triggers NOTIFY
3. Supabase broadcasts event to all subscribed clients via WebSocket
4. Client receives payload, maps to Pulse type, updates state
5. React re-renders feed with new pulse at top

**User Flow:**
- User opens app in Austin
- Feed shows recent Austin pulses
- Another user posts "Traffic is smooth on I-35"
- New pulse appears in feed instantly (< 500ms)

**Edge Cases:**
- Duplicate detection: Checks if pulse.id already exists before adding
- Sorting: Always sorts by createdAt descending
- Cleanup: Unsubscribes on unmount or city change

---

### Feature 2: City Mood Meter

**Location:**
- Frontend: [src/app/page.tsx:340-372](src/app/page.tsx#L340-L372)
- Backend: [src/app/api/city-mood/route.ts](src/app/api/city-mood/route.ts)

**Description:**
Analyzes recent pulses to determine the dominant mood (emoji) in a city and show mood distribution.

**Algorithm:**
1. Fetch pulses from last 3 hours for city
2. Count frequency of each mood emoji
3. Calculate percentage distribution
4. Return dominant mood + top 3 moods with percentages

**API Endpoint:**
```
GET /api/city-mood?city=Austin

Response:
{
  dominantMood: "😊",
  scores: [
    { mood: "😊", count: 45, percent: 60 },
    { mood: "😐", count: 20, percent: 27 },
    { mood: "😢", count: 10, percent: 13 }
  ],
  pulseCount: 75,
  windowHours: 3
}
```

**UI Display:**
- Large emoji showing dominant mood
- "From 75 recent pulses"
- Breakdown of top 3 moods with percentages
- Updates when new pulses arrive

**Fallback:**
- If < 1 pulse: "Not enough recent pulses to read the mood"

---

### Feature 3: AI Traffic Estimation

**Location:**
- Frontend: [src/app/page.tsx:798-837](src/app/page.tsx#L798-L837)
- Backend: [src/app/api/traffic/route.ts](src/app/api/traffic/route.ts)

**Description:**
Uses AI to analyze traffic-related pulses and estimate current traffic level: Light, Moderate, or Heavy.

**Algorithm (Two-tier approach):**

**Tier 1 - AI Classification (Primary):**
1. Fetch pulses from last 60 minutes tagged "Traffic" or mentioning traffic
2. Send to GPT-4o-mini with prompt to classify as Light/Moderate/Heavy
3. Prioritize most recent 3-5 messages heavily
4. Return classification

**Tier 2 - Heuristic Fallback (if AI fails):**
1. Scan messages for keyword matches:
   - **Heavy indicators:** "stuck in traffic", "gridlock", "standstill" (+4 points each)
   - **Moderate indicators:** "bad traffic", "heavy traffic", "slow" (+2 points each)
   - **Light indicators:** "no traffic", "smooth commute" (-3 points each)
2. Apply time-of-day modifier:
   - Rush hour (7-9am, 4-6pm): +1 point
   - Late night (10pm-5am): -1 point
3. Score thresholds:
   - ≥5 points: Heavy
   - ≥2 points: Moderate
   - <2 points: Light

**API Call:**
```
GET /api/traffic?city=Austin

Response:
{
  level: "Moderate",
  source: "ai",  // or "heuristic"
  pulseCount: 12
}
```

**UI Display:**
- 🟢 Green circle for Light
- 🟡 Yellow circle for Moderate
- 🔴 Red circle for Heavy
- Text: "Light/Moderate/Heavy traffic"

**Smart Features:**
- Recent message priority: Last 5 messages dominate decision
- Example: If last 3 say "no traffic" but older ones said "heavy", returns "Light"

---

### Feature 4: AI Pulse Summary

**Location:**
- Frontend: [src/app/page.tsx:245-298](src/app/page.tsx#L245-L298)
- Backend: [src/app/api/summary/route.ts](src/app/api/summary/route.ts)

**Description:**
AI-generated natural language summary of recent city vibes based on all pulses.

**Process:**
1. Client sends up to 30 most recent pulses to API
2. Server constructs prompt with pulse data
3. Sends to GPT-4o-mini:
   - Model: gpt-4o-mini
   - Temperature: 0.4 (deterministic)
   - Max tokens: 120
4. Receives 1-2 sentence summary
5. Displays in UI

**Example Input:**
```
City: Austin
Recent pulses:
- [Traffic] (😊) by ChillCoyote42: Roads are clear on I-35
- [Weather] (🤩) by HyperFalcon88: Beautiful sunset tonight
- [Events] (😊) by CuriousPanda55: Food truck festival downtown
```

**Example Output:**
```
"Austin is experiencing smooth traffic conditions and pleasant weather.
The community is excited about the downtown food truck festival."
```

**UI Features:**
- Auto-updates when pulses change
- Shows "Summarizing recent pulses..." while loading
- Graceful error: "Unable to summarize right now"
- Hidden if no pulses available

---

### Feature 5: Weather Widget

**Location:**
- Frontend: [src/app/page.tsx:443-492](src/app/page.tsx#L443-L492)
- Backend: [src/app/api/weather/route.ts](src/app/api/weather/route.ts)

**Description:**
Shows current weather conditions from OpenWeatherMap API with emoji icons.

**Data Flow:**
1. Client sends city name (e.g., "Austin, TX")
2. Server converts to OpenWeather format: "Austin,TX,US"
3. Calls OpenWeatherMap API
4. Returns: temp, feels_like, description, icon code
5. Client maps icon code to emoji

**API Integration:**
```
POST /api/weather
Body: { city: "Austin, TX" }

Response:
{
  temp: 72,
  feelsLike: 68,
  description: "clear sky",
  icon: "01d",
  cityName: "Austin"
}
```

**Icon Mapping (lines 1690-1712):**
- 01d: ☀️ (clear day)
- 01n: 🌕 (clear night)
- 02d: 🌤️ (partly cloudy)
- 09d: 🌧️ (rain)
- 11d: ⛈️ (thunderstorm)
- 13d: ❄️ (snow)
- 50d: 🌫️ (fog)
- And more...

**UI Display:**
- Large weather emoji (text-4xl)
- Temperature in Fahrenheit
- "Feels like" temperature
- Description (capitalized)

---

### Feature 6: Local News Aggregation

**Location:**
- Frontend: [src/app/page.tsx:409-441](src/app/page.tsx#L409-L441)
- Backend: [src/app/api/news/route.ts](src/app/api/news/route.ts)

**Description:**
Intelligent local news fetching with content filtering and nearby city fallback.

**Smart Features:**

1. **Intelligent Filtering (lines 23-60):**
   - **Filters out negative content:** death, murder, shooting, tragedy, etc.
   - **Filters out non-local sports:** NCAA tournament, bowl games, college football playoff
   - **Prioritizes local topics:** city council, school district, downtown, festivals, etc.
   - Scoring system: More local keywords = higher score = appears first

2. **Geographic Fallback:**
   - Try to fetch news for requested city
   - If < 3 articles found, search nearby cities within 75 miles
   - Prioritizes larger cities (100k+ population)
   - Combines results, removes duplicates
   - Shows badge: "from Denver, CO" if using nearby city

3. **API Query:**
   ```
   GET /api/news?city=Austin, TX

   Response:
   {
     articles: [
       {
         title: "Austin City Council approves...",
         description: "...",
         url: "https://...",
         urlToImage: "https://...",
         publishedAt: "2025-12-10T...",
         source: { name: "Austin American-Statesman" }
       }
     ],
     sourceCity: "Austin, TX",
     originalCity: "Austin, TX",
     isNearbyFallback: false
   }
   ```

4. **Content Quality:**
   - Fetches 50 articles, filters to best 5
   - Skips [Removed] content
   - Requires both title and description

**UI Display:**
- Shows top 5 articles
- Thumbnail image (if available)
- Article title (clickable link)
- Description preview
- Source name + publish date
- Hover effect: pink border

---

### Feature 7: Events Calendar

**Location:**
- Frontend: [src/app/page.tsx:666-705](src/app/page.tsx#L666-L705), [lines 839-891](src/app/page.tsx#L839-L891), [lines 2076-2132](src/app/page.tsx#L2076-L2132)
- Backend: [src/app/api/events/route.ts](src/app/api/events/route.ts)

**Description:**
Community calendar for local events with Google Maps integration.

**Features:**
- View upcoming events for city
- Create new events (title, location, datetime)
- Click event → opens in Google Maps
- Sorted by start time (soonest first)

**Create Event Flow:**
1. User fills form:
   - Event title (required)
   - Location (optional)
   - Start time (datetime-local picker)
2. Submit → POST /api/events
3. Server validates required fields
4. Inserts into Supabase events table
5. Returns created event
6. Client adds to local state (optimistic update)

**API Endpoints:**
```
GET /api/events?city=Austin
→ Returns array of upcoming events

POST /api/events
Body: {
  city: "Austin",
  title: "Food Truck Festival",
  location: "123 Main St",
  starts_at: "2025-12-15T18:00"
}
→ Returns created event
```

**UI Features:**
- Only shows when "Events" tag filter is active
- Click event → Google Maps search
  - URL: `https://www.google.com/maps/search/?api=1&query=123+Main+St`
- Displays: title, datetime, location, description
- Empty state: "No upcoming events yet for {city}. Create one above."

---

### Feature 8: User Streaks & Gamification

**Location:** [src/app/page.tsx:534-623](src/app/page.tsx#L534-L623)

**Description:**
Tracks user's posting consistency with daily streaks and achievement badges.

**Streak Calculation:**
1. Fetch user's pulses from last 365 days
2. Extract unique posting dates (local timezone: en-CA format)
3. Sort dates newest → oldest
4. Count consecutive days working backwards from today:
   - If posted today: streak starts at 1
   - If posted yesterday but not today: streak starts at 1
   - For each prior consecutive day: increment streak
   - Stop at first gap
5. Return current streak count

**Example:**
```
User's posting dates: [Dec 10, Dec 9, Dec 8, Dec 6]
                                            ↑ gap
Today: Dec 10
Streak: 3 days (Dec 10, 9, 8)
```

**Badges (lines 1356-1372):**
```typescript
const badges = [
  {
    id: "first-pulse",
    name: "First Pulse",
    description: "Post 1 pulse",
    unlocked: userPulseCount >= 1
  },
  {
    id: "steady-vibes",
    name: "Steady Vibes",
    description: "Maintain a 3-day streak",
    unlocked: currentStreak >= 3
  }
];
```

**UI Display:**
- "Streak: 5 days 🔥" (if active streak)
- "Start a streak today!" (if no streak)
- "Sign in to track streaks" (if not logged in)
- Badge expandable: Shows locked/unlocked status
- Locked badges: 🔒 + grayed out
- Unlocked badges: ✨ + green border

---

### Feature 9: Anonymous Username System

**Location:**
- Frontend: [src/app/page.tsx:1196-1293](src/app/page.tsx#L1196-L1293)
- Backend: [src/app/api/username/route.ts](src/app/api/username/route.ts)
- Local Fallback Generator: [src/app/page.tsx:110-137](src/app/page.tsx#L110-L137)

**Description:**
AI-powered anonymous username generation based on user's mood description. Supports locking names permanently.

**Two-Tier Generation:**

**Tier 1 - AI Generation (Primary):**
- User describes vibe in 3+ words
- Sends to OpenAI GPT-4o-mini
- Prompt engineered to return PascalCase usernames
- Examples: "SleepyCaffeinatedOwl24", "ChaoticZenLlama87"
- Temperature: 0.9 (creative variety)
- Max tokens: 16 (one word only)

**Tier 2 - Local Fallback:**
- If API key missing or API fails
- Client-side generator in [page.tsx:110-137](src/app/page.tsx#L110-L137)
- Combines random mood + animal + number
- Example: "Chill Coyote 42"

**Features:**
1. **Edit Mode:**
   - Click "🎲 Edit vibe name" button
   - Enter 3+ words describing mood
   - Click "Roll 🎲"
   - New name generated and saved

2. **Undo:**
   - Previous name saved in `lastAnonName` state
   - "Undo" button appears after generation
   - Click → reverts to previous name

3. **Lock Name:**
   - Click "Lock this name" button
   - Sets `name_locked: true` in profiles table
   - Name becomes permanent
   - Edit button shows 🔒 lock icon
   - Cannot generate new names

**Database Updates:**
```typescript
// Generate new name
await supabase
  .from("profiles")
  .update({ anon_name: "NewUsername42" })
  .eq("id", userId);

// Lock name
await supabase
  .from("profiles")
  .update({ name_locked: true })
  .eq("id", userId);
```

**Validation:**
- Client enforces 3+ word minimum
- AI output sanitized: removes non-alphanumeric chars
- If AI returns invalid: falls back to local generator
- Name updates reflected immediately in UI

---

### Feature 10: City Autocomplete Search

**Location:**
- Frontend: [src/app/page.tsx:374-407](src/app/page.tsx#L374-L407), [lines 723-751](src/app/page.tsx#L723-L751)
- Data Source: [src/app/data/cities.ts](src/app/data/cities.ts)

**Description:**
Smart city search with autocomplete dropdown showing 200+ US cities with coordinates and population data.

**Data Structure (cities.ts):**
```typescript
export type City = {
  name: string;           // "Austin"
  state: string;          // "TX"
  displayName: string;    // "Austin, TX"
  lat: number;            // 30.2672
  lng: number;            // -97.7431
  population: number;     // 1000000
};

export const US_CITIES: City[] = [
  { name: "Houston", state: "TX", displayName: "Houston, TX", lat: 29.7604, lng: -95.3698, population: 2300000 },
  { name: "Austin", state: "TX", displayName: "Austin, TX", lat: 30.2672, lng: -97.7431, population: 1000000 },
  // ... 200+ more cities
];
```

**Search Algorithm (lines 564-588 in cities.ts):**
```typescript
export function searchCities(query: string, limit: number = 10): City[] {
  // 1. Find cities where name STARTS WITH query
  const startsWithMatches = US_CITIES.filter(city =>
    city.name.toLowerCase().startsWith(query) ||
    city.displayName.toLowerCase().startsWith(query)
  );

  // 2. Find cities where name CONTAINS query (but doesn't start with it)
  const containsMatches = US_CITIES.filter(city => {
    const inStartsWith = startsWithMatches.some(m => m.displayName === city.displayName);
    if (inStartsWith) return false;
    return city.name.toLowerCase().includes(query) ||
           city.displayName.toLowerCase().includes(query);
  });

  // 3. Combine and sort by population (larger cities first)
  const combined = [...startsWithMatches, ...containsMatches]
    .sort((a, b) => b.population - a.population);

  return combined.slice(0, limit);
}
```

**UI Features:**
1. **Live Suggestions:**
   - Type ≥2 characters → suggestions appear
   - Updates on every keystroke
   - Shows top 8 matches

2. **Smart Sorting:**
   - Prefix matches first (Austin matches "Aus" before Augusta)
   - Within matches: larger cities first
   - Shows population (1.0M, 500k, etc.)

3. **Keyboard Navigation:**
   - Enter: Select first suggestion
   - Escape: Close dropdown
   - Click outside: Close dropdown

4. **Visual Design:**
   - Dropdown with rounded corners
   - Hover effect on suggestions
   - Population badge in gray
   - Pink highlight on hover

5. **Nearby City Lookup (for news fallback):**
   ```typescript
   export function getNearbyCities(
     cityName: string,
     maxDistance: number = 50,  // miles
     minPopulation: number = 100000
   ): City[]
   ```
   - Uses Haversine formula for distance
   - Returns top 5 nearby cities sorted by population
   - Used by news API when local news unavailable

---

### Feature 11: Favorites / Bookmarks

**Location:** [src/app/page.tsx:627-665](src/app/page.tsx#L627-L665), [lines 894-936](src/app/page.tsx#L894-L936)

**Description:**
Users can save/favorite pulses for later reference.

**How It Works:**
1. Star icon (☆/★) appears on each pulse
2. Click star → toggle favorite status
3. Filled star (★) = favorited
4. Empty star (☆) = not favorited

**Database Operations:**
```typescript
// Add favorite
await supabase
  .from("favorites")
  .insert({ user_id: userId, pulse_id: pulseId });

// Remove favorite
await supabase
  .from("favorites")
  .delete()
  .eq("user_id", userId)
  .eq("pulse_id", pulseId);
```

**State Management:**
```typescript
// Load all favorites on login
useEffect(() => {
  const userId = sessionUser?.id;
  if (!userId) {
    setFavoritePulseIds([]);
    return;
  }

  async function loadFavorites() {
    const { data } = await supabase
      .from("favorites")
      .select("pulse_id")
      .eq("user_id", userId);

    setFavoritePulseIds(data.map(row => row.pulse_id));
  }

  loadFavorites();
}, [sessionUser]);
```

**UI Features:**
- Non-logged-in users → alert("Sign in to save favorites")
- Optimistic UI update (instant star toggle)
- Star color: yellow when favorited
- Persists across sessions

---

### Feature 12: Tag Filtering

**Location:** [src/app/page.tsx:2059-2074](src/app/page.tsx#L2059-L2074), [lines 1295-1298](src/app/page.tsx#L1295-L1298)

**Description:**
Filter pulse feed by topic tags: All, Traffic, Weather, Events, General.

**Implementation:**
```typescript
const TAGS = ["All", "Traffic", "Weather", "Events", "General"];

// Filter logic
const filteredPulses = pulses.filter(
  (p) => tagFilter === "All" || p.tag === tagFilter
);

// Render filtered list
{filteredPulses.map(pulse => <PulseCard {...pulse} />)}
```

**UI:**
- Pill-shaped buttons
- Active tag: Pink background, shadow
- Inactive tags: Gray background, hover effect
- Click tag → instant filter (no API call, client-side only)

**Special Behavior:**
- When "Events" tag selected → shows events calendar section
- Other tags → hides events, shows only pulses

---

### Feature 13: Authentication & Authorization

**Location:** [src/app/page.tsx:990-1194](src/app/page.tsx#L990-L1194), [lines 494-531](src/app/page.tsx#L494-L531)

**Description:**
Email/password authentication via Supabase Auth with profile management.

**Sign Up Flow:**
1. User clicks "Sign in" button → modal opens
2. Switch to "Create Account" tab
3. Enter email + password + confirm password
4. Client validates:
   - Email format (regex)
   - Password strength (8+ chars, upper, lower, number)
   - Passwords match
5. Call `supabase.auth.signUp()`
6. If email confirmation enabled → show "Check email" message
7. If auto-login → create profile with random username
8. Close modal, user logged in

**Sign In Flow:**
1. Enter email + password
2. Call `supabase.auth.signInWithPassword()`
3. Load profile from database
4. If no profile exists → create one (legacy user migration)
5. Load user's favorites, streak data
6. Close modal

**Password Validation (lines 970-988):**
```typescript
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}
```

**Session Management:**
- Session stored in Supabase Auth (httpOnly cookie)
- On page load: Check `supabase.auth.getUser()`
- If session valid → auto-login
- Logout: `supabase.auth.signOut()` → clear all user state

**Authorization:**
- Only logged-in users can post pulses
- Only logged-in users can favorite pulses
- Only logged-in users can generate usernames
- Non-logged-in users → "Sign in to post" prompt

---

### Feature 14: Local Storage Persistence

**Location:** [src/app/page.tsx:707-721](src/app/page.tsx#L707-L721)

**Description:**
Remembers user's selected city across sessions.

**Implementation:**
```typescript
// On mount: Load saved city
useEffect(() => {
  if (typeof window === "undefined") return;
  const savedCity = localStorage.getItem("cp-city");
  if (savedCity) {
    setCity(savedCity);
    setCityInput(savedCity);
  }
}, []);

// On city change: Save to localStorage
useEffect(() => {
  if (typeof window === "undefined") return;
  if (!city) return;
  localStorage.setItem("cp-city", city);
}, [city]);
```

**Benefits:**
- User returns to app → sees their city immediately
- No need to re-select city every visit
- Works offline (reading from cache)

---

## API Endpoints

### Summary Table

| Endpoint | Method | Auth Required | Purpose | Response Time |
|----------|--------|---------------|---------|---------------|
| `/api/city-mood` | GET | No | City mood analytics | ~200ms |
| `/api/events` | GET | No | List city events | ~150ms |
| `/api/events` | POST | No | Create event | ~200ms |
| `/api/news` | GET | No | Fetch local news | ~2-5s |
| `/api/summary` | POST | No | AI pulse summary | ~1-3s |
| `/api/traffic` | GET | No | Traffic estimation | ~800ms-2s |
| `/api/username` | POST | No | AI username gen | ~800ms-2s |
| `/api/weather` | POST | No | Weather data | ~500ms-1s |

### Detailed Endpoint Documentation

#### 1. GET /api/city-mood

**File:** [src/app/api/city-mood/route.ts](src/app/api/city-mood/route.ts)

**Query Params:**
- `city` (required): City name

**Response:**
```json
{
  "dominantMood": "😊",
  "scores": [
    { "mood": "😊", "count": 45, "percent": 60 },
    { "mood": "😐", "count": 20, "percent": 27 }
  ],
  "pulseCount": 75,
  "windowHours": 3
}
```

**Error Responses:**
- 400: Missing city parameter
- 500: Database error

**Caching:** None (real-time data)

---

#### 2. GET /api/events

**File:** [src/app/api/events/route.ts](src/app/api/events/route.ts)

**Query Params:**
- `city` (required): City name

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Food Truck Festival",
      "description": "Annual festival...",
      "location": "123 Main St",
      "category": "Food",
      "starts_at": "2025-12-15T18:00:00Z",
      "ends_at": null
    }
  ]
}
```

**Error Handling:**
- Returns empty array on error (graceful degradation)
- Status 200 even on DB error

---

#### 3. POST /api/events

**File:** [src/app/api/events/route.ts](src/app/api/events/route.ts)

**Request Body:**
```json
{
  "city": "Austin",
  "title": "Community Meetup",
  "description": "Optional description",
  "location": "Central Park",
  "category": "Social",
  "starts_at": "2025-12-20T14:00"
}
```

**Required Fields:**
- city, title, starts_at

**Response:**
```json
{
  "event": {
    "id": "new-uuid",
    "city": "Austin",
    "title": "Community Meetup",
    ...
  }
}
```

**Error Responses:**
- 400: Missing required fields
- 500: Database error

---

#### 4. GET /api/news

**File:** [src/app/api/news/route.ts](src/app/api/news/route.ts)

**Query Params:**
- `city` (required): City name (e.g., "Austin, TX")

**Response:**
```json
{
  "articles": [
    {
      "title": "Austin City Council approves...",
      "description": "The council voted...",
      "url": "https://...",
      "urlToImage": "https://...",
      "publishedAt": "2025-12-10T10:00:00Z",
      "source": { "name": "Austin American-Statesman" }
    }
  ],
  "sourceCity": "Austin, TX",
  "originalCity": "Austin, TX",
  "isNearbyFallback": false,
  "notConfigured": false
}
```

**Smart Features:**
- Content filtering (removes negative news)
- Local topic scoring
- Nearby city fallback
- Max 5 articles

**Error Handling:**
- If NEWS_API_KEY missing → `notConfigured: true`
- Returns empty array on error

**Cache:** 5 minutes (`next: { revalidate: 300 }`)

---

#### 5. POST /api/summary

**File:** [src/app/api/summary/route.ts](src/app/api/summary/route.ts)

**Request Body:**
```json
{
  "city": "Austin",
  "pulses": [
    {
      "mood": "😊",
      "tag": "Traffic",
      "message": "Roads are clear",
      "author": "ChillCoyote42",
      "createdAt": "10:30 AM"
    }
  ]
}
```

**Response:**
```json
{
  "summary": "Austin is experiencing smooth traffic conditions and pleasant weather."
}
```

**AI Configuration:**
- Model: gpt-4o-mini
- Temperature: 0.4
- Max tokens: 120
- Takes up to 30 pulses

**Error Responses:**
- 400: No pulses provided
- 500: OpenAI API error / API key missing

---

#### 6. GET /api/traffic

**File:** [src/app/api/traffic/route.ts](src/app/api/traffic/route.ts)

**Query Params:**
- `city` (required): City name

**Response:**
```json
{
  "level": "Moderate",
  "source": "ai",
  "pulseCount": 12
}
```

**Levels:** "Light", "Moderate", "Heavy"
**Sources:** "ai" (GPT-4o-mini), "heuristic" (keyword matching)

**Algorithm:**
1. Fetch last 60 minutes of pulses
2. Try AI classification (prioritizes recent 3-5 messages)
3. On AI failure → fallback to keyword heuristic
4. Apply time-of-day modifier (rush hour boost)

**Error Handling:**
- Returns `{ level: null, error: "..." }` on failure
- Status 200 (graceful degradation)

---

#### 7. POST /api/username

**File:** [src/app/api/username/route.ts](src/app/api/username/route.ts)

**Request Body:**
```json
{
  "prompt": "sleepy sarcastic overcaffeinated"
}
```

**Response:**
```json
{
  "username": "DrowsySarcasticCaffeinatedOwl24"
}
```

**Fallback Response (if AI fails):**
```json
{
  "username": "SleepySarcasticOvercaffeinated42",
  "error": "fallback_used"
}
```

**AI Configuration:**
- Model: gpt-4o-mini
- Temperature: 0.9 (creative)
- Max tokens: 16
- System prompt: PascalCase, no spaces, no emojis

**Validation:**
- Client enforces 3+ words minimum
- Server sanitizes output (alphanumeric only)

---

#### 8. POST /api/weather

**File:** [src/app/api/weather/route.ts](src/app/api/weather/route.ts)

**Request Body:**
```json
{
  "city": "Austin, TX"
}
```

**Response:**
```json
{
  "temp": 72,
  "feelsLike": 68,
  "description": "clear sky",
  "icon": "01d",
  "cityName": "Austin"
}
```

**External API:** OpenWeatherMap
- Endpoint: `/data/2.5/weather`
- Units: Imperial (Fahrenheit)
- Query format: "Austin,TX,US"

**Error Responses:**
- 400: Missing city
- 500: Weather API error / API key missing

---

## GUI Layout & Components

### Overall Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Sign In Button]                              (Top Right)  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  Community Pulse [Beta]        [City Selector]   │      │
│   │  Real-time vibes from your city                  │      │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   ┌────────────┬────────────┬────────────┐                  │
│   │  Weather   │ City Mood  │  Traffic   │  (Info Widgets) │
│   │   72°F     │    😊      │    🟢      │                  │
│   └────────────┴────────────┴────────────┘                  │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  📰 Local News                                   │      │
│   │  - Article 1                                     │      │
│   │  - Article 2                                     │      │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  Drop a pulse                          🟢 Live   │      │
│   │  ┌─────────────────────────────────────────┐     │      │
│   │  │ Streak: 3 days 🔥   Badges (1/2) 🏅    │     │      │
│   │  └─────────────────────────────────────────┘     │      │
│   │  [Mood: 😊] [Tag: Traffic]                      │      │
│   │  ┌────────────────────────────────────────┐      │      │
│   │  │ Message textarea (240 char max)        │      │      │
│   │  └────────────────────────────────────────┘      │      │
│   │                         [Post pulse ⚡] button   │      │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  AI Summary for Austin                           │      │
│   │  "Austin is experiencing smooth traffic..."      │      │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   [All] [Traffic] [Weather] [Events] [General]  (Filters)  │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  😊 Traffic     Roads are clear on I-35!         │      │
│   │  by ChillCoyote42              Austin · 10:30 AM │  ☆  │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  🤩 Weather     Beautiful sunset tonight         │      │
│   │  by HyperFalcon88              Austin · 10:25 AM │  ★  │
│   └──────────────────────────────────────────────────┘      │
│                                                              │
│   [More pulses...]                                          │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  Disclaimer: User-submitted content...           │      │
│   └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Header Section (lines 1617-1676)
- **Gradient Border:** Purple → Pink → Orange
- **Title:** "Community Pulse" with pink accent on "Pulse"
- **Beta Badge:** Amber badge, small, rounded
- **Tagline:** "Real-time vibes from your city. No doom scroll, just quick pulses."
- **City Selector:**
  - Autocomplete input
  - Dropdown suggestions (max 8)
  - Population badges
  - Keyboard navigation

#### 2. Info Widgets Grid (lines 1679-1799)
**3-column responsive grid:**

**Weather Widget:**
- Large emoji icon (4xl)
- Temperature display
- "Feels like" secondary temp
- Description text
- Loading/error states

**City Mood Widget:**
- Large dominant mood emoji
- Pulse count
- Top 3 moods with percentages
- Pill-shaped mood badges

**Traffic Widget:**
- Colored circle (🟢/🟡/🔴)
- Text label (Light/Moderate/Heavy)
- Loading/error states

#### 3. Local News Section (lines 1802-1880)
- Card layout with borders
- Article cards:
  - Thumbnail image (16×16 rounded)
  - Title (clickable)
  - Description preview (1 line truncate)
  - Source + date
  - Hover effect: pink border

#### 4. Post Pulse Card (lines 1883-2029)
**Not Logged In:**
- CTA: "Sign in to drop pulses and track your streak"
- Sign in button

**Logged In:**
- Streak display
- Badges dropdown
- Mood selector (6 emoji buttons)
- Tag dropdown (4 options)
- Message textarea
  - Placeholder: "What's the vibe right now?"
  - Character counter: X/240
  - Auto-resize
- Post button (disabled if empty)
- Validation errors inline

#### 5. AI Summary Section (lines 2032-2057)
- Card with border
- Auto-generated label
- Loading state: "Summarizing recent pulses…"
- Summary text in rounded box
- Empty state if no pulses

#### 6. Filter Chips (lines 2059-2074)
- 5 pills: All, Traffic, Weather, Events, General
- Active: Pink background + shadow
- Inactive: Gray background + hover effect
- Click → instant filter

#### 7. Events Calendar (lines 2076-2132)
**Only visible when "Events" tag active:**
- List of upcoming events
- Each event card:
  - Title (bold)
  - DateTime + location
  - Description (2-line truncate)
  - Category badge
  - Click → Google Maps

#### 8. Pulse Feed (lines 2135-2190)
**Loading State:**
- Dashed border box
- "Loading pulses for {city}…"

**Empty State:**
- Dashed border box
- "No pulses yet for {city}. Be the first to set the vibe."

**Pulse Cards:**
- Left: Mood emoji box + tag badge
- Right: Message text
- Bottom: Author name, city, time, favorite star
- Hover: Pink border + shadow
- Real-time updates (new pulses slide in at top)

#### 9. Auth Modal (lines 1376-1511)
**Overlay:** Black 60% opacity backdrop blur

**Modal:**
- Tabs: Sign In / Create Account
- Email input
- Password input
- Confirm password (sign up only)
- Password requirements hint
- Submit button
- Error messages (red box)
- Close button (×)

#### 10. Username Editor (lines 1561-1615)
**Expandable section (when logged in):**
- Prompt input (3+ words)
- "Roll 🎲" button
- "Undo" button (if lastAnonName exists)
- "Lock this name" button
- Current name display
- Error messages

### Design System

**Colors:**
- Background: slate-950 (very dark blue-gray)
- Cards: slate-900/80 (dark with transparency)
- Borders: slate-800
- Text: slate-50 (off-white)
- Accent: pink-500
- Secondary: slate-400

**Typography:**
- Font: System font stack (default)
- Sizes: text-xs (10px) to text-4xl (36px)
- Weights: normal, medium, semibold

**Spacing:**
- Gap between sections: 6 (24px)
- Card padding: p-4 (16px) to p-6 (24px)
- Rounded corners: rounded-2xl (16px) to rounded-3xl (24px)

**Shadows:**
- Default: shadow-md
- Active elements: shadow-lg with pink tint

**Animations:**
- Transitions: transition class (all 150ms)
- Hover effects: scale, color, border
- Loading pulse: animate-pulse on status dot

---

## Environment Variables

### Required Variables

Create a `.env.local` file in the project root:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# OpenAI API (Required for AI features)
OPENAI_API_KEY=sk-proj-...

# OpenWeatherMap (Required for weather widget)
WEATHER_API_KEY=abc123...

# NewsAPI.org (Optional - app works without news)
NEWS_API_KEY=xyz789...
```

### Variable Details

**NEXT_PUBLIC_SUPABASE_URL**
- Source: Supabase project settings
- Format: `https://[project-id].supabase.co`
- Used by: Frontend + Backend
- Public: Yes (safe to expose)

**NEXT_PUBLIC_SUPABASE_ANON_KEY**
- Source: Supabase project settings → API → anon/public key
- Format: JWT token (very long string)
- Used by: Frontend + Backend
- Public: Yes (has Row-Level Security)

**OPENAI_API_KEY**
- Source: platform.openai.com → API keys
- Format: `sk-proj-...` or `sk-...`
- Used by: Backend only (server-side)
- Features requiring this:
  - AI pulse summary
  - AI traffic estimation
  - AI username generation
- Fallback: Local/heuristic methods if missing

**WEATHER_API_KEY**
- Source: openweathermap.org → API keys
- Format: Alphanumeric string
- Used by: Backend only
- Free tier: 1000 calls/day
- Fallback: "Weather data not available" message

**NEWS_API_KEY**
- Source: newsapi.org → Get API Key
- Format: Alphanumeric string
- Used by: Backend only
- Free tier: 100 requests/day
- Fallback: "News feature coming soon" message

### Variable Loading

Next.js automatically loads `.env.local` on:
- Development: `npm run dev`
- Build: `npm run build`
- Production: `npm start`

**Accessing in code:**
```typescript
// Frontend (must start with NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Backend (API routes)
const openaiKey = process.env.OPENAI_API_KEY;
```

---

## Development Setup

### Prerequisites
- Node.js 20+ (uses latest React features)
- npm or yarn
- Supabase account (free tier works)
- OpenAI API account (optional but recommended)
- OpenWeatherMap account (free tier)
- NewsAPI account (optional)

### Setup Steps

1. **Clone Repository:**
```bash
git clone [repository-url]
cd community-pulse
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Configure Supabase:**

Create project at supabase.com:
```bash
# Navigate to Supabase Dashboard
# Create new project
# Copy URL and anon key
```

Create tables:
```sql
-- Run in Supabase SQL Editor

-- Pulses table
CREATE TABLE pulses (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  mood TEXT NOT NULL,
  tag TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pulses_city ON pulses(city);
CREATE INDEX idx_pulses_created_at ON pulses(created_at);
CREATE INDEX idx_pulses_city_created ON pulses(city, created_at DESC);
CREATE INDEX idx_pulses_user_id ON pulses(user_id);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  anon_name TEXT NOT NULL,
  name_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
CREATE TABLE favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pulse_id BIGINT NOT NULL REFERENCES pulses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pulse_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_pulse ON favorites(pulse_id);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_sponsored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_city ON events(city);
CREATE INDEX idx_events_starts_at ON events(starts_at);
```

Enable Real-time:
```bash
# In Supabase Dashboard:
# Database → Replication → Enable "pulses" table
```

4. **Configure Environment Variables:**
```bash
# Create .env.local
cp .env.example .env.local

# Edit .env.local with your keys
```

5. **Run Development Server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

6. **Build for Production:**
```bash
npm run build
npm start
```

### Development Commands

```bash
# Development mode (hot reload)
npm run dev

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Production build
npm run build

# Start production server
npm start
```

### Troubleshooting

**Real-time not working:**
- Check Supabase Dashboard → Database → Replication
- Ensure "pulses" table is enabled
- Check browser console for WebSocket errors

**API calls failing:**
- Verify `.env.local` has correct keys
- Check API key quotas (OpenAI, Weather, News)
- Look at Network tab in browser DevTools

**TypeScript errors:**
- Run `npm install` to ensure all types are installed
- Check tsconfig.json matches Next.js 16 requirements

**Build errors:**
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

---

## Future Improvements

### Planned Features
1. **Map View:** Visual map showing pulse locations
2. **Push Notifications:** Browser notifications for new pulses
3. **Image Uploads:** Allow photos with pulses (via Supabase Storage)
4. **Moderation Dashboard:** Admin panel for content moderation
5. **Analytics:** Usage stats, popular cities, engagement metrics
6. **Mobile App:** React Native version for iOS/Android

### Technical Debt
1. **Component Refactoring:** Split 2200-line component into smaller modules
2. **State Management:** Consider Zustand/Jotai for global state
3. **Testing:** Add unit tests (Jest) and E2E tests (Playwright)
4. **Error Boundaries:** Add React error boundaries for graceful failures
5. **Accessibility:** Add ARIA labels, keyboard navigation improvements
6. **Performance:** Implement pagination for pulse feed (currently loads all)
7. **SEO:** Add meta tags, Open Graph, sitemap
8. **Caching:** Implement React Query for better cache management

---

## Conclusion

Community Pulse is a real-time, AI-enhanced social platform focused on hyperlocal content. Built with modern web technologies (Next.js 16, React 19, Supabase, OpenAI), it demonstrates:

- **Real-time communication** via WebSocket subscriptions
- **Serverless architecture** with Next.js API routes
- **AI integration** with graceful fallbacks
- **User authentication** and authorization
- **External API integration** (weather, news)
- **Responsive design** with Tailwind CSS
- **Type safety** with TypeScript

This documentation serves as a complete reference for developers and AI agents working on the project. For questions or contributions, refer to the source code locations referenced throughout this document.

**Last Updated:** December 10, 2025
**Version:** Beta 0.1.0
**Maintainer:** Development Team
