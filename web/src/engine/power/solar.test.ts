// SYNTHETIC UNIT TESTS ONLY. Panels and horizons are hypothetical test inputs, not a real lander or site.
import { describe, expect, it } from 'vitest';
import type { EphemerisSample, HorizonProfile, Panel } from '../../contracts';
import { angleBetweenDeg, azElToEnu, dot } from './vectors';
import {
  SUN_ANGULAR_RADIUS_DEG, evaluateSolarSample, panelIncidence, panelPointingEnu, sunDiskVisibleFraction, sunVisibility,
} from './solar';
import type { PowerHardware } from './hardware';

const fixed = (normalBodyRFU: Panel['normalBodyRFU'], areaFraction = 1): Panel => ({ name: 'test', areaFraction, normalBodyRFU, mode: 'fixed' });
const tracked = (maxTrackingAngleDeg?: number): Panel => ({ name: 'trk', areaFraction: 1, normalBodyRFU: [0, 1, 0], mode: 'tracked', maxTrackingAngleDeg });
const flatHorizon = (angle = 0, observerHeightM = 2): HorizonProfile => ({
  observerHeightM, azimuthStepDeg: 90, anglesDeg: [angle, angle, angle, angle], extentKm: 1, horizonCoverage: 'local-only', sourceId: 'synthetic',
});
const sample = (sun: EphemerisSample['sun'], quality: EphemerisSample['ephemerisQuality'] = 'approximate'): EphemerisSample => ({
  utc: '2027-10-01T00:00:00Z', sun, earth: null, ephemerisQuality: quality, sourceId: 'synthetic',
});
const hardware = (panels: Panel[], peakSolarPowerW = 200): PowerHardware => ({
  panels, peakSolarPowerW, totalActivePvAreaM2: 2, panelHeightM: 2, constantLoadW: 80,
  batteryCapacityWh: 1000, batteryInitialWh: 800, minReserveWh: 200, chargeEfficiency: 0.95, dischargeEfficiency: 0.95,
});

describe('panelIncidence: fixed panel', () => {
  const north = azElToEnu(0, 0);
  it('Sun along the panel normal gives full incidence', () => expect(panelIncidence(fixed([0, 1, 0]), north, 0)).toBeCloseTo(1, 12));
  it('Sun opposite the panel gives zero (no back-side generation)', () => expect(panelIncidence(fixed([0, -1, 0]), north, 0)).toBe(0));
  it('grazing Sun at 90 degrees gives zero', () => expect(panelIncidence(fixed([1, 0, 0]), north, 0)).toBeCloseTo(0, 12));
  it('60 degrees off-normal gives cos 60 = 0.5', () => expect(panelIncidence(fixed([0, 1, 0]), azElToEnu(60, 0), 0)).toBeCloseTo(0.5, 12));
  it('accepts a non-unit normal', () => expect(panelIncidence(fixed([0, 5, 0]), north, 0)).toBeCloseTo(1, 12));

  it('yaw 360 equals yaw 0 and yaw -90 equals yaw 270', () => {
    const sun = azElToEnu(40, 3);
    const p = fixed([0.3, 1, 0.2]);
    expect(panelIncidence(p, sun, 360)).toBeCloseTo(panelIncidence(p, sun, 0), 12);
    expect(panelIncidence(p, sun, -90)).toBeCloseTo(panelIncidence(p, sun, 270), 12);
  });

  it('yaw rotates a forward-facing panel onto an eastern Sun', () => {
    const east = azElToEnu(90, 0);
    expect(panelIncidence(fixed([0, 1, 0]), east, 0)).toBeCloseTo(0, 12);
    expect(panelIncidence(fixed([0, 1, 0]), east, 90)).toBeCloseTo(1, 12);
  });
});

