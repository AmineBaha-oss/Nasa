import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { EphemerisSample, HorizonProfile } from '../contracts';
import { chooseElevationScale, formatDeg, polarPoint, yawFromKey, yawFromPointer, type ElevationScale } from './geometry';
import { useUnwrappedAngle } from './useUnwrappedAngle';

interface Props {
  sunHorizon: HorizonProfile; earthHorizon: HorizonProfile;
  sample: EphemerisSample | null; yawDeg: number;
  /** When given, the dial is a slider: drag, tap or arrow keys set the body heading. */
  onYawChange?: (deg: number) => void;
  /** Animate the needle to the new heading. Off for drag/keyboard input, on for discrete steps. */
  animateTurn?: boolean;
}

const VB = 520, C = 260, R = 196;
const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** Polyline segments through known bins; null bins break the line (never drawn as 0°). */
function profilePaths(p: HorizonProfile, scale: ElevationScale): string[] {
  const n = p.anglesDeg.length;
  if (n === 0 || p.azimuthStepDeg <= 0) return [];
  const paths: string[] = []; let cur: string[] = [];
  for (let i = 0; i <= n; i++) {
    const angle = p.anglesDeg[i % n];
    if (angle === null || angle === undefined) { if (cur.length > 1) paths.push(cur.join(' ')); cur = []; continue; }
    cur.push(`${cur.length ? 'L' : 'M'}${fmt(polarPoint(i * p.azimuthStepDeg, angle, C, C, R, scale))}`);
  }
  if (cur.length > 1) paths.push(cur.join(' '));
  return paths;
}

/** Terrain silhouette: the band between the rim and the horizon line, only where both bins are known. */
function terrainPath(p: HorizonProfile, scale: ElevationScale): string {
  const n = p.anglesDeg.length, step = p.azimuthStepDeg;
  if (n === 0 || step <= 0) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = p.anglesDeg[i], b = p.anglesDeg[(i + 1) % n];
    if (a === null || b === null) continue;
    const az0 = i * step, az1 = (i + 1) * step;
    const r0 = polarPoint(az0, scale.minElDeg, C, C, R, scale), r1 = polarPoint(az1, scale.minElDeg, C, C, R, scale);
    d += `M${fmt(polarPoint(az0, a, C, C, R, scale))} L${fmt(polarPoint(az1, b, C, C, R, scale))} L${fmt(r1)} A${R},${R} 0 0 0 ${fmt(r0)} Z `;
  }
  return d.trim();
}

function unknownWedges(p: HorizonProfile): string[] {
  const half = p.azimuthStepDeg / 2, rad = (d: number) => d * Math.PI / 180;
  const pt = (d: number, r: number) => `${(C + r * Math.sin(rad(d))).toFixed(1)},${(C - r * Math.cos(rad(d))).toFixed(1)}`;
  return p.anglesDeg.flatMap((a, i) => {
    if (a !== null) return [];
    const az = i * p.azimuthStepDeg, inner = R - 18;
    return [`M${pt(az - half, R)} A${R},${R} 0 0 1 ${pt(az + half, R)} L${pt(az + half, inner)} A${inner},${inner} 0 0 0 ${pt(az - half, inner)} Z`];
  });
}

/** Bearing ring: a tick every 5°, longer every 30°, labelled every 30°. */
function ticks() {
  const out = [];
  for (let az = 0; az < 360; az += 5) {
    const major = az % 30 === 0, a = az * Math.PI / 180, r1 = R + 4, r2 = R + (major ? 16 : 9);
    out.push(<line key={az} className={major ? 'lp-tick lp-tick-major' : 'lp-tick'}
      x1={C + r1 * Math.sin(a)} y1={C - r1 * Math.cos(a)} x2={C + r2 * Math.sin(a)} y2={C - r2 * Math.cos(a)} />);
    if (major) {
      const label = az === 0 ? 'N' : az === 90 ? 'E' : az === 180 ? 'S' : az === 270 ? 'W' : String(az);
      out.push(<text key={`l${az}`} className={label.length === 1 ? 'lp-bearing lp-cardinal' : 'lp-bearing'}
        x={C + (R + 32) * Math.sin(a)} y={C - (R + 32) * Math.cos(a) + 5}>{label}</text>);
    }
  }
  return out;
}

/**
 * Horizon dial (top-down: north up, east right, azimuth clockwise). Shows the terrain horizon at
 * panel height (filled) and antenna height (dashed), the Sun, the Earth and the body heading.
 */
