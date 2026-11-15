import type { HorizonProfile, Provenance, SiteDateData, SiteTerrain, TerrainGrid } from '../contracts';

/** Runtime check of processed JSON against contract v1.0. Problems name the file and field. */
export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };

const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const nullableStr = (x: unknown) => x === null || isStr(x);

function checkProvenance(x: unknown, where: string, problems: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(x) || x.length === 0) { problems.push(`${where}: provenance must be a non-empty array`); return ids; }
  x.forEach((p: unknown, i) => {
    const at = `${where}: provenance[${i}]`;
    if (!isObj(p)) { problems.push(`${at} is not an object`); return; }
    const r = p as Partial<Provenance>;
    if (!isStr(r.id) || !isStr(r.filename) || !isStr(r.url) || !isStr(r.sourceVersion)) problems.push(`${at} needs id, filename, url and sourceVersion`);
    if (!(r.sha256 === null || (typeof r.sha256 === 'string' && /^[0-9a-f]{64}$/.test(r.sha256)))) problems.push(`${at} sha256 must be 64 hex characters or null`);
    if (typeof r.generatedUtc !== 'string' || !UTC.test(r.generatedUtc)) problems.push(`${at} generatedUtc must be UTC ending in Z`);
    if (isStr(r.id)) { if (ids.has(r.id)) problems.push(`${at} duplicates id "${r.id}"`); ids.add(r.id); }
  });
  return ids;
}

function checkResolves(id: unknown, ids: Set<string>, at: string, problems: string[]) {
  if (id !== null && (!isStr(id) || !ids.has(id))) problems.push(`${at} sourceId "${String(id)}" has no provenance record`);
}

function checkDirection(x: unknown, at: string, problems: string[]) {
  if (x === null) return;
  if (!isObj(x) || !isNum(x.azDeg) || !isNum(x.elDeg) || x.azDeg < 0 || x.azDeg >= 360 || x.elDeg < -90 || x.elDeg > 90) {
    problems.push(`${at} must be null or { azDeg in [0, 360), elDeg in [-90, 90] }`);
  }
}

function checkProfile(x: unknown, at: string, ids: Set<string>, problems: string[]) {
  if (!isObj(x)) { problems.push(`${at} is not an object`); return; }
  const h = x as Partial<HorizonProfile>;
  if (!isNum(h.observerHeightM) || h.observerHeightM < 0) problems.push(`${at}.observerHeightM must be >= 0`);
  if (!isNum(h.extentKm) || h.extentKm < 0) problems.push(`${at}.extentKm must be >= 0`);
  if (!['far-field-validated', 'local-only', 'missing'].includes(h.horizonCoverage as string)) problems.push(`${at}.horizonCoverage is invalid`);
  if (!Array.isArray(h.anglesDeg) || !h.anglesDeg.every(a => a === null || isNum(a))) { problems.push(`${at}.anglesDeg must be numbers or null`); return; }
  if (h.horizonCoverage !== 'missing') {
    if (!isNum(h.azimuthStepDeg) || h.azimuthStepDeg <= 0 || h.anglesDeg.length !== 360 / h.azimuthStepDeg) {
      problems.push(`${at} needs 360 / azimuthStepDeg bins`);
    }
    if (h.horizonCoverage === 'far-field-validated' && h.anglesDeg.some(a => a === null)) problems.push(`${at} is far-field-validated but has null bins`);
  }
  if (!nullableStr(h.sourceId)) problems.push(`${at}.sourceId must be a string or null`);
  else checkResolves(h.sourceId, ids, at, problems);
}

