# EmAI Academy: backend stack (spike result)

Status as of 2026-10-01: **running** next to the untouched Bootstrap tenant.
Backend :8081, skills-ms-rooms :8011 and Caddy :8191 run under `nohup`. The frontend
(:3001) was not started here; another agent owns it, and `scripts/dev-up.sh` starts it
once `frontend/package.json` exists.

## Ports and processes

| Service | Address | Code / config | Data |
|---|---|---|---|
| Gateway (Caddy) | http://127.0.0.1:8191 | `config/Caddyfile` | runs `/skills/*` → :8011 (prefix stripped) and everything else → :8081 |
| Backend (Rust) | http://127.0.0.1:8081 | shared checkout `../backend`, binary `target/debug/academy`, overlay `config/backend.toml` | Postgres db `emai_academy`, Valkey db **2** |
| skills-ms-rooms | http://127.0.0.1:8011 | worktree `../skills-ms-rooms` (release/2026-09), env `config/skills-ms.env` | Postgres db `emai_skills`, Valkey db **3** (`AUTH_REDIS_URL` db 2) |
| Frontend (Nuxt) | http://localhost:3001 | `frontend/` (other agent) | `NUXT_PUBLIC_BASE_API_URL=http://127.0.0.1:8191` |
| Shared, unchanged | Postgres :5432, Valkey :6379, smtp4dev :2525 / UI :5050, render :8001, mocks :8100-8104 | started by `cd backend && devenv up` | |

Bootstrap stays on :3000 / :8190 / :8080 / :8010 with Valkey db 0/1 and the `academy`
and `academy-skills` databases. The EmAI scripts never touch these.

## Dev admin

| | |
|---|---|
| user | `admin` |
| email | `admin@emai.dev` |
| password | `emai-admin-dev` (dev only; override with `EMAI_ADMIN_PASSWORD` before the first `seed.sh`) |
| flags | admin, verified (terms not yet accepted, so the frontend may ask on first login) |
| token | `seed.sh` writes an impersonated access token (TTL 1d) to `.run/admin.token` |

The JWT secret is `emai-dev-secret` in both `config/backend.toml` `[jwt]` and
`config/skills-ms.env` `JWT_SECRET`. Bootstrap tokens get 401 on EmAI (verified).

## Commands

```bash
cd /Users/sebastian/develop/Bootstrap-Academy/emai-academy

# prerequisite: shared services (normally already running for Bootstrap)
#   cd ../backend && devenv up

scripts/dev-up.sh                 # backend, skills-ms-rooms, gateway, frontend (if frontend/package.json exists)
scripts/dev-up.sh --no-frontend   # what was run for this spike
scripts/dev-up.sh --only skills   # one service: backend | skills | gateway | frontend
scripts/seed.sh                   # admin user, token, skill sync, lesson-module registration (idempotent)
scripts/seed.sh --update-positions  # also re-apply hashed skill positions
scripts/reload-content.sh         # restart skills-ms (content is read at startup only) + seed.sh
scripts/dev-down.sh               # stop all tenant processes (only ports 8081/8011/8191/3001)
scripts/dev-down.sh skills        # stop one
```

Logs are in `.logs/{backend,skills,gateway,frontend,seed}.log`, pids in `.run/*.pid`.
Both are gitignored, as is `.state/` (the finance archive dirs).

What the scripts run, spelled out:

```bash
# databases (dev-up.sh creates them if missing)
../backend/.devenv/profile/bin/createdb -h 127.0.0.1 -U academy emai_academy
../backend/.devenv/profile/bin/createdb -h 127.0.0.1 -U academy emai_skills

# backend (serve auto-migrates, run_migrations = true)
direnv exec ../backend sh -c "cd ../backend && ACADEMY_CONFIG='$PWD/config/backend.toml:$PWD/../backend/config.dev.toml' exec target/debug/academy serve"

# skills-ms-rooms (cwd ../skills-ms-rooms). Env from config/skills-ms.env, plus placeholder fallback (below)
set -a; . ../emai-academy/config/skills-ms.env; set +a
.venv/bin/alembic upgrade head && .venv/bin/python -m api

# gateway
nix shell nixpkgs#caddy -c caddy run --config config/Caddyfile --adapter caddyfile

# admin + token
direnv exec ../backend sh -c 'ACADEMY_CONFIG=... target/debug/academy admin user create --admin --verified admin admin@emai.dev emai-admin-dev'
direnv exec ../backend sh -c 'ACADEMY_CONFIG=... target/debug/academy admin session impersonate admin'
# or: curl -X POST :8191/auth/sessions -d '{"name_or_email":"admin","password":"emai-admin-dev"}'

# skills (cwd ../skills-ms-rooms, env exported, COURSES must be set)
.venv/bin/python scripts/sync_skills.py --list ../emai-academy/content/skills
.venv/bin/python scripts/sync_skills.py --host http://127.0.0.1:8011 --token "Bearer $TOKEN" ../emai-academy/content/skills
```

