# AI Content Rules — ETCHED IN STONE

## The Golden Rule
**ALL AI-generated content MUST come from real API data. ZERO fabricated content. Ever.**

## Allowed Content Types (API-sourced ONLY)

### Weather (1 post per refresh cycle)
- Source: **Open-Meteo API** with user's actual coordinates
- One weather thought — be intuitive, say something wise or funny
- Example: "72°F and sunny in Leander. Your lunch break wants to be outside today."
- MUST reference user's city name, NEVER a different city

### Events (max 2 per refresh cycle)
- Source: **Ticketmaster API** (or verified event APIs)
- Maximum 2 event summaries, one after the other
- MUST be non-redundant (different events, different venues)
- If only 1 real event exists, show 1. Don't pad with fake events.

### Traffic (API-sourced)
- Source: **TomTom Traffic API** with user's actual coordinates
- Real-time congestion and incident data only
- Reference actual local road names from city config

## BANNED Content Types
- ❌ **General** tag — REMOVED from system entirely
- ❌ Restaurant/business openings (hallucination risk)
- ❌ Construction updates (unless from real DOT API)
- ❌ School district news (unless from real calendar API)
- ❌ "Community vibes" or engagement bait posts
- ❌ ANY content not backed by a verifiable data source

## Non-Negotiable Rules
1. **No redundancy** — never post the same topic twice in a cycle
2. **No fabrication** — if there's no real data, show empty state
3. **City accuracy** — content MUST be geocoded to user's actual location
4. **Expiration** — Weather: 2h, Traffic: 2h, Events: 12h
5. **Max bot posts per city** — 7 (hard cap)

## Empty State
If no real API data exists for a location, show:
> "Your neighborhood is quiet right now. Be the first to share what's happening!"

Do NOT backfill with distant content or fabricated posts.

---
*Last updated: 2026-02-24 by Dude*
*This file exists because AI once posted a fake Thai restaurant. Never again.*
