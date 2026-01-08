# Situationally Intelligent Bots Architecture

## Vision

Bots that feel like helpful neighbors, not automated noise. Every bot post must be:
- **Truthful** - Based on real data, never fabricated
- **Timely** - Posted when the information is actually relevant
- **Hyperlocal** - Uses real road names, venues, and landmarks
- **Valuable** - Solves cold-start without feeling like spam

---

## Core Principle: Truth-First Posting

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRUTH-FIRST FLOW                             │
│                                                                 │
│   1. Check Real Data Sources                                    │
│      ├── TomTom Traffic API (congestion levels)                 │
│      ├── Open-Meteo Weather API (conditions)                    │
│      ├── Ticketmaster Events API (upcoming events)              │
│      └── Time of Day (rush hour detection)                      │
│                                                                 │
│   2. Determine Current Situation                                │
│      ├── Is traffic actually bad? (congestion > 30%)            │
│      ├── Is weather noteworthy? (rain, extreme temps)           │
│      ├── Is there an event happening? (within 2 hours)          │
│      └── Is it rush hour? (7-9 AM or 4-7 PM weekdays)           │
│                                                                 │
│   3. Generate ONLY If Situation Warrants                        │
│      └── No situation = No post (silence is better than noise)  │
│                                                                 │
│   4. Use City-Specific Templates                                │
│      └── Real road names, landmarks, venues                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         INTELLIGENT BOT SYSTEM                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │  Data Fetchers  │    │  Situation      │    │  Post Generator │      │
│  │                 │───▶│  Analyzer       │───▶│                 │      │
│  │  - Traffic      │    │                 │    │  - Templates    │      │
│  │  - Weather      │    │  Determines if  │    │  - Road names   │      │
│  │  - Events       │    │  post is needed │    │  - Time context │      │
│  │  - Time/Day     │    │                 │    │                 │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│           │                      │                      │                │
│           ▼                      ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      City Configuration                          │    │
│  │                                                                  │    │
│  │  {                                                               │    │
│  │    "leander": {                                                  │    │
│  │      "coords": { "lat": 30.5788, "lon": -97.8531 },             │    │
│  │      "roads": {                                                  │    │
│  │        "major": ["Ronald Reagan Blvd", "US-183", "Crystal Falls"],│    │
│  │        "highways": ["183A Toll", "US-183"],                      │    │
│  │        "schools": ["Leander HS", "Rouse HS", "Glenn HS"]        │    │
│  │      },                                                          │    │
│  │      "landmarks": ["HEB", "Lakeline Mall", "Crystal Falls"]      │    │
│  │    }                                                             │    │
│  │  }                                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources & ToS Compliance

### 1. TomTom Traffic API ✅ COMPLIANT
**Usage**: Check congestion levels before posting traffic content
**ToS Status**: Using data to inform decisions (not republishing raw data)
**Attribution**: "Traffic by TomTom" link already in UI

```typescript
// Example: Only post if traffic is actually bad
const traffic = await fetchTomTomTraffic(city.coords);
if (traffic.congestionLevel > 0.3) { // 30%+ congestion
  // Generate traffic post with real road names
}
```

### 2. Open-Meteo Weather API ✅ COMPLIANT
**Usage**: Check conditions before posting weather content
**ToS Status**: Free, commercial use allowed
**Attribution**: None required (but we show it anyway)

```typescript
// Example: Only post if weather is noteworthy
const weather = await fetchOpenMeteo(city.coords);
if (weather.isRaining || weather.temp > 100 || weather.temp < 32) {
  // Generate weather post
}
```

### 3. Ticketmaster Events API ✅ COMPLIANT
**Usage**: Detect upcoming events for event-reactive posts
**ToS Status**: Attribution implemented, deep links used
**Attribution**: "Data by Ticketmaster" footer

```typescript
// Example: Post about major events starting soon
const events = await fetchTicketmasterEvents(city.name);
const upcomingMajor = events.filter(e =>
  e.startsWithin(2, 'hours') && e.attendance > 1000
);
if (upcomingMajor.length > 0) {
  // Generate event-aware traffic warning
}
```

