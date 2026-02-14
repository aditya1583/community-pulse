# DEMOLITION PLAN — Controlled Demolition (Option A)

## Phase A1: Delete Dead API Routes (0 frontend references)
DELETE these — zero imports/fetches from any frontend code:

| Route | Lines | Reason |
|-------|-------|--------|
| /api/weather | 492 | Replaced by /api/pulse (bundled) |
| /api/traffic | 273 | Replaced by /api/pulse (bundled) |
| /api/traffic-live | 337 | Replaced by /api/pulse (bundled) |
| /api/air-quality | 103 | Never used |
| /api/checkin | 176 | Never used |
| /api/seed-vibes | 161 | Never used |
| /api/qr-code | 204 | Never used |
| /api/intelligent-seed | 617 | Never used (auto-seed handles this) |
| /api/admin | 847 | Never used from frontend |
| /api/health | 181 | Internal only, not needed |

**Total: ~3,391 lines deleted**

## Phase A2: Delete Dead Components + Their API Routes
These components are used but serve dead/legacy features:

| Component | Lines | Route(s) | Route Lines | Why Dead |
|-----------|-------|----------|-------------|----------|
| GasPricesCard | 329 | /api/gas-prices, /api/gas-stations | 397 | Gas removed per directive |
| SentimentHeatmap + HeatmapMapContent | ~400 | /api/heatmap | 277 | Dead feature |
| LiveVibes | 115 | /api/live-vibes | 115 | Dead feature |
| FarmersMarketsSection | (in LocalTab) | /api/farmers-markets | 624 | Refs in EventCard too |
| PredictionCard | 630 | (uses /api/pulses/vote) | 0 | Overengineered |

Remove GasPricesCard, SentimentHeatmap, HeatmapMapContent, LiveVibes from LocalTab + page.tsx imports.
**~2,000+ lines deleted**

## Phase A3: Consolidate API to /api/pulse (the one endpoint)
Currently page.tsx calls:
1. `/api/pulse` — bundled weather+traffic+feed ✅ KEEP (enhance)
2. `/api/pulses` — POST create pulse ✅ KEEP (rename to /api/pulse POST)
3. `/api/pulses/feed` — GET feed ✅ MERGE into /api/pulse
4. `/api/summary` — POST AI summary → MERGE into /api/pulse
5. `/api/city-mood` — GET mood → MERGE into /api/pulse
6. `/api/events` — GET+POST events ✅ KEEP (separate concern)
7. `/api/geocode` — GET+reverse ✅ KEEP (separate concern)
8. `/api/auth` — auth actions ✅ KEEP
9. `/api/username` — username ops ✅ KEEP

Target: home screen = 1 fetch (`/api/pulse`) + 1 events fetch + Realtime subscription

## Phase A4: Decompose page.tsx (3,032 → ~800 lines)
Extract into focused components/hooks:

| Section | Lines | Target |
|---------|-------|--------|
| AI Summary (347-450) | ~103 | hooks/useSummary.ts |
| City Mood (451-537) | ~86 | MERGE into /api/pulse response |
| Bundled fetch (553-629) | ~76 | hooks/useHomeData.ts |
| Streak/gamification (655-790) | ~135 | hooks/useStreak.ts (or delete) |
| Favorites (792-828) | ~36 | hooks/useFavorites.ts (or delete) |
| Events fetch (829-869) | ~40 | Already in useEvents hook |
| Storage restoration (870-953) | ~83 | hooks/useStorageRestore.ts |
| Geolocation sync (954-1019) | ~65 | Merge into useGeolocation |
| City handlers (1020-1097) | ~77 | hooks/useCitySearch.ts |
| Auto-seed (1098-1295) | ~197 | hooks/useAutoSeed.ts |
| Create event (1298-1350) | ~52 | Move to EventCard |
| Favorites toggle (1351-1394) | ~43 | hooks/useFavorites.ts |
| Username lock (1395-1467) | ~72 | hooks/useUsername.ts |
| Delete pulse (1424-1467) | ~43 | hooks/usePulses.ts |
| AI username gen (1468-1579) | ~111 | hooks/useUsername.ts |
| handleAddPulse (1621-1833) | ~212 | hooks/usePostPulse.ts |
| handleTabPulseSubmit (1834-2041) | ~207 | hooks/usePostPulse.ts |
| JSX (2152-3032) | ~880 | Split into TabContent components |

page.tsx becomes: import hooks → compose layout → render tabs

## Phase A5: Clean Up /api/pulses
/api/pulses has 3,761 lines across sub-routes. Keep only:
- POST /api/pulses (create pulse)
- /api/pulses/feed (feed query — or merge into /api/pulse)
- /api/pulses/[id]/react (vibe reactions)
- /api/pulses/[id]/comments (comments)
Delete: /api/pulses/[id]/vote, /api/pulses/[id]/resolution-vote (prediction feature dead)

## Execution Order
1. A1: Delete dead routes (safe, no refs) — ~3,391 lines
2. A2: Delete dead components + routes — ~2,000 lines
3. A3: Enhance /api/pulse, kill individual routes — ~1,500 lines
4. A4: Decompose page.tsx — net reduction ~2,000 lines
5. A5: Clean pulses sub-routes — ~500 lines

**Estimated total reduction: ~9,000-10,000 lines**
**page.tsx: 3,032 → ~800 lines**
**API routes: 31 → ~10**
**Home screen fetches: 9 → 2 (pulse + events)**
