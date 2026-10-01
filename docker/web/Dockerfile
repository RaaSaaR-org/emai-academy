# syntax=docker/dockerfile:1.7
# EmAI Academy web: the EmAI Nuxt layer (frontend/) generated over the pinned upstream
# Bootstrap Academy frontend, plus the lesson modules, served by unprivileged nginx on :8080
# together with the /api reverse proxy. Build context: the emai-academy repo root.
ARG NODE_VERSION=24
ARG FRONTEND_REPO=https://github.com/Bootstrap-Academy/frontend.git
ARG FRONTEND_REF=6d4389e94835ced809edbc0375a48d5dbbc0db95

FROM alpine/git:2.47.2 AS upstream
ARG FRONTEND_REPO
ARG FRONTEND_REF
WORKDIR /w/frontend
RUN git init -q . && git remote add origin "$FRONTEND_REPO" \
 && git fetch -q --depth 1 origin "$FRONTEND_REF" && git checkout -q FETCH_HEAD && rm -rf .git

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /w/frontend
COPY --from=upstream /w/frontend/package.json /w/frontend/package-lock.json ./
# postinstall runs `nuxt prepare`, which needs the sources; run it after copying them.
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund

FROM node:${NODE_VERSION}-bookworm-slim AS build
# Public origin of the deployment. The API lives under <origin>/api, lesson modules under
# <origin>/learning-modules/ (their URLs are baked into the module descriptors, so the skills
# image must be built with the same PUBLIC_ORIGIN).
ARG PUBLIC_ORIGIN=https://academy.emai.dev
ARG API_BASE_URL=${PUBLIC_ORIGIN}/api
COPY --from=upstream /w/frontend /w/frontend
COPY --from=deps /w/frontend/node_modules /w/frontend/node_modules
COPY frontend /w/emai-academy/frontend
COPY content/modules /w/emai-academy/content/modules
WORKDIR /w/emai-academy/frontend
ENV NUXT_TELEMETRY_DISABLED=1 \
    NUXT_PUBLIC_BASE_API_URL=${API_BASE_URL} \
    NUXT_PUBLIC_BASE_WEB_URL=${PUBLIC_ORIGIN} \
    NUXT_PUBLIC_NODE_ENV=production \
    NUXT_PUBLIC_LEARNING_ROOMS_ENABLED=true
RUN rm -rf node_modules .nuxt .output .env \
 && sh scripts/link-deps.sh \
 && (cd /w/frontend && npx nuxt prepare >/dev/null) \
 && npx nuxt generate \
 && BASE_URL="${PUBLIC_ORIGIN}/learning-modules/" sh ../content/modules/build.sh \
 && mkdir -p .output/public/learning-modules \
 && cp -R ../content/modules/dist/learning-modules/. .output/public/learning-modules/ \
 && rm -f .output/public/404.html

FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV BACKEND_UPSTREAM=http://emai-academy-backend:8081 \
    SKILLS_UPSTREAM=http://emai-academy-skills:8011 \
    NGINX_ENVSUBST_FILTER="^(BACKEND_UPSTREAM|SKILLS_UPSTREAM)$"
COPY docker/web/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/web/proxy_headers.conf /etc/nginx/proxy_headers.conf
COPY --from=build /w/emai-academy/frontend/.output/public /usr/share/nginx/html
# Run as uid 1000 (cluster convention) instead of the image's 101: nginx writes its rendered
# config, cache and pid file at start.
USER root
RUN chown -R 1000:0 /etc/nginx/conf.d /var/cache/nginx && chmod -R g+w /etc/nginx/conf.d /var/cache/nginx
USER 1000
EXPOSE 8080
