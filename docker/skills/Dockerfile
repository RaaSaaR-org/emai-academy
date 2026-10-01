# syntax=docker/dockerfile:1.7
# EmAI Academy skills: upstream Bootstrap Academy skills-ms (release/2026-09, learning rooms)
# from a pinned commit, with the EmAI content baked in at /content and the seed script at
# /opt/emai/seed.sh. Build context: the emai-academy repo root.
ARG PYTHON_VERSION=3.11
ARG SKILLS_REPO=https://github.com/Bootstrap-Academy/skills-ms.git
ARG SKILLS_REF=37251f868da0fabe6892b80896be720575969c70
ARG FRONTEND_REPO=https://github.com/Bootstrap-Academy/frontend.git
ARG FRONTEND_REF=6d4389e94835ced809edbc0375a48d5dbbc0db95

FROM alpine/git:2.47.2 AS source
ARG SKILLS_REPO
ARG SKILLS_REF
ARG FRONTEND_REPO
ARG FRONTEND_REF
RUN fetch() { mkdir -p "$1" && cd "$1" && git init -q . && git remote add origin "$2" \
      && git fetch -q --depth 1 origin "$3" && git checkout -q FETCH_HEAD && rm -rf .git; } \
 && fetch /src/skills "$SKILLS_REPO" "$SKILLS_REF" \
 && fetch /src/frontend "$FRONTEND_REPO" "$FRONTEND_REF"

# Lesson module descriptors. entry_url = <PUBLIC_ORIGIN>/learning-modules/<sha256>/index.js, so
# PUBLIC_ORIGIN must match the web image build (the sha256 directory is origin-independent).
FROM node:24-bookworm-slim AS modules
ARG PUBLIC_ORIGIN=https://academy.emai.dev
COPY --from=source /src/frontend/scripts /w/frontend/scripts
COPY content/modules /w/emai-academy/content/modules
RUN UPSTREAM_FRONTEND=/w/frontend BASE_URL="${PUBLIC_ORIGIN}/learning-modules/" \
    sh /w/emai-academy/content/modules/build.sh

FROM python:${PYTHON_VERSION}-slim-bookworm AS deps
ENV POETRY_VIRTUALENVS_IN_PROJECT=true POETRY_NO_INTERACTION=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN --mount=type=cache,target=/root/.cache/pip pip install "poetry==1.8.5"
WORKDIR /app
COPY --from=source /src/skills/pyproject.toml /src/skills/poetry.lock /src/skills/poetry.toml ./
# Main dependencies only; `rich` (a dev dependency) is needed by scripts/sync_skills.py in the seed.
RUN --mount=type=cache,target=/root/.cache/pypoetry poetry install --only main --no-root \
 && .venv/bin/pip install --no-cache-dir "rich>=13.7,<14" \
 && (.venv/bin/python -c 'import greenlet' || .venv/bin/pip install --no-cache-dir "greenlet==3.0.3")

FROM python:${PYTHON_VERSION}-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --home-dir /app --no-create-home skills
WORKDIR /app
COPY --from=source /src/skills /app
COPY --from=deps /app/.venv /app/.venv
COPY content/courses /content/courses
COPY content/skills /content/skills
COPY content/learning_rooms.json content/character_areas.json /content/
COPY --from=modules /w/emai-academy/content/modules/dist/descriptors /content/modules/descriptors
COPY docker/skills/entrypoint.sh /opt/emai/entrypoint.sh
COPY docker/skills/migrate /usr/local/bin/migrate
COPY deploy/seed/skills-seed.sh /opt/emai/seed.sh
RUN mkdir -p /content/lectures /seed && chown 1000 /seed && chmod 0755 /opt/emai/*.sh /usr/local/bin/migrate
ENV PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 PORT=8011 ROOT_PATH=/skills DEBUG=False RELOAD=False LOG_LEVEL=INFO \
    ROOMS_ENABLED=True \
    COURSES=/content/courses \
    LEARNING_ROOMS_CONTENT=/content/learning_rooms.json \
    CHARACTER_AREAS=/content/character_areas.json \
    MP4_LECTURES=/content/lectures \
    LESSON_MODULE_ORIGINS='["https://academy.emai.dev"]' \
    LESSON_MODULE_LOCAL_DEVELOPMENT=False \
    RUN_MIGRATIONS=true
USER 1000
EXPOSE 8011
ENTRYPOINT ["/opt/emai/entrypoint.sh"]
CMD ["serve"]
