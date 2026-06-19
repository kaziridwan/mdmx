#!/usr/bin/env sh
# Regenerate the iMDX registry (.imdx/registry.{json,ts}) for every example app.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

BIN="$ROOT/packages/cli/dist/bin.js"
if [ ! -f "$BIN" ]; then
  echo "> Building @imdx/cli (and its deps)..."
  pnpm --filter @imdx/core build
  pnpm --filter @imdx/cli build
fi

for app in demo demo-next; do
  dir="$ROOT/examples/$app"
  if [ -f "$dir/imdx.config.json" ]; then
    echo "> Generating registry for examples/$app..."
    ( cd "$dir" && node "$BIN" generate )
  fi
done
echo "OK: Registries generated."
