# EmAI Academy: what the content and tenant services need

Research notes for the EmAI tenant (read-only analysis of
`skills-ms-rooms` @ `37251f8` (release/2026-09) and `backend` @ `fbe5e60` (develop)).
All paths below are relative to `<workspace>/`.
Every schema example in this file was validated against the real pydantic models
(`api.schemas.rooms.Catalogue`, `api.schemas.course.Course`,
`CharacterAreaCatalogue`, `LessonModuleDescriptor`) using the skills-ms venv.

## TL;DR: the gotchas

1. **`AUTH_URL` must end in `/auth` and `SHOP_URL` in `/shop`.** skills-ms builds
   `<AUTH_URL>/_internal/...` (`api/services/internal.py:38`). The backend serves
   these at `/auth/_internal/...` and `/shop/_internal/...`. I checked this against
   the running backend: `POST /auth/_internal/ordinary-authority` returns 422, and
   `/_internal/ordinary-authority` returns 404. The rooms branch calls
   `ordinary-authority` for **every** authenticated request (`api/auth.py`,
   `api/services/auth.py:ordinary_authority`). With the wrong URL, every logged-in
   call fails with 503 or returns "not logged in". The Bootstrap skills-ms `.env`
   uses `AUTH_URL=http://127.0.0.1:8080` (no `/auth`), so don't copy it.
2. **Under `poe`, the `.env` file overrides the process env.** poethepoet 0.24.2
   loads the task `envfile` after `os.environ`. So `poe api` / `poe migrate` always
   use `skills-ms-rooms/.env`. `nix develop`'s shellHook runs `poe setup`, which
   copies `dev.env` to `.env` if `.env` is missing. Pick one approach:
   (a) copy or symlink `emai-academy/config/skills-ms.env` to `skills-ms-rooms/.env`
   (allowed: an untracked local file); or (b) skip poe and run
   `set -a; . /abs/emai-academy/config/skills-ms.env; set +a; python -m api`
   inside `nix develop` (pydantic `Settings` has no `env_file`, so it reads only the
   process env).
3. **Only `DEBUG=True` turns on CORS in skills-ms** (`api/app.py`: `CORSMiddleware`
   only `if settings.debug`). The frontend on :3001 calls the gateway on :8191
   cross-origin, so the dev env must set `DEBUG=True`.
4. **Use separate Valkey DBs, and don't share skills-ms's `REDIS_URL` with
   Bootstrap.** skills-ms runs `KEYS func_cache:courses:*` + `DEL` on startup
   (`api/utils/cache.py:47`, `app.py:on_startup`). On a shared DB 1 this would wipe
   Bootstrap's cached course data. The backend has **no key prefix** option
   (`academy_cache/valkey/src/lib.rs` only takes `url`), so the DB index goes in the
   URL. skills-ms's `AUTH_REDIS_URL` **must be the same DB as the EmAI backend's
   `[cache] url`**, because that is where the backend writes
   `access_token_invalidated:<hash>` on logout (`api/schemas/user.py:32`).
5. **Set `COURSES` explicitly.** The default is the relative `config/courses`, i.e.
   all 87 Bootstrap courses in the worktree. Point it at
   `/abs/emai-academy/content/courses`. `LEARNING_ROOMS_CONTENT` and
   `PRIVATE_COURSES_DIRECTORY` must be **absolute, regular, non-symlink** paths.
   If they aren't, startup fails closed.
6. **Room activities never award XP** (`api/services/rooms.py:1` docstring). Skill
   XP comes only from `PUT /courses/{id}/lectures/{lecture}/complete`, which gives
   `LECTURE_XP` (10) to every sub-skill that lists the course
   (`api/endpoints/course.py:264-294`). If the skill tree should show progress,
   each course needs at least a small `sections:` video part.
7. **The `exercise` room kind needs challenges-ms.** `challenge_status()` calls
   `CHALLENGES_URL/tasks/{task}/{multiple_choice|matchings|coding_challenges}/{sub}`
   with the user token (`rooms.py:179-223`). Nothing runs on :8005, so for the spike
   use `guided-lesson`, `video` and `custom` only. They are all checked server-side
   through `completion.answer`, which needs no extra service.
8. **Custom lesson modules in local dev:** the frontend only loads an `http:`
   module URL when it is **same-origin with the page** and the host is
   localhost, 127.0.0.1 or [::1] (`frontend/utils/learningModule.ts:learningModuleUrl`).
   The simplest route is a *public* module served from the EmAI Nuxt app's
   `public/` folder (`http://localhost:3001/lesson-modules/<id>/entry.mjs`). Private
   packages go through `/skills/lesson-assets/...` plus `X-Accel-Redirect`. That
   needs Caddy `handle_response`, and a Nuxt same-origin proxy for `/skills` (see
   section 4.6).
9. **Backend emails, invoices and the purchase text are hard-coded "Bootstrap
   Academy" / bootstrap.academy** (`academy_assets/assets/templates`,
   `academy_core/purchase/impl/src/lib.rs:246-506`,
   `academy_core/moderation/impl/src/email.rs:5`). Only the sender (`email.from`),
   `contact.email` and the redirect URLs can be configured. Rebranding the templates
   would mean upstream changes, so treat it as a known spike limitation.

---

## 1. skills-ms-rooms: settings, running, migrations

### 1.1 Settings (`skills-ms-rooms/api/settings.py`, pydantic v1 `BaseSettings`, env var = upper-case field name)

