import { memo, useId } from 'react';
import type { HardwareConfig, SiteDateData } from '../contracts';
import { formatUtc } from './geometry';

export function periodLabel(d: SiteDateData): string {
  if (d.samples.length === 0) return 'No samples';
  const first = d.samples[0].utc, last = d.samples[d.samples.length - 1].utc;
  return first === last ? formatUtc(first) : `${formatUtc(first)} → ${formatUtc(last)}`;
}

/** Sun-elevation sparkline under the time slider. Grey where the Sun centre is below 0° (geometric, terrain not applied). */
function SunTimeline({ data, index }: { data: SiteDateData; index: number }) {
  const els = data.samples.map(s => s.sun?.elDeg ?? null);
  const known = els.filter((v): v is number => v !== null);
  const W = 200, H = 40, n = els.length;
  if (n === 0) return null;
  const lo = Math.min(-1, ...known), hi = Math.max(1, ...known);
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8);
  const line = els.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const step = n > 1 ? W / (n - 1) : W;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="lp-spark" aria-hidden="true" focusable="false">
      {els.map((v, i) => (v !== null && v < 0) || v === null
        ? <rect key={i} x={Math.max(0, x(i) - step / 2)} y={0} width={n === 1 ? W : step} height={H} className={v === null ? 'lp-spark-unknown' : 'lp-spark-night'} />
        : null)}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="lp-spark-zero" />
      {n > 1 ? <polyline points={line} className="lp-spark-line" /> : known.length > 0 && <circle cx={x(0)} cy={y(known[0])} r={2.5} className="lp-spark-dot" />}
      <line x1={x(index)} x2={x(index)} y1={0} y2={H} className="lp-spark-cursor" />
    </svg>
  );
}

interface Props {
  datasets: SiteDateData[]; datasetIndex: number; onDataset: (i: number) => void;
  sampleIndex: number; onSample: (i: number) => void;
  hardwarePresets: HardwareConfig[]; hardwareIndex: number; onHardware: (i: number) => void;
}

/** Site, UTC period/time and hardware, as three stacked instrument modules. */
export const SelectionPanel = memo(function SelectionPanel(p: Props) {
  const id = useId();
  const current = p.datasets[p.datasetIndex];
  const siteIds = [...new Set(p.datasets.map(d => d.site.id))];
  const periods = p.datasets.map((d, i) => ({ d, i })).filter(x => x.d.site.id === current.site.id);
  const sample = current.samples[p.sampleIndex];
  return (
    <div className="lp-modules">
      <section className="lp-module" aria-labelledby={`${id}-m1`}>
        <p className="lp-module-tag" aria-hidden="true"><span>01</span>MOD-SITE</p>
        <h3 id={`${id}-m1`}><label htmlFor={`${id}-site`}>Site</label></h3>
        <select id={`${id}-site`} value={current.site.id}
          onChange={e => p.onDataset(p.datasets.findIndex(d => d.site.id === e.target.value))}>
          {siteIds.map(s => <option key={s} value={s}>{p.datasets.find(d => d.site.id === s)!.site.name}</option>)}
        </select>
        <p className="lp-mono lp-coords">{current.site.latitudeDeg.toFixed(4)}° {current.site.longitudeEastDeg.toFixed(4)}°E</p>
      </section>
      <section className="lp-module" aria-labelledby={`${id}-m2`}>
        <p className="lp-module-tag" aria-hidden="true"><span>02</span>MOD-UTC</p>
        <h3 id={`${id}-m2`}><label htmlFor={`${id}-period`}>UTC period</label></h3>
        <select id={`${id}-period`} value={p.datasetIndex} onChange={e => p.onDataset(Number(e.target.value))}>
          {periods.map(({ d, i }) => <option key={i} value={i}>{periodLabel(d)}</option>)}
        </select>
        <label htmlFor={`${id}-time`} className="lp-sublabel">Sample time</label>
        {current.samples.length > 0 ? <div className="lp-timeline">
          <SunTimeline data={current} index={p.sampleIndex} />
          <input id={`${id}-time`} type="range" min={0} max={Math.max(0, current.samples.length - 1)} value={p.sampleIndex}
            onChange={e => p.onSample(Number(e.target.value))} aria-valuetext={sample ? formatUtc(sample.utc) : 'none'} />
          <output htmlFor={`${id}-time`} className="lp-mono">{sample ? formatUtc(sample.utc) : 'none'}</output>
          <p className="lp-hint">Sun elevation · grey = below 0° or unknown</p>
        </div> : <p className="lp-hint">No ephemeris samples in this period.</p>}
      </section>
      <section className="lp-module" aria-labelledby={`${id}-m3`}>
        <p className="lp-module-tag" aria-hidden="true"><span>03</span>MOD-HW</p>
        <h3 id={`${id}-m3`}>{p.hardwarePresets.length > 0 ? <label htmlFor={`${id}-hw`}>Hardware preset</label> : 'Hardware preset'}</h3>
        {p.hardwarePresets.length > 0 ? (
          <select id={`${id}-hw`} value={p.hardwareIndex} onChange={e => p.onHardware(Number(e.target.value))}>
            {p.hardwarePresets.map((h, i) => <option key={h.name} value={i}>{h.name} ({h.identity})</option>)}
          </select>
        ) : <p className="lp-hint">No team-approved hardware preset yet. The app will not invent one.</p>}
      </section>
    </div>
  );
});
