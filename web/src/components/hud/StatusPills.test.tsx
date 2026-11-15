import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from '../../../../tests/fixtures/synthetic-site-date.json';
import type { HeadingEvaluation, SiteDateData } from '../../contracts';
import type { SampleReadout } from '../../scene3d/readouts';
import { StatusPills } from './StatusPills';

const data = () => structuredClone(fixture) as SiteDateData;

const now: SampleReadout = {
  utc: '2027-10-10T00:00:00Z',
  sun: { visible: 'pass', fraction: { low: 0.5, high: 0.5 }, elDeg: 2 },
  powerW: { low: 40, high: 40 },
  panels: [],
  earth: { utc: '2027-10-10T00:00:00Z', status: 'pass', earthVisible: 'pass', pointing: 'pass', reason: 'synthetic' },
  batteryWh: { low: 60, high: 60 },
};

function evaluation(status: 'pass' | 'fail' | 'unknown'): HeadingEvaluation {
  const r = { status, reason: `synthetic ${status}`, sourceIds: ['synthetic'] };
  return {
    yawDeg: 0, siteId: 'site-synthetic', startUtc: now.utc, endUtc: now.utc,
    solar: r, battery: r, antenna: r, deployment: r,
    minimumBatteryWh: null, contactHours: null, unresolved: [],
  };
}

describe('StatusPills (synthetic)', () => {
  it('renders window verdicts for pass, fail and unknown', () => {
    const passHtml = renderToStaticMarkup(
      <StatusPills data={data()} evaluation={evaluation('pass')} now={now} onOpenReason={() => {}} />,
    );
    expect(passHtml).toContain('Pass on unvalidated inputs');
    expect(passHtml).toContain('window');
    expect(passHtml).toContain('Now Sun 50%');
    expect(passHtml).toContain('Power 40 W');
    expect(passHtml).toContain('Earth in beam yes');

    const failHtml = renderToStaticMarkup(
      <StatusPills data={data()} evaluation={evaluation('fail')} now={now} onOpenReason={() => {}} />,
    );
    expect(failHtml).toContain('Fail (modeled)');
    expect(failHtml).toContain('lp-tone-fail');

    const unkHtml = renderToStaticMarkup(
      <StatusPills data={data()} evaluation={evaluation('unknown')} now={null} onOpenReason={() => {}} />,
    );
    expect(unkHtml).toContain('Unknown');
    expect(unkHtml).toContain('Now Sun —');
  });
});
