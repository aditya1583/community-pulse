# Community Pulse - Pending To-Dos

Last Updated: December 29, 2025

This document summarizes what you need to do before the v0.4.1 release is fully operational.

---

## CRITICAL: Database Migrations

These migrations MUST be run in Supabase SQL Editor before the features will work.

### Migration Order (Run in this sequence):

| # | Migration | Status | Description |
|---|-----------|--------|-------------|
| 1 | `20241228_ephemeral_pulses.sql` | Confirmed Done | Pulse expiry system |
| 2 | `20241228_gamification_system.sql` | **PENDING** | Leaderboards, XP, badges |
| 3 | `20241227_bat_signal_notifications.sql` | **PENDING** | Push notification subscriptions |
| 4 | `20241229_venue_vibes.sql` | **PENDING** | Venue vibe check system |

### How to Run:

1. Go to Supabase Dashboard > SQL Editor
2. Open each file from `supabase/migrations/`
3. Copy the contents and paste into SQL Editor
4. Click "Run"
5. Verify no errors

---

## Environment Variables

Add these to your `.env.local` file:

```env
# VAPID Keys for Push Notifications
# Generate with: node scripts/generate-vapid-keys.js
VAPID_PUBLIC_KEY=your_public_key_here
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here

# Cron job secret for scheduled tasks
CRON_SECRET=your_secure_random_string_here
```

### Generate VAPID Keys:

```bash
cd community-pulse
node scripts/generate-vapid-keys.js
```

This will output two keys. Copy them to your `.env.local` file.

---

## Vercel Configuration

### Cron Jobs

The `vercel.json` file configures automated tasks:

- **Bat Signal Check**: Runs every 15 minutes to detect notification triggers
- Path: `/api/notifications/trigger`

After deploying, verify the cron job is running in Vercel Dashboard > Settings > Cron Jobs.

---

## Feature Checklist

### Working Now (No Setup Required):
- [x] Emotion-based city vibes
- [x] UI improvements (FAB, Radar animation)
- [x] Shareable AI summary
- [x] Ephemeral pulse visual decay (frontend)

### Requires Database Migration:
- [ ] Gamification (leaderboards, badges, XP)
- [ ] Bat Signal notifications
- [ ] Venue vibe checks
- [ ] Ephemeral pulse auto-expiry (backend)

### Requires Environment Variables:
- [ ] Push notifications (VAPID keys)
- [ ] Cron jobs (CRON_SECRET)

---

## Testing Checklist

After running migrations and setting env vars:

1. **Gamification**
   - [ ] Open Status tab - should see leaderboard skeleton
   - [ ] Post a pulse - should see XP gained notification
   - [ ] Check leaderboard rankings

2. **Notifications**
   - [ ] Go to Settings in header
   - [ ] Enable push notifications
   - [ ] Browser should prompt for permission
   - [ ] Submit a test notification

3. **Venue Vibes**
   - [ ] Go to Local tab > Deals section
   - [ ] See "Vibe?" button on restaurant cards
   - [ ] Tap a vibe option
   - [ ] Should see success feedback

4. **Ephemeral Pulses**
   - [ ] Post a Traffic pulse
   - [ ] Should show expiry countdown
   - [ ] After 2 hours, pulse should auto-hide

---

## Optional: Future Enhancements Based on Feedback

The following suggestions from agent feedback are **not yet implemented** but are worth considering:

### 1. Gas Price Crowdsourcing
**Feedback:** Gas prices from EIA are statewide averages. Users could report actual prices at specific stations.

**Potential Implementation:**
- "Report Price" button on gas stations
- User submits: Station + Price + Grade
- Show "User reported $2.89 at Shell on Main St"

### 2. Farmers Market "Here Now" Feature
**Feedback:** Show which farmers markets have active users.

**Potential Implementation:**
- "I'm Here" button when at market
- Show real-time attendance: "5 people here now"
- Live produce availability reports

### 3. Neighborhood Micro-Vibes
**Feedback:** City-level vibes are too broad. Neighborhood-level would be more useful.

**Potential Implementation:**
- Detect user neighborhood from coordinates
- Show "Old Town is bustling" vs "Downtown is quiet"
- Hyperlocal pulse feeds

---

## Quick Reference

### Key Files:
- Changelog: `CHANGELOG_v0.4.md`
- Migrations: `supabase/migrations/`
- VAPID Generator: `scripts/generate-vapid-keys.js`
- Cron Config: `vercel.json`
- Bat Signal Docs: `docs/BAT_SIGNAL.md`

### Key Commands:
```bash
# Start dev server
npm run dev

# Generate VAPID keys
node scripts/generate-vapid-keys.js

# Run tests
npm test

# Build for production
npm run build
```

---

## Questions?

If you encounter issues:

1. Check Supabase logs for migration errors
2. Check browser console for API errors
3. Verify environment variables are set correctly
4. Check Vercel deployment logs

Good luck with the launch!
