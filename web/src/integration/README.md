# Integration: real science data into the navigator

Owner: Amine (integration lead). Scope: `web/src/app/`, `web/src/integration/`, `web/scripts/`.

## Data flow

1. **Science** (`science/`) writes `data/processed/site-<n>_window-<x>.json` (`SiteDateData`) and `data/processed/terrain/site-<n>.json` (`SiteTerrain`).
2. **`web/scripts/sync-data.mjs`** copies them to `web/public/data/` and writes `index.json` with each file's SHA-256. It refuses any file whose `purpose` is not `research`. It runs before `npm run dev` and `npm run build`; `web/public/data/` is generated and ignored by Git.
3. **`loader.ts`** fetches the index and every file, checks the SHA-256, then checks each file against the contract (`validate.ts`). A rejected file is left out and its reason is shown at the top of the page; nothing falls back to synthetic data.
4. **`evaluate.ts`** runs the three engines on the same `SiteDateData` samples, hardware and yaw:
   - `evaluatePowerWindow` gives `solar`, `battery` and `minimumBatteryWh`;
   - `evaluateAntennaWindow` gives `antenna` and `contactHours`;
   - `evaluateDeployment` runs on the site's terrain patch and gives `deployment`.
   
   Each result keeps its engine's status, reason and source ids; `unresolved` is the de-duplicated union. Results are memoised per dataset, hardware and yaw.
5. **`app/App.tsx`** mounts `NavigatorPage` with the loaded datasets, `HARDWARE_PRESETS` and the evaluator.

## Hardware (all hypothetical)

`hardware.ts` merges each `ILLUSTRATIVE_POWER_PRESETS` entry with one shared antenna and geometry, so presets differ only in the array (equal 2 m² PV area).
- Antenna at 3 m, panels at 2 m, matching the science horizons. A height mismatch would make the engines report unknown.
- Gimballed antenna with a 15° half-beam, pan ±90° and tilt −10° to 60°.
- 2 m footprint radius and an aft ramp of 15 m, with 10° footprint and ramp limits (after VIPER draft examples, not a lunar standard).

None of these values is approved (HARDWARE-001 to HARDWARE-004 in `docs/INPUT_REQUESTS.md`).

## Unknown handling

- No terrain patch, a patch for another site, or a purpose mismatch gives deployment `unknown`.
- Null horizon bins, null directions and `missing` ephemeris stay unknown through the engines; `realdata.test.tsx` checks this on the real files.
- The page shows green only when `hasFullCoverageEvidence` holds (research purpose, JPL-verified samples, far-field-validated horizons).

## Tests

From `web/`:

```sh
npx vitest run src/integration src/app   # integration and app shell
npm test                                 # full suite
npm run build                            # sync data, typecheck, build
```

- `validate.test.ts`: contract checks and wiring, on synthetic fixtures only.
- `realdata.test.tsx`: the real `data/processed` files, served through the loader with hash checks. It checks:
  - every module uses the same samples, and every source id is traceable;
  - the same heading gives different results in the two windows;
  - a limited tracker depends on heading and an ideal tracker does not;
  - antenna and ramp results follow the heading;
  - unknown stays unknown;
  - the mounted page renders all seven sites.
