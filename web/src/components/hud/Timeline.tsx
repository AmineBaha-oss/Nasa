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
    timer.current = window.setInterval(() => onSample(Math.min(sampleIndex + 1, n - 1)), 1000 / speed);
    return () => window.clearInterval(timer.current);
  }, [playing, speed, sampleIndex, n, onSample, reducedMotion]);

  useEffect(() => {
    if (playing && sampleIndex >= n - 1) onPlaying(false);
  }, [playing, sampleIndex, n, onPlaying]);

  const strip = useMemo(() => {
    const W = 1000, H = 44;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const els = sun.map(s => s.elDeg);
    const known = els.filter((v): v is number => v !== null);
    const lo = Math.min(-2, ...known), hi = Math.max(2, ...known);
    const y = (v: number) => H - 5 - ((v - lo) / (hi - lo)) * (H - 10);
    const line = els.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
    const area = line ? `0,${H} ${line} ${W},${H}` : '';
    const batKnown = batteryWh.filter((b): b is Interval => b !== null);
    const bLo = batKnown.length ? Math.min(...batKnown.map(b => b.low)) : 0;
    const bHi = batKnown.length ? Math.max(...batKnown.map(b => b.high)) : 1;
    const days: { x: number; label: string }[] = [];
    data.samples.forEach((s, i) => { if (s.utc.slice(11, 13) === '00') days.push({ x: x(i), label: s.utc.slice(5, 10) }); });
    return { W, H, x, y, line, area, bLo, bHi, horizonY: y(0), days };
  }, [sun, batteryWh, n, data.samples]);

  const sunNow = sun[sampleIndex];
  const step = (d: number) => onSample(Math.max(0, Math.min(n - 1, sampleIndex + d)));
  return (
    <div className="lp3-timeline" role="group" aria-label="Sample timeline">
      <div className="lp3-timeline-row">
        <button type="button" className="lp3-play" onClick={() => onPlaying(!playing)} disabled={reducedMotion || n < 2}
          aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play'} title={reducedMotion ? 'Playback is off because reduced motion is on' : playing ? 'Pause (Space)' : 'Play (Space)'}>
          {playing
            ? <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" /></svg>
            : <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z" /></svg>}
        </button>
        <button type="button" className="lp3-step" onClick={() => step(-1)} aria-label="Previous hour" title="Previous hour (,)">−1 h</button>
        <button type="button" className="lp3-step" onClick={() => step(1)} aria-label="Next hour" title="Next hour (.)">+1 h</button>
        <div className="lp3-utc">
          <strong>{sample ? formatUtc(sample.utc) : '—'}</strong>
          <span>
            Sun elevation {sunNow?.elDeg != null ? `${sunNow.elDeg.toFixed(1)}°` : 'unknown'}
            {sunNow?.azDeg != null && `, azimuth ${Math.round(sunNow.azDeg)}°`}
          </span>
        </div>
        <div className="lp3-speed" role="group" aria-label="Playback speed">
          {PLAY_SPEEDS.map(s => (
            <button key={s} type="button" aria-pressed={speed === s} className={speed === s ? 'is-active' : undefined} onClick={() => onSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>
      <div className="lp3-scrub">
        <svg viewBox={`0 0 ${strip.W} ${strip.H}`} className="lp3-strip" aria-hidden="true" focusable="false" preserveAspectRatio="none">
          {earth.map((e, i) => e.visible === 'pass'
            ? <rect key={`e${i}`} x={strip.x(i)} y={0} width={Math.max(1, strip.W / Math.max(1, n - 1))} height={4} className="lp3-strip-earth" />
            : null)}
          {strip.days.map(d => <line key={d.label} x1={d.x} x2={d.x} y1={0} y2={strip.H} className="lp3-strip-day" />)}
          <line x1={0} x2={strip.W} y1={strip.horizonY} y2={strip.horizonY} className="lp3-strip-horizon" />
          {n > 1 && strip.area && <polygon points={strip.area} className="lp3-strip-sun-area" />}
          {n > 1 && <polyline points={strip.line} className="lp3-strip-sun" vectorEffect="non-scaling-stroke" />}
          {batteryWh.map((b, i) => {
            if (!b) return null;
            const mid = (b.low + b.high) / 2;
            const yy = strip.H - 3 - ((mid - strip.bLo) / Math.max(1e-6, strip.bHi - strip.bLo)) * (strip.H - 10);
            return <circle key={`b${i}`} cx={strip.x(i)} cy={yy} r={1.4} className="lp3-strip-bat" />;
          })}
          <line x1={strip.x(sampleIndex)} x2={strip.x(sampleIndex)} y1={0} y2={strip.H} className="lp3-strip-cursor" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="lp3-strip-days" aria-hidden="true">
          {strip.days.map(d => <span key={d.label} style={{ left: `${(d.x / strip.W) * 100}%` }}>{d.label}</span>)}
        </div>
        <input type="range" min={0} max={Math.max(0, n - 1)} value={sampleIndex} aria-valuetext={sample ? formatUtc(sample.utc) : 'none'}
          onChange={e => onSample(Number(e.target.value))} aria-label="Sample time" />
      </div>
      <p className="lp3-strip-legend">
        <span><i className="is-sun" />Sun elevation (geometric)</span>
        <span><i className="is-earth" />Earth visible</span>
        <span><i className="is-bat" />Battery</span>
      </p>
    </div>
  );
}
