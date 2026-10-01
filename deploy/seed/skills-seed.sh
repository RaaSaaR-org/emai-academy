#!/bin/sh
# Seed step 2 of 2 (skills image, /opt/emai/seed.sh). Idempotent.
#   1. validate and sync /content/skills/*.yml into skills-ms (scripts/sync_skills.py)
#   2. apply /content/skills/layout.json (tree size and node positions)
#   3. register the lesson modules from /content/modules/descriptors (--replace)
# Env: SKILLS_URL (http://emai-academy-skills:8011), admin token in TOKEN_FILE (/seed/token)
# or EMAI_ADMIN_TOKEN, plus the normal skills-ms env (DATABASE_URL,
# LESSON_MODULE_ORIGINS, ...) because module registration writes to the database directly.
set -eu
cd /app
SKILLS="${SKILLS_URL:-${EMAI_SKILLS_URL:-http://emai-academy-skills:8011}}"
TOKEN="${EMAI_ADMIN_TOKEN:-$(cat "${TOKEN_FILE:-${SEED_TOKEN_FILE:-/seed/token}}")}"
[ -n "$TOKEN" ] || { echo "seed: no admin token" >&2; exit 1; }

i=0
until curl -fsS -o /dev/null "$SKILLS/docs"; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo "seed: skills-ms at $SKILLS not reachable" >&2; exit 1; }
  sleep 5
done

echo "seed: validating skills"
python scripts/sync_skills.py --list /content/skills >/dev/null
echo "seed: syncing skills to $SKILLS"
python scripts/sync_skills.py ${SYNC_FLAGS:-} --host "$SKILLS" --token "Bearer $TOKEN" /content/skills | tail -20

if [ -f /content/skills/layout.json ]; then
  echo "seed: applying layout.json"
  python - /content/skills/layout.json "$SKILLS" "$TOKEN" <<'PY'
import json, sys, httpx
layout, host, token = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
h = {"Authorization": f"Bearer {token}"}
tree = {k: layout[k] for k in ("rows", "columns") if k in layout}
if tree:
    httpx.patch(f"{host}/skilltree", json=tree, headers=h).raise_for_status()
bad = 0
items = list(layout.get("skills", {}).items()) + list(layout.get("sub_skills", {}).items())
for key, patch in items:
    r = httpx.patch(f"{host}/skilltree/{key}", json=patch, headers=h)
    if not r.is_success:
        bad += 1
        print(key, r.status_code, r.text)
print(f"layout: {len(items) - bad}/{len(items)} positions applied")
sys.exit(1 if bad else 0)
PY
fi

for desc in /content/modules/descriptors/*.json; do
  [ -f "$desc" ] || continue
  python -m api.register_lesson_module "$desc" --replace
done
echo "seed: done"
