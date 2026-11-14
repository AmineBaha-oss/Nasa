import { useId } from 'react';
import { normalizeDeg } from './geometry';

interface Props {
  valueDeg: number;
  /** animate=false for continuous or keyboard input (slider, number field); true for discrete step buttons. */
  onChange: (deg: number, animate: boolean) => void;
}

/** 360° body-heading control: slider, exact numeric entry and step buttons (keyboard friendly). */
export function YawControl({ valueDeg, onChange }: Props) {
  const id = useId();
  const set = (deg: number, animate: boolean) => onChange(Math.round(normalizeDeg(deg)), animate);
  return (
    <fieldset className="lp-yaw">
      <legend>Body heading</legend>
      <p className="lp-hint" id={`${id}-hint`}>Degrees clockwise from lunar north. 0° points the lander's front north.</p>
      <div className="lp-yaw-row">
        <input type="range" min={0} max={359} step={1} value={valueDeg} aria-label="Body heading slider"
          aria-describedby={`${id}-hint`} onChange={e => set(Number(e.target.value), false)} />
        <label htmlFor={`${id}-num`} className="lp-visually-hidden">Body heading in degrees</label>
        <input id={`${id}-num`} type="number" min={0} max={359} step={1} value={valueDeg} inputMode="numeric"
          aria-describedby={`${id}-hint`} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v, false); }} />
        <span aria-hidden="true">°</span>
      </div>
      <div className="lp-yaw-steps">
        {[-10, -1, 1, 10].map(step => (
          <button key={step} type="button" onClick={() => set(valueDeg + step, true)}
            aria-label={`Turn ${Math.abs(step)}° ${step > 0 ? 'clockwise' : 'counter-clockwise'}`}>{step > 0 ? `+${step}` : step}°</button>
        ))}
      </div>
    </fieldset>
  );
}
