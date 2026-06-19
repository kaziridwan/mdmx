#!/usr/bin/env sh
# Run every package's test suite (builds @imdx/core first).
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
pnpm test