| Env var | Default | EmAI value / notes |
|---|---|---|
| `HOST` / `PORT` | `0.0.0.0` / `8000` | `127.0.0.1` / **`8011`** |
| `ROOT_PATH` | `""` | `/skills`. Informational only (OpenAPI `servers`). Routes are still served at `/` (Starlette 0.32), so the gateway must strip the prefix (`handle_path`). |
| `DEBUG` | False | **True** (CORS, gotcha 3). Also enables the `check_responses` middleware. |
| `RELOAD` | False | True is fine, but it only watches Python code in the cwd. **Content changes need a restart** (catalogue and courses are loaded once: `lru_cache` / module import). |
| `JWT_SECRET` | random | **Must equal the backend `[jwt] secret`** (user tokens are HS256, `api/utils/jwt.py`). Use an EmAI-specific secret, e.g. `emai-dev-secret`, so Bootstrap tokens are rejected. |
| `INTERNAL_JWT_SECRET_{AUTH,SHOP,SKILLS}` | `""` → falls back to `JWT_SECRET` | Leave empty. The backend `[internal.secrets]` also falls back to `jwt.secret`. |
| `AUTH_URL` | `""` | **`http://127.0.0.1:8081/auth`** (gotcha 1) |
| `SHOP_URL` | `""` | **`http://127.0.0.1:8081/shop`**. Used for `has_premium` (only for non-free courses or paths) and `spend_coins`. |
| `CHALLENGES_URL` | `http://127.0.0.1:8005` | Leave it. Only used by `exercise` units, or units with `LEARNING_ROOMS_EXERCISE_REFS`. |
| `ROOMS_ENABLED` | False | **True**. `GET /rooms/capabilities` returns `{"enabled": ...}`, and the frontend reads it. |
| `LEARNING_ROOMS_CONTENT` | None → packaged `api/content/learning_rooms.json` (Bootstrap python-loops + it-foundations) | `/abs/emai-academy/content/learning_rooms.json` (absolute regular file, no symlink; parsed at startup in `app.py:on_startup`) |
| `LEARNING_ROOMS_EXERCISE_REFS` | `{}` | JSON `{"unit-id": {"type": ..., "task_id": uuid, "subtask_id": uuid}}`. Only allowed for `exercise`/`custom`/`video` units with no `completion`. |
| `LESSON_MODULE_ORIGINS` | `[]` | JSON list, e.g. `["http://localhost:3001"]` |
| `LESSON_MODULE_LOCAL_DEVELOPMENT` | False | True (lets `http://localhost...` origins pass) |
| `PRIVATE_LESSON_MODULES_ROOT` | None | Optional: `/abs/emai-academy/content/lesson-modules-private` (every path component a real dir) |
| `PRIVATE_LESSON_MODULE_GRANT_TTL` | 3600 | 60..28800 |
| `CHARACTER_AREAS` | packaged `api/content/character_areas.json` (one "IT" area) | `/abs/emai-academy/content/character_areas.json` |
| `LECTURE_XP` | 10 | XP per completed lecture |
| `COURSES` | `config/courses` (relative to cwd!) | **`/abs/emai-academy/content/courses`** |
| `PRIVATE_COURSES_DIRECTORY` | None | Optional overlay dir (absolute, non-symlink, `*.yml` regular files). Same ID overrides, new IDs are added (`api/services/courses.py:_load_courses`). |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | `http://127.0.0.1:8191/skills`. Used to build mp4 stream links (`/lectures/{token}/{file}`) and private module asset URLs. |
| `MP4_LECTURES` | `lectures` (relative) | `/abs/emai-academy/content/lectures`. File layout: `<course_id>/<lecture_id>.mp4` |
| `DATABASE_URL` | mysql | `postgresql+asyncpg://academy@127.0.0.1:5432/emai_skills` |
| `POOL_SIZE` / `MAX_OVERFLOW` | 20 / 20 (dev.env: 100) | Suggest 5 / 10. Plus one reserved admission pool (`api/database/database.py:96`). |
| `REDIS_URL` | `redis://redis:6379/1` | **`redis://127.0.0.1:6379/3`** |
| `AUTH_REDIS_URL` | `redis://redis:6379/0` | **`redis://127.0.0.1:6379/2`** (= EmAI backend cache DB) |
| `SMTP_*` | | smtp4dev: `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=academy SMTP_PASSWORD=academy SMTP_TLS=False SMTP_STARTTLS=False SMTP_FROM="EmAI Academy DEV <academy@emai.dev>"` |
| `SENTRY_DSN` | None | unset |

Valkey has 16 DBs (`config get databases`), and DBs 0/1 are Bootstrap's.
Postgres currently has `academy` and `academy-skills`; `emai_academy` and
`emai_skills` still need to be created.

### 1.2 Proposed `emai-academy/config/skills-ms.env`

```dotenv
LOG_LEVEL=DEBUG
HOST=127.0.0.1
PORT=8011
ROOT_PATH=/skills
DEBUG=True
RELOAD=False
CACHE_TTL=300
JWT_SECRET=emai-dev-secret
INTERNAL_JWT_SECRET_AUTH=
INTERNAL_JWT_SECRET_SHOP=
INTERNAL_JWT_SECRET_SKILLS=
AUTH_URL=http://127.0.0.1:8081/auth
SHOP_URL=http://127.0.0.1:8081/shop
CHALLENGES_URL=http://127.0.0.1:8005
ROOMS_ENABLED=True
LEARNING_ROOMS_CONTENT=<workspace>/emai-academy/content/learning_rooms.json
CHARACTER_AREAS=<workspace>/emai-academy/content/character_areas.json
COURSES=<workspace>/emai-academy/content/courses
MP4_LECTURES=<workspace>/emai-academy/content/lectures
LESSON_MODULE_ORIGINS=["http://localhost:3001"]
LESSON_MODULE_LOCAL_DEVELOPMENT=True
LECTURE_XP=10
PUBLIC_BASE_URL=http://127.0.0.1:8191/skills
INTERNAL_JWT_TTL=10
SMTP_HOST=127.0.0.1
SMTP_PORT=2525
SMTP_USER=academy
SMTP_PASSWORD=academy
SMTP_FROM="EmAI Academy DEV <academy@emai.dev>"
SMTP_TLS=False
SMTP_STARTTLS=False
DATABASE_URL=postgresql+asyncpg://academy@127.0.0.1:5432/emai_skills
POOL_RECYCLE=300
POOL_SIZE=5
MAX_OVERFLOW=10
SQL_SHOW_STATEMENTS=False
REDIS_URL=redis://127.0.0.1:6379/3
AUTH_REDIS_URL=redis://127.0.0.1:6379/2
```

### 1.3 Running it

- The dev shell comes from `skills-ms-rooms/flake.nix`: python311, poetry,
  poethepoet 0.24.2 and yt-dlp. Its shellHook runs `poe setup` (`poetry install
  --sync`, which creates `skills-ms-rooms/.venv`, then `cp dev.env .env` if missing)
  followed by `source .venv/bin/activate`. The first run takes a while.
  `poetry.lock` is identical to `skills-ms` (develop), but the worktree gets its own
  `.venv` (allowed).
