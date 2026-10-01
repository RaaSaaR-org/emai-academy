#!/usr/bin/env bash
# Start the EmAI Academy tenant next to the running Bootstrap tenant.
#
#   backend (Rust, shared checkout ../backend)  127.0.0.1:8081   db emai_academy, valkey db 2
#   skills-ms-rooms (../skills-ms-rooms)        127.0.0.1:8011   db emai_skills,  valkey db 3
#   Caddy gateway                               127.0.0.1:8191   /skills/* -> 8011, rest -> 8081
#   frontend (emai-academy/frontend, Nuxt)      localhost:3001   (skipped with --no-frontend)
#   mail relay (services/mail-relay)            127.0.0.1:2526   re-brands backend mails -> smtp4dev :2525
#   xp bridge (services/xp-bridge)              (no port)        completed room units -> skill XP
#
# Assumes the shared devenv services are already up (cd backend && devenv up):
# Postgres :5432, Valkey :6379, smtp4dev :2525, render daemon :8001, mocks :8100-8104.
# Processes run under nohup; logs go to .logs/<name>.log, pids to .run/<name>.pid.
# Idempotent: a service whose port is already listening is left alone.
#
# Usage: scripts/dev-up.sh [--no-frontend] [--refresh-backend]
#                          [--only mail|backend|skills|xp|gateway|frontend]
#   --refresh-backend  rebuild/re-pin the backend binary from ../backend (see lib.sh backend_bin)
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

WITH_FRONTEND=1
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-frontend) WITH_FRONTEND=0 ;;
    --only)
      [ $# -ge 2 ] || die "--only needs a service: mail|backend|skills|xp|gateway|frontend"
      ONLY="$2"; shift ;;
    --refresh-backend) export EMAI_REFRESH_BACKEND=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
case "$ONLY" in ""|mail|backend|skills|xp|gateway|frontend) ;; *) die "unknown service for --only: $ONLY" ;; esac
want() { [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]; }

# --- preflight: shared services -------------------------------------------------
"$PG_BIN/pg_isready" -q -h 127.0.0.1 -p 5432 || die "Postgres :5432 is not up. Start it with: cd $BACKEND_DIR && devenv up"
port_busy 6379 || die "Valkey :6379 is not up. Start it with: cd $BACKEND_DIR && devenv up"
port_busy 2525 || log "WARN: smtp4dev :2525 is not up (mail and /health email check will fail)"
ensure_db emai_academy
ensure_db emai_skills

start() { # name port cmd...
  local name=$1 port=$2; shift 2
  if port_busy "$port"; then
    log "$name: :$port already listening (pid $(port_pid "$port")), leaving it"
    return 0
  fi
  log "starting $name on :$port (log: .logs/$name.log)"
  nohup "$@" >>"$LOG_DIR/$name.log" 2>&1 </dev/null &
  echo $! >"$RUN_DIR/$name.pid"
}

# --- mail relay :2526 -----------------------------------------------------------
if want mail; then
  (
    export EMAI_WEB_URL="http://localhost:$FRONTEND_PORT" EMAI_MAIL_RELAY_PORT="$MAIL_RELAY_PORT"
    start mail "$MAIL_RELAY_PORT" python3 -u "$EMAI_ROOT/services/mail-relay/relay.py" serve
  )
  for _ in $(seq 1 20); do port_busy "$MAIL_RELAY_PORT" && break; sleep 0.5; done
  port_busy "$MAIL_RELAY_PORT" || die "mail relay did not come up, see $LOG_DIR/mail.log"
  log "mail relay up (:$MAIL_RELAY_PORT -> smtp4dev :2525)"
fi

# --- backend :8081 --------------------------------------------------------------
if want backend; then
  BIN=$(backend_bin)
  # serve applies pending migrations itself (database.run_migrations = true)
  start backend "$BACKEND_PORT" direnv exec "$BACKEND_DIR" sh -c \
    "cd '$BACKEND_DIR' && ACADEMY_CONFIG='$ACADEMY_CONFIG_EMAI' exec '$BIN' serve"
  wait_http "http://127.0.0.1:$BACKEND_PORT/health" 90 || die "backend did not come up, see $LOG_DIR/backend.log"
  log "backend up: $(curl -s http://127.0.0.1:$BACKEND_PORT/health)"