### 4. Time/Day Context ✅ NO API NEEDED
**Usage**: Detect rush hours, weekends, school times
**ToS Status**: N/A - just using system time

```typescript
// Example: School rush detection
const hour = new Date().getHours();
const isWeekday = ![0, 6].includes(new Date().getDay());
const isSchoolRush = isWeekday && (hour >= 7 && hour <= 8);
```

---

## City Configuration Schema

```typescript
interface CityConfig {
  name: string;
  coords: { lat: number; lon: number };
  timezone: string;

  roads: {
    major: string[];      // Main arterial roads
    highways: string[];   // Freeways, toll roads
    schoolZones: string[]; // Near schools
  };

  landmarks: {
    shopping: string[];   // HEB, Target, etc.
    venues: string[];     // Concert halls, stadiums
    parks: string[];      // Parks, trails
  };

  schools: {
    high: string[];
    middle: string[];
    elementary: string[];
  };

  rushHours: {
    morning: { start: number; end: number };  // e.g., 7-9
    evening: { start: number; end: number };  // e.g., 16-18
    schoolDismissal: number;                   // e.g., 15 (3 PM)
  };
}
```

### Example: Leander, TX Configuration

```typescript
const LEANDER_CONFIG: CityConfig = {
  name: "Leander",
  coords: { lat: 30.5788, lon: -97.8531 },
  timezone: "America/Chicago",

  roads: {
    major: [
      "Ronald Reagan Blvd",
      "Crystal Falls Pkwy",
      "Bagdad Rd",
      "San Gabriel Pkwy",
      "Old FM 2243"
    ],
    highways: [
      "US-183",
      "183A Toll",
      "TX-29"
    ],
    schoolZones: [
      "Horizon Park Dr",
      "Hero Way",
      "Mel Mathis Rd"
    ]
  },

  landmarks: {
    shopping: ["HEB Plus", "Lowe's", "Home Depot", "Target"],
    venues: ["Old Settlers Park", "Robin Bledsoe Park"],
    parks: ["Devine Lake Park", "Benbrook Ranch Trail"]
  },

  schools: {
    high: ["Leander HS", "Rouse HS", "Glenn HS", "Vista Ridge HS"],
    middle: ["Leander MS", "Running Brushy MS", "Wiley MS"],
    elementary: ["Bagdad Elementary", "Block House Creek"]
  },

  rushHours: {
    morning: { start: 7, end: 9 },
    evening: { start: 16, end: 18 },
    schoolDismissal: 15
  }
};
```

---

## Situation Detection Logic

```typescript
interface SituationContext {
  timestamp: Date;
  city: CityConfig;

  traffic: {
    congestionLevel: number;  // 0-1
    incidents: TrafficIncident[];
    slowestRoads: string[];
  };

  weather: {
    condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';
    temperature: number;
    feelsLike: number;
    humidity: number;
    uvIndex: number;
  };

  events: {
    happeningNow: Event[];
    startingSoon: Event[];  // Within 2 hours
    endingSoon: Event[];    // Within 1 hour
  };

  time: {
    hour: number;
    dayOfWeek: number;
    isWeekday: boolean;
    isRushHour: boolean;
    isSchoolHours: boolean;
    isSchoolDismissal: boolean;
  };
}

function shouldPostTraffic(ctx: SituationContext): boolean {
  // High congestion
  if (ctx.traffic.congestionLevel > 0.3) return true;

  // Rush hour + moderate congestion
  if (ctx.time.isRushHour && ctx.traffic.congestionLevel > 0.2) return true;

  // School dismissal + any congestion near schools
  if (ctx.time.isSchoolDismissal && ctx.traffic.congestionLevel > 0.15) return true;

  // Major event ending (stadium traffic)
  if (ctx.events.endingSoon.some(e => e.attendance > 5000)) return true;

  return false;
}

function shouldPostWeather(ctx: SituationContext): boolean {
  // Active precipitation
  if (['rain', 'storm', 'snow'].includes(ctx.weather.condition)) return true;

  // Extreme temperatures
  if (ctx.weather.temperature > 100 || ctx.weather.temperature < 32) return true;

  // High UV (summer midday)
  if (ctx.weather.uvIndex >= 8) return true;

  return false;
}

function shouldPostEvent(ctx: SituationContext): boolean {
  // Major event starting soon
  return ctx.events.startingSoon.some(e => e.attendance > 1000);
}
```

