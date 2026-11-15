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

const CARDS: { code: 'solar' | 'battery' | 'antenna' | 'deployment'; title: string }[] = [
  { code: 'solar', title: 'SOL' },
  { code: 'battery', title: 'BAT' },
  { code: 'antenna', title: 'ANT' },
  { code: 'deployment', title: 'DEP' },
];

export function StatusPills({ data, evaluation, now, onOpenReason }: Props) {
  const evidence = hasFullCoverageEvidence(data);
  const sunPct = now ? fmtRange(now.sun.fraction.low * 100, now.sun.fraction.high * 100, '%') : '—';
  const power = now ? fmtRange(now.powerW.low, now.powerW.high, ' W') : '—';
  const bat = now?.batteryWh ? fmtRange(now.batteryWh.low, now.batteryWh.high, ' Wh') : '—';
  const earth = earthLabel(now?.earth?.status);

  return (
    <div className="lp3-pills" role="group" aria-label="Modeled window checks and now readouts">
      {CARDS.map(c => {
        const result: ConstraintResult | null = evaluation ? evaluation[c.code] : null;
        const { label, tone } = statusPresentation(result, evidence);
        return (
          <button key={c.code} type="button" className={`lp3-pill lp-tone-${tone}`}
            onClick={() => onOpenReason(c.code)}
            aria-label={`${c.title} window: ${label}. Open reason.`}>
            <span className="lp3-pill-code">{c.title}</span>
            <span className="lp3-pill-label">{label}</span>
            <span className="lp3-pill-hint">window</span>
          </button>
        );
      })}
      <div className="lp3-now" aria-live="polite">
        <span>Now Sun {sunPct}</span>
        <span>Power {power}</span>
        <span>Battery {bat}</span>
        <span>Earth in beam {earth}</span>
      </div>
    </div>
  );
}
