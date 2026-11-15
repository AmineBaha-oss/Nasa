import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HeadingEvaluation } from '../contracts';
import { LiveChecks } from './LiveChecks';

const result = { status: 'pass' as const, reason: 'Synthetic window result', sourceIds: ['test-source'] };
const evaluation: HeadingEvaluation = {
  yawDeg: 90, siteId: 'synthetic', startUtc: '2027-10-10T00:00:00Z', endUtc: '2027-10-10T01:00:00Z',
  solar: result, battery: { ...result, status: 'fail' }, antenna: { ...result, status: 'unknown' }, deployment: result,
  minimumBatteryWh: 50, contactHours: 0.5, unresolved: [],
};

describe('Live heading checks', () => {
  it('uses the evaluated heading and preserves mixed window statuses and reasons', () => {
    const html = renderToStaticMarkup(<LiveChecks evaluation={evaluation} evidenceComplete yawDeg={91} />);
    expect(html).toContain('Checks at 90°'); // Deferred evaluations must not be labeled with the next heading.
    expect(html).toContain('Whole window');
    expect(html).toContain('Pass (modeled)');
    expect(html).toContain('Fail (modeled)');
    expect(html).toContain('Unknown');
    expect(html).toContain('Synthetic window result');
    expect(html).toContain('test-source');
    expect(html).toContain('50 Wh');
    expect(html).toContain('0.5 h');
  });
  it('does not show green passes for incomplete evidence', () => {
    const html = renderToStaticMarkup(<LiveChecks evaluation={evaluation} evidenceComplete={false} yawDeg={90} />);
    expect(html).toContain('Pass on unvalidated inputs');
    expect(html).not.toContain('lp-tone-pass');
  });
  it('keeps every missing check unknown', () => {
    const html = renderToStaticMarkup(<LiveChecks evaluation={null} evidenceComplete={false} yawDeg={45} />);
    expect(html).toContain('Checks at 45°');
    expect(html.match(/lp-tone-unknown/g)).toHaveLength(4);
    expect(html).toContain('Engine not connected: no result yet.');
  });
  it('shows battery charge and contact percentages with their correct denominators', () => {
    const known = { ...evaluation, antenna: { ...result, status: 'fail' as const } };
    const html = renderToStaticMarkup(<LiveChecks evaluation={known} evidenceComplete yawDeg={90} batteryCapacityWh={200} />);
    expect(html).toContain('title="25% min charge"');
    expect(html).toContain('title="50% contact time"');
    // Half the window can have contact even though the whole-window check fails.
    expect(html).toContain('Fail (modeled)');
  });
  it('does not turn unavailable percentages into zero', () => {
    const missing = { ...evaluation, minimumBatteryWh: null, contactHours: null };
    const html = renderToStaticMarkup(<LiveChecks evaluation={missing} evidenceComplete yawDeg={90} batteryCapacityWh={0} />);
    expect(html).toContain('title="— min charge"');
    expect(html).toContain('title="— contact time"');
    expect(html).not.toContain('0%');
  });

});
