# Spike result: EmAI custom lesson modules

Status: **both modules are built, packaged with the unmodified upstream packager,
validated by the skills-ms registry CLI (`--check`) and tested standalone in
headless Chromium.** Nothing upstream was modified.

**Not yet tested:** loading them through the real player (Nuxt on :3001 + EmAI
skills-ms). That needs the copy and registration steps below.

## What exists

All files are under `emai-academy/content/modules/`. The full usage reference is
`README.md` there.

| Module id | Source | Bundle | Completion answer (`learning_rooms.json`) |
|---|---|---|---|
| `robot-arm-kinematics` | `src/robot-arm-kinematics/index.js` (~17 KB) | `index.js` | `{"reached": true}` |
| `teleop-dataset-explorer` | `src/teleop-dataset-explorer/index.js` + generated `episode.json` (34 KB, 180 frames) | `index.js`, `episode.json` | `{"fps": 30, "lagging_joint": "elbow_flex", "gripper_gap": "contact"}` |

**Current artifacts.** The hashes change on every source edit. Each descriptor
lives in `dist/descriptors/<id>.json`.

- `http://localhost:3001/learning-modules/2563c03d8d87f03e7c2f2e6e2a8f92ca2781145cf6bde4acd86859cfdfa642c5/index.js` (robot-arm-kinematics)
- `http://localhost:3001/learning-modules/aaa60f7de4154a2b803252f01a2fe878e02b06e3e62c073f65854e95b30484e1/index.js` (teleop-dataset-explorer)

### Contract conformance

Checked against `frontend/types/learningModule.ts`, `utils/learningModule.ts`,
`components/learning/CustomActivity.vue` and `ActivityHost.vue`:

- **Exports and mount:** each module exports `apiVersion = 1` and
  `mount(element, host)`.
  - The explorer's `mount` is async: it fetches `episode.json` through
    `new URL("./episode.json", import.meta.url)` with `host.signal`. This works
    for public delivery and for private grant URLs, because the grant covers the
    whole package.
- **Instance:** each returns `{update, dispose}`. The explorer also has
  `cancelPreparation`, which pauses playback.
- **Rendering scope:** each renders only into its element, inside its own shadow
  root. `dispose` aborts every listener (an AbortController, also tied to
  `host.signal`), cancels rAF playback and empties the root. The harness checks
  this: 0 children after dispose.
- **No module globals:** all learner state is per instance.
- **Locale and content:** the locale comes from `context.locale` (`de*` gives
  German, anything else English). `context.content` is the
  localized `unit.content[de|en]`, as `activityContent()` provides it.
- **Disabled:** `context.disabled` locks every input, and `change` and
  `complete` are never called while it is set.
- **change and complete:** `host.change(state)` sends a full JSON state.
  `host.complete(answer)` is only called after a local success check. The server
  still decides, using canonical-JSON equality with `completion.answer`
  (`rooms.py completed_progress`); a mismatch gives 422, which the player shows as
  "CheckIntroduction".
- **Theming:** the upstream contract has **no theme hooks**. The modules default
  to EmAI dark tokens and read optional inherited CSS variables (`--emai-*`, listed
  in README), so the tenant could theme them without a rebuild.

### Packaging

`build.sh` runs `frontend/scripts/build-learning-module.mjs` unchanged, with
`--allow-local` only for localhost base URLs.

- **Output:** `dist/learning-modules/<sha256>/{files, manifest.json, module.json}`,
  plus `dist/private-lesson-modules/<sha256>/` from `--private`.
- **Determinism:** the episode generator uses a seeded PRNG, so a rebuild is
  byte-identical; a second run reuses the immutable directory, which I verified.

## Verification done

1. **Registry CLI**, run from skills-ms-rooms (`.venv/bin/python -m api.register_lesson_module <descriptor> --check`):
   - Both public descriptors give `checked (API 1)` with
     `LESSON_MODULE_ORIGINS='["http://localhost:3001"]'` and
     `LESSON_MODULE_LOCAL_DEVELOPMENT=True`.
   - Both private descriptors give `checked (API 1)` with
     `PRIVATE_LESSON_MODULES_ROOT=.../dist/private-lesson-modules` and
     `PUBLIC_BASE_URL=http://localhost:3001/skills`. This also proves the upstream
     packager's `manifest.json` passes the server's per-file size and SHA-256 check
     (`checked_asset`).
   - Negative case: a disallowed origin is rejected with "The module origin is not
     approved".
