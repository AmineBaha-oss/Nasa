import { memo, useId } from 'react';
import type { HardwareConfig, SiteDateData } from '../contracts';
import { formatUtc } from './geometry';

export function periodLabel(d: SiteDateData): string {
  if (d.samples.length === 0) return 'No samples';
  const first = d.samples[0].utc, last = d.samples[d.samples.length - 1].utc;
  return first === last ? formatUtc(first) : `${formatUtc(first)} → ${formatUtc(last)}`;
}

interface Props {
  datasets: SiteDateData[]; datasetIndex: number; onDataset: (i: number) => void;
  sampleIndex: number; onSample: (i: number) => void;
  hardwarePresets: HardwareConfig[]; hardwareIndex: number; onHardware: (i: number) => void;
}

/** Site, UTC period, sample time and hardware preset selectors. */
export const SelectionPanel = memo(function SelectionPanel(p: Props) {
  const id = useId();
  const current = p.datasets[p.datasetIndex];
  const siteIds = [...new Set(p.datasets.map(d => d.site.id))];
  const periods = p.datasets.map((d, i) => ({ d, i })).filter(x => x.d.site.id === current.site.id);
  const sample = current.samples[p.sampleIndex];
  return (
    <fieldset className="lp-select">
      <legend>Site, period and hardware</legend>
      <label htmlFor={`${id}-site`}>Site</label>
      <select id={`${id}-site`} value={current.site.id}
        onChange={e => p.onDataset(p.datasets.findIndex(d => d.site.id === e.target.value))}>
        {siteIds.map(s => <option key={s} value={s}>{p.datasets.find(d => d.site.id === s)!.site.name}</option>)}
      </select>
      <label htmlFor={`${id}-period`}>UTC period</label>
      <select id={`${id}-period`} value={p.datasetIndex} onChange={e => p.onDataset(Number(e.target.value))}>
        {periods.map(({ d, i }) => <option key={i} value={i}>{periodLabel(d)}</option>)}
      </select>
      <label htmlFor={`${id}-time`}>Sample time (UTC)</label>
      {current.samples.length > 0 ? <>
        <input id={`${id}-time`} type="range" min={0} max={current.samples.length - 1} value={p.sampleIndex}
          onChange={e => p.onSample(Number(e.target.value))} aria-valuetext={sample ? formatUtc(sample.utc) : 'none'} />
        <output htmlFor={`${id}-time`}>{sample ? formatUtc(sample.utc) : 'none'}</output>
      </> : <p className="lp-hint">No ephemeris samples in this period.</p>}
      {p.hardwarePresets.length > 0 ? <>
        <label htmlFor={`${id}-hw`}>Hardware preset</label>
        <select id={`${id}-hw`} value={p.hardwareIndex} onChange={e => p.onHardware(Number(e.target.value))}>
          {p.hardwarePresets.map((h, i) => <option key={h.name} value={i}>{h.name} ({h.identity})</option>)}
        </select>
      </> : <p className="lp-hint"><strong>Hardware preset:</strong> no team-approved hardware preset yet. Request one from the lead in docs/INPUT_REQUESTS.md; the app will not guess your spacecraft.</p>}
    </fieldset>
  );
});
