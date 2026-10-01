#!/usr/bin/env python3
"""Validate the EmAI content against the real skills-ms (release/2026-09) models and loaders.

Run with the skills-ms virtualenv and the rooms worktree on PYTHONPATH (nothing is written
into the worktree):

    cd emai-academy   (repo root)
    PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=../skills-ms-rooms \
      ../skills-ms/.venv/bin/python content/tools/validate.py

(`../skills-ms-rooms/.venv/bin/python` works too once `nix develop` has created it.)

Checks, all with upstream code where upstream has it:
 1. learning_rooms.json is up to date with content/rooms/*.yml
 2. Catalogue.parse_raw via api.services.rooms.load_catalogue (same code path as startup)
 3. every course via api.services.courses (COURSES env) incl. _check_course_definitions
 4. every course's derived curriculum via api.services.curriculum.definitions
    (catches the request-time 503 "Dieser Kurs kann gerade nicht geladen werden")
 5. guided-lesson answers: completion.answer == checks (de) == checks (en), lessonAnswers() semantics
 6. skills via scripts/sync_skills.py (load + definitions + dependencies + course links),
    plus: every course is linked to exactly one sub-skill, no dependency cycles
 7. character_areas.json via CharacterAreaCatalogue, root ids exist in content/skills
 8. custom units use the agreed lesson modules with exactly the completion answer each module
    posts (content/modules/README.md); built descriptors validate as LessonModuleDescriptor
 9. youtube ids used in courses/rooms are listed in content/tools/verified_videos.json
10. house style: no "humanoid" wording anywhere in the content
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parents[1]
os.environ.setdefault("COURSES", str(CONTENT / "courses"))
os.environ.setdefault("LEARNING_ROOMS_CONTENT", str(CONTENT / "learning_rooms.json"))
os.environ.setdefault("CHARACTER_AREAS", str(CONTENT / "character_areas.json"))
os.environ.setdefault("MP4_LECTURES", str(CONTENT / "lectures"))
os.environ.setdefault("ROOMS_ENABLED", "True")
# Only needed so importing api.database works; no connection is opened by this script.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://academy@127.0.0.1:5432/emai_skills")

# Contract with content/modules/README.md: module id -> the object the module posts to host.complete().
MODULE_ANSWERS = {
    "robot-arm-kinematics": {"reached": True},
    "teleop-dataset-explorer": {"fps": 30, "lagging_joint": "elbow_flex", "gripper_gap": "contact"},
}
errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)
    print(f"  FAIL {msg}")


def ok(msg: str) -> None:
    print(f"  ok   {msg}")


def main() -> None:
    print("1. build freshness")
    r = subprocess.run([sys.executable, str(CONTENT / "tools/build_learning_rooms.py"), "--check"],
                       capture_output=True, text=True)
    (ok if r.returncode == 0 else fail)((r.stdout + r.stderr).strip())

    print("2. learning rooms catalogue")
    from api.services import rooms
    from api.settings import settings
    assert str(settings.learning_rooms_content) == os.environ["LEARNING_ROOMS_CONTENT"], "settings not from env"
    try:
        catalogue = rooms.load_catalogue()
        ok(f"{len(catalogue.paths)} paths, {len(catalogue.units)} units")
    except Exception as e:  # HTTPException 503 hides the pydantic error; re-parse to show it
        from api.schemas.rooms import Catalogue
        try:
            Catalogue.parse_file(os.environ["LEARNING_ROOMS_CONTENT"])
        except Exception as inner:
            fail(f"catalogue: {inner}")
        else:
            fail(f"catalogue: {e}")
        return

    print("3. courses")
    from api.services.courses import COURSES
    ok(f"{len(COURSES)} courses: {', '.join(sorted(COURSES))}")
    path_ids = {p.id for p in catalogue.paths}
    for cid, course in COURSES.items():
        if course.learning_path_id and course.learning_path_id not in path_ids:
            fail(f"course {cid}: learning_path_id {course.learning_path_id} not in catalogue")
        if not course.learning_path_id and not course.sections:
            fail(f"course {cid}: neither learning path nor sections (empty course)")
        if course.price != 0:
            fail(f"course {cid}: price must be 0 for EmAI (no shop)")
        if "en" not in course.translations:
            fail(f"course {cid}: missing en translation")
    linked = {c.learning_path_id for c in COURSES.values() if c.learning_path_id}
    for pid in path_ids - linked:
        fail(f"path {pid} is not linked by any course")

    print("4. derived curricula")
    from api.services import curriculum
    for cid, course in COURSES.items():
        try:
            definition, _ = curriculum.definitions(course, catalogue)
            if not definition.lessons:
                fail(f"course {cid}: curriculum has no lessons")
        except Exception as e:
            fail(f"course {cid}: curriculum {getattr(e, 'detail', e)}")
    ok("curriculum definitions resolved")

    print("5. guided-lesson answers")
    for unit in catalogue.units:
        if unit.room != "guided-lesson":
            continue
        per_lang = {}
        for lang in ("de", "en"):
            steps = unit.content[lang]["steps"]
            per_lang[lang] = {s["check"]["id"]: s["check"]["answer"] for s in steps if "check" in s}
            for s in steps:
                if "check" in s and s["check"]["answer"] not in {o["value"] for o in s["check"]["options"]}:
                    fail(f"{unit.id}/{lang}: answer not among options")
        if not (per_lang["de"] == per_lang["en"] == unit.completion.answer):
            fail(f"{unit.id}: completion.answer {unit.completion.answer} != checks {per_lang}")
    ok("answers consistent")

    print("6. skills")
    sys.argv = ["sync_skills"]
    import scripts.sync_skills as sync
    skills = sync._load_skills(CONTENT / "skills")
    sync._check_skills_definitions(skills)
    sync._check_skill_dependencies(skills)
    sync._check_skill_courses(skills, set(COURSES))
    from graphlib import TopologicalSorter
    list(TopologicalSorter({k: set(v.dependencies) for k, v in skills.items()}).static_order())
    links: dict[str, list[str]] = {}
    for root_id, root in skills.items():
        for sub_id, sub in root.skills.items():
            for cid in sub.courses:
                links.setdefault(cid, []).append(f"{root_id}/{sub_id}")
    for cid in COURSES:
        if len(links.get(cid, [])) != 1:
            fail(f"course {cid} linked to sub-skills {links.get(cid, [])} (expected exactly one)")
    ok(f"{len(skills)} root skills, {sum(len(r.skills) for r in skills.values())} sub-skills")

    print("7. character areas")
    from api.services.character_areas import load_areas
    areas = load_areas(settings.character_areas)
    for area in areas.areas:
        for root in area.root_skill_ids:
            if root not in skills:
                fail(f"area {area.id}: unknown root {root}")
    ok(f"{len(areas.areas)} area(s)")

    print("8. custom modules")
    from api.schemas.lesson_module import LessonModuleDescriptor
    customs = [u for u in catalogue.units if u.room == "custom"]
    if {u.module_id for u in customs} != set(MODULE_ANSWERS):
        fail(f"custom module ids {sorted({u.module_id for u in customs})} != {sorted(MODULE_ANSWERS)}")
    for unit in customs:
        expected = MODULE_ANSWERS.get(unit.module_id)
        if json.dumps(unit.completion.answer, sort_keys=True) != json.dumps(expected, sort_keys=True):
            fail(f"{unit.id}: completion.answer {unit.completion.answer} != module contract {expected}")
        if "module" in unit.content.get("de", {}) or "module" in unit.content.get("en", {}):
            fail(f"{unit.id}: content must not carry a module URL")
    for mid in sorted(MODULE_ANSWERS):
        descriptor = CONTENT / "modules" / "dist" / "descriptors" / f"{mid}.json"
        if descriptor.exists():
            try:
                d = LessonModuleDescriptor.parse_file(descriptor)
                if d.id != mid:
                    fail(f"{descriptor}: id {d.id} != {mid}")
                else:
                    ok(f"{mid}: descriptor valid ({d.entry_url})")
            except Exception as e:
                fail(f"{descriptor}: {e}")
        else:
            print(f"  note {mid}: no content/modules/dist/descriptors/{mid}.json yet (run content/modules/build.sh)")
    ok("custom units match the module contract")

    print("9. youtube ids")
    verified = json.loads((CONTENT / "tools/verified_videos.json").read_text())
    used_ids = set()
    for course in COURSES.values():
        for section in course.sections:
            for lecture in section.lectures:
                if lecture.type == "youtube":
                    used_ids.add(lecture.video_id)
                    v = verified.get(lecture.video_id)
                    if v and v["duration"] != lecture.duration:
                        fail(f"{course.id}/{lecture.id}: duration {lecture.duration} != verified {v['duration']}")
    for unit in catalogue.units:
        if unit.room == "video":
            for lang in ("de", "en"):
                if unit.content[lang]["video"]["type"] == "youtube":
                    used_ids.add(unit.content[lang]["video"]["id"])
    for vid in sorted(used_ids - set(verified)):
        fail(f"youtube id {vid} not in verified_videos.json")
    ok(f"{len(used_ids)} youtube ids, all verified")

    print("10. house style")
    for file in [*CONTENT.glob("rooms/*.yml"), *CONTENT.glob("courses/*.yml"), *CONTENT.glob("skills/*.yml"),
                 CONTENT / "learning_rooms.json"]:
        text = file.read_text(encoding="utf-8")
        if re.search(r"humanoid", text, re.IGNORECASE):
            fail(f"{file.name}: contains 'humanoid' (house style: 'kognitive Roboter')")
    ok("no 'humanoid' wording")

    print()
    if errors:
        print(f"{len(errors)} problem(s)")
        sys.exit(1)
    print("content is valid")


if __name__ == "__main__":
    main()
