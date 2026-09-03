#!/usr/bin/env python
"""Fetch a full rates snapshot, diff it, and persist data assets."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import fetch

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SNAPSHOT_DIR = DATA_DIR / "snapshots"
PATCH_EVENTS = DATA_DIR / "patch-events.jsonl"
LATEST_FILE = DATA_DIR / "latest.json"
REGIONS = fetch.REGIONS
MODES = fetch.MODES
METRICS = ("winrate", "pickrate", "banrate")
FILENAME_TIME = "%Y%m%dT%H%M%SZ"


def _now_time() -> str:
    return datetime.now(timezone.utc).strftime(FILENAME_TIME)


def _iso_time(raw: str) -> str:
    parsed = datetime.strptime(raw, FILENAME_TIME).replace(tzinfo=timezone.utc)
    return parsed.isoformat().replace("+00:00", "Z")


def snapshot_path(time_value: str) -> Path:
    return SNAPSHOT_DIR / f"snapshot-{time_value}.json"


def previous_snapshot() -> dict | None:
    paths = sorted(SNAPSHOT_DIR.glob("snapshot-*.json")) if SNAPSHOT_DIR.exists() else []
    if not paths:
        return None
    return json.loads(paths[-1].read_text(encoding="utf-8"))


def _hero_list(snapshot: dict, region: str, mode: str) -> list[dict]:
    return snapshot.get(region, {}).get(mode, [])


def _metric(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _base_event(region: str, mode: str, hero: dict) -> dict:
    return {
        "hero": hero.get("id"),
        "name": hero.get("name"),
        "role": hero.get("role"),
        "region": region,
        "mode": mode,
    }


def diff_snapshots(previous: dict, current: dict) -> list[dict]:
    events = []
    for region in REGIONS:
        for mode in MODES:
            prev_heroes = {h.get("id"): h for h in _hero_list(previous, region, mode)}
            cur_heroes = {h.get("id"): h for h in _hero_list(current, region, mode)}
            for hero_id in sorted(set(prev_heroes) | set(cur_heroes)):
                if hero_id not in cur_heroes:
                    event = _base_event(region, mode, prev_heroes[hero_id])
                    event.update({"kind": "removed", "metric": None, "before": None, "after": None})
                    events.append(event)
                    continue
                if hero_id not in prev_heroes:
                    event = _base_event(region, mode, cur_heroes[hero_id])
                    event.update({"kind": "added", "metric": None, "before": None, "after": None})
                    events.append(event)
                    continue
                before_hero = prev_heroes[hero_id]
                after_hero = cur_heroes[hero_id]
                for metric in METRICS:
                    before = _metric(before_hero.get(metric))
                    after = _metric(after_hero.get(metric))
                    if before == after:
                        continue
                    event = _base_event(region, mode, after_hero)
                    event.update(
                        {
                            "kind": "change",
                            "metric": metric,
                            "before": before,
                            "after": after,
                            "delta": None if after is None or before is None else round(after - before, 3),
                        }
                    )
                    events.append(event)
    return events


def append_patch_events(events: list[dict], time_value: str) -> None:
    if not events:
        return
    PATCH_EVENTS.parent.mkdir(parents=True, exist_ok=True)
    with PATCH_EVENTS.open("a", encoding="utf-8", newline="\n") as handle:
        for event in events:
            line = {"time": _iso_time(time_value), **event}
            handle.write(json.dumps(line, ensure_ascii=False) + "\n")


def write_snapshot(payload: dict, time_value: str) -> Path:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = snapshot_path(time_value)
    snapshot = {**payload, "capturedAt": _iso_time(time_value)}
    path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def update_latest(payload: dict) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LATEST_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return LATEST_FILE


def run(time_value: str | None = None) -> dict:
    if time_value is None:
        time_value = _now_time()
    previous = previous_snapshot()
    payload = fetch.fetch_all(now=datetime.now(timezone.utc))
    events = diff_snapshots(previous, payload) if previous else []
    write_snapshot(payload, time_value)
    append_patch_events(events, time_value)
    update_latest(payload)
    return {"time": time_value, "snapshots": sum(len(payload[r][m]) for r in REGIONS for m in MODES), "events": len(events)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--at", help="Override the snapshot filename timestamp, e.g. 20260903T000000Z")
    args = parser.parse_args()
    result = run(time_value=args.at)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())