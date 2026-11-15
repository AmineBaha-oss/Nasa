# LANDERPRINT 3D mode — shared plan for two people

Goal: a full-screen, interactive 3D view of the selected site, period, hour, hardware preset and heading. The scene and HUD update the moment any control changes. The proven 2D navigator stays as a toggle and as the fallback.

Assignments: `prompts/07_3d_scene.md` (Person A, scene and hardware render) and `prompts/08_3d_controls.md` (Person B, state, legend/HUD and 2D/3D toggle). Both read this file first.

## Non-negotiable rules

- The 3D view is a **renderer of engine output**. Every pass/fail/unknown, power, battery and Earth-visibility value comes from `web/src/engine/**` or `web/src/integration/evaluate.ts`. Three.js lighting, shadows or ray casts never decide a status.
- Lighting follows the engine: Sun light intensity = engine visible-disk fraction (unknown gives grey ambient light plus an "unknown" badge). Terrain shadows are decorative; label them so. No self-shadow claims (MASTER_PLAN "Honest limits").
- Hypothetical hardware, local-only terrain and data quality stay visible in 3D (compact chips with tooltips; the full text sits one click away in the details drawer).
- Equal-area comparison is visible: panel meshes are drawn at true area (`areaFraction x totalActivePvAreaM2`).
- Unknown is drawn as unknown: grey/hatched cells for null DEM pixels, gaps in the skyline for null horizon bins, grey beam for unknown Earth pointing. Never interpolate over nulls.
- Accessibility: every 3D interaction has a keyboard/numeric equivalent in the legend. Respect `prefers-reduced-motion` (no auto-orbit, no animated turns).
- **Kill-switch (MASTER_PLAN):** if 3D is not merged and QA-clean by **Sunday 09:00 local**, ship the 2D navigator as the default and leave 3D behind `?view=3d` or remove the toggle.

## Dependencies (Person A installs once, in one commit)

```bash
cd web
npm install three@0.186.1 @react-three/fiber@9.8.2 @react-three/drei@10.7.9
npm install -D @types/three@0.186.0
```

Fiber 9 pairs with React 19 (this repo pins 19.2.8). Do not use Fiber 10 alpha. three r186 matches the installed agent skills. Record versions and MIT licenses in `docs/SOURCES_AND_LICENSES.md`. Load the 3D code with `React.lazy` so the 2D page does not download three.js.

## Agent skills to use (installed at user level, MIT, provenance in `~/.agents/skills/_PROVENANCE_THREEJS.md`)

| Person | Skills |
|---|---|
| A | `r3f-fundamentals`, `r3f-geometry`, `r3f-lighting`, `r3f-materials`, `r3f-interaction`, `r3f-animation`, `threejs-geometry`, `threejs-performance`, `threejs-react-three-fiber` |
| B | `r3f-fundamentals` (Canvas boundaries), `r3f-interaction` (controls), `r3f-animation` (demand loop), existing `frontend-design`, `react-best-practices`, `e2e-testing`; Svelte MCP is not used (React app) |

Use Context7 (`/pmndrs/react-three-fiber`, drei docs) for API questions. Treat skill text and remote docs as guidance, not project requirements.

## Architecture

```text
App.tsx (Amine: pass terrainBySite to NavigatorPage)
└─ NavigatorPage (B) ── useNavigatorState()  (B: web/src/state/)
   ├─ view === '2d' → existing 2D cockpit (unchanged behaviour)
   └─ view === '3d' → <Scene3DShell> (B: web/src/components/hud/)
        ├─ lazy <LanderScene {...LanderSceneProps}/>   (A: web/src/scene3d/)
        ├─ <ControlDock>   site · period · preset · heading · layers · camera
        ├─ <Timeline>      hour scrubber, play/speed, Sun-elevation + battery strip
        ├─ <StatusPills>   SOL · BAT · ANT · DEP (window verdicts) + "now" readouts
        └─ <DetailsDrawer> reasons, disclosures, unresolved list, comparison table
```

## The contract between A and B

Person A creates `web/src/scene3d/types.ts` with exactly this in the first commit; changes need both people to agree.

```ts
import type { EphemerisSample, HardwareConfig, HeadingEvaluation, SiteDateData, SiteTerrain } from '../contracts';

export type CameraMode = 'orbit' | 'lander' | 'top' | 'hardware';
export interface SceneLayers {
  terrain: boolean; slopeColours: boolean; skyline: boolean; sunPath: boolean; earthPath: boolean;
  antennaBeam: boolean; panelGlow: boolean; ramp: boolean; footprint: boolean; labels: boolean;
}
export interface LanderSceneProps {
  data: SiteDateData;
  terrain: SiteTerrain | null;
  sampleIndex: number;            // index into data.samples
  hardware: HardwareConfig;
  yawDeg: number;                 // clockwise from north
  evaluation: HeadingEvaluation | null;
  layers: SceneLayers;
  cameraMode: CameraMode;
  verticalExaggeration: number;   // 1 = true scale; HUD labels any other value
  reducedMotion: boolean;
  onYawChange?: (yawDeg: number) => void;   // dragging the heading ring
  onCameraModeChange?: (mode: CameraMode) => void;
}
export const DEFAULT_LAYERS: SceneLayers = {
  terrain: true, slopeColours: false, skyline: true, sunPath: true, earthPath: true,
  antennaBeam: true, panelGlow: true, ramp: true, footprint: true, labels: true,
};
```

