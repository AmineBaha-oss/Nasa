// SYNTHETIC UNIT TESTS ONLY. Terrain is invented; footprint, ramp and thresholds are hypothetical
// test inputs. VIPER's draft <=10 deg values are used only as illustrative numbers, not as a standard.
import { describe, it, expect } from 'vitest';
import type { Site } from '../../contracts';
import { evaluateDeployment, lunarToPolarStereo } from './index';
import type { RasterGrid, DeploymentThresholds } from './index';

const site: Site = {
  id: 'synthetic-site', name: 'SYNTHETIC UNIT TEST ONLY', latitudeDeg: -89.111829, longitudeEastDeg: -102.71398,
  terrainSource: 'synthetic', terrainCoverageKm: 0.4, label: 'Invented terrain at a real coordinate, not a candidate result',
};
const P = lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg)!;
const PX = 5, N = 81; // 405 m DEM patch centred on the site
const demOrigin = { x: Math.floor(P.xM / PX) * PX - 40 * PX, y: Math.floor(P.yM / PX) * PX + 41 * PX };

// True north/east grid directions taken from finite differences of the projection (validated against the
// publisher corners in geodesy.test.ts), NOT from azimuthToGridDirection, so ramp tests stay independent.
const unitTowards = (q: { xM: number; yM: number }): [number, number] => {
  const dx = q.xM - P.xM, dy = q.yM - P.yM, n = Math.hypot(dx, dy);
  return [dx / n, dy / n];
};
const NORTH = unitTowards(lunarToPolarStereo(site.latitudeDeg + 1e-5, site.longitudeEastDeg)!);
const EAST = unitTowards(lunarToPolarStereo(site.latitudeDeg, site.longitudeEastDeg + 1e-4)!);

/** DEM whose elevation is f(along-true-north metres, along-true-east metres) relative to the site. */
/** Test-local grid whose pixels the tests may edit in place. */
type MutableGrid = RasterGrid & { values: (number | null)[] };

const demFrom = (f: (northM: number, eastM: number) => number | null): MutableGrid => {
  const north = NORTH, east = EAST;
  const values: (number | null)[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const dx = demOrigin.x + (c + 0.5) * PX - P.xM, dy = demOrigin.y - (r + 0.5) * PX - P.yM;
    values.push(f(dx * north[0] + dy * north[1], dx * east[0] + dy * east[1]));
  }
  return { sourceId: 'synthetic', originXM: demOrigin.x, originYM: demOrigin.y, pixelSizeM: PX, width: N, height: N, values };
};

/** 5 m slope grid inset 25 m inside the DEM patch, like the real files; uniform value unless overridden. */
const slopeGrid = (deg: number): MutableGrid => ({
  sourceId: 'synthetic', originXM: demOrigin.x + 25, originYM: demOrigin.y - 25, pixelSizeM: PX,
  width: N - 10, height: N - 10, values: Array(Math.pow(N - 10, 2)).fill(deg),
});

const hw = { landingFootprintRadiusM: 10, rampHeadingBodyDeg: 0 };
const thresholds: DeploymentThresholds = {
  maxFootprintSlopeDeg: 10, maxRampSlopeDeg: 10, rampLengthM: 20,
  label: 'Illustrative example values (VIPER draft <=10 deg); not a general lunar standard',
};

