# Prompt 07 — 3D scene and hardware render (Person A)

Read `AGENTS.md`, `docs/MASTER_PLAN.md`, `docs/INTERFACES.md`, `docs/3D_PLAN.md` and the skills listed for Person A in `docs/3D_PLAN.md` before coding. Branch: `<name>/3d-scene`. Suggested owner: Mir (owns the power engine, which the tracker pointing helper extends).

You own `web/src/scene3d/**`, the dependency commit in `web/package.json` and its lockfile, and one helper in `web/src/engine/power/solar.ts`. You do not edit pages, HUD components, contracts or other engines. Person B renders your `LanderScene` and builds every DOM control.

## First commit (within 30 minutes, push immediately so Person B can branch)

1. Install the pinned packages from `docs/3D_PLAN.md`.
2. `scene3d/types.ts`: the contract from `docs/3D_PLAN.md`, verbatim.
3. `scene3d/LanderScene.tsx`: default export, one `<Canvas frameloop="demand" dpr={[1, 2]} shadows="percentage">` that renders a ground plane and accepts `LanderSceneProps`.
4. `scene3d/frames.ts` with `enuToThree`, `azElToThree`, `yawToRotationY`, `bodyToThree` and tests that agree with `bodyToEnu` / `azElToEnu` from `engine/power/vectors.ts`.

## Build, in this order (each step must render and pass tests before the next)

1. **Terrain** (`terrainMesh.ts` + `Terrain.tsx`): build a `BufferGeometry` from the 80 x 80 DEM. Rotate grid offsets into ENU using `lunarToPolarStereo` and `azimuthToGridDirection` (grid north is not true north). Heights are relative to the DEM under the lander. Null pixels become holes or grey "unknown" cells, never interpolated. Optional `slopeColours` layer colours by `slope5m` against the deployment threshold. Build geometry in `useMemo` keyed on the terrain object and exaggeration; dispose old geometry.
2. **Angular skyline** (`skyline.ts` + `Skyline.tsx`): a ring wall from `data.sunHorizon` at a fixed radius beyond the patch, with height `R tan(angle)` per azimuth bin and the bracket convention used by `sunVisibility`. Null bins are gaps. Optional faint second ring for `earthHorizon` (3 m observer).
3. **Sky** (`Sky.tsx`): a dome at a larger fixed radius. Sun sprite and Earth sphere at the current sample's az/el; full-window tracks as lines (`windowTracks`). Segments below the skyline are dimmed. The directional light follows the Sun direction with intensity = engine visible fraction; for unknown, use ambient light only.
4. **Lander and hardware presets** (`Lander.tsx`, `HardwareModel.tsx`), all driven by `HardwareConfig`, never by preset name:
   - Body: a box with a landing footprint ring of `landingFootprintRadiusM`.
   - Fixed panels: one quad per panel at `panelHeightM`, facing `normalBodyRFU`, side length from `areaFraction x totalActivePvAreaM2`. This gives four equal faces for the 4-face preset and one large forward face for the single-panel preset.
   - Tracked panels: a mast with a 2-axis gimbal head. Add `panelPointingEnu(panel, sunEnu, yawDeg)` to `engine/power/solar.ts`, with tests: the normal turns toward the Sun by `min(theta, maxTrackingAngleDeg)` and matches the `cos(theta - L)` incidence already in `panelIncidence`. Draw the tracking-limit cone (wireframe) for limited trackers and turn the panel amber when clamped. The ideal tracker gets an "upper bound" label.
   - Panel glow: emissive intensity equals that panel's incidence times the visible fraction from `sampleReadout`; grey when unknown.
   - Antenna: a mast to `antennaHeightM`, a dish on `boresightBodyRFU`, a translucent beam cone of `beamHalfAngleDeg`, and a pan/tilt wedge from `gimbal`. Aim the beam at Earth only when `evaluateEarthPointing` reports `pointing: 'pass'`; otherwise draw it at rest. A line to Earth is coloured by that result's status.
   - Ramp: a strip at `rampHeadingBodyDeg`, length from the deployment thresholds, coloured by the window's deployment status.
   - Preset change: animate panels folding to the new layout with `MathUtils.damp`, settling so the demand loop goes idle. Skip the animation under reduced motion.
5. **Interaction** (`HeadingRing.tsx`, `CameraRig.tsx`): a torus around the lander that the user drags to set heading. It calls `onYawChange` with 1-degree snapping, or 15 degrees with Shift. Hover tooltips on panels show watts. Camera modes: `orbit` (drei `OrbitControls`, clamped above the ground), `lander` (eye at panel height looking along body-forward), `top` (orthographic-style overhead, north up) and `hardware` (turntable close-up with labels for panel areas, tracking limit, beam width and ramp). This hardware close-up is the preset render.
6. **Readouts** (`readouts.ts`): `sampleReadout` and `windowTracks` exactly as in `docs/3D_PLAN.md`, using only engine functions. Person B imports these for the HUD.

## Rules

- Never compute a status in the scene. Read `evaluation`, `evaluateSolarSample`, `evaluateEarthPointing` and `evaluatePowerWindow`.
- Keep the scale honest: the lander is metres and the patch about 400 m; use camera modes rather than scaling the lander. Label any vertical exaggeration other than 1.
- Performance: one Canvas, `frameloop="demand"`, `invalidate()` on prop changes, memoised geometry, no allocation inside `useFrame`. Target 60 fps on a laptop iGPU; check draw calls with `threejs-performance`.
- Unmounting the scene must release the WebGL context (test switching 2D/3D repeatedly).

## Report

Screenshots of each preset in `hardware` and `orbit` modes at two sites; test command output (`npm test`, `npm run build`); bundle size of the lazy 3D chunk; skills and Context7 queries used; known visual simplifications.
