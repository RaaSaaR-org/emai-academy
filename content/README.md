# EmAI Academy content

Content for the EmAI tenant of skills-ms (`skills-ms-rooms`, release/2026-09). Full write-up:
`../docs/spike/content-result.md`.

| Path | What | Edited by hand? |
|---|---|---|
| `skills/*.yml` | 9 root skills, 21 sub-skills (root id = file name) | yes |
| `courses/*.yml` | 21 courses (course id = file name), all `price: 0` | yes |
| `rooms/*.yml` | learning-path sources, one file per path (= course id), bilingual | yes |
| `learning_rooms.json` | catalogue loaded by skills-ms (`LEARNING_ROOMS_CONTENT`) | **no, generated** |
| `character_areas.json` | one area `physical-ai` (`CHARACTER_AREAS`) | yes |
| `lectures/` | mp4 lecture root (`MP4_LECTURES`), empty for now | - |
| `modules/` | custom lesson modules (owned by the modules work stream) | see its README |
| `tools/build_learning_rooms.py` | `rooms/*.yml` -> `learning_rooms.json` | - |
| `tools/validate.py` | validates everything with the upstream models/loaders | - |
| `tools/verified_videos.json` | YouTube ids checked via oEmbed + duration | yes, when adding videos |

Workflow after editing:

```sh
cd emai-academy   # the repo root
../skills-ms-rooms/.venv/bin/python content/tools/build_learning_rooms.py
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=../skills-ms-rooms ../skills-ms-rooms/.venv/bin/python content/tools/validate.py
scripts/reload-content.sh      # skills-ms reads content only at startup
```