describe('evaluateDeployment (deployment seam)', () => {
  it('flat terrain passes the resolved-scale screen but is never called landing safe', () => {
    const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, hw, 0, thresholds);
    expect(r.deployment.status).toBe('pass');
    expect(r.deployment.reason).toMatch(/5 m/);
    expect(r.deployment.reason).not.toMatch(/landing safe(?! )/i);
    const notes = r.unresolved.join(' | ');
    expect(notes).toMatch(/not a landing-safety certification/i);
    expect(notes).toMatch(/rocks|boulders/i);
    expect(notes).toMatch(/footpad/i);
    expect(notes).toMatch(/illustrative/i);
  });

  describe('footprint: max 5 m slope inside the landing footprint', () => {
    const north = NORTH;
    /** Slope grid with one pixel (the one containing the point d metres true-north of the site) set to v. */
    const withPixelNorth = (base: number, dM: number, v: number | null): MutableGrid => {
      const g = slopeGrid(base);
      const x = P.xM + north[0] * dM, y = P.yM + north[1] * dM;
      const col = Math.floor((x - g.originXM) / PX), row = Math.floor((g.originYM - y) / PX);
      g.values[row * g.width + col] = v;
      return g;
    };
    const run = (slope: RasterGrid, radius = 10) =>
      evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slope }, { ...hw, landingFootprintRadiusM: radius }, 0, thresholds);

    it('a steep pixel inside the footprint fails; the same pixel outside it does not', () => {
      expect(run(withPixelNorth(3, 2, 12)).deployment.status).toBe('fail');
      expect(run(withPixelNorth(3, 2, 12)).footprint.maxSlopeDeg).toBe(12);
      expect(run(withPixelNorth(3, 40, 12)).deployment.status).toBe('pass');
      expect(run(withPixelNorth(3, 40, 12)).footprint.maxSlopeDeg).toBe(3);
    });

    it('exact threshold equality passes; just above fails', () => {
      expect(run(slopeGrid(10)).footprint.status).toBe('pass');
      expect(run(slopeGrid(10.0001)).footprint.status).toBe('fail');
    });

    it('a missing slope pixel in the footprint -> unknown, but a definite exceedance still fails', () => {
      expect(run(withPixelNorth(3, 2, null)).footprint.status).toBe('unknown');
      const both = withPixelNorth(3, 2, null);
      const g2 = withPixelNorth(3, -2, 12);
      both.values = both.values.map((v, i) => (g2.values[i] === 12 ? 12 : v));
      expect(run(both).footprint.status).toBe('fail');
    });

    it('a footprint reaching past the slope tile edge (the 25 m inset) -> unknown', () => {
      // The slope grid ends 35*5 = 175 m from the site; a 190 m radius crosses that edge.
      const r = run(slopeGrid(1), 190);
      expect(r.footprint.status).toBe('unknown');
      expect(r.footprint.missingPixels).toBeGreaterThan(0);
    });

    it('a footprint smaller than a pixel still screens the pixel under the site', () => {
      const r = run(withPixelNorth(1, 0, 12), 0.5);
      expect(r.footprint.pixels).toBe(1);
      expect(r.footprint.status).toBe('fail');
    });

    it('missing footprint radius (HARDWARE-004 open) -> unknown', () => {
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, { rampHeadingBodyDeg: 0 }, 0, thresholds);
      expect(r.footprint.status).toBe('unknown');
      expect(r.deployment.status).toBe('unknown');
      expect(r.deployment.reason).toMatch(/HARDWARE-004/);
    });
  });

  describe('ramp: DEM rise along yaw + body ramp heading, clockwise from TRUE north', () => {
    const RAD = Math.PI / 180;
    /** Plane rising toward true north at angle deg (elevation = tan(deg) * metres north). */
    const tiltedNorth = (deg: number) => demFrom(n => 100 + Math.tan(deg * RAD) * n);
    const ramp = (deg: number, yaw: number, rampHeadingBodyDeg = 0, over: Partial<DeploymentThresholds> = {}) =>
      evaluateDeployment(site, { dem: tiltedNorth(deg), slope5m: slopeGrid(0) }, { ...hw, rampHeadingBodyDeg }, yaw, { ...thresholds, ...over });

    it.each([
      // [yaw, body ramp heading, expected ramp azimuth, expected signed slope on a 5 deg north-rising plane]
      [0, 0, 0, 5], [90, 0, 90, 0], [180, 0, 180, -5], [270, 0, 270, 0],
      [270, 90, 0, 5], [90, 90, 180, -5], [360, 0, 0, 5], [-90, 90, 0, 5],
    ])('yaw %i, body ramp %i -> azimuth %i, slope %i deg', (yaw, body, az, slope) => {
      const r = ramp(5, yaw, body);
      expect(r.ramp.azimuthDeg).toBeCloseTo(az, 9);
      expect(r.ramp.slopeDeg!).toBeCloseTo(slope, 6);
    });

    it('the same site flips between fail and pass with heading: a 12 deg north-rising ramp', () => {
      expect(ramp(12, 0).deployment.status).toBe('fail');
      expect(ramp(12, 90).deployment.status).toBe('pass');
      expect(ramp(12, 180).deployment.status).toBe('fail'); // downhill is checked by magnitude
    });

    it('the ramp starts at the footprint edge, not the lander centre', () => {
      // A 20 m step down inside the footprint (north < 3 m) must not be read as ramp slope:
      // from the edge (10 m) to 30 m north the ground is flat. (Bilinear sampling at 10 m uses pixel
      // centres up to ~6.1 m away on this rotated grid, so the step sits outside that reach.)
      const dem = demFrom(n => (n < 3 ? 80 : 100));
      const r = evaluateDeployment(site, { dem, slope5m: slopeGrid(0) }, hw, 0, thresholds);
      expect(r.ramp.slopeDeg!).toBeCloseTo(0, 9);
      expect(r.ramp.status).toBe('pass');
    });

    it('exact threshold equality passes; just above fails', () => {
      expect(ramp(10, 0).ramp.status).toBe('pass');
      expect(ramp(10.01, 0).ramp.status).toBe('fail');
    });

    it('a ramp shorter than two DEM pixels cannot be resolved -> unknown', () => {
      const r = ramp(5, 0, 0, { rampLengthM: 8 });
      expect(r.ramp.status).toBe('unknown');
      expect(r.deployment.reason).toMatch(/cannot resolve/i);
    });

    it('missing DEM along the ramp, or a ramp running off the DEM patch -> unknown', () => {
      const holes = demFrom(n => (n > 15 && n < 35 ? null : 100));
      const r = evaluateDeployment(site, { dem: holes, slope5m: slopeGrid(0) }, hw, 0, thresholds);
      expect(r.ramp.status).toBe('unknown');
      expect(ramp(5, 0, 0, { rampLengthM: 400 }).ramp.status).toBe('unknown');
    });

    it('an east-rising plane: yaw 90 climbs, yaw 270 descends, off-axis follows cos (catches a mirrored ramp)', () => {
      const east = demFrom((_n, e) => 100 + Math.tan(5 * RAD) * e);
      const at = (yaw: number, body = 0) =>
        evaluateDeployment(site, { dem: east, slope5m: slopeGrid(0) }, { ...hw, rampHeadingBodyDeg: body }, yaw, thresholds).ramp.slopeDeg!;
      // Tolerance 1e-4 deg: the fixture's north/east axes come from finite differences (~1e-6 accurate).
      expect(at(90)).toBeCloseTo(5, 4);
      expect(at(270)).toBeCloseTo(-5, 4);
      // Azimuth 45 on an east-rising 5 deg plane: atan(tan 5 * sin 45) = 3.5400 deg (worked by hand).
      expect(at(30, 15)).toBeCloseTo(Math.atan(Math.tan(5 * RAD) * Math.SQRT1_2) / RAD, 4);
      expect(at(30, 15)).toBeCloseTo(3.54, 2);
    });

    it('missing ramp heading (HARDWARE-004 open) -> ramp unknown, footprint still evaluated', () => {
      const r = evaluateDeployment(site, { dem: tiltedNorth(5), slope5m: slopeGrid(0) }, { landingFootprintRadiusM: 10 }, 0, thresholds);
      expect(r.ramp.status).toBe('unknown');
      expect(r.footprint.status).toBe('pass');
      expect(r.deployment.status).toBe('unknown');
    });

    it('missing or invalid footprint radius makes the ramp start unknown, so no definite ramp fail', () => {
      const stepInside = demFrom(n => (n < 3 ? 80 : 100)); // steep only inside the first metres
      for (const landingFootprintRadiusM of [undefined, NaN, -5]) {
        const r = evaluateDeployment(site, { dem: stepInside, slope5m: slopeGrid(0) },
          { rampHeadingBodyDeg: 0, landingFootprintRadiusM }, 0, thresholds);
        expect(r.ramp.status).toBe('unknown');
        expect(r.deployment.status).toBe('unknown');
      }
    });

    it('a DEM hole strictly between the ramp endpoints -> unknown, not pass', () => {
      const hole = demFrom(n => (n > 18 && n < 22 ? null : 100)); // ramp spans 10..30 m north
      const r = evaluateDeployment(site, { dem: hole, slope5m: slopeGrid(0) }, hw, 0, thresholds);
      expect(r.ramp.status).toBe('unknown');
    });

    it('invalid ramp length is reported as invalid, not as unresolvable', () => {
      const r = ramp(5, 0, 0, { rampLengthM: NaN });
      expect(r.ramp.status).toBe('unknown');
      expect(r.deployment.reason).toMatch(/invalid ramp length/i);
    });

    it('wraps yaw and body heading separately (huge yaw keeps the body offset)', () => {
      // 1e17 mod 360 = 280 exactly, so 280 + 90 -> azimuth 10.
      expect(ramp(5, 1e17, 90).ramp.azimuthDeg).toBeCloseTo(10, 9);
    });
  });

  describe('status propagation: a definite fail is never hidden by unknown', () => {
    const RAD = Math.PI / 180;
    /** Slope grid with given values at the pixels containing points d metres true-north of the site. */
    const slopeWith = (base: number, set: [number, number | null][]) => {
      const g = slopeGrid(base);
      const idx = (dM: number) => {
        const x = P.xM + NORTH[0] * dM, y = P.yM + NORTH[1] * dM;
        return Math.floor((g.originYM - y) / PX) * g.width + Math.floor((x - g.originXM) / PX);
      };
      expect(new Set(set.map(([d]) => idx(d))).size).toBe(set.length); // really distinct pixels
      for (const [d, v] of set) g.values[idx(d)] = v;
      return g;
    };

    it('footprint: a missing pixel and a steep pixel (different pixels) -> fail, with missingPixels > 0', () => {
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeWith(3, [[0, null], [6, 12]]) }, hw, 0, thresholds);
      expect(r.footprint.missingPixels).toBeGreaterThan(0);
      expect(r.footprint.status).toBe('fail');
    });

    it('footprint unknown + ramp fail -> fail', () => {
      const steep = demFrom(n => 100 + Math.tan(12 * RAD) * n);
      const r = evaluateDeployment(site, { dem: steep, slope5m: slopeWith(3, [[0, null]]) }, hw, 0, thresholds);
      expect(r.footprint.status).toBe('unknown');
      expect(r.ramp.status).toBe('fail');
      expect(r.deployment.status).toBe('fail');
    });

    it('footprint fail + ramp unknown -> fail', () => {
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(12) }, { landingFootprintRadiusM: 10 }, 0, thresholds);
      expect(r.ramp.status).toBe('unknown');
      expect(r.deployment.status).toBe('fail');
    });
  });

  describe('footprint pixel selection', () => {
    it('screens the pixel under the site even when its centre is outside a tiny footprint', () => {
      const g = slopeGrid(1);
      g.originXM += 2; // site now ~2 m from its pixel centre
      const col = Math.floor((P.xM - g.originXM) / PX), row = Math.floor((g.originYM - P.yM) / PX);
      const cx = g.originXM + (col + 0.5) * PX, cy = g.originYM - (row + 0.5) * PX;
      expect(Math.hypot(cx - P.xM, cy - P.yM)).toBeGreaterThan(0.5);
      g.values[row * g.width + col] = 12;
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: g }, { ...hw, landingFootprintRadiusM: 0.5 }, 0, thresholds);
      expect(r.footprint.pixels).toBe(1);
      expect(r.footprint.status).toBe('fail');
    });

    it('uses the circle, not its bounding square: a steep pixel in the square corner is ignored', () => {
      const g = slopeGrid(1);
      let hit = -1;
      for (let row = 0; row < g.height && hit < 0; row++) for (let col = 0; col < g.width; col++) {
        const dx = g.originXM + (col + 0.5) * PX - P.xM, dy = g.originYM - (row + 0.5) * PX - P.yM;
        if (dx >= 6.5 && dx < 11.5 && dy >= 6.5 && dy < 11.5) { hit = row * g.width + col; break; }
      }
      expect(hit).toBeGreaterThanOrEqual(0); // centre >= 9.19 m away, pixel overlaps the 9 m square
      g.values[hit] = 12;
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: g }, { ...hw, landingFootprintRadiusM: 9 }, 0, thresholds);
      expect(r.footprint.status).toBe('pass');
    });
  });

  describe('forbidden claims and caveats', () => {
    const SAFE = /landing[ -]?safe(?!ty)|safe to land/i;
    it('no result string ever claims landing safety (pass, fail and unknown paths)', () => {
      const cases = [
        evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, hw, 0, thresholds),
        evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(20) }, hw, 0, thresholds),
        evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, {}, 0, thresholds),
      ];
      for (const r of cases) for (const s of [r.deployment.reason, ...r.unresolved]) expect(s).not.toMatch(SAFE);
    });

    it('states that DEM quality layers are not screened and pixel slope is not effective lander slope', () => {
      const notes = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, hw, 0, thresholds).unresolved.join(' ');
      expect(notes).toMatch(/MASK|quality/);
      expect(notes).toMatch(/not the effective lander slope/i);
    });

    it('an empty-string source id counts as untraceable', () => {
      const dem = { ...demFrom(() => 100), sourceId: '' };
      const r = evaluateDeployment(site, { dem, slope5m: slopeGrid(0) }, hw, 0, thresholds);
      expect(r.deployment.sourceIds).toEqual(['synthetic']);
      expect(r.unresolved.join(' ')).toMatch(/untraceable/);
    });
  });

  describe('real-data traps: sentinels, string nodata, impossible values, malformed grids', () => {
    const SENTINEL = -3.4028234663852886e38;
    const run = (slope5m: RasterGrid, dem = demFrom(() => 100)) => evaluateDeployment(site, { dem, slope5m }, hw, 0, thresholds);

    it('slope pixels equal to the float32 sentinel are missing even when nodata is omitted, a string, or rounded', () => {
      const filled = () => ({ ...slopeGrid(0), values: Array(Math.pow(N - 10, 2)).fill(SENTINEL) });
      expect(run({ ...filled(), nodata: undefined }).footprint.status).toBe('unknown');
      expect(run({ ...filled(), nodata: '-3.4028234663852886e+38' as unknown as number }).footprint.status).toBe('unknown');
      expect(run({ ...filled(), nodata: -3.40282e38 }).footprint.status).toBe('unknown');
    });

    it('a DEM sentinel at a ramp endpoint -> ramp unknown, not a -90 deg fail', () => {
      const dem = demFrom(n => (n > 25 ? SENTINEL : 100));
      expect(run(slopeGrid(0), { ...dem, nodata: -3.40282e38 }).ramp.status).toBe('unknown');
    });

    it('a huge footprint radius stays fast (loop clamped to the tile) and is unknown', () => {
      const t0 = performance.now();
      const r = evaluateDeployment(site, { dem: demFrom(() => 100), slope5m: slopeGrid(0) }, { ...hw, landingFootprintRadiusM: 40000 }, 0, thresholds);
      expect(performance.now() - t0).toBeLessThan(500);
      expect(r.footprint.status).toBe('unknown');
    });

    it('physically impossible slope values (< 0 or > 90 deg) are treated as missing', () => {
      expect(run(slopeGrid(-1)).footprint.status).toBe('unknown');
      expect(run(slopeGrid(95)).footprint.status).toBe('unknown');
    });

    it('malformed grids -> unknown with an "invalid grid" reason (no hang, no silent shift)', () => {
      const bad: RasterGrid[] = [
        { ...slopeGrid(0), pixelSizeM: 0 }, // used to loop forever
        { ...slopeGrid(0), pixelSizeM: -5 },
        { ...slopeGrid(0), width: N - 11 }, // values length no longer width * height
        { ...slopeGrid(0), originXM: NaN },
      ];
      for (const g of bad) {
        const r = run(g);
        expect(r.footprint.status).toBe('unknown');
        expect(r.deployment.reason).toMatch(/invalid .*grid/i);
      }
      const r = run(slopeGrid(0), { ...demFrom(() => 100), width: N - 1 });
      expect(r.ramp.status).toBe('unknown');
      expect(r.deployment.reason).toMatch(/invalid .*grid/i);
    });
  });
});