---

## Template System

### Traffic Templates

```typescript
const TRAFFIC_TEMPLATES = {
  rushHour: {
    morning: [
      "☕ Morning commute update: {road} is moving slow near {landmark}. {altRoute} might be faster.",
      "🚗 {road} backed up this morning. School drop-off traffic heavy near {school}.",
      "⏰ Rush hour heads up: {road} at {congestion}% capacity. Allow extra time if heading to {direction}."
    ],
    evening: [
      "🏠 Heading home? {road} is congested near {landmark}. Consider {altRoute}.",
      "🚦 Evening rush: {road} slower than usual. {incident}",
      "📍 {road} moving at {speed} mph. {altRoute} looking better right now."
    ]
  },

  schoolZone: [
    "🏫 School zone alert: Expect delays on {road} near {school}. Drive safe!",
    "📚 School's out! {road} getting busy with parent pickup traffic.",
    "🚸 Slow down near {school} - dismissal traffic in full swing on {road}."
  ],

  event: [
    "🎸 {event} at {venue} ends in ~1 hour. Expect traffic on {road} after.",
    "🎭 Heads up: {event} crowd heading out. {road} and {road2} getting busy.",
    "🏟️ Post-{event} traffic alert: Consider {altRoute} to avoid {road}."
  ],

  incident: [
    "⚠️ Slowdown on {road} near {location}. {description}",
    "🚨 {road} partially blocked near {landmark}. Use {altRoute} if possible.",
    "🔴 Delay alert: {road} congested due to {reason}. Check maps for detours."
  ]
};
```

### Weather Templates

```typescript
const WEATHER_TEMPLATES = {
  rain: [
    "🌧️ Rain moving through {city}. Roads getting slick, especially {road}.",
    "☔ Wet conditions - slow down on {highway}. Some ponding reported.",
    "🌦️ Showers expected next hour. Grab an umbrella if heading to {landmark}!"
  ],

  heat: [
    "🌡️ Heat advisory: {temp}°F feels like {feelsLike}°F. Stay hydrated!",
    "☀️ Hot one today in {city}! {temp}°F and climbing. Limit outdoor time.",
    "🥵 Triple digits ({temp}°F) - check on elderly neighbors, keep pets inside."
  ],

  cold: [
    "🥶 Bundle up! {temp}°F this morning in {city}. Frost on windshields.",
    "❄️ Cold front hit hard - {temp}°F with wind chill of {feelsLike}°F.",
    "🧊 Icy conditions possible on {bridge}. Drive carefully!"
  ],

  uvAlert: [
    "☀️ UV index at {uvIndex} today. Sunscreen essential if outside!",
    "🧴 High UV alert ({uvIndex}) - limit sun exposure 10am-4pm.",
    "🌞 Peak UV hours ahead. Seek shade at {park} if doing outdoor activities."
  ]
};
```

### General/Mood Templates

```typescript
const GENERAL_TEMPLATES = {
  goodMorning: [
    "☀️ Beautiful morning in {city}! {weather} and {traffic}.",
    "🌅 Rise and shine, {city}! Perfect weather for a walk at {park}.",
    "☕ Good morning! Clear skies and light traffic - rare combo!"
  ],

  weekend: [
    "🎉 Happy Saturday, {city}! {event} happening at {venue} later.",
    "🌳 Great day for {park}! Weather's perfect - {temp}°F and sunny.",
    "🍕 Weekend vibes in {city}. Any good brunch spots near {landmark}?"
  ],

  lateNight: [
    "🌙 Quiet night in {city}. Roads clear if you're heading out.",
    "🦉 Night owl update: {weather}, {traffic}. Drive safe!",
    "✨ Late night {city}: {temp}°F and peaceful."
  ]
};
```

