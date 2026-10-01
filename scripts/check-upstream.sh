#!/usr/bin/env bash
# Check that the tenant still fits the upstream checkouts (for CI or after pulling upstream):
#  1. every source patch in frontend/brand/patches.cjs still matches the upstream file
#  2. every tenant file that shadows an upstream file (frontend/brand/overrides.json) was
#     written against the current upstream version (git blob hash)
#  3. every package in ../frontend/node_modules is linked into frontend/node_modules
# Exit 1 on any problem. After reviewing upstream changes to overridden files, re-record with:
#   scripts/check-upstream.sh --update
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
UPSTREAM_FE="$WORKSPACE/frontend"

if [ "${1:-}" = "--update" ]; then
  node -e 'require(process.argv[1]).updateOverrides(process.argv[2])' "$FRONTEND_DIR/brand/core.cjs" "$UPSTREAM_FE"
  log "re-recorded upstream hashes in frontend/brand/overrides.json ($(git -C "$UPSTREAM_FE" rev-parse --short HEAD))"
  exit 0
fi

rc=0
node - "$FRONTEND_DIR/brand/core.cjs" "$UPSTREAM_FE" <<'JS' || rc=$?
const [core, upstream] = process.argv.slice(2);
const { checkPatches, checkOverrides } = require(core);
const p = checkPatches(upstream), o = checkOverrides(upstream);
for (const x of p) console.log("PATCH    " + x);
for (const x of o) console.log("OVERRIDE " + x);
console.log(`patches: ${p.length ? p.length + " broken" : "ok"}, overrides: ${o.length ? o.length + " drifted" : "ok"}`);
process.exit(p.length || o.length ? 1 : 0);
JS

missing=0
for e in "$UPSTREAM_FE"/node_modules/*; do
  [ -e "$FRONTEND_DIR/node_modules/$(basename "$e")" ] || { echo "DEPS     not linked: $(basename "$e")"; missing=$((missing + 1)); }
done
[ "$missing" = 0 ] && echo "deps: ok" || { echo "deps: $missing missing (run frontend/scripts/link-deps.sh)"; rc=1; }
exit $rc
