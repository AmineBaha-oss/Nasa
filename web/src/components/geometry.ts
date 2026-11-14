// Display-only geometry for the 2D views. Nothing here decides a constraint status;
// pass/fail/unknown always comes from engine results (HeadingEvaluation).
// Conventions (docs/INTERFACES.md): azimuth clockwise from lunar north, degrees;
// body frame right-forward-up (RFU); yaw clockwise from north.

export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

export interface ElevationScale { minElDeg: number; maxElDeg: number; }
export interface Point { x: number; y: number; }

/** Top-down polar plot: north up, east right, rim = minElDeg, centre = maxElDeg. */
export function polarPoint(azDeg: number, elDeg: number, cx: number, cy: number, radius: number, scale: ElevationScale): Point {
  const el = Math.min(scale.maxElDeg, Math.max(scale.minElDeg, elDeg));
  const r = radius * (scale.maxElDeg - el) / (scale.maxElDeg - scale.minElDeg);
  const a = azDeg * Math.PI / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

/** Horizontal direction of a body RFU vector, clockwise from body-forward; null if (nearly) vertical. */
export function bodyVectorAzimuthDeg(v: readonly [number, number, number]): number | null {
  const [right, forward] = v;
  if (Math.hypot(right, forward) < 1e-6) return null;
  return normalizeDeg(Math.atan2(right, forward) * 180 / Math.PI);
}

/** Elevation of a body RFU vector above the body horizontal plane, degrees. */
export function bodyVectorElevationDeg(v: readonly [number, number, number]): number {
  const [right, forward, up] = v;
  return Math.atan2(up, Math.hypot(right, forward)) * 180 / Math.PI;
}

/** Elevation range for the wheel, padded to 5-degree rings, always including -5..+15. */
export function chooseElevationScale(values: readonly (number | null | undefined)[]): ElevationScale {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const lo = Math.min(-5, ...finite.map(v => Math.floor(v / 5) * 5));
  const hi = Math.max(15, ...finite.map(v => Math.ceil(v / 5) * 5 + 5));
  return { minElDeg: Math.max(-90, lo), maxElDeg: Math.min(90, hi) };
}

/** Heading under a pointer, from its offset to the dial centre in screen space (y down). */
export function yawFromPointer(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < 1e-9) return null;
  return Math.round(normalizeDeg(Math.atan2(dx, -dy) * 180 / Math.PI));
}

/** Keyboard steps for the heading dial (WAI-ARIA slider pattern). Null = key not handled. */
export function yawFromKey(key: string, currentDeg: number, large: boolean): number | null {
  const step = large ? 10 : 1;
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': return normalizeDeg(currentDeg + step);
    case 'ArrowLeft': case 'ArrowDown': return normalizeDeg(currentDeg - step);
    case 'PageUp': return normalizeDeg(currentDeg + 10);
    case 'PageDown': return normalizeDeg(currentDeg - 10);
    case 'Home': return 0;
    case 'End': return 359;
    default: return null;
  }
}

/** Next unwrapped angle so a rotation animates the short way across 359° → 0°. */
export function unwrapAngle(previousUnwrapped: number, nextDeg: number): number {
  const delta = ((nextDeg - normalizeDeg(previousUnwrapped)) % 360 + 540) % 360 - 180;
  return previousUnwrapped + delta;
}

const pt = (cx: number, cy: number, r: number, azDeg: number) => {
  const a = azDeg * Math.PI / 180;
  return `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
};

/** Arc drawn clockwise (increasing azimuth) from one azimuth to another. */
export function arcPath(cx: number, cy: number, r: number, fromAzDeg: number, toAzDeg: number): string {
  const span = normalizeDeg(toAzDeg - fromAzDeg);
  return `M${pt(cx, cy, r, fromAzDeg)} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${pt(cx, cy, r, toAzDeg)}`;
}

/** Filled wedge from the centre, clockwise from one azimuth to another. */
export function sectorPath(cx: number, cy: number, r: number, fromAzDeg: number, toAzDeg: number): string {
  const span = normalizeDeg(toAzDeg - fromAzDeg);
  return `M${cx},${cy} L${pt(cx, cy, r, fromAzDeg)} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${pt(cx, cy, r, toAzDeg)} Z`;
}

/** Deterministic decorative star positions (unit disc), so renders and tests are stable. */
export function seededStars(count: number, seed = 7): { x: number; y: number; r: number; o: number }[] {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: count }, () => {
    const rad = Math.sqrt(rnd()), th = rnd() * 2 * Math.PI;
    return { x: rad * Math.cos(th), y: rad * Math.sin(th), r: 0.4 + rnd() * 1.1, o: 0.25 + rnd() * 0.6 };
  });
}

/** Snap to the nearest detent when within `withinDeg` degrees (knob feel). */
export function snapToDetent(deg: number, stepDeg: number, withinDeg: number): number {
  const nearest = Math.round(deg / stepDeg) * stepDeg;
  return Math.abs(nearest - deg) <= withinDeg ? normalizeDeg(nearest) : normalizeDeg(deg);
}

export const formatDeg = (deg: number | null | undefined, digits = 1): string =>
  typeof deg === 'number' && Number.isFinite(deg) ? `${deg.toFixed(digits)}°` : 'unknown';

/** Keeps the trailing Z so the UTC convention stays visible. */
export const formatUtc = (utc: string): string => utc.replace('T', ' ').replace(/:\d{2}(\.\d+)?Z$/, 'Z');
