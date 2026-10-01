#!/usr/bin/env python3
"""Write content/skills/layout.json: a readable skill-tree layout for the EmAI curriculum.

The upstream skill tree draws `row` as x and `column` as y (150 px per unit at the default zoom)
and on a first visit centres the node nearest to the centre of the bounding box of all nodes
(resolveInitialSkilltreeTarget). At 1440x900 a window of rows c-4..c+4 and columns c-2..c+1
around that node is fully visible (navbar on top, labels below the nodes), so the roots span
rows 7..15 and columns 9..12 with a node on the bbox centre (11, 10.5 -> daten at 11, 11). Root skills follow the two tracks from left to right (one level per two rows);
sub-skills are laid out per root by dependency depth (rows) and centred per level (columns).
scripts/seed.sh applies the file through the skills-ms admin API.
Usage: python3 content/tools/build_layout.py   (only needs PyYAML, e.g. the skills-ms-rooms .venv)
"""
import json
from pathlib import Path

import yaml

SKILLS = Path(__file__).resolve().parents[1] / "skills"

# rows x columns of the root tree, and (row, column) per root skill
GRID = 20
ROW_CENTER = 11  # x
COLUMN_CENTER = 11  # y
ROOT_ROWS, ROOT_COLUMNS = GRID, GRID
ROOTS = {
    # x = row, y = column. Only about four column units (9..12) are fully visible below the
    # navbar at the default zoom, so the levels are staggered instead of stacked three high.
    "physical_ai_grundlagen": (7, 10),
    "safety_security_souveraenitaet": (9, 9),  # Decider lane (top)
    "roboter_hardware_embodiments": (9, 11),
    "robotik_software_grundlagen": (10, 12),
    "physical_ai_im_unternehmen": (12, 9),
    "daten_fuer_robot_learning": (11, 11),  # bbox centre: the tree opens centred here
    "simulation_reinforcement_learning": (13, 12),
    "imitation_learning_vlas": (14, 10),
    "evaluation_deployment": (15, 11),
}


def depth_layout(subs: dict) -> tuple[dict, int, int]:
    depth: dict[str, int] = {}

    def d(s: str) -> int:
        if s not in depth:
            deps = [x for x in subs[s].get("dependencies") or [] if x in subs]
            depth[s] = 0 if not deps else 1 + max(d(x) for x in deps)
        return depth[s]

    for s in subs:
        d(s)
    levels: dict[int, list[str]] = {}
    for s in subs:  # keep file order inside a level
        levels.setdefault(depth[s], []).append(s)
    pos = {}
    first_row = ROW_CENTER - (len(levels) - 1)  # two rows per level, centred
    for lvl, names in levels.items():
        first_col = COLUMN_CENTER - len(names) // 2 * 2 + (1 if len(names) % 2 == 0 else 0)
        for i, s in enumerate(names):
            pos[s] = {"row": first_row + 2 * lvl, "column": first_col + 2 * i}
    return pos, GRID, GRID


def main() -> None:
    out = {"rows": ROOT_ROWS, "columns": ROOT_COLUMNS, "skills": {}, "sub_skills": {}}
    for f in sorted(SKILLS.glob("*.yml")):
        root = f.stem
        data = yaml.safe_load(f.read_text())
        pos, rows, cols = depth_layout(data.get("skills") or {})
        r, c = ROOTS[root]
        out["skills"][root] = {"row": r, "column": c, "sub_tree_rows": rows, "sub_tree_columns": cols}
        for sub, p in pos.items():
            out["sub_skills"][f"{root}/{sub}"] = p
    missing = set(ROOTS) - set(out["skills"])
    assert not missing, f"layout for unknown roots: {missing}"
    (SKILLS / "layout.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {SKILLS / 'layout.json'} ({len(out['skills'])} roots, {len(out['sub_skills'])} sub-skills)")


if __name__ == "__main__":
    main()
