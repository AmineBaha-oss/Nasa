import type { HeadingEvaluation } from '../contracts';
import { statusPresentation } from './ConstraintCard';

const CHECKS = [
  ['solar', 'Solar'], ['battery', 'Battery'], ['antenna', 'Antenna'], ['deployment', 'Deployment'],
] as const;

/** Compact window results stay with the map while the user changes heading. */
export function LiveChecks({ evaluation, evidenceComplete, yawDeg, batteryCapacityWh }: {
  evaluation: HeadingEvaluation | null; evidenceComplete: boolean; yawDeg: number; batteryCapacityWh?: number;
}) {
  const windowHours = evaluation ? (Date.parse(evaluation.endUtc) - Date.parse(evaluation.startUtc)) / 3.6e6 : 0;
  const percentage = (value: number | null | undefined, total: number | undefined) =>
    value != null && Number.isFinite(value) && total != null && Number.isFinite(total) && total > 0
      ? `${Math.round(Math.max(0, Math.min(1, value / total)) * 100)}%` : '—';
  return (
    <section className="lp-live-checks" aria-label="Live heading checks">
      <div className="lp-live-heading">
        <strong>Checks at {evaluation?.yawDeg ?? yawDeg}°</strong>
        <span>Whole window</span>
      </div>
      <div className="lp-live-results">
        {CHECKS.map(([key, title]) => {
          const result = evaluation?.[key] ?? null;
          const { label, tone } = statusPresentation(result, evidenceComplete);
          const metric = key === 'battery'
            ? { value: percentage(tone === 'unknown' ? null : evaluation?.minimumBatteryWh, batteryCapacityWh), label: 'min charge' }
            : key === 'antenna'
              ? { value: percentage(tone === 'unknown' ? null : evaluation?.contactHours, windowHours), label: 'contact time' }
              : null;
          return (
            <details key={key} className={`lp-live-check lp-tone-${tone}`} name="live-heading-reasons">
              <summary>
                <span className="lp-live-name">{title}</span>
                <span className="lp-status" aria-live="polite">{label}</span>
                {metric && <span className="lp-live-metric" title={`${metric.value} ${metric.label}`}>
                  <span className="lp-live-ring">
                    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                      <circle cx="20" cy="20" r="17" className="lp-gauge-track" />
                      {metric.value !== '—' && <circle cx="20" cy="20" r="17" pathLength="100" className="lp-gauge-value"
                        strokeDasharray={`${parseInt(metric.value, 10)} 100`} transform="rotate(-90 20 20)" />}
                    </svg>
                    <strong>{metric.value}</strong>
                  </span>
                  <span className="lp-live-metric-label">{metric.label}</span>
                </span>}
              </summary>
              <div className="lp-live-reason">
                <strong>{title} · whole window at {evaluation?.yawDeg ?? yawDeg}°</strong>
                <p>{result?.reason ?? 'Engine not connected: no result yet.'}</p>
                {key === 'battery' && evaluation && <p>Minimum stored energy: {evaluation.minimumBatteryWh === null ? 'unknown' : `${Math.round(evaluation.minimumBatteryWh)} Wh`}</p>}
                {key === 'antenna' && evaluation && <p>Geometric contact opportunity: {evaluation.contactHours === null ? 'unknown' : `${evaluation.contactHours.toFixed(1)} h`}</p>}
                {!!result?.sourceIds.length && <p className="lp-sources">Sources: {result.sourceIds.join(', ')}</p>}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
