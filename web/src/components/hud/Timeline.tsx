import { useEffect, useMemo, useRef } from 'react';
import type { SiteDateData } from '../../contracts';
import type { Interval } from '../../engine/power';
import type { TrackPoint } from '../../scene3d/readouts';
import { formatUtc } from '../geometry';
import type { PlaySpeed } from '../../state/navigatorState';
import { PLAY_SPEEDS } from '../../state/urlHash';

interface Props {
  data: SiteDateData;
  sampleIndex: number;
  onSample: (i: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  speed: PlaySpeed;
  onSpeed: (s: PlaySpeed) => void;
  sun: TrackPoint[];
  earth: TrackPoint[];
  batteryWh: (Interval | null)[];
  reducedMotion: boolean;
}

export function Timeline({ data, sampleIndex, onSample, playing, onPlaying, speed, onSpeed, sun, earth, batteryWh, reducedMotion }: Props) {
  const n = data.samples.length;
  const sample = data.samples[Math.min(sampleIndex, n - 1)];
  const timer = useRef(0);

  useEffect(() => {
    if (!playing || reducedMotion || n < 2) return;
    const ms = 1000 / speed;
    timer.current = window.setInterval(() => {
      onSample(Math.min(sampleIndex + 1, n - 1));
    }, ms);
    return () => window.clearInterval(timer.current);
  }, [playing, speed, sampleIndex, n, onSample, reducedMotion]);

  useEffect(() => {
    if (playing && sampleIndex >= n - 1) onPlaying(false);
  }, [playing, sampleIndex, n, onPlaying]);

  const strip = useMemo(() => {
    const W = 400, H = 36;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const els = sun.map(s => s.elDeg);
    const known = els.filter((v): v is number => v !== null);
    const lo = Math.min(-2, ...known, -2), hi = Math.max(2, ...known, 2);
    const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8);
    const line = els.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
    const batKnown = batteryWh.filter((b): b is Interval => b !== null);
    const bLo = batKnown.length ? Math.min(...batKnown.map(b => b.low)) : 0;
    const bHi = batKnown.length ? Math.max(...batKnown.map(b => b.high)) : 1;
    return { W, H, x, y, line, bLo, bHi };
  }, [sun, batteryWh, n]);

  return (
    <div className="lp3-timeline" role="group" aria-label="Sample timeline">
      <svg viewBox={`0 0 ${strip.W} ${strip.H}`} className="lp3-strip" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        {earth.map((e, i) => e.visible === 'pass'
          ? <rect key={`e${i}`} x={strip.x(i)} y={0} width={Math.max(1, strip.W / Math.max(1, n))} height={strip.H} className="lp3-strip-earth" />
          : null)}
        {batteryWh.map((b, i) => {
          if (!b) return null;
          const mid = (b.low + b.high) / 2;
          const yy = strip.H - 2 - ((mid - strip.bLo) / Math.max(1e-6, strip.bHi - strip.bLo)) * (strip.H - 4);
          return <circle key={`b${i}`} cx={strip.x(i)} cy={yy} r={1.2} className="lp3-strip-bat" />;
        })}
        {n > 1 && <polyline points={strip.line} className="lp3-strip-sun" />}
        <line x1={strip.x(sampleIndex)} x2={strip.x(sampleIndex)} y1={0} y2={strip.H} className="lp3-strip-cursor" />
      </svg>
      <div className="lp3-timeline-row">
        <button type="button" onClick={() => onSample(Math.max(0, sampleIndex - 1))} aria-label="Previous hour">−1 h</button>
        <button type="button" onClick={() => onPlaying(!playing)} disabled={reducedMotion || n < 2}
          aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</button>
        <label className="lp3-speed">Speed
          <select value={speed} onChange={e => onSpeed(Number(e.target.value) as PlaySpeed)} aria-label="Playback speed">
            {PLAY_SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <input type="range" min={0} max={Math.max(0, n - 1)} value={sampleIndex} aria-valuetext={sample ? formatUtc(sample.utc) : 'none'}
          onChange={e => onSample(Number(e.target.value))} aria-label="Sample time" />
        <button type="button" onClick={() => onSample(Math.min(n - 1, sampleIndex + 1))} aria-label="Next hour">+1 h</button>
        <span className="lp3-utc">{sample ? formatUtc(sample.utc) : '—'}</span>
      </div>
      <p className="lp3-strip-legend">Strip: orange Sun elevation · blue Earth-visible spans · dots battery. Skyline and sky not to distance scale.</p>
    </div>
  );
}
