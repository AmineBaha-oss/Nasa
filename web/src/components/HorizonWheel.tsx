import { memo, useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { EphemerisSample, HardwareConfig, HorizonProfile } from '../contracts';
import {
  arcPath, bodyVectorAzimuthDeg, chooseElevationScale, formatDeg, normalizeDeg, polarPoint, sectorPath, seededStars,
  unwrapAngle, yawFromKey, yawFromPointer, type ElevationScale,
} from './geometry';
import { useUnwrappedAngle } from './useUnwrappedAngle';

interface Props {
  sunHorizon: HorizonProfile; earthHorizon: HorizonProfile;
  sample: EphemerisSample | null; yawDeg: number;
  /** Draws antenna beam and panel normals (body-fixed geometry from the preset). */
  hardware?: HardwareConfig | null;
  /** When given, the dial is a slider: drag, tap or arrow keys set the body heading. */
  onYawChange?: (deg: number) => void;
  /** Animate the needle to the new heading. Off for drag/keyboard input, on for discrete steps. */
  animateTurn?: boolean;
  /** Plays the one-time stroke-drawing entrance. */
  intro?: boolean;
  /** Decorative copy (hero): no legend, no interaction. */
  decorative?: boolean;
}

const VB = 520, C = 260, R = 196;
const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const STARS = seededStars(140);
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

/** Terrain silhouette between rim and horizon line, only where both bins are known (null never becomes 0°). */
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

/** Three-level bearing scale: 1°, 5°, 10°; mono labels every 30°, cardinals at N/E/S/W. */
function ticks() {
  const out = [];
  for (let az = 0; az < 360; az += 1) {
    const level = az % 10 === 0 ? 3 : az % 5 === 0 ? 2 : 1;
    const a = az * Math.PI / 180, r1 = R + 3, r2 = R + (level === 3 ? 15 : level === 2 ? 9 : 5);
    out.push(<line key={az} className={`lp-tick lp-tick-${level}`}
      x1={(C + r1 * Math.sin(a)).toFixed(2)} y1={(C - r1 * Math.cos(a)).toFixed(2)} x2={(C + r2 * Math.sin(a)).toFixed(2)} y2={(C - r2 * Math.cos(a)).toFixed(2)} />);
    if (az % 30 === 0) {
      const cardinal = az === 0 ? 'N' : az === 90 ? 'E' : az === 180 ? 'S' : az === 270 ? 'W' : null;
      out.push(<text key={`l${az}`} className={cardinal ? 'lp-cardinal' : 'lp-bearing'}
        x={C + (R + 32) * Math.sin(a)} y={C - (R + 32) * Math.cos(a) + 5}>{cardinal ?? String(az).padStart(3, '0')}</text>);
    }
  }
  return out;
}

interface FaceProps { ids: string; sunHorizon: HorizonProfile; earthHorizon: HorizonProfile; sample: EphemerisSample | null; interactive: boolean; }

/** Everything that does not depend on the heading. Memoised: turning never re-renders or repaints it. */
const DialFace = memo(function DialFace({ ids, sunHorizon, earthHorizon, sample, interactive }: FaceProps) {
  const scale = chooseElevationScale([...sunHorizon.anglesDeg, ...earthHorizon.anglesDeg, sample?.sun?.elDeg, sample?.earth?.elDeg]);
  const rings: number[] = [];
  for (let el = scale.minElDeg + 5; el < scale.maxElDeg; el += 5) rings.push(el);
  const sun = sample?.sun ? polarPoint(sample.sun.azDeg, sample.sun.elDeg, C, C, R, scale) : null;
  const earth = sample?.earth ? polarPoint(sample.earth.azDeg, sample.earth.elDeg, C, C, R, scale) : null;
  const gaps = [...new Set([...unknownWedges(sunHorizon), ...unknownWedges(earthHorizon)])];
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="lp-dial-face" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${ids}-sky`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#0d1a2b" stopOpacity=".35" /><stop offset="1" stopColor="#05070b" stopOpacity=".75" /></radialGradient>
        <linearGradient id={`${ids}-rego`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a8578" /><stop offset="1" stopColor="#4a463e" /></linearGradient>
        <pattern id={`${ids}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="#9aa1ab" /></pattern>
        <clipPath id={`${ids}-earth`}><circle r={8} /></clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={`url(#${ids}-sky)`} />
      {rings.map(el => {
        const r = R * (scale.maxElDeg - el) / (scale.maxElDeg - scale.minElDeg);
        return <g key={el}><circle cx={C} cy={C} r={r} pathLength={1} className={el === 0 ? 'lp-ring lp-ring-zero lp-draw' : 'lp-ring lp-draw'} />
          <text x={C + 4} y={C - r - 4} className="lp-ring-label">{el > 0 ? `+${el}` : el}°</text></g>;
      })}
      <path d={terrainPath(sunHorizon, scale)} fill={`url(#${ids}-rego)`} className="lp-terrain" />
      {gaps.map((d, i) => <path key={i} d={d} fill={`url(#${ids}-hatch)`} className="lp-unknown-bin" />)}
      {profilePaths(sunHorizon, scale).map((d, i) => <path key={`s${i}`} d={d} pathLength={1} className="lp-horizon-sun lp-draw" />)}
      {profilePaths(earthHorizon, scale).map((d, i) => <path key={`e${i}`} d={d} className="lp-horizon-earth" />)}
      <circle cx={C} cy={C} r={R} pathLength={1} className="lp-rim lp-draw" />
      <g className="lp-ticks">{ticks()}</g>
      {sun && <g transform={`translate(${sun.x.toFixed(1)} ${sun.y.toFixed(1)})`}>
        <circle r={9} className="lp-sun" />
        <text x={16} y={-12} className="lp-marker-label">SUN {formatDeg(sample!.sun!.elDeg)}</text></g>}
      {earth && <g transform={`translate(${earth.x.toFixed(1)} ${earth.y.toFixed(1)})`}>
        <circle r={12} className="lp-earth-halo" />
        <circle r={8} className="lp-earth" />
        {/* Illustrative half phase: not computed from Sun–Earth geometry. */}
        <g clipPath={`url(#${ids}-earth)`}><ellipse cx={4} cy={0} rx={6} ry={9} className="lp-earth-night" /></g>
        <text x={16} y={-10} className="lp-marker-label">EARTH {formatDeg(sample!.earth!.elDeg)}</text></g>}
      {interactive && <path className="lp-turn-ring" fillRule="evenodd"
        d={`M${C - R - 50},${C} a${R + 50},${R + 50} 0 1 0 ${2 * (R + 50)},0 a${R + 50},${R + 50} 0 1 0 ${-2 * (R + 50)},0 Z M${C - R * 0.55},${C} a${R * 0.55},${R * 0.55} 0 1 0 ${R * 1.1},0 a${R * 0.55},${R * 0.55} 0 1 0 ${-R * 1.1},0 Z`} />}
    </svg>
  );
});

