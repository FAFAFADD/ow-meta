#!/usr/bin/env python
"""Generate the static dist site from data snapshots."""

from __future__ import annotations

import json
import shutil
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SNAPSHOT_DIR = DATA_DIR / "snapshots"
ASSET_DIR = ROOT / "assets"
DIST_DIR = ROOT / "dist"
DIST_DATA_DIR = DIST_DIR / "data"
DIST_HEROES_DIR = DIST_DIR / "heroes"
DIST_ASSET_DIR = DIST_DIR / "assets"
PATCH_EVENTS_SOURCE = DATA_DIR / "patch-events.jsonl"


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def load_snapshots() -> list[dict]:
    if not SNAPSHOT_DIR.exists():
        return []
    paths = sorted(SNAPSHOT_DIR.glob("snapshot-*.json"))
    return [json.loads(path.read_text(encoding="utf-8")) for path in paths]


def load_patch_events() -> list[dict]:
    if not PATCH_EVENTS_SOURCE.exists():
        return []
    events = []
    for line in PATCH_EVENTS_SOURCE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            events.append(json.loads(line))
    return events


def unique_hero_ids(latest: dict, snapshots: list[dict]) -> list[str]:
    ids: list[str] = []
    for payload in [latest, *snapshots]:
        for region in payload.get("regions", {}).keys() if "regions" in payload else payload:
            if region in ("capturedAt", "regions"):
                continue
            modes = payload.get(region, {})
            if not isinstance(modes, dict):
                continue
            for heroes in modes.values():
                for hero in heroes or []:
                    hero_id = hero.get("id")
                    if hero_id and hero_id not in ids:
                        ids.append(hero_id)
    return sorted(ids, key=str.lower)


def page_template(title: str, body: str, prefix: str = "") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(title)} - Overwatch 2 meta rates by official Blizzard data.">
<link rel="stylesheet" href="{prefix}assets/site.css">
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="{prefix}index.html"><span class="brand-mark">OW</span><span>Meta</span></a>
    <nav class="nav" aria-label="Primary">
      <a href="{prefix}index.html">Heroes</a>
      <a href="{prefix}patches.html">Patches</a>
    </nav>
  </div>
</header>
{body}
<footer class="footer">Source: Blizzard Overwatch 2 official rates data.</footer>
<script src="{prefix}assets/site.js"></script>
</body>
</html>
"""


def nav_active(page: str, target: str) -> str:
    return ' class="active"' if page == target else ""


def index_page(active_page: str = "index") -> str:
    body = f"""
<main class="shell" data-page="index">
  <div class="page-head">
    <div>
      <h1>Hero Rates</h1>
      <p class="page-meta">Overwatch 2 PC rates from the official Blizzard data source.</p>
    </div>
    <a class="link-row" href="patches.html">Patch changes</a>
  </div>
  <div class="toolbar" aria-label="Rates filters">
    <label class="field"><span>Region</span><select id="region">
      <option value="us">North America</option>
      <option value="eu">Europe</option>
      <option value="asia">Asia</option>
    </select></label>
    <label class="field"><span>Mode</span><select id="mode">
      <option value="competitive">Competitive</option>
      <option value="quickplay">Quick Play</option>
    </select></label>
  </div>
  <p class="meta-line" id="meta" aria-live="polite">Loading rates...</p>
  <div id="groups"><div class="empty-state">Loading rates...</div></div>
</main>"""
    return page_template("OW Meta | Hero Rates", body)


def patches_page() -> str:
    body = """
<main class="shell" data-page="patches">
  <div class="page-head">
    <div>
      <h1>Patch Changes</h1>
      <p class="page-meta">Changes detected between archived rate snapshots.</p>
    </div>
  </div>
  <div id="patch-list"><div class="empty-state">Loading patch changes...</div></div>
</main>"""
    return page_template("OW Meta | Patch Changes", body)


def detail_page(hero_id: str) -> str:
    body = f"""
<main class="shell" data-page="detail" data-hero="{escape(hero_id)}">
  <div id="detail-content">
    <div class="breadcrumb"><a href="index.html">Heroes</a> / <span>{escape(hero_id)}</span></div>
    <div class="empty-state">Loading rates...</div>
  </div>
</main>"""
    return page_template(f"{hero_id} | OW Meta", body, prefix="../")


def write_asset_files() -> None:
    DIST_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("site.css", "site.js"):
        shutil.copyfile(ASSET_DIR / name, DIST_ASSET_DIR / name)


def write_site_files(hero_ids: list[str]) -> None:
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    (DIST_DIR / "index.html").write_text(index_page(), encoding="utf-8")
    (DIST_DIR / "patches.html").write_text(patches_page(), encoding="utf-8")
    DIST_HEROES_DIR.mkdir(parents=True, exist_ok=True)
    for hero_id in hero_ids:
        safe_id = str(hero_id).replace("..", "").replace("/", "-").replace("\\", "-")
        (DIST_HEROES_DIR / f"{safe_id}.html").write_text(detail_page(safe_id), encoding="utf-8")


def build() -> None:
    latest = read_json(DATA_DIR / "latest.json", {})
    snapshots = load_snapshots()
    patch_events = load_patch_events()
    hero_ids = unique_hero_ids(latest, snapshots)

    write_asset_files()
    write_site_files(hero_ids)

    DIST_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DIST_DATA_DIR / "latest.json").write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    history = {"snapshots": snapshots}
    (DIST_DATA_DIR / "history.json").write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DIST_DATA_DIR / "patch-events.json").write_text(json.dumps(patch_events, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps({
        "heroes": len(hero_ids),
        "snapshots": len(snapshots),
        "patch_events": len(patch_events),
        "dist": str(DIST_DIR),
    }, ensure_ascii=False))


def main() -> int:
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())