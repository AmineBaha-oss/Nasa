import type { HardwareConfig, HeadingEvaluation, SiteDateData } from '../../contracts';
import { hasFullCoverageEvidence } from '../../integration/quality';
import { ComparisonTable } from '../ComparisonTable';
import { QualityChips } from '../QualityChips';
import type { Alternative } from '../ComparisonTable';

interface Props {
  open: boolean;
  onClose: () => void;
  data: SiteDateData;
  hardware: HardwareConfig | null;
  evaluation: HeadingEvaluation | null;
  alternatives: Alternative[];
  yawDeg: number;
  focus?: 'solar' | 'battery' | 'antenna' | 'deployment' | null;
  currentIndex?: number;
  onSelect?: (index: number) => void;
}

export function DetailsDrawer({ open, onClose, data, hardware, evaluation, alternatives, yawDeg, focus, currentIndex, onSelect }: Props) {
  if (!open) return null;
  const evidence = hasFullCoverageEvidence(data);
  const reason = focus && evaluation ? evaluation[focus] : null;
  return (
    <div className="lp3-drawer" role="dialog" aria-modal="true" aria-labelledby="lp3-drawer-h">
      <div className="lp3-drawer-panel">
        <div className="lp3-drawer-head">
          <h2 id="lp3-drawer-h">Details</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <QualityChips data={data} hardware={hardware} />
        {reason && (
          <section>
            <h3>{focus} reason</h3>
            <p>{reason.reason}</p>
            {!evidence && reason.status === 'pass' && <p role="status">Evidence is incomplete; this is not shown as a green mission pass in the cards.</p>}
          </section>
        )}
        {evaluation && evaluation.unresolved.length > 0 && (
          <section>
            <h3>Unresolved inputs</h3>
            <ul>{evaluation.unresolved.map(u => <li key={u}>{u}</li>)}</ul>
          </section>
        )}
        <ComparisonTable alternatives={alternatives} yawDeg={yawDeg} currentIndex={currentIndex} onSelect={onSelect} />
      </div>
      <button type="button" className="lp3-drawer-scrim" aria-label="Close details" onClick={onClose} />
    </div>
  );
}
