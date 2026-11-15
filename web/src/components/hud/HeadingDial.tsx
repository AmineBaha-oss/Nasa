import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface Props {
  /** Clockwise from north. */
  yawDeg: number;
  sunAzDeg: number | null;
  earthAzDeg: number | null;
  onYaw: (deg: number) => void;
  onNudge: (delta: number) => void;
}

const R = 50;
const at = (azDeg: number, r: number) => {
  const a = (azDeg * Math.PI) / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
};

/** Compass dial: drag to set the lander heading, arrows to nudge. Shows where the Sun and Earth are now. */
export function HeadingDial({ yawDeg, sunAzDeg, earthAzDeg, onYaw, onNudge }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const az = (Math.atan2(e.clientX - (box.left + box.width / 2), -(e.clientY - (box.top + box.height / 2))) * 180) / Math.PI;
    onYaw(e.shiftKey ? Math.round(az / 15) * 15 : Math.round(az));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 15 : 1;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 15, PageDown: -15 }[e.key];
    if (delta !== undefined) onNudge(delta);
    else if (e.key === 'Home') onYaw(0);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const sun = sunAzDeg === null ? null : at(sunAzDeg, R);
  const earth = earthAzDeg === null ? null : at(earthAzDeg, R);
  return (
    <svg ref={svg} className="lp3-dial" viewBox="-62 -62 124 124" role="slider" tabIndex={0}
      aria-label="Lander heading" aria-valuemin={0} aria-valuemax={359} aria-valuenow={yawDeg} aria-valuetext={`${yawDeg}° clockwise from north`}
      onKeyDown={onKey}
      onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
      onPointerMove={e => { if (dragging.current) fromPointer(e); }}
      onPointerUp={e => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { dragging.current = false; }}>
      <circle r={R + 8} className="lp3-dial-face" />
      <circle r={R} className="lp3-dial-ring" />
      {ticks.map(t => {
        const a = at(t, R), b = at(t, R - (t % 90 === 0 ? 8 : 4));
        return <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={t % 90 === 0 ? 'lp3-dial-tick is-major' : 'lp3-dial-tick'} />;
      })}
      {(['N', 'E', 'S', 'W'] as const).map((c, i) => {
        const p = at(i * 90, R - 16);
        return <text key={c} x={p.x} y={p.y} className={c === 'N' ? 'lp3-dial-card is-north' : 'lp3-dial-card'} dominantBaseline="central" textAnchor="middle">{c}</text>;
      })}
      <g transform={`rotate(${yawDeg})`} className="lp3-dial-lander">
        <polygon points="-9,-4 -4,-9 4,-9 9,-4 9,4 4,9 -4,9 -9,4" />
        <path d="M0 -36 L7 -22 L2 -22 L2 -11 L-2 -11 L-2 -22 L-7 -22 Z" className="lp3-dial-arrow" />
      </g>
      {sun && <g className="lp3-dial-sun"><title>{`Sun azimuth ${Math.round(sunAzDeg ?? 0)}°`}</title><circle cx={sun.x} cy={sun.y} r={5.5} /></g>}
      {earth && <g className="lp3-dial-earth"><title>{`Earth azimuth ${Math.round(earthAzDeg ?? 0)}°`}</title><circle cx={earth.x} cy={earth.y} r={4.5} /></g>}
    </svg>
  );
}
