# Science workflow

Create `.venv` with Python 3.11+; install `science/requirements.txt`, then run `.venv/Scripts/python -m pytest` (Windows) or `.venv/bin/python -m pytest` (Unix).

## Gate status

- **Gate 0:** `science/tests/test_manifest.py` checks provenance hash handoff integrity only (not NASA/ephemeris validation).
- **Gate 1 foundation:** ENU/az-el/yaw helpers, path-confined data roots, and `SiteDateData` v1.0 validation.
- **Gate 1 sites/ephemeris:** curated A305 sites + Oct 2027 windows (`science/sites/`), lunar stereo coords, DEM sampling, local horizon ray-march (`science/terrain/`), JPL Horizons client (`science/ephemeris/`), and `science/preprocess/build_site_date.py` → `data/processed/`.
- **Still open:** SPICE independent cross-check (SCIENCE-001), far-field LOLA horizons (DATA-004 → keep `local-only`).

Set `NASA_DATA_DIR` to your private extracted CORE directory (absolute path). Never commit rasters, credentials, or `.env` files. Science owns `science/` and `data/processed/`; Terrain owns `science/preprocess/terrain/`.

Missing science inputs must surface as `unknown` / `missing` quality—never fabricate JPL-verified results.
