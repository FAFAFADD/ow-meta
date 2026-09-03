#!/usr/bin/env python
"""Fetch and normalize Overwatch 2 rates from Blizzard's official endpoint."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone

import requests

API_URL = "https://overwatch.blizzard.com/en-us/rates/data/"
REGIONS = ("us", "eu", "asia")
MODES = ("competitive", "quickplay")
RETRY_COUNT = 3
RETRY_DELAY = 1


def _query(session: requests.Session, region: str, mode: str) -> requests.Response:
    params = {
        "input": "PC",
        "region": region,
        "gameMode": mode,
        "map": "all-maps",
        "role": "All",
        "rq": "0",
    }
    last_error: Exception | None = None
    for attempt in range(1, RETRY_COUNT + 1):
        try:
            response = session.get(API_URL, params=params, timeout=30)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            if attempt < RETRY_COUNT:
                time.sleep(RETRY_DELAY)
    raise RuntimeError(f"rates request failed after {RETRY_COUNT} retries for {region}/{mode}: {last_error}")


def _parse_response(region: str, mode: str, response: requests.Response) -> list[dict]:
    body = response.json()
    rates = body.get("rates", {}).get("rates", [])
    heroes = []
    for item in rates:
        cells = item.get("cells", {})
        hero = item.get("hero", {})
        heroes.append(
            {
                "id": item.get("id") or hero.get("id") or cells.get("name", "").lower(),
                "name": cells.get("name") or hero.get("name") or "Unknown",
                "role": str(hero.get("role") or "").upper(),
                "subrole": hero.get("subrole") or "",
                "winrate": cells.get("winrate"),
                "pickrate": cells.get("pickrate"),
                "banrate": cells.get("banrate"),
                "portrait": hero.get("portrait") or "",
                "color": hero.get("color") or "",
            }
        )
    heroes.sort(key=lambda hero: (hero["role"], hero["name"].lower()))
    return heroes


def fetch_all(now: datetime | None = None) -> dict:
    """Return {capturedAt, region: {mode: [hero...]}} for every supported combo."""
    if now is None:
        now = datetime.now(timezone.utc)
    session = requests.Session()
    # Windows machines on this repo's dev setup often have stale system proxy
    # settings, so the pipeline uses the sandbox's direct network connection.
    session.trust_env = False
    payload = {"capturedAt": now.isoformat().replace("+00:00", "Z")}
    for region in REGIONS:
        payload[region] = {}
        for mode in MODES:
            response = _query(session, region, mode)
            payload[region][mode] = _parse_response(region, mode, response)
    return payload


if __name__ == "__main__":
    print(json.dumps(fetch_all(), indent=2, ensure_ascii=False))