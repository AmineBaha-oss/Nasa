/** Lunar sphere radius used by the A305 products (README: +R=1737400). */
export const MOON_RADIUS_M = 1_737_400;
const RAD = Math.PI / 180;

export interface ProjectedPoint { xM: number; yM: number; }

/**
 * Latitude / east-positive longitude -> Moon south polar stereographic metres
 * (+proj=stere +lon_0=0 +lat_0=-90 +R=1737400; true scale at the pole). Snyder (1987) eq. 21-33/21-34 for the south pole:
 * rho = 2R tan(45 deg + lat/2), x = rho sin(lon), y = rho cos(lon).
 */
export function lunarToPolarStereo(latDeg: number, lonEastDeg: number): ProjectedPoint | null {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonEastDeg) || latDeg < -90 || latDeg >= 90) return null;
  const rho = 2 * MOON_RADIUS_M * Math.tan((45 + latDeg / 2) * RAD);
  return { xM: rho * Math.sin(lonEastDeg * RAD), yM: rho * Math.cos(lonEastDeg * RAD) };
}

/**
 * Grid unit vector [dx, dy] for a surface azimuth (clockwise from TRUE north) at a projected point.
 * On the south-polar projection, true north points away from the pole: north = (x, y)/rho and
 * east = (y, -x)/rho (direction of increasing east longitude). Undefined at the pole.
 */
export function azimuthToGridDirection(p: ProjectedPoint, azDeg: number): [number, number] | null {
  const rho = Math.hypot(p.xM, p.yM);
  if (!(rho > 0) || !Number.isFinite(rho) || !Number.isFinite(azDeg)) return null;
  const north: [number, number] = [p.xM / rho, p.yM / rho];
  const east: [number, number] = [p.yM / rho, -p.xM / rho];
  const s = Math.sin(azDeg * RAD), c = Math.cos(azDeg * RAD);
  return [s * east[0] + c * north[0], s * east[1] + c * north[1]];
}
