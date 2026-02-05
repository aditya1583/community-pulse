# Cold Start & AI Content Quality Fix

## Problem
1. Content only generates when users visit empty cities (reactive)
2. Bot templates are bland/corporate ("PSA: Beautiful weather today!")
3. No local news integration
4. AI summaries depend on stale/missing data

## Solution Implemented

### 1. Cron Job for Proactive Seeding
**File:** `src/app/api/cron/seed-cities/route.ts`

Runs every 2 hours via Vercel Cron to seed fresh content for configured cities.

```
Schedule: 0 */2 * * * (every 2 hours on the hour)
Cities: Leander, Cedar Park, Austin (expandable)
```

**Setup required:**
- Add `CRON_SECRET` to Vercel env vars for security
- Cities are seeded with `intelligent-seed` in `cold-start` mode

### 2. Spicy Bot Templates
**File:** `src/lib/intelligent-bots/spicy-templates.ts`

New personality-driven templates that are actually entertaining:

**Traffic (The Complainer):**
- "183 is a parking lot rn. I've aged 3 years in the last mile. Who cursed this road? 🚗💀"
- "My car has been in park longer than drive today. This is fine. Everything is fine. 🔥"

**Weather (The Dramatic Local):**
- "It's 47°F and I've forgotten how cold works. Do I own a jacket? Unclear."
- "Rain in Texas which means everyone forgot how to drive. Stay safe out there 🌧️"

**Events (The Hype Person):**
- "{event} at {venue} on {date}. This is the one. You HAVE to go."
- "If you're not going to {event}, what ARE you doing with your weekend?"

**Local Intel:**
- "HEB parking lot is giving hunger games energy rn. Plan accordingly."
- "Costco gas line is {n} cars deep. Is it worth it? Math says yes. My patience says no."

### 3. Integration Steps

To use the new spicy templates, update `intelligent-bots/template-engine.ts`:

```typescript
import { 
  generateSpicyTrafficPost, 
  generateSpicyWeatherPost,
  generateSpicyEventPost,
  generateSpicyMarketPost 
} from './spicy-templates';

// Replace bland templates with spicy ones in generatePost()
```

## Still TODO

1. **Local News Integration**
   - Add NewsAPI or Google News RSS for local headlines
   - Feed to `/api/summary` endpoint
   - Estimated effort: 2-3 hours

2. **"Local Weird" Category**
   - Scrape city permits/noise complaints
   - Animal sighting reports
   - Unusual observations

3. **User-Generated Seed Prompts**
   - Let power users submit observations
   - Bots amplify/rephrase with personality

## Testing

Manual test the cron:
```bash
curl -X GET "http://localhost:3000/api/cron/seed-cities" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Check Vercel dashboard for cron execution logs after deploy.
