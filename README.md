This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Content Moderation

This application uses a multi-layer moderation architecture with a **fail-closed guarantee** to ensure safe content posting.

### Fail-Closed Safety Guarantee (Non-Negotiable)

The moderation system enforces these invariants:

1. **If deterministic checks fail (PII/spam)** -> Reject (400), NO database insert
2. **If AI moderation blocks content** -> Reject (400), NO database insert
3. **If AI moderation errors/times out/missing API key** -> Reject (503), NO database insert
4. **Production ALWAYS fails closed** - The `MODERATION_FAIL_OPEN` env var is IGNORED in production

This ensures no path exists for unsafe content to enter the database, even under API failures.

### Layer A (Fast, Local)
- **PII Detection**: Blocks emails, phones, SSNs, credit cards, addresses, social handles
- **Dynamic Blocklist**: Server-side blocklist stored in Supabase for known problematic terms
- **Local Heuristics**: Fast regex-based checks for obvious English profanity and obfuscations

### Layer B (Authoritative, AI)
- **OpenAI Moderation API**: Primary AI classifier for multilingual, obfuscated, and contextual abuse
- **Google Perspective API** (optional): Supplementary toxicity signal for additional confidence

### Required Environment Variables

```bash
# REQUIRED: OpenAI API key for AI moderation
# Without this, ALL posting is blocked (fail-closed)
OPENAI_API_KEY=your-openai-api-key

# REQUIRED: Supabase service role key for server-side writes
# The API uses service role to bypass RLS for pulse creation
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# REQUIRED: Supabase connection (for blocklist and data)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Optional Environment Variables

```bash
# Fail-safe behavior (default: false = fail closed)
# IMPORTANT: This setting is IGNORED in production - production always fails closed
MODERATION_FAIL_OPEN=false

# API timeout in milliseconds (default: 2000)
MODERATION_TIMEOUT_MS=2000

# Harassment score threshold (default: 0.01)
MODERATION_HARASSMENT_SCORE_THRESHOLD=0.01

# General toxicity threshold (default: 0.5)
MODERATION_TOXICITY_THRESHOLD=0.5

# JSON blocklist fallback (if not using Supabase table)
MODERATION_BLOCKLIST_JSON='[{"phrase":"badword","severity":"block"}]'

# Enable Perspective API (optional secondary classifier)
PERSPECTIVE_API_KEY=your-perspective-api-key
PERSPECTIVE_TOXICITY_THRESHOLD=0.7
PERSPECTIVE_SEVERE_TOXICITY_THRESHOLD=0.5
PERSPECTIVE_TIMEOUT_MS=2000

# PII Detection options
PII_BLOCK_SOCIAL_HANDLES=true    # Block @handles and social media links
PII_ALLOW_NAMES=false            # Block "my name is X" patterns
```

### Database Migration

Run the migration to create the `moderation_blocklist` table:

```bash
# Apply the migration
supabase db push
```

Or manually apply `supabase/migrations/20241216_moderation_blocklist.sql`.

### Adding Terms to Dynamic Blocklist

1. **Via Supabase Dashboard**: Insert rows into the `moderation_blocklist` table
2. **Via Service Role API**: Use the Supabase admin API with service role key
3. **Via Environment Variable**: Set `MODERATION_BLOCKLIST_JSON` for simple deployments

Blocklist entries support:
- `phrase`: The term to block (normalized automatically)
- `language`: Optional language code
- `severity`: `block` (reject) or `warn` (log only)