## Verification (all run against the live stack)

| Check | Result |
|---|---|
| `GET :8191/health` | `{"database":true,"cache":true,"email":true}` |
| `GET :8191/skills/docs` | 200 |
| `GET :8191/skills/courses` | 200 (placeholder course until content lands, see below) |
| `GET :8191/skills/rooms/capabilities` | `{"enabled":true}` |
| `GET :8191/skills/rooms?path=placeholder-boot` | 401 without a token, 200 with the admin token (so the `ordinary-authority` round trip to :8081/auth works) |
| `POST :8191/skills/rooms/placeholder-boot-unit/complete` | 200, the unit is completed |
| `GET :8191/skills/skilltree`, `/character-areas` | 200 |
| `sync_skills.py` round trip (a temp root and sub-skill added, then deleted) | works; the tree is empty again |
| `POST :8191/auth/sessions` (admin / password) | returns a session |
| CORS from `Origin: http://localhost:3001` on /skills | `Access-Control-Allow-Origin: *` |
| Bootstrap token against EmAI | 401 (isolated) |
| Bootstrap `:8190/health`, `:3000` | still all true / 200 |
| upstream repos | `frontend`, `skills-ms`, `skills-ms-rooms`: `git status` clean. `backend` shows only the pre-existing DEV_SETUP deviations. |

## Things a builder needs to know

1. **greenlet was missing from the skills-ms venv.** The lock's greenlet markers
   don't match macOS arm64 (`platform_machine == "arm64"`), so SQLAlchemy asyncio
   fails with "the greenlet library is required". `scripts/lib.sh` pip-installs
   `greenlet==3.0.3` into `skills-ms-rooms/.venv`. **`nix develop` in skills-ms-rooms
   runs `poetry install --sync`, which removes it again**, so the scripts call
   `.venv/bin/python` directly and reinstall greenlet whenever it's missing.
   (Upstream bug candidate. Not filed, per the no-PR rule.)
2. **Content fallback.** `content/` belongs to the content and module agents. At boot
   time `learning_rooms.json`, `character_areas.json` and course YAMLs didn't exist yet,
   so `lib.sh:skills_env` falls back to the clearly marked files in
   `config/placeholders/`: a `placeholder-boot` path/unit/course and one
   `physical-ai` area with `include_unassigned_roots`. The real `content/` files
   always win. Nothing is written into `content/`. **Once content lands, run
   `scripts/reload-content.sh`.** The running skills-ms currently serves the
   placeholders.
3. **The skills-ms env file is used in two ways.** `skills-ms-rooms/.env` is a
   symlink to `config/skills-ms.env`, so `poe api` / `poe migrate` see the same
   values. JSON values are single-quoted (`LESSON_MODULE_ORIGINS='["http://localhost:3001"]'`),
   which works for both sh and poe's bash-like parser. `PRIVATE_COURSES_DIRECTORY` and
   `PRIVATE_LESSON_MODULES_ROOT` are commented out, because they must be existing
   real directories or startup fails. Uncomment them once the directories exist.
4. **Lesson modules.** `seed.sh` registers every `content/modules/**/module.json`. A
   descriptor with `entry_url` is used as-is. One with only `{id, api_version, entry}`
   (the module agent's current format) is registered as
   `http://localhost:3001/lesson-modules/<id>/<entry>` (override the base with
   `EMAI_MODULE_BASE`), with `--replace`, so it's safe to re-run. **That URL only
   works if the frontend serves the built module at
   `frontend/public/lesson-modules/<id>/<entry>`.** Registered now:
   `robot-arm-kinematics`, `teleop-dataset-explorer`.
5. **Skill layout.** Optional `content/skills/layout.json`
   (`{"rows":5,"columns":5,"skills":{"<root_id>":{"row":..,"column":..,"icon":..}}}`)
   is applied by `seed.sh` via `PATCH /skilltree[/id]` after the sync.
6. **Backend overlay** (`config/backend.toml`): port 8081, db `emai_academy`,
   Valkey db 2, `email.from = "EmAI Academy DEV <academy@emai.dev>"`,
   `contact.email = "EmAI Robotics <info@emai.dev>"`, verify/reset/OAuth redirects on
   `http://localhost:3001`, `feedback` off (with `public_base_url` set to :3001),
   `skills_url = http://127.0.0.1:8011/`. Challenges and events keep the :8104
   mocks from `config.dev.toml`. The finance archives are in `.state/`. **Coins,
   premium and PayPal have no config switch.** Purchases are unavailable because
   `purchase.provision_window_seconds` is unset, and all courses are `price: 0`, so
   the frontend has to hide the rest. Email templates remain Bootstrap-branded.
7. **Caddy:** `nix shell nixpkgs#caddy` is resolved on each start (a few seconds).
   `admin off`, so it doesn't conflict with the Bootstrap Caddy.
