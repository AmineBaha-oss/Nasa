import type { HardwareConfig } from '../contracts';
import { bodyVectorAzimuthDeg, bodyVectorElevationDeg, formatDeg } from './geometry';
import { useUnwrappedAngle } from './useUnwrappedAngle';

interface Props { hardware: HardwareConfig | null; yawDeg: number; animateTurn?: boolean; }

/** Top-down lander body rotated by yaw. Drawing only: panel/antenna directions come from the preset. */
export function LanderTopDown({ hardware, yawDeg, animateTurn = false }: Props) {
  const turnDeg = useUnwrappedAngle(yawDeg);
  if (!hardware) {
    return <div className="lp-empty" role="status">No hardware preset loaded. The lead must approve a preset (see docs/INPUT_REQUESTS.md).</div>;
  }
  const antennaAz = bodyVectorAzimuthDeg(hardware.antenna.boresightBodyRFU);
  return (
    <figure className="lp-lander">
      <svg viewBox="0 0 240 240" width={240} height={240} role="img" aria-label={`Lander ${hardware.name} rotated to ${yawDeg}° heading`}>
        <circle cx={120} cy={120} r={104} className="lp-lander-ring" />
        <text x={120} y={12} className="lp-cardinal">N</text>
        <g className={animateTurn ? 'lp-lander-turn is-animated' : 'lp-lander-turn'} style={{ transform: `rotate(${turnDeg}deg)` }}>
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
        </g>
      </svg>
      <figcaption>
        <p><strong>{hardware.name}</strong> <span className={`lp-badge lp-badge-${hardware.identity}`}>{hardware.identity}</span></p>
        <ul className="lp-legend">
          {hardware.panels.map(p => (
            <li key={p.name}><span className="lp-key lp-key-panel" />{p.name}: {p.mode}, {(p.areaFraction * 100).toFixed(0)}% of {hardware.totalActivePvAreaM2} m²,
              normal {bodyVectorAzimuthDeg(p.normalBodyRFU) === null ? 'body-up' : `${formatDeg(bodyVectorAzimuthDeg(p.normalBodyRFU), 0)} from forward`}, tilt {formatDeg(bodyVectorElevationDeg(p.normalBodyRFU), 0)}
              {p.mode === 'tracked' && p.maxTrackingAngleDeg === undefined ? ' (ideal unconstrained tracking)' : ''}</li>
          ))}
          <li><span className="lp-key lp-key-antenna" />Antenna boresight {antennaAz === null ? 'body-up' : `${formatDeg(antennaAz, 0)} from forward`}, elevation {formatDeg(bodyVectorElevationDeg(hardware.antenna.boresightBodyRFU), 0)}, half-beam {hardware.antenna.beamHalfAngleDeg}°{hardware.antenna.gimbal ? ', gimballed' : ', fixed'}</li>
          {hardware.rampHeadingBodyDeg !== undefined && <li><span className="lp-key lp-key-ramp" />Ramp {hardware.rampHeadingBodyDeg}° from forward</li>}
        </ul>
      </figcaption>
    </figure>
  );
}