- Poe tasks (`pyproject.toml` `[tool.poe.tasks]`):
  - `poe api` runs `api.main:main` with `envfile=.env`, i.e. `uvicorn api.app:app`.
  - `poe migrate` runs `alembic upgrade head` with `envfile=.env`.
  - `poe check` prints the courses and runs `sync_skills --list config/skills`.
    **The skills path is hard-coded to the upstream `config/skills`**, so it can't
    validate EmAI skills. Use `python scripts/sync_skills.py --list <dir>` instead
    (section 3).
  - `poe sync_skills` runs `python scripts/sync_skills.py` **without** an envfile.
  - `poe env` pretty-prints the effective settings. Handy for checking the overlay.
- The cwd **must be `skills-ms-rooms/`**: `alembic.ini` uses `script_location`
  relative to it, and `import api` must resolve to the worktree.

Recommended EmAI start (no `.env` juggling):

```bash
cd <workspace>/skills-ms-rooms
nix develop --command sh -c '
  set -a; . <workspace>/emai-academy/config/skills-ms.env; set +a
  alembic upgrade head && python -m api'
```

(Alternative: `cp ../emai-academy/config/skills-ms.env .env && nix develop --command sh -c 'poe migrate && poe api'`.)

### 1.4 Database and migrations

- Create the DB once. devenv's Postgres has superuser `academy` and no `postgres`
  role, and the client binaries are in `backend/.devenv/profile/bin/`:
  `backend/.devenv/profile/bin/createdb -h 127.0.0.1 -U academy emai_skills`
- Alembic (`alembic/env.py`) takes the URL from `settings.database_url`. Its version
  table is `skills_alembic_version`. There are 21 revisions, ending with
  `2026_09_13_1800-lessonmodules001_registry.py`. Relevant new tables:
  `skills_lesson_modules` (module registry), plus the room state/request tables from
  `learningrooms001`/`learningreviews001`.
- Migrations are **not** run on API start. Run `alembic upgrade head` (or
  `poe migrate`) before `python -m api`. The NixOS module does the same in
  `preStart`.

---

## 2. Courses (YAML)

### 2.1 Schema (`api/schemas/course.py`)

One file per course, `<course-id>.yml`. **The ID is the filename**, and an `id:`
key, if present, must match it (`services/courses.py:_load_courses`). Any invalid
file aborts startup with `Invalid course definition: <id>`.

| Field | Type | Required |
|---|---|---|
| `title` | str | yes |
| `description`, `category`, `language`, `image` | str or null | no (implicit None) |
| `authors` | list of `{name, url}` (str→str dict) | yes |
| `price` | int ≥ 0 (MorphCoins). **0 = free.** Free courses skip every premium, ownership and shop call (`endpoints/course.py:has_course_access`). | yes |
| `learning_goals`, `requirements` | list[str] | yes (may be `[]`) |
| `last_update` | int (unix ts) | yes |
| `learning_path_id` | `^[a-z0-9][a-z0-9-]{0,79}$` linking to a room path | no |
| `translations` | `{<lang>: {title?, description?, learning_goals?, requirements?}}` | no |
| `sections` | list of `Section` | no (default `[]`) |
| `curriculum` | `CurriculumDefinition` (see below) | no |

`Section = {id, title, description?, lectures: [Lecture]}`. Section and lecture
IDs must be unique within the course (`_check_course_definitions`).

**Lecture types (only two):**

- `type: youtube`: `{id, title, description?, video_id, duration(sec)}`
- `type: mp4`: `{id, title, description?, duration}`. The file is at
  `MP4_LECTURES/<course_id>/<lecture_id>.mp4`. A missing file only logs a warning
  at startup.
  `GET /courses/{c}/lectures/{l}` issues a Redis token (TTL `STREAM_TOKEN_TTL`=8h)
  and returns `PUBLIC_BASE_URL/lectures/<token>/<c>_<l>.mp4`. That URL streams in
  4 MiB range chunks with no auth.

In-room videos (`room: video`, section 4) are a separate mechanism. They only
accept YouTube or **HTTPS** mp4 URLs.

`curriculum` (`api/schemas/curriculum.py`) is an explicit ordered composition:
`{chapters: [{id, title{de,en}}], lessons: [{id, title{de,en}, chapter_id?, activities: [{id, source, title?, roles?}]}]}`.
The possible `source` values:

- `{kind: room, unit_id}`: `id` **must equal** `unit_id`, and the unit must belong
  to the course's `learning_path_id`.
- `{kind: lecture, course_id, section_id, lecture_id}`: `course_id` = this course.

`kind: challenge` is rejected. `roles` is optional and takes
`explanation` / `practice`. Without `curriculum`, the curriculum is derived
automatically: each path unit becomes one lesson (chapters from the path), then
each section becomes a chapter with one lesson per lecture
(`services/curriculum.py:definitions`).

### 2.2 Real upstream examples

- Room-backed course: `skills-ms-rooms/config/courses/it-foundations.yml`
  (`price: 0`, `learning_path_id: it-foundations`, `sections: []`, `translations.en`).
- mp4 video course: `config/courses/nmap.yml` (a single `section` with `type: mp4` lectures).
- Upstream has 2407 youtube and 206 mp4 lectures in total.

### 2.3 EmAI example (validated)

```yaml
# content/courses/physical-ai-grundlagen.yml
title: "Physical AI Grundlagen"
description: "Was Physical AI ist, wie kognitive Roboter wahrnehmen, entscheiden und handeln."
category: Physical AI
language: de
image: null
authors:
  - name: EmAI Robotics
    url: https://emai.dev
price: 0
learning_path_id: physical-ai-grundlagen
learning_goals:
  - Physical AI von klassischer Automatisierung abgrenzen
requirements: []
last_update: 1790812800
translations:
  en:
    title: "Physical AI fundamentals"
    description: "What Physical AI is and how cognitive robots perceive, decide and act."
    learning_goals: ["Distinguish Physical AI from classic automation"]
    requirements: []
sections:                       # optional; needed if the skill tree should earn XP
  - id: vortrag
    title: "Vortrag"
    description: null
    lectures:
      - {id: keynote, title: "Keynote", description: null, type: youtube, video_id: dQw4w9WgXcQ, duration: 600}
      - {id: werkstatt, title: "Werkstatt-Rundgang", description: null, type: mp4, duration: 300}
curriculum:                     # optional explicit lesson composition
  chapters:
    - {id: begriffe, title: {de: "Begriffe", en: "Concepts"}}
  lessons:
    - id: lektion-1
      title: {de: "Was ist Physical AI?", en: "What is Physical AI?"}
      chapter_id: begriffe
      activities:
        - {id: pai-was-ist-physical-ai, source: {kind: room, unit_id: pai-was-ist-physical-ai}}
        - {id: pai-video-intro, source: {kind: room, unit_id: pai-video-intro}, roles: [explanation]}
        - {id: keynote, source: {kind: lecture, course_id: physical-ai-grundlagen, section_id: vortrag, lecture_id: keynote}}
```

