#!/bin/bash
# Pull secrets from macOS Keychain and export as env vars
export HOME=/Users/openclaw
KC="/Users/openclaw/Library/Keychains/login.keychain-db"

security unlock-keychain -p "openclaw" "$KC"

export SUPABASE_SERVICE_ROLE_KEY=$(security find-generic-password -a openclaw -s "SUPABASE_SERVICE_ROLE_KEY" -w "$KC")
export OPENAI_API_KEY=$(security find-generic-password -a openclaw -s "OPENAI_API_KEY" -w "$KC")
export TOMTOM_API_KEY=$(security find-generic-password -a openclaw -s "TOMTOM_API_KEY" -w "$KC")

echo "✅ Secrets loaded from Keychain"

# Pass through to whatever command follows
exec "$@"
