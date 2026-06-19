#!/usr/bin/env sh
# Run the Vite editor playground (develop @imdx/editor/react in isolation).
# Builds core + editor, generates the demo registry the playground imports.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if [ ! -d "$ROOT/node_modules" ]; then
  echo "> Installing workspace deps..."
  pnpm install
fi

echo "> Building @imdx/core, @imdx/cli, @imdx/editor..."
pnpm --filter @imdx/core build
pnpm --filter @imdx/cli build
pnpm --filter @imdx/editor build

echo "> Generating the demo registry..."
( cd "$ROOT/examples/demo" && node "$ROOT/packages/cli/dist/bin.js" generate )

echo "> Starting the playground..."
exec pnpm --filter editor-playground dev
