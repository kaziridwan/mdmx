#!/usr/bin/env sh
# Pack every publishable package into a tarball (`pnpm pack` rewrites
# `workspace:*` to the real versions), then print the `pnpm.overrides`
# snippet an app pastes to consume them — the way to use mdmx in your own
# apps between npm publishes (docs/guides/next-js/08-before-npm.md).
#
#   pnpm pack:all            # tarballs into ./tarballs/
#   pnpm pack:all --out DIR  # somewhere else
set -e
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

OUT="$ROOT/tarballs"
if [ "$1" = "--out" ] && [ -n "$2" ]; then
  OUT=$(CDPATH= cd -- "$(dirname -- "$2")" && pwd)/$(basename -- "$2")
fi

echo "> Building packages..."
pnpm build >/dev/null

mkdir -p "$OUT"
rm -f "$OUT"/mdmx-*.tgz

echo "> Packing into $OUT"
SNIPPET=""
for dir in packages/*; do
  [ -f "$dir/package.json" ] || continue
  name=$(node -p "require('./$dir/package.json').name")
  file=$(cd "$dir" && pnpm pack --pack-destination "$OUT" 2>/dev/null | tail -1)
  file=$(basename -- "$file")
  echo "  $name  ->  $file"
  SNIPPET="$SNIPPET      \"$name\": \"file:$OUT/$file\",
"
done

# Drop the trailing comma of the last line for valid JSON.
SNIPPET=$(printf '%s' "$SNIPPET" | sed '$ s/,$//')

echo
echo "Add to the consuming app's package.json (paths are absolute to this checkout):"
echo
echo "  \"pnpm\": {"
echo "    \"overrides\": {"
printf '%s\n' "$SNIPPET"
echo "    }"
echo "  }"
echo
echo "then \`pnpm install\`. Re-run this script and \`pnpm install\` after each rebuild."
echo "OK: $(ls "$OUT"/mdmx-*.tgz | wc -l | tr -d ' ') tarballs in $OUT"
