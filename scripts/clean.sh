#!/usr/bin/env sh
# Remove build artifacts (dist, .next, generated .imdx, tsbuildinfo).
# Pass --all to also remove every node_modules.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

echo "> Removing package dist/ dirs..."
for p in core cli editor next provider-github; do
  rm -rf "$ROOT/packages/$p/dist"
done

echo "> Removing example build outputs..."
rm -rf "$ROOT/examples/editor-playground/dist"
rm -rf "$ROOT/examples/demo-next/.next"
for app in demo demo-next; do
  rm -rf "$ROOT/examples/$app/.imdx"
done

find "$ROOT/packages" "$ROOT/examples" -name "*.tsbuildinfo" -delete 2>/dev/null || true

if [ "$1" = "--all" ]; then
  echo "> Removing all node_modules..."
  find "$ROOT" -name node_modules -type d -prune -exec rm -rf {} +
fi

echo "OK: Clean."
