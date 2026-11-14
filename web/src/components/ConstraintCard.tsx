import type { ConstraintResult } from '../contracts';

export type Tone = 'pass' | 'caution' | 'fail' | 'unknown';

/**
 * Maps an engine result to a label. A modeled pass on incomplete evidence is never shown
 * as green: it gets the caution tone. The UI never prints "GO".
 */
export function statusPresentation(result: ConstraintResult | null, evidenceComplete: boolean): { label: string; tone: Tone } {
  if (!result || result.status === 'unknown') return { label: 'Unknown', tone: 'unknown' };
  if (result.status === 'fail') return { label: 'Fail (modeled)', tone: 'fail' };
  return evidenceComplete ? { label: 'Pass (modeled)', tone: 'pass' } : { label: 'Pass on unvalidated inputs', tone: 'caution' };
}

interface Props { title: string; result: ConstraintResult | null; evidenceComplete: boolean; }

export function ConstraintCard({ title, result, evidenceComplete }: Props) {
  const { label, tone } = statusPresentation(result, evidenceComplete);
  return (
    <article className={`lp-card lp-tone-${tone}`} aria-label={`${title}: ${label}`}>
      <span className="lp-lamp" aria-hidden="true" />
      <h3>{title}</h3>
      <span className="lp-status">{label}</span>
      <p className="lp-reason">{result?.reason || 'No engine result is connected for this check yet.'}
        {result && result.sourceIds.length > 0 && <span className="lp-sources"> Sources: {result.sourceIds.join(', ')}</span>}</p>
    </article>
  );
}