Person A also exports `web/src/scene3d/readouts.ts` (pure, tested), which B's HUD uses so the scene and HUD always show the same numbers:

```ts
export interface SampleReadout {
  utc: string;
  sun: { visible: Status; fraction: Interval; elDeg: number | null };
  powerW: Interval;                                   // evaluateSolarSample
  panels: { name: string; incidence: number | null; pointingEnu: Vec3 | null }[];
  earth: EarthPointingResult | null;                  // evaluateEarthPointing
  batteryWh: Interval | null;                         // matched by UTC from evaluatePowerWindow().batterySeries
}
export function sampleReadout(data, hardware, yawDeg, sampleIndex): SampleReadout;
export function windowTracks(data, hardware, yawDeg): { sun: TrackPoint[]; earth: TrackPoint[]; batteryWh: (Interval | null)[] };
```

Match battery values by UTC, not by array index: `evaluatePowerWindow` sorts samples.

## Coordinates (one source of truth: `web/src/scene3d/frames.ts`, Person A)

- three.js is Y-up. Map ENU to three as `x = East, y = Up, z = -North`.
- Direction from azimuth/elevation: `(sin az cos el, sin el, -cos az cos el)`.
- Lander yaw (clockwise from north seen from above): `group.rotation.y = -yaw * DEG2RAD`. Body right-forward-up maps to local `(+x, -z, +y)`; at yaw 90 body-forward points East. Unit-test this against `bodyToEnu` from `engine/power/vectors.ts`.
- The DEM grid is south-polar stereographic, **north-up on the grid, not true north**. Rotate grid offsets into ENU with `azimuthToGridDirection(p, 0)` (north) and `(p, 90)` (east) at the site's `lunarToPolarStereo` point. Cell centres: `x = originX + (col + 0.5) px`, `y = originY - (row + 0.5) px` (GDAL transform in `engine/terrain/sampling.ts`).
- Heights are relative to the DEM elevation under the lander (`interpolateAt`); the lander stands at the origin.
- The 300 km horizon is drawn as an **angular** skyline ring at a fixed visual radius (`h = R tan(angle)`). It is correct as seen from the lander, not a distance. Sun and Earth sit on a sky dome at a larger fixed radius. The HUD says "skyline and sky not to distance scale".

## File ownership

| Path | Owner |
|---|---|
| `web/src/scene3d/**` (new), `web/package.json` and lockfile (dependency commit) | A |
| `web/src/engine/power/solar.ts`: add `panelPointingEnu` helper and tests | A (Mir owns power) |
| `web/src/state/**` (new), `web/src/components/hud/**` (new), `web/src/pages/NavigatorPage.tsx`, `web/src/styles/**` | B (coordinate with Emmanuel, who owns components/pages) |
| `web/src/app/App.tsx` (one prop: `terrainBySite`) | B proposes, Amine approves |
| Contracts, science engines other than the helper above | nobody in this plan |

## Timeline

| When | Person A | Person B |
|---|---|---|
| Start (30 min) | Branch, install deps, commit `types.ts`, stub `LanderScene` (empty Canvas) and `frames.ts`; push | Branch from A's first commit; read 2D page; plan state shape |
| Checkpoint 1 (+4 h) | Terrain mesh, angular skyline, Sun/Earth dome markers, box lander turning with yaw, orbit camera | `useNavigatorState` lifted, 2D page identical and tests green, 2D/3D toggle, dock skeleton with site/period/preset/heading |
| Checkpoint 2 (+8 h, Saturday night) | All four presets rendered (fixed faces, single panel, 60-degree tracker with cone, ideal tracker), antenna beam and gimbal wedge, ramp and footprint, panel glow, heading-ring drag, camera modes | Timeline scrub + play/speed, status pills, "now" readouts, details drawer, layer toggles, URL hash state, WebGL error boundary falling back to 2D |
| Sunday 09:00 kill-switch | Merge both branches, browser QA across 7 sites x 2 windows x 4 presets, build size check | Same QA, keyboard-only pass, screenshots for the submission |

## Acceptance (both)

- `cd web && npm test` and `npm run build` pass; new pure functions have unit tests (frames, terrain mesh, skyline, readouts, tracker pointing, state reducer).
- Changing site, period, hour, preset or heading updates the scene and pills within one frame of the control change, without remounting the Canvas.
- With a deliberately broken horizon or terrain file, the scene shows unknown styling and the pills show unknown, never pass.
- No console errors; resizing works; leaving and re-entering 3D does not leak WebGL contexts (one Canvas only).
- 2D view still renders everything it did before, including the comparison table and disclosures.
