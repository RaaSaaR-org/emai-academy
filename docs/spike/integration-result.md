# EmAI Academy: integration result (end-to-end)

Date: 2026-10-01. The whole EmAI tenant runs next to the untouched Bootstrap tenant. One
browser journey covers it end to end: 20 of 20 steps pass, with 0 console errors and
0 failed requests.

## Running stack (left running)

| Service | URL | Notes |
|---|---|---|
| Frontend (Nuxt layer, dev) | http://localhost:3001 | Open it as `localhost`, not `127.0.0.1`: the lesson-module origin check needs it. Log: `.logs/frontend.log` |
| Gateway (Caddy) | http://127.0.0.1:8191 | `/skills/*` goes to :8011, `GET /challenges/courses/*/tasks` returns `[]`, everything else goes to :8081 |
| Backend | http://127.0.0.1:8081 | db `emai_academy`, Valkey db 2 |
| skills-ms-rooms | http://127.0.0.1:8011 | db `emai_skills`, Valkey db 3, real EmAI content loaded |
| Mail | http://localhost:5050 | shared smtp4dev |

Admin: `admin` / `emai-admin-dev`; the token is in `.run/admin.token`.

Bootstrap tenant checked afterwards: `:8190/health` returns all true and `:3000` returns 200.
Upstream repos: `frontend`, `skills-ms`, `skills-ms-rooms` and `meta` have a clean `git status`.
`backend` shows `nix/dev.nix`, `nix/packages.nix`, `config.local.toml` and `logs/`. They are
older than this spike (Sep 20 / 01:14) and were not touched by it.

## What I changed to make it work

1. **Lesson-module paths.** `seed.sh` registered `http://localhost:3001/lesson-modules/<id>/index.js`,
   which nothing served. The module build writes `dist/learning-modules/<sha256>/`. `seed.sh`
   now copies `content/modules/dist/learning-modules/` to `frontend/public/learning-modules/`
   (gitignored) and registers `content/modules/dist/descriptors/*.json` with `--replace`.
   The registered entry is `http://localhost:3001/learning-modules/<sha256>/index.js`, and Nuxt
   serves it as `text/javascript`.
2. **Content loaded.** `scripts/reload-content.sh` restarted skills-ms on the real
   `content/` files (21 courses, 21 paths / 55 units, character areas). It synced 9 root
   skills and 21 sub-skills and registered both modules.
3. **Skill-tree layout.** sync_skills places nodes at hash-random cells on a 20x20 grid, so
   they overlapped and sat off screen. The new `content/tools/build_layout.py` generates
   `content/skills/layout.json` from the skill YAML. `seed.sh` applies it through the admin API
   and now also handles a `sub_skills` map. The layout is tuned to upstream's renderer:
   `row` is drawn as x, and on first visit the view centres on the node nearest the bounding-box
   centre. All 9 skills and 10 edges are visible at 1440x900 without panning, and the
   sub-trees are centred too.
4. **`/learn` without `?path=`.** skills-ms falls back to the Bootstrap path `python-loops`
   (404, "unavailable"), and the dashboard's "Weiterlernen" button pushes a bare `/learn`. The
   new `frontend/middleware/emai-learn-default.global.ts` pins it to
   `runtimeConfig.public.emaiDefaultLearningPath` (`physical-ai-grundlagen`).
5. **Course page 404.** The upstream course page asks challenges-ms for quiz tasks, and the
   tenant has no challenges-ms. The gateway now answers `GET /challenges/courses/*/tasks` with
   `[]` (plus a CORS header).
6. **Learning-room re-skin.** `/learn` and GuidedLesson were upstream navy/teal. They are
   re-skinned in `frontend/assets/css/emai-pages.css`: surfaces `#1F1F1F`, orange primary
   actions and progress, teal only for "correct". The same file also overrides the arbitrary
   navy utilities (`bg-[#1c3250]` and others), which fixes the dialog footer.
7. **`dev-up.sh`.** It ran `npm install` in the tenant frontend. It now runs
   `scripts/link-deps.sh` when `node_modules/nuxt` is missing, and creates `.env` from
   `.env.example`.

## The verified journey

Script: `docs/spike/e2e/journey.mjs`. It uses puppeteer-core with the installed Chrome,
headless. Run it with `cd docs/spike/e2e && npm install && node journey.mjs`. Each run
registers a fresh user and writes `last-run.json`.

| # | Step | Result |
|---|---|---|
| 1 | Landing page: title "EmAI Academy", body `#141414`, Physical AI copy, no Bootstrap/Morphcoins wording (except the deliberate "auf Basis der Open-Source-Plattform Bootstrap Academy" credit), no "humanoid" | pass |
| 2 | Landing page at 390px: no horizontal overflow | pass |
| 3 | Hidden features while logged out (`/morphcoins /subscription /challenges /webinars /calendar /orders`) redirect to `/dashboard`, then to login | pass |
| 4 | Register through the real form, success dialog, "Konto verifizieren" | pass |
| 5 | Verification mail found through the smtp4dev API, code extracted | pass |
| 6 | Code entered on `/auth/verify-account`; `GET /auth/users/me` returns `email_verified=true` | pass |
| 7 | Fresh browser context, login through the form, lands on `/dashboard` | pass |
| 8 | Dashboard: EmAI wording, rooms capability `enabled`, "Weiterlernen" block shown | pass |
| 9 | "Weiterlernen" opens `/learn?path=physical-ai-grundlagen` with a room loaded | pass |
| 10 | `/skill-tree`: 9 EmAI root skills visible, 10 dependency edges (API), 57 SVG strokes | pass |
| 11 | Sub-tree `/skill-tree/physical_ai_grundlagen` shows its sub-skills | pass |
| 12 | Course page `/courses/physical-ai-grundlagen` | pass |
| 13 | Bare `/learn` is pinned to the EmAI path and loads a room | pass |
| 14 | Guided lesson "KI mit Körper": a wrong answer shows the try-again feedback, the correct answers pass, finish; server progress is `completed` | pass |
| 15 | Exercise: final knowledge check `pai-wissenscheck` (5 graded questions, no skip), completed; server `completed` | pass |
| 16 | Custom module **robot-arm-kinematics** mounts in the real player (shadow root, 3 joint sliders); both targets solved; `host.complete({"reached":true})` is accepted by the server: `completed` | pass |
| 17 | Custom module **teleop-dataset-explorer** mounts; timeline scrubbed; 3 answers given; server `completed` | pass |
| 18 | Course progress on the course page updates to "2 / 10 erledigt" | pass |
| 19 | Hidden features while logged in redirect to `/dashboard` | pass |
| 20 | DE/EN toggle switches the landing page to English | pass |

