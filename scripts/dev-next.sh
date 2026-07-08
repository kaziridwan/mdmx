#!/usr/bin/env sh
# Run the full local CMS: install, build the packages the Next app needs,
# then start it. The app's `predev` regenerates the registry. Override the
# port with PORT=xxxx.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

# Always run install: it is a fast no-op when up to date, and it repairs the
# partial states a `clean --all` leaves behind (a root-folder existence check
# misses per-package node_modules that were wiped).
echo "> Installing workspace deps..."
pnpm install

echo "> Building packages the app needs..."
pnpm build

# pnpm only links a workspace bin when its target exists at install time, so
# the install above (running before the first build) skips the `mdmx` CLI
# link on a fresh/cleaned tree. Now that dist/ exists, re-install to link it.
if [ ! -e "$ROOT/examples/demo-next/node_modules/.bin/mdmx" ]; then
  echo "> Relinking workspace bins (the mdmx CLI was built after install)..."
  pnpm install
fi

echo "> Starting demo-next (generates registry, then next dev)..."
echo "  -> http://localhost:${PORT:-3000}"
exec pnpm --filter demo-next dev
