#!/usr/bin/env bash
#
# End-to-end check of the *published* package, not the source tree: builds, packs, installs the
# tarball into a throwaway project, and exercises it from ESM, CommonJS, and the TypeScript
# compiler. Catches broken `exports` maps, missing files, and type-resolution failures that unit
# tests cannot see.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cd "$root"
npm run build

# `--ignore-scripts` skips the `prepack` build, whose output would otherwise end up in the
# captured filename. The build above already produced exactly what `prepack` would.
npm pack --silent --ignore-scripts --pack-destination "$work" >/dev/null
tarball="$(ls "$work"/*.tgz)"
echo "Packed $(basename "$tarball")"

cd "$work"
npm init --yes >/dev/null 2>&1
npm install --silent --no-audit --no-fund "$tarball" "@types/node@^22" >/dev/null

cp "$root/scripts/smoke/consumer.mjs" "$root/scripts/smoke/consumer.cjs" \
  "$root/scripts/smoke/consumer.ts" .

echo "→ ESM consumer"
node consumer.mjs

echo "→ CommonJS consumer"
node consumer.cjs

echo "→ TypeScript consumer (module node16)"
"$root/node_modules/.bin/tsc" \
  --noEmit --strict --target es2023 --module node16 --moduleResolution node16 \
  --types node consumer.ts

echo "Smoke test passed."
