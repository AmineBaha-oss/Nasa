# Science workflow

Create `.venv` with Python 3.11+ and install `science/requirements.txt`. Run everything from the repository root unless noted.

## Inputs

- Local terrain: the validated NASA A305 subset is committed in `data/nasa_a305/` (the only raster allowed in Git). Set `NASA_DATA_DIR` only to point at a different extracted copy.
- SPICE kernels and LOLA far-field DEMs (about 440 MB, ignored by Git): `cd science; ..\.venv\Scripts\python.exe -m landerprint_science.kernels`. Files go to `data/raw/`; URLs, sizes and SHA256 are pinned in `data/provenance/SCIENCE_INPUTS.json`, and later runs stop if a hash changes.
- JPL Horizons reference tables are committed in `science/reference/horizons/`. Refresh them only when sites, windows or heights change: `python -m landerprint_science.horizons_ref --refresh` (one request at a time, per the SSD fair-use policy).

## Build

```
cd science
..\.venv\Scripts\python.exe -m landerprint_science.build
```

The build first checks A305 against LOLA 80 m (`data/provenance/A305_FRAME_CHECK.json`) and stops if they disagree. It then writes one `SiteDateData` file per site and window (`data/processed/site-<n>_window-<x>.json`, contract in `web/src/contracts/index.ts`) plus `data/processed/validation_report.json`.

Sites, windows and instrument heights live in `landerprint_science/config.py`. Panel (2 m) and antenna (3 m) heights are hypothetical until hardware is approved (HARDWARE-001); change them there and rerun `horizons_ref --refresh` and `build`.

## Tests

`.venv\Scripts\python.exe -m pytest` from the repository root. Ephemeris and export tests skip when kernels or build outputs are missing.

## Rules

- A sample is `jpl-verified` only when SPICE and Horizons agree to 0.01 deg in both azimuth (sky-scaled) and elevation.
- A horizon bin is `null` when any terrain sample on its rays is missing; a profile is `far-field-validated` only when all 360 bins are complete to 300 km.
- Science owns `science/` and `data/processed/`; Terrain owns `science/preprocess/terrain/`.
