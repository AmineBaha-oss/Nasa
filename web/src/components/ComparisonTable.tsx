import type { ConstraintResult, HeadingEvaluation, SiteDateData } from '../contracts';
import { statusPresentation } from './ConstraintCard';
import { periodLabel } from './SelectionPanel';

export interface Alternative { data: SiteDateData; evaluation: HeadingEvaluation | null; evidenceComplete: boolean; }

const cell = (r: ConstraintResult | null, ok: boolean) => {
  const s = statusPresentation(r, ok);
  return <td className={`lp-tone-${s.tone}`} title={r?.reason || 'No engine result'}>{s.label}</td>;
};

/** Side-by-side site/date summaries at the same heading. Order follows the data; no "best" ranking. */
export function ComparisonTable({ alternatives, yawDeg }: { alternatives: Alternative[]; yawDeg: number }) {
  return (
    <section aria-labelledby="lp-cmp-h" className="lp-compare">
      <h2 id="lp-cmp-h">Alternatives at heading {yawDeg}°</h2>
      <div className="lp-table-wrap">
        <table>
          <thead><tr><th scope="col">Site</th><th scope="col">UTC period</th><th scope="col">Solar</th><th scope="col">Battery</th>
            <th scope="col">Antenna</th><th scope="col">Deployment</th><th scope="col">Min battery (Wh)</th><th scope="col">Contact (h)</th><th scope="col">Unresolved</th></tr></thead>
          <tbody>
            {alternatives.map(({ data, evaluation: e, evidenceComplete: ok }, i) => (
              <tr key={i}>
                <th scope="row">{data.site.name}{data.purpose === 'synthetic-test' ? ' (synthetic)' : ''}</th>
                <td>{periodLabel(data)}</td>
                {cell(e?.solar ?? null, ok)}{cell(e?.battery ?? null, ok)}{cell(e?.antenna ?? null, ok)}{cell(e?.deployment ?? null, ok)}
                <td>{e?.minimumBatteryWh ?? 'unknown'}</td><td>{e?.contactHours ?? 'unknown'}</td>
                <td>{e ? e.unresolved.length : 'engine not connected'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
