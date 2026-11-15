import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { MissionView } from '../app/App';
import type { HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../contracts';
import { evaluateAntennaWindow } from '../engine/comms';
import { checkEqualPvArea, evaluatePowerWindow, sweepPowerYaw } from '../engine/power';
import { createEvaluator, evaluateHeading } from './evaluate';
import { HARDWARE_PRESETS } from './hardware';
import { loadMissionData, type MissionData } from './loader';
import { hasFullCoverageEvidence } from './quality';

// Real processed science output (data/processed), served to the loader exactly as the app fetches it.
const RAW = {
  ...import.meta.glob<string>('../../../data/processed/site-*_window-*.json', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../../../data/processed/terrain/site-*.json', { query: '?raw', import: 'default', eager: true }),
};
const PREFIX = '../../../data/processed/';
const files = Object.keys(RAW).map(k => k.slice(PREFIX.length)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function serve(mutate: (file: string, text: string) => string = (_f, t) => t) {
  const entries = await Promise.all(files.map(async file => ({ file, sha256: await sha256(RAW[PREFIX + file]) })));
  const index = { schemaVersion: '1.0', generatedUtc: '2026-11-14T00:00:00Z',
    datasets: entries.filter(e => !e.file.startsWith('terrain/')), terrain: entries.filter(e => e.file.startsWith('terrain/')) };
  return (url: string) => {
    const file = url.replace(/^\/data\//, '');
    const body = file === 'index.json' ? JSON.stringify(index) : RAW[PREFIX + file];
    return Promise.resolve(body === undefined
      ? { ok: false, status: 404, text: () => Promise.resolve('') }
      : { ok: true, status: 200, text: () => Promise.resolve(file === 'index.json' ? body : mutate(file, body)) });
  };
}

const presetNamed = (fragment: string) => HARDWARE_PRESETS.find(h => h.name.includes(fragment))!;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
let mission: MissionData;
const dataset = (site: string, window: string) =>
  mission.datasets.find(d => d.site.id === site && d.samples[0].utc.startsWith(window === 'a' ? '2027-10-10' : '2027-10-24'))!;
const terrainOf = (d: SiteDateData) => mission.terrainBySite.get(d.site.id) ?? null;

beforeAll(async () => {
  mission = await loadMissionData('/data/', await serve());
});

describe('real science data feeds every module', () => {
  it('loads all 14 site/window files and 7 terrain patches with matching hashes and no problems', () => {
    expect(files.filter(f => !f.startsWith('terrain/'))).toHaveLength(14);
    expect(mission.problems).toEqual([]);
    expect(mission.datasets).toHaveLength(14);
    expect(new Set(mission.datasets.map(d => d.site.id)).size).toBe(7);
    expect([...mission.terrainBySite.keys()].sort()).toEqual(['site-1', 'site-2', 'site-3', 'site-4', 'site-5', 'site-6', 'site-7']);
    expect(mission.datasets.every(hasFullCoverageEvidence)).toBe(true);
  });

  it('rejects a file whose bytes no longer match the index', async () => {
    const tampered = await loadMissionData('/data/', await serve((f, t) => f === 'site-1_window-a.json' ? t.replace('"elDeg": ', '"elDeg": 1') : t));
    expect(tampered.datasets).toHaveLength(13);
    expect(tampered.problems.join(' ')).toMatch(/site-1_window-a\.json: SHA-256 differs/);
  });

  it('compares hardware at equal PV area with heights that match the science horizons', () => {
    expect(checkEqualPvArea(HARDWARE_PRESETS).status).toBe('pass');
    for (const d of mission.datasets) for (const h of HARDWARE_PRESETS) {
      expect(h.identity).toBe('hypothetical');
      expect(d.sunHorizon.observerHeightM).toBe(h.panelHeightM);
      expect(d.earthHorizon.observerHeightM).toBe(h.antennaHeightM);
    }
  });

  it('every result traces to the same provenance the data and terrain files carry', () => {
    for (const d of mission.datasets) {
      const known = new Set([...d.provenance, ...(terrainOf(d)?.provenance ?? [])].map(p => p.id));
      const ev = evaluateHeading(d, terrainOf(d), presetNamed('4-face'), 135);
      expect(ev.solar.sourceIds).toEqual(expect.arrayContaining(['spice-ephemeris', 'terrain-horizon']));
      expect(ev.antenna.sourceIds).toEqual(expect.arrayContaining(['spice-ephemeris', 'terrain-horizon']));
      expect(ev.deployment.sourceIds.sort()).toEqual(['a305-elev', 'a305-slope-5m']);
      for (const r of [ev.solar, ev.battery, ev.antenna, ev.deployment]) {
        expect(r.reason.length).toBeGreaterThan(20);
        for (const id of r.sourceIds) expect(known.has(id)).toBe(true);
      }
      expect(ev.startUtc).toBe(d.samples[0].utc);
      expect(ev.endUtc).toBe(d.samples[d.samples.length - 1].utc);
    }
  });

  it('combines solar, battery and antenna from exactly the engines run on the same samples', () => {
    const d = dataset('site-1', 'a'), h = presetNamed('60 deg'), yaw = 120;
    const ev = evaluateHeading(d, terrainOf(d), h, yaw);
    const power = evaluatePowerWindow(d, h, yaw), comms = evaluateAntennaWindow(d, h, yaw);
    expect(ev.solar).toEqual(power.solar);
    expect(ev.battery).toEqual(power.battery);
    expect(ev.minimumBatteryWh).toBe(power.minimumBatteryWh);
    expect(ev.antenna).toEqual(comms.antenna);
    expect(ev.contactHours).toBe(comms.contactHours);
    expect(power.samples.map(s => s.utc)).toEqual(comms.samples.map(s => s.utc));
  });

  it('runs the deployment screen on the real 5 m terrain at every site', () => {
    for (const site of mission.terrainBySite.keys()) {
      const d = mission.datasets.find(x => x.site.id === site)!;
      const ev = evaluateHeading(d, terrainOf(d), presetNamed('4-face'), 0);
      expect(ev.deployment.reason).toMatch(/^Resolved-scale 5 m screen: Footprint max 5 m slope/);
      expect(ev.deployment.reason).not.toMatch(/footprint unknown|ramp unknown/);
      expect(['pass', 'fail']).toContain(ev.deployment.status);
    }
  });
});

describe('headings and dates matter, and nothing is hard-coded', () => {
  it('the same heading gives different Sun geometry and power results in the two windows', () => {
    const a = dataset('site-1', 'a'), b = dataset('site-1', 'b'), h = presetNamed('60 deg');
    expect(a.samples[0].sun!.azDeg).not.toBeCloseTo(b.samples[0].sun!.azDeg, 0);
    const passA = sweepPowerYaw(a, h, 10).solarPassYawsDeg, passB = sweepPowerYaw(b, h, 10).solarPassYawsDeg;
    expect(passA.length).toBeGreaterThan(0);
    expect(passB.length).toBeGreaterThan(0);
    expect(passA).not.toEqual(passB);
  });

  it('a limited tracker depends on heading; an ideal tracker does not (the honest counterexample)', () => {
    const d = dataset('site-1', 'a');
    expect(sweepPowerYaw(d, presetNamed('60 deg'), 10).yawSensitive).toBe(true);
    const ideal = sweepPowerYaw(d, presetNamed('ideal'), 10);
    expect(ideal.yawSensitive).toBe(false);
    expect(new Set(ideal.entries.map(e => e.solar)).size).toBe(1);
  });

  it('antenna pointing passes at some headings and fails at others for the same site and window', () => {
    const d = dataset('site-1', 'a'), h = presetNamed('4-face');
    const statuses = new Set(Array.from({ length: 36 }, (_, i) => evaluateHeading(d, terrainOf(d), h, i * 10).antenna.status));
    expect(statuses).toContain('pass');
    expect(statuses).toContain('fail');
  });

  it('the ramp direction follows the heading', () => {
    const d = dataset('site-1', 'a'), h = presetNamed('4-face');
    const reasons = new Set([0, 90, 180, 270].map(y => evaluateHeading(d, terrainOf(d), h, y).deployment.reason.match(/azimuth ([\d.]+) deg/)?.[1]));
    expect(reasons).toEqual(new Set(['180', '270', '0', '90']));
  });
});

describe('unknown stays unknown on real data', () => {
  const passing = (): [SiteDateData, HardwareConfig, number, HeadingEvaluation] => {
    const d = dataset('site-1', 'a'), h = presetNamed('ideal');
    for (let yaw = 0; yaw < 360; yaw += 10) {
      const ev = evaluateHeading(d, terrainOf(d), h, yaw);
      if (ev.antenna.status === 'pass' && ev.solar.status === 'pass') return [d, h, yaw, ev];
    }
    throw new Error('no heading passes solar and antenna at site-1 window-a');
  };

  it('a skyline with missing bins never yields a pass', () => {
    const [d, h, yaw] = passing();
    const holed = clone(d);
    holed.earthHorizon.anglesDeg = holed.earthHorizon.anglesDeg.map(() => null);
    holed.earthHorizon.horizonCoverage = 'local-only';
    holed.sunHorizon.anglesDeg = holed.sunHorizon.anglesDeg.map(() => null);
    holed.sunHorizon.horizonCoverage = 'local-only';
    const ev = evaluateHeading(holed, terrainOf(d), h, yaw);
    expect(ev.antenna.status).toBe('unknown');
    expect(ev.solar.status).toBe('unknown');
    expect(ev.contactHours).toBeNull();
    expect(hasFullCoverageEvidence(holed)).toBe(false);
  });

  it('missing Sun and Earth directions never yield a pass', () => {
    const [d, h, yaw] = passing();
    const blind = clone(d);
    blind.samples = blind.samples.map(s => ({ ...s, sun: null, earth: null, ephemerisQuality: 'missing' as const }));
    const ev = evaluateHeading(blind, terrainOf(d), h, yaw);
    expect(ev.solar.status).toBe('unknown');
    expect(ev.antenna.status).toBe('unknown');
    expect(ev.minimumBatteryWh).toBeNull();
  });

  it('missing or foreign terrain gives an unknown deployment, never a pass', () => {
    const [d, h, yaw] = passing();
    expect(evaluateHeading(d, null, h, yaw).deployment.status).toBe('unknown');
    expect(evaluateHeading(d, mission.terrainBySite.get('site-2')!, h, yaw).deployment.status).toBe('unknown');
    const holes: SiteTerrain = clone(terrainOf(d)!);
    holes.slope5m.values = holes.slope5m.values.map(() => null);
    holes.dem.values = holes.dem.values.map(() => null);
    expect(evaluateHeading(d, holes, h, yaw).deployment.status).toBe('unknown');
  });
});

describe('the mounted page renders the real data', () => {
  it('shows all sites, both windows and engine-backed checks without synthetic or unverified labels', () => {
    const html = renderToStaticMarkup(<MissionView data={mission} />);
    expect((html.match(/<option value="site-\d"/g) ?? []).length).toBe(7);
    expect(html).toContain('2027-10-10 00:00Z');
    expect(html).toContain('2027-10-24 00:00Z');
    for (const label of ['SYNTHETIC', 'EPHEMERIS UNVERIFIED', 'LOCAL TERRAIN ONLY', 'Engine adapter not connected']) expect(html).not.toContain(label);
    expect(html).toContain('HYPOTHETICAL HW');
    expect(html).toContain('far-field validated (300 km, observer 2 m)');
    expect(html).toContain('far-field validated (300 km, observer 3 m)');
    expect(html).toContain('Resolved-scale 5 m screen');
    expect(html).not.toContain('data file issue');
  });

  it('memoises per dataset, hardware and heading so dragging the dial reuses results', () => {
    const evaluate = createEvaluator(mission.terrainBySite);
    const d = mission.datasets[0], h = HARDWARE_PRESETS[0];
    expect(evaluate(d, h, 45)).toBe(evaluate(d, h, 45));
    expect(evaluate(d, h, 46)).not.toBe(evaluate(d, h, 45));
  });
});
