# LANDERPRINT contract v1.0

Frozen implementation baseline for Gate 0, 2026-11-14; human/worker sign-off remains pending. Integration lead owns changes.

## Units and frames
- UTC ISO 8601 `YYYY-MM-DDTHH:mm:ssZ`; all duration steps in hours.
- Latitude degrees north positive; longitude degrees **east positive** (can be negative). Lunar South Polar Stereographic for raster sampling, not Earth's EPSG:4326.
- Sun/Earth azimuth clockwise from local north, elevation from true local horizon, both in degrees.
- Body yaw degrees clockwise from north; body vector components `[right, forward, up]`; world/local vector `[east, north, up]`.
- Terrain observer heights in metres above each site's datum; document this as `observerHeightM` for horizons and `panelHeightM` / `antennaHeightM` for hardware.


## Authoritative TypeScript

`web/src/contracts/index.ts` is authoritative.

```ts
export type Status = 'pass' | 'fail' | 'unknown';
export type EphemerisQuality = 'jpl-verified' | 'approximate' | 'missing';
export type HorizonCoverage = 'far-field-validated' | 'local-only' | 'missing';
export type DataPurpose = 'research' | 'synthetic-test';
export interface Provenance { id: string; filename: string; url: string; sourceVersion: string; sha256: string | null; generatedUtc: string; }
export interface Direction { azDeg: number; elDeg: number; }
export interface Site {
  id: string; name: string; latitudeDeg: number; longitudeEastDeg: number;
  terrainSource: string; terrainCoverageKm: number; label: string;
}
export interface EphemerisSample {
  utc: string; sun: Direction | null; earth: Direction | null;
  ephemerisQuality: EphemerisQuality; sourceId: string | null;
}
export interface HorizonProfile {
  observerHeightM: number; azimuthStepDeg: number; anglesDeg: (number | null)[];
  extentKm: number; horizonCoverage: HorizonCoverage; sourceId: string | null;
}
export interface SiteDateData {
  schemaVersion: '1.0'; purpose: DataPurpose; provenance: Provenance[]; site: Site; samples: EphemerisSample[];
  sunHorizon: HorizonProfile; earthHorizon: HorizonProfile;
  slopeSourceId?: string;
}
export interface TerrainGrid {
  sourceId: string | null; originXM: number; originYM: number; pixelSizeM: number;
  width: number; height: number; values: (number | null)[]; nodata: number | null;
}
export interface SiteTerrain {
  schemaVersion: '1.0'; purpose: DataPurpose; siteId: string; provenance: Provenance[];
  dem: TerrainGrid; slope5m: TerrainGrid;
}
export interface Panel { name: string; areaFraction: number; normalBodyRFU: [number, number, number]; mode: 'fixed' | 'tracked'; maxTrackingAngleDeg?: number; }
export interface Antenna { boresightBodyRFU: [number, number, number]; beamHalfAngleDeg: number; gimbal?: { panMinDeg: number; panMaxDeg: number; tiltMinDeg: number; tiltMaxDeg: number }; }
export interface HardwareConfig {
  name: string; identity: 'hypothetical' | 'documented'; specificationSourceId: string | null; totalActivePvAreaM2: number; panels: Panel[]; peakSolarPowerW: number;
  batteryCapacityWh: number; batteryInitialWh: number; minReserveWh: number;
  constantLoadW: number; chargeEfficiency: number; dischargeEfficiency: number;
  antenna: Antenna; antennaHeightM: number; panelHeightM: number;
  rampHeadingBodyDeg?: number; landingFootprintRadiusM?: number;
}
export interface ConstraintResult { status: Status; reason: string; sourceIds: string[]; }
export interface HeadingEvaluation {
  yawDeg: number; siteId: string; startUtc: string; endUtc: string;
  solar: ConstraintResult; battery: ConstraintResult;
  antenna: ConstraintResult; deployment: ConstraintResult;
  minimumBatteryWh: number | null; contactHours: number | null;
  unresolved: string[];
}
```

## Required semantics

- Ephemeris quality and horizon coverage are independent, per sample/profile. Neither implies the other.
- Null directions/angles mean unknown, never zero elevation or clear sky. Missing profiles have empty angles, coverage `missing`, null sourceId and extent 0.
- Horizon bin i samples azimuth i * azimuthStepDeg, clockwise from north; no half-bin offset. A populated profile has 360 / azimuthStepDeg bins. Null bins propagate unknown.
- ObserverHeightM is metres above the sampled terrain surface. Separate solar-panel and antenna-height profiles are required.
- UTC strings must end in Z. Longitude is east-positive. Source IDs resolve to provenance records with filename, URL, version and SHA256 when file bytes are available.
- Synthetic fixtures live only in tests/fixtures, never web/public or processed mission data.
- A full-coverage mission verdict needs research purpose, independently JPL-verified samples, validated far-field horizons and all relevant model inputs. These are necessary, not sufficient, conditions. Local-only results must explicitly limit scope.
- Panel area fractions sum to one; equal totalActivePvAreaM2 is required across hardware comparisons. A tracked panel without maxTrackingAngleDeg is explicitly ideal unconstrained tracking, never assumed mechanically available.
- Gimbal pan is clockwise from body-forward toward body-right, tilt toward body-up; boresight is nominal RFU. Worker must document reachable-cone treatment.
- No hardware preset is approved by this freeze. Initial synthetic values are unit-test inputs only.

## Terrain patches (additive, 2026-11-14, integration lead)

- `SiteTerrain` is one file per site (`data/processed/terrain/<site>.json`), shared by both windows. It feeds `evaluateDeployment` in `web/src/engine/terrain`; `TerrainGrid` is structurally that engine's `RasterGrid`.
- Grids are north-up on the lunar south polar stereographic sphere (R 1737400 m). `originXM`/`originYM` is the top-left corner of the top-left pixel; `values` are row-major with row 0 at the top. GDAL geotransform: `[pixelSizeM, 0, originXM, 0, -pixelSizeM, originYM]`.
- Windows are pixel-aligned with the source raster and clipped to it. Missing pixels are `null`, never 0. `dem` is metres above the 1737.4 km sphere; `slope5m` is degrees.
- `sourceId` must resolve to a record in the file's `provenance`. A missing patch, a patch for another site or a purpose mismatch makes deployment `unknown`.
- `SiteDateData` and the existing types are unchanged.
