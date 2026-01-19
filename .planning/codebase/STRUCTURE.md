# Codebase Structure

**Analysis Date:** 2026-01-17

## Directory Layout

```
community-pulse/
├── .planning/           # GSD planning documents
│   └── codebase/        # Architecture analysis docs
├── lib/                 # Root-level shared utilities
│   └── supabaseClient.ts
├── public/              # Static assets (icons, manifest)
├── scripts/             # Build/deployment scripts
├── src/                 # Main source code
│   ├── app/             # Next.js App Router
│   │   ├── api/         # API Route Handlers
│   │   ├── bot-lab/     # Bot testing UI
│   │   ├── venue/[id]/  # Dynamic venue pages
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Main dashboard
│   ├── components/      # React components
│   │   └── __tests__/   # Component tests
│   ├── data/            # Static data (cities)
│   ├── hooks/           # Custom React hooks
│   │   └── __tests__/   # Hook tests
│   └── lib/             # Business logic
│       ├── __tests__/   # Lib tests
│       ├── constants/   # App constants
│       ├── geo/         # Geographic utilities
│       └── intelligent-bots/
│           └── city-configs/
├── supabase/            # Database migrations
├── docs/                # Documentation files
├── email-templates/     # Email HTML templates
└── Screenshots/         # UI screenshots
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layouts, API route handlers
- Key files: `page.tsx` (main dashboard), `layout.tsx` (root layout)

**`src/app/api/`:**
- Purpose: Server-side REST API endpoints
- Contains: Route handlers organized by resource (pulses, weather, events, gamification)
- Key files: `pulses/route.ts` (pulse CRUD), `intelligent-seed/route.ts` (bot posting)

**`src/components/`:**
- Purpose: Reusable React UI components
- Contains: TSX components for dashboard, cards, inputs, navigation
- Key files: `PulseCard.tsx`, `PulseInput.tsx`, `types.ts` (shared types)

**`src/hooks/`:**
- Purpose: Custom React hooks for stateful logic
- Contains: Geolocation, gamification, events, push notifications hooks
- Key files: `useGamification.ts`, `useGeolocation.ts`, `useGeocodingAutocomplete.ts`

**`src/lib/`:**
- Purpose: Business logic and utilities
- Contains: Moderation, gamification, rate limiting, intelligent bots
- Key files: `moderationPipeline.ts`, `gamification.ts`, `rateLimit.ts`

**`src/lib/intelligent-bots/`:**
- Purpose: Situationally-aware bot content generation
- Contains: City configs, data fetchers, template engine, cooldown system
- Key files: `index.ts` (main API), `city-configs/austin.ts`, `data-fetchers.ts`

**`lib/`:**
- Purpose: Root-level shared client code
- Contains: Supabase client configuration
- Key files: `supabaseClient.ts` (anon key client)

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Main dashboard component (Pulse feed, tabs, real-time updates)
- `src/app/layout.tsx`: Root layout with fonts, footer, service worker registration
- `src/app/api/pulses/route.ts`: Pulse creation/deletion API

**Configuration:**
- `package.json`: Dependencies and scripts
- `next.config.ts`: Next.js configuration
- `tsconfig.json`: TypeScript configuration
- `vitest.config.ts`: Test runner configuration
- `eslint.config.mjs`: Linting rules
- `vercel.json`: Vercel deployment settings

**Core Logic:**
- `src/lib/moderationPipeline.ts`: Multi-layer content moderation
- `src/lib/piiDetection.ts`: PII detection (emails, phones, SSNs)
- `src/lib/gamification.ts`: XP, levels, tiers, badges logic
- `src/lib/rateLimit.ts`: Rate limiting with LRU store
- `src/lib/intelligent-bots/index.ts`: Bot posting orchestration

**Testing:**
- `src/lib/__tests__/`: Library unit tests
- `src/components/__tests__/`: Component tests
- `src/hooks/__tests__/`: Hook tests
- `src/app/api/gamification/__tests__/`: API route tests

## Naming Conventions

**Files:**
- Components: PascalCase (`PulseCard.tsx`, `AISummaryStories.tsx`)
- Hooks: camelCase with `use` prefix (`useGamification.ts`, `useGeolocation.ts`)
- Utilities: camelCase (`moderationPipeline.ts`, `rateLimit.ts`)
- API routes: `route.ts` in feature directories (`api/pulses/route.ts`)
- Tests: `*.test.ts` or `*.test.tsx` suffix in `__tests__/` directories
- Types: PascalCase in dedicated `types.ts` files

**Directories:**
- API routes: kebab-case (`intelligent-seed/`, `city-mood/`)
- Components: flat structure (no nested folders except `__tests__/`)
- Lib subdirs: kebab-case (`intelligent-bots/`, `city-configs/`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/lib/` for business logic, `src/components/` for UI
- Tests: Adjacent `__tests__/` directory (e.g., `src/lib/__tests__/newFeature.test.ts`)
- API endpoints: `src/app/api/feature-name/route.ts`

**New Component:**
- Implementation: `src/components/NewComponent.tsx`
- Types: Add to `src/components/types.ts` or create co-located types
- Tests: `src/components/__tests__/NewComponent.test.tsx`

**New API Endpoint:**
- Create directory: `src/app/api/endpoint-name/`
- Route file: `src/app/api/endpoint-name/route.ts`
- Dynamic routes: `src/app/api/endpoint-name/[id]/route.ts`

**New Hook:**
- Implementation: `src/hooks/useNewHook.ts`
- Tests: `src/hooks/__tests__/useNewHook.test.tsx`

**New City Configuration:**
- File: `src/lib/intelligent-bots/city-configs/newcity.ts`
- Export: Add to `src/lib/intelligent-bots/city-configs/index.ts`

**Utilities:**
- Shared helpers: `src/lib/newUtil.ts`
- Constants: `src/lib/constants/newConstant.ts`
- Geo utilities: `src/lib/geo/newGeoUtil.ts`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (during `npm run build` or dev server)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (during `npm install`)
- Committed: No (in .gitignore)

**`.planning/`:**
- Purpose: GSD command planning documents
- Generated: By GSD commands
- Committed: Yes

**`supabase/`:**
- Purpose: Database migrations and local dev config
- Generated: Partially (local dev state)
- Committed: Yes (migrations)

**`public/`:**
- Purpose: Static files served at root (icons, manifest, service worker)
- Generated: No
- Committed: Yes

**`Screenshots/`:**
- Purpose: UI screenshots for documentation
- Generated: Manually captured
- Committed: Yes

---

*Structure analysis: 2026-01-17*
