#!/bin/sh
# Seed step 1 of 2 (backend image, Kubernetes initContainer / compose one-shot).
# Creates the admin user if it does not exist yet and writes an admin access token for step 2.
#   ADMIN_NAME (admin), ADMIN_EMAIL (admin@emai.dev), ADMIN_PASSWORD (required)
#   TOKEN_FILE (/seed/token)
# Needs the same config as the backend (ACADEMY_CONFIG / ACADEMY_* env, see entrypoint.sh) and a
# backend that has already applied its migrations (it does so on start).
set -eu
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
NAME="${ADMIN_NAME:-admin}"
EMAIL="${ADMIN_EMAIL:-admin@emai.dev}"
TOKEN_FILE="${TOKEN_FILE:-${SEED_TOKEN_FILE:-/seed/token}}"

# Wait for the schema: the CLI fails until the serving backend has migrated the database.
i=0
until academy admin session impersonate "$NAME" >/dev/null 2>&1 \
      || academy admin user create --admin --verified "$NAME" "$EMAIL" "$ADMIN_PASSWORD" >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo "seed: backend database not ready" >&2; exit 1; }
  sleep 5
done
echo "seed: admin user $NAME present"

token=$(academy admin session impersonate "$NAME" | tail -1)
[ -n "$token" ] || { echo "seed: could not get an admin token" >&2; exit 1; }
mkdir -p "$(dirname "$TOKEN_FILE")"
umask 077
printf '%s' "$token" > "$TOKEN_FILE"
echo "seed: admin token written to $TOKEN_FILE"
