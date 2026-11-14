import { memo, useState } from 'react';
import type { HardwareConfig, SiteDateData } from '../contracts';
import { qualityDisclosures } from './disclosures';

interface Props { data: SiteDateData; hardware: HardwareConfig | null; }

const glyph = { critical: '■', caution: '▲', info: '●' } as const;

/**
 * Cockpit warning band stuck to the top of the page. Collapsed it still shows the most severe limit
 * and the count; "Show all" expands the full list. It can never be dismissed, and every chart also
 * carries its own quality chips.
 */
export const DataQualityNotice = memo(function DataQualityNotice({ data, hardware }: Props) {
  const [open, setOpen] = useState(false);
  const items = qualityDisclosures(data, hardware);
  const worst = items[0];
  return (
    <section className={open ? 'lp-notice is-open' : 'lp-notice'} aria-labelledby="lp-notice-h">
      <div className="lp-notice-bar">
        <h2 id="lp-notice-h">What this view can't tell you</h2>
        {!open && worst && <p className={`lp-disclosure lp-disclosure-${worst.tone} lp-notice-worst`}>
          <span className="lp-glyph" aria-hidden="true">{glyph[worst.tone]}</span>{worst.text}
          {items.length > 1 && <span className="lp-notice-more"> +{items.length - 1} more</span>}</p>}
        <button type="button" className="lp-notice-toggle" aria-expanded={open} aria-controls="lp-notice-list" onClick={() => setOpen(o => !o)}>
          {open ? 'Collapse' : `Show all ${items.length}`}
        </button>
      </div>
      <ul id="lp-notice-list" hidden={!open}>
        {items.map(d => (
          <li key={d.text} className={`lp-disclosure lp-disclosure-${d.tone}`}>
            <span className="lp-glyph" aria-hidden="true">{glyph[d.tone]}</span>{d.text}
          </li>
        ))}
      </ul>
    </section>
  );
});
