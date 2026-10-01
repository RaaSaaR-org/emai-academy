# Boot placeholders (not real content)

dev-up.sh uses these files ONLY when the matching file under `content/` is missing,
so skills-ms-rooms can start before the real EmAI content exists. The real content
always wins. Nothing here is copied into `content/`.

| Placeholder | Stands in for |
|---|---|
| `learning_rooms.json` | `content/learning_rooms.json` |
| `character_areas.json` | `content/character_areas.json` |
| `courses/` | `content/courses/` |
