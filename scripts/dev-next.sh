#!/usr/bin/env sh
# Run the full local CMS: build the packages the Next app needs, then start it.
# The app's `predev` regenerates the registry. Override the port with PORT=xxxx.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

if [ ! -d "$ROOT/node_modules" ]; then
  echo "> Installing workspace deps..."
  pnpm install
fi

echo "> Building packages the app needs..."
pnpm --filter @mdmx/core build
pnpm --filter @mdmx/cli build
pnpm --filter @mdmx/editor build
pnpm --filter @mdmx/next build

echo "> Starting demo-next (generates registry, then next dev)..."
echo "  -> http://localhost:${PORT:-3000}"
exec pnpm --filter demo-next dev
