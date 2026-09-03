# OW Meta

Pure static Overwatch 2 meta site built from Blizzard's official rates data. The repository archives snapshots on a schedule so trends can be shown without any backend.

## Data pipeline

Requirements: Python 3.12+ and `requests`.

```bash
python scripts/snapshot.py
python scripts/build.py
```

Run both together:

```bash
python scripts/snapshot.py && python scripts/build.py
```

Windows PowerShell 5 does not support `&&`. In PowerShell run the two commands separately:

```powershell
python scripts/snapshot.py
python scripts/build.py
```

The scripts expect to run from the repository root. `snapshot.py` fetches PC rates for `us`, `eu`, and `asia` in both `competitive` and `quickplay`, writes a timestamped file under `data/snapshots/`, appends detected metric changes to `data/patch-events.jsonl`, and updates `data/latest.json`. `build.py` writes the static site under `dist/`.

## Local preview

Serve `dist/` with Python's static server:

```bash
python -m http.server 8000 --directory dist
```

Then open `http://127.0.0.1:8000/`.

You can also serve the repository root and open `http://127.0.0.1:8000/dist/`. Opening `dist/index.html` through `file://` will not load JSON due to browser file restrictions; the page shows a hint to use the HTTP server.

## GitHub Actions

`.github/workflows/pipeline.yml` runs every four hours and on manual dispatch. It installs `requests`, runs snapshot and build, commits `data/` plus `dist/` back to `main`, then deploys `dist/` to GitHub Pages.

After the first push:

1. Open the GitHub repository settings.
2. Select Pages.
3. Set Source to GitHub Actions.
4. Run the `ow-meta-pipeline` workflow manually once.

## Scope

This MVP deliberately has no login, payments, comments, AI features, accounts, mobile app, or frontend framework. Pages are plain HTML, CSS, and JavaScript.