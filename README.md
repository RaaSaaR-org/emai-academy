# EmAI Academy

EmAI Academy is the learning platform of EmAI Robotics GmbH (Saarbrücken, [emai.dev](https://emai.dev)):
**Physical AI for companies, vendor-neutral and hands-on.** It teaches how cognitive robots
perceive, learn and act, from the first business case to fine-tuning a VLA on your own data.
German first, English second; dark theme; house style "Selbst getestet · Herstellerunabhängig ·
Offen geteilt".

Technically it is a **white-label tenant of [Bootstrap Academy](https://github.com/Bootstrap-Academy)**.
This repo holds only what is EmAI-specific. The upstream checkouts next to it are used as they are
and are never modified.

> Status: spike / working prototype (2026-10). Findings per workstream are in `docs/spike/`.
> Before any public pilot: the terms page is a placeholder, the imprint lacks the register court,
> and the privacy page's hosting section is a draft.

## Curriculum

9 skills (each with 2-3 sub-skills and one course per sub-skill, 21 courses, 55 learning-room units,
2 interactive lesson modules), in two tracks:

| # | Skill | Requires |
|---|---|---|
| 1 | Physical AI Grundlagen (root) | – |
| 2 | Roboter-Hardware & Embodiments | 1 |
| 3 | Robotik-Software-Grundlagen | 1 |
| 4 | Daten für Robot Learning | 2, 3 |
| 5 | Imitation Learning & VLAs | 4 |
| 6 | Simulation & Reinforcement Learning | 3 |
| 7 | Evaluation & Deployment | 5 or 6 |
| 8 | Safety, Security & Souveränität | 1 |
| 9 | Physical AI im Unternehmen einführen | 1, 8 |

- **Decider track:** 1 → 8 → 9 (business case, safety, regulation, pilot planning, change)
- **Builder track:** 1 → 2/3 → 4 → 5/6 → 7 (SO-101 + LeRobot, Unitree G1 EDU + Dex3, datasets,
  ACT/SmolVLA/π0.5/GR00T, Isaac Lab, evaluation, deployment)

## Architecture

```
Bootstrap-Academy/
├── frontend/          upstream Nuxt app          (read-only)  ─┐
├── backend/           upstream Rust backend      (read-only)   │ used as-is
├── skills-ms-rooms/   upstream skills-ms, branch release/2026-09 (worktree; read-only)
└── emai-academy/      THIS REPO                                │
    ├── frontend/      Nuxt layer: `extends: ['../../frontend']` ┘
    ├── content/       courses, skills, learning rooms, lesson modules
    ├── config/        backend overlay, skills-ms env, Caddyfile, mail templates
    ├── services/      tenant sidecars: mail-relay, xp-bridge
    ├── scripts/       dev-up / dev-down / seed / reload-content / check-upstream
    └── docs/spike/    findings, e2e journey, screenshots
```

| Layer | How the tenant plugs in |
|---|---|
| **Frontend** | `frontend/` is a Nuxt layer over upstream. Dependencies are symlinked from the upstream `node_modules` (`frontend/scripts/link-deps.sh`); never `npm install` here. |
| **Backend** | Same Rust backend, second instance on :8081 with its own database `emai_academy` and Valkey DB 2. Config = generated `.run/backend.paths.toml` : `config/backend.toml` : upstream `config.dev.toml` (first file wins per key). Runs a **pinned copy** of the backend binary (`.state/bin/academy`), so rebuilding the Bootstrap backend does not silently change the EmAI one or its migrations. |
| **skills-ms** | The `release/2026-09` worktree (learning rooms, configurable content paths), second instance on :8011 with database `emai_skills` and Valkey DB 3, pointed at `content/` via `.run/skills-ms.env` (generated from `config/skills-ms.env` plus the checkout paths). |
| **Gateway** | Caddy on :8191: `/skills/*` → :8011, everything else → :8081, plus a stub for the challenges-ms course-task call. |
| **Mail relay** | `services/mail-relay` on :2526. The backend's mail templates are compiled in and Bootstrap-branded; the relay re-renders verification and password-reset mails from `config/mail/*.html` (and wraps any other mail in the EmAI layout), then forwards to smtp4dev :2525. |
| **XP bridge** | `services/xp-bridge`. Upstream rooms grant no XP, so room-only courses could never move the dashboard or skill tree. The bridge awards 20 XP per completed unit to the course's sub-skills through skills-ms' idempotent internal `xp-operations` endpoint. |

### Ports (next to the running Bootstrap tenant)

| | Bootstrap | EmAI |
|---|---|---|
| Frontend | :3000 | **:3001** (open as `http://localhost:3001`, not 127.0.0.1) |
| Gateway | :8190 | **:8191** |
| Backend | :8080 (db `academy`, Valkey 0) | **:8081** (db `emai_academy`, Valkey 2) |
| skills-ms | :8010 (develop, Valkey 1) | **:8011** (release/2026-09, db `emai_skills`, Valkey 3) |
| Mail | smtp4dev :2525 / UI :5050 | relay **:2526** → smtp4dev |

Shared: Postgres :5432, Valkey :6379, smtp4dev, render daemon :8001, API mocks :8100-8104
(`cd ../backend && devenv up`).

## Run it

Prerequisites: the upstream checkouts next to this repo (`../frontend` with `npm ci` done,
`../backend`, `../skills-ms-rooms` on `release/2026-09`), the backend devenv services up, `direnv`,
`nix` (first skills-ms venv and Caddy), Python 3.9+, Node, Google Chrome (e2e only).

```sh
scripts/dev-up.sh                 # mail relay, backend, skills-ms, xp bridge, gateway, frontend
scripts/seed.sh                   # first run: admin user, skills + layout, lesson modules
open http://localhost:3001

scripts/reload-content.sh         # after editing content/ (skills-ms reads it only at startup)
scripts/dev-up.sh --only frontend # one service: mail|backend|skills|xp|gateway|frontend
scripts/dev-up.sh --refresh-backend   # re-pin the backend binary after pulling ../backend
scripts/dev-down.sh [service ...] # stops only the tenant's processes/ports
scripts/check-upstream.sh         # do patches/overrides/deps still fit upstream? (CI-friendly)
cd docs/spike/e2e && npm install && node journey.mjs     # 21-step browser journey
cd docs/spike/e2e && node brand-check.mjs --login user:pass /dashboard /skill-tree  # brand-leak check
```

Content workflow: edit `content/rooms/*.yml`, then
`../skills-ms-rooms/.venv/bin/python content/tools/build_learning_rooms.py`, validate with
`PYTHONPATH=../skills-ms-rooms ../skills-ms-rooms/.venv/bin/python content/tools/validate.py`, then
`scripts/reload-content.sh`. Details: [`content/README.md`](content/README.md).

### Dev credentials

| | |
|---|---|
| Admin | `admin` / `emai-admin-dev` (`admin@emai.dev`); token after seeding in `.run/admin.token` |
| Mail inbox | http://localhost:5050 (shared smtp4dev) |
| JWT secret (dev only) | `emai-dev-secret` (backend `[jwt] secret` = skills-ms `JWT_SECRET`) |

These are local development values only. `.logs/`, `.run/`, `.state/`, `frontend/.env`,
`node_modules`, `.nuxt`, `.output` and build output are gitignored.

## Override points used

Everything the tenant changes is in one of these places. Nothing is edited in upstream repos.

| # | Override point | Where | Used for |
|---|---|---|---|
| 1 | Nuxt layer `extends` | `frontend/nuxt.config.ts` | the whole frontend |
| 2 | Same-path file shadowing (components, layouts, pages, public) | `frontend/components`, `layouts`, `pages`, `public` | Navbar/Menu/Drawer/Back/Footer/Language, layouts, landing page, legal pages, logos; stubs for hearts/coins/feedback/update notice. Listed with upstream hashes in `frontend/brand/overrides.json`; drift is reported on every dev start and by `scripts/check-upstream.sh` |
| 3 | Build-time locale merge | `frontend/brand/module.ts` + `frontend/locales/*.json` | EmAI texts, formal "Sie" for dashboard and learning rooms, less game wording ("Mein Lernstand", "Stufe", "Kompetenzen") |
| 4 | Build-time source patches (verified) | `frontend/brand/patches.cjs` | contact address, TOTP issuer, product name, `/orders` link, misleading moderation notice, level/XP label on skill-tree nodes |
| 5 | Build-time recolor by colour value | `frontend/brand/recolor.cjs` (Vite + Tailwind `content.transform`) | navy → neutral dark, Bootstrap teal accent → EmAI orange, other teals → EmAI teal |
| 6 | CSS tokens on `:root` | `frontend/assets/css/emai.css` | upstream `--color-*` tokens, fonts, EmAI components |
| 7 | Keyed head merge | `frontend/brand/module.ts` (`head` option) | title, icons, manifest, meta/OG tags; upstream entries without a tenant counterpart are kept |
| 8 | Route pruning + redirect middleware | `nuxt.config.ts` `pages:extend`, `middleware/` | shop, premium, challenges, webinars, commerce pages; `/learn` default path |
| 9 | Backend config overlay | `config/backend.toml` | DB, Valkey DB, JWT, mail via relay, redirect URLs, skills-ms URL |
| 10 | skills-ms settings | `config/skills-ms.env` | rooms on, content paths, CORS (DEBUG), DB, Valkey DB |
| 11 | Content directories | `content/` | courses, skills (+ `layout.json`), learning rooms, character areas, lesson modules |
| 12 | Gateway | `config/Caddyfile` | routing, challenges-ms stub |
| 13 | Sidecars | `services/mail-relay`, `services/xp-bridge` | mail branding, XP for rooms |

## Upstream PRs that would make the tenant cleaner

None of these were made (the spike is tenant-only). Each one removes a workaround above.

**Frontend**
1. `runtimeConfig.public.brand` (`name`, `contactEmail`, `totpIssuer`, `webUrl`) used by Delete.vue,
   skill-tree, moderation pages, MFA setup, Commercial* components → removes most of `brand/patches.cjs`.
2. Feature flags (`shop`, `premium`, `hearts`, `challenges`, `webinars`, `quizzes`, `leaderboard`,
   `feedback`, `updateNotice`) checked by nav, course page and routes → removes route pruning, the four
   stubs, the moderation patch and the Caddy course-tasks stub.
3. Replace hard-coded navy/teal literals in dashboard, learning rooms, GuidedLesson, ItLab, quiz,
   `components/svg/*`, skill tree and `assets/css/account-support.css` with CSS variables → removes `recolor.cjs`.
4. A supported i18n extension point (extra message files per layer, e.g. via `@nuxtjs/i18n` layers
   or a `i18n:extend` hook) → removes the build-time locale merge. Also move the hard-coded German
   strings in `LessonActivity.vue` / `ActivityHost.vue` / `GuidedLesson.vue` into i18n.
5. Nav and footer link lists as config or slots → removes the rewritten Navbar, NavbarMenu,
   NavbarDrawer, NavbarBack, Footer and layouts.
6. Head/meta defaults that a layer can extend by key (or `useHead` in `app.vue`) → removes the head merge.
7. Export the learning activity registry (`components/learning/activityRegistry.ts`) so tenants can
   add Vue renderers, not only ES-module lesson modules.
8. Configurable gamification wording and a formal-address (`de-formal`/"Sie") locale variant.
9. Show sub-skill progress (level/XP) on skill-tree nodes below level 25.

**Backend**
1. Configurable mail branding: templates directory or brand settings (subject prefix, sender name,
   footer address, links, signature) → removes `services/mail-relay`.
2. A Valkey key prefix option → tenants could share a DB index.
3. Switches to disable coins, premium and PayPal explicitly (today they are only off because
   `provision_window_seconds` is unset).
4. Feature flags for challenges and events, so tenants do not inherit the mocks from `config.dev.toml`.

**skills-ms**
1. Land rooms and configurable content paths (`release/2026-09`) on the mainline that Bootstrap runs.
2. Award XP for completed learning-room units (configurable per unit/course) → removes `services/xp-bridge`.
3. `GET /rooms` default path as a setting (or first catalogue path); frontend "Retry" should pass the path
   → removes `middleware/emai-learn-default.global.ts`.
4. Skill-tree layout (row/column) in the skill YAML → removes `content/skills/layout.json` + seed step.
5. A CORS setting independent of `DEBUG` (DEBUG also logs "no response schema defined" on every call).
6. `exercise` rooms without a hard dependency on challenges-ms (or a capability flag).
7. Content reload without restart (admin endpoint or file watch); relative/symlinked content paths.
8. A `poe check`/validator that accepts a content directory → removes `content/tools/validate.py`.

## Further reading

- `docs/spike/*-result.md`: findings per workstream (stack, content, frontend, modules, integration)
- [`content/README.md`](content/README.md), [`frontend/README.md`](frontend/README.md),
  [`config/placeholders/README.md`](config/placeholders/README.md)