export function checkSiteDateData(x: unknown, file: string): Checked<SiteDateData> {
  const problems: string[] = [];
  if (!isObj(x)) return { ok: false, problems: [`${file}: not a JSON object`] };
  if (x.schemaVersion !== '1.0') problems.push(`${file}: schemaVersion must be "1.0"`);
  if (x.purpose !== 'research') problems.push(`${file}: purpose must be "research" (synthetic data never reaches the mission view)`);
  const ids = checkProvenance(x.provenance, file, problems);
  const s = x.site;
  if (!isObj(s) || !isStr(s.id) || !isStr(s.name) || !isNum(s.latitudeDeg) || !isNum(s.longitudeEastDeg) ||
      s.latitudeDeg < -90 || s.latitudeDeg > 90 || s.longitudeEastDeg < -180 || s.longitudeEastDeg > 360 ||
      !isStr(s.terrainSource) || !isNum(s.terrainCoverageKm) || !isStr(s.label)) {
    problems.push(`${file}: site needs id, name, latitudeDeg, longitudeEastDeg, terrainSource, terrainCoverageKm and label`);
  }
  if (!Array.isArray(x.samples) || x.samples.length === 0) problems.push(`${file}: needs at least one sample`);
  else {
    let last = '';
    x.samples.forEach((sample: unknown, i) => {
      const at = `${file}: samples[${i}]`;
      if (!isObj(sample)) { problems.push(`${at} is not an object`); return; }
      if (typeof sample.utc !== 'string' || !UTC.test(sample.utc) || Number.isNaN(Date.parse(sample.utc))) problems.push(`${at}.utc must be UTC ending in Z`);
      else { if (sample.utc <= last) problems.push(`${at}.utc is not after the previous sample`); last = sample.utc; }
      checkDirection(sample.sun, `${at}.sun`, problems);
      checkDirection(sample.earth, `${at}.earth`, problems);
      if (!['jpl-verified', 'approximate', 'missing'].includes(sample.ephemerisQuality as string)) problems.push(`${at}.ephemerisQuality is invalid`);
      checkResolves(sample.sourceId, ids, at, problems);
    });
  }
  checkProfile(x.sunHorizon, `${file}: sunHorizon`, ids, problems);
  checkProfile(x.earthHorizon, `${file}: earthHorizon`, ids, problems);
  if (x.slopeSourceId !== undefined) checkResolves(x.slopeSourceId, ids, `${file}: slopeSourceId`, problems);
  return problems.length ? { ok: false, problems: problems.slice(0, 20) } : { ok: true, value: x as unknown as SiteDateData };
}

function checkGrid(x: unknown, at: string, ids: Set<string>, problems: string[]) {
  if (!isObj(x)) { problems.push(`${at} is not an object`); return; }
  const g = x as Partial<TerrainGrid>;
  if (!isNum(g.originXM) || !isNum(g.originYM) || !isNum(g.pixelSizeM) || g.pixelSizeM <= 0) problems.push(`${at} needs finite origin and positive pixelSizeM`);
  if (!Number.isInteger(g.width) || !Number.isInteger(g.height) || (g.width as number) <= 0 || (g.height as number) <= 0) problems.push(`${at} needs positive integer width and height`);
  else if (!Array.isArray(g.values) || g.values.length !== (g.width as number) * (g.height as number)) problems.push(`${at}.values length must equal width x height`);
  else if (!g.values.every(v => v === null || isNum(v))) problems.push(`${at}.values must be numbers or null`);
  if (!(g.nodata === null || isNum(g.nodata))) problems.push(`${at}.nodata must be a number or null`);
  if (g.sourceId === null) problems.push(`${at}.sourceId is null (untraceable terrain)`);
  else checkResolves(g.sourceId, ids, at, problems);
}

export function checkSiteTerrain(x: unknown, file: string): Checked<SiteTerrain> {
  const problems: string[] = [];
  if (!isObj(x)) return { ok: false, problems: [`${file}: not a JSON object`] };
  if (x.schemaVersion !== '1.0') problems.push(`${file}: schemaVersion must be "1.0"`);
  if (x.purpose !== 'research') problems.push(`${file}: purpose must be "research"`);
  if (!isStr(x.siteId)) problems.push(`${file}: siteId is required`);
  const ids = checkProvenance(x.provenance, file, problems);
  checkGrid(x.dem, `${file}: dem`, ids, problems);
  checkGrid(x.slope5m, `${file}: slope5m`, ids, problems);
  return problems.length ? { ok: false, problems: problems.slice(0, 20) } : { ok: true, value: x as unknown as SiteTerrain };
}
