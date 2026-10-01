#!/usr/bin/env python3
"""Build content/learning_rooms.json from the authoring sources in content/rooms/*.yml.

Authoring format (one file per learning path, file order = catalogue order via `order`):

    order: 10
    path:
      id: physical-ai-grundlagen
      title: {de: ..., en: ...}
      direction_id: entscheider
      chapters: [{id: ..., title: {de: ..., en: ...}}]
    units:
      - id: pai-was-ist-physical-ai
        chapter_id: pai-begriffe
        title: {de: ..., en: ...}
        room: guided-lesson            # guided-lesson | video | custom
        teaches: [...]; practices: [...]; requires: [...]
        allow_skip: true               # optional, default true
        steps: [...]                   # guided-lesson: bilingual steps (see below)
        video: {type: youtube, id: ...}  # video
        body: {de: ..., en: ...}         # video (optional)
        module_id: ...                   # custom
        completion_answer: {...}         # custom: exactly what the module sends to host.complete()
        content: {de: {...}, en: {...}}  # custom (passed to the module unchanged)

Guided-lesson steps are written once with bilingual leaves ({de, en}); shared fields
(`code`, `output`, check ids, option values, answers) are written once and copied to both
languages. The completion answer is derived from the checks, so de/en can never diverge
from `completion.answer`.

Custom units must state `completion_answer`: the exact object the lesson module posts via
host.complete() (contract: content/modules/README.md). The server compares canonical JSON.

Usage: python content/tools/build_learning_rooms.py [--check]
  --check  fail if the generated JSON differs from the committed file
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

CONTENT = Path(__file__).resolve().parents[1]
SOURCES = CONTENT / "rooms"
TARGET = CONTENT / "learning_rooms.json"
LANGS = ("de", "en")


def loc(value, where: str, lang: str):
    if not isinstance(value, dict) or set(value) != set(LANGS):
        raise SystemExit(f"{where}: expected a {{de, en}} mapping, got {value!r}")
    text = value[lang]
    if not isinstance(text, str) or not text.strip():
        raise SystemExit(f"{where}.{lang}: empty text")
    return text.strip()


def build_step(step: dict, where: str, lang: str) -> dict:
    out: dict = {"id": step["id"], "title": loc(step["title"], f"{where}.title", lang),
                 "body": loc(step["body"], f"{where}.body", lang)}
    for shared in ("code", "output", "stdin"):
        if shared in step:
            out[shared] = step[shared]
    if "note" in step:
        out["note"] = loc(step["note"], f"{where}.note", lang)
    if "experiment" in step:
        e = step["experiment"]
        op = e["operation"]
        if op.get("kind") not in ("multiply", "threshold"):
            raise SystemExit(f"{where}.experiment: the frontend supports only multiply/threshold")
        if not (e["min"] <= e["initial"] <= e["max"]):
            raise SystemExit(f"{where}.experiment: initial outside [min, max]")
        exp = {"id": e["id"], "label": loc(e["label"], f"{where}.experiment.label", lang),
               "min": e["min"], "max": e["max"], "initial": e["initial"],
               "resultLabel": loc(e["resultLabel"], f"{where}.experiment.resultLabel", lang),
               "operation": op}
        if "code" in e:
            exp["code"] = loc(e["code"], f"{where}.experiment.code", lang) if isinstance(e["code"], dict) else e["code"]
        out["experiment"] = exp
    if "check" in step:
        c = step["check"]
        values = [o["value"] for o in c["options"]]
        if c["answer"] not in values or len(set(values)) != len(values):
            raise SystemExit(f"{where}.check: answer {c['answer']!r} not among unique option values {values}")
        out["check"] = {
            "id": c["id"],
            "question": loc(c["question"], f"{where}.check.question", lang),
            "options": [{"value": o["value"], "text": loc(o["text"], f"{where}.check.option", lang)}
                        for o in c["options"]],
            "answer": c["answer"],
            "correct": loc(c["correct"], f"{where}.check.correct", lang),
            "tryAgain": loc(c["tryAgain"], f"{where}.check.tryAgain", lang),
        }
    return out


def build_unit(src: dict, path_id: str) -> dict:
    uid = src["id"]
    room = src["room"]
    unit: dict = {
        "id": uid,
        "path_id": path_id,
        **({"chapter_id": src["chapter_id"]} if src.get("chapter_id") else {}),
        "title": {lang: loc(src["title"], f"{uid}.title", lang) for lang in LANGS},
        "room": room,
        "teaches": src.get("teaches", []),
        "practices": src.get("practices", []),
        "requires": src.get("requires", []),
        "retired": bool(src.get("retired", False)),
    }
    allow_skip = bool(src.get("allow_skip", True))
    if room == "guided-lesson":
        steps = src["steps"]
        ids = [s["id"] for s in steps]
        check_ids = [s["check"]["id"] for s in steps if "check" in s]
        if len(set(ids)) != len(ids) or len(set(check_ids)) != len(check_ids):
            raise SystemExit(f"{uid}: duplicate step or check ids")
        unit["content"] = {lang: {"steps": [build_step(s, f"{uid}.{s['id']}", lang) for s in steps]}
                           for lang in LANGS}
        unit["completion"] = {"kind": "introduced",
                              "answer": {s["check"]["id"]: s["check"]["answer"] for s in steps if "check" in s},
                              "allow_skip": allow_skip}
    elif room == "video":
        content = {}
        for lang in LANGS:
            entry: dict = {"video": dict(src["video"])}
            if "body" in src:
                entry["body"] = loc(src["body"], f"{uid}.body", lang)
            content[lang] = entry
        unit["content"] = content
        unit["completion"] = {"kind": "introduced", "answer": {"viewed": True}, "allow_skip": allow_skip}
    elif room == "custom":
        unit["module_id"] = src["module_id"]
        if set(src["content"]) != set(LANGS):
            raise SystemExit(f"{uid}: custom content needs de and en")
        unit["content"] = src["content"]
        answer = src.get("completion_answer")
        if not isinstance(answer, dict) or not answer:
            raise SystemExit(f"{uid}: custom unit needs completion_answer (what the module sends)")
        unit["completion"] = {"kind": "introduced", "answer": answer, "allow_skip": allow_skip}
    else:
        raise SystemExit(f"{uid}: room kind {room!r} is not used by EmAI (no renderer / no challenges-ms)")
    return unit


def build() -> dict:
    files = []
    for file in sorted(SOURCES.glob("*.yml")):
        with file.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
        files.append((data.get("order", 1000), file.name, data))
    files.sort(key=lambda item: (item[0], item[1]))
    paths, units = [], []
    for _, name, data in files:
        p = data["path"]
        pid = p["id"]
        if name != f"{pid}.yml":
            raise SystemExit(f"{name}: file name must equal path id ({pid}.yml)")
        built_units = [build_unit(u, pid) for u in data["units"]]
        path = {"id": pid, "title": {lang: loc(p["title"], f"{pid}.title", lang) for lang in LANGS}}
        if p.get("direction_id"):
            path["direction_id"] = p["direction_id"]
        if p.get("chapters"):
            path["chapters"] = [{"id": c["id"], "title": {lang: loc(c["title"], f"{pid}.{c['id']}", lang)
                                                          for lang in LANGS}} for c in p["chapters"]]
        path["units"] = [u["id"] for u in built_units]
        paths.append(path)
        units.extend(built_units)
    return {"paths": paths, "units": units}


def main() -> None:
    catalogue = build()
    text = json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != text:
            raise SystemExit(f"{TARGET} is stale; run build_learning_rooms.py")
        print("learning_rooms.json is up to date")
        return
    TARGET.write_text(text, encoding="utf-8")
    print(f"wrote {TARGET} ({len(catalogue['paths'])} paths, {len(catalogue['units'])} units)")


if __name__ == "__main__":
    main()
