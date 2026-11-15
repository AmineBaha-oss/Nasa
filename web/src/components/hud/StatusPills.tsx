import type { ConstraintResult, HeadingEvaluation, SiteDateData, Status } from '../../contracts';
import { hasFullCoverageEvidence } from '../../integration/quality';
import type { SampleReadout } from '../../scene3d/readouts';
import { statusPresentation } from '../ConstraintCard';

interface Props {
  data: SiteDateData;
  evaluation: HeadingEvaluation | null;
  now: SampleReadout | null;
  onOpenReason: (code: 'solar' | 'battery' | 'antenna' | 'deployment') => void;
}

function fmtRange(low: number, high: number, unit: string): string {
  if (low === high) return `${Math.round(low)}${unit}`;
  return `${Math.round(low)}–${Math.round(high)}${unit}`;
}

function earthLabel(status: Status | undefined): string {
  if (status === 'pass') return 'yes';
  if (status === 'fail') return 'no';
  return 'unknown';
}

const CARDS: { code: 'solar' | 'battery' | 'antenna' | 'deployment'; title: string; name: string }[] = [
  { code: 'solar', title: 'SOL', name: 'Solar' },
  { code: 'battery', title: 'BAT', name: 'Battery' },
  { code: 'antenna', title: 'ANT', name: 'Antenna' },
  { code: 'deployment', title: 'DEP', name: 'Deployment' },
];

/** Window verdicts from the engines (click for the reason) and readouts for the current sample. */
export function StatusPills({ data, evaluation, now, onOpenReason }: Props) {
  const evidence = hasFullCoverageEvidence(data);
  const sunPct = now ? fmtRange(now.sun.fraction.low * 100, now.sun.fraction.high * 100, '%') : '—';
  const power = now ? fmtRange(now.powerW.low, now.powerW.high, ' W') : '—';
  const bat = now?.batteryWh ? fmtRange(now.batteryWh.low, now.batteryWh.high, ' Wh') : '—';
  const earth = earthLabel(now?.earth?.status);

  return (
    <div className="lp3-pills" role="group" aria-label="Modeled window checks and now readouts">
      <div className="lp3-pill-row">
        <span className="lp3-pills-kicker">Whole window</span>
        {CARDS.map(c => {
          const result: ConstraintResult | null = evaluation ? evaluation[c.code] : null;
          const { label, tone } = statusPresentation(result, evidence);
          return (
            <button key={c.code} type="button" className={`lp3-pill lp-tone-${tone}`} onClick={() => onOpenReason(c.code)}
              aria-label={`${c.title} window: ${label}. Open reason.`} title={`${c.name}: ${label}. Click for the reason.`}>
              <span className="lp3-pill-dot" aria-hidden="true" />
              <span className="lp3-pill-code">{c.name}</span>
              <span className="lp3-pill-label">{label}</span>
              <span className="lp3-pill-hint">window</span>
            </button>
          );
        })}
      </div>
      <div className="lp3-now" aria-live="polite">
        <span className="lp3-pills-kicker">This hour</span>
        <span>Now Sun {sunPct}</span>
        <span>Power {power}</span>
        <span>Battery {bat}</span>
        <span>Earth in beam {earth}</span>
      </div>
    </div>
  );
}
