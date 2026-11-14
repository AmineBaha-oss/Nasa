# Sources, licenses and provenance

**Requirement:** Before running or copying any third-party code, inspect exact upstream files and dependencies; take only legally reusable components. Commit source-and-license ledger entries with source URL, exact commit SHA, filenames, license, modifications, and required notices.

## NASA official and competition sources
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- NASA Challenge Resources tab: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources — listing checked; see below.
- Event deadlines/team size: https://www.spaceappschallenge.org/2026/
- NASA GO Team on prior work, NASA data, attribution and third-party materials: https://github.com/nasa/spaceapps/discussions/1827
- GO Team on video/slides and AI declaration: https://github.com/nasa/spaceapps/discussions/1973
- Official submission guide: https://www.spaceappschallenge.org/resources/ (confirm current 2026 edition)

## NASA data
- Enhanced south-pole SDEM: https://pgda.gsfc.nasa.gov/products/104 (A305 Connecting Ridge Extension 5m NASA lunar data)
- Dataset archive: https://zenodo.org/records/17954508 (v1.0.0, doi:10.5281/zenodo.17954508, CC BY 4.0). Subset redistributed in `data/nasa_a305/` with attribution; one modified derivative (slope CRS added), documented in its README.
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- NAIF/SPICE: https://naif.jpl.nasa.gov/naif/
- Lunar imaging: https://quickmap.lroc.asu.edu/
- NASA Moon Trek: https://trek.nasa.gov/moon/
- LOLA older reference (optional): https://pgda.gsfc.nasa.gov/products/78
- LOLA south-pole far-field DEMs (used, not redistributed; 80 m and 240 m files): https://pgda.gsfc.nasa.gov/products/90 ; cite Barker et al. (2023) doi:10.3847/PSJ/acf3e1

Licenses, citations and usage terms for every Science input (Horizons fair-use policy, NAIF rules, kernel list, Python packages) are in `science/SOURCES.md`.

## NASA engineering evidence (not general flight rules)
- VIPER **draft** landing/orientation requirements, PDF pages 6–7 (PDF zero-based page 6): https://assets.science.nasa.gov/content/dam/science/psd/lunar-science/documents/VIPER_Technical_Information_AFPP.pdf
- VIPER thermal/solar-azimuth engineering analysis (2025 ICES), PDF page 3: https://ntrs.nasa.gov/api/citations/20250004028/downloads/ICES-2025-376_Final.pdf

## Competitive examples and reuse candidates
- LUNAR//OPS: https://github.com/RootVandal/lunar-ops — Apache-2.0 for original project code/docs. Best scientific reference: SPICE and nested LOLA horizons. Validate and identify exact copied code/data separately.
- Lunar Horizon Wheel: https://github.com/NetRunnerXD/lunar-horizon-wheel — MIT. Best React/TS/Vite visualization/reuse reference.
- LunarSite Compass: https://github.com/partofcosmos-site/lunarsite-compass — MIT. Secondary UI/science reference, but Next.js differs from selected stack.
- Lunar Horizon: https://github.com/localizedprojects/CLPS-MOON-BROWSER — MIT main code. Flutter frontend is not directly portable to React; read its scientific QA methods.

## Expected data

`data/provenance/DATA_MANIFEST.json` records metadata and SHA256 from the earlier research handoff. Validate new downloads against it; the rasters are not present in this checkout. The primary DEM comes from the enhanced 2026 A305 SfS product. Four slope rasters were **locally corrected** to include its lunar CRS without changing pixel values. The first slope layer is in the CORE data bundle. The `GLDMASK` and `GLDBRES` layers are 15m; treat this as an observed-file detail rather than assuming identical grids from the NASA README. The supplied sigma TIFF is named `A305_GLDSIGM_005.tif`, while README prints `A305_GLDISGM_005.tif`.

## Resource verification (2026-11-14)

The official challenge Resources response lists Quickmap, Moon Trek and Horizons System. Selected planned input: https://ssd.jpl.nasa.gov/horizons/. See docs/CHALLENGE_RESOURCES.json for fetch hash and method. Horizons tables are now used as the reference for every Science ephemeris sample (`science/reference/horizons/`, cite as in `science/SOURCES.md`); eligibility still needs human confirmation.

Development references: https://vite.dev/guide/, https://vitest.dev/guide/, https://docs.pytest.org/en/stable/getting-started.html.

## Reuse review

| Repository | Pinned commit | Files inspected | License | Decision |
|---|---|---|---|---|
| https://github.com/RootVandal/lunar-ops | d9e14953defe1da62964f23d7913b46a88f80712 | LICENSE; pipeline/lunarops/horizon.py; tree for NOTICE inventory | Apache-2.0 | Reference only; no code copied |
| https://github.com/NetRunnerXD/lunar-horizon-wheel | 0c0c5f5c00e2be530f8e36053222883ebb402587 | LICENSE; src/HorizonWheel.tsx; package.json; tree for NOTICE inventory | MIT, copyright 2026 NetRunnerXD (Sounak Sarkar) | Reference only; no code copied |

LUNAR//OPS horizon computation depends on its geo and Raster modules plus NumPy. It replaces missing ray samples with -90 degrees; direct reuse would need explicit coverage tracking to satisfy LANDERPRINT unknown propagation. Integration cost is significant; science must validate curvature, gaps and projection independently. No upstream tests executed and no scientific correctness approval granted.

HorizonWheel depends on d3, React, a custom Series shape and CSS classes. Its bins use a half-step offset, whereas LANDERPRINT v1 bins start at i * step. Reuse needs a coordinate/contract adapter, null handling and independent UI tests. A small new SVG renderer may be cheaper. No component imported or approved for copying.

Repository trees contain no NOTICE-named files at these commits. This does not establish rights for every dependency or data asset. Any future copy needs full file/dependency audit, retained license text and human lead sign-off.
