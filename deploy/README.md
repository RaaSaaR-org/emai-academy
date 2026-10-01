# EmAI Academy deployment

Production target: **https://academy.emai.dev**, Helm chart in
[RaaSaaR-org/deployments](https://github.com/RaaSaaR-org/deployments) (Argo CD), images from this repo.
One host: a single HTTPRoute sends everything to the web Service; the web pod's nginx serves the
SPA and proxies the API under `/api`.

```
browser ── https://academy.emai.dev ──> web (nginx :8080)
                                         ├─ /                    SPA (Nuxt generate) + /learning-modules/
                                         ├─ /api/skills/*   ──>  skills  :8011  (skills-ms + EmAI content)
                                         │                         ├─ sidecar xp-bridge   (room units -> XP)
                                         │                         └─ sidecar mail-relay  127.0.0.1:2526
                                         ├─ GET /api/challenges/courses/*/tasks -> []  (no challenges-ms)
                                         └─ /api/*          ──>  backend :8081  (upstream Rust backend)
                                                                   └─ sidecar mail-relay  127.0.0.1:2526 ──> SMTP_URL
                                         postgres:17 (emai_academy, emai_skills)   valkey:8 (no persistence)
```

Upstream Bootstrap Academy code is **not** in this repo. The Dockerfiles fetch it at build time from
GitHub at pinned commits (build args `FRONTEND_REF`, `BACKEND_REF`, `SKILLS_REF`; bump them in the
Dockerfiles). Upstream is licensed under the Business Source License 1.1 Modified (non-production
use only without a commercial license), see the README.

## Images

`ghcr.io/raasaar-org/emai-academy-<name>`, built by `.github/workflows/images.yml` (linux/amd64).
All run as uid 1000. Build context is always the repo root (`docker build -f docker/<name>/Dockerfile .`).

| image | port | command | notes |
|---|---|---|---|
| `web` | 8080 | nginx | env `BACKEND_UPSTREAM` (`http://emai-academy-backend:8081`), `SKILLS_UPSTREAM` (`http://emai-academy-skills:8011`), no trailing slash. Names are resolved once at start (system resolver, so k8s search domains work). `GET /healthz` = 200. Build arg `PUBLIC_ORIGIN` (default `https://academy.emai.dev`) sets the API base URL (`<origin>/api`) and the lesson module URLs. |
| `backend` | 8081 | `academy serve` | `academy` on PATH, upstream defaults at `/app/config.toml`. Config only via `ACADEMY_CONFIG` (default `/etc/academy/secret/secret.toml:/etc/academy/config/backend.toml:/app/config.toml`, first wins). Applies its migrations on start. Seed step 1: `/opt/emai/seed-backend.sh`. |
| `skills` | 8011 | entrypoint `serve` (default) / `migrate` / `seed` | `migrate` is also an executable on PATH (`alembic upgrade head`). `serve` runs migrations first unless `RUN_MIGRATIONS=false`. Content baked in at `/content`. Seed step 2: `/opt/emai/seed.sh`. Probe: `GET /docs`. |
| `services` | – | `python /opt/emai/services/mail-relay/relay.py` (default) or `.../xp-bridge/bridge.py` | sidecars, Python stdlib + `psql`. |

**PUBLIC_ORIGIN must be the same for `web` and `skills`**: the skills image bakes the lesson module
descriptors (`entry_url = <origin>/learning-modules/<sha256>/index.js`), the web image serves them.

### Backend config

The backend has no env-var overrides; it reads TOML files only.

- `/etc/academy/config/backend.toml`: [`backend.prod.toml`](backend.prod.toml) (non-secret, ConfigMap).
- `/etc/academy/secret/secret.toml`: rendered from the Secret:
  ```toml
  [database]
  url = "postgres://academy:<POSTGRES_PASSWORD>@emai-academy-postgres:5432/emai_academy"
  [jwt]
  secret = "<JWT_SECRET>"
  ```
- Alternative to the file: the image entrypoint renders the same overlay from env
  (`ACADEMY_DATABASE_URL`, `ACADEMY_JWT_SECRET`, `ACADEMY_CACHE_URL`, `ACADEMY_SMTP_URL`) when the
  container is started through it, and skips files in `ACADEMY_CONFIG` that don't exist.

Settings worth knowing (all in `backend.prod.toml`): reCAPTCHA off (no keys yet), OAuth off,
purchases unavailable (no `[purchase]`), render daemon URL is a required dummy (it only renders
invoices), finance archives under `/data/finance` (only written for invoices; an emptyDir is fine).
**No `[http] real_ip`**: `set_from` accepts exactly one IP address (no CIDR), and the web pod has
no fixed address, so per-IP limits (login failures, registrations, contract withdrawals) see the
web pod's IP for every client. The chart raises those limits accordingly.

### skills-ms env

Reference with secrets marked: [`skills.prod.env`](skills.prod.env). Secrets: `JWT_SECRET` (=
backend `[jwt] secret`), `DATABASE_URL` (contains `POSTGRES_PASSWORD`). The password must be
URL-safe (hex/alphanumeric), since it is embedded in URLs.

### Sidecars (services image)

- **mail-relay** (backend pod, and one in the skills pod for its purchase mails): listens on
  `127.0.0.1:${EMAI_MAIL_RELAY_PORT:-2526}` (host via `EMAI_MAIL_RELAY_HOST`), re-brands mails with
  the templates in `/opt/emai/mail`, forwards to `EMAI_MAIL_UPSTREAM` (= Secret `SMTP_URL`):
  `smtps://user:pass@host:465` (implicit TLS), `smtp://user:pass@host:587` (STARTTLS required),
  `smtp://...?tls=required` / `?starttls`, plain `smtp://host:25` (STARTTLS if offered),
  `?tls=none` (never). User/password may be percent-encoded. `EMAI_WEB_URL` (default
  `https://academy.emai.dev`) is used for links.
- **xp-bridge** (skills pod): polls `skills_room_states` via `psql` (`PGHOST`, `PGUSER`,
  `PGPASSWORD`, `EMAI_SKILLS_DB=emai_skills`) and awards `EMAI_ROOM_XP` (20) per completed unit via
  `EMAI_SKILLS_INTERNAL_URL` (`http://127.0.0.1:8011`), signing with `JWT_SECRET`. Idempotent.

### Seed (idempotent, run after every release)

1. backend image, `/opt/emai/seed-backend.sh`: creates `admin` / `admin@emai.dev` / `ADMIN_PASSWORD`
   if missing, writes an admin token to `TOKEN_FILE` (`/seed/token`). Needs the backend config.
2. skills image, `/opt/emai/seed.sh`: syncs `/content/skills`, applies `layout.json`, registers the
   lesson modules. Env: `SKILLS_URL` (`http://emai-academy-skills:8011`), `TOKEN_FILE`, and the full
   skills-ms env (module registration writes to the database).

### Secret `emai-academy-secrets` (Terraform)

| key | used by |
|---|---|
| `POSTGRES_PASSWORD` | postgres, backend `secret.toml`, skills `DATABASE_URL`, xp-bridge `PGPASSWORD` |
| `JWT_SECRET` | backend `[jwt] secret`, skills `JWT_SECRET`, xp-bridge |
| `ADMIN_PASSWORD` | seed step 1 |
| `SMTP_URL` | mail relays (`EMAI_MAIL_UPSTREAM`) |

## Local production-like stack

```sh
docker compose -f deploy/compose.yaml up -d --build      # build, start, migrate, seed
open http://localhost:8088                                 # academy (admin / emai-admin-dev)
open http://localhost:5088                                 # smtp4dev: all mails
cd docs/spike/e2e && EMAI_WEB=http://localhost:8088 EMAI_API=http://localhost:8088/api \
  EMAI_SMTP_UI=http://localhost:5088 node course-run.mjs   # or journey.mjs
docker compose -f deploy/compose.yaml down -v
```

Same images, names and file layout as the chart. Compose-only: origin `http://localhost:8088`
(web and skills built with that `PUBLIC_ORIGIN`, local HTTP modules allowed), smtp4dev as SMTP,
fixed dev secrets ([`compose/secret.toml`](compose/secret.toml)), sidecars share their main
container's network namespace like containers in a pod.

## Release

1. Merge to `main` (publishes `main-<sha>` images for testing).
2. Tag a CalVer release: `git tag v2026.10.01.1 && git push origin v2026.10.01.1`
   (or run the workflow manually with a tag). All four images get that tag.
3. Bump `appVersion` / the image tag in the chart in `RaaSaaR-org/deployments`; Argo CD rolls it out.
   Content changes (courses, rooms, skills) ship in the `skills` image and need the seed job.
