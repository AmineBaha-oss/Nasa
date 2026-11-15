import type { HardwareConfig } from '../contracts';
import { bodyVectorAzimuthDeg, bodyVectorElevationDeg, formatDeg } from './geometry';
import { useUnwrappedAngle } from './useUnwrappedAngle';

interface Props {
  hardware: HardwareConfig | null; yawDeg: number; animateTurn?: boolean;
  /** Sun azimuth for the illustrative shadow direction; null hides the shadow. */
  sunAzDeg?: number | null;
}

/** Top-down lander in a glass porthole. Drawing only: directions come from the preset; the shadow is illustrative. */
export function LanderTopDown({ hardware, yawDeg, animateTurn = false, sunAzDeg = null }: Props) {
  const turn = useUnwrappedAngle(yawDeg);
  if (!hardware) {
    return <div className="lp-empty" role="status">No hardware preset loaded.</div>;
  }
  const antennaAz = bodyVectorAzimuthDeg(hardware.antenna.boresightBodyRFU);
  // Shadow falls away from the Sun: azimuth + 180°, offset of 45% of the body size.
  const shadow = sunAzDeg === null ? null : (() => {
    const a = (sunAzDeg + 180) * Math.PI / 180;
    return { x: Math.sin(a) * 45, y: -Math.cos(a) * 45 };
  })();
  return (
    <figure className="lp-lander">
      <div className="lp-porthole" role="img" aria-label={`Lander ${hardware.name} rotated to ${yawDeg}° heading`}>
        <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false" className="lp-porthole-face">
          <circle cx={120} cy={120} r={104} className="lp-lander-ring" />
          <text x={120} y={30} className="lp-cardinal">N</text>
        </svg>
        {shadow && <div className="lp-lander-shadow" style={{ transform: `translate(${shadow.x}%, ${shadow.y}%)` }} aria-hidden="true" />}
        {/* Own HTML layer: turning the lander is a compositor-only transform. */}
        <div className={animateTurn ? 'lp-lander-turn is-animated' : 'lp-lander-turn'} style={{ transform: `rotate(${turn.current}deg)` }} aria-hidden="true">
          <svg viewBox="0 0 240 240" focusable="false">
            <rect x={90} y={90} width={60} height={60} rx={4} className="lp-body" />
            <path d="M120 96 L128 110 L112 110 Z" className="lp-forward" />
            {hardware.panels.map(p => {
              const az = bodyVectorAzimuthDeg(p.normalBodyRFU);
              return az === null
                ? <rect key={p.name} x={100} y={116} width={40} height={24} className="lp-panel" />
                : <rect key={p.name} x={97} y={52} width={46} height={10} className="lp-panel" transform={`rotate(${az} 120 120)`} />;
            })}
            {antennaAz !== null && <line x1={120} y1={120} x2={120} y2={30} className="lp-antenna" transform={`rotate(${antennaAz} 120 120)`} />}
            {hardware.rampHeadingBodyDeg !== undefined &&
              <path d="M110 90 L130 90 L136 44 L104 44 Z" className="lp-ramp" data-ramp-body-deg={hardware.rampHeadingBodyDeg} transform={`rotate(${hardware.rampHeadingBodyDeg} 120 120)`} />}
          </svg>
        </div>
        <span className="lp-glass" aria-hidden="true" />
      </div>
      <figcaption>
        <p className="lp-hw-name"><strong>{hardware.name}</strong> <span className={`lp-badge lp-badge-${hardware.identity}`}>{hardware.identity}</span></p>
        <p className="lp-hint">{hardware.panels.length === 1 ? '1 panel' : `${hardware.panels.length} panels`} · {hardware.totalActivePvAreaM2} m² · beam ±{hardware.antenna.beamHalfAngleDeg}°{shadow ? ' · shadow illustrative' : ''}</p>
        <details className="lp-more">
          <summary>Hardware geometry</summary>
          <ul className="lp-legend lp-hw-sheet">
            {hardware.panels.map(p => (
              <li key={p.name}><span className="lp-key lp-key-panel" />{p.name}: {p.mode}, {(p.areaFraction * 100).toFixed(0)}% of {hardware.totalActivePvAreaM2} m²,
                normal {bodyVectorAzimuthDeg(p.normalBodyRFU) === null ? 'body-up' : `${formatDeg(bodyVectorAzimuthDeg(p.normalBodyRFU), 0)} from forward`}, tilt {formatDeg(bodyVectorElevationDeg(p.normalBodyRFU), 0)}
                {p.mode === 'tracked' && p.maxTrackingAngleDeg === undefined ? ' (ideal unconstrained tracking)' : ''}.</li>
            ))}
            <li><span className="lp-key lp-key-antenna" />Antenna {antennaAz === null ? 'body-up' : `${formatDeg(antennaAz, 0)} from forward`}, el {formatDeg(bodyVectorElevationDeg(hardware.antenna.boresightBodyRFU), 0)}, half-beam {hardware.antenna.beamHalfAngleDeg}°{hardware.antenna.gimbal ? ', gimballed' : ', fixed'}</li>
            {hardware.rampHeadingBodyDeg !== undefined && <li><span className="lp-key lp-key-ramp" />Ramp {hardware.rampHeadingBodyDeg}° from forward</li>}
            {shadow && <li><span className="lp-key lp-key-shadow" />Shadow direction from Sun azimuth (illustrative)</li>}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}
