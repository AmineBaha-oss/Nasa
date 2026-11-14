// SYNTHETIC UNIT TESTS ONLY. Antenna values are hypothetical test inputs, not a real lander.
import { describe, it, expect } from 'vitest';
import type { EphemerisSample, HorizonProfile, HardwareConfig } from '../../contracts';
import fixture from '../../../../tests/fixtures/synthetic-site-date.json';
import { evaluateEarthPointing } from './index';

type AntennaHw = Pick<HardwareConfig, 'antenna' | 'antennaHeightM'>;

const sample = (azDeg: number, elDeg: number, over: Partial<EphemerisSample> = {}): EphemerisSample => ({
  utc: '2027-10-01T00:00:00Z', sun: null, earth: { azDeg, elDeg },
  ephemerisQuality: 'approximate', sourceId: 'synthetic', ...over,
});
const flatHorizon = (over: Partial<HorizonProfile> = {}): HorizonProfile => ({
  observerHeightM: 3, azimuthStepDeg: 90, anglesDeg: [0, 0, 0, 0],
  extentKm: 1, horizonCoverage: 'local-only', sourceId: 'synthetic', ...over,
});
const fixedForward = (beamHalfAngleDeg = 10): AntennaHw => ({
  antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg }, antennaHeightM: 3,
});

