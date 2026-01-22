# CONTINUITY.md

## Current Task
Fixing Next.js build error for iOS deployment (Capacitor).

## Status
- [.loki] structure initialized.
- Build failing on `/venue/[id]` dynamic route.

## Mistakes & Learnings
- Dynamic routes with `output: 'export'` require `generateStaticParams`.
- For Capacitor/SPA, client-side routing with query params is often more flexible than pre-rendering thousands of dynamic pages.

## Next Steps
1. Refactor `/venue/[id]` to `/venue/` with query params.
2. Update all components that link to venues.
3. Verify build locally or via simulated build check.
4. Update `.github/workflows/ios-build.yml` if needed.
