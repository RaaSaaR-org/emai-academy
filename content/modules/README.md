# EmAI lesson modules

Custom lesson modules for EmAI Academy custom learning-room units (`"room": "custom"`).
Each module is a browser ES module that follows the upstream module contract,
API v1 (`frontend/types/learningModule.ts`, `frontend/docs/learning-modules.md`).
They use no framework and have no runtime dependencies. Each module renders inside a
shadow root, which keeps host Tailwind styles out. The theme is EmAI dark, and every
colour or font can be overridden with inherited CSS custom properties: `--emai-bg`,
`--emai-surface`, `--emai-border`, `--emai-accent`, `--emai-secondary`,
`--emai-text`, `--emai-muted`, `--emai-font-heading`, `--emai-font-body` and
`--emai-font-mono`. The upstream contract has no theme hooks of its own.

| Module id | What it does | Package files | Completion answer it sends |
|---|---|---|---|
| `robot-arm-kinematics` | A planar 3-link arm (simplified SO-101 side view: shoulder_lift, elbow_flex, wrist_flex) with joint sliders and live forward kinematics (x, z, pitch, formula). The learner moves the gripper into target zone A, then target zone B, which also needs a pitch of -90° ± 15°. Once both are reached, the "Aufgabe abschließen" button is enabled. | `index.js` | `{"reached": true}` |
| `teleop-dataset-explorer` | A synthetic 6 s / 30 fps SO-101 teleop episode in LeRobot v3 layout (`episode.json`). It shows info.json metadata, an arm-pose preview, a timeline scrubber with phase bands and play/pause, 6 joint charts (action dashed orange, observation teal; click or drag a chart to scrub) and a value table. Three questions follow. The module checks the answers locally first: fps and lag are computed from the data. It only calls `complete` when all three are correct. | `index.js`, `episode.json` | `{"fps": 30, "lagging_joint": "elbow_flex", "gripper_gap": "contact"}` |

The server marks a unit complete only when the posted answer is canonical-JSON
equal to `completion.answer` (`skills-ms-rooms/api/services/rooms.py`
`completed_progress`). So `learning_rooms.json` **must** use exactly the answers
in the table above.

## learning_rooms.json units (validated against `CatalogueUnit`)

Change `id`, `path_id`, `chapter_id`, `teaches`, `practices` and `requires` to
fit the curriculum. Keep `room`, `module_id` and `completion.answer` exactly as
shown. Do not put a `module` key in content: the server rejects it, because module
URLs come from the registry.

```json
{"id":"hw-so101-kinematik","path_id":"roboter-hardware","chapter_id":"hw-kinematik",
 "title":{"de":"Vorwärtskinematik am SO-101","en":"Forward kinematics on the SO-101"},
 "room":"custom","module_id":"robot-arm-kinematics",
 "teaches":["hw-forward-kinematics"],"practices":[],"requires":[],"retired":false,
 "completion":{"kind":"introduced","answer":{"reached":true},"allow_skip":false},
 "content":{"de":{},"en":{}}}
```

```json
{"id":"data-teleop-episode","path_id":"daten-robot-learning","chapter_id":"data-lerobot",
 "title":{"de":"Eine Teleoperations-Episode lesen","en":"Reading a teleoperation episode"},
 "room":"custom","module_id":"teleop-dataset-explorer",
 "teaches":["data-lerobot-format"],"practices":[],"requires":[],"retired":false,
 "completion":{"kind":"introduced","answer":{"fps":30,"lagging_joint":"elbow_flex","gripper_gap":"contact"},"allow_skip":false},
 "content":{"de":{},"en":{}}}
```

### Optional `content.<de|en>` fields

The host passes `unit.content[de|en]` to the module as `host.context.content`.
Every field is optional, and anything missing falls back to the built-in German or
English text, chosen by `host.context.locale`.

- Both modules accept `title` (string) and `intro` (string), which override the
  heading and the intro paragraph.
- `robot-arm-kinematics` also accepts:
  - `links`: `[l1, l2, l3]` in mm. Default `[116, 135, 95]`.
  - `limits`: `[[min,max] x3]` in degrees. Default `[[0,180],[-160,160],[-120,120]]`.
  - `start`: `[θ1, θ2, θ3]`. Default `[90, -90, 0]`.
  - `targets`: `[{id, x, z, r, pitch?, pitch_tolerance?}]`. Default: A `(260, 40, r 18)`
    and B `(170, -30, r 18, pitch -90 ± 15)`.

  Any custom target must be reachable. The completion answer stays `{"reached": true}`
  whatever targets you set.
