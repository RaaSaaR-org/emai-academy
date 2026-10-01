#!/bin/sh
# Link every upstream node_modules entry into a REAL local node_modules dir.
# A whole-dir symlink would make Nuxt/Vite/jiti write caches into the upstream repo,
# and a separate npm install would create a second vue-i18n copy (breaks useI18n).
# Idempotent and cheap; scripts/dev-up.sh runs it on every start, so packages upstream adds
# later get linked and links to removed packages are dropped.
set -eu
T="$(cd "$(dirname "$0")/.." && pwd)"
U_REL="$T/../../frontend/node_modules"
if [ ! -d "$U_REL/nuxt" ]; then
  echo "link-deps: $U_REL is missing or incomplete. Install the upstream frontend first:" >&2
  echo "  (cd $(cd "$T/../.." && pwd)/frontend && npm ci)" >&2
  exit 1
fi
U="$(cd "$U_REL" && pwd)"
mkdir -p "$T/node_modules"
for e in "$U"/* "$U"/.bin; do ln -sfn "$e" "$T/node_modules/$(basename "$e")"; done
# drop dangling links (packages upstream removed)
for l in "$T/node_modules"/* "$T/node_modules"/.bin; do
  [ -L "$l" ] && [ ! -e "$l" ] && rm "$l"
done
echo "linked $(ls "$T/node_modules" | wc -l | tr -d ' ') entries from $U"
