import type { HardwareConfig, SiteDateData } from '../contracts';

/** Compact quality tags shown next to each chart, so limits stay visible where results are read. */
export function qualityChips(data: SiteDateData, hardware: HardwareConfig | null): { text: string; tone: 'critical' | 'caution' }[] {
  const chips: { text: string; tone: 'critical' | 'caution' }[] = [];
  if (data.purpose === 'synthetic-test') chips.push({ text: 'SYNTHETIC', tone: 'critical' });
  if (data.samples.length === 0 || data.samples.some(s => s.ephemerisQuality !== 'jpl-verified')) chips.push({ text: 'EPHEMERIS UNVERIFIED', tone: 'caution' });
  if ([data.sunHorizon, data.earthHorizon].some(h => h.horizonCoverage !== 'far-field-validated')) chips.push({ text: 'LOCAL TERRAIN ONLY', tone: 'caution' });
  if (!hardware) chips.push({ text: 'NO HARDWARE', tone: 'critical' });
  else if (hardware.identity === 'hypothetical') chips.push({ text: 'HYPOTHETICAL HW', tone: 'caution' });
  return chips;
}

export function QualityChips({ data, hardware }: { data: SiteDateData; hardware: HardwareConfig | null }) {
  const chips = qualityChips(data, hardware);
  if (chips.length === 0) return null;
  return (
    <ul className="lp-chips" aria-label="Data limits for this chart">
      {chips.map(c => <li key={c.text} className={`lp-chip lp-chip-${c.tone}`}>{c.text}</li>)}
    </ul>
  );
}
