import type { HardwareConfig, SiteDateData } from '../contracts';
import { qualityDisclosures } from './disclosures';

interface Props { data: SiteDateData; hardware: HardwareConfig | null; }

export function DataQualityNotice({ data, hardware }: Props) {
  return (
    <section className="lp-notice" aria-labelledby="lp-notice-h">
      <h2 id="lp-notice-h">Data limits for this view</h2>
      <ul>
        {qualityDisclosures(data, hardware).map(d => <li key={d.text} className={`lp-disclosure lp-disclosure-${d.tone}`}>{d.text}</li>)}
      </ul>
      <p className="lp-hint">Site {data.site.name}: {data.site.latitudeDeg.toFixed(6)}° lat, {data.site.longitudeEastDeg.toFixed(6)}° lon (east-positive). {data.site.label}</p>
    </section>
  );
}
