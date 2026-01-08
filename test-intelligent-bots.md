# Testing Intelligent Bots - Morning Validation

## Step 1: Clear Existing Bot Posts

```sql
-- Run in Supabase SQL Editor
DELETE FROM pulses
WHERE city = 'Leander, TX'
AND is_bot = true;
```

## Step 2: Check API Keys

Verify these environment variables are set in `.env.local`:

```bash
TOMTOM_API_KEY=your_key_here
TICKETMASTER_CONSUMER_KEY=your_key_here
# Open-Meteo doesn't need a key
```

## Step 3: Test Intelligent Seed Endpoint

### Preview (doesn't create posts):
```bash
curl http://localhost:3000/api/intelligent-seed?city=Leander
```

**Expected response:**
- `configured: true`
- `wouldPost: true` or `false` depending on conditions
- `situationSummary` showing real traffic/weather data
- `previewPost` with REAL road names like "Ronald Reagan Blvd"

### Create Posts:
```bash
curl -X POST http://localhost:3000/api/intelligent-seed \
  -H "Content-Type: application/json" \
  -d '{"city": "Leander", "mode": "cold-start"}'
```

**Expected response:**
```json
{
  "success": true,
  "posted": true,
  "mode": "cold-start",
  "count": 3,
  "posts": [...],
  "situationSummary": "Traffic: Light | Weather: 45°F, clear | Time: morning rush hour"
}
```

## Step 4: Validate Posts in UI

Reload the app and check for:

### Bot Author Names (should be):
- ✅ "Leander Traffic Tipster"
- ✅ "Leander Road Reporter"
- ✅ "Leander Weather Watcher"
- ✅ "Leander Commute Buddy"

### Message Content (should include):
- ✅ Real roads: "Ronald Reagan Blvd", "Crystal Falls Pkwy", "183A Toll"
- ✅ Real landmarks: "HEB Plus", "Leander High School", "Lakeline Mall"
- ✅ Time context: "morning rush", "evening commute", etc.

### Should NOT see:
- ❌ "CommuteComplainer_Leander"
- ❌ "SafetyFirst_Leander"
- ❌ Generic "main road", "this city"

## Step 5: Check Server Logs

When you trigger the endpoint, watch for these logs:

```
[Auto-Seed] City "Leander" has intelligent bot config - using hyperlocal system
[IntelligentBots] Fetching real-time data...
[Auto-Seed] SUCCESS! Created 3 intelligent bot pulses for Leander, TX
```

If you see:
```
[Auto-Seed] Intelligent bots returned no posts: <reason>
```

Then it's falling through to generic system.

## Debugging Issues

### Issue: API returns no posts
**Check:** TomTom API key is valid
```bash
curl "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=30.5788,-97.8531&key=YOUR_KEY"
```

### Issue: Posts created but generic
**Check:** Server logs for "has intelligent bot config" message
**Check:** City name matches exactly: "Leander" (not "Leander, TX")

### Issue: Cooldown blocking
**Solution:** Add `force: true` to request:
```bash
curl -X POST http://localhost:3000/api/intelligent-seed \
  -H "Content-Type: application/json" \
  -d '{"city": "Leander", "mode": "cold-start", "force": true}'
```

## Expected Morning Rush Hour Posts

Since you'll test in the morning (~7-9 AM), you should see posts like:

> ☕ Morning heads up: Ronald Reagan Blvd is moving slow near HEB Plus. 183A Toll might save you some time.

> 🚗 Crystal Falls Pkwy backed up this morning - looks like everyone's heading the same way. Give yourself an extra 10.

> 🏫 School zone alert: Expect delays on Hero Way near Leander High School. Drive safe!

If you see these kinds of messages with REAL road names, it's working correctly!