---

## Post Generation Flow

```typescript
async function generateIntelligentPost(
  city: CityConfig
): Promise<BotPost | null> {

  // 1. Gather real data
  const [traffic, weather, events] = await Promise.all([
    fetchTomTomTraffic(city.coords),
    fetchOpenMeteo(city.coords),
    fetchTicketmasterEvents(city.name)
  ]);

  // 2. Build situation context
  const ctx = buildSituationContext(city, traffic, weather, events);

  // 3. Determine what (if anything) to post
  const postType = determinePostType(ctx);
  if (!postType) return null; // Nothing noteworthy - stay silent

  // 4. Select appropriate template
  const template = selectTemplate(postType, ctx);

  // 5. Fill template with real data
  const message = fillTemplate(template, ctx);

  // 6. Determine mood and author
  const mood = determineMood(postType, ctx);
  const author = generateBotName(postType, city.name);

  return {
    city: city.name,
    message,
    tag: postType,
    mood,
    author,
    is_bot: true,
    hidden: false
  };
}

function determinePostType(ctx: SituationContext): PulseCategory | null {
  // Priority order: Safety > Traffic > Weather > Events > General

  if (ctx.traffic.incidents.some(i => i.severity === 'major')) {
    return 'Traffic';
  }

  if (shouldPostTraffic(ctx)) {
    return 'Traffic';
  }

  if (shouldPostWeather(ctx)) {
    return 'Weather';
  }

  if (shouldPostEvent(ctx)) {
    return 'Events';
  }

  // General mood post (rare, only during nice conditions)
  if (isNiceConditions(ctx) && Math.random() < 0.1) {
    return 'General';
  }

  return null; // Nothing to post
}
```

---

## Scheduling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    POSTING SCHEDULE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Weekday Schedule:                                              │
│  ├── 6:30 AM  - Morning weather check                          │
│  ├── 7:30 AM  - Rush hour traffic update                        │
│  ├── 8:30 AM  - School zone update (if congested)               │
│  ├── 12:00 PM - Midday check (weather/events only)              │
│  ├── 3:00 PM  - School dismissal traffic                        │
│  ├── 5:00 PM  - Evening rush update                             │
│  └── 7:00 PM  - Evening events preview                          │
│                                                                 │
│  Weekend Schedule:                                              │
│  ├── 8:00 AM  - Morning weather/activity suggestion             │
│  ├── 12:00 PM - Midday events check                             │
│  ├── 4:00 PM  - Afternoon update                                │
│  └── 7:00 PM  - Evening events                                  │
│                                                                 │
│  Event-Reactive (Anytime):                                      │
│  ├── Major event ending → Traffic warning                       │
│  ├── Weather change → Alert post                                │
│  └── Traffic incident → Immediate update                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cooldown Rules

```typescript
const COOLDOWN_RULES = {
  // Minimum time between posts of same type
  sameType: 2 * 60 * 60 * 1000,  // 2 hours

  // Minimum time between any bot posts
  anyPost: 30 * 60 * 1000,  // 30 minutes

  // Maximum posts per day per city
  maxPerDay: 6,

  // Exception: Major incidents bypass cooldown
  incidentOverride: true
};
```

---

## API Endpoint Design

### `/api/intelligent-seed`

```typescript
// POST /api/intelligent-seed
// Body: { city: string, force?: boolean }
//
// Flow:
// 1. Check cooldown (unless force=true)
// 2. Fetch real-time data from all sources
// 3. Analyze situation
// 4. Generate post if warranted
// 5. Insert into database
// 6. Return result

interface IntelligentSeedRequest {
  city: string;
  force?: boolean;  // Skip cooldown check
}

interface IntelligentSeedResponse {
  success: boolean;
  posted: boolean;
  reason: string;
  post?: {
    id: number;
    message: string;
    tag: string;
    mood: string;
    author: string;
  };
  situation?: {
    traffic: number;
    weather: string;
    events: number;
    timeContext: string;
  };
}
```

