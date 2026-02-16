# Moderation Audit — Categories 1-10

**Date:** 2026-02-16
**Test file:** `src/lib/__tests__/moderationAuditCategories.test.ts`
**Result:** ✅ 48/48 tests pass

---

## Architecture Overview

The moderation system uses a **4-layer pipeline** (runs in order, short-circuits on block):

| Layer | Module | What it catches |
|-------|--------|----------------|
| Layer 0 — PII/Scam | `piiDetection.ts` | Email, phone, SSN, credit cards, addresses, social handles, contact intent, scams, spam |
| Layer 1 — Blocklist | `blocklist.ts` | Dynamic DB/env blocklist, dog whistles (1488, triple parens), sexual emoji, reversed text, Unicode homoglyphs |
| Layer 2 — Local Regex | `moderation.ts` | Profanity (explicit + leet speak + spaced-out + phonetic), harassment phrases, abuse patterns, solicitation, fuzzy edit-distance matching |
| Layer 3 — OpenAI API | `aiModeration.ts` | Multilingual content, context-aware detection, obfuscation the regex misses |

**Pipeline orchestrator:** `moderationPipeline.ts`
**Logging:** `moderationLogger.ts` → `ops_moderation_log` table (content hashes only, never raw text)

---

## Coverage by Endpoint

| Endpoint | PII | Blocklist | Regex | OpenAI | Notes |
|----------|-----|-----------|-------|--------|-------|
| `POST /api/pulses` | ✅ (blocking) | ✅ | ✅ | ✅ | Full pipeline. PII blocks; moderation flags with `needs_review` |
| `POST /api/pulses/[id]/comments` | ✅ (via pipeline) | ✅ | ✅ | ✅ | Full pipeline on message + username |
| `POST /api/auth/profile` | ✅ (via pipeline) | ✅ | ✅ | ✅ | Moderates display name |
| `POST /api/username` | — | ✅ | ✅ (profanity) | — | Blocklist + profanity check on input; AI output re-checked |

---

## Test Results by Category

### Category 1: Profanity & Slurs ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Common profanity | `fuck`, `bullshit`, `bitch` | ✅ BLOCKED |
| Leet speak | `f4ck`, `sh1t`, `b1tch`, `a$$` | ✅ BLOCKED |
| Spaced-out evasion | `f u c k`, `s.h.i.t`, `b i t c h` | ✅ BLOCKED |
| Racial slurs | n-word, f-slur, s-slur, c-slur | ✅ BLOCKED |
| Clean content | weather, traffic | ✅ ALLOWED |

### Category 2: Sexual Content ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Solicitation | `hookup`, `date anyone`, `send nudes`, `fwb` | ✅ BLOCKED |
| Explicit terms | `let's have sex`, `slutty` | ✅ BLOCKED |

### Category 3: Violence & Threats ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Direct threats | `I'll kill you`, `kill yourself`, `kys` | ✅ BLOCKED |
| Indirect threats | `hope you die`, `go die` | ✅ BLOCKED |

### Category 4: Harassment & Bullying ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Targeted insults | `retarded piece of shit`, `fuck off` | ✅ BLOCKED |
| Harassment phrases | `f u`, `f off`, `go fuck yourself` | ✅ BLOCKED |

### Category 5: Hate Speech ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Dog whistles | `1488` (via blocklist layer) | ✅ Detected |
| Triple parentheses | `(((target)))` (via blocklist layer) | ✅ Detected |
| Slur variants | n-word variants, k-slur, w-slur | ✅ BLOCKED |

### Bonus: Scam & Phishing ✅ (NEW)

| Test | Input Pattern | Result |
|------|--------------|--------|
| Money transfer | `send me money`, `venmo me $50` | ✅ BLOCKED |
| Crypto scams | `crypto pump`, `guaranteed returns`, `double your bitcoin` | ✅ BLOCKED |
| Phishing | `verify your account`, `click this link`, `claim your prize` | ✅ BLOCKED |
| Clean content | weather, traffic | ✅ ALLOWED |

### Bonus: PII Detection ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Email | `test@example.com` | ✅ BLOCKED |
| Credit card | `4111 1111 1111 1111` (Luhn valid) | ✅ BLOCKED |

