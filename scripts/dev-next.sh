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

# Make sure the mdmx CLI bin is linked (pnpm skips bins whose dist was built
# after install, and a no-op install won't repair it — see the helper).
sh "$ROOT/scripts/ensure-mdmx-bin.sh"

echo "> Starting demo-next (generates registry, then next dev)..."
echo "  -> http://localhost:${PORT:-3000}"
exec pnpm --filter demo-next dev
