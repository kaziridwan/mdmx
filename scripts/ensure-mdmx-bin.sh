#!/usr/bin/env sh
# pnpm only links a workspace bin whose target file exists at install time.
# On a tree where `pnpm install` ran before the first build (fresh clone,
# after `clean --all`), the `mdmx` CLI is silently skipped — and a later
# no-op `pnpm install` does not repair it. Link it explicitly instead.
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN="$ROOT/packages/cli/dist/bin.js"

if [ ! -f "$BIN" ]; then
  echo "ensure-mdmx-bin: $BIN not found — build @mdmx/cli first (pnpm build)" >&2
  exit 1
fi
chmod +x "$BIN"

# The workspace root's .bin is on PATH for every package script; the example
# apps get direct links too so `pnpm --filter <app> …` works regardless of
# PATH assembly across pnpm versions.
for dir in "$ROOT" "$ROOT/examples/demo" "$ROOT/examples/demo-next"; do
  mkdir -p "$dir/node_modules/.bin"
  ln -sf "$BIN" "$dir/node_modules/.bin/mdmx"
done
