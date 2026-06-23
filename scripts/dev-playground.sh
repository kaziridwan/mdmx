#!/usr/bin/env sh
# Run the Vite editor playground (develop @mdmx/editor/react in isolation).
# Builds core + editor, generates the demo registry the playground imports.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if [ ! -d "$ROOT/node_modules" ]; then
  echo "> Installing workspace deps..."
  pnpm install
fi

echo "> Building @mdmx/core, @mdmx/cli, @mdmx/editor..."
pnpm --filter @mdmx/core build
pnpm --filter @mdmx/cli build
pnpm --filter @mdmx/editor build

echo "> Generating the demo registry..."
( cd "$ROOT/examples/demo" && node "$ROOT/packages/cli/dist/bin.js" generate )

echo "> Starting the playground..."
exec pnpm --filter editor-playground dev
