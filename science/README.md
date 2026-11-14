# Science workflow

Create `.venv` with Python 3.11+; install `science/requirements.txt`, then run `.venv/Scripts/python -m pytest` (Windows) or `.venv/bin/python -m pytest` (Unix).

## Gate status

- **Gate 0:** `science/tests/test_manifest.py` checks provenance hash handoff integrity only (not NASA/ephemeris validation).
- **Gate 1 foundation (this branch):** ENU/az-el/yaw helpers (`science/geometry/`), path-confined data roots (`science/io/`), and `SiteDateData` v1.0 validation (`science/schema/`). These block accidental path escape and forged `jpl-verified` labels.
- **Not yet:** SPICE/Horizons ephemeris pipeline, DEM horizon ray-march, or research JSON under `data/processed/` with real site claims.

Set `NASA_DATA_DIR` to your private extracted CORE directory (absolute path). Never commit rasters, credentials, or `.env` files. Science owns `science/` and `data/processed/`; Terrain owns `science/preprocess/terrain/`.

Missing science inputs must surface as `unknown` / `missing` quality—never fabricate JPL-verified results.
