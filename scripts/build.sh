#!/usr/bin/env sh
# Build all @imdx packages (core first, then the rest).
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

echo "> Building all @imdx packages..."
pnpm build
echo "OK: Build complete."
