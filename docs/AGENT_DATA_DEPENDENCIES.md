# Data dependencies, ownership and release gates

**Current acquisition workflow:** download directly from the official online sources in `docs/DATA_DELIVERY_INSTRUCTIONS.md`. References below to team-supplied CORE/slope ZIPs describe the historical handoff, not a prerequisite for the team. Corrected slope derivatives must be prepared and validated locally.

| Agent | Reads from bundled data | Other external input | Produces for other agents | Can't claim yet |
|---|---|---|---|---|
| **0 Lead** | DATA_MANIFEST, ZIP index, original NASA README | Confirmed resource-list source, schema sign-off, repo permissions | Authoritative asset paths, accepted scientific quality grade, task/request board | Eligibility until Resources tab checked |
| **1 Science** | SDEM, 15m MASK/BRES, SIGM, optional old LOLA, prior research scripts | JPL/NAIF verified Sun+Earth, far-field LOLA terrain | Versioned `SiteDateData` samples, per-observer-height horizon, footprint/coverage flags, hashes | Whole-horizon opportunity until remote terrain is included |
| **2 Power** | Research CSVs **only for regression**; `SiteDateData` is primary | Approved hardware panel normals, peak W, battery Wh, loads, tracking rules | Time-series solar generation, battery state, yaw sensitivity and reasons | Real spacecraft survival without actual specs and verified science |
| **3 Comms** | No raster directly; uses Science ephemeris and **antenna-height** terrain skyline | Antenna pointing limits and actual geom. | Earth pointing geometry pass/fail/unknown | Radio link availability/DSN contact |
| **4 Terrain** | SDEM, corrected 5m slope; optional 100/200/400m slope | Approved lander footprint, ramp direction, threshold | Preliminary terrain/ramp checks, quality flags | Footpad, centimetre-scale hazard or deployment certification |
| **5 Frontend** | Processed JSON/mesh only; no full TIFFs | UI design decisions, statuses, user hardware config | Interactive site/date/yaw comparison | Predictions built from hardcoded or unverified CSVs |
| **6 QA** | Data hashes, sources, validation reports | Public deployment, NASA submission form, actual licensed reused components | Science audit, QA evidence, attribution and demo | NASA endorsement or global-award eligibility without proof |

## Dependency graph

**NASA TIFFs + independent astronomy → Science processed data → Power/Comms/Terrain engines → Frontend comparison → QA and human-approved submission.**

Agents 2, 3, and 5 can test with clearly marked synthetic fixtures before Science delivers real samples; these are **test data only** and must never appear as official mission results.

## Science quality gates (and enforced UI behavior)

- `synthetic-test`: unit test only; disable production mission verdict.
- `approximate`: preliminary research ephemeris or unvalidated Sun/Earth vectors; label approximate and no GO/NO-GO.
- `local-only`: verified time geometry but local 3–10 km horizon without all distant terrain; report only local visibility and unknown full visibility.
- `verified`: independently checked ephemeris **and** audited full relevant terrain coverage for specified observer height. Even `verified` is an engineering-screening model, not flight certification.

**Note:** The shared `DataQuality` enum v1 has one axis; ephemeris accuracy and terrain completeness are independent. Lead must extend v1 schema to independent `ephemerisQuality` and `horizonCoverage` before accepting production science if these qualities differ. Do not mark all fields verified because one component passed.

## Units and coordinate traps

- Moon South Polar Stereographic, lunar radius 1,737,400 m, do not pass lunar longitudes through Earth's WGS84 transform.
- Longitude east-positive; a coordinate west of zero is represented by a negative signed angle, e.g. −102.713980°. Altitudes relative to the lunar sphere unless otherwise stated.
- Yaw and azimuth clockwise from *true local north*, not pixel-up and not projected grid north.
- Body frame `[right, forward, up]` versus local `[east, north, up]`: encode and test exact matrix with canonical north/east cases.
- Sun/Earth ephemeris timestamps UTC, no local date conversion in science arrays.
- For science files, `NaN`, nodata sentinel and out-of-bounds map regions are unknown, not zero elevation/slope and not open sky.
- Each observer height (panels, antennas, instruments) needs its own horizon calculation or mathematically justified equivalent.
- Nonuniform panels/tracking constraints cannot be normalized into identical hardware across cases without preserving **total active PV area**.