fi

# --- skills-ms-rooms :8011 ------------------------------------------------------
if want skills; then
  skills_venv
  if ! port_busy "$SKILLS_PORT"; then
    (
      skills_env
      cd "$SKILLS_DIR"
      log "skills-ms-rooms: alembic upgrade head"
      .venv/bin/alembic upgrade head >>"$LOG_DIR/skills.log" 2>&1 || die "skills migrations failed, see $LOG_DIR/skills.log"
      start skills "$SKILLS_PORT" .venv/bin/python -m api
    )
  else
    log "skills: :$SKILLS_PORT already listening (pid $(port_pid "$SKILLS_PORT")), leaving it"
  fi
  wait_http "http://127.0.0.1:$SKILLS_PORT/docs" 90 || die "skills-ms-rooms did not come up, see $LOG_DIR/skills.log"
  log "skills-ms-rooms up"
fi

# --- xp bridge (no port) ----------------------------------------------------------
if want xp; then
  if [ -f "$RUN_DIR/xp.pid" ] && kill -0 "$(cat "$RUN_DIR/xp.pid")" 2>/dev/null; then
    log "xp bridge already running (pid $(cat "$RUN_DIR/xp.pid")), leaving it"
  else
    (
      skills_env
      log "starting xp bridge (log: .logs/xp.log)"
      PSQL="$PG_BIN/psql" EMAI_SKILLS_INTERNAL_URL="http://127.0.0.1:$SKILLS_PORT" \
        nohup python3 -u "$EMAI_ROOT/services/xp-bridge/bridge.py" >>"$LOG_DIR/xp.log" 2>&1 </dev/null &
      echo $! >"$RUN_DIR/xp.pid"
    )
  fi
fi

# --- gateway :8191 --------------------------------------------------------------
if want gateway; then
  if command -v caddy >/dev/null 2>&1; then CADDY=(caddy); else CADDY=(nix shell nixpkgs#caddy -c caddy); fi
  start gateway "$GATEWAY_PORT" "${CADDY[@]}" run --config "$CONFIG_DIR/Caddyfile" --adapter caddyfile
  wait_http "http://127.0.0.1:$GATEWAY_PORT/health" 120 || die "gateway did not come up, see $LOG_DIR/gateway.log"
  log "gateway up"
fi

# --- frontend :3001 -------------------------------------------------------------
if want frontend && [ "$WITH_FRONTEND" = 1 ]; then
  if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    log "WARN: $FRONTEND_DIR/package.json missing, skipping frontend"
  else
    # Never npm install here: dependencies are linked from the upstream checkout. Re-linked on
    # every start (cheap), so dependencies upstream adds or removes later are picked up.
    (cd "$FRONTEND_DIR" && sh scripts/link-deps.sh >>"$LOG_DIR/frontend.log" 2>&1) \
      || die "link-deps failed, see $LOG_DIR/frontend.log (does ../frontend/node_modules exist? run npm ci there)"
    [ -f "$FRONTEND_DIR/.env" ] || cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
    (
      cd "$FRONTEND_DIR"
      export PORT=$FRONTEND_PORT NUXT_PORT=$FRONTEND_PORT
      export NUXT_PUBLIC_BASE_API_URL="http://127.0.0.1:$GATEWAY_PORT"
      export NUXT_PUBLIC_BASE_WEB_URL="http://localhost:$FRONTEND_PORT"
      start frontend "$FRONTEND_PORT" npm run dev
    )
    wait_http "http://localhost:$FRONTEND_PORT/" 180 || log "WARN: frontend not answering yet, see $LOG_DIR/frontend.log"
  fi
fi

cat <<INFO

EmAI Academy dev stack
  frontend   http://localhost:$FRONTEND_PORT/   (open as localhost, not 127.0.0.1: lesson modules need it)
  gateway    http://127.0.0.1:$GATEWAY_PORT/     health: /health, skills: /skills/docs
  backend    http://127.0.0.1:$BACKEND_PORT/docs
  skills     http://127.0.0.1:$SKILLS_PORT/docs
  mail       http://localhost:5050/ (shared smtp4dev; tenant mails pass the relay :$MAIL_RELAY_PORT)
  logs       $LOG_DIR
Next (first run): scripts/seed.sh
INFO