/** Stars behind the dial; their layer turns opposite to the heading (decorative). */
const StarField = memo(function StarField() {
  return (
    <svg viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
      {STARS.map((s, i) => <circle key={i} cx={s.x.toFixed(3)} cy={s.y.toFixed(3)} r={(s.r / 260).toFixed(4)} opacity={s.o.toFixed(2)} fill="#e8edf7" />)}
    </svg>
  );
});

/** Heading-dependent overlay, drawn in the body frame and rotated by yaw as one composited layer. */
const BodyOverlay = memo(function BodyOverlay({ hardware, grip }: { hardware: HardwareConfig | null; grip: boolean }) {
  const antAz = hardware ? bodyVectorAzimuthDeg(hardware.antenna.boresightBodyRFU) : null;
  const half = hardware?.antenna.beamHalfAngleDeg ?? 0;
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} focusable="false">
      {antAz !== null && half > 0 && half < 180 && <path d={sectorPath(C, C, R - 2, antAz - half, antAz + half)} className="lp-beam" />}
      {hardware?.panels.map(p => {
        const az = bodyVectorAzimuthDeg(p.normalBodyRFU);
        return az === null ? null : <path key={p.name} d={arcPath(C, C, R - 7, az - 12, az + 12)} className="lp-panel-arc" />;
      })}
      <line x1={C} y1={C} x2={C} y2={C - R + 2} className="lp-needle-line" />
      <path d={`M${C} ${C - R - 2} l-9 -16 h18 z`} className="lp-needle-tip" />
      {grip && <circle cx={C} cy={C - R - 26} r={11} className="lp-needle-grip" />}
      <circle cx={C} cy={C} r={5} className="lp-hub" />
    </svg>
  );
});

/**
 * Horizon dial (top-down: north up, east right, azimuth clockwise). Terrain horizon at panel height
 * (filled silhouette), antenna-height horizon (dashed), Sun, Earth, body heading, antenna beam and
 * panel normals. Layers that move (needle, stars, halo, crosshair) are separate composited elements.
 */
