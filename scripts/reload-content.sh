#!/usr/bin/env bash
# Reload EmAI content: skills-ms-rooms reads courses, learning_rooms.json and character_areas.json
# only at startup, so restart it, then re-sync skills and lesson modules.
# Usage: scripts/reload-content.sh [seed.sh flags, e.g. --update-positions]
set -euo pipefail
cd "$(dirname "$0")"
./dev-down.sh skills
./dev-up.sh --only skills
./seed.sh "$@"
