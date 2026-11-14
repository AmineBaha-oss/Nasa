import { memo } from 'react';
import type { HardwareConfig, SiteDateData } from '../contracts';
import { qualityDisclosures } from './disclosures';

interface Props { data: SiteDateData; hardware: HardwareConfig | null; }

const glyph = { critical: '■', caution: '▲', info: '●' } as const;

/** Limits that apply to everything on screen, most severe first. Always visible, never collapsed. */
export const DataQualityNotice = memo(function DataQualityNotice({ data, hardware }: Props) {
  return (
    <section className="lp-notice" aria-labelledby="lp-notice-h">
      <h2 id="lp-notice-h">What this view can't tell you</h2>
      <ul>
        {qualityDisclosures(data, hardware).map(d => (
          <li key={d.text} className={`lp-disclosure lp-disclosure-${d.tone}`}>
            <span className="lp-glyph" aria-hidden="true">{glyph[d.tone]}</span>{d.text}
          </li>
        ))}
      </ul>
    </section>
  );
});
