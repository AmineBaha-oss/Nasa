# Science workflow

Create `.venv` with Python 3.11+; install `science/requirements.txt`, then run `.venv/bin/python -m pytest`. Initial tests verify handoff integrity only.

Set NASA_DATA_DIR to your private extracted CORE directory. Never commit rasters. No ephemeris pipeline or real raster validation has run at Gate 0. Science owns `science/` and `data/processed/`; Terrain owns `science/preprocess/terrain/`.
