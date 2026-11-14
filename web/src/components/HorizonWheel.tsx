import type { EphemerisSample, HorizonProfile } from '../contracts';
import { chooseElevationScale, formatDeg, polarPoint, type ElevationScale } from './geometry';

interface Props {
  sunHorizon: HorizonProfile; earthHorizon: HorizonProfile;
  sample: EphemerisSample | null; yawDeg: number; size?: number;
}

const C = 180, R = 150;

/** Polyline segments through known bins; null bins break the line (never drawn as 0°). */
function profilePaths(p: HorizonProfile, scale: ElevationScale): string[] {
  const n = p.anglesDeg.length;
  if (n === 0 || p.azimuthStepDeg <= 0) return [];
  const paths: string[] = []; let cur: string[] = [];
  for (let i = 0; i <= n; i++) {
    const angle = p.anglesDeg[i % n];
    if (angle === null || angle === undefined) { if (cur.length > 1) paths.push(cur.join(' ')); cur = []; continue; }
    const pt = polarPoint(i * p.azimuthStepDeg, angle, C, C, R, scale);
    cur.push(`${cur.length ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
  }
  if (cur.length > 1) paths.push(cur.join(' '));
  return paths;
}

function unknownWedges(p: HorizonProfile): string[] {
  const half = p.azimuthStepDeg / 2;
  return p.anglesDeg.flatMap((a, i) => {
    if (a !== null) return [];
    const az = i * p.azimuthStepDeg, rad = (d: number) => d * Math.PI / 180;
    const pt = (d: number, r: number) => `${(C + r * Math.sin(rad(d))).toFixed(1)},${(C - r * Math.cos(rad(d))).toFixed(1)}`;
    return [`M${pt(az - half, R)} A${R},${R} 0 0 1 ${pt(az + half, R)} L${pt(az + half, R - 14)} A${R - 14},${R - 14} 0 0 0 ${pt(az - half, R - 14)} Z`];
  });
}

/** 2D horizon wheel (top-down: north up, east right) with Sun, Earth and body heading. */
export function HorizonWheel({ sunHorizon, earthHorizon, sample, yawDeg, size = 360 }: Props) {
  const scale = chooseElevationScale([...sunHorizon.anglesDeg, ...earthHorizon.anglesDeg, sample?.sun?.elDeg, sample?.earth?.elDeg]);
  const rings: number[] = [];
  for (let el = scale.minElDeg; el < scale.maxElDeg; el += 5) rings.push(el);
  const sun = sample?.sun ? polarPoint(sample.sun.azDeg, sample.sun.elDeg, C, C, R, scale) : null;
  const earth = sample?.earth ? polarPoint(sample.earth.azDeg, sample.earth.elDeg, C, C, R, scale) : null;
  const head = polarPoint(yawDeg, scale.minElDeg, C, C, R, scale);
  const desc = `Sun azimuth ${formatDeg(sample?.sun?.azDeg)}, elevation ${formatDeg(sample?.sun?.elDeg)}. ` +
    `Earth azimuth ${formatDeg(sample?.earth?.azDeg)}, elevation ${formatDeg(sample?.earth?.elDeg)}. Body heading ${yawDeg}°.`;
  const gaps = [...new Set([...unknownWedges(sunHorizon), ...unknownWedges(earthHorizon)])];

  return (
    <figure className="lp-wheel">
      <svg viewBox="0 0 360 360" width={size} height={size} role="img" aria-labelledby="lp-wheel-t lp-wheel-d">
        <title id="lp-wheel-t">Horizon wheel</title>
        <desc id="lp-wheel-d">{desc}</desc>
        {rings.map(el => {
          const r = R * (scale.maxElDeg - el) / (scale.maxElDeg - scale.minElDeg);
          return <g key={el}><circle cx={C} cy={C} r={r} className={el === 0 ? 'lp-ring lp-ring-zero' : 'lp-ring'} />
            <text x={C + 3} y={C - r + 11} className="lp-ring-label">{el}°</text></g>;
        })}
        {gaps.map((d, i) => <path key={i} d={d} className="lp-unknown-bin" />)}
        {profilePaths(sunHorizon, scale).map((d, i) => <path key={`s${i}`} d={d} className="lp-horizon-sun" />)}
        {profilePaths(earthHorizon, scale).map((d, i) => <path key={`e${i}`} d={d} className="lp-horizon-earth" />)}
        <line x1={C} y1={C} x2={head.x} y2={head.y} className="lp-heading" />
        {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([l, az]) => {
          const p = polarPoint(Number(az), scale.minElDeg, C, C, R + 16, scale);
          return <text key={l} x={p.x} y={p.y + 5} className="lp-compass">{l}</text>;
        })}
        {sun && <g><circle cx={sun.x} cy={sun.y} r={8} className="lp-sun" /><text x={sun.x + 11} y={sun.y + 4} className="lp-marker-label">Sun</text></g>}
        {earth && <g><circle cx={earth.x} cy={earth.y} r={7} className="lp-earth" /><text x={earth.x + 10} y={earth.y + 4} className="lp-marker-label">Earth</text></g>}
      </svg>
      <figcaption>
        <ul className="lp-legend">
          <li><span className="lp-key lp-key-sun" />Sun {sample?.sun ? `az ${formatDeg(sample.sun.azDeg)}, el ${formatDeg(sample.sun.elDeg)}` : 'unknown for this sample'}</li>
          <li><span className="lp-key lp-key-earth" />Earth {sample?.earth ? `az ${formatDeg(sample.earth.azDeg)}, el ${formatDeg(sample.earth.elDeg)}` : 'unknown for this sample'}</li>
          <li><span className="lp-key lp-key-hs" />Horizon at panel height ({sunHorizon.observerHeightM} m)</li>
          <li><span className="lp-key lp-key-he" />Horizon at antenna height ({earthHorizon.observerHeightM} m)</li>
          <li><span className="lp-key lp-key-head" />Body forward {yawDeg}°</li>
          {gaps.length > 0 && <li><span className="lp-key lp-key-gap" />Unknown horizon bins (no data, not clear sky)</li>}
        </ul>
        <p className="lp-hint">Top-down view, north up, east right. Rim {scale.minElDeg}°, centre {scale.maxElDeg}° elevation.</p>
      </figcaption>
    </figure>
  );
}
