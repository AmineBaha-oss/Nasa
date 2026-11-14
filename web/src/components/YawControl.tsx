import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { normalizeDeg, snapToDetent, unwrapAngle, yawFromKey, yawFromPointer } from './geometry';
import { Odometer } from './Odometer';
import { useUnwrappedAngle } from './useUnwrappedAngle';

interface Props {
  valueDeg: number;
  /** animate=false for continuous or keyboard input (knob drag, number field, keys); true for discrete step buttons. */
  onChange: (deg: number, animate: boolean) => void;
  animate?: boolean;
}

const NOTCHES = Array.from({ length: 24 }, (_, i) => i * 15);

/** Heading knob with a detent every 15°. Snaps when released within 3° of a detent. */
function HeadingKnob({ valueDeg, onChange, animate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const turning = useRef(false);
  const angle = useUnwrappedAngle(valueDeg);
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    return yawFromPointer(e.clientX - box.left - box.width / 2, e.clientY - box.top - box.height / 2);
  };
  const apply = (deg: number) => {
    angle.current = unwrapAngle(angle.current, deg);
    if (capRef.current) { capRef.current.classList.remove('is-animated'); capRef.current.style.transform = `rotate(${angle.current}deg)`; }
    onChange(deg, false);
  };
  return (
    <div ref={ref} className="lp-knob" role="slider" tabIndex={0} aria-label="Heading knob" aria-valuemin={0} aria-valuemax={359}
      aria-valuenow={valueDeg} aria-valuetext={`${valueDeg}° clockwise from north`}
      onPointerDown={e => { turning.current = true; e.currentTarget.setPointerCapture(e.pointerId); const d = fromPointer(e); if (d !== null) apply(snapToDetent(d, 15, 3)); }}
      onPointerMove={e => { if (!turning.current) return; const d = fromPointer(e); if (d !== null) apply(snapToDetent(d, 15, 3)); }}
      onPointerUp={() => { turning.current = false; }} onPointerCancel={() => { turning.current = false; }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { const n = yawFromKey(e.key, valueDeg, e.shiftKey); if (n !== null) { e.preventDefault(); onChange(Math.round(n), false); } }}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className="lp-knob-face">
        {NOTCHES.map(a => {
          const r = a % 90 === 0 ? 46 : 50, t = a * Math.PI / 180;
          return <line key={a} x1={60 + 56 * Math.sin(t)} y1={60 - 56 * Math.cos(t)} x2={60 + r * Math.sin(t)} y2={60 - r * Math.cos(t)} className={a % 90 === 0 ? 'lp-notch lp-notch-major' : 'lp-notch'} />;
        })}
      </svg>
      <div ref={capRef} className={animate ? 'lp-knob-cap is-animated' : 'lp-knob-cap'} style={{ transform: `rotate(${angle.current}deg)` }} aria-hidden="true"><span /></div>
    </div>
  );
}

/** Heading controls: knob, exact numeric entry, physical step keys, keyboard hints. */
export function YawControl({ valueDeg, onChange, animate = false }: Props) {
  const id = useId();
  const set = (deg: number, anim: boolean) => onChange(Math.round(normalizeDeg(deg)), anim);
  return (
    <fieldset className="lp-yaw">
      <legend>Body heading</legend>
      <div className="lp-yaw-body">
        <HeadingKnob valueDeg={valueDeg} onChange={set} animate={animate} />
        <div className="lp-yaw-entry">
          <Odometer text={`${String(valueDeg).padStart(3, '0')}°`} animate={animate} className="lp-yaw-readout" />
          <label htmlFor={`${id}-num`} className="lp-yaw-label">Exact heading</label>
          <div className="lp-yaw-row">
            <input id={`${id}-num`} type="number" min={0} max={359} step={1} value={valueDeg} inputMode="numeric"
              aria-describedby={`${id}-hint`} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v, false); }} />
            <span aria-hidden="true">°</span>
          </div>
        </div>
      </div>
      <div className="lp-yaw-steps">
        {[-10, -1, 1, 10].map(step => (
          <button key={step} type="button" className="lp-key-btn" onClick={() => set(valueDeg + step, true)}
            aria-label={`Turn ${Math.abs(step)}° ${step > 0 ? 'clockwise' : 'counter-clockwise'}`}>{step > 0 ? `+${step}` : `−${-step}`}°</button>
        ))}
      </div>
      <p className="lp-hint" id={`${id}-hint`}>
        Degrees clockwise from lunar north. On the dial or knob: <kbd>←</kbd> <kbd>→</kbd> ±1°, <kbd>Shift</kbd>+<kbd>→</kbd> ±10°, <kbd>Home</kbd> 0°.
      </p>
    </fieldset>
  );
}
