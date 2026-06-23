#!/usr/bin/env sh
# Build all @mdmx packages (core first, then the rest).
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

echo "> Building all @mdmx packages..."
pnpm build
echo "OK: Build complete."
