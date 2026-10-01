#!/usr/bin/env sh
# Package the EmAI lesson modules with the UNMODIFIED upstream packager
# (frontend/scripts/build-learning-module.mjs).
#
# Usage:
#   ./build.sh                       # public dev delivery (default)
#   BASE_URL=https://cdn.example/learning-modules/ ./build.sh
#   ./build.sh --private             # private package layout for PRIVATE_LESSON_MODULES_ROOT
#
# Output:
#   dist/learning-modules/<artifact_sha256>/{index.js,[episode.json],module.json,manifest.json}
#   dist/descriptors/<module-id>.json  (copy of the generated module.json, for register_lesson_module)
#
# Public dev delivery: copy/rsync dist/learning-modules/ into the EmAI Nuxt app's
# public/learning-modules/ so it is served at http://localhost:3001/learning-modules/.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM="${UPSTREAM_FRONTEND:-$(cd "$HERE/../../../frontend" && pwd)}"
PACKAGER="$UPSTREAM/scripts/build-learning-module.mjs"

MODE=public
[ "${1:-}" = "--private" ] && MODE=private

if [ "$MODE" = private ]; then
  # skills-ms: entry_url must be <PUBLIC_BASE_URL origin>/private-lesson-modules/<sha>/<entry>
  BASE_URL="${BASE_URL:-http://localhost:3001/private-lesson-modules/}"
  OUT="$HERE/dist/private-lesson-modules"
  DESC="$HERE/dist/descriptors-private"
else
  BASE_URL="${BASE_URL:-http://localhost:3001/learning-modules/}"
  OUT="$HERE/dist/learning-modules"
  DESC="$HERE/dist/descriptors"
fi

ALLOW_LOCAL=""
case "$BASE_URL" in http://localhost*|http://127.0.0.1*) ALLOW_LOCAL="--allow-local" ;; esac

# Regenerate bundled data deterministically (identical bytes -> identical hash).
node "$HERE/tools/generate-episode.mjs" > "$HERE/src/teleop-dataset-explorer/episode.json"

mkdir -p "$OUT" "$DESC"
for id in robot-arm-kinematics teleop-dataset-explorer; do
  result="$(node "$PACKAGER" --source "$HERE/src/$id" --output "$OUT" --base-url "$BASE_URL" $ALLOW_LOCAL)"
  dir="$(printf '%s' "$result" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).directory))')"
  cp "$dir/module.json" "$DESC/$id.json"
  echo "$id -> $(cat "$DESC/$id.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).entry_url))')"
done
