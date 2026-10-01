#!/usr/bin/env python3
"""EmAI Academy XP bridge: completed learning-room units award skill XP.

skills-ms (release/2026-09) only awards XP for watched lectures. Completing a learning-room
unit records progress (skills_room_states.status = 'completed') but grants no XP, so 12 of
the 21 EmAI courses, which consist of rooms only, could never move the dashboard or the
skill tree. Until skills-ms awards XP for rooms itself (see README, upstream changes),
this sidecar does it:

  every POLL seconds:
    read completed units           SELECT user_id, unit_id FROM skills_room_states (read only)
    unit -> course                 learning_rooms.json: unit.path_id is the course id
    course -> sub-skills           skills_skill_course (read only)
    award ROOM_XP per unit/skill   POST skills-ms /_internal/xp-operations/{op}/{user}/{skill}

The internal endpoint is idempotent per operation id (it stores an exact receipt), and the
bridge derives the operation id from (user, unit, skill) with uuid5. Re-runs, restarts and
back-fills therefore never award twice. It also clears the skills-ms XP cache.

Python stdlib only; Postgres is read with the psql CLI.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

log = logging.getLogger("xp-bridge")

NAMESPACE = uuid.UUID("6f1d8a52-58b5-4a4e-9a3e-0e3a7c1f2b10")  # EmAI room XP, fixed forever
SKILLS_URL = os.environ.get("EMAI_SKILLS_INTERNAL_URL", "http://127.0.0.1:8011").rstrip("/")
JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET_SKILLS") or os.environ.get("JWT_SECRET", "")
DB = os.environ.get("EMAI_SKILLS_DB", "emai_skills")
PSQL = os.environ.get("PSQL", "psql")
PG_ARGS = ["-h", os.environ.get("PGHOST", "127.0.0.1"), "-U", os.environ.get("PGUSER", "academy"), "-d", DB]
ROOMS = Path(os.environ.get("LEARNING_ROOMS_CONTENT", ""))
ROOM_XP = int(os.environ.get("EMAI_ROOM_XP", "20"))
POLL = float(os.environ.get("EMAI_XP_BRIDGE_POLL", "3"))


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def internal_token() -> str:
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64(json.dumps({"aud": "skills", "exp": int(time.time()) + 60}).encode())
    sig = hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{b64(sig)}"


def sql(query: str) -> list[list[str]]:
    out = subprocess.run([PSQL, *PG_ARGS, "-AtF", "\t", "-c", query], check=True, capture_output=True, text=True).stdout
    return [line.split("\t") for line in out.splitlines() if line]


def unit_courses() -> dict[str, str]:
    data = json.loads(ROOMS.read_text(encoding="utf-8"))
    return {u["id"]: u["path_id"] for u in data.get("units", [])}


def award(user: str, unit: str, skill: str) -> str:
    op = uuid.uuid5(NAMESPACE, f"{user}:{unit}:{skill}")
    req = urllib.request.Request(
        f"{SKILLS_URL}/_internal/xp-operations/{op}/{user}/{skill}",
        data=json.dumps({"xp": ROOM_XP, "earning_id": str(op)}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {internal_token()}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read()).get("state", "?")


def run_once(done: set[tuple[str, str, str]]) -> int:
    units = unit_courses()
    skills: dict[str, list[str]] = {}
    for skill, course in sql("select skill_id, course_id from skills_skill_course"):
        skills.setdefault(course, []).append(skill)
    awarded = 0
    for user, unit in sql("select user_id, unit_id from skills_room_states where status = 'completed'"):
        course = units.get(unit)
        for skill in skills.get(course or "", []):
            key = (user, unit, skill)
            if key in done:
                continue
            try:
                state = award(user, unit, skill)
            except urllib.error.HTTPError as exc:
                # 404: user or skill gone; 503: auth service unavailable -> retry next round
                log.warning("award %s/%s/%s failed: HTTP %s %s", user, unit, skill, exc.code, exc.read()[:200])
                if exc.code in (404, 409):
                    done.add(key)
                continue
            done.add(key)
            awarded += 1
            log.info("unit %s (%s) -> %s +%s XP for %s: %s", unit, course, skill, ROOM_XP, user, state)
    return awarded


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    if not JWT_SECRET or not ROOMS.is_file():
        sys.exit("xp-bridge: JWT_SECRET and LEARNING_ROOMS_CONTENT must be set")
    log.info("polling %s every %ss, %s XP per completed unit, skills-ms %s", DB, POLL, ROOM_XP, SKILLS_URL)
    # `done` only saves HTTP calls; idempotency comes from the operation ids.
    done: set[tuple[str, str, str]] = set()
    once = "--once" in sys.argv
    while True:
        try:
            run_once(done)
        except Exception:  # noqa: BLE001 - keep polling
            log.exception("round failed")
        if once:
            return
        time.sleep(POLL)


if __name__ == "__main__":
    main()