export function HorizonWheel({ sunHorizon, earthHorizon, sample, yawDeg, hardware = null, onYawChange, animateTurn = false, intro = false, decorative = false }: Props) {
  const ids = useId().replace(/:/g, '');
  const stageRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const pending = useRef<number | null>(null);
  const frame = useRef(0);
  const inertia = useRef(0);
  const trail = useRef<{ deg: number; t: number }[]>([]);
  const emitted = useRef<number | null>(null);
  const needleDeg = useUnwrappedAngle(yawDeg);
  const stopMotion = () => { cancelAnimationFrame(inertia.current); cancelAnimationFrame(frame.current); inertia.current = 0; frame.current = 0; pending.current = null; };
  useEffect(() => () => stopMotion(), []);
  // Any heading change that did not come from this dial (keys, knob, buttons) stops a running inertia.
  useEffect(() => { if (emitted.current !== null && yawDeg !== emitted.current) stopMotion(); }, [yawDeg]);

  const scale = chooseElevationScale([...sunHorizon.anglesDeg, ...earthHorizon.anglesDeg, sample?.sun?.elDeg, sample?.earth?.elDeg]);
  const sun = sample?.sun ? polarPoint(sample.sun.azDeg, sample.sun.elDeg, C, C, R, scale) : null;
  const gaps = sunHorizon.anglesDeg.some(a => a === null) || earthHorizon.anglesDeg.some(a => a === null);
  const desc = `Sun azimuth ${formatDeg(sample?.sun?.azDeg)}, elevation ${formatDeg(sample?.sun?.elDeg)}. ` +
    `Earth azimuth ${formatDeg(sample?.earth?.azDeg)}, elevation ${formatDeg(sample?.earth?.elDeg)}.`;

  /** Same-frame visual update of every heading-driven layer, then one coalesced React update. */
  const applyHeading = (deg: number) => {
    needleDeg.current = unwrapAngle(needleDeg.current, deg);
    if (needleRef.current) { needleRef.current.classList.remove('is-animated'); needleRef.current.style.transform = `rotate(${needleDeg.current}deg)`; }
    if (starsRef.current) { starsRef.current.classList.remove('is-animated'); starsRef.current.style.transform = `rotate(${-needleDeg.current}deg)`; }
    pending.current = Math.round(normalizeDeg(deg));
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current !== null && onYawChange) { emitted.current = pending.current; onYawChange(pending.current); }
    });
  };
  const pointerDeg = (e: PointerEvent<HTMLDivElement>) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return null;
    return yawFromPointer((e.clientX - box.left) / box.width * VB - C, (e.clientY - box.top) / box.height * VB - C);
  };
  const showCrosshair = (e: PointerEvent<HTMLDivElement>, deg: number | null) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!hoverRef.current || !readoutRef.current || !box || deg === null) return;
    hoverRef.current.style.opacity = '1';
    (hoverRef.current.firstElementChild as HTMLElement).style.transform = `rotate(${deg}deg)`;
    readoutRef.current.textContent = `AZ ${String(deg).padStart(3, '0')}°`;
    readoutRef.current.style.transform = `translate(${e.clientX - box.left + 14}px, ${e.clientY - box.top + 14}px)`;
  };

  const interactive = onYawChange ? {
    tabIndex: 0, role: 'slider', 'aria-label': 'Body heading dial', 'aria-valuemin': 0, 'aria-valuemax': 359,
    'aria-valuenow': yawDeg, 'aria-valuetext': `${yawDeg}° clockwise from north`,
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      // Touch: only the outer ring turns the lander, so a finger on the centre still scrolls the page.
      if (e.pointerType === 'touch' && !(e.target as Element).classList.contains('lp-turn-ring')) return;
      stopMotion();
      dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId);
      const deg = pointerDeg(e);
      if (deg !== null) { trail.current = [{ deg: unwrapAngle(needleDeg.current, deg), t: e.timeStamp }]; applyHeading(deg); }
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const deg = pointerDeg(e);
      if (e.pointerType === 'mouse') showCrosshair(e, deg);
      if (!dragging.current || deg === null) return;
      trail.current = [...trail.current.slice(-4), { deg: unwrapAngle(needleDeg.current, deg), t: e.timeStamp }];
      applyHeading(deg);
    },
    onPointerUp: () => {
      dragging.current = false;
      // Inertia: carry the release velocity, decay, settle. Skipped with reduced motion.
      const t = trail.current; trail.current = [];
      if (t.length < 2 || reducedMotion()) return;
      const a = t[0], b = t[t.length - 1], dt = b.t - a.t;
      if (dt <= 0 || dt > 120) return;
      // Gentle carry: speed capped at 0.2°/ms with strong friction, so a flick overshoots ~20° at most.
      let v = Math.max(-0.2, Math.min(0.2, (b.deg - a.deg) / dt)); // deg per ms
      let pos = b.deg, last = performance.now();
      const step = (now: number) => {
        const ms = Math.min(32, now - last); last = now;
        v *= Math.pow(0.85, ms / 16.7); pos += v * ms;
        applyHeading(normalizeDeg(pos));
        if (Math.abs(v) > 0.004) inertia.current = requestAnimationFrame(step);
      };
      if (Math.abs(v) > 0.03) inertia.current = requestAnimationFrame(step);
    },
    onPointerCancel: () => { dragging.current = false; trail.current = []; },
    onPointerLeave: () => { if (hoverRef.current) hoverRef.current.style.opacity = '0'; },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const next = yawFromKey(e.key, yawDeg, e.shiftKey);
      if (next !== null) { e.preventDefault(); stopMotion(); onYawChange!(Math.round(next)); }
    },
  } : decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Horizon dial' };

  const stageClass = ['lp-dial-stage', onYawChange && 'is-interactive', intro && 'is-intro', decorative && 'is-decorative'].filter(Boolean).join(' ');
  return (
    <figure className={decorative ? 'lp-dial lp-dial-hero' : 'lp-dial'}>
      <div ref={stageRef} className={stageClass} aria-describedby={decorative ? undefined : `${ids}-d`} {...interactive}>
        {!decorative && <span id={`${ids}-d`} className="lp-visually-hidden">{desc}</span>}
        <div ref={starsRef} className={animateTurn ? 'lp-stars is-animated' : 'lp-stars'} style={{ transform: `rotate(${-needleDeg.current}deg)` }} aria-hidden="true"><StarField /></div>
        <DialFace ids={ids} sunHorizon={sunHorizon} earthHorizon={earthHorizon} sample={sample} interactive={!!onYawChange} />
        {sun && <div className="lp-sun-halo" style={{ left: `${(sun.x / VB) * 100}%`, top: `${(sun.y / VB) * 100}%` }} aria-hidden="true"><span /></div>}
        <div ref={needleRef} className={animateTurn ? 'lp-needle-layer is-animated' : 'lp-needle-layer'}
          style={{ transform: `rotate(${needleDeg.current}deg)` }} aria-hidden="true">
          <BodyOverlay hardware={hardware} grip={!!onYawChange} />
        </div>
        {onYawChange && <div ref={hoverRef} className="lp-crosshair" aria-hidden="true"><span className="lp-crosshair-line" /><span ref={readoutRef} className="lp-crosshair-readout" /></div>}
      </div>
      {!decorative && <figcaption>
        <ul className="lp-legend lp-legend-compact">
          <li><span className="lp-key lp-key-sun" />Sun {sample?.sun ? `${formatDeg(sample.sun.azDeg)} / ${formatDeg(sample.sun.elDeg)}` : 'unknown'}</li>
          <li><span className="lp-key lp-key-earth" />Earth {sample?.earth ? `${formatDeg(sample.earth.azDeg)} / ${formatDeg(sample.earth.elDeg)}` : 'unknown'} · phase drawn is illustrative</li>
          <li><span className="lp-key lp-key-head" />Heading {yawDeg}°</li>
          {hardware && <li><span className="lp-key lp-key-beam" />Beam ±{hardware.antenna.beamHalfAngleDeg}° · not a link check</li>}
          {gaps && <li><span className="lp-key lp-key-gap" />Unknown horizon bins</li>}
        </ul>
        <details className="lp-more">
          <summary>Dial notes</summary>
          <ul className="lp-legend">
            <li><span className="lp-key lp-key-hs" />Panel horizon: {sunHorizon.horizonCoverage === 'far-field-validated' ? `far-field validated (${sunHorizon.extentKm} km, observer ${sunHorizon.observerHeightM} m)` : sunHorizon.horizonCoverage === 'local-only' ? `local terrain only (${sunHorizon.extentKm} km, observer ${sunHorizon.observerHeightM} m)` : `missing (observer ${sunHorizon.observerHeightM} m)`}</li>
            <li><span className="lp-key lp-key-he" />Antenna horizon: {earthHorizon.horizonCoverage === 'far-field-validated' ? `far-field validated (${earthHorizon.extentKm} km, observer ${earthHorizon.observerHeightM} m)` : earthHorizon.horizonCoverage === 'local-only' ? `local terrain only (${earthHorizon.extentKm} km, observer ${earthHorizon.observerHeightM} m)` : `missing (observer ${earthHorizon.observerHeightM} m)`}</li>
            {hardware && <li><span className="lp-key lp-key-panel" />Panel normals (body-fixed)</li>}
            <li>North up, east right. Rim {scale.minElDeg}°, centre {scale.maxElDeg > 0 ? '+' : ''}{scale.maxElDeg}° elevation.</li>
          </ul>
        </details>
      </figcaption>}
    </figure>
  );
}
