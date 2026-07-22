#!/usr/bin/env bash
#
# Build the flat-HTML static export into ./out
#
# Static export (output: "export") can't include API routes, the admin
# dashboard (NextAuth/dynamic), or edge middleware. Those are the DYNAMIC app
# and aren't part of the public static site, so we move them aside for the
# build and restore them afterwards (even if the build fails).
#
#   ./scripts/build-static.sh        # uses the committed data/snapshot.json
#   node scripts/snapshot.mjs && ./scripts/build-static.sh   # refresh data first
#
set -euo pipefail
cd "$(dirname "$0")/.."

STASH=".static-build-stash"
PATHS=("app/api" "app/admin" "middleware.ts")

restore() {
  for p in "${PATHS[@]}"; do
    if [ -e "$STASH/$p" ]; then
      mkdir -p "$(dirname "$p")"
      rm -rf "$p"
      mv "$STASH/$p" "$p"
    fi
  done
  rm -rf "$STASH"
}
trap restore EXIT

rm -rf "$STASH" out
for p in "${PATHS[@]}"; do
  if [ -e "$p" ]; then
    mkdir -p "$STASH/$(dirname "$p")"
    mv "$p" "$STASH/$p"
  fi
done

STATIC_EXPORT=1 npx next build

echo ""
echo "✓ Static site exported to ./out ($(find out -name '*.html' | wc -l | tr -d ' ') HTML files)"
