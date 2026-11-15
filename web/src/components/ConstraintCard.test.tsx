import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConstraintCard, statusPresentation } from './ConstraintCard';

const pass = { status: 'pass' as const, reason: 'synthetic reason', sourceIds: ['synthetic'] };

describe('constraint status presentation (synthetic unit tests only)', () => {
  it('never shows a green pass on incomplete evidence', () => {
    expect(statusPresentation(pass, false)).toEqual({ label: 'Pass on unvalidated inputs', tone: 'caution' });
    expect(statusPresentation(pass, true).tone).toBe('pass');
  });
  it('treats a missing result as unknown, not pass', () => {
    expect(statusPresentation(null, true).tone).toBe('unknown');
    expect(statusPresentation({ ...pass, status: 'unknown' }, true).label).toBe('Unknown');
    expect(statusPresentation({ ...pass, status: 'fail' }, false).tone).toBe('fail');
  });
  it('renders the reason, the sources and no GO wording', () => {
    const html = renderToStaticMarkup(<ConstraintCard title="Solar power" result={pass} evidenceComplete={false} />);
    expect(html).toContain('synthetic reason'); expect(html).toContain('Sources: synthetic');
    expect(html).toContain('lp-tone-caution'); expect(html).not.toMatch(/\bGO\b/);
  });
  it('explains a missing engine result', () => {
    const html = renderToStaticMarkup(<ConstraintCard title="Battery" result={null} evidenceComplete={false} />);
    expect(html).toContain('No engine result yet');
  });
});