### 2.4 Validation

- Courses are validated on import of `api.services.courses`, i.e. at API start, or
  with a cheap offline check:
  `COURSES=/abs/.../content/courses python -c 'from api.services import courses; print(list(courses.COURSES))'`
  (inside `nix develop`, cwd `skills-ms-rooms`).
- `curriculum` room references are **only checked at request time**
  (`curriculum.definitions` raises 503 "Dieser Kurs kann gerade nicht geladen
  werden."). The EmAI content check script should cross-check them against
  `learning_rooms.json`.

---

## 3. Skills (YAML) and `scripts/sync_skills.py`

### 3.1 Schema (`scripts/sync_skills.py`)

One file per **root skill**. **Root ID = filename** (`<id>.yml`, IDs must match
`^[a-z0-9_]+$`, so underscores, not hyphens).

```yaml
# content/skills/daten_fuer_robot_learning.yml
name: Daten für Robot Learning
dependencies:            # root-skill IDs (other files)
  - roboter_hardware_embodiments
  - robotik_software_grundlagen
skills:                  # sub-skills; IDs globally unique, ^[a-z0-9_]+$
  teleoperation_und_datenerfassung:
    name: Teleoperation & Datenerfassung
    dependencies: []     # sub-skill IDs within the same root
    courses:             # course IDs (^[a-z0-9][a-z0-9_-]*$), must exist in COURSES
      - lerobot-datensaetze
  datenqualitaet:
    name: Datenqualität & Annotation
    dependencies: [teleoperation_und_datenerfassung]
    courses: [datenqualitaet-robot-learning]
```

- Checks: duplicate IDs, dependencies defined, every referenced course exists in
  `COURSES`.
- **Courses link to skills only through sub-skills** (`courses:` becomes the
  `skill_course` table). That link drives XP on lecture completion and the course
  list per skill in the frontend.
- The upstream model has no "OR" dependency. Skill 7 ("req 5 or 6") has to be
  modelled as depending on both, or on just one of them.
- Positions: `row`/`column` = `sha256("row:"+id) % 20` (and the same for column).
  Root skills get `sub_tree_rows/columns = 20`. The global tree defaults to 20×20
  (`models/tree_settings.py`). For a tidy 9-node EmAI tree, use the admin API after
  syncing:
  `PATCH /skilltree` `{"rows": 5, "columns": 5}` and
  `PATCH /skilltree/{id}` `{"row":..,"column":..,"sub_tree_rows":..,"sub_tree_columns":..,"icon":..}`.
  Note that the sync script only re-applies positions with `--update-positions`.
  Without it, manual positions persist.

### 3.2 Usage

`sync_skills.py` imports `api.services.courses`, so **`COURSES` must be exported**
(`poe sync_skills` loads no `.env`).

```bash
cd skills-ms-rooms
nix develop --command sh -c '
  set -a; . ../emai-academy/config/skills-ms.env; set +a
  python scripts/sync_skills.py --list ../emai-academy/content/skills            # validate only
  python scripts/sync_skills.py --host http://127.0.0.1:8011 --token "Bearer $TOKEN" ../emai-academy/content/skills'
```

Flags: `--list`, `--dry`, `--update-positions`, `--host`, `--token` (the full header value, including `Bearer `).
It is idempotent: it diffs against `GET /skilltree` and adds, patches or deletes.
Use the service port directly (no `/skills` prefix). The admin endpoints need
`admin_auth`, which calls the backend's `ordinary-authority`, so the EmAI backend
must be up and `AUTH_URL` correct.

### 3.3 Admin user and token on a fresh backend DB

Backend CLI (`backend/academy/src/commands/admin/user.rs`, `session.rs`):

```bash
cd backend
direnv exec "$PWD" sh -c 'ACADEMY_CONFIG=/abs/emai-academy/config/backend.toml:$PWD/config.dev.toml \
  target/debug/academy admin user create --admin --verified admin admin@emai.dev "<password>"'
# token without a login round-trip (prints the access token on stdout):
TOKEN=$(direnv exec "$PWD" sh -c 'ACADEMY_CONFIG=... target/debug/academy admin session impersonate admin')
```

- `admin user create [--admin] [--verified] [--disabled] <name> <email> <password>`
  (aliases `a u c`). `--disabled` is refused. The user gets `terms_version: None`,
  so the frontend may ask the admin to accept terms on first login
  (`POST /auth/users/{id}/terms`).
- Migrations must be applied first (by `serve` or `academy migrate up`), because
  `admin` commands don't migrate.
- Alternative: `POST http://127.0.0.1:8081/auth/sessions` with
  `{"name_or_email":"admin","password":"..."}` returns `.access_token`. Access TTL
  is `1d` in `config.dev.toml`.
- `academy migrate demo --force` would reset the DB with demo users
  (`admin` / "secure admin password", `academy_demo/src/user.rs`). Not needed for EmAI.

---

## 4. Learning rooms

### 4.1 Catalogue schema (`api/schemas/rooms.py`; file = `LEARNING_ROOMS_CONTENT`)

All models are `extra = "forbid"`. IDs match `^[a-z0-9][a-z0-9-]{0,79}$`.

```
Catalogue { paths: [CataloguePath], units: [CatalogueUnit] }
CataloguePath { id, title{de,en}, direction_id?, chapters?: [{id, title{de,en}}], units: [unit ids in order] }
CatalogueUnit {
  id, path_id, chapter_id?, title{de,en},
  room: loop-explorer|percentage-explorer|guided-lesson|io-machine|bit-lab|file-workspace|
        step-machine|network-lab|exercise|custom|video,
  content: {de: {...}, en: {...}}   # free-form per renderer, sent to the client as-is
  teaches: [concept], practices: [concept], requires: [concept],
  retired: bool,                    # required
  completion?: {kind: "introduced", answer: {...}, allow_skip: bool=false},
  exercise?: {type: multiple_choice|matching|coding, task_id: uuid, subtask_id: uuid},
  module_id?: id                    # custom only
  # "module" is forbidden in content: module URLs come from the DB registry
}
```

Catalogue rules (`Catalogue.references_are_consistent`, `CatalogueUnit.completion_matches_room`):

- Path and unit IDs are unique. **Every unit is in exactly one path's `units`**,
  and `unit.path_id` equals that path.
- If a path has `chapters`, every unit needs a `chapter_id`, and units must follow
  the chapter order contiguously.
- `exercise` rooms: **no** `completion` (they require `exercise`, from content or
  `LEARNING_ROOMS_EXERCISE_REFS`).
- All non-exercise, non-custom, non-video rooms: `completion` is **required** and
  `exercise` is forbidden.
- `custom`: `module_id` required; `completion` **or** `exercise`, not both.
- `video`: each of `content.de` and `content.en` needs
  `video: {type: youtube, id: <11 chars>}` or `{type: mp4, url: https://...}`
  (HTTPS only, no userinfo). If there is a `completion`, its answer must be exactly
  `{"viewed": true}`.
- In practice a `custom` or `video` unit with neither `completion` nor `exercise`
  is **unavailable** (404 from `find_unit`, `rooms.py:125-133`).

`teaches`/`practices`/`requires` are free concept strings. Outside a course
context, a unit only opens once all of its `requires` have been introduced by
completed or skipped units (`introduced_concepts`, `rooms.py:110`). In course
context (`?course=`) prerequisites are **not** enforced.

### 4.2 Server-side completion and answer checking (`rooms.py:596-612`, `mutate_room`)

- `POST /rooms/{unit}/complete` `{request_id: uuid, expected_revision: int, action: "complete"|"skip", answer: {...}, review_id?, attempt_id?}`
  - `skip` is allowed only if `completion.allow_skip`. The result is status
    `skipped`, and the unit's `teaches` still count as introduced.
  - Units with `exercise`: the server calls challenges-ms and needs `solved: true`.
    The result is `{kind: "solved"}` (teaches + practices).
  - Otherwise: canonical JSON of `answer` must **equal** `completion.answer`
    (`json.dumps(sort_keys=True)`, so `true` ≠ `1`). A mismatch gives 422 "Check
    your answer and try again", a match gives `{kind: "introduced"}`.
  - Already completed or skipped gives 409.
- `PUT /rooms/{unit}/state` `{request_id, expected_revision, state: {...} (≤64 KiB), review_id?}`
  is an autosave. The first save makes the status `in_progress`.
- `POST /rooms/{unit}/review` `{request_id, expected_revision}` starts a
  repetition without erasing the original result.
- Optimistic concurrency: a `revision` mismatch gives 409. `request_id` is
  idempotent (replay returns the stored progress, and the same ID with a different
  body gives 409). The last 4 receipts are kept per unit.
- **The client receives `content` including check answers.** `answer` values in
  guided-lesson content are public. The server check protects against forged
  completion, not against cheating by reading the JSON.

### 4.3 Endpoints (all prefixed `/skills` via the gateway)

Rooms (`api/endpoints/rooms.py`; everything except capabilities needs a verified
user (admins are exempt) and `ROOMS_ENABLED`; responses are `Cache-Control: private, no-store`):

| Method / path | Purpose |
|---|---|
| `GET /rooms/capabilities` | `{"enabled": bool}` (public) |
| `GET /rooms?path=&after=&continuous=&direction=&course=&unit=` | Next room for a path. **Default `path=python-loops`**, so the EmAI frontend must always pass `path` (or `course`). Returns `Rooms {paths, path, next: RoomEnvelope?, empty_reason}` |
| `GET /rooms/{unit}?course=` | `RoomEnvelope {unit (public, module resolved), progress, review_available}` |
| `PUT /rooms/{unit}/state?course=` | autosave |
| `POST /rooms/{unit}/complete?course=` | complete/skip |
| `POST /rooms/{unit}/review?course=` | start review |

Courses and curriculum (`endpoints/course.py`, `curriculum.py`): `GET /courses`,
`GET /courses/{id}/summary`, `GET /courses/{id}` (verified + access),
`GET /courses/{id}/curriculum`, `GET /courses/{id}/lessons/{lesson}` (activities
with `kind` ∈ video/explainer/quiz/matching/coding/custom/legacy-room, `content`,
`module`, `progress`), `GET /courses/{id}/lectures/{lecture}` (mp4 link),
`PUT /courses/{id}/lectures/{lecture}/complete` (XP),
`GET /courses/{id}/next_unseen`, `GET /course_access`,
`POST /course_access/{id}[/offer]`.
Skill tree: `GET/PATCH /skilltree`, `POST/PATCH/DELETE /skilltree/{root}[/{sub}]`,
`GET /skilltree/{root}`. Areas: `GET /character-areas`,
`GET /character-areas/{id}/skilltree`. XP: `GET /xp/{user_id|me}`.
Assets: `GET|HEAD /lesson-assets/{grant}/{sha}/{path}`.
Internal (backend→skills, internal JWT aud `skills`): `/_internal/users/{id}`
(DELETE), `/_internal/users/{id}/export`,
`/_internal/users/{id}/course-rights/{op}`, `/_internal/skills...`,
`/_internal/courses`. The backend also calls `/_internal/moderation/{path}`
(`academy_extern/impl/src/microservices.rs:227`), which **doesn't exist** in this
skills-ms. That only matters for moderation flows.

Path access (`accessible_paths`, `rooms.py:145`): a path linked by a course is
open if any linked course is free, or the user is admin, owns the course or has
premium. Unlinked paths are open to every verified user. EmAI: all
`price: 0` courses, so there are no shop calls.

### 4.4 Minimal valid unit per activity kind usable by EmAI (validated)

**guided-lesson** (frontend `components/learning/GuidedLesson.vue`,
`utils/guidedLesson.ts`). `content.<lang>.steps[]` =
`{id, title, body, code?, output?, stdin?, note?, experiment?, check?}`, and
`check = {id, question, options: [{value, text}], answer, correct, tryAgain}`. The
frontend sends `answer = {<check.id>: <chosen value>}` for **all** checks (`lessonAnswers`).
So `completion.answer` must list every check with its correct value, and the de
and en check IDs/answers must match. With no checks, use `answer: {}`.
`experiment` only supports `operation.kind` `multiply` / `threshold`.

```json
{"id":"pai-was-ist-physical-ai","path_id":"physical-ai-grundlagen","chapter_id":"pai-begriffe",
 "title":{"de":"Was ist Physical AI?","en":"What is Physical AI?"},
 "room":"guided-lesson","teaches":["pai-embodiment"],"practices":[],"requires":[],"retired":false,
 "completion":{"kind":"introduced","answer":{"embodiment":"b"},"allow_skip":true},
 "content":{
  "de":{"steps":[
   {"id":"intro","title":"KI mit Körper","body":"Physical AI verbindet Wahrnehmung, Entscheidung und Handlung.","note":"Wir sprechen von kognitiven Robotern."},
   {"id":"embodiment","title":"Embodiment","body":"Erst Sensoren und Aktoren machen ein Modell zum Agenten.",
    "check":{"id":"embodiment","question":"Was macht ein Modell zu Physical AI?",
     "options":[{"value":"a","text":"Mehr Parameter"},{"value":"b","text":"Ein Körper mit Sensoren und Aktoren"}],
     "answer":"b","correct":"Genau.","tryAgain":"Denk an Sensoren und Aktoren."}}]},
  "en":{"steps":[
   {"id":"intro","title":"AI with a body","body":"Physical AI connects perception, decision and action."},
   {"id":"embodiment","title":"Embodiment","body":"Sensors and actuators turn a model into an agent.",
    "check":{"id":"embodiment","question":"What makes a model Physical AI?",
     "options":[{"value":"a","text":"More parameters"},{"value":"b","text":"A body with sensors and actuators"}],
     "answer":"b","correct":"Exactly.","tryAgain":"Think about sensors and actuators."}}]}}}
```

**video** (frontend `VideoActivity.vue`: optional `content.body`/`title`,
`video.captions_url` (https); it stores `state.position`; the "Fertig" button
sends `{viewed: true}`):

```json
{"id":"pai-video-intro","path_id":"physical-ai-grundlagen","chapter_id":"pai-begriffe",
 "title":{"de":"Kognitive Roboter im Einsatz","en":"Cognitive robots at work"},
 "room":"video","teaches":["pai-use-cases"],"practices":[],"requires":[],"retired":false,
 "completion":{"kind":"introduced","answer":{"viewed":true},"allow_skip":true},
 "content":{"de":{"body":"Kurzer Überblick.","video":{"type":"youtube","id":"dQw4w9WgXcQ"}},
            "en":{"body":"Short overview.","video":{"type":"mp4","url":"https://media.example.org/emai/intro-en.mp4","captions_url":"https://media.example.org/emai/intro-en.vtt"}}}}
```

A local http mp4 is **rejected** (server and client both require https), so use
YouTube, or course `sections` with `type: mp4` (streamed through skills-ms).

**custom** (a trusted ES module; `content` is passed to the module unchanged):

```json
{"id":"pai-so101-teleop","path_id":"physical-ai-grundlagen","chapter_id":"pai-praxis",
 "title":{"de":"SO-101 teleoperieren","en":"Teleoperate the SO-101"},
 "room":"custom","module_id":"so101-teleop",
 "teaches":["pai-teleop"],"practices":["pai-embodiment"],"requires":["pai-embodiment"],"retired":false,
 "completion":{"kind":"introduced","answer":{"done":true},"allow_skip":false},
 "content":{"de":{"intro":"Steuere den Arm."},"en":{"intro":"Control the arm."}}}
```

**exercise** (schema-valid, but it **needs challenges-ms** on `CHALLENGES_URL`,
which isn't running. Without it every request touching the unit returns 503 "The
exercise could not be checked". Avoid it in the spike, or build a mock that
answers `GET /tasks/{t}/multiple_choice/{s}` with
`{id, task_id, type:"MULTIPLE_CHOICE_QUESTION", solved, enabled, retired, creator}`):

```json
{"id":"pai-quiz","path_id":"physical-ai-grundlagen","chapter_id":"pai-praxis",
 "title":{"de":"Wissenscheck","en":"Knowledge check"},"room":"exercise",
 "teaches":[],"practices":["pai-embodiment"],"requires":["pai-embodiment"],"retired":false,
 "exercise":{"type":"multiple_choice","task_id":"00000000-0000-4000-8000-000000000001","subtask_id":"00000000-0000-4000-8000-000000000002"},
 "content":{"de":{"introduction":"Beantworte die Frage."},"en":{"introduction":"Answer the question."}}}
```

Path wrapper for the units above:

```json
{"paths":[{"id":"physical-ai-grundlagen","title":{"de":"Physical AI Grundlagen","en":"Physical AI fundamentals"},
  "direction_id":"emai",
  "chapters":[{"id":"pai-begriffe","title":{"de":"Begriffe","en":"Concepts"}},{"id":"pai-praxis","title":{"de":"Praxis","en":"Practice"}}],
  "units":["pai-was-ist-physical-ai","pai-video-intro","pai-so101-teleop","pai-quiz"]}],
 "units":[ ... ]}
```

The other renderers (`loop-explorer`, `io-machine`, `bit-lab`, `file-workspace`,
`step-machine`, `network-lab`; `content.schema = "it-lab/1"`, fixed `family` and
`scenario`, `checks[{id, question, options[{id, text}], answer, explanation}]`)
are hard-wired IT simulations in the frontend. They are not reusable for robotics.
`percentage-explorer` is in the backend enum but has no frontend renderer.

### 4.5 `character_areas.json` (`api/schemas/character_area.py`)

```json
{"areas":[{"id":"physical-ai","title":{"de":"Physical AI","en":"Physical AI"},
  "root_skill_ids":[],"include_unassigned_roots":true,"rows":5,"columns":5}]}
```

Area IDs are unique. A root may be in at most one area, and at most one area can
have `include_unassigned_roots`. **Every listed `root_skill_id` must exist in the
DB**, otherwise `/character-areas` returns 503. Sync skills first, or use
`include_unassigned_roots: true` with `root_skill_ids: []`. Possible split:
"Entscheider" (`physical_ai_grundlagen`, `safety_security_souveraenitaet`,
`physical_ai_im_unternehmen`) vs "Builder" (the rest). But one root can only be in
one area, and root 1 is shared by both tracks.

### 4.6 Custom lesson modules

Registry (`api/services/lesson_modules.py`, `api/register_lesson_module.py`, table `skills_lesson_modules`):

1. Write `module.json` = exactly `{"id":"so101-teleop","api_version":1,"entry_url":"<abs .mjs/.js URL, no query/fragment/credentials>"}`.
2. The origin of `entry_url` must be in `LESSON_MODULE_ORIGINS`. It must be `https`,
   or `http` + localhost with `LESSON_MODULE_LOCAL_DEVELOPMENT=True`
   (`checked_descriptor`).
3. Register (env exported, cwd skills-ms-rooms):
   `python -m api.register_lesson_module /abs/module.json --check`, then again
   without `--check`. `--replace` is needed to change an existing ID's URL.
4. At runtime `public_unit()` resolves `module_id` from the DB. An unregistered
   module or a disallowed origin gives 503 "Diese Lektion kann gerade nicht geladen
   werden".

Frontend contract (`frontend/types/learningModule.ts`, `utils/learningModule.ts`,
`components/learning/CustomActivity.vue`): the module exports
`apiVersion = 1` and `mount(element, host)`, which returns `{update(ctx), dispose()}`.
`host.context = {activityId, locale, content (=unit.content[locale]), state, disabled}`.
Calls: `host.change(state)` (autosave draft), `host.save()`, `host.complete(answer)`
(the server compares it with `completion.answer`), `host.setBusy(bool)`.

Minimal module:

```js
export const apiVersion = 1;
export function mount(el, host) {
  const btn = el.ownerDocument.createElement("button");
  btn.textContent = host.context.locale.startsWith("de") ? "Fertig" : "Done";
  btn.onclick = () => host.complete({ done: true });
  el.append(btn);
  return { update() {}, dispose() { btn.remove(); } };
}
```

**Local dev delivery (recommended): a public module.** Put it at
`emai-academy/frontend/public/lesson-modules/so101-teleop/entry.mjs`, which is
served at `http://localhost:3001/lesson-modules/so101-teleop/entry.mjs`. Set
`LESSON_MODULE_ORIGINS=["http://localhost:3001"]` and
`LESSON_MODULE_LOCAL_DEVELOPMENT=True`. The frontend accepts it because it is
same-origin + localhost. **The page must be opened on `localhost:3001`, not
`127.0.0.1:3001`**, or the origin check fails. Still to verify: that the Vite dev
server serves `public/*.mjs` for a runtime `import()` untransformed.

**Private packages (integrity + course-bound grants, optional):**

- Layout: `PRIVATE_LESSON_MODULES_ROOT/<artifact_sha256>/{module.json, manifest.json, <files>}`.
- `manifest.json` = `{"artifact_sha256": A, "definition": {"id", "api_version": 1, "entry": "entry.mjs"}, "files": [{"path", "bytes", "sha256"}]}`.
  The test fixture computes
  `A = sha256(json.dumps({"definition":…, "files": inventory}, separators=(",",":"), ensure_ascii=False))`
  with the inventory sorted by path (`tests/endpoints/test_private_lesson_assets.py:package`).
  The server only checks that `manifest.artifact_sha256 == <dir name>` and verifies
  each file's size and sha256.
- `module.json.entry_url` = `<PUBLIC_BASE_URL origin>/private-lesson-modules/<A>/<entry>`.
  Its scheme and netloc must equal `PUBLIC_BASE_URL`'s, and that origin must be in
  `LESSON_MODULE_ORIGINS`.
- On an authorized room or lesson response, the server issues
  `entry_url = PUBLIC_BASE_URL/lesson-assets/<HMAC(JWT_SECRET) grant>/<A>/<entry>`
  and stores the grant in Redis `REDIS_URL` (`private_lesson_grant:<sha>`, TTL
  `PRIVATE_LESSON_MODULE_GRANT_TTL`). This only works for units on a path linked
  by a course the user can access (`issue_grant`).
- `GET /lesson-assets/...` returns an **empty body with
  `X-Accel-Redirect: /_private-lesson-modules/<A>/<path>`**. skills-ms doesn't
  serve the bytes itself. Caddy equivalent of the nginx contract in
  `docs/lesson-runtime.md`:

  ```caddy
  handle_path /skills/* {
      reverse_proxy 127.0.0.1:8011 {
          @accel header X-Accel-Redirect *
          handle_response @accel {
              root * /abs/emai-academy/content/lesson-modules-private
              rewrite * {rp.header.X-Accel-Redirect}
              uri strip_prefix /_private-lesson-modules
              header Cache-Control "private, no-store"
              file_server
          }
      }
  }
  @privref path /skills/private-lesson-modules/*
  respond @privref 404
  ```

- The frontend still requires https, or same-origin localhost. So in dev,
  `PUBLIC_BASE_URL` must be the **frontend origin** (e.g.
  `http://localhost:3001/skills`), with Nuxt proxying `/skills/**` to the
  gateway :8191 (`nitro.devProxy` / `routeRules: {'/skills/**': {proxy: ...}}`).
  That is more moving parts, so it's not recommended for the first spike.

---

## 5. Backend: second instance on :8081

### 5.1 Can it share the checkout?

Yes. Config is external (`ACADEMY_CONFIG`, `academy_config/src/lib.rs:23-60`: a
`:`-separated list where the **first file wins**, merged per key over the embedded
`config.toml`). The binary `backend/target/debug/academy` is already built
(1 Oct 01:15). Running it directly avoids cargo re-checking or rebuilding while
the Bootstrap instance runs from the same `target/`:

```bash
cd <workspace>/backend
.devenv/profile/bin/createdb -h 127.0.0.1 -U academy emai_academy   # once
direnv exec "$PWD" sh -c 'ACADEMY_CONFIG=<workspace>/emai-academy/config/backend.toml:$PWD/config.dev.toml target/debug/academy serve'
# (cargo run -- serve also works; it is a no-op build when nothing changed)
```

`target/debug/academy check-config -v` prints the merged config. Run it before
the first start.

### 5.2 Migrations

`serve` applies pending migrations automatically when `database.run_migrations = true`
(the default in `config.toml`; `academy/src/commands/serve.rs:21-47`). Otherwise
it refuses to start while migrations are pending. Manual commands:
`academy migrate list|up|down|reset --force|demo --force`.
Start order: DB exists, then `serve` (migrates), then `admin user create`.

### 5.3 Proposed `emai-academy/config/backend.toml` (overlay; everything else from `config.dev.toml`)

```toml
[http]
address = "127.0.0.1:8081"
allowed_origins = [".*"]                  # dev; or ["^http://(localhost|127\\.0\\.0\\.1):3001$"]

[database]
url = "postgres://academy@127.0.0.1:5432/emai_academy"

[cache]
url = "redis://127.0.0.1:6379/2"          # skills-ms AUTH_REDIS_URL must match

[email]
from = "EmAI Academy DEV <academy@emai.dev>"   # smtp_url inherited (smtp4dev :2525)

[jwt]
secret = "emai-dev-secret"                # == skills-ms JWT_SECRET

[contact]
email = "EmAI Robotics <info@emai.dev>"

[user]
verification_redirect_url = "http://localhost:3001/auth/verify-account"
password_reset_redirect_url = "http://localhost:3001/auth/reset-password"

[oauth2]
redirect_uris = ["http://localhost:3001/oauth/callback", "http://127.0.0.1:3001/oauth/callback"]
# or: enable = false  (removes all OAuth providers; the "test" mock provider on :8101 otherwise stays)

[microservices]
skills_url = "http://127.0.0.1:8011/"     # trailing slash required (Url::join)
challenges_url = ""                       # "" = disabled (deserialize_optional_url)
events_url = ""

[feedback]
enabled = false                           # default; if enabled also github_token_file, storage_path, public_base_url

[finance]                                 # relative defaults would share Bootstrap's dirs
invoices_archive = "<workspace>/emai-academy/.state/invoices"
credit_notes_archive = "<workspace>/emai-academy/.state/credit_notes"
final_statements_archive = "<workspace>/emai-academy/.state/final_statements"
```

Inherited from `config.dev.toml` and fine to share: `recaptcha.enable=false`
(mock :8100), `vat` mock :8102, `paypal` mock :8103, `render.daemon_url` :8001,
`session.access_token_ttl=1d`, the email `smtp_url`.
Keep `[user] terms_version` as the default (`2026-09-r4`), because registration
fails unless the frontend sends exactly this version
(`academy_core/user/impl/src/lib.rs:218`).

### 5.4 Coins, premium and PayPal

- **There is no enable/disable switch** for coin, heart, premium or paypal in
  `academy_config` (`CoinConfig`, `HeartConfig`, `PremiumConfig`, `PaypalConfig`
  only hold prices/limits/credentials; `paypal.client_id/secret` are mandatory
  keys, and the dev mock provides them).
- **New purchase offers are effectively disabled by default.** `[purchase]
  provision_window_seconds` is absent from `config.toml`, and
  `purchase/impl/src/lib.rs:196-205` returns `PurchaseError::Unavailable` for any
  product kind (`premium_monthly|premium_yearly|hearts|course|coins`) without an
  entry. Leaving it unset keeps EmAI purchase-free.
- Courses with `price: 0` never touch coins or premium. Everything else (coin
  balance, premium pages, hearts) has to be hidden in the EmAI frontend layer.
- Switchable via config: `recaptcha` (`enable=false`), `oauth2` (`enable=false`,
  or per provider), `sentry`, `feedback` (off by default), and microservice URLs
  (`""` = off).

---

## 6. Render daemon, mocks, smtp4dev

- **Render daemon :8001** (`nix/dev.nix:53`, `academy_render_daemon`): a stateless
  HTML→PDF renderer (Chrome) for invoices and credit notes. It is shared as-is
  through the inherited `render.daemon_url`. It's only exercised by purchase and
  finance flows, which EmAI doesn't use, and it is unverified on macOS.
- **API mocks :8100-8104** (`testing recaptcha|oauth2|vat|paypal|microservices`)
  are stateless test doubles and can be shared. EmAI should **not** use :8104
  (`microservices`) for skills. It points at the real :8011, with challenges and
  events off.
- **smtp4dev :2525 / UI :5050** is shared. EmAI mails (verification, reset) show up
  in the same inbox, told apart by the `EmAI Academy DEV` sender. Mail bodies and
  logos are still Bootstrap-branded (gotcha 9).
- Nothing extra needs to run for a second instance. The only new processes are
  backend :8081, skills-ms :8011, Caddy :8191 and Nuxt :3001.

## 7. Gateway (`emai-academy/config/Caddyfile`)

```caddy
{
	admin off
	auto_https off
}
:8191 {
	handle_path /skills/* {
		reverse_proxy 127.0.0.1:8011
	}
	redir /skills /skills/docs 307
	handle {
		reverse_proxy 127.0.0.1:8081
	}
}
```

Two Caddy processes with `admin off` don't conflict. Run it with
`nix shell nixpkgs#caddy -c caddy run --config /abs/emai-academy/config/Caddyfile`.
The EmAI frontend uses `NUXT_PUBLIC_BASE_API_URL=http://127.0.0.1:8191` and
`NUXT_PUBLIC_BASE_WEB_URL=http://localhost:3001`.

## 8. Bring-up checklist

1. `createdb emai_academy` and `createdb emai_skills` (devenv `createdb -h 127.0.0.1 -U academy`).
2. Backend: `check-config -v`, then `serve` (auto-migrates) on :8081. Then
   `admin user create --admin --verified ...`. `curl :8081/health` should return
   all `true`.
3. skills-ms-rooms: `nix develop` (creates `.venv`), export the EmAI env,
   `alembic upgrade head`, `python -m api` on :8011. Startup fails loudly on
   invalid courses or catalogue.
4. Caddy :8191. Then `curl :8191/skills/rooms/capabilities` → `{"enabled":true}`.
5. `sync_skills.py --list` (validate), then sync with the token from `admin session
   impersonate admin`. Then `PATCH /skilltree` for rows/columns and positions.
6. Register the lesson modules (`python -m api.register_lesson_module ...`).
7. Frontend :3001, opened as `http://localhost:3001`.

Content checks worth scripting in `emai-academy/scripts/`: parse
`learning_rooms.json` with `Catalogue`, each course with `Course`,
cross-check `curriculum` room refs against catalogue path membership and
`learning_path_id`, `completion.answer` against guided-lesson checks (de == en),
`module_id` against the registered `module.json` files, skill `courses` against
course files, and area `root_skill_ids` against skill files. Run it with the
skills-ms venv and `PYTHONPATH=skills-ms-rooms`, `PYTHONDONTWRITEBYTECODE=1`
(the way this doc's examples were validated, without writing into the worktree).