- `teleop-dataset-explorer` has no other fields. The data and questions are bundled
  so that the correct answers always match the shipped episode.

## Saved state (`host.change`)

- `robot-arm-kinematics`: `{angles: [θ1, θ2, θ3], reached: ["a", ...]}`.
- `teleop-dataset-explorer`: `{frame, answers: {fps, lagging_joint, gripper_gap}, checked}`.
  The frame is only restored on mount.

Both modules respect `context.disabled`: inputs are locked and nothing is sent
while it is set.

## Layout

```
src/<id>/module.json     {"id", "api_version": 1, "entry": "index.js"}  (packager input)
src/<id>/index.js        browser-ready ES module (exports apiVersion = 1, mount)
src/teleop-dataset-explorer/episode.json   generated, do not edit by hand
tools/generate-episode.mjs                 deterministic episode generator (seeded)
build.sh                                   runs the UNMODIFIED upstream packager
harness/index.html                         standalone host mock for testing
dist/                                      build output (see below)
```

## Build

```sh
./build.sh            # public dev delivery, base http://localhost:3001/learning-modules/
./build.sh --private  # private-package variant for PRIVATE_LESSON_MODULES_ROOT
BASE_URL=https://cdn.example.org/learning-modules/ ./build.sh   # production-style
```

`build.sh` regenerates `episode.json` and then runs
`node ../../../frontend/scripts/build-learning-module.mjs --source src/<id> --output dist/... --base-url ... [--allow-local]`.
The packager's output is immutable directories named after the artifact SHA-256:

```
dist/learning-modules/<sha256>/{index.js, [episode.json], manifest.json, module.json}
dist/descriptors/<id>.json            # copy of the generated module.json = registry descriptor
dist/private-lesson-modules/<sha256>/ # same files; module.json points at /private-lesson-modules/
dist/descriptors-private/<id>.json
```

The build is deterministic, so a rebuild with no changes reuses the same hash
directory. Any change to the source gives a new hash and therefore a new
`entry_url`, which has to be registered again with `--replace`.

## Deliver and register (dev, public delivery, recommended)

1. **Serve:** copy the packages into the EmAI Nuxt app so the frontend loads them
   same-origin. It accepts `http:` only for same-origin localhost (`learningModuleUrl`).

   ```sh
   mkdir -p ../../frontend/public/learning-modules
   cp -R dist/learning-modules/. ../../frontend/public/learning-modules/
   ```

   Open the app as `http://localhost:3001`, not `127.0.0.1`.
2. **Configure skills-ms (EmAI instance):** set
   `LESSON_MODULE_ORIGINS='["http://localhost:3001"]'` and
   `LESSON_MODULE_LOCAL_DEVELOPMENT=True`.
3. **Register** (cwd `skills-ms-rooms`, with the EmAI env exported):

   ```sh
   .venv/bin/python -m api.register_lesson_module /abs/emai-academy/content/modules/dist/descriptors/robot-arm-kinematics.json --check
   .venv/bin/python -m api.register_lesson_module /abs/emai-academy/content/modules/dist/descriptors/robot-arm-kinematics.json
   .venv/bin/python -m api.register_lesson_module /abs/emai-academy/content/modules/dist/descriptors/teleop-dataset-explorer.json
   ```

   Add `--replace` after a rebuild that changed the hash. An unregistered module
   makes the room return 503.

**Private delivery (optional):** set
`PRIVATE_LESSON_MODULES_ROOT=/abs/.../dist/private-lesson-modules` and
`PUBLIC_BASE_URL=http://localhost:3001/skills`, then register
`dist/descriptors-private/*.json`. This also needs the Caddy
`X-Accel-Redirect` handling and a Nuxt `/skills` proxy; see
`docs/spike/content-and-services.md` §4.6. The `--check` run already passes,
including per-file hash checks.

## Standalone test

```sh
python3 -m http.server 8797 --bind 127.0.0.1    # cwd: content/modules
open "http://localhost:8797/harness/index.html?module=/dist/learning-modules/<sha>/index.js&kind=robot-arm-kinematics&locale=de"
```

Harness query parameters:

- `kind`: `robot-arm-kinematics` or `teleop-dataset-explorer`.
- `auto`: `none`, `solve` or `wrong`. Drives the UI automatically.
- `locale`: `de` or `en`.
- `disabled`: `1` locks the module.
- `dispose`: `1` checks cleanup.
- `content`: a JSON string, passed to the module as `context.content`.

The harness logs every `change`, `complete` and `busy` call below the module.