describe('panelIncidence: tracked panel', () => {
  it('an ideal tracker (no limit) always faces the Sun', () => {
    expect(panelIncidence(tracked(), azElToEnu(180, 2), 0)).toBe(1);
    expect(panelIncidence(tracked(), azElToEnu(77, -1), 123)).toBe(1);
  });

  it('a limited tracker reaches the Sun inside its cone', () => expect(panelIncidence(tracked(60), azElToEnu(50, 0), 0)).toBe(1));
  it('a limited tracker beyond its cone keeps cos(excess angle)', () => expect(panelIncidence(tracked(60), azElToEnu(120, 0), 0)).toBeCloseTo(0.5, 12));
  it('a limited tracker more than limit + 90 degrees away gives zero', () => expect(panelIncidence(tracked(60), azElToEnu(180, 0), 0)).toBe(0));
  it('maxTrackingAngleDeg 0 behaves like a fixed panel', () => {
    const sun = azElToEnu(30, 5);
    expect(panelIncidence(tracked(0), sun, 10)).toBeCloseTo(panelIncidence(fixed([0, 1, 0]), sun, 10), 12);
  });
});

describe('panelPointingEnu', () => {
  it('a fixed panel keeps its yawed normal and is never clamped', () => {
    const p = panelPointingEnu(fixed([0, 1, 0]), azElToEnu(200, 10), 90)!;
    expect(p.clamped).toBe(false);
    p.normalEnu.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0][i], 12));
  });
  it('an ideal tracker points straight at the Sun', () => {
    const sun = azElToEnu(250, 5);
    const p = panelPointingEnu(tracked(), sun, 30)!;
    expect(p.clamped).toBe(false);
    expect(dot(p.normalEnu, sun)).toBeCloseTo(1, 12);
  });
  it('a limited tracker reaches a Sun inside its cone', () => {
    const p = panelPointingEnu(tracked(60), azElToEnu(40, 0), 0)!;
    expect(p.clamped).toBe(false);
    expect(dot(p.normalEnu, azElToEnu(40, 0))).toBeCloseTo(1, 12);
  });
  it('a limited tracker stops at its limit, matching panelIncidence', () => {
    const sun = azElToEnu(100, 20);
    const p = panelPointingEnu(tracked(60), sun, 0)!;
    expect(p.clamped).toBe(true);
    expect(angleBetweenDeg(p.normalEnu, [0, 1, 0])).toBeCloseTo(60, 9);
    expect(dot(p.normalEnu, sun)).toBeCloseTo(panelIncidence(tracked(60), sun, 0), 12);
  });
  it('a Sun directly behind still gives a unit normal at the limit', () => {
    const p = panelPointingEnu(tracked(60), azElToEnu(180, 0), 0)!;
    expect(p.clamped).toBe(true);
    expect(Math.hypot(...p.normalEnu)).toBeCloseTo(1, 12);
    expect(angleBetweenDeg(p.normalEnu, [0, 1, 0])).toBeCloseTo(60, 9);
  });
  it('a tracker without a Sun direction rests at its nominal normal', () => {
    const p = panelPointingEnu(tracked(60), [0, 0, 0], 0)!;
    p.normalEnu.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i], 12));
    expect(p.clamped).toBe(false);
  });
  it('a zero normal has no pointing', () => expect(panelPointingEnu(fixed([0, 0, 0]), azElToEnu(0, 0), 0)).toBeNull());
});

describe('sunDiskVisibleFraction', () => {
  const r = SUN_ANGULAR_RADIUS_DEG;
  it('centre on the skyline shows half the disk', () => expect(sunDiskVisibleFraction(0)).toBeCloseTo(0.5, 12));
  it('disk fully above the skyline', () => expect(sunDiskVisibleFraction(r)).toBe(1));
  it('disk fully below the skyline', () => expect(sunDiskVisibleFraction(-r)).toBe(0));
  it('is symmetric: f(d) + f(-d) = 1', () => expect(sunDiskVisibleFraction(0.1) + sunDiskVisibleFraction(-0.1)).toBeCloseTo(1, 12));
  it('is monotonic in the offset', () => {
    const values = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map(d => sunDiskVisibleFraction(d));
    values.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(values[i]));
  });
});