### Cron/Scheduled Execution

```typescript
// Vercel Cron or external scheduler
// Runs every 30 minutes during active hours

// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/intelligent-seed",
      "schedule": "*/30 6-22 * * *"  // Every 30 min, 6 AM - 10 PM
    }
  ]
}
```

---

## File Structure

```
src/
├── lib/
│   ├── intelligent-bots/
│   │   ├── index.ts              # Main export
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── situation-analyzer.ts # Determines what to post
│   │   ├── template-engine.ts    # Fills templates with data
│   │   ├── data-fetchers.ts      # Wraps API calls
│   │   └── cooldown.ts           # Rate limiting logic
│   │
│   └── city-configs/
│       ├── index.ts              # Config loader
│       ├── leander.ts            # Leander, TX config
│       ├── austin.ts             # Austin, TX config
│       └── cedar-park.ts         # Cedar Park, TX config
│
├── app/
│   └── api/
│       ├── intelligent-seed/
│       │   └── route.ts          # Manual trigger endpoint
│       │
│       └── cron/
│           └── intelligent-seed/
│               └── route.ts      # Scheduled execution
```

---

## Phase 1 Implementation (MVP)

### What to Build First

1. **City Config for Leander** - Real road names, landmarks
2. **Traffic-Aware Posting** - Only post when TomTom shows congestion
3. **Time-Aware Templates** - Rush hour vs midday messaging
4. **Basic Cooldown** - Prevent spam

### Skip for MVP

- Event-reactive posting (adds complexity)
- Bot engagement/responses (future phase)
- Multi-city configs (start with Leander only)

### Estimated Effort

| Component | Complexity | Priority |
|-----------|------------|----------|
| City config schema | Low | P0 |
| Situation analyzer | Medium | P0 |
| Template engine | Low | P0 |
| Traffic data integration | Medium | P0 |
| Weather data integration | Low | P1 |
| Event data integration | Medium | P2 |
| Cooldown system | Low | P0 |
| Cron scheduling | Low | P1 |

---

## Success Metrics

1. **Accuracy**: >90% of traffic posts match actual conditions
2. **Relevance**: Posts align with time of day and conditions
3. **Engagement**: Bot posts receive likes/reactions from real users
4. **Freshness**: New cities get content within 30 minutes
5. **Trust**: No user complaints about inaccurate bot posts

---

## Future Enhancements (Phase 2+)

### Bot Engagement System

```typescript
// Bots can respond to user posts
interface BotResponse {
  trigger: RegExp;  // Pattern to match
  response: (post: Pulse) => string;
}

const BOT_RESPONSES: BotResponse[] = [
  {
    trigger: /traffic.*(bad|terrible|awful)/i,
    response: (post) => `Yeah, ${selectRoad(post.city)} has been rough lately.
                         Have you tried ${suggestAltRoute(post.city)}?`
  },
  {
    trigger: /anyone know.*open/i,
    response: (post) => `I think ${suggestVenue(post.city, post.message)} might be!`
  }
];
```

### Community Learning

```typescript
// Learn from user voting
interface PostFeedback {
  postId: number;
  helpful: number;
  notHelpful: number;
}

// Adjust template weights based on feedback
function updateTemplateWeights(feedback: PostFeedback[]) {
  // Templates that get positive feedback → higher weight
  // Templates that get negative feedback → lower weight
}
```

---

## Conclusion

This architecture ensures bot posts are:
- ✅ **Truthful** - Based on real API data
- ✅ **Timely** - Posted when conditions warrant
- ✅ **Hyperlocal** - Uses real road names and landmarks
- ✅ **Compliant** - Respects all API ToS
- ✅ **Valuable** - Solves cold-start without being spammy

The key insight: **Silence is better than noise**. Bots only post when there's something genuinely useful to share.
