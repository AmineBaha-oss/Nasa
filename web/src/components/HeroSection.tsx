import { useEffect, useRef } from 'react';
import type { EphemerisSample, HardwareConfig, SiteDateData } from '../contracts';
import { formatDeg, formatUtc } from './geometry';
import { HorizonWheel } from './HorizonWheel';

interface Props { data: SiteDateData; sample: EphemerisSample | null; yawDeg: number; hardware: HardwareConfig | null; }

/** Full-screen opening: regolith field with slow mouse parallax, monumental question, orbiting dial, telemetry ticker. */
export function HeroSection({ data, sample, yawDeg, hardware }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hero = heroRef.current, ground = groundRef.current;
    if (!hero || !ground || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, x = 0, y = 0;
    const move = (e: MouseEvent) => {
      const b = hero.getBoundingClientRect();
      x = (e.clientX - b.left) / b.width - 0.5; y = (e.clientY - b.top) / b.height - 0.5;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; ground.style.transform = `translate3d(${(-x * 18).toFixed(1)}px, ${(-y * 12).toFixed(1)}px, 0) scale(1.04)`; });
    };
    hero.addEventListener('mousemove', move);
    return () => { hero.removeEventListener('mousemove', move); cancelAnimationFrame(frame); };
  }, []);

  const telemetry = [
    ['SITE', data.site.name],
    ['LAT', `${data.site.latitudeDeg.toFixed(4)}°`],
    ['LON', `${data.site.longitudeEastDeg.toFixed(4)}°E`],
    ['UTC', sample ? formatUtc(sample.utc) : 'unknown'],
    ['HDG', `${String(yawDeg).padStart(3, '0')}°`],
    ['SUN EL', formatDeg(sample?.sun?.elDeg)],
    ['EARTH EL', formatDeg(sample?.earth?.elDeg)],
    ['DATA', data.purpose === 'synthetic-test' ? 'SYNTHETIC' : 'RESEARCH'],
  ];
  const strip = telemetry.map(([k, v]) => <span key={k} className="lp-tick-item"><b>{k}</b> {v}</span>);

  return (
    <section ref={heroRef} className="lp-hero" aria-labelledby="lp-hero-h">
      <div ref={groundRef} className="lp-hero-ground" aria-hidden="true" />
      <div className="lp-hero-grid" aria-hidden="true" />
      <div className="lp-hero-copy">
        <p className="lp-wordmark">Landerprint</p>
        <h1 id="lp-hero-h">Which way should<br />the lander <span className="lp-outline">face?</span></h1>
        <p className="lp-lede">Site · UTC window · heading. Dial shows Sun and Earth above the local terrain.</p>
      </div>
      <div className="lp-hero-dial">
        <HorizonWheel sunHorizon={data.sunHorizon} earthHorizon={data.earthHorizon} sample={sample} yawDeg={yawDeg} hardware={hardware} decorative />
      </div>
      <a className="lp-scroll-cue" href="#lp-cockpit"><span className="lp-scroll-line" aria-hidden="true" />Setup</a>
      <div className="lp-ticker" role="group" aria-label="Telemetry">
        <div className="lp-ticker-track">
          <div className="lp-ticker-run">{strip}</div>
          <div className="lp-ticker-run" aria-hidden="true">{strip}</div>
        </div>
      </div>
    </section>
  );
}
