# Moderation Audit — Voxlo Content Moderation

**Date:** 2026-02-11
**Build:** Post-d5a9330
**Test Suite:** 261 tests (191 comprehensive + 70 audit-specific)
**Result:** ✅ ALL PASSING

---

## Architecture

| Layer | Engine | Catches | Latency |
|-------|--------|---------|---------|
| 1. Blocklist | Dynamic (Supabase + env fallback) | Known terms, multilingual slurs | <1ms |
| 2. Local Heuristics | Regex + normalization | Profanity, leet speak, spacing, unicode evasion | <1ms |
| 3. PII Detection | Pattern matching + Luhn | Email, phone, SSN, CC, addresses, social handles | <1ms |
| 4. AI Moderation | Claude Haiku | Context-aware: harassment, solicitation, threats, spam | ~500ms |
| 5. Perspective API | Google (optional) | Toxicity scoring supplement | ~300ms |

**Logging:** `ops_moderation_log` table (Supabase) — stores content hash, category, confidence, layer, action. Never stores raw content.

---

## Category 1: Profanity & Slurs ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "What the fuck is this" | BLOCK | BLOCK | local | ✅ PASS |
| "This is bullshit" | BLOCK | BLOCK | local | ✅ PASS |
| "You're a bitch" | BLOCK | BLOCK | local | ✅ PASS |
| "Holy shit that's hot outside" | BLOCK | BLOCK | local | ✅ PASS |
| "Damn this traffic" | BLOCK | BLOCK | local | ✅ PASS |
| "Go fuck yourself" | BLOCK | BLOCK | local | ✅ PASS |
| "Motherfucker cut me off" | BLOCK | BLOCK | local | ✅ PASS |
| **Leet speak:** "What the f4ck" | BLOCK | BLOCK | local | ✅ PASS |
| **Leet speak:** "Sh1t is crazy" | BLOCK | BLOCK | local | ✅ PASS |
| **Leet speak:** "B1tch please" | BLOCK | BLOCK | local | ✅ PASS |
| **Leet speak:** "@ss hole driver" | BLOCK | BLOCK | local | ✅ PASS |
| **Racial:** "He's a nigger" | BLOCK | BLOCK | blocklist | ✅ PASS |
| **Racial:** "Stupid faggot" | BLOCK | BLOCK | blocklist | ✅ PASS |
| **Racial:** "Go back wetback" | BLOCK | BLOCK | blocklist | ✅ PASS |
| _False positive:_ "Great weather today!" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "Traffic on 183 is terrible" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "The class was fun" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "Classic movie night" | ALLOW | ALLOW | — | ✅ PASS |

## Category 2: Sexual Content ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "Send nudes please" | BLOCK | BLOCK | local | ✅ PASS |
| "Let's have sex tonight" | BLOCK | BLOCK | local | ✅ PASS |
| "Looking for a hookup" | BLOCK | BLOCK | local | ✅ PASS |
| "FWB anyone?" | BLOCK | BLOCK | local | ✅ PASS |
| "Anyone up for a date" | BLOCK | BLOCK | local | ✅ PASS |
| _False positive:_ "Great date night restaurant" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "The park looks beautiful" | ALLOW | ALLOW | — | ✅ PASS |

## Category 3: Violence & Threats ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "I'll kill you" | BLOCK | BLOCK | local | ✅ PASS |
| "Go die in a fire" | BLOCK | BLOCK | local | ✅ PASS |
| "Kill yourself loser" | BLOCK | BLOCK | local | ✅ PASS |
| "Hope you die" | BLOCK | BLOCK | local | ✅ PASS |
| "kys nobody likes you" | BLOCK | BLOCK | local | ✅ PASS |
| _False positive:_ "The killer deal at Target" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "I'm dying to try that restaurant" | ALLOW | ALLOW | — | ✅ PASS |

## Category 4: Harassment & Bullying ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "Go fuck off" | BLOCK | BLOCK | local | ✅ PASS |
| "Fuck you asshole" | BLOCK | BLOCK | local | ✅ PASS |
| "F you dude" | BLOCK | BLOCK | local | ✅ PASS |
| "Go f off already" | BLOCK | BLOCK | local | ✅ PASS |
| _False positive:_ "Have a great day everyone" | ALLOW | ALLOW | — | ✅ PASS |

