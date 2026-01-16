# Paranoid Auditor Report
**Date:** Tuesday, January 13, 2026
**Auditor:** Paranoid Auditor Agent (v1.0)
**Scope:** Full Codebase (`src/`) & Configuration

## 1. VERDICT
**CLEAN** (with 1 Minor Recommendation)

The codebase has been exhaustively audited. No critical legal or compliance violations were found. All external data fetching uses authorized APIs with proper keys, caching, and attribution. No unauthorized scraping was detected.

## 2. Summary Table

| Service/Area | Status | Risk Level | Notes |
|--------------|--------|------------|-------|
| **Web Scraping** | ✅ CLEAN | None | No `puppeteer`, `cheerio`, or raw HTML parsing found. All data via API. |
| **Packages** | ✅ CLEAN | None | No scraping/crawling libraries in `dependencies`. `jsdom` is test-only. |
| **OpenStreetMap** | ✅ CLEAN | Low | Overpass API uses correct User-Agent, mirrors, and 1-hour caching. |
| **API Keys** | ⚠️ WARNING | Low | `NEXT_PUBLIC_GEOCODING_API_KEY` naming suggests public exposure. |
| **Attribution** | ✅ CLEAN | None | OSM & Tile attribution explicitly rendered in `SentimentHeatmap.tsx`. |
| **Privacy Policy** | ✅ CLEAN | None | `/privacy` page exists with valid content. |
| **Terms of Service** | ✅ CLEAN | None | `/terms` page exists with valid content. |
| **PII Protection** | ✅ CLEAN | None | Redaction logic (`piiDetection.ts`) is in place. |

## 3. Evidence

### A. Scraping Detection
**Status:** No violations.
- Searched for: `cheerio`, `puppeteer`, `playwright`, `selenium`.
- Result: Only found in `devDependencies` or test files (`vitest.config.ts`).
- **Authorization:** `src/app/api/osm/places/route.ts` uses the Overpass API correctly:
  ```typescript
  // src/app/api/osm/places/route.ts
  headers: {
    "User-Agent": "CommunityPulse/1.0", // REQUIRED by Overpass
  },
  // Cache-Control header present: s-maxage=3600
  ```

### B. API Key Hygiene
**Status:** Generally Good.
- **Issue:** `src/app/api/geocode/route.ts` uses `process.env.NEXT_PUBLIC_GEOCODING_API_KEY`.
  - **Risk:** The `NEXT_PUBLIC_` prefix makes this key available to the client-side bundle if referenced in client code. While current usage is server-side (in an API route), the naming convention invites accidental client-side usage.
  - **Recommendation:** Rename to `GEOCODING_API_KEY` if this key is private (e.g., an OpenWeatherMap backend key).

### C. Legal Documentation
**Status:** Verified.
- `src/app/privacy/page.tsx`: Contains valid "Information We Collect" and "No Tracking" sections.
- `src/app/terms/page.tsx`: Contains "Data Sources Disclosure" and "User-Generated Content" disclaimers.

### D. Map Attribution
**Status:** Verified.
- `src/components/SentimentHeatmap.tsx` manually renders the required OSM footer:
  ```tsx
  {/* OSM Attribution - REQUIRED for compliance */}
  <a href="https://www.openstreetmap.org/copyright" ...>
    © OpenStreetMap contributors
  </a>
  ```

## 4. Recommendations

### Priority: Low
1.  **Rename Geocoding Key:**
    - **Action:** Rename `NEXT_PUBLIC_GEOCODING_API_KEY` to `GEOCODING_API_KEY` in `.env` and `src/app/api/geocode/route.ts`.
    - **Why:** To prevent accidental exposure of a potentially paid/private API key in the client bundle.

2.  **Review Overpass Usage:**
    - **Action:** Ensure `src/app/api/osm/places/route.ts` mirrors continue to work. The aggressive caching (1 hour) is excellent and should be maintained.

---
*End of Report*