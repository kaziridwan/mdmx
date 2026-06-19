#!/usr/bin/env sh
# Typecheck every package, then run the full test suite - the pre-push gate.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
echo "> Typechecking..."
pnpm check
echo "> Testing..."
pnpm test
echo "OK: All checks passed."
