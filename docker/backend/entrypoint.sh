#!/bin/sh
# EmAI Academy backend entrypoint. The upstream backend reads configuration only from the TOML
# files in ACADEMY_CONFIG (colon-separated, first file wins) and has no env-var overrides.
# To keep secrets out of config files, this wrapper
#   1. renders a secret overlay from env vars, if any are set, and puts it FIRST:
#        ACADEMY_DATABASE_URL -> [database] url      ACADEMY_JWT_SECRET -> [jwt] secret
#        ACADEMY_CACHE_URL    -> [cache] url         ACADEMY_SMTP_URL   -> [email] smtp_url
#   2. drops files from ACADEMY_CONFIG that do not exist (e.g. an optional mounted secret.toml),
#      because the backend refuses to start on a missing file.
set -eu
q() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
overlay=""
add() { overlay="$overlay[$1]
$2 = $(q "$3")
"; }
[ -n "${ACADEMY_DATABASE_URL:-}" ] && add database url "$ACADEMY_DATABASE_URL"
[ -n "${ACADEMY_CACHE_URL:-}" ] && add cache url "$ACADEMY_CACHE_URL"
[ -n "${ACADEMY_JWT_SECRET:-}" ] && add jwt secret "$ACADEMY_JWT_SECRET"
[ -n "${ACADEMY_SMTP_URL:-}" ] && add email smtp_url "$ACADEMY_SMTP_URL"

files=""
if [ -n "$overlay" ]; then
  gen="${ACADEMY_ENV_OVERLAY:-/tmp/academy-env.toml}"
  umask 077
  printf '%s' "$overlay" > "$gen"
  files="$gen"
fi
old_ifs=$IFS; IFS=:
for f in ${ACADEMY_CONFIG:-/app/config.toml}; do
  [ -f "$f" ] && files="${files:+$files:}$f"
done
IFS=$old_ifs
export ACADEMY_CONFIG="$files"
exec "$@"
