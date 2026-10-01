# syntax=docker/dockerfile:1.7
# EmAI Academy sidecars (Python stdlib only), run from one image with different commands:
#   mail relay  python /opt/emai/services/mail-relay/relay.py   (backend pod, 127.0.0.1:2526)
#   xp bridge   python /opt/emai/services/xp-bridge/bridge.py   (skills pod, polls Postgres)
# Both are stopgaps until the upstream changes listed in the README exist.
# Build context: the emai-academy repo root.
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --home-dir /opt/emai --no-create-home emai
COPY services /opt/emai/services
COPY config/mail /opt/emai/mail
COPY content/learning_rooms.json /content/learning_rooms.json
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    EMAI_MAIL_TEMPLATES=/opt/emai/mail \
    EMAI_MAIL_RELAY_PORT=2526 \
    EMAI_WEB_URL=https://academy.emai.dev \
    LEARNING_ROOMS_CONTENT=/content/learning_rooms.json \
    EMAI_SKILLS_INTERNAL_URL=http://127.0.0.1:8011 \
    EMAI_SKILLS_DB=emai_skills \
    PGHOST=emai-academy-postgres PGUSER=academy
USER 1000
WORKDIR /opt/emai
CMD ["python", "/opt/emai/services/mail-relay/relay.py"]
