# syntax=docker/dockerfile:1.7
# EmAI Academy backend: the upstream Bootstrap Academy backend (Rust), built from a pinned commit.
# No EmAI code is compiled in; only a config entrypoint and the seed script are added.
# Build context: the emai-academy repo root. All configuration comes from ACADEMY_CONFIG at runtime
# (colon-separated TOML files, first file wins); see deploy/README.md.
ARG RUST_VERSION=1.90
ARG BACKEND_REPO=https://github.com/Bootstrap-Academy/backend.git
ARG BACKEND_REF=fbe5e60c3e15c99863c250f7914abfda8b0e4e71

FROM alpine/git:2.47.2 AS source
ARG BACKEND_REPO
ARG BACKEND_REF
WORKDIR /src
RUN git init -q . && git remote add origin "$BACKEND_REPO" \
 && git fetch -q --depth 1 origin "$BACKEND_REF" && git checkout -q FETCH_HEAD \
 && git log -1 --format='%H %cs' > .upstream-rev

FROM rust:${RUST_VERSION}-bookworm AS build
WORKDIR /src
COPY --from=source /src /src
# Cache mounts make local rebuilds incremental; in CI the whole layer is cached by the pinned ref.
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/src/target,sharing=locked \
    cargo build --release --locked -p academy \
 && install -D target/release/academy /out/academy

FROM debian:bookworm-slim
ARG BACKEND_REF
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 1000 --home-dir /app --no-create-home academy \
 && mkdir -p /app /seed /data/finance/invoices /data/finance/credit_notes /data/finance/final_statements \
 && chown -R academy /app /data /seed
COPY --from=build /out/academy /usr/local/bin/academy
# Upstream defaults (also compiled into the binary); kept as a file so ACADEMY_CONFIG can list it.
COPY --from=source /src/config.toml /app/config.toml
COPY --from=source /src/.upstream-rev /app/.upstream-rev
COPY --chmod=0755 docker/backend/entrypoint.sh /opt/emai/entrypoint.sh
COPY --chmod=0755 deploy/seed/backend-seed.sh /opt/emai/seed-backend.sh
WORKDIR /app
ENV ACADEMY_VERSION="upstream-${BACKEND_REF}" \
    ACADEMY_CONFIG="/etc/academy/secret/secret.toml:/etc/academy/config/backend.toml:/app/config.toml" \
    RUST_LOG=info
USER 1000
EXPOSE 8081
ENTRYPOINT ["/opt/emai/entrypoint.sh"]
CMD ["academy", "serve"]
