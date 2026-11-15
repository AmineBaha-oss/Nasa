import { useState } from 'react';
import type { ConstraintResult, HeadingEvaluation, SiteDateData } from '../contracts';
import { statusPresentation, type Tone } from './ConstraintCard';
import { chooseElevationScale, polarPoint } from './geometry';
import { periodLabel } from './SelectionPanel';

export interface Alternative { data: SiteDateData; evaluation: HeadingEvaluation | null; evidenceComplete: boolean; }

const CHECKS: { key: 'solar' | 'battery' | 'antenna' | 'deployment'; label: string; short: string }[] = [
  { key: 'solar', label: 'Solar', short: 'Solar' }, { key: 'battery', label: 'Battery', short: 'Battery' },
  { key: 'antenna', label: 'Antenna', short: 'Antenna' }, { key: 'deployment', label: 'Deployment', short: 'Deploy' },
];

const MARK: Record<Tone, { glyph: string; short: string }> = {
  pass: { glyph: '✓', short: 'Pass' },
  caution: { glyph: '!', short: 'Pass*' },
  fail: { glyph: '✕', short: 'Fail' },
  unknown: { glyph: '?', short: 'Unknown' },
};

const cell = (r: ConstraintResult | null, ok: boolean) => {
  const s = statusPresentation(r, ok);
  return <td className={`lp-tone-${s.tone}`} title={r?.reason || 'No engine result'}>{s.label}</td>;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Compact UTC date span, e.g. "Oct 10–16" or "Oct 28 – Nov 3". */
function shortPeriod(d: SiteDateData): string {
  if (d.samples.length === 0) return 'No samples';
  const a = new Date(d.samples[0].utc), b = new Date(d.samples[d.samples.length - 1].utc);
  const ma = MONTHS[a.getUTCMonth()], mb = MONTHS[b.getUTCMonth()];
  if (ma === mb && a.getUTCFullYear() === b.getUTCFullYear()) {
    return a.getUTCDate() === b.getUTCDate() ? `${ma} ${a.getUTCDate()}` : `${ma} ${a.getUTCDate()}–${b.getUTCDate()}`;
  }
  return `${ma} ${a.getUTCDate()} – ${mb} ${b.getUTCDate()}`;
}

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

function StatusMark({ result, evidenceComplete, check }: { result: ConstraintResult | null; evidenceComplete: boolean; check: string }) {
  const s = statusPresentation(result, evidenceComplete);
  const m = MARK[s.tone];
  return (
    <span className={`lp-mark lp-tone-${s.tone}`} title={`${check}: ${s.label}${result?.reason ? `. ${result.reason}` : ''}`}>
      <span className="lp-mark-glyph" aria-hidden="true">{m.glyph}</span>
      <span className="lp-mark-text" aria-hidden="true">{m.short}</span>
      <span className="lp-visually-hidden">{check}: {s.label}</span>
    </span>
  );
}

interface Entry { alt: Alternative; index: number }

function SiteCard({ entries, yawDeg, currentIndex, onSelect }: { entries: Entry[]; yawDeg: number; currentIndex?: number; onSelect?: (i: number) => void }) {
  const site = entries[0].alt.data.site;
  const synthetic = entries.some(x => x.alt.data.purpose === 'synthetic-test');
  const current = entries.some(x => x.index === currentIndex);
  return (
    <li className={current ? 'lp-alt is-current' : 'lp-alt'}>
      <header className="lp-alt-head">
        <MiniDial data={entries[0].alt.data} yawDeg={yawDeg} />
        <div>
          <p className="lp-alt-id">{site.id}{current && <span className="lp-alt-here">Selected</span>}</p>
          <h3>{site.name}{synthetic ? ' (synthetic)' : ''}</h3>
          <p className="lp-alt-coords lp-mono">{site.latitudeDeg.toFixed(3)}°, {site.longitudeEastDeg.toFixed(3)}°E</p>
        </div>
      </header>
      <div className="lp-alt-grid" role="table" aria-label={`${site.name} windows`}>
        <div className="lp-alt-row lp-alt-cols" role="row">
          <span role="columnheader">Window</span>
          {CHECKS.map(c => <span key={c.key} role="columnheader">{c.short}</span>)}
          <span role="columnheader" className="lp-visually-hidden">Battery, contact and unresolved inputs</span>
        </div>
        {entries.map(({ alt, index }, k) => {
          const e = alt.evaluation;
          const name = `Window ${String.fromCharCode(65 + k)}`;
          const selected = index === currentIndex;
          const label = (
            <>
              <strong>{name}</strong>
              <small>{shortPeriod(alt.data)}</small>
            </>
          );
          return (
            <div key={index} className={selected ? 'lp-alt-row is-selected' : 'lp-alt-row'} role="row">
              <span role="rowheader" title={periodLabel(alt.data)}>
                {onSelect
                  ? <button type="button" className="lp-alt-pick" aria-pressed={selected} onClick={() => onSelect(index)}
                      aria-label={`${site.name}, ${name}, ${periodLabel(alt.data)}${selected ? ' (selected)' : ''}`}>{label}</button>
                  : <span className="lp-alt-pick">{label}</span>}
              </span>
              {CHECKS.map(c => (
                <span key={c.key} role="cell"><StatusMark result={e?.[c.key] ?? null} evidenceComplete={alt.evidenceComplete} check={c.label} /></span>
              ))}
              <span role="cell" className="lp-alt-figures lp-mono">
                {e
                  ? <>Min battery {e.minimumBatteryWh == null ? 'unknown' : `${e.minimumBatteryWh} Wh`} · Contact {e.contactHours == null ? 'unknown' : `${e.contactHours} h`} · {e.unresolved.length} unresolved input(s)</>
                  : 'Engine not connected'}
              </span>
            </div>
          );
        })}
      </div>
    </li>
  );
}

interface Props {
  alternatives: Alternative[];
  yawDeg: number;
  /** Index into alternatives of the window shown elsewhere on the page. */
  currentIndex?: number;
  onSelect?: (index: number) => void;
}

/** Site/window summaries at the same heading, grouped by site in data order. No "best" ranking. */
export function ComparisonTable({ alternatives, yawDeg, currentIndex, onSelect }: Props) {
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const groups = [...alternatives.reduce((m, alt, index) => {
    const id = alt.data.site.id;
    m.set(id, [...(m.get(id) ?? []), { alt, index }]);
    return m;
  }, new Map<string, Entry[]>()).values()];
  const shown = new Set(alternatives.flatMap(a => CHECKS.map(c => statusPresentation(a.evaluation?.[c.key] ?? null, a.evidenceComplete).tone)));
  return (
    <section aria-labelledby="lp-cmp-h" className="lp-compare">
      <div className="lp-compare-head">
        <div>
          <h2 id="lp-cmp-h">Alternatives at heading {yawDeg}°</h2>
          <p className="lp-compare-sub">Every site and window, checked over the whole window at the same heading. Listed in data order, not ranked.</p>
        </div>
        <div className="lp-toggle" role="group" aria-label="Alternatives view">
          <button type="button" aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}>Cards</button>
          <button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Table</button>
        </div>
      </div>
      <ul className="lp-alt-legend" aria-label="Status key">
        {(Object.keys(MARK) as Tone[]).filter(t => shown.has(t)).map(t => (
          <li key={t} className={`lp-key-${t}`}><span className="lp-mark-glyph" aria-hidden="true">{MARK[t].glyph}</span>
            {t === 'pass' ? 'Pass (modeled)' : t === 'caution' ? 'Pass* on unvalidated inputs' : t === 'fail' ? 'Fail (modeled)' : 'Unknown'}</li>
        ))}
      </ul>
      {mode === 'cards' ? (
        <ol className="lp-alt-list">
          {groups.map(g => <SiteCard key={g[0].alt.data.site.id} entries={g} yawDeg={yawDeg} currentIndex={currentIndex} onSelect={onSelect} />)}
        </ol>
      ) : (
        <div className="lp-table-wrap">
          <table>
            <thead><tr><th scope="col">Site</th><th scope="col">UTC period</th><th scope="col">Solar</th><th scope="col">Battery</th>
              <th scope="col">Antenna</th><th scope="col">Deployment</th><th scope="col">Min battery (Wh)</th><th scope="col">Contact (h)</th><th scope="col">Unresolved</th></tr></thead>
            <tbody>
              {alternatives.map(({ data, evaluation: e, evidenceComplete: ok }, i) => (
                <tr key={i} className={i === currentIndex ? 'is-selected' : undefined}>
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
