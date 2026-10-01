#!/usr/bin/env bash
# Seed the EmAI tenant. Idempotent, safe to re-run after content changes.
#   1. create the dev admin user in the emai_academy backend DB (backend CLI)
#   2. get an admin access token (admin session impersonate)
#   3. validate and sync content/skills/*.yml into skills-ms-rooms on :8011 (scripts/sync_skills.py)
#   4. optionally apply content/skills/layout.json (tree size and positions, admin API)
#   5. build the lesson modules, copy them into frontend/public/learning-modules, register them (--replace)
#
# Needs backend :8081 and skills-ms :8011 running (scripts/dev-up.sh).
# Course or catalogue changes need a skills-ms restart: scripts/dev-down.sh skills && scripts/dev-up.sh --only skills
#
# Env overrides: EMAI_ADMIN_NAME / EMAI_ADMIN_EMAIL / EMAI_ADMIN_PASSWORD,
# Usage: scripts/seed.sh [--skip-skills] [--skip-modules] [--update-positions]
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

SKIP_SKILLS=0; SKIP_MODULES=0; SYNC_FLAGS=()
for a in "$@"; do
  case "$a" in
    --skip-skills) SKIP_SKILLS=1 ;;
    --skip-modules) SKIP_MODULES=1 ;;
    --update-positions) SYNC_FLAGS+=(--update-positions) ;;
    *) die "unknown argument: $a" ;;
  esac
done

curl -fsS -o /dev/null "http://127.0.0.1:$BACKEND_PORT/health" || die "backend :$BACKEND_PORT is not running (scripts/dev-up.sh)"
BIN=$(backend_bin)

# --- 1. admin user --------------------------------------------------------------
exists=$("$PG_BIN/psql" -h 127.0.0.1 -U academy -d emai_academy -Atc \
  "select count(*) from users where name = '$ADMIN_NAME'" 2>/dev/null || echo 0)
if [ "$exists" = "0" ]; then
  log "creating admin user $ADMIN_NAME <$ADMIN_EMAIL>"
  backend_exec "$BIN" admin user create --admin --verified "$ADMIN_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>>"$LOG_DIR/seed.log"
else
  log "admin user $ADMIN_NAME already exists"
fi

# --- 2. token -------------------------------------------------------------------
TOKEN=$(backend_exec "$BIN" admin session impersonate "$ADMIN_NAME" 2>>"$LOG_DIR/seed.log" | tail -1)
[ -n "$TOKEN" ] || die "could not get an admin token, see $LOG_DIR/seed.log"
echo "$TOKEN" >"$RUN_DIR/admin.token"
log "admin token written to .run/admin.token"

skills_venv
skills_env
cd "$SKILLS_DIR"

# --- 3. skills ------------------------------------------------------------------
if [ "$SKIP_SKILLS" = 0 ]; then
  SKILLS_SRC="$CONTENT_DIR/skills"
  if ls "$SKILLS_SRC"/*.yml >/dev/null 2>&1; then
    curl -fsS -o /dev/null "http://127.0.0.1:$SKILLS_PORT/docs" || die "skills-ms :$SKILLS_PORT is not running"
    log "validating skills in $SKILLS_SRC (COURSES=$COURSES)"
    .venv/bin/python scripts/sync_skills.py --list "$SKILLS_SRC" >>"$LOG_DIR/seed.log" 2>&1 \
      || die "skill validation failed, see $LOG_DIR/seed.log"
    log "syncing skills to :$SKILLS_PORT"
    .venv/bin/python scripts/sync_skills.py ${SYNC_FLAGS[@]+"${SYNC_FLAGS[@]}"} \
      --host "http://127.0.0.1:$SKILLS_PORT" --token "Bearer $TOKEN" "$SKILLS_SRC" 2>&1 | tee -a "$LOG_DIR/seed.log" | tail -20

    # --- 4. layout ----------------------------------------------------------------
    # Optional layout (content/tools/build_layout.py): {"rows", "columns", "skills": {"<root_id>": {...}}, "sub_skills": {"<root>/<sub>": {...}}}
    # Per-skill fields are passed to PATCH /skilltree/{id} as-is (row, column, sub_tree_rows, sub_tree_columns, icon).
    if [ -f "$SKILLS_SRC/layout.json" ]; then
      log "applying $SKILLS_SRC/layout.json"
      .venv/bin/python - "$SKILLS_SRC/layout.json" "http://127.0.0.1:$SKILLS_PORT" "$TOKEN" <<'PY'
import json, sys, httpx
layout, host, token = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
h = {"Authorization": f"Bearer {token}"}
tree = {k: layout[k] for k in ("rows", "columns") if k in layout}
if tree:
    httpx.patch(f"{host}/skilltree", json=tree, headers=h).raise_for_status()
bad = 0
for sid, patch in layout.get("skills", {}).items():
    r = httpx.patch(f"{host}/skilltree/{sid}", json=patch, headers=h)
    bad += not r.is_success
    if not r.is_success: print(sid, r.status_code, r.text)
# "sub_skills": {"<root_id>/<sub_id>": {"row": .., "column": ..}}
for key, patch in layout.get("sub_skills", {}).items():
    r = httpx.patch(f"{host}/skilltree/{key}", json=patch, headers=h)
    bad += not r.is_success
    if not r.is_success: print(key, r.status_code, r.text)
n = len(layout.get("skills", {})) + len(layout.get("sub_skills", {}))
print(f"layout: {n - bad}/{n} positions applied")
PY
    fi
  else
    log "WARN: no skill files in $SKILLS_SRC yet, skipping skill sync"
  fi
fi

# --- 5. lesson modules ----------------------------------------------------------
# Built modules (content/modules/build.sh) live in content/modules/dist/learning-modules/<sha256>/
# and are served by the EmAI Nuxt app from frontend/public/learning-modules/ (copied here).
# Their registry descriptors {id, api_version, entry_url} are content/modules/dist/descriptors/*.json.
# dist/ is build output (gitignored), so build first; the packager output is deterministic.
if [ "$SKIP_MODULES" = 0 ] && [ -f "$CONTENT_DIR/modules/build.sh" ]; then
  log "building lesson modules (content/modules/build.sh)"
  sh "$CONTENT_DIR/modules/build.sh" >>"$LOG_DIR/seed.log" 2>&1 || die "module build failed, see $LOG_DIR/seed.log"
fi
if [ "$SKIP_MODULES" = 0 ] && [ -d "$CONTENT_DIR/modules/dist/descriptors" ]; then
  MOD_DIST="$CONTENT_DIR/modules/dist"
  PUB="$FRONTEND_DIR/public/learning-modules"
  if [ -d "$MOD_DIST/learning-modules" ]; then
    mkdir -p "$PUB"
    cp -R "$MOD_DIST/learning-modules/." "$PUB/"
    log "copied built modules to frontend/public/learning-modules/"
  fi
  for desc in "$MOD_DIST"/descriptors/*.json; do
    [ -f "$desc" ] || continue
    log "registering lesson module $(tr -d '\n ' <"$desc")"
    .venv/bin/python -m api.register_lesson_module "$desc" --replace 2>&1 | tee -a "$LOG_DIR/seed.log" || true
  done
elif [ "$SKIP_MODULES" = 0 ]; then
  log "WARN: no built lesson modules (run content/modules/build.sh), skipping registration"
fi

log "seed done. Admin: $ADMIN_NAME / $ADMIN_PASSWORD ($ADMIN_EMAIL)"