## Category 5: Hate Speech ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "Stupid [n-word] go back" | BLOCK | BLOCK | blocklist | ✅ PASS |
| "All [f-word slur] should die" | BLOCK | BLOCK | blocklist | ✅ PASS |
| "Kike bastards" | BLOCK | BLOCK | blocklist | ✅ PASS |
| "Dirty spics everywhere" | BLOCK | BLOCK | blocklist | ✅ PASS |
| "Chinks ruined the neighborhood" | BLOCK | BLOCK | blocklist | ✅ PASS |
| _False positive:_ "Love the diversity in this neighborhood" | ALLOW | ALLOW | — | ✅ PASS |

## Category 8: Personal Information (PII) ✅

| Input | Expected | Actual | Layer | Status |
|-------|----------|--------|-------|--------|
| "Email me at test@example.com" | BLOCK | BLOCK | pii | ✅ PASS |
| "My email is john (at) gmail (dot) com" | BLOCK | BLOCK | pii | ✅ PASS |
| "Call me at 512-555-1212" | BLOCK | BLOCK | pii | ✅ PASS |
| "My SSN is 123-45-6789" | BLOCK | BLOCK | pii | ✅ PASS |
| "Text me 5125551234" | BLOCK | BLOCK | pii | ✅ PASS |
| "IG is @coolperson" | BLOCK | BLOCK | pii | ✅ PASS |
| "DM me on instagram" | BLOCK | BLOCK | pii | ✅ PASS |
| _False positive:_ "Traffic on I-35 is bad" | ALLOW | ALLOW | — | ✅ PASS |
| _False positive:_ "The weather is 72 degrees" | ALLOW | ALLOW | — | ✅ PASS |

---

## Evasion Techniques ✅

### Leet Speak (5/5 passing)
- "f4ck this place" → BLOCKED ✅
- "sh1t is crazy" → BLOCKED ✅
- "b1tch a$$" → BLOCKED ✅
- "a$$hole driver" → BLOCKED ✅
- "wh0r3 trash" → BLOCKED ✅

### Spaced Out (4/4 passing)
- "f u c k you" → BLOCKED ✅
- "s.h.i.t" → BLOCKED ✅
- "b.i.t.c.h please" → BLOCKED ✅
- "a s s h o l e" → BLOCKED ✅

### Zero-Width Characters (2/2 passing)
- Profanity with ZW spaces inserted → BLOCKED ✅
- Profanity with ZW joiners → BLOCKED ✅

### Unicode Homoglyphs (1/1 passing)
- Cyrillic а substituted for Latin a → BLOCKED ✅

### Asterisk Masking (3/3 passing — comprehensive tests)
- "b*tch" → BLOCKED ✅
- "sh*t" → BLOCKED ✅
- "f**k" → BLOCKED ✅

### Transposed Letters (1/1 passing)
- "fukc" → BLOCKED ✅

### Multilingual Slurs (5/5 passing)
- Spanish: "Eres un pendejo" → BLOCKED ✅
- Spanish: "Pinche cabron" → BLOCKED ✅
- Spanish: "Tu eres puta" → BLOCKED ✅
- Hindi: "Chutiya sala" → BLOCKED ✅
- Hindi: "Madarchod benchod" → BLOCKED ✅

### Dog Whistles / Coded Hate (1/1 passing)
- "1488" → BLOCKED ✅

---

## Endpoints Covered

| Endpoint | Moderation | Status |
|----------|-----------|--------|
| POST /api/pulses | `runModerationPipeline()` | ✅ |
| POST /api/pulses/[id]/comments | `runModerationPipeline()` | ✅ |
| POST /api/username | `moderateContent()` | ✅ |
| POST /api/auth/profile | `runModerationPipeline()` | ✅ (added) |

## Infrastructure

- [x] `ops_moderation_log` Supabase table (migration created)
- [x] `moderationLogger.ts` — fire-and-forget logging, never blocks pipeline
- [x] Privacy: content hashed (SHA-256), never stored raw
- [x] RLS: service role only

## Categories 6-7, 9-10 (AI Layer)

Categories 6 (Dangerous Misinformation), 7 (Spam), 9 (Illegal Activity), and 10 (Platform Manipulation) are handled by the **Claude Haiku AI layer** which understands context and intent. These can't be reliably unit-tested locally (they require live API calls) but are covered by the AI moderation system prompt which explicitly lists all 10 categories.

---

**Next steps:**
- Run the `ops_moderation_log` migration on Supabase
- Monitor false positive rate in production
- Add Mandarin slur coverage to blocklist (currently relies on AI layer)
- Consider adding image text moderation when image posts are supported
