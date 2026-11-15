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

## Expected data

`data/provenance/DATA_MANIFEST.json` records metadata and SHA256 from the earlier research handoff. Validate new downloads against it; the rasters are not present in this checkout. The primary DEM comes from the enhanced 2026 A305 SfS product. Four slope rasters were **locally corrected** to include its lunar CRS without changing pixel values. The first slope layer is in the CORE data bundle. The `GLDMASK` and `GLDBRES` layers are 15m; treat this as an observed-file detail rather than assuming identical grids from the NASA README. The supplied sigma TIFF is named `A305_GLDSIGM_005.tif`, while README prints `A305_GLDISGM_005.tif`.

## Resource verification (2026-11-14)

The official challenge Resources response lists Quickmap, Moon Trek and Horizons System. Selected planned input: https://ssd.jpl.nasa.gov/horizons/. See docs/CHALLENGE_RESOURCES.json for fetch hash and method. Horizons tables are now used as the reference for every Science ephemeris sample (`science/reference/horizons/`, cite as in `science/SOURCES.md`); eligibility still needs human confirmation.

Development references: https://vite.dev/guide/, https://vitest.dev/guide/, https://docs.pytest.org/en/stable/getting-started.html.

## Web 3D runtime (Plan B, MIT)

Installed under `web/` for the optional 3D navigator. Loaded only via `React.lazy` so the 2D path does not download them until the 3D toggle is used.

| Package              | Version | License | Source                                             |
| -------------------- | ------- | ------- | -------------------------------------------------- |
| `three`              | 0.186.1 | MIT     | https://github.com/mrdoob/three.js                 |
| `@react-three/fiber` | 9.8.2   | MIT     | https://github.com/pmndrs/react-three-fiber        |
| `@react-three/drei`  | 10.7.9  | MIT     | https://github.com/pmndrs/drei                     |
| `@types/three` (dev) | 0.186.0 | MIT     | https://github.com/DefinitelyTyped/DefinitelyTyped |

Fiber 9 pairs with React 19 (repo pins 19.2.8). No upstream scene code was copied; LANDERPRINT owns `web/src/scene3d/**` and `web/src/components/hud/**`.

Their transitive dependencies in `web/package-lock.json` are permissively licensed (MIT, ISC, Apache-2.0, BSD). All scene geometry is generated from the contract types; no third-party models. Agent guidance came from MIT skill packs EnzeD/r3f-skills @ 4a11805f and CloudAI-X/threejs-skills @ 0e181866 (installed at user level, not in the repository).
