#!/bin/sh
# EmAI Academy skills entrypoint.
#   serve    (default) apply DB migrations when RUN_MIGRATIONS=true, then start the API on $PORT
#   migrate  alembic upgrade head, then exit (also on PATH as `migrate`)
#   seed     /opt/emai/seed.sh (skills sync, tree layout, lesson module registration)
#   *        run the given command as is (e.g. python scripts/sync_skills.py --list /content/skills)
set -eu
cd /app
case "${1:-serve}" in
  serve)
    if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then migrate; fi
    exec python -m api ;;
  migrate) exec migrate ;;
  seed) shift; exec /opt/emai/seed.sh "$@" ;;
  *) exec "$@" ;;
esac
