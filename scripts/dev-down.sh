#!/usr/bin/env bash
# Stop the EmAI tenant processes only: whatever listens on the tenant ports 8081, 8011, 8191,
# 3001 and 2526, plus the pids in .run/ (the xp bridge has no port). It never touches the
# Bootstrap tenant (3000, 8080, 8010, 8190) or the shared devenv services.
#
# Usage: scripts/dev-down.sh [mail|backend|skills|xp|gateway|frontend ...]
set -uo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

port_of() {
  case "$1" in
    backend) echo "$BACKEND_PORT" ;; skills) echo "$SKILLS_PORT" ;;
    gateway) echo "$GATEWAY_PORT" ;; frontend) echo "$FRONTEND_PORT" ;;
    mail) echo "$MAIL_RELAY_PORT" ;; xp) echo "none" ;;
  esac
}
if [ $# -gt 0 ]; then NAMES=("$@"); else NAMES=(frontend gateway xp skills backend mail); fi

kill_tree() { # pid
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}

for name in "${NAMES[@]}"; do
  port=$(port_of "$name")
  [ -n "$port" ] || { log "unknown service $name"; continue; }
  pidfile="$RUN_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    kill_tree "$(cat "$pidfile")"
    rm -f "$pidfile"
  fi
  if [ "$port" = none ]; then log "$name stopped"; continue; fi
  for i in 1 2 3 4 5 6 7 8 9 10; do
    pid=$(port_pid "$port")
    [ -z "$pid" ] && break
    kill_tree "$pid"
    sleep 0.5
  done
  if port_busy "$port"; then
    log "$name: :$port still busy, sending SIGKILL"
    kill -9 "$(port_pid "$port")" 2>/dev/null || true
  fi
  log "$name stopped (:$port free)"
done
