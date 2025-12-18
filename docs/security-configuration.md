# Security Configuration Guide

## Overview

Community Pulse uses a server-authoritative architecture for pulse creation. This means:

1. **Users CANNOT insert directly into the `pulses` table** - RLS policies block all direct user writes
2. **All writes go through `/api/pulses`** - The API validates auth, runs PII detection, and content moderation
3. **Server uses SERVICE ROLE key** - Only the server can bypass RLS to write pulses

This architecture prevents bypassing safety guardrails via direct database access.

## Required Environment Variables

### Server-side (Required)

```bash
# Supabase Service Role Key - REQUIRED for server-side writes
# Get this from Supabase Dashboard > Settings > API > service_role key
# WARNING: Never expose this client-side. Keep it in server environment only.
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key...

# OpenAI API Key - Required for AI content moderation
OPENAI_API_KEY=sk-...your-openai-key...
```

### Client-side (Required)

```bash
# Supabase Public URL and Anon Key - safe to expose client-side
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-anon-key...
```

### Optional Configuration

```bash
# PII Detection
PII_FAIL_OPEN=false            # "true" to allow content when PII detection fails (default: false)
PII_TIMEOUT_MS=1500            # Timeout for optional cloud DLP (default: 1500)
PII_BLOCK_SOCIAL_HANDLES=true  # "false" to allow @handles (default: true)
PII_ALLOW_NAMES=false          # "true" to allow "my name is" patterns (default: false)

# Content Moderation
MODERATION_FAIL_OPEN=false     # "true" to allow content when moderation fails (default: false)
MODERATION_TIMEOUT_MS=2000     # Timeout for AI moderation (default: 2000)
MODERATION_HARASSMENT_SCORE_THRESHOLD=0.01  # OpenAI harassment threshold (default: 0.01)

# Optional: Google Perspective API for additional toxicity detection
PERSPECTIVE_API_KEY=...your-perspective-key...

# Optional: Google Cloud DLP for enhanced PII detection
GOOGLE_DLP_API_KEY=...your-dlp-key...
```

## RLS Migration

The migration `20241217_server_authoritative_writes.sql` configures RLS:

### Pulses Table Policies

| Operation | anon | authenticated | service_role |
|-----------|------|---------------|--------------|
| SELECT    | Yes  | Yes           | Yes          |
| INSERT    | No   | No            | Yes          |
| UPDATE    | No   | No            | Yes          |
| DELETE    | No   | Owner only    | Yes          |

### Applying the Migration

```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase Dashboard
# Copy contents of supabase/migrations/20241217_server_authoritative_writes.sql
```

## Validating RLS Configuration

After applying the migration, verify the policies are correct:

### 1. Check RLS is Enabled

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'pulses';
-- relrowsecurity should be true
```

### 2. Check Policies Exist

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'pulses'
ORDER BY policyname;
```

Expected policies:
- `Deny anon insert` - INSERT denied for anon
- `Deny authenticated insert` - INSERT denied for authenticated
- `Deny anon update` - UPDATE denied for anon
- `Deny authenticated update` - UPDATE denied for authenticated
- `Public can read all pulses` - SELECT allowed for all
- `Users can delete own pulses` - DELETE allowed for owner

### 3. Test Direct Insert is Blocked

Using the Supabase client with user JWT:

```javascript
const { data, error } = await supabase
  .from("pulses")
  .insert({ city: "Test", mood: ":", tag: "General", message: "test", author: "test" });

// Should fail with: "new row violates row-level security policy"
```

### 4. Test Service Role Insert Works

Using the Supabase client with SERVICE_ROLE key:

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabaseAdmin
  .from("pulses")
  .insert({ city: "Test", mood: ":", tag: "General", message: "test", author: "test", user_id: "..." });

// Should succeed
```

## Security Scan Resolution

After applying this configuration, the Supabase security scan should no longer report:

> "RLS Disabled in Public" for `public.pulses`

If the warning persists:
1. Verify RLS is enabled: `ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;`
2. Ensure explicit deny policies exist (not just absence of allow policies)
3. Refresh the security scan in Supabase Dashboard

## Troubleshooting

### "Server configuration error" when creating pulses

This means `SUPABASE_SERVICE_ROLE_KEY` is not set. Check your `.env.local` or deployment environment.

### Insert succeeds when it should fail

Check that RLS is enabled and deny policies are applied:

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'pulses';
-- Must return true

SELECT * FROM pg_policies WHERE tablename = 'pulses';
-- Must include "Deny anon insert" and "Deny authenticated insert"
```

### PII detection too strict / too lenient

Adjust the environment variables:
- `PII_BLOCK_SOCIAL_HANDLES=false` to allow @handles
- `PII_ALLOW_NAMES=true` to allow name sharing

## Architecture Diagram

```
User Browser
    |
    | POST /api/pulses
    | (with Bearer token)
    v
+-------------------+
| API Route         |
| /api/pulses       |
+-------------------+
    |
    | 1. Validate auth (user token)
    | 2. Run PII detection
    | 3. Run content moderation
    |
    v
+-------------------+
| Service Role      |
| Supabase Client   |
+-------------------+
    |
    | INSERT (bypasses RLS)
    |
    v
+-------------------+
| Supabase DB       |
| (RLS: deny users) |
+-------------------+
```

This ensures all writes pass through server-side safety checks.
