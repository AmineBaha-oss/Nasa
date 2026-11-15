# Prompt 08 — Controls, legend/HUD and 2D/3D toggle (Person B)

Read `AGENTS.md`, `docs/MASTER_PLAN.md`, `docs/INTERFACES.md`, `docs/3D_PLAN.md`, `prompts/05_frontend.md` and the skills listed for Person B in `docs/3D_PLAN.md` before coding. Branch: `<name>/3d-controls`, created from Person A's first commit. Suggested owner: Emmanuel (owns components, pages and styles) or a teammate who coordinates with him.

You own `web/src/state/**`, `web/src/components/hud/**`, `web/src/pages/NavigatorPage.tsx` and `web/src/styles/**`. You render Person A's `LanderScene` through its props only and never edit `web/src/scene3d/**`. One prop change in `App.tsx` (pass `terrainBySite`) needs Amine's approval.

## Build, in this order

1. **Lift state** (`state/navigatorState.ts`): a `useReducer` holding `datasetIndex`, `sampleIndex`, `hardwareIndex`, `yawDeg`, `view: '2d' | '3d'`, `layers`, `cameraMode`, `playing`, `speed` and `verticalExaggeration`. Unit-test the reducer: wrapping yaw to [0, 360), clamping the sample index when the dataset changes, and toggling layers. Refactor `NavigatorPage` to use it; the 2D view must look and test exactly as before.
2. **Toggle**: a 2D/3D segmented switch in the header (keyboard shortcut `V`). Lazy-load `LanderScene` with `React.lazy` + `Suspense`. Add an error boundary that falls back to 2D with a short notice if WebGL is unavailable or the scene throws. Default to 2D until the Sunday 09:00 QA sign-off in `docs/3D_PLAN.md`.
3. **URL state**: mirror the state to the hash (for example `#site=site-2&win=a&t=37&hw=2&yaw=135&view=3d`) so a demo link opens the exact scene. Invalid values fall back to defaults.
4. **Control dock / legend** (`hud/ControlDock.tsx`), a collapsible panel over the canvas. These are the controls for everything:
   - Site: seven compact chips (name and short label), with data-quality icons.
   - Period: window A/B segmented control showing the UTC range.
   - Hardware preset: four cards with a small pictogram, the name and "hypothetical" badge, and the equal-area note "2.0 m² each". Selecting one switches the scene; a "View hardware" button sets camera mode `hardware`.
   - Heading: a circular dial plus numeric input, plus or minus 1 and 15 degree buttons, and arrow-key support. It stays in sync with the 3D heading ring through `onYawChange`.
   - Layers: toggles for every `SceneLayers` key, with a colour swatch so the dock doubles as the scene legend.
   - Camera: orbit, lander eye, top and hardware buttons; vertical exaggeration slider, labelled when it is not 1x.
5. **Timeline** (`hud/Timeline.tsx`): a full-width scrubber over all samples with UTC readout, play/pause, speed (1, 4, 12 or 24 hours per second) and step buttons. Draw a strip above it with Sun elevation, Earth-visible spans and the battery band (`windowTracks` from `scene3d/readouts.ts`). Playback advances `sampleIndex` only; stop at the end and respect reduced motion.
6. **Status pills** (`hud/StatusPills.tsx`): SOL, BAT, ANT and DEP from `evaluation`, labelled "window", using the icon and colour rules already in `ConstraintCard`. Next to them, "now" readouts from `sampleReadout`: Sun visible percentage, power in watts (shown as a range when the bounds differ), battery in Wh and Earth in beam (yes/no/unknown). Clicking a pill opens its reason.
7. **Details drawer** (`hud/DetailsDrawer.tsx`): the long text moves here, not away: constraint reasons, `DataQualityNotice`, disclosures, the unresolved list and `ComparisonTable`. A persistent mini-chip row ("hypothetical hardware", "local terrain", data quality) stays visible on the canvas.
8. **Performance**: wrap `yawDeg` in `useDeferredValue` for the comparison table and other off-screen evaluations so dragging heading stays smooth. Do not remount the Canvas on control changes.

## Rules

- No hardcoded pass/fail, "best heading" or recommended site. Show engine results only; unknown stays unknown.
- Less text on the canvas, not less information: every disclosure stays reachable in one click.
- Accessibility: every control works by keyboard with visible focus and labels; `aria-live` announces status changes politely; colour is never the only signal (icons plus text).
- Responsive: the dock collapses to a bottom sheet under 900 px wide.

## Tests and report

Reducer and URL-parsing unit tests, component tests for the dock and pills (status rendering for pass, fail and unknown), `npm test` and `npm run build` output, a keyboard-only walkthrough, and browser screenshots of 2D and 3D at desktop and mobile widths. Use Playwright or the Cursor browser on the local dev server only.
