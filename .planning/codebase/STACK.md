# Technology Stack

**Analysis Date:** 2026-01-17

## Languages

**Primary:**
- TypeScript 5.x - All source code (`src/**/*.ts`, `src/**/*.tsx`)

**Secondary:**
- JavaScript - Configuration files (`eslint.config.mjs`, `postcss.config.mjs`)
- SQL - Database migrations (`supabase/migrations/*.sql`)

## Runtime

**Environment:**
- Node.js (version managed by project, ES2017 target)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.1 - React framework with App Router (`src/app/`)
- React 19.2.0 - UI library
- React DOM 19.2.0 - DOM rendering

**Testing:**
- Vitest 4.0.16 - Test runner (`vitest.config.ts`)
- Testing Library (React 16.1.0, jest-dom 6.5.0) - Component testing
- jsdom 25.0.0 - Browser environment simulation

**Build/Dev:**
- Tailwind CSS 4.x - Styling with PostCSS integration
- ESLint 9.x - Linting with next config
- React Compiler (babel-plugin-react-compiler 1.0.0) - React optimization

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.81.1 - Database client, authentication, real-time subscriptions
- `@anthropic-ai/sdk` 0.71.2 - Claude AI for content moderation
- `openai` 6.9.1 - OpenAI API for moderation and content classification
- `next` 16.1.1 - Framework core, routing, API routes, SSR

**Infrastructure:**
- `web-push` 3.6.7 - Push notification VAPID authentication
- `leaflet` 1.9.4 + `react-leaflet` 5.0.0 - Interactive maps
- `dotenv` 17.2.3 (dev) - Environment variable loading for scripts

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: ES2017
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Module resolution: bundler
- JSX: react-jsx

**Next.js (`next.config.ts`):**
- React Compiler enabled (`reactCompiler: true`)

**Vitest (`vitest.config.ts`):**
- Environment: jsdom
- Globals enabled
- Setup file: `vitest.setup.ts`
- Test pattern: `**/__tests__/**/*.{test,spec}.{ts,tsx}`
- Path alias: `@` to `./src`

**Environment:**
- `.env.local` - Local development secrets (git-ignored)
- `.env.example` - Template with all required variables documented
- Required for production: Supabase keys, AI keys, VAPID keys

**Build:**
- `postcss.config.mjs` - PostCSS with Tailwind
- `eslint.config.mjs` - ESLint 9 flat config with Next.js rules

## Platform Requirements

**Development:**
- Node.js with npm
- Access to Supabase project (cloud or local)
- AI API keys (OpenAI required, Anthropic for moderation)

**Production:**
- Vercel deployment (`vercel.json` with cron jobs)
- Supabase hosted database
- Environment variables configured in Vercel dashboard

## Scripts

**Package.json:**
```bash
npm run dev      # Next.js development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run test     # Vitest
```

**Utility Scripts:**
- `scripts/generate-vapid-keys.js` - Generate VAPID key pairs for push notifications

## Deployment

**Platform:** Vercel

**Cron Jobs (`vercel.json`):**
- `/api/notifications/trigger` - Every 15 minutes
- `/api/notifications/daily-prompts` - Multiple daily schedules (weekdays at 1:30pm, daily at 6pm, midnight, weekends at 4pm)
- `/api/cron/refresh-content` - Every 30 minutes (content seeding)

---

*Stack analysis: 2026-01-17*