describe('evaluateEarthPointing (per-sample seam)', () => {
  it('passes when Earth is above the skyline and inside a fixed forward beam at yaw 0', () => {
    const r = evaluateEarthPointing(sample(0, 5), flatHorizon(), fixedForward(), 0);
    expect(r.status).toBe('pass');
  });

  it('fails pointing when Earth is above the skyline but outside the beam', () => {
    // Yaw 90: body-forward points east; Earth due north is 85 deg off boresight.
    const r = evaluateEarthPointing(sample(0, 5), flatHorizon(), fixedForward(), 90);
    expect(r.status).toBe('fail');
    expect(r.earthVisible).toBe('pass');
    expect(r.pointing).toBe('fail');
    expect(r.reason).toMatch(/outside/i);
  });

  it('fails visibility when Earth is inside the beam but below the skyline', () => {
    const r = evaluateEarthPointing(sample(0, 5), flatHorizon({ anglesDeg: [8, 0, 0, 0] }), fixedForward(), 0);
    expect(r.status).toBe('fail');
    expect(r.earthVisible).toBe('fail');
    expect(r.pointing).toBe('pass');
    expect(r.reason).toMatch(/skyline/i);
  });

  describe('yaw convention: clockwise from north, body-forward rotated into ENU', () => {
    // Expected status by hand: forward boresight points at azimuth = yaw.
    it.each([
      [0, 0, 'pass'], [90, 90, 'pass'], [180, 180, 'pass'], [270, 270, 'pass'],
      [90, 270, 'fail'], [270, 90, 'fail'], [180, 0, 'fail'],
    ])('yaw %i with Earth at azimuth %i -> %s', (yaw, az, expected) => {
      expect(evaluateEarthPointing(sample(az, 5), flatHorizon(), fixedForward(), yaw).pointing).toBe(expected);
    });

    it('treats yaw 360 and -360 like yaw 0, and yaw -90 like 270', () => {
      const at = (yaw: number, az: number) => evaluateEarthPointing(sample(az, 5), flatHorizon(), fixedForward(), yaw).pointing;
      expect(at(360, 0)).toBe('pass');
      expect(at(-360, 0)).toBe('pass');
      expect(at(-90, 270)).toBe('pass');
      expect(at(-90, 90)).toBe('fail');
    });

    it('a body-right boresight at yaw 0 points east', () => {
      const right: AntennaHw = { antenna: { boresightBodyRFU: [1, 0, 0], beamHalfAngleDeg: 10 }, antennaHeightM: 3 };
      expect(evaluateEarthPointing(sample(90, 5), flatHorizon(), right, 0).pointing).toBe('pass');
      expect(evaluateEarthPointing(sample(270, 5), flatHorizon(), right, 0).pointing).toBe('fail');
    });

    // Exact vectors: Earth on the horizon and a 0.01 deg beam leave no room for a rotation error.
    const lowSky = flatHorizon({ anglesDeg: [-1, -1, -1, -1] });
    const narrow = (b: [number, number, number]): AntennaHw => ({ antenna: { boresightBodyRFU: b, beamHalfAngleDeg: 0.01 }, antennaHeightM: 3 });
    const exact = (b: [number, number, number], yaw: number, az: number) =>
      evaluateEarthPointing(sample(az, 0), lowSky, narrow(b), yaw).pointing;

    it.each([
      // [boresight RFU, yaw, azimuth it must point at] - worked by hand from E = r cos y + f sin y, N = -r sin y + f cos y
      [[0, 1, 0], 0, 0], [[0, 1, 0], 90, 90], [[0, 1, 0], 180, 180], [[0, 1, 0], 270, 270], [[0, 1, 0], 360, 0],
      [[1, 0, 0], 0, 90], [[1, 0, 0], 90, 180], [[1, 0, 0], 180, 270], [[1, 0, 0], 270, 0],
      [[-1, 0, 0], 90, 0], [[1, 1, 0], 90, 135], [[1, 1, 0], 0, 45],
    ] as [[number, number, number], number, number][])('boresight %j at yaw %i points exactly at azimuth %i', (b, yaw, az) => {
      expect(exact(b, yaw, az)).toBe('pass');
      expect(exact(b, yaw, az + 0.1)).toBe('fail');
      expect(exact(b, yaw, az - 0.1)).toBe('fail');
    });

    it('an upward-tilted boresight keeps its elevation under yaw', () => {
      // [0, 1, 1] is 45 deg above body-forward: at yaw 90 it points at az 90, el 45.
      const hw = narrow([0, 1, 1]);
      expect(evaluateEarthPointing(sample(90, 45), lowSky, hw, 90).pointing).toBe('pass');
      expect(evaluateEarthPointing(sample(90, 44.9), lowSky, hw, 90).pointing).toBe('fail');
    });
  });

  describe('skyline lookup: bin i is a point sample at azimuth i * step (docs/INTERFACES.md)', () => {
    // Samples: az 0 -> 8 deg, az 90/180/270 -> 0 deg.
    const h = flatHorizon({ anglesDeg: [8, 0, 0, 0] });
    const vis = (az: number, el: number) => evaluateEarthPointing(sample(az, el), h, fixedForward(180), 0).earthVisible;

    it('uses the exact sample when Earth azimuth hits a sample point, including 360 = 0', () => {
      expect(vis(0, 5)).toBe('fail');
      expect(vis(360, 5)).toBe('fail');
      expect(vis(0, 9)).toBe('pass');
      expect(vis(90, 5)).toBe('pass');
    });

    it('between samples: above both -> pass, at or below both -> fail, in between -> unknown', () => {
      expect(vis(45, 9)).toBe('pass');
      expect(vis(45, 0)).toBe('fail');
      expect(vis(45, 5)).toBe('unknown');
    });

    it('wraps between the last and first sample (azimuth 359.5 = -0.5)', () => {
      expect(vis(359.5, 5)).toBe('unknown');
      expect(vis(-0.5, 5)).toBe('unknown');
      expect(vis(-0.5, 9)).toBe('pass');
      expect(vis(315, -1)).toBe('fail');
    });
  });

  describe('exact boundaries', () => {
    const lowSky = flatHorizon({ anglesDeg: [-1, -1, -1, -1] });
    it('Earth exactly on the beam edge is inside (angle <= half-angle); just beyond is outside', () => {
      // Earth at az 10, el 0 is exactly 10 deg from a north boresight at yaw 0.
      expect(evaluateEarthPointing(sample(10, 0), lowSky, fixedForward(10), 0).pointing).toBe('pass');
      expect(evaluateEarthPointing(sample(10.01, 0), lowSky, fixedForward(10), 0).pointing).toBe('fail');
    });
    it('Earth centre exactly on the skyline is not above it -> fail', () => {
      expect(evaluateEarthPointing(sample(0, -1), lowSky, fixedForward(), 0).earthVisible).toBe('fail');
    });
  });

  describe('invalid configuration -> unknown, not a guessed result', () => {
    const withAntenna = (antenna: AntennaHw['antenna']): AntennaHw => ({ antenna, antennaHeightM: 3 });
    it.each([
      ['zero-length boresight', withAntenna({ boresightBodyRFU: [0, 0, 0], beamHalfAngleDeg: 10 })],
      ['zero beam half-angle', withAntenna({ boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: 0 })],
      ['negative beam half-angle', withAntenna({ boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: -5 })],
      ['non-finite boresight', withAntenna({ boresightBodyRFU: [0, NaN, 0], beamHalfAngleDeg: 10 })],
    ])('%s', (_label, hw) => {
      const r = evaluateEarthPointing(sample(0, 5), flatHorizon(), hw, 0);
      expect(r.pointing).toBe('unknown');
      expect(r.status).toBe('unknown');
      expect(r.reason).toMatch(/invalid antenna/i);
    });
    it('non-finite yaw', () => {
      expect(evaluateEarthPointing(sample(0, 5), flatHorizon(), fixedForward(), NaN).pointing).toBe('unknown');
    });
  });

  describe('numerical robustness', () => {
    const lowSky = flatHorizon({ anglesDeg: [-1, -1, -1, -1] });
    it('resolves very narrow beams (no acos precision floor)', () => {
      const hw: AntennaHw = { antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: 1e-7 }, antennaHeightM: 3 };
      expect(evaluateEarthPointing(sample(2e-7, 0), lowSky, hw, 0).pointing).toBe('fail');
      expect(evaluateEarthPointing(sample(0.5e-7, 0), lowSky, hw, 0).pointing).toBe('pass');
    });
    it('reduces very large yaw modulo 360 before rotating', () => {
      const hw: AntennaHw = { antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: 0.01 }, antennaHeightM: 3 };
      expect(evaluateEarthPointing(sample(0, 0), lowSky, hw, 3.6e15).pointing).toBe('pass');
    });
  });

  describe('scope caveats travel with each sample', () => {
    it('a clear local-only, approximate-ephemeris sample says so in its reason', () => {
      const r = evaluateEarthPointing(sample(0, 5), flatHorizon(), fixedForward(), 0);
      expect(r.status).toBe('pass');
      expect(r.reason).toMatch(/local terrain only/i);
      expect(r.reason).toMatch(/approximate ephemeris/i);
    });
    it('a far-field-validated, JPL-verified sample carries neither caveat', () => {
      const r = evaluateEarthPointing(sample(0, 5, { ephemerisQuality: 'jpl-verified' }),
        flatHorizon({ horizonCoverage: 'far-field-validated' }), fixedForward(), 0);
      expect(r.status).toBe('pass');
      expect(r.reason).not.toMatch(/local terrain only/i);
      expect(r.reason).not.toMatch(/approximate/i);
    });
  });

  describe('gimballed antenna (pan clockwise from body-forward toward body-right, tilt toward body-up)', () => {
    const lowSky = flatHorizon({ anglesDeg: [-1, -1, -1, -1] });
    const gimbal = (panMinDeg: number, panMaxDeg: number, tiltMinDeg: number, tiltMaxDeg: number, beamHalfAngleDeg = 5): AntennaHw => ({
      antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg, gimbal: { panMinDeg, panMaxDeg, tiltMinDeg, tiltMaxDeg } },
      antennaHeightM: 3,
    });
    const point = (hw: AntennaHw, az: number, el: number, yaw: number) => evaluateEarthPointing(sample(az, el), lowSky, hw, yaw).pointing;

    it('reaches Earth inside the pan/tilt ranges and misses it outside', () => {
      const hw = gimbal(-90, 90, 0, 60);
      expect(point(hw, 45, 5, 0)).toBe('pass');
      expect(point(hw, 180, 5, 0)).toBe('fail');
    });

    it('pan is measured in the body frame, so yaw rotates the reachable region', () => {
      const hw = gimbal(-90, 90, 0, 60);
      expect(point(hw, 180, 5, 180)).toBe('pass'); // body-forward faces south
      expect(point(hw, 0, 5, 180)).toBe('fail');
    });

    it('pan boundary: exactly at the limit passes; beyond the limit passes only within the beam half-angle', () => {
      const hw = gimbal(-90, 90, 0, 60, 5);
      expect(point(hw, 90, 0, 0)).toBe('pass');
      expect(point(hw, 95, 0, 0)).toBe('pass'); // 5 deg past the pan stop = exactly the 5 deg half-angle
      expect(point(hw, 96, 0, 0)).toBe('fail');
    });

    it('tilt boundary: Earth above the tilt stop by more than the half-angle fails', () => {
      const hw = gimbal(-90, 90, 0, 60, 5);
      expect(point(hw, 0, 60, 0)).toBe('pass');
      expect(point(hw, 0, 65, 0)).toBe('pass');
      expect(point(hw, 0, 70, 0)).toBe('fail');
    });

    it('pan is clockwise toward body-right: an asymmetric right-side gimbal reaches right, not left', () => {
      const hw = gimbal(0, 90, -10, 10, 1);
      expect(point(hw, 45, 0, 0)).toBe('pass');   // body pan +45 (right)
      expect(point(hw, 315, 0, 0)).toBe('fail');  // body pan -45 (left)
      expect(point(hw, 135, 0, 90)).toBe('pass'); // yaw 90: body-right is south, body pan +45 = az 135
      expect(point(hw, 45, 0, 90)).toBe('fail');  // az 45 at yaw 90 is body pan -45
    });

    it('pan range crossing the body-rear (+/-180) wraps correctly', () => {
      const hw = gimbal(90, 270, 0, 60);
      expect(point(hw, 180, 5, 0)).toBe('pass');
      expect(point(hw, 200, 5, 0)).toBe('pass');
      expect(point(hw, 0, 5, 0)).toBe('fail');
    });

    it('full gimbal reach removes yaw sensitivity, but never overrides a terrain blockage', () => {
      const hw = gimbal(-180, 180, -90, 90);
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        for (const az of [0, 90, 180, 270]) expect(point(hw, az, 5, yaw)).toBe('pass');
      }
      const blocked = evaluateEarthPointing(sample(0, 5), flatHorizon({ anglesDeg: [8, 0, 0, 0] }), hw, 0);
      expect(blocked.pointing).toBe('pass');
      expect(blocked.status).toBe('fail');
    });

    it('uses the true closest reachable direction near a tilt stop at zenith (no false fail)', () => {
      // Zenith (tilt 90) is reachable, so Earth at az 180 el 45 is exactly 45 deg from the reachable region.
      const hw = (beam: number) => gimbal(-10, 10, 0, 90, beam);
      expect(point(hw(45.5), 180, 45, 0)).toBe('pass');
      expect(point(hw(44.5), 180, 45, 0)).toBe('fail');
      // Full tilt with a forward pan arc: Earth behind at el 45 is 45 deg from the zenith.
      expect(point(gimbal(-90, 90, -90, 90, 45.5), 180, 45, 0)).toBe('pass');
    });

    it('finds the closest tilt stop "around the back" when Earth is behind a pan-stop meridian', () => {
      // Independent dense grid search: Earth (az 260, el 10) is 136.708 deg from the box
      // pan [80, 100], tilt [-50, 12], closest at (pan 100, tilt -50) - not at the nearer-looking tilt 12.
      const hw = (beam: number) => gimbal(80, 100, -50, 12, beam);
      expect(point(hw(136.75), 260, 10, 0)).toBe('pass');
      expect(point(hw(136.65), 260, 10, 0)).toBe('fail');
    });

    it.each([
      ['pan min > max', gimbal(90, -90, 0, 60)],
      ['tilt min > max', gimbal(-90, 90, 60, 0)],
      ['tilt beyond +90', gimbal(-90, 90, 0, 120)],
      ['non-finite pan', gimbal(NaN, 90, 0, 60)],
    ])('invalid gimbal (%s) -> unknown', (_label, hw) => {
      const r = evaluateEarthPointing(sample(0, 5), lowSky, hw, 0);
      expect(r.pointing).toBe('unknown');
      expect(r.reason).toMatch(/invalid antenna/i);
    });
  });

  describe('missing data stays unknown (null never means clear sky or zero elevation)', () => {
    it('Earth direction null -> unknown', () => {
      const r = evaluateEarthPointing(sample(0, 5, { earth: null }), flatHorizon(), fixedForward(), 0);
      expect([r.status, r.earthVisible, r.pointing]).toEqual(['unknown', 'unknown', 'unknown']);
      expect(r.reason).toMatch(/earth direction/i);
    });

    it('ephemeris quality "missing" -> unknown even if a direction is present', () => {
      const r = evaluateEarthPointing(sample(0, 5, { ephemerisQuality: 'missing' }), flatHorizon(), fixedForward(), 0);
      expect(r.status).toBe('unknown');
      expect(r.reason).toMatch(/ephemeris quality is "missing"/i);
    });

    it('non-finite or out-of-range Earth az/el -> unknown with the actual cause', () => {
      for (const [az, el] of [[NaN, 5], [0, NaN], [Infinity, 5]]) {
        const r = evaluateEarthPointing(sample(az, el, { ephemerisQuality: 'jpl-verified' }), flatHorizon(), fixedForward(), 0);
        expect(r.status).toBe('unknown');
        expect(r.reason).toMatch(/not finite/i);
      }
      // el 95 would silently become az 180, el 85 as a vector; it must not be compared at az 0.
      const r = evaluateEarthPointing(sample(0, 95), flatHorizon({ anglesDeg: [0, 0, 88, 0] }),
        { antenna: { boresightBodyRFU: [0, 0, 1], beamHalfAngleDeg: 10 }, antennaHeightM: 3 }, 0);
      expect(r.status).toBe('unknown');
      expect(r.reason).toMatch(/out of range/i);
    });

    it('non-finite antenna or observer height -> visibility unknown', () => {
      expect(evaluateEarthPointing(sample(0, 5), flatHorizon(), { ...fixedForward(), antennaHeightM: NaN }, 0).earthVisible).toBe('unknown');
      expect(evaluateEarthPointing(sample(0, 5), flatHorizon({ observerHeightM: NaN }), fixedForward(), 0).earthVisible).toBe('unknown');
    });

    it('null horizon bin at the Earth azimuth (shared synthetic fixture) -> visibility unknown', () => {
      const h = structuredClone(fixture.earthHorizon) as HorizonProfile; // bin 1 (az 90) is null
      const right: AntennaHw = { antenna: { boresightBodyRFU: [1, 0, 0], beamHalfAngleDeg: 10 }, antennaHeightM: 3 };
      const r = evaluateEarthPointing(sample(90, 5), h, right, 0);
      expect(r.earthVisible).toBe('unknown');
      expect(r.status).toBe('unknown');
      expect(r.reason).toMatch(/no terrain/i);
      // A neighbouring null bin also blocks interpolation at azimuth 45.
      expect(evaluateEarthPointing(sample(45, 30), h, fixedForward(180), 0).earthVisible).toBe('unknown');
    });

    it('a definite pointing failure still fails even when the skyline is unknown', () => {
      const h = structuredClone(fixture.earthHorizon) as HorizonProfile;
      const r = evaluateEarthPointing(sample(90, 5), h, fixedForward(), 0); // boresight north, Earth east
      expect(r.earthVisible).toBe('unknown');
      expect(r.status).toBe('fail');
    });

    it('missing horizon profile -> unknown', () => {
      const missing = flatHorizon({ anglesDeg: [], horizonCoverage: 'missing', sourceId: null, extentKm: 0 });
      const r = evaluateEarthPointing(sample(0, 5), missing, fixedForward(), 0);
      expect(r.earthVisible).toBe('unknown');
      expect(r.status).toBe('unknown');
    });

    it('malformed horizon (bin count != 360 / step, or non-finite angle) -> unknown', () => {
      expect(evaluateEarthPointing(sample(0, 5), flatHorizon({ anglesDeg: [0, 0, 0] }), fixedForward(), 0).status).toBe('unknown');
      expect(evaluateEarthPointing(sample(0, 5), flatHorizon({ anglesDeg: [NaN, 0, 0, 0] }), fixedForward(), 0).status).toBe('unknown');
    });

    it('horizon computed for a different observer height than the antenna -> unknown', () => {
      const r = evaluateEarthPointing(sample(0, 5), flatHorizon({ observerHeightM: 2 }), fixedForward(), 0);
      expect(r.earthVisible).toBe('unknown');
      expect(r.status).toBe('unknown');
      expect(r.reason).toMatch(/observer height/i);
    });
  });
});
