// LANDERPRINT v1.0. Integration lead owns changes. See docs/INTERFACES.md.
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
/** North-up grid on the lunar south polar stereographic sphere (R 1737400 m); row 0 is the top (largest y). Null is unknown. */
export interface TerrainGrid {
  sourceId: string | null; originXM: number; originYM: number; pixelSizeM: number;
  width: number; height: number; values: (number | null)[]; nodata: number | null;
}
/** Per-site DEM and 5 m slope patches for the deployment screen (v1.0 addition). */
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