### Bonus: Unicode Evasion ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Zero-width chars | `f\u200Buck` | ✅ BLOCKED |
| Cyrillic homoglyphs | `fu\u0441k` (Cyrillic с) | ✅ BLOCKED |

---

### Category 6: Dangerous Misinformation ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Medical misinfo | `drink bleach`, `vaccines cause autism`, `5g causes covid`, `miracle cure` | ✅ BLOCKED |
| Fake emergencies | `bomb at the school`, `active shooter at`, `there's a bomb` | ✅ BLOCKED |
| Election misinfo | `election is rigged`, `voting machines hacked`, `stop the steal` | ✅ BLOCKED |
| Clean content | weather, election encouragement | ✅ ALLOWED |

### Category 7: Spam & Manipulation ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Crypto pumps | `crypto pump` (via scam layer) | ✅ BLOCKED |
| Fake giveaways | `free iphone giveaway`, `like and share to win`, `tag 3 friends` | ✅ BLOCKED |
| Follow spam | `follow for follow`, `f4f` | ✅ BLOCKED |
| Clean content | community events | ✅ ALLOWED |

### Category 8: Personal Information Exposure ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Email | `test@example.com` | ✅ BLOCKED |
| Obfuscated email | `test (at) example (dot) com` | ✅ BLOCKED |
| SSN | `123-45-6789` with context | ✅ BLOCKED |
| Credit card | `4111 1111 1111 1111` (Luhn valid) | ✅ BLOCKED |
| Phone | `512-555-1234` with context | ✅ BLOCKED |
| Address | `123 Main Street` with context | ✅ BLOCKED |
| Social handles | `@myhandle` with platform context | ✅ BLOCKED |

### Category 9: Illegal Activity ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Drug sales | `selling weed`, `got molly for sale`, `plug for xans` | ✅ BLOCKED |
| Weapons | `ghost gun`, `selling guns no background` | ✅ BLOCKED |
| Stolen goods | `selling stolen phones`, `buy stolen laptops` | ✅ BLOCKED |
| Fake IDs | `buy fake ids`, `selling fake passport` | ✅ BLOCKED |
| Clean content | ordinance news, health events | ✅ ALLOWED |

### Category 10: Platform Manipulation ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Impersonation | `I'm the admin`, `official moderator`, `official admin announcement` | ✅ BLOCKED |
| Fake authority | `law enforcement warning`, `official statement from` | ✅ BLOCKED |
| Clean content | casual admin/mod mentions | ✅ ALLOWED |

### Evasion Techniques ✅

| Test | Input Pattern | Result |
|------|--------------|--------|
| Zero-width chars | `f\u200Buck`, `s\u200Bh\u200Bi\u200Bt` | ✅ BLOCKED |
| Cyrillic homoglyphs | `fu\u0441k` (Cyrillic с), `\u0430sshole` (Cyrillic а) | ✅ BLOCKED |
| Emoji substitution | `🍆🍑💦` (sexual emoji combo) | ✅ BLOCKED |
| URL shorteners | `bit.ly/scam123` | ✅ BLOCKED |
| Spanish slurs | `pinche pendejo`, `hijo de puta` | ✅ BLOCKED |
| Hindi slurs | `chutiya`, `madarchod` | ✅ BLOCKED |

---

## Additional Protections (Not Tested Here)

These are handled by Layer 3 (OpenAI API) or Layer 1 (Blocklist):
- **Multilingual profanity** (Hindi, Telugu, Tamil, Spanish) — in `piiDetection.ts` SPAM_WORDS + Haiku system prompt
- **Doxxing / real names** — Haiku system prompt
- **Sexual emoji combos** — `blocklist.ts` detectSexualEmojiContext
- **Reversed text** — `blocklist.ts` reversed text check
- **Keyboard mashing / gibberish** — `piiDetection.ts` detectSpam

---

## Notes

- No actual slurs/profanity are stored in plain text in source — patterns use regex and normalized canonical forms
- The moderation pipeline is **non-blocking for pulses** (flagged content is inserted with `needs_review = true`) to avoid killing the social experience
- PII detection is **blocking** — PII never gets inserted
- Scam detection is **blocking** — scam content never gets inserted
- All moderation decisions are logged to `ops_moderation_log` with content hashes (never raw text)