describe('sunVisibility against the panel-height horizon', () => {
  it('Sun well above the skyline is fully visible', () => {
    const v = sunVisibility({ azDeg: 0, elDeg: 5 }, flatHorizon(0), 2);
    expect(v.status).toBe('pass');
    expect(v.fraction).toEqual({ low: 1, high: 1 });
  });

  it('Sun well below the skyline is blocked', () => {
    const v = sunVisibility({ azDeg: 0, elDeg: 1 }, flatHorizon(3), 2);
    expect(v.status).toBe('fail');
    expect(v.fraction).toEqual({ low: 0, high: 0 });
  });

  it('between bins the unresolved skyline gives a fraction interval', () => {
    const h = flatHorizon();
    h.anglesDeg = [0, 2, 0, 0];
    const v = sunVisibility({ azDeg: 45, elDeg: 1 }, h, 2);
    expect(v.status).toBe('unknown');
    expect(v.fraction).toEqual({ low: 0, high: 1 });
  });

  it('a null horizon bin gives an unknown [0, 1] fraction', () => {
    const h = flatHorizon();
    h.anglesDeg = [null, 0, 0, 0];
    expect(sunVisibility({ azDeg: 0, elDeg: 5 }, h, 2)).toMatchObject({ status: 'unknown', fraction: { low: 0, high: 1 } });
  });

  it('a horizon computed at a different observer height is not used', () => {
    const v = sunVisibility({ azDeg: 0, elDeg: 5 }, flatHorizon(0, 3), 2);
    expect(v.status).toBe('unknown');
    expect(v.reason).toMatch(/height/i);
  });

  it('a missing horizon profile is unknown', () => {
    const h: HorizonProfile = { observerHeightM: 2, azimuthStepDeg: 1, anglesDeg: [], extentKm: 0, horizonCoverage: 'missing', sourceId: null };
    expect(sunVisibility({ azDeg: 0, elDeg: 5 }, h, 2).status).toBe('unknown');
  });

  it('a negative skyline still allows a Sun below the mathematical horizon', () => {
    expect(sunVisibility({ azDeg: 0, elDeg: -0.5 }, flatHorizon(-1.5), 2).status).toBe('pass');
  });
});

describe('evaluateSolarSample', () => {
  it('generates peak power with the panel facing a fully visible Sun', () => {
    const r = evaluateSolarSample(sample({ azDeg: 0, elDeg: 0.5 + SUN_ANGULAR_RADIUS_DEG }), flatHorizon(0.5), hardware([fixed([0, 1, 0])]), 0);
    expect(r.sunlit).toBe('pass');
    expect(r.powerW.low).toBeCloseTo(200 * Math.cos((0.5 + SUN_ANGULAR_RADIUS_DEG) * Math.PI / 180), 9);
    expect(r.powerW.high).toBeCloseTo(r.powerW.low, 12);
  });

  it('a blocked Sun gives zero power, even for an ideal tracker', () => {
    const r = evaluateSolarSample(sample({ azDeg: 0, elDeg: 1 }), flatHorizon(3), hardware([tracked()]), 0);
    expect(r.sunlit).toBe('fail');
    expect(r.powerW).toEqual({ low: 0, high: 0 });
  });

  it('sums area-weighted panels', () => {
    const panels = [fixed([0, 1, 0], 0.5), fixed([1, 0, 0], 0.5)];
    const r = evaluateSolarSample(sample({ azDeg: 45, elDeg: 0 }), flatHorizon(-1), hardware(panels), 0);
    expect(r.powerW.low).toBeCloseTo(200 * Math.SQRT1_2, 9);
  });

  it.each([
    ['null Sun direction', sample(null)],
    ['missing ephemeris quality', sample({ azDeg: 0, elDeg: 5 }, 'missing')],
    ['out-of-range elevation', sample({ azDeg: 0, elDeg: 95 })],
  ])('%s: power is bounded by [0, peak] and stays unknown', (_label, s) => {
    const r = evaluateSolarSample(s, flatHorizon(), hardware([fixed([0, 1, 0])]), 0);
    expect(r.sunlit).toBe('unknown');
    expect(r.powerW).toEqual({ low: 0, high: 200 });
    expect(r.incidence).toBeNull();
  });

  it('an unknown skyline keeps the geometric incidence but widens the power interval', () => {
    const h = flatHorizon();
    h.anglesDeg = [null, 0, 0, 0];
    const r = evaluateSolarSample(sample({ azDeg: 0, elDeg: 5 }), h, hardware([fixed([0, 1, 0])]), 0);
    expect(r.incidence).toBeCloseTo(Math.cos(5 * Math.PI / 180), 12);
    expect(r.powerW.low).toBe(0);
    expect(r.powerW.high).toBeCloseTo(200 * Math.cos(5 * Math.PI / 180), 9);
  });
});
