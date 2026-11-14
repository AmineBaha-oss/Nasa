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