2. **Unit JSON:** the two example units in the README validate against the
   real `CatalogueUnit` pydantic model.
3. **Headless Chromium** (Playwright `chrome-headless-shell`). The harness at
   `content/modules/harness/index.html` mocks the host with the same
   snapshot, disabled, signal and busy semantics as `createLearningModuleSession`.
   - kinematics `auto=solve`: changes, then `complete {"reached":true}` exactly once.
   - kinematics with `disabled=1`: 0 changes, 0 completes.
   - explorer `auto=wrong` (60 fps, gripper): per-question feedback, 0 completes.
   - explorer `auto=solve`: `complete {"fps":30,"lagging_joint":"elbow_flex","gripper_gap":"contact"}` once.
   - A wrong import path is caught as a load error by the host mock.
4. **Screenshots** in `docs/spike/screens/`:
   - `robot-arm-kinematics-de-start.png`, `robot-arm-kinematics-de-solved.png`,
     `robot-arm-kinematics-en-mobile.png` (390 px, target A reached)
   - `teleop-dataset-explorer-de-wrong.png`, `teleop-dataset-explorer-de-solved.png`,
     `teleop-dataset-explorer-en-mobile.png` (390 px)

## Teaching content

**robot-arm-kinematics** is a side view of SO-101-like links (116/135/95 mm). It
shows the live FK readout and formula, a TCP trail and two targets: A is position
only, B also needs a pitch of -90° ± 15°. Target B teaches that the third joint
sets orientation (redundancy). Its IK solution is roughly θ = [69, -87, -72].

**teleop-dataset-explorer** uses a synthetic `so101_follower` episode (pick a cube
and place it in a box) in LeRobot v3 style: an info.json header with
`codebase_version v3.0`, features, `data_path`/`video_path` templates, keyframes
with video references, and per-frame `timestamp`, `frame_index`, `action` and
`observation.state`. The follower model applies a per-joint delay plus a
first-order lag.

The three questions:

1. **fps:** read from the timestamps. The fps field is in the data but
   deliberately not displayed.
2. **Lagging joint:** elbow_flex, about 9 frames (~300 ms) by best alignment;
   the others lag 2–3 frames. The module computes this from the data rather than
   hard-coding it.
3. **Gripper gap:** the gripper is commanded to 0 but measures about 18 while it
   holds the cube (contact).

## Integration steps for the orchestrator / frontend + services agents

1. `cp -R emai-academy/content/modules/dist/learning-modules/. emai-academy/frontend/public/learning-modules/`.
   I did not do this, because it is outside `content/modules`.
   - The path differs between the two scout reports: `frontend-layer.md` says
     `learning-modules`, `content-and-services.md` says `lesson-modules`. I used
     **`learning-modules`**.
   - To use another path, rebuild with `BASE_URL=http://localhost:3001/<path>/ ./build.sh`.
2. In the EmAI skills-ms env, set `LESSON_MODULE_ORIGINS=["http://localhost:3001"]`
   and `LESSON_MODULE_LOCAL_DEVELOPMENT=True`.
3. After the `lessonmodules001` migration, register the two descriptors from
   `dist/descriptors/`. Use `--replace` after any rebuild that changes the hash.
4. Add the units to `learning_rooms.json` with the exact `completion.answer`
   values above. Open the app as `http://localhost:3001` (not 127.0.0.1).

## Open points / caveats

- **Vite public serving:** still not verified that Nuxt/Vite dev serves
  `public/**/*.js` raw, with a JS MIME type, for a runtime `import()`. A
  `nuxt generate` + static server certainly works. If Vite interferes, serve the
  packages from Caddy on the same origin instead.
- **Answers are visible to the client:** `completion.answer` acts as a shared
  secret only in name. The module knows the answers, and unit content is public
  anyway. That fits the `introduced` completion kind, which records introduction,
  not graded mastery. No XP is attached to rooms.
- **Start-pose targets:** a target placed exactly on the start pose only counts
  after the first slider movement. Defaults avoid this.
- **Fonts:** Space Grotesk and Geist are named with system fallbacks. The modules
  load no web fonts; they use whatever the host page has loaded.
- **Palette check:** brand orange and teal fail the dataviz validator's
  lightness band on dark. Their colour-vision-deficiency separation passes
  (ΔE 17.6). Series also differ by dash pattern and have a legend.
