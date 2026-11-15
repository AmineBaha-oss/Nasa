import type { ConstraintResult, HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../contracts';
import { evaluateAntennaWindow } from '../engine/comms';
import { evaluatePowerWindow } from '../engine/power';
import { evaluateDeployment, type DeploymentThresholds } from '../engine/terrain';
import { ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS } from './hardware';

function deploymentFor(data: SiteDateData, terrain: SiteTerrain | null, hardware: HardwareConfig, yawDeg: number,
  thresholds: DeploymentThresholds): { deployment: ConstraintResult; unresolved: string[] } {
  const unknown = (reason: string) => ({ deployment: { status: 'unknown' as const, reason, sourceIds: [] }, unresolved: [reason] });
  if (!terrain) return unknown(`No terrain patch loaded for ${data.site.id}; deployment unknown.`);
  if (terrain.siteId !== data.site.id) return unknown(`Terrain patch is for ${terrain.siteId}, not ${data.site.id}; deployment unknown.`);
  if (terrain.purpose !== data.purpose) return unknown(`Terrain purpose "${terrain.purpose}" differs from data purpose "${data.purpose}"; deployment unknown.`);
  const result = evaluateDeployment(data.site, { dem: terrain.dem, slope5m: terrain.slope5m }, hardware, yawDeg, thresholds);
  return { deployment: result.deployment, unresolved: result.unresolved };
}

/**
 * All four checks for one site/window, hardware and heading, from the same SiteDateData samples.
 * Each engine keeps its own status and reason; nothing here ranks headings or overrides a result.
 */
export function evaluateHeading(data: SiteDateData, terrain: SiteTerrain | null, hardware: HardwareConfig, yawDeg: number,
  thresholds: DeploymentThresholds = ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS): HeadingEvaluation {
  const power = evaluatePowerWindow(data, hardware, yawDeg);
  const comms = evaluateAntennaWindow(data, hardware, yawDeg);
  const deploy = deploymentFor(data, terrain, hardware, yawDeg, thresholds);
  const utc = data.samples.map(s => s.utc).sort();
  return {
    yawDeg,
    siteId: data.site.id,
    startUtc: utc[0] ?? '',
    endUtc: utc[utc.length - 1] ?? '',
    solar: power.solar,
    battery: power.battery,
    antenna: comms.antenna,
    deployment: deploy.deployment,
    minimumBatteryWh: power.minimumBatteryWh,
    contactHours: comms.contactHours,
    unresolved: [...new Set([...power.unresolved, ...comms.unresolved, ...deploy.unresolved])],
  };
}

/** Evaluator for NavigatorPage, bound to the loaded terrain and memoised per dataset, hardware and yaw. */
export function createEvaluator(terrainBySite: ReadonlyMap<string, SiteTerrain>,
  thresholds: DeploymentThresholds = ILLUSTRATIVE_DEPLOYMENT_THRESHOLDS) {
  const cache = new WeakMap<SiteDateData, WeakMap<HardwareConfig, Map<number, HeadingEvaluation>>>();
  return (data: SiteDateData, hardware: HardwareConfig, yawDeg: number): HeadingEvaluation => {
    let byHardware = cache.get(data);
    if (!byHardware) cache.set(data, byHardware = new WeakMap());
    let byYaw = byHardware.get(hardware);
    if (!byYaw) byHardware.set(hardware, byYaw = new Map());
    let result = byYaw.get(yawDeg);
    if (!result) {
      result = evaluateHeading(data, terrainBySite.get(data.site.id) ?? null, hardware, yawDeg, thresholds);
      byYaw.set(yawDeg, result);
    }
    return result;
  };
}
