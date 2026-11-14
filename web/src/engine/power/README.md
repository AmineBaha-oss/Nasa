# Power engine: solar array and battery

Owner: Mir (`mir/power`). Scope: `web/src/engine/power/` only. Contract: `web/src/contracts/index.ts` v1.0, used unchanged.

**This engine estimates direct-sunlight array output and battery state for a body-fixed lander heading.** It consumes the science `SiteDateData`; it never computes its own Sun positions. All presets are illustrative, not real lander specifications.

## Public interface

| Function | Input | Output |
|---|---|---|
| `evaluatePowerWindow(data, hardware, yawDeg)` | one `SiteDateData` window, power fields of `HardwareConfig`, yaw in degrees | `solar` and `battery` as `ConstraintResult`, `minimumBatteryWh`, energy bounds, battery series, `unresolved[]` and per-sample detail, ready for `HeadingEvaluation` |
| `sweepPowerYaw(data, hardware, stepDeg = 5)` | same, plus a yaw step | per-heading statuses and energy bounds, passing headings and `yawSensitive` |
| `evaluateSolarSample(sample, sunHorizon, hardware, yawDeg)` | one `EphemerisSample` | sunlit status, incidence factor, visible disk fraction and array power bounds |
| `simulateBattery(points, battery)` | power points (hours since start, W) | clamped energy series, reserve breach and recovery, spill and shortfall |
| `panelIncidence`, `sunDiskVisibleFraction`, `sunVisibility` | building blocks | see source comments |
| `solarHardwareProblem`, `batteryProblem`, `checkEqualPvArea` | hardware | validation; `checkEqualPvArea` enforces equal total active PV area across compared configurations |
| `ILLUSTRATIVE_POWER_PRESETS` | none | four hypothetical configurations with equal area (2 m²) and peak (200 W) |

`PowerHardware` is `Pick<HardwareConfig, …power fields…>`, so a full `HardwareConfig` is accepted. Antenna fields stay with the comms engine.

## Conventions (docs/MASTER_PLAN.md section 6)

- Sun direction: azimuth clockwise from true north, elevation above the local horizontal; `ENU = [cos el·sin az, cos el·cos az, sin el]`.
- Body `[right, forward, up]` to ENU at yaw clockwise from north: `E = r·cos yaw + f·sin yaw`, `N = −r·sin yaw + f·cos yaw`, `U = u`. Yaw is reduced modulo 360.
- Panel normals are body-frame vectors and need not be unit length.

## Model

**Array power per sample:**

```
P = peakSolarPowerW × Σ areaFraction_i × incidence_i × visibleDiskFraction
```

- Fixed panel: `incidence = max(0, n·s)`. No back-side generation; 90° grazing gives zero.
- Tracked panel without `maxTrackingAngleDeg`: ideal tracking, `incidence = 1`. Always flagged as an upper bound.
- Tracked panel with `maxTrackingAngleDeg = L`: the panel can point anywhere within a cone of half-angle `L` about its nominal normal. With θ the angle from the nominal normal to the Sun, `incidence = 1` if θ ≤ L, else `cos(θ − L)`, and 0 beyond `L + 90°`. This cone treatment is an engine assumption; the contract does not define the mechanism.
- `visibleDiskFraction`: fraction of the solar disk (mean radius 0.2666°) above the terrain skyline, with the skyline treated as a straight line across the disk. At the south pole the Sun sits within about 1.5° of the horizon, so partial disks matter. Terrain blockage applies to trackers too: a tracker never recovers a blocked Sun.
- `peakSolarPowerW` is the whole array's output at normal incidence in full sunlight. No further efficiency factor is applied.

**Skyline** (same rules as the comms engine):
- Bin `i` is a point sample at azimuth `i × step`, with no half-bin offset.
- Between two bins the skyline is unresolved, so the visible fraction becomes an interval.
- These give `[0, 1]`: a missing profile, wrong bin count, null or non-finite bins, or a Sun horizon whose `observerHeightM` differs from `panelHeightM`.

**Interval propagation instead of guessing:**
- Every unknown input widens a `[low, high]` power interval:
  - null Sun direction, or `ephemerisQuality: 'missing'`, gives `[0, peak]`;
  - an unresolved skyline widens only the visible fraction.
- The battery model is monotone in input power, so a run on the low powers and a run on the high powers bound the true stored energy.
- A status is `pass` or `fail` only when the whole interval agrees; otherwise it is `unknown`.

**Battery** (direct-supply bus):

```
net = trapezoidal mean array power over the interval − constantLoadW
surplus: E += net × chargeEfficiency × Δh
deficit: E += net / dischargeEfficiency × Δh
E = clamp(E, 0, batteryCapacityWh)
```

- The reserve test uses the pre-clamp value, so clipping at zero never hides a breach, even with a zero reserve.
- Net power is constant within an interval, so checking at interval ends is exact for this model.
- Spilled surplus (battery full) and unserved load (battery empty) are reported.

## Status rules

| Constraint | pass | fail | unknown |
|---|---|---|---|
| `solar` | lower-bound array energy ≥ load demand (`constantLoadW × window hours`) | upper-bound array energy < load demand | interval brackets the demand; invalid array or yaw; invalid or duplicate UTC; fewer than 2 samples |
| `battery` | low-power run never drops below `minReserveWh` | high-power run drops below `minReserveWh` | runs disagree; invalid battery or array parameters; timing problems as above |

