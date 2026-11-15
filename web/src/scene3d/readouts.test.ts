// SYNTHETIC UNIT TESTS ONLY. Ephemeris, horizons and hardware are invented test inputs.
import { describe, expect, it } from 'vitest';
import type { EphemerisSample, HorizonProfile, SiteDateData } from '../contracts';
import { evaluatePowerWindow } from '../engine/power';
import { HARDWARE_PRESETS } from '../integration/hardware';
import { sampleReadout, windowTracks } from './readouts';

const flat = (observerHeightM: number, angle = 0): HorizonProfile => ({
  observerHeightM, azimuthStepDeg: 90, anglesDeg: [angle, angle, angle, angle], extentKm: 1, horizonCoverage: 'local-only', sourceId: 'synthetic',
});
const s = (h: number, sun: EphemerisSample['sun'], earth: EphemerisSample['earth'] = { azDeg: 0, elDeg: 5 }): EphemerisSample => ({
  utc: `2027-10-01T0${h}:00:00Z`, sun, earth, ephemerisQuality: 'approximate', sourceId: 'synthetic',
});
const data = (samples: EphemerisSample[], sunAngle = 0): SiteDateData => ({
  schemaVersion: '1.0', purpose: 'synthetic-test', provenance: [],
  site: { id: 'syn', name: 'synthetic', latitudeDeg: -89, longitudeEastDeg: 0, terrainSource: 'synthetic', terrainCoverageKm: 1, label: 'synthetic' },
  samples, sunHorizon: flat(2, sunAngle), earthHorizon: flat(3),
});
const [fourFace, single, limited] = HARDWARE_PRESETS;

describe('sampleReadout', () => {
  it('matches the engine power for a visible Sun on the forward panel', () => {
    const r = sampleReadout(data([s(0, { azDeg: 0, elDeg: 10 }), s(1, { azDeg: 0, elDeg: 10 })]), single, 0, 0)!;
    expect(r.sun.visible).toBe('pass');
    expect(r.powerW.low).toBeCloseTo(200 * Math.cos(10 * Math.PI / 180), 9);
    expect(r.panels[0].incidence).toBeCloseTo(Math.cos(10 * Math.PI / 180), 12);
    expect(r.earth.earthVisible).toBe('pass');
  });
  it('a Sun below the skyline gives zero power but still reports pointing', () => {
    const r = sampleReadout(data([s(0, { azDeg: 90, elDeg: 2 }), s(1, { azDeg: 90, elDeg: 2 })], 5), fourFace, 0, 0)!;
    expect(r.sun.visible).toBe('fail');
    expect(r.powerW).toEqual({ low: 0, high: 0 });
    expect(r.panels.map(p => p.name)).toEqual(['forward', 'right', 'aft', 'left']);
    expect(r.panels[1].incidence).toBeGreaterThan(0.99);
  });
  it('a null Sun is unknown, bounded by peak power, with no incidence', () => {
    const r = sampleReadout(data([s(0, null), s(1, null)]), limited, 0, 0)!;
    expect(r.sun.visible).toBe('unknown');
    expect(r.powerW).toEqual({ low: 0, high: 200 });
    expect(r.panels[0].incidence).toBeNull();
    expect(r.panels[0].clamped).toBe(false);
  });
  it('flags a clamped limited tracker', () => {
    const r = sampleReadout(data([s(0, { azDeg: 150, elDeg: 5 }), s(1, { azDeg: 150, elDeg: 5 })]), limited, 0, 0)!;
    expect(r.panels[0].clamped).toBe(true);
  });
  it('returns null outside the sample range', () => {
    expect(sampleReadout(data([s(0, null)]), single, 0, 3)).toBeNull();
  });
});

describe('windowTracks', () => {
  it('aligns battery bounds with data.samples by UTC even when samples are unsorted', () => {
    const d = data([s(2, { azDeg: 0, elDeg: 10 }), s(0, { azDeg: 0, elDeg: 10 }), s(1, { azDeg: 0, elDeg: 10 })]);
    const t = windowTracks(d, single, 0);
    const series = evaluatePowerWindow(d, single, 0).batterySeries;
    d.samples.forEach((sample, i) => expect(t.batteryWh[i]).toEqual(series.find(b => b.utc === sample.utc)!.energyWh));
    expect(t.sun.map(p => p.visible)).toEqual(['pass', 'pass', 'pass']);
    expect(t.earth).toHaveLength(3);
  });
});
