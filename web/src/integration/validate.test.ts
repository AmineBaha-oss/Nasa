import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/synthetic-site-date.json';
import type { SiteTerrain } from '../contracts';
import { HARDWARE_PRESETS } from './hardware';
import { createEvaluator, evaluateHeading } from './evaluate';
import { checkSiteDateData, checkSiteTerrain } from './validate';
import type { SiteDateData } from '../contracts';

const SYNTHETIC = fixture as unknown as SiteDateData;
const research = (): Record<string, unknown> => {
  const x = { ...JSON.parse(JSON.stringify(fixture)), purpose: 'research' };
  x.samples.push({ ...x.samples[0], utc: '2027-10-01T01:00:00Z' });
  return x;
};
const problems = (x: unknown) => { const r = checkSiteDateData(x, 'f.json'); return r.ok ? [] : r.problems; };

function terrain(siteId: string, values: (number | null)[] = Array(16).fill(1)): SiteTerrain {
  const grid = { sourceId: 'synthetic', originXM: 0, originYM: 20, pixelSizeM: 5, width: 4, height: 4, values, nodata: null };
  return { schemaVersion: '1.0', purpose: 'synthetic-test', siteId,
    provenance: [{ id: 'synthetic', filename: 'synthetic', url: 'urn:landerprint:synthetic-test', sourceVersion: '1', sha256: null, generatedUtc: '2026-11-14T00:00:00Z' }],
    dem: grid, slope5m: { ...grid } };
}

describe('contract check for SiteDateData (synthetic)', () => {
  it('keeps synthetic test data out of the mission view', () => {
    expect(problems(fixture).join()).toMatch(/purpose must be "research"/);
  });

  it('accepts a well-formed record once its purpose is research', () => {
    expect(problems(research())).toEqual([]);
  });

  it('rejects UTC without Z, out-of-order samples, bad bins and unresolved sources', () => {
    const x = research() as { samples: { utc: string; sourceId: string }[]; sunHorizon: { anglesDeg: unknown[] } };
    x.samples[0].utc = '2027-10-01T00:00:00';
    x.samples[1].sourceId = 'nowhere';
    x.sunHorizon.anglesDeg = x.sunHorizon.anglesDeg.slice(1);
    const p = problems(x).join(' | ');
    expect(p).toMatch(/samples\[0\]\.utc must be UTC ending in Z/);
    expect(p).toMatch(/samples\[1\] sourceId "nowhere" has no provenance record/);
    expect(p).toMatch(/sunHorizon needs 360 \/ azimuthStepDeg bins/);
  });

  it('rejects a far-field-validated profile with null bins', () => {
    const x = research() as { earthHorizon: { anglesDeg: (number | null)[]; horizonCoverage: string } };
    x.earthHorizon.horizonCoverage = 'far-field-validated';
    x.earthHorizon.anglesDeg[0] = null;
    expect(problems(x).join()).toMatch(/far-field-validated but has null bins/);
  });

  it('rejects non-objects and wrong schema versions', () => {
    expect(problems(null)).toEqual(['f.json: not a JSON object']);
    expect(problems({ ...research(), schemaVersion: '2.0' }).join()).toMatch(/schemaVersion must be "1.0"/);
  });
});

describe('contract check for SiteTerrain (synthetic)', () => {
  const check = (x: unknown) => { const r = checkSiteTerrain(x, 't.json'); return r.ok ? [] : r.problems; };
  const asResearch = (t: SiteTerrain) => ({ ...t, purpose: 'research' });

  it('accepts a well-formed research patch and rejects synthetic ones', () => {
    expect(check(asResearch(terrain('a')))).toEqual([]);
    expect(check(terrain('a')).join()).toMatch(/purpose must be "research"/);
  });

  it('rejects wrong value counts, non-numbers and untraceable grids', () => {
    const t = asResearch(terrain('a'));
    t.dem = { ...t.dem, values: [1, 2, 3] };
    t.slope5m = { ...t.slope5m, sourceId: null };
    const p = check(t).join(' | ');
    expect(p).toMatch(/dem\.values length must equal width x height/);
    expect(p).toMatch(/slope5m\.sourceId is null/);
  });
});

describe('heading evaluation wiring (synthetic)', () => {
  const hw = HARDWARE_PRESETS[0];

  it('reports deployment unknown without terrain, with foreign terrain or with mismatched purpose', () => {
    expect(evaluateHeading(SYNTHETIC, null, hw, 0).deployment).toMatchObject({ status: 'unknown', sourceIds: [] });
    expect(evaluateHeading(SYNTHETIC, terrain('elsewhere'), hw, 0).deployment.reason).toMatch(/not synthetic-origin/);
    expect(evaluateHeading({ ...SYNTHETIC, purpose: 'research' }, terrain(SYNTHETIC.site.id), hw, 0).deployment.reason)
      .toMatch(/differs from data purpose/);
  });

  it('fills the record from the dataset and de-duplicates caveats', () => {
    const ev = evaluateHeading(SYNTHETIC, null, hw, 30);
    expect(ev).toMatchObject({ yawDeg: 30, siteId: 'synthetic-origin', startUtc: SYNTHETIC.samples[0].utc });
    expect(new Set(ev.unresolved).size).toBe(ev.unresolved.length);
    expect(ev.unresolved.join(' ')).toMatch(/[Ss]ynthetic/);
  });

  it('never hides a synthetic fixture behind a pass label in the evidence gate', () => {
    const evaluate = createEvaluator(new Map());
    const ev = evaluate(SYNTHETIC, hw, 0);
    expect(ev.deployment.status).toBe('unknown');
  });

  it('every preset is hypothetical, shares the antenna and matches the 2 m / 3 m science heights', () => {
    for (const h of HARDWARE_PRESETS) {
      expect(h).toMatchObject({ identity: 'hypothetical', specificationSourceId: null, panelHeightM: 2, antennaHeightM: 3 });
      expect(h.antenna).toBe(HARDWARE_PRESETS[0].antenna);
    }
  });
});
