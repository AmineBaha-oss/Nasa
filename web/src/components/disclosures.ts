import type { HardwareConfig, HorizonProfile, SiteDateData } from '../contracts';

export type DisclosureTone = 'critical' | 'caution' | 'info';
export interface Disclosure { tone: DisclosureTone; text: string; }

function horizonDisclosure(label: string, p: HorizonProfile): Disclosure {
  const unknownBins = p.anglesDeg.filter(a => a === null).length;
  const height = `observer ${p.observerHeightM} m`;
  if (p.horizonCoverage === 'missing' || p.anglesDeg.length === 0)
    return { tone: 'critical', text: `${label} horizon missing (${height}): visibility is unknown.` };
  const gaps = unknownBins > 0 ? ` ${unknownBins} azimuth bin(s) unknown.` : '';
  if (p.horizonCoverage === 'local-only')
    return { tone: 'caution', text: `${label} horizon: local terrain only (${p.extentKm} km, ${height}); distant obstructions unmodeled.${gaps}` };
  return { tone: unknownBins > 0 ? 'caution' : 'info', text: `${label} horizon: far-field validated (${p.extentKm} km, ${height}).${gaps}` };
}

/** Every disclosure the UI must show next to results. Order: most severe first. */
export function qualityDisclosures(data: SiteDateData, hardware: HardwareConfig | null): Disclosure[] {
  const out: Disclosure[] = [];
  if (data.purpose === 'synthetic-test')
    out.push({ tone: 'critical', text: 'SYNTHETIC TEST DATA: invented geometry, not a lunar result.' });

  const missing = data.samples.filter(s => s.ephemerisQuality === 'missing' || s.sun === null || s.earth === null).length;
  if (data.samples.length === 0) out.push({ tone: 'critical', text: 'No ephemeris samples for this period.' });
  else if (missing > 0) out.push({ tone: 'critical', text: `Sun or Earth direction missing for ${missing} of ${data.samples.length} sample(s).` });
  if (data.samples.some(s => s.ephemerisQuality === 'approximate'))
    out.push({ tone: 'caution', text: 'Ephemeris not independently verified (approximate).' });
  else if (data.samples.length > 0 && data.samples.every(s => s.ephemerisQuality === 'jpl-verified'))
    out.push({ tone: 'info', text: 'Ephemeris samples flagged JPL-verified by the science source.' });

  out.push(horizonDisclosure('Sun / solar-panel', data.sunHorizon));
  out.push(horizonDisclosure('Earth / antenna', data.earthHorizon));

  if (!hardware) out.push({ tone: 'critical', text: 'No hardware preset selected: power and antenna checks cannot be evaluated.' });
  else if (hardware.identity === 'hypothetical')
    out.push({ tone: 'caution', text: `Hardware "${hardware.name}" is hypothetical, not a real spacecraft specification.` });

  out.push({ tone: 'info', text: 'Research prototype: 5 m terrain cannot resolve ~15 cm obstacles; not flight certified.' });
  const rank: Record<DisclosureTone, number> = { critical: 0, caution: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