The task's "exercise" is the graded knowledge check plus the two custom modules. The upstream
`exercise` room kind needs challenges-ms, which the EmAI tenant does not run (it would
return 503).

## Screenshots (`docs/spike/screens/`)

- `e2e-01-landing.png`, `e2e-01-landing-full.png`: landing page (desktop, full page)
- `e2e-02-landing-mobile.png`: landing page at 390px
- `e2e-03-signup-filled.png`, `e2e-04-after-signup.png`: registration and the success dialog
- `e2e-05-verified.png`: account verified
- `e2e-06-after-login.png`: after login
- `e2e-07-dashboard.png`, `e2e-07-dashboard-full.png`: dashboard
- `e2e-07b-dashboard-practice-learn.png`: "Weiterlernen" opens the room
- `e2e-08-skill-tree.png`: root skill tree with 9 skills and edges
- `e2e-09-skill-subtree.png`: the sub-tree "Physical AI Grundlagen"
- `e2e-10-course.png`, `e2e-10-course-full.png`: course page
- `e2e-11-learn-start.png`: `/learn` default path
- `e2e-12-guided-lesson.png`, `e2e-13-guided-try-again.png`, `e2e-13-guided-correct.png`, `e2e-14-guided-finished.png`: guided lesson
- `e2e-15-knowledge-check-try-again.png`, `e2e-15-knowledge-check-correct.png`, `e2e-16-knowledge-check-finished.png`: knowledge check
- `e2e-17-module-robot-arm.png`, `e2e-18-module-robot-arm-finished.png`: robot-arm-kinematics module in the player
- `e2e-19-module-teleop-explorer.png`, `e2e-20-module-teleop-finished.png`: teleop-dataset-explorer module in the player
- `e2e-20b-course-progress.png`: course progress after completion
- `e2e-21-landing-en.png`: English landing page

Earlier per-agent screenshots (`frontend-*`, module harness shots) are kept in the same folder.

## Remaining issues

Tenant-side, not done:
- The course pages, quizzes, `components/svg/*`, the dialog backdrop and the LoopExplorer and
  ItLab rooms still use upstream navy literals. Only the dashboard, `/learn` and GuidedLesson
  are re-skinned.
- Room-only courses award no XP, because upstream rooms never grant XP. After the journey the
  dashboard still shows 0 XP, so the skill tree does not fill up from room work. Only the 9
  courses with YouTube lectures can award XP.
- The dashboard copy is still gamified ("Dein Charakter", XP, Level).
- Test accounts are left in `emai_academy`: `emaifrontend` (frontend agent) and one `e2e<stamp>`
  user per journey run.
- skills-ms with `DEBUG=True` logs "no response schema defined for status code 200" for every
  rooms call. This is upstream debug noise; DEBUG is needed for CORS.
- The frontend dev server logs upstream's `NUXT_E1007` (definePageMeta at runtime) warnings.
- "fatal: Needed a single revision" in `frontend.log`: upstream `nuxt.config` asks git for a
  revision, and the tenant repo has no commits yet. It goes away after the first commit.

Needs upstream changes (not made):
- **Mail branding:** the verification mail is still "Willkommen bei der Bootstrap Academy!",
  with the Bootstrap footer, address and links. The templates are compiled into the backend
  (`academy_assets/assets/templates/*.html`).
- **Default learning path:** skills-ms `GET /rooms` defaults to `path="python-loops"`.
  Upstream should have a setting for it, or default to the first catalogue path. The tenant
  middleware works around it, but the "Retry" button on the empty-path state calls
  `data.next()` without a path and still hits the default.
- **Skill-tree layout:** sync_skills only places nodes at hash-random positions, and the tree
  renderer centres on the bounding box. A layout section in the skill YAML (or using the
  tenant `layout.json`) would be cleaner.
- **Course page and challenges:** it calls challenges-ms unconditionally. A feature flag would
  replace the gateway stub.
- **Room XP:** completing a room cannot grant XP.
- **Exercise rooms:** they require challenges-ms.
- Also see the `upstream_changes_needed` lists in `frontend-result.md`, `content-result.md`,
  `modules-result.md` and `stack-result.md`.

## Commands

```sh
cd <workspace>/emai-academy
scripts/dev-up.sh            # backend, skills, gateway, frontend (idempotent)
scripts/seed.sh              # admin, skills sync + layout, copy + register lesson modules
scripts/reload-content.sh    # after content changes: restart skills-ms + seed
content/modules/build.sh     # rebuild modules, then scripts/seed.sh
../skills-ms-rooms/.venv/bin/python content/tools/build_layout.py   # regenerate the tree layout
cd docs/spike/e2e && npm install && node journey.mjs                # end-to-end check
scripts/dev-down.sh          # stop only the tenant ports 3001/8191/8081/8011
```
