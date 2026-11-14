import { useState } from 'react';
import type { ConstraintResult, HeadingEvaluation, SiteDateData } from '../contracts';
import { statusPresentation, type Tone } from './ConstraintCard';
import { chooseElevationScale, polarPoint } from './geometry';
import { periodLabel } from './SelectionPanel';

export interface Alternative { data: SiteDateData; evaluation: HeadingEvaluation | null; evidenceComplete: boolean; }

const CHECKS: { key: 'solar' | 'battery' | 'antenna' | 'deployment'; label: string }[] = [
  { key: 'solar', label: 'Solar' }, { key: 'battery', label: 'Battery' }, { key: 'antenna', label: 'Antenna' }, { key: 'deployment', label: 'Deployment' },
];

const cell = (r: ConstraintResult | null, ok: boolean) => {
  const s = statusPresentation(r, ok);
  return <td className={`lp-tone-${s.tone}`} title={r?.reason || 'No engine result'}>{s.label}</td>;
};

/** Miniature dial: horizon at panel height, first-sample Sun/Earth, heading. */
function MiniDial({ data, yawDeg }: { data: SiteDateData; yawDeg: number }) {
  const s = data.samples[0] ?? null, C = 40, R = 34;
  const scale = chooseElevationScale([...data.sunHorizon.anglesDeg, s?.sun?.elDeg, s?.earth?.elDeg]);
  const n = data.sunHorizon.anglesDeg.length, step = data.sunHorizon.azimuthStepDeg;
  const pts = n && step > 0 ? data.sunHorizon.anglesDeg.map((a, i) => (a === null ? null : polarPoint(i * step, a, C, C, R, scale))) : [];
  const line = pts.filter((p): p is { x: number; y: number } => p !== null).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const sun = s?.sun ? polarPoint(s.sun.azDeg, s.sun.elDeg, C, C, R, scale) : null;
  const earth = s?.earth ? polarPoint(s.earth.azDeg, s.earth.elDeg, C, C, R, scale) : null;
  const head = polarPoint(yawDeg, scale.minElDeg, C, C, R, scale);
  return (
    <svg viewBox="0 0 80 80" className="lp-mini" aria-hidden="true" focusable="false">
      <circle cx={C} cy={C} r={R} className="lp-mini-rim" />
      {line && <polygon points={line} className="lp-mini-horizon" />}
      <line x1={C} y1={C} x2={head.x} y2={head.y} className="lp-mini-head" />
      {sun && <circle cx={sun.x} cy={sun.y} r={3.5} className="lp-sun" />}
      {earth && <circle cx={earth.x} cy={earth.y} r={3} className="lp-earth" />}
    </svg>
  );
}

function Capsule({ alt, yawDeg, index }: { alt: Alternative; yawDeg: number; index: number }) {
  const { data, evaluation: e, evidenceComplete: ok } = alt;
  return (
    <li className="lp-capsule">
      <p className="lp-capsule-tag" aria-hidden="true">ALT-{String(index + 1).padStart(2, '0')}</p>
      <MiniDial data={data} yawDeg={yawDeg} />
      <h3>{data.site.name}{data.purpose === 'synthetic-test' ? ' (synthetic)' : ''}</h3>
      <p className="lp-mono lp-capsule-period">{periodLabel(data)}</p>
      <ul className="lp-capsule-checks">
        {CHECKS.map(c => {
          const s: { label: string; tone: Tone } = statusPresentation(e?.[c.key] ?? null, ok);
          return <li key={c.key} className={`lp-tone-${s.tone}`}><span className="lp-dot" aria-hidden="true" />{c.label}: {s.label}</li>;
        })}
      </ul>
      <p className="lp-mono lp-capsule-figures">Min battery {e?.minimumBatteryWh ?? 'unknown'} Wh · Contact {e?.contactHours ?? 'unknown'} h</p>
      <p className="lp-hint">{e ? `${e.unresolved.length} unresolved input(s)` : 'Engine not connected'}</p>
    </li>
  );
}

/** Side-by-side site/date summaries at the same heading, in data order. No "best" ranking. */
export function ComparisonTable({ alternatives, yawDeg }: { alternatives: Alternative[]; yawDeg: number }) {
  const [mode, setMode] = useState<'orbit' | 'table'>('orbit');
  return (
    <section aria-labelledby="lp-cmp-h" className="lp-compare">
      <div className="lp-compare-head">
        <h2 id="lp-cmp-h">Alternatives at heading {yawDeg}°</h2>
        <div className="lp-toggle" role="group" aria-label="Alternatives view">
          <button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>Orbital view</button>
          <button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Table</button>
        </div>
      </div>
      {mode === 'orbit' ? (
        <ol className="lp-orbit">
          {alternatives.map((alt, i) => <Capsule key={i} alt={alt} yawDeg={yawDeg} index={i} />)}
        </ol>
      ) : (
        <div className="lp-table-wrap">
          <table>
            <thead><tr><th scope="col">Site</th><th scope="col">UTC period</th><th scope="col">Solar</th><th scope="col">Battery</th>
              <th scope="col">Antenna</th><th scope="col">Deployment</th><th scope="col">Min battery (Wh)</th><th scope="col">Contact (h)</th><th scope="col">Unresolved</th></tr></thead>
            <tbody>
              {alternatives.map(({ data, evaluation: e, evidenceComplete: ok }, i) => (
                <tr key={i}>
                  <th scope="row">{data.site.name}{data.purpose === 'synthetic-test' ? ' (synthetic)' : ''}</th>
                  <td>{periodLabel(data)}</td>
                  {cell(e?.solar ?? null, ok)}{cell(e?.battery ?? null, ok)}{cell(e?.antenna ?? null, ok)}{cell(e?.deployment ?? null, ok)}
                  <td>{e?.minimumBatteryWh ?? 'unknown'}</td><td>{e?.contactHours ?? 'unknown'}</td>
                  <td>{e ? e.unresolved.length : 'engine not connected'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