export function HorizonWheel({ sunHorizon, earthHorizon, sample, yawDeg, onYawChange, animateTurn = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const pending = useRef<number | null>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const needleDeg = useUnwrappedAngle(yawDeg);
  const scale = chooseElevationScale([...sunHorizon.anglesDeg, ...earthHorizon.anglesDeg, sample?.sun?.elDeg, sample?.earth?.elDeg]);
  const rings: number[] = [];
  for (let el = scale.minElDeg + 5; el < scale.maxElDeg; el += 5) rings.push(el);
  const sun = sample?.sun ? polarPoint(sample.sun.azDeg, sample.sun.elDeg, C, C, R, scale) : null;
  const earth = sample?.earth ? polarPoint(sample.earth.azDeg, sample.earth.elDeg, C, C, R, scale) : null;
  const gaps = [...new Set([...unknownWedges(sunHorizon), ...unknownWedges(earthHorizon)])];
  const desc = `Sun azimuth ${formatDeg(sample?.sun?.azDeg)}, elevation ${formatDeg(sample?.sun?.elDeg)}. ` +
    `Earth azimuth ${formatDeg(sample?.earth?.azDeg)}, elevation ${formatDeg(sample?.earth?.elDeg)}. Body heading ${yawDeg}°.`;

  const setFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !onYawChange) return;
    const yaw = yawFromPointer((e.clientX - box.left) / box.width * VB - C, (e.clientY - box.top) / box.height * VB - C);
    if (yaw === null) return;
    // Coalesce pointer events to one React update per frame; pointermove can fire faster than the display.
    pending.current = yaw;
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current !== null) onYawChange(pending.current);
    });
  };
  const interactive = onYawChange ? {
    tabIndex: 0, role: 'slider', 'aria-label': 'Body heading dial', 'aria-valuemin': 0, 'aria-valuemax': 359,
    'aria-valuenow': yawDeg, 'aria-valuetext': `${yawDeg}° clockwise from north`,
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      // Touch: only the outer ring turns the lander, so a finger on the dial's centre still scrolls the page.
      if (e.pointerType === 'touch' && !(e.target as Element).classList.contains('lp-turn-ring')) return;
      dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e);
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => { if (dragging.current) setFromPointer(e); },
    onPointerUp: () => { dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; },
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      const next = yawFromKey(e.key, yawDeg, e.shiftKey);
      if (next !== null) { e.preventDefault(); onYawChange!(Math.round(next)); }
    },
  } : { role: 'img' };

  return (
    <figure className="lp-dial">
      <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} className={onYawChange ? 'lp-dial-svg is-interactive' : 'lp-dial-svg'}
        aria-describedby="lp-dial-d" {...interactive}>
        <desc id="lp-dial-d">{desc}</desc>
        <defs>
          <radialGradient id="lp-sun-glow"><stop offset="0" stopColor="#ffd77a" stopOpacity=".9" /><stop offset="1" stopColor="#ffd77a" stopOpacity="0" /></radialGradient>
          <radialGradient id="lp-sky" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#2a3442" /><stop offset="1" stopColor="#1d242e" /></radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill="url(#lp-sky)" className="lp-sky" />
        {rings.map(el => {
          const r = R * (scale.maxElDeg - el) / (scale.maxElDeg - scale.minElDeg);
          return <g key={el}><circle cx={C} cy={C} r={r} className={el === 0 ? 'lp-ring lp-ring-zero' : 'lp-ring'} />
            <text x={C + 4} y={C - r - 4} className="lp-ring-label">{el > 0 ? `+${el}` : el}°</text></g>;
        })}
        <path d={terrainPath(sunHorizon, scale)} className="lp-terrain" />
        {gaps.map((d, i) => <path key={i} d={d} className="lp-unknown-bin" />)}
        {profilePaths(sunHorizon, scale).map((d, i) => <path key={`s${i}`} d={d} className="lp-horizon-sun" pathLength={1} />)}
        {profilePaths(earthHorizon, scale).map((d, i) => <path key={`e${i}`} d={d} className="lp-horizon-earth" />)}
        <circle cx={C} cy={C} r={R} className="lp-rim" />
        {ticks()}
        <g className={animateTurn ? 'lp-needle is-animated' : 'lp-needle'} style={{ transform: `rotate(${needleDeg}deg)` }}>
          <line x1={C} y1={C} x2={C} y2={C - R + 2} className="lp-needle-line" />
          <path d={`M${C} ${C - R - 2} l-9 -16 h18 z`} className="lp-needle-tip" />
          {onYawChange && <circle cx={C} cy={C - R - 26} r={11} className="lp-needle-grip" />}
        </g>
        <circle cx={C} cy={C} r={5} className="lp-hub" />
        {onYawChange && <path className="lp-turn-ring" fillRule="evenodd" aria-hidden="true"
          d={`M${C - R - 50},${C} a${R + 50},${R + 50} 0 1 0 ${2 * (R + 50)},0 a${R + 50},${R + 50} 0 1 0 ${-2 * (R + 50)},0 Z M${C - R * 0.55},${C} a${R * 0.55},${R * 0.55} 0 1 0 ${R * 1.1},0 a${R * 0.55},${R * 0.55} 0 1 0 ${-R * 1.1},0 Z`} />}
        {sun && <g className="lp-body-marker" style={{ transform: `translate(${sun.x}px, ${sun.y}px)` }}>
          <circle r={26} fill="url(#lp-sun-glow)" /><circle r={9} className="lp-sun" />
          <text x={14} y={-12} className="lp-marker-label">Sun {formatDeg(sample!.sun!.elDeg)}</text></g>}
        {earth && <g className="lp-body-marker" style={{ transform: `translate(${earth.x}px, ${earth.y}px)` }}>
          <circle r={8} className="lp-earth" /><circle r={12} className="lp-earth-halo" />
          <text x={15} y={-10} className="lp-marker-label">Earth {formatDeg(sample!.earth!.elDeg)}</text></g>}
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
        <p className="lp-hint">Seen from above: north up, east right. Rim {scale.minElDeg}°, centre {scale.maxElDeg > 0 ? '+' : ''}{scale.maxElDeg}° elevation.
          {onYawChange ? ' Drag the dial or use the arrow keys to turn the lander.' : ''}</p>
      </figcaption>
    </figure>
  );
}