- `minimumBatteryWh` is the clamped minimum (never negative) when both runs agree, otherwise `null`. `minimumBatteryWhBounds` always gives the interval.
- `unresolved` always includes `SOLAR_MODEL_NOTE` and `BATTERY_MODEL_NOTE`. It also lists, when they apply:
  - synthetic data;
  - a local-only Sun horizon;
  - approximate ephemeris;
  - hypothetical hardware;
  - ideal trackers;
  - untraceable samples or horizon;
  - source IDs with no provenance record.
- `sourceIds` covers the Sun samples, the Sun horizon and `specificationSourceId`.

`yawSensitive` from the sweep is decided per sample, because visibility does not depend on heading:
- `true` when incidence differs between headings at a sample where the Sun is certainly at least partly visible.
- `false` when every sample has a known Sun and either heading-independent incidence (ideal trackers) or a certainly blocked Sun.
- `null` otherwise.

The sweep never ranks headings or picks a winner.

## Decisions for the lead (Amine)

1. **Battery formula:** `docs/MASTER_PLAN.md` writes `P_gen·η_charge − P_load/η_discharge`. That applies both efficiencies even when the array feeds the load directly. This engine charges only the surplus and discharges only the deficit, which is physically consistent and less pessimistic. Confirm or ask for the plan's formula.
2. **Meaning of the solar check:** "array energy over the window covers the constant load". Battery is the separate "reserve holds throughout" check. Neither is a single magic score.
3. **Local-only horizon:**
   - A local-only result can still `pass`, with a caveat, consistent with the comms engine's decision.
   - Distant terrain can only remove sunlight, so a `fail` stands. A `pass` may not survive far-field terrain, and the reason text says so.
4. **Hardware-only fails:** if the load exceeds the array even at full peak power for the whole window, `solar` is `fail` although the Sun data are unknown. This holds for every possible Sun geometry, so it is not a fabricated result. Downgrade it to `unknown` if you prefer.
5. **Who builds `HeadingEvaluation`:** this engine returns `solar`, `battery`, `minimumBatteryWh` and `unresolved`. Integration merges them with comms (`antenna`, `contactHours`) and terrain (`deployment`).
6. **Shared vector helpers:** `vectors.ts` duplicates the private helpers in the comms engine. Integration can move them to a shared module later; the formulas are identical.

## Integration sketch (for `web/src/app/` or `web/src/integration/`, not done here)

```ts
const power = evaluatePowerWindow(data, hardware, yawDeg);
const comms = evaluateAntennaWindow(data, hardware, yawDeg);
const evaluation: HeadingEvaluation = {
  yawDeg, siteId: data.site.id, startUtc, endUtc,
  solar: power.solar, battery: power.battery, antenna: comms.antenna, deployment,
  minimumBatteryWh: power.minimumBatteryWh, contactHours: comms.contactHours,
  unresolved: [...new Set([...power.unresolved, ...comms.unresolved])],
};
```

`ILLUSTRATIVE_POWER_PRESETS` contain power fields only. Merge each with an approved antenna configuration to build a full `HardwareConfig`.

## Performance

These were measured with a synthetic 709-hourly-sample window (about one lunar month) and a 1° horizon:
- One `evaluatePowerWindow` call takes about 3–5 ms, which is fine for live dial dragging.
- `sweepPowerYaw` at a 1° step takes about 1.1–1.6 s per preset. The default 5° step does a fifth of the work.
- The sweep keeps summaries only, not per-sample detail.

## Inputs still open

- **HARDWARE-001/002:**
  - Approved panel normals, area split and tracking limits.
  - Peak power, load profile, battery capacity, reserve and efficiencies.
  - Panel height.
  - All current values are illustrative.
- **Science:** verified Sun vectors, plus a Sun horizon computed at the panel height (`observerHeightM === panelHeightM`).
- **DATA-004:** far-field terrain. Until then, passes are local-only.

## Tests

From `web/`:

```sh
npx vitest run src/engine/power   # power tests only
npm test                          # full suite
npm run build                     # typecheck + build
```

The tests use only synthetic, clearly labelled hypothetical values, plus `tests/fixtures/synthetic-site-date.json`. They cover:
- **Frames and yaw:** yaw at 0/90/180/270/360/−90, and the az/el basis.
- **Sun geometry:** Sun normal, opposite and grazing to the panel; tracker cone limits; ideal tracking; a blocked Sun cancelling a tracker.
- **Disk visibility:** disk-fraction symmetry and monotonicity; skyline brackets; observer-height mismatch.
- **Battery:** no input, constant surplus, constant deficit, reserve breach before clamping (including a zero reserve), recovery, timestep convergence, exact trapezoid integration, and monotonicity.
- **Fairness and unknowns:** PV-area fairness; missing-data unknowns; UTC validation; sorting; provenance tracing.
- **Heading:** yaw-insensitive ideal trackers (the counterexample from the hardware audit), and the same heading at two Sun azimuths changing the result.

## Not modelled

- Thermal behaviour, dust, cell temperature and ageing.
- Limb darkening, diffuse light and Earthshine.
- Panel-to-panel or lander-body self-shadowing.
- Electrical subsystem losses beyond `peakSolarPowerW`, and time-varying loads.
- Terrain events between samples.
- Distant terrain when the horizon is local-only.
