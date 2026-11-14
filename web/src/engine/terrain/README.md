# Terrain engine: preliminary deployment screen

Owner: Francisco (`francisco/terrain`). Scope: `web/src/engine/terrain/` only. Contract: `web/src/contracts/index.ts` v1.0, used unchanged.

**This is a resolved-scale 5 m slope screen, not a landing-safety certification.**
- A 5 m grid cannot resolve rocks and boulders (e.g. 15 cm), small craters, footpad-scale hazards or ramp clearance. Every result says so in `unresolved`.
- Slope thresholds are set by the user. VIPER's draft ≤10° values are VIPER-specific examples, not lunar standards.

## Public interface (agreed test seams)

| Seam | Functions | What it does |
|---|---|---|
| Geodesy | `lunarToPolarStereo(lat, lonEast)`, `azimuthToGridDirection(point, azDeg)` | Converts latitude/longitude to Moon south polar stereographic metres, and converts a true-north azimuth into a grid direction |
| Sampling | `sampleAt(grid, x, y)`, `interpolateAt(grid, x, y)` | Reads the pixel containing a point, or interpolates bilinearly between pixel centres. Uses projected coordinates, never array indices |
| Deployment | `evaluateDeployment(site, { dem, slope5m }, hardware, yawDeg, thresholds)` | Produces `deployment: ConstraintResult` for `HeadingEvaluation.deployment`, plus `unresolved` and footprint/ramp detail |

## Data facts used

Sources: `data/provenance/DATA_MANIFEST.json` and the publisher `README.txt`.

- **Projection:** `+proj=stere +lon_0=0 +lat_0=-90 +R=1737400 +units=m`, giving `x = ρ sin λ`, `y = ρ cos λ` with `ρ = 2R tan(45° + lat/2)`. Tests reproduce the publisher's four tile corners to within 0.5 m.
- **True north vs grid "up":** true north points away from the pole, along `(x, y)/ρ`. At the preliminary candidate site (−89.111829°, −102.71398°E), true north points mostly toward grid −x, about 103° from grid "up". Ramp headings use true north.
- **DEM** `A305_GLDELEV_005.tif`: 4000×4000 pixels at 5 m, corner (−38700, 3900). Nodata is `-3.4028234663852886e+38`.
- **Slope** `derived/A305_GLDTSLP_005_005_lunar_crs.tif`: 3990×3990 pixels at 5 m, corner (−38675, 3875), inset 25 m. Slope pixel (0, 0) lies on DEM pixel (5, 5); tests check this co-location by coordinate.
- **Slope units are degrees.** The publisher README does not state the units. A reviewer decoded the real files on 2026-11-14 and compared 2,000 random pixels with the DEM. The values match `atan(hypot(Δz_x, Δz_y) / 10 m)`, a central difference over 10 m, at DEM offset (+5, +5), with an RMS difference of 0.000. The range is 0–59.19°.
- **No nodata in the slope files.** The original and corrected slope files have no nodata tag and no NaN values. The manifest lists `nodata: null` for them.
- **Missing values:** null, NaN, the declared nodata and any value at float32-extreme magnitude (≥ 3e38) are unknown, never zero.
  - The sentinel comparison works at float32 precision, so rounded forms such as `-3.40282e38` and manifest strings also match.
  - Physically impossible values are missing too: slope outside [0, 90]°, or elevation beyond ±100 km.
- **Malformed grids:** a non-positive pixel size, a values length that differs from width × height, or a non-finite origin gives `unknown` with an "invalid grid" reason.
- **Producers must not fill with zero.** The slope files have no nodata tag, so a windowed read past the tile edge that fills with 0 would look like flat ground. Clip windows to the raster, or fill with null or NaN.
- **Typed arrays:** `values` accepts any `ArrayLike`, including `Float32Array`, where NaN means missing.

## Method

**Footprint** (needs `landingFootprintRadiusM`):
- Take the maximum NASA 5 m slope over slope pixels whose centres are within the radius of the site. The pixel under the site always counts.
- Any value above the threshold gives `fail`. A definite exceedance is reported even when other footprint pixels are missing.
- Otherwise, any missing pixel, or a footprint extending past the slope tile, gives `unknown`. The scan is limited to the tile, so a huge radius stays fast.
- Otherwise `pass`. Exactly equal to the threshold passes.

**Ramp** (needs `rampHeadingBodyDeg` and `rampLengthM`):
- Heading: `yaw + rampHeadingBodyDeg`, measured clockwise from true north.
- Slope: `atan(Δz / L)`, from the DEM elevation at the footprint edge to the elevation `L` metres further along the heading, using bilinear interpolation.
- The magnitude is compared with the threshold, so a steep downhill also fails.
- The whole profile is checked at half-pixel steps. Missing DEM anywhere along the ramp, a ramp running off the patch, or `L` shorter than two DEM pixels (10 m) gives `unknown`.
- A missing or invalid footprint radius also gives `unknown`, because the ramp's start point depends on it.
- Yaw and body heading are each wrapped to [0, 360) before they are added.

**Combined:** a `fail` from either check gives `fail`; otherwise any `unknown` gives `unknown`; otherwise `pass`. A pass always carries the "not a certification" caveats.

## Decisions for the lead (Amine)

1. **No terrain type in the contract.** v1.0 has no type for sampled terrain, so this engine defines its own `RasterGrid`. Integration needs either a contract addition (for example per-site DEM and slope patches in `SiteDateData`) or a separate processed-terrain JSON.
2. **Who extracts the patches.** Small DEM and slope patches must be cut from the GeoTIFFs around each site into JSON. That is Python with Python 3.11+ and rasterio, under `science/terrain/` (only if Science delegates it) or `science/`.
   - Size: a 400 m × 400 m patch is about 6,400 values per raster.
   - Francisco's machine has only Python 3.9, which is below the project's 3.11+ requirement.
3. **Thresholds and geometry:** footprint radius, ramp heading and ramp length (HARDWARE-004), and the threshold source. Tests use hypothetical values.
4. **A resolved-scale pass is reported as `pass` plus caveats,** the same convention as comms local-only. Amine may prefer `unknown`.
5. **DEM quality layers.** The 15 m MASK has no contributing images for 3.9% of the tile. Near the candidate site the counts are 2–17. For now, every result carries a caveat that MASK/SIGM are not screened. Should the engine take the MASK and report `unknown` where the count is 0? The MASK layer is owned by Science.

## Tests

From `web/`:

```sh
npx vitest run src/engine/terrain   # terrain only
npm test                            # full suite
npm run build                       # typecheck + build
```

The tests use synthetic grids that mimic the A305 geometry, placed at the preliminary candidate coordinate with invented elevations.
- Ramp tests build their terrain from finite differences of the projection, not from the function under test.
- An adversarial review with three reviewers was run, and all of its findings are fixed.
- A mutation check catches each of these deliberate bugs:
  - grid north used as true north;
  - mirrored ramp direction;
  - equality treated as failing;
  - ramp starting at the lander centre;
  - no profile walk;
  - sampling by DEM index;
  - square instead of circular footprint;
  - no forced home pixel;
  - unknown hiding a fail;
  - unknown outranking fail;
  - no sentinel check;
  - no range check.

## Not modelled

- Footprint-scale plane fit and lander tilt.
- Roughness.
- Slope baselines other than 5 m: the 100/200/400 m slope rasters are not in the repo.
- Hazards below 5 m.
- Map-scale distortion: about 0.006% at this latitude, treated as zero.
- The 15 m MASK/BRES quality layers.
