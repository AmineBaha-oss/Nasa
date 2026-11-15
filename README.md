# LANDERPRINT

### A lunar landing site is only useful if your spacecraft can work there.

LANDERPRINT is an interactive lunar site, date and spacecraft-heading explorer built for the **NASA Space Apps Challenge 2026 — Lunar Landing Site Navigator**. It connects NASA terrain and Sun/Earth geometry with hypothetical spacecraft hardware, helping users investigate how location, timing and orientation affect power, communications pointing and preliminary rover deployment.

**Live website:** [landerprint.vercel.app](https://landerprint.vercel.app)

**Challenge:** [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

<img width="1435" height="893" alt="Screenshot 2026-11-15 at 11 51 05 AM" src="https://github.com/user-attachments/assets/fb4fc2e2-9838-43e6-8908-1efb903626c0" />
<img width="1437" height="900" alt="Screenshot 2026-11-15 at 11 51 35 AM" src="https://github.com/user-attachments/assets/656a1698-9dd4-4f72-bf05-ae425016b72c" />
<img width="1440" height="878" alt="Screenshot 2026-11-15 at 11 51 42 AM" src="https://github.com/user-attachments/assets/c7edf786-389f-45b3-84f1-e5ef1b92f6af" />
<img width="1436" height="804" alt="Screenshot 2026-11-15 at 11 55 15 AM" src="https://github.com/user-attachments/assets/070b27a5-d19b-4944-8632-b916c8a70fff" />
<img width="1440" height="900" alt="Screenshot 2026-11-15 at 11 55 53 AM" src="https://github.com/user-attachments/assets/42b2b508-9647-43fa-9a69-73728728b243" />
<img width="1440" height="892" alt="Screenshot 2026-11-15 at 11 57 01 AM" src="https://github.com/user-attachments/assets/930b3cf8-ce0a-4ac7-9cc6-1570eb85a72a" />
<img width="1166" height="494" alt="Screenshot 2026-11-15 at 11 57 20 AM" src="https://github.com/user-attachments/assets/6c66a3f8-4f1d-44a4-ad38-ea9f5f1bd258" />


<!-- ![LANDERPRINT's 3D navigator showing the selected lunar site, spacecraft and modeled constraints](docs/images/navigator.png) -->

## The problem

Near the lunar south pole, the Sun stays close to the horizon. Terrain can block sunlight or the view toward Earth, and those conditions change with location and time. A site that looks promising on a map may still be unsuitable for a particular spacecraft configuration.

Visibility is only part of the problem. A fixed solar panel must face usable sunlight. An antenna must be able to point toward Earth within its mechanical limits. A battery must support the load between periods of generation. A rover's deployment direction must also be considered against the surrounding terrain.

These constraints share a spacecraft body and heading. Looking at them separately makes it harder to see the consequences of an orientation choice.

## Our solution

LANDERPRINT brings **site × date × heading × hardware** into one interactive view. Users choose a location and date window, select a solar-array configuration and rotate the lander to see the modeled consequences.

Our contribution is the connection between terrain visibility and the spacecraft's ability to use it. The app evaluates solar generation, battery reserve, antenna pointing and a preliminary terrain screen together. Each constraint has its own result and explanation; we do not combine them into an unexplained score or declare a universally “best” landing site.

This makes the project useful for exploring engineering tradeoffs and teaching why lunar landing-site selection depends on the hardware and mission assumptions being considered.

## Explore the project

| Capability | What the user can investigate |
|---|---|
| **Seven locations** | Exploratory points within Connecting Ridge Extension, selected using terrain and image-coverage screening |
| **Two date windows** | Hourly conditions for October 10–16 and October 24–30, 2027, in UTC |
| **Four solar-array presets** | Four fixed vertical faces, one body-forward fixed panel, a tracker with a 60° pointing limit, and ideal unconstrained tracking |
| **Lander heading** | How rotating the spacecraft changes panel incidence, antenna reach and ramp direction |
| **Power and battery** | Generated power and modeled stored energy over the selected window |
| **Earth pointing** | Whether Earth clears the terrain skyline and falls within the antenna's reachable beam |
| **Preliminary deployment** | Resolved-scale footprint slope and terrain along the ramp direction |
| **2D and 3D views** | A horizon view and an interactive terrain scene with playback, camera controls and visual layers |
| **Explanations and comparison** | Reasons for pass, fail or unknown results, data-quality disclosures and alternative site/date results |

All four presets use **2.0 m² of active solar cells** and the same hypothetical power-system baseline. The ideal tracker is an upper-bound comparison: it shows when solar-array orientation sensitivity disappears if tracking limits are removed. It does not imply such a mechanism is available on a real spacecraft.

### A short demo walkthrough

1. Select a site and **Window A**, then choose the fixed single-panel preset.
2. Rotate the heading and inspect the solar and antenna explanations.
3. Scrub through the timeline to connect the current Sun/Earth geometry with power and battery behavior.
4. Change to **Window B** or another site and compare the results.
5. Switch to limited and ideal tracking to investigate which orientation effects come from the array design.

A failed or unknown result is useful information. The app does not force a successful configuration or invent a tradeoff when the data do not support one.

> **Comparison screenshot goes here.** Capture the same site with two headings or presets, keeping the date and hardware assumptions visible. Save it as `docs/images/comparison.png` and enable the image below.

<!-- ![Comparison of modeled constraints for two LANDERPRINT configurations](docs/images/comparison.png) -->

## NASA data and how we use it

| Source | Role in LANDERPRINT |
|---|---|
| [NASA PGDA enhanced south-pole topography, product 104](https://pgda.gsfc.nasa.gov/products/104) | The A305 Connecting Ridge Extension elevation model supplies local terrain at 5 m resolution; slope products support the preliminary terrain screen |
| [Connecting Ridge Extension archive, Zenodo v1.0.0](https://zenodo.org/records/17954508) | Distribution of the terrain dataset; the committed subset and derivatives retain CC BY 4.0 attribution |
| [LOLA south-pole terrain, PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Coarser 80 m and 240 m terrain extends horizon sampling beyond the local tile to 300 km |
| [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Cached Sun/Earth reference tables used to cross-check computed directions; Horizons is listed in the challenge's recorded Resources response |
| [NAIF SPICE](https://naif.jpl.nasa.gov/naif/) | Reproducible Sun/Earth geometry using recorded kernels, lunar frames, sites and UTC timestamps |

The pipeline keeps **ephemeris verification separate from terrain coverage**. Accurate Sun/Earth coordinates alone do not establish an unobstructed horizon. It also computes separate horizons for the hypothetical panel height of 2 m and antenna height of 3 m.

Source URLs, versions, hashes and processing records are stored in [`data/provenance/`](data/provenance/). Full citations and usage terms are in the [science source ledger](science/SOURCES.md), [project source ledger](docs/SOURCES_AND_LICENSES.md) and [terrain attribution](data/nasa_a305/README.md).

## How it works

```text
NASA terrain + SPICE kernels + JPL Horizons references
                         ↓
Python: coordinate checks, ephemeris cross-checks,
terrain horizons and local terrain patches
                         ↓
Versioned research JSON + provenance + validation report
                         ↓
Browser: verify file hashes and data contracts
                         ↓
Selected site + UTC window + hardware + heading
                         ↓
Solar / battery / antenna / deployment calculations
                         ↓
2D and 3D views, timeline, explanations and comparisons
```

**Solar:** panel orientation determines the incidence of sunlight. Terrain visibility, including a solar-disk approximation, limits the available direct sunlight. Tracking configurations respect their modeled pointing limits.

**Battery:** the array serves a constant hypothetical load first. Surplus charges the battery and deficits discharge it, with efficiencies and capacity limits. Reserve checks use the energy before clipping, so an empty battery cannot hide a reserve breach.

**Antenna:** Earth must be above the terrain skyline at antenna height and inside the beam reachable under the configured gimbal limits. This is a geometric pointing check.

**Deployment:** local slope pixels and an elevation profile along the ramp direction provide a preliminary screen. Missing terrain remains unknown, and the result carries the limits of a 5 m grid.

The visual scene renders these shared inputs and engine outputs. Decorative 3D lighting and shadows never decide a scientific result. See the [power](web/src/engine/power/README.md), [communications](web/src/engine/comms/README.md), [terrain](web/src/engine/terrain/README.md) and [integration](web/src/integration/README.md) documentation for the implementation details.

## Validation and reproducibility

The committed [science validation report](data/processed/validation_report.json), generated November 14, 2026, records:

- **2,352 site-hour samples:** seven sites × two windows × 168 hourly samples.
- SPICE/Horizons comparisons within the configured **0.01° tolerance** for every sample. The recorded maximum sky-scaled azimuth difference is below **5 × 10⁻⁷°**.
- Complete 360-bin Sun and Earth horizon profiles to **300 km** for the included sites, at their respective observer heights.
- An A305/LOLA frame check using **1,000 terrain points**.

SPICE and Horizons both use JPL ephemeris products. Their agreement checks our handling of frames, time and observer location; it is not an independent validation of the underlying planetary ephemeris or of mission safety.

Automated tests cover coordinate transforms, heading wraparound, fixed/tracking panel geometry, equal active-cell area, battery reserve breaches, antenna limits, terrain sampling and missing-data propagation. Integration tests load the committed research data through hash and schema checks. Synthetic fixtures are confined to tests; rejected research files are never replaced with fabricated mission data.

## Scope and limitations

LANDERPRINT is an **educational research prototype**, not a flight-certified planning system, and is **not NASA-endorsed**.

- The seven locations are exploratory points, not approved landing sites.
- Hardware, loads, batteries, gimbal limits, instrument heights and deployment thresholds are hypothetical, not specifications of an approved spacecraft.
- A pointing opportunity does not establish a radio link budget, DSN availability or continuous operational communications.
- Five-metre terrain cannot resolve small rocks, footpad hazards or actual ramp clearance. A deployment pass is only a pass of the modeled terrain screen.
- Hourly sampling, terrain resolution and skyline sampling limit what the results can establish. Missing or insufficient inputs remain explicitly unknown.
- Detailed thermal behavior, electrical-system losses beyond the stated model, and spacecraft self-shadowing are outside the implemented calculations.

Further work would require documented spacecraft specifications, finer terrain and hazard information, and additional engineering validation. These are future extensions, not capabilities claimed by this submission.

## Technology

**Frontend:** React, TypeScript and Vite.

**3D:** Three.js, React Three Fiber and Drei.

**Science:** Python, NumPy, Rasterio, PyProj and SpiceyPy.

**Testing:** Vitest and pytest.

**Hosting:** static files; no backend or user account is required. The repository includes Vercel build configuration.

## Run locally

Requires **Node.js 24** and npm. From the repository root:

```sh
cd web
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`.

The web app needs **no API keys, `.env` file, Python installation or extra science downloads**. Development and production builds automatically copy the committed research JSON into `web/public/data/` and generate its SHA-256 index.

From `web/`, run tests and build a production preview:

```sh
npm test
npm run build
npm run preview
```

Deploy `web/dist/`, including its generated `data/` directory, to a static host. The root `vercel.json` configures installation, build and output paths for Vercel.

To regenerate science data, follow the [Python science workflow](science/README.md) and [data download instructions](docs/DATA_DELIVERY_INSTRUCTIONS.md). This requires Python 3.11+ and additional science inputs. `NASA_DATA_DIR` is an optional shell environment override for a different A305 copy; the default bundled path requires no configuration and the pipeline does not load `.env` files.

## Repository guide

| Path | Contents |
|---|---|
| `web/src/` | UI, 3D scene, calculation engines, shared contracts and web tests |
| `science/` | Python preprocessing, validation, cached Horizons references and tests |
| `data/processed/` | Research datasets used by the app |
| `data/provenance/` | Source metadata, checksums and validation records |
| `data/nasa_a305/` | Validated terrain subset and attribution |
| `tests/fixtures/` | Synthetic test inputs |
| `docs/` | Interfaces, data instructions, source notices and unresolved inputs |

## Team and acknowledgments

- Mir Faiyazur Rahman
- Francisco Tuozzo
- Amine Baha
- Tamim Afghanyar
- Emmanuel Kouassi

We acknowledge the NASA, JPL, NAIF, LOLA and terrain-dataset teams whose public data and tools make this project possible. Dataset authors and required citations are recorded in the source ledgers.

**AI assistance:** OpenAI Codex assisted with repository maintenance and documentation in this repository.

See [third-party notices](docs/THIRD_PARTY_NOTICES.md) for attribution and [sources and licenses](docs/SOURCES_AND_LICENSES.md) for reuse records. Dataset and dependency licenses do not establish a license for the project's own code.

Additional project references: [data contracts](docs/INTERFACES.md) · [unresolved inputs](docs/INPUT_REQUESTS.md).
