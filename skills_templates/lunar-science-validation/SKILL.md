---
name: lunar-science-validation
description: Audit NASA lunar raster coordinates, south-polar topography, scientific ephemerides, horizon coverage and provenance. Invoke when processing DEMs, slopes, Sun/Earth positions or scientific claims.
---

# Validate lunar science rather than trust model output

1. Read `docs/INTERFACES.md`, the data README, and `docs/SOURCES_AND_LICENSES.md`. Identify the exact model/input file, source, units, datum, CRS, axes and temporal time scale.
2. Record the dataset SHA256, dimensions, pixel transform, nodata handling and coverage. **Lunar projection is not Earth's EPSG:4326**; record the lunar-sphere radius used for coordinate transformations.
3. For the uploaded A305 data, account for the 4000×4000 DEM, 3990×3990 slope maps inset 25 m, 1333×1333 15-m mask/BRES, and position-based sampling. Do not align pixels using matching row/column indices.
4. Use `spiceypy` and correctly loaded NAIF kernels or JPL Horizons with explicit observing site, UTC/ET, axes and lunar body frame. Independently compare at least two time points; record tolerances and errors. If not verified, mark approximate/unknown.
5. Calculate terrain horizon over actual valid pixels with lunar curvature and clear ray coverage. Mark missing/distant terrain **unknown**; never assume empty sky.
6. Inspect observer height and Sun/Earth instrument heights independently. Test known unit vector geometry and local-north azimuth convention.
7. Output a reproducible pytest command, source hashes, input/output files, pass/fail results and limitations. No `GO` if essential scientific inputs remain unknown.
