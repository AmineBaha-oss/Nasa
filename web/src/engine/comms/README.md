# Comms engine: geometric Earth pointing

Owner: Francisco (`francisco/comms`). Scope: `web/src/engine/comms/` only. Contract: `web/src/contracts/index.ts` v1.0, used unchanged.

**This engine computes geometric Earth-centre pointing opportunity only.** It never claims a DSN contact, a radio link or a link budget.

## Public interface

| Function | Input | Output |
|---|---|---|
| `evaluateEarthPointing(sample, earthHorizon, hardware, yawDeg)` | one `EphemerisSample`, the antenna-height `HorizonProfile`, `{ antenna, antennaHeightM }` from `HardwareConfig`, yaw in degrees | `status`, `earthVisible`, `pointing` (each `pass` / `fail` / `unknown`) and a traceable `reason` |
| `evaluateAntennaWindow(data, hardware, yawDeg)` | one `SiteDateData` window | `antenna: ConstraintResult`, `contactHours`, `unresolved[]` and per-sample results, ready for `HeadingEvaluation` |

## Conventions (docs/INTERFACES.md — units and frames)

- Earth direction: azimuth clockwise from true north, elevation above the local horizon; `ENU = [cos el·sin az, cos el·cos az, sin el]`.
- Body `[right, forward, up]` to ENU at yaw clockwise from north: `E = r·cos yaw + f·sin yaw`, `N = −r·sin yaw + f·cos yaw`, `U = u`.
- Antenna body frame: `boresightBodyRFU` is a body-frame vector and need not be unit length.

## Rules implemented

**Visibility** (Earth above the terrain skyline at antenna height):
- Horizon bin `i` is a point sample at azimuth `i × step`, with no half-bin offset.
- At a sample point, Earth must be strictly above it. Earth exactly on the skyline counts as blocked.
- Between two samples, Earth above both gives `pass` and Earth at or below both gives `fail`. Otherwise it is `unknown`, because the skyline between samples is not resolved.
- Missing profile, wrong bin count, null or non-finite bins, or a horizon `observerHeightM` that differs from `antennaHeightM` all give `unknown`.

**Pointing:**
- Fixed antenna: Earth within `beamHalfAngleDeg` of the yaw-rotated boresight. The beam edge counts as inside.
- Gimballed antenna: see the assumptions below.
- An invalid antenna configuration, or a non-finite yaw, gives `unknown`. Yaw is reduced modulo 360 before rotating.
- A non-finite Earth azimuth or elevation, or an elevation outside [−90, 90], gives `unknown`. The reason names the actual cause.
- Angles are computed with `atan2(|a×b|, a·b)`, which stays accurate for very narrow beams.

**Per-sample status:**
- A definite `fail` of either check gives `fail`. For example, Earth outside the beam fails even if the skyline is unknown.
- Otherwise `unknown` wins over `pass`.
- Earth direction `null`, or `ephemerisQuality: 'missing'`, gives `unknown`.

**Window:**
- Any sample `fail` gives `fail`; otherwise any `unknown` gives `unknown`; otherwise `pass`, meaning continuous geometric pointing.
- No samples gives `unknown`.

**`contactHours`:**
- Samples are sorted by UTC. The value is the sum of intervals whose two end samples both pass, so it is only as fine as the sample spacing.
- It is `null` if any sample is unknown, there are fewer than two samples, or two samples share a UTC timestamp.
- It is also `null` if any UTC is invalid. Valid means ending in `Z` and a real calendar time; February 30 and hour 24 are rejected rather than rolled over.

**Caveats:**
- Per-sample reasons say "local terrain only" for a clear local-only horizon and "approximate ephemeris" where that applies. A passing window reason says the same.
- `unresolved` always includes the geometry-only (not DSN) note. It also lists, when they apply:
  - synthetic data;
  - a local-only horizon;
  - approximate ephemeris;
  - hypothetical antenna parameters;
  - Earth samples or a horizon with no source ID;
  - source IDs with no provenance record.
- `antenna.sourceIds` includes the hardware `specificationSourceId` when one is given.

## Modeling and integration notes

1. **Local-only horizon:** a clear local-only result is `pass` with a caveat in `reason` and `unresolved`, as agreed with Francisco. A local blockage is still `fail`.
2. **Gimbal semantics:** pan and tilt are absolute body-frame angles, with (0, 0) at body-forward. Pan is positive toward body-right and tilt is positive toward body-up. The nominal `boresightBodyRFU` is not used when a gimbal is present.
   - Reachability: the angle from Earth to the closest direction inside the pan/tilt box must be within the beam half-angle.
   - The closest direction is computed exactly: the Earth-pan meridian when Earth's pan is in range, otherwise the two pan-stop meridians, including tilt stops reached "around the back".
   - A seam test checks this against an independent dense grid search, and so did a 2,000-case random brute-force run during development.
   - Pan ranges may cross ±180 (for example `[90, 270]`), and a span of 360° or more means full pan.
3. **Window pass means continuous pointing.** Partial availability shows up in `contactHours`.
4. **Height mismatch:** if the Earth horizon's `observerHeightM` differs from `antennaHeightM`, the result is `unknown`. Science must supply an antenna-height profile.
5. **Who builds `HeadingEvaluation`:** this engine returns its pieces; the integration layer assembles the record.
6. **Missing source IDs:** samples or horizons without a source ID are flagged in `unresolved` but do not change the status.
7. **Performance:** a sweep of 360 yaws × 700 samples took about 0.3–0.5 s in a reviewer benchmark. Each window result also keeps its per-sample detail; that took about 230 MB when all 360 results were held. For a yaw sweep, keep only the selected yaw's `samples`.

## Inputs still open

- **HARDWARE-003:** the real antenna boresight, beam half-angle, gimbal ranges and height. All values in the tests are hypothetical.
- Science inputs are integrated in `data/processed/`; the engine requires an Earth horizon computed at the antenna height.

## Tests

From `web/`:

```sh
npm ci
npx vitest run src/engine/comms   # comms tests only
npm test                          # full suite
npm run build                     # typecheck + build
```

The tests use only synthetic, clearly labelled hypothetical values, plus `tests/fixtures/synthetic-site-date.json`.

## Not modelled

Radio link budget, DSN scheduling, Earth disc size, libration beyond the supplied ephemeris, antenna self-blockage by the lander body, and distant terrain when the horizon is local-only.
