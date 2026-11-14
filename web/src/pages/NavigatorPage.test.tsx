import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from '../../../tests/fixtures/synthetic-site-date.json';
import type { HardwareConfig, HeadingEvaluation, SiteDateData } from '../contracts';
import { qualityDisclosures } from '../components/disclosures';
import { NavigatorPage } from './NavigatorPage';

const data = () => structuredClone(fixture) as SiteDateData;

// SYNTHETIC UNIT-TEST HARDWARE. Invented numbers; not an approved preset.
const syntheticHardware: HardwareConfig = {
  name: 'Synthetic test lander', identity: 'hypothetical', specificationSourceId: null, totalActivePvAreaM2: 2,
  panels: [{ name: 'Panel A', areaFraction: 1, normalBodyRFU: [1, 0, 0], mode: 'fixed' }], peakSolarPowerW: 100,
  batteryCapacityWh: 100, batteryInitialWh: 80, minReserveWh: 20, constantLoadW: 10, chargeEfficiency: 0.9, dischargeEfficiency: 0.9,
  antenna: { boresightBodyRFU: [0, 1, 0], beamHalfAngleDeg: 15 }, antennaHeightM: 3, panelHeightM: 2, rampHeadingBodyDeg: 180,
};

describe('navigator page (synthetic unit tests only)', () => {
  it('flags synthetic data, local-only terrain and hypothetical hardware', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} />);
    expect(html).toContain('SYNTHETIC TEST DATA');
    expect(html).toContain('local terrain only');
    expect(html).toContain('distant obstructions unmodeled');
    expect(html).toContain('is hypothetical');
    expect(html).toContain('not flight certified');
  });
  it('shows Unknown everywhere when no engine is connected', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} />);
    expect(html).toContain('Engine adapter not connected');
    expect(html).not.toContain('lp-tone-pass'); expect(html).not.toContain('Pass');
  });
  it('reports the null Earth horizon bin instead of treating it as clear sky', () => {
    const d = qualityDisclosures(data(), syntheticHardware);
    expect(d.some(x => x.text.includes('Earth / antenna') && x.text.includes('1 azimuth bin(s) unknown'))).toBe(true);
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[]} />);
    expect(html).toContain('Unknown horizon bins');
  });
  it('asks for hardware instead of inventing it', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[]} />);
    expect(html).toContain('no team-approved hardware preset');
    expect(html).toContain('No hardware preset selected');
  });
  it('keeps an engine pass on synthetic data out of the green tone', () => {
    const r = { status: 'pass' as const, reason: 'synthetic', sourceIds: ['synthetic'] };
    const evaluate = (d: SiteDateData, _h: HardwareConfig, yawDeg: number): HeadingEvaluation => ({
      yawDeg, siteId: d.site.id, startUtc: d.samples[0].utc, endUtc: d.samples[0].utc,
      solar: r, battery: r, antenna: r, deployment: r, minimumBatteryWh: 50, contactHours: 1, unresolved: ['synthetic gap'],
    });
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} evaluate={evaluate} initialYawDeg={45} />);
    expect(html).toContain('Pass on unvalidated inputs'); expect(html).not.toContain('lp-tone-pass');
    expect(html).toContain('synthetic gap'); expect(html).toContain('Alternatives at heading 45°');
  });
  it('draws the ramp from a forward-pointing base shape, rotated by its body heading', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} />);
    expect(html).toMatch(/<path d="M110 90 L130 90 L136 44 L104 44 Z" class="lp-ramp" data-ramp-body-deg="180" transform="rotate\(180 120 120\)"/);
  });
  it('handles no data without crashing', () => {
    expect(renderToStaticMarkup(<NavigatorPage datasets={[]} hardwarePresets={[]} />)).toContain('No processed science data loaded');
  });
});
