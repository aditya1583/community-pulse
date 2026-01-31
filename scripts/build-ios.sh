#!/bin/bash
# Build script for iOS (Capacitor static export)
#
# The iOS app calls the Vercel backend for all API routes,
# so we exclude server-only routes from the static export.
#
# Usage: ./scripts/build-ios.sh

set -e

BACKUP_DIR="../_ios_build_backup"

cleanup() {
  if [ -d "$BACKUP_DIR" ]; then
    echo "==> Restoring server-only routes..."
    # Restore API routes
    if [ -d "$BACKUP_DIR/api" ]; then
      rm -rf src/app/api
      mv "$BACKUP_DIR/api" src/app/api
    fi
    # Restore sitemap
    if [ -d "$BACKUP_DIR/sitemap.xml" ]; then
      rm -rf src/app/sitemap.xml
      mv "$BACKUP_DIR/sitemap.xml" src/app/sitemap.xml
    fi
    rm -rf "$BACKUP_DIR"
    echo "    Routes restored."
  fi
}

# Always restore routes, even if build fails
trap cleanup EXIT

echo "==> Temporarily moving server-only routes out of build..."
mkdir -p "$BACKUP_DIR"
mv src/app/api "$BACKUP_DIR/api"
mv src/app/sitemap.xml "$BACKUP_DIR/sitemap.xml"
mkdir -p src/app/api

echo "==> Building static export..."
NEXT_PUBLIC_EXPORT_MODE=true npm run build

echo "==> Syncing with Capacitor iOS..."
npx cap sync ios

echo ""
echo "Build complete! Open Xcode with: npx cap open ios"
