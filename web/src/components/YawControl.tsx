import { useId } from 'react';
import { normalizeDeg } from './geometry';

interface Props { valueDeg: number; onChange: (deg: number) => void; }

/** 360° body-heading control: slider, exact numeric entry and step buttons (keyboard friendly). */
export function YawControl({ valueDeg, onChange }: Props) {
  const id = useId();
  const set = (deg: number) => onChange(Math.round(normalizeDeg(deg)));
  return (
    <fieldset className="lp-yaw">
      <legend>Body heading (yaw)</legend>
      <p className="lp-hint" id={`${id}-hint`}>Degrees clockwise from lunar north; 0° points body-forward north.</p>
      <div className="lp-yaw-row">
        <input type="range" min={0} max={359} step={1} value={valueDeg} aria-label="Body heading slider"
          aria-describedby={`${id}-hint`} onChange={e => set(Number(e.target.value))} />
        <label htmlFor={`${id}-num`} className="lp-visually-hidden">Body heading in degrees</label>
        <input id={`${id}-num`} type="number" min={0} max={359} step={1} value={valueDeg} inputMode="numeric"
          aria-describedby={`${id}-hint`} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v); }} />
        <span aria-hidden="true">°</span>
      </div>
      <div className="lp-yaw-steps">
        {[-10, -1, 1, 10].map(step => (
          <button key={step} type="button" onClick={() => set(valueDeg + step)}>{step > 0 ? `+${step}` : step}°</button>
        ))}
      </div>
    </fieldset>
  );
}
