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
    expect(html).toContain('SYNTHETIC');
    expect(html).toContain('LOCAL TERRAIN ONLY');
    expect(html).toContain('HYPOTHETICAL HW');
    expect(html).toContain('5 M DEM · RESEARCH');
    const d = qualityDisclosures(data(), syntheticHardware);
    expect(d.some(x => x.text.includes('SYNTHETIC TEST DATA'))).toBe(true);
    expect(d.some(x => x.text.includes('local terrain only') && x.text.includes('distant obstructions unmodeled'))).toBe(true);
    expect(d.some(x => x.text.includes('is hypothetical'))).toBe(true);
    expect(d.some(x => x.text.includes('not flight certified'))).toBe(true);
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
    expect(html).toContain('No team-approved hardware preset');
    expect(html).toContain('NO HARDWARE');
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
  it('exposes the dial as a keyboard slider and does not animate the initial heading', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} initialYawDeg={30} />);
    expect(html).toContain('role="slider"'); expect(html).toContain('aria-valuenow="30"');
    expect(html).toContain('tabindex="0"'); expect(html).not.toContain('is-animated');
  });
  it('never shows a green status when data quality is synthetic or unverified', () => {
    const pass = { status: 'pass' as const, reason: 'engine pass', sourceIds: ['src'] };
    const allPass = (d: SiteDateData, _h: HardwareConfig, yawDeg: number): HeadingEvaluation => ({
      yawDeg, siteId: d.site.id, startUtc: d.samples[0].utc, endUtc: d.samples[0].utc,
      solar: pass, battery: pass, antenna: pass, deployment: pass, minimumBatteryWh: 50, contactHours: 1, unresolved: [],
    });
    const render = (d: SiteDateData) => renderToStaticMarkup(<NavigatorPage datasets={[d]} hardwarePresets={[syntheticHardware]} evaluate={allPass} />);
    // 1. Synthetic purpose.
    expect(render(data())).not.toContain('lp-tone-pass');
    // 2. Research purpose but unverified (approximate) ephemeris and local-only terrain.
    const unverified = data(); unverified.purpose = 'research';
    unverified.provenance[0].id = 'src'; unverified.samples[0].sourceId = 'src';
    unverified.sunHorizon.sourceId = unverified.earthHorizon.sourceId = 'src';
    expect(render(unverified)).not.toContain('lp-tone-pass');
    // 3. Verified ephemeris but a null horizon bin: still not green.
    const gap = structuredClone(unverified); gap.samples[0].ephemerisQuality = 'jpl-verified';
    gap.sunHorizon.horizonCoverage = gap.earthHorizon.horizonCoverage = 'far-field-validated';
    expect(render(gap)).not.toContain('lp-tone-pass');
    // Control: complete evidence flags do allow the pass tone, so the assertions above can fail.
    const full = structuredClone(gap); full.earthHorizon.anglesDeg = [0, 0, 0, 0];
    expect(render(full)).toContain('lp-tone-pass');
  });
  it('keeps limits visible as chips next to results', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} />);
    expect(html).not.toContain('What this view can&#x27;t tell you');
    expect(html).toContain('SYNTHETIC</li>');
    expect(html).toContain('EPHEMERIS UNVERIFIED');
    expect(html).toContain('LOCAL TERRAIN ONLY');
    expect(html).toContain('HYPOTHETICAL HW');
    expect(html).toContain('5 M DEM · RESEARCH');
  });
  it('labels decorative and illustrative elements honestly', () => {
    const html = renderToStaticMarkup(<NavigatorPage datasets={[data()]} hardwarePresets={[syntheticHardware]} />);
    expect(html).toContain('phase drawn is illustrative');
    expect(html).toContain('not a link check');
    expect(html).toContain('Shadow direction from Sun azimuth (illustrative)');
    expect(html).toContain('Engine not connected');
  });
  it('handles no data without crashing', () => {
    expect(renderToStaticMarkup(<NavigatorPage datasets={[]} hardwarePresets={[]} />)).toContain('No processed science data loaded');
  });
});
