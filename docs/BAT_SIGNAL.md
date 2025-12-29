# Bat Signal - Smart Geo-Alert System

> Users shouldn't have to remember to open the app. The app should buzz their pocket when something worth knowing is happening.

## Overview

The Bat Signal is a push notification system that creates the "gossip factor" - users checking the app because something is HAPPENING, not because they remembered to.

## Smart Notification Triggers

### 1. Vibe Velocity (Spike Alerts)

**Trigger:** Pulses per hour spikes by 200%+ compared to the 7-day rolling average for that same hour of day.

**Message:** "Something is happening in Leander. Tap to see."

The spike detection is time-aware: a spike during rush hour is compared to other rush hours, not to 3am activity.

### 2. Vibe Shifts

**Trigger:** City intensity shifts by 2+ levels (e.g., quiet -> buzzing, or active -> intense)

**Message:** "The vibe in Leander just shifted from Quiet to Buzzing. 15 people talking now."

### 3. Keyword Clustering

**Trigger:** 3+ people mention the same keyword within 1 hour

**Message:** "'Police' trending in Cedar Park. 5 people mentioned 'police' nearby. Tap to see."

**User Configuration:** Users add their own watch keywords (e.g., "police", "fire", "accident", "road closed")

### What We DON'T Do

- We don't spam users with every pulse
- We don't notify during quiet hours (configurable)
- We don't send more than 1 notification per type per hour

## Architecture

```
+------------------+     +--------------------+     +------------------+
|                  |     |                    |     |                  |
|   Pulse Created  | --> | Vibe Velocity      | --> | Check Thresholds |
|   (DB Trigger)   |     | Stats Updated      |     | & Subscribers    |
|                  |     |                    |     |                  |
+------------------+     +--------------------+     +------------------+
                                                            |
                                                            v
+------------------+     +--------------------+     +------------------+
|                  |     |                    |     |                  |
|   User Receives  | <-- | Web Push API       | <-- | Send Notification|
|   Notification   |     | (VAPID)            |     | (Filtered)       |
|                  |     |                    |     |                  |
+------------------+     +--------------------+     +------------------+
```

## Database Tables

### `notification_preferences`

User notification settings per city:
- `vibe_shifts_enabled` - Enable vibe shift alerts
- `spike_alerts_enabled` - Enable spike alerts
- `keyword_alerts_enabled` - Enable keyword clustering
- `alert_keywords` - Array of keywords to watch
- `quiet_hours_start/end` - Don't disturb window
- `timezone` - For quiet hours calculation

### `push_subscriptions`

Web Push subscription data:
- `subscription` - VAPID subscription JSON
- `is_active` - Whether subscription is valid
- `consecutive_failures` - For cleanup of dead subscriptions

### `vibe_velocity_stats`

Hourly pulse activity per city:
- `pulse_count` - Pulses in this hour
- `rolling_avg_7d` - 7-day rolling average
- `dominant_mood` - Most common mood
- `vibe_intensity` - Calculated intensity level

### `notification_log`

Sent notifications for analytics and rate limiting:
- `notification_type` - spike_alert | vibe_shift | keyword_cluster
- `status` - pending | sent | delivered | failed | clicked
- `payload` - Full notification content

## API Endpoints

### `POST /api/notifications/subscribe`

Subscribe to push notifications for a city.

```typescript
{
  subscription: PushSubscriptionJSON,  // From browser's pushManager.subscribe()
  city: "Austin, TX",
  preferences?: {
    vibe_shifts_enabled?: boolean,
    spike_alerts_enabled?: boolean,
    keyword_alerts_enabled?: boolean,
    alert_keywords?: string[],
    quiet_hours_start?: "22:00",
    quiet_hours_end?: "07:00",
  }
}
```

### `GET/PUT /api/notifications/preferences`

Manage notification preferences.

### `POST /api/notifications/trigger`

Trigger notification checks (called by Vercel Cron every 15 minutes).

## Setup

### 1. Generate VAPID Keys

```bash
node scripts/generate-vapid-keys.js
```

Add to `.env.local`:
```
VAPID_PUBLIC_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hello@communitypulse.app
```

### 2. Run Database Migration

Apply the migration file:
```
supabase/migrations/20241227_bat_signal_notifications.sql
```

### 3. Configure Cron Secret

Add to environment:
```
CRON_SECRET=your-secure-random-string
```

### 4. Deploy

The `vercel.json` file configures a cron job to run every 15 minutes:
```json
{
  "crons": [
    {
      "path": "/api/notifications/trigger",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Client Integration

### Using the Hook

```tsx
import { usePushNotifications } from "@/hooks/usePushNotifications";

function NotificationBell({ city }: { city: string }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
  } = usePushNotifications(city, getAuthToken);

  if (!isSupported) return null;

  return (
    <button onClick={() => isSubscribed ? unsubscribe() : subscribe()}>
      {isSubscribed ? "Unwatch" : "Watch"} {city}
    </button>
  );
}
```

### Using the Settings Component

```tsx
import NotificationSettings from "@/components/NotificationSettings";

<NotificationSettings
  city={selectedCity}
  getAuthToken={getAuthToken}
  isAuthenticated={!!user}
/>
```

## Platform Compatibility

- **Windows:** Fully supported (web app, not native)
- **macOS:** Fully supported
- **Linux:** Fully supported
- **iOS Safari:** Supported in iOS 16.4+
- **Android Chrome:** Fully supported

## Rate Limiting

- **Spike alerts:** 1 per hour per city per user
- **Vibe shifts:** 1 per 30 minutes per city per user
- **Keyword clusters:** 1 per hour per keyword per user

Rate limiting is enforced both client-side (for immediate feedback) and server-side (authoritative).

## Testing

Run the test suite:
```bash
npm test -- --run src/lib/__tests__/batSignal.test.ts
```

Test the trigger endpoint manually:
```bash
curl -X POST http://localhost:3000/api/notifications/trigger \
  -H "Content-Type: application/json" \
  -d '{"city": "Austin, TX"}'
```

## Files Created

```
src/lib/batSignal.ts                           # Core detection logic
src/lib/pushNotifications.ts                   # Web Push service
src/hooks/usePushNotifications.ts              # Client-side hook
src/components/NotificationSettings.tsx        # Settings UI
src/app/api/notifications/subscribe/route.ts   # Subscribe endpoint
src/app/api/notifications/preferences/route.ts # Preferences endpoint
src/app/api/notifications/trigger/route.ts     # Trigger endpoint
public/sw.js                                   # Service worker
supabase/migrations/20241227_bat_signal_notifications.sql
vercel.json                                    # Cron configuration
scripts/generate-vapid-keys.js                 # VAPID key generator
docs/BAT_SIGNAL.md                             # This documentation
```
