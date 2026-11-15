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

interface Props {
  title: string; result: ConstraintResult | null; evidenceComplete: boolean;
  /** Optional engine-derived fraction (0–1) for the gauge, e.g. minimum battery / capacity. Null: ring shows status only. */
  gauge?: number | null; gaugeLabel?: string;
  code?: string;
}

const RING = 2 * Math.PI * 34;

/** Large check card with a radial gauge. The gauge never shows a value the engine did not give. */
export function ConstraintCard({ title, result, evidenceComplete, gauge = null, gaugeLabel, code }: Props) {
  const { label, tone } = statusPresentation(result, evidenceComplete);
  const fraction = tone === 'unknown' ? 0 : gauge === null ? 1 : Math.max(0, Math.min(1, gauge));
  return (
    <article className={`lp-card lp-tone-${tone}`} aria-label={`${title}: ${label}`}>
      {code && <p className="lp-card-code" aria-hidden="true">{code}</p>}
      <div className="lp-gauge" aria-hidden="true">
        <svg viewBox="0 0 80 80" focusable="false">
          <circle cx={40} cy={40} r={34} className="lp-gauge-track" />
          {tone !== 'unknown' && <circle cx={40} cy={40} r={34} className="lp-gauge-value"
            strokeDasharray={`${(fraction * RING).toFixed(1)} ${RING.toFixed(1)}`} transform="rotate(-90 40 40)" />}
        </svg>
        {tone === 'unknown' && <span className="lp-gauge-hatch" />}
        <span className="lp-gauge-text">{tone === 'unknown' ? '—' : gauge === null ? '' : gaugeLabel}</span>
      </div>
      <h3>{title}</h3>
      <p className="lp-status">{result ? label : 'Engine not connected'}</p>
      {result ? (
        <details className="lp-reason">
          <summary>Why</summary>
          <p>{result.reason}{result.sourceIds.length > 0 && <span className="lp-sources"> Sources: {result.sourceIds.join(', ')}</span>}</p>
        </details>
      ) : (
        <p className="lp-reason">No engine result yet.</p>
      )}
    </article>
  );
}
