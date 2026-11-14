# LANDERPRINT — Agent-Ready Master Build Plan

**Status:** Planning and research only, prepared 2026-11-13. Do **not** start development/integration until 2026-11-14 09:00 at the team's local Space Apps event time (unless the organizer has expressly approved a different start).

**Project:** LANDERPRINT, an intuitive hardware-aware Lunar Landing Site Navigator for NASA Space Apps Challenge 2026 (14–15 November 2026).

**Challenge:** https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

**One-line pitch:** "Don't just find a place to land—find a place and date where your spacecraft's actual hardware can work."

## 1. The user problem and the novelty claim

Existing lunar site/date tools calculate Sun/Earth position, terrain horizons, battery estimates, and in some cases fixed/tracking panel modes. LANDERPRINT should not reproduce these as its innovation. Instead, combine a **spacecraft-body-fixed orientation** with multiple systems: solar-panel incidence and battery margins, Earth line-of-sight plus antenna pointing limits, and preliminary lander slope/rover deployment direction. Show how the **same real site/date** has different acceptable body headings, and how the feasible heading interval or ranking changes with date or site.

A good demo displays competing requirements: one heading collects more solar energy but loses antenna pointing or faces problematic deployment geometry; another heading meets all *modeled* conditions. Never fabricate a conflict to fit the pitch; if the data does not produce it, clearly demonstrate the narrower validated solar vs date finding.

**Basic sanity question:** If the lander has unconstrained Sun-tracking arrays and unconstrained gimballed antennas, orientation might not be important. Support that counterexample honestly. A user-configured hardware configuration is a requirement, not a decorative slider.

## 2. Official NASA challenge fit and administrative rules

The published challenge explicitly seeks a fast, intuitive comparison of lunar landing locations and dates, with Sun and Earth positions relative to the local horizon, to assess potential power generation and direct-to-Earth communication. Do not let LANDERPRINT become a spacecraft-design toy without site/date comparisons.

- Event: November 14–15, 2026. Start project development at 9:00 AM local event time November 14. Close project submission by 11:59 PM local time November 15.
- Up to six human participants per team. AI agents do not replace named human ownership and review.
- Global Awards eligibility: use at least one NASA data source specifically listed in the challenge **Resources** tab and cite it. This tab was not fully retrievable in research; opening it and verifying the exact listed source is an explicit 9-AM blocker.
- All third-party code, assets, datasets, references, and AI tools must be disclosed in submission; comply with each upstream license. No copying an entire competing submission and presenting it as original.
- Keep the demo public. NASA GO Team guidance from Nov 12 describes a video at most **30 seconds** or a maximum **7 slides**. Follow the actual 2026 Project Submission Guide and form if requirements differ.
- Clearly state this is a research/educational prototype, not NASA-endorsed or flight certified. Check branding restrictions before using any NASA logo.

Official rules and sources: NASA event https://www.spaceappschallenge.org/2026/ ; GO-team reuse and pre-event guidance https://github.com/nasa/spaceapps/discussions/1827 ; submission guidance https://github.com/nasa/spaceapps/discussions/1973 ; official challenge link above.

## 3. Definition of done (MVP)

1. Two actual **named candidate locations** within covered NASA data, and at least two 2027 date ranges, are selectable and compared. Both locations may be within Connecting Ridge Extension; never claim them to be independently approved landing zones.
2. Use traceable NASA terrain plus *independently verified* Sun/Earth azimuth and elevation; draw local horizon, Sun and Earth on at least one view.
3. Let user select a hardware template and rotate body yaw 0–359°, clockwise from local north; show which systems pass/fail under that orientation.
4. Solar incidence: a fixed array gives geometry-based power prediction; a tracking array provides a useful counterexample; battery timeline shows an explicitly hypothetical spacecraft's stored energy.
5. Antenna: Earth must be above the terrain skyline *and* inside antenna boresight/beam or configured gimbal limits. Show *geometric pointing opportunity*, not a guaranteed communications link.
6. Deployment: provide a **preliminary** slope/ramp-direction terrain screen, with explicit limitations of a 5-m DEM (no certification of footpad safety, 15-cm rocks or ramp-scale clearance).
7. Compare at least two headings and show a **transparent, constraint-by-constraint** answer. If no all-pass heading, explain what fails. Avoid arbitrary magical single scores.
8. Each displayed result carries provenance, observer height, location, UTC date, and limitations. Unknown/uncalculated states are distinct from PASS.
9. A publicly accessible deployed app, public source repo, automated tests, attribution document, and a public short demo are ready before submission.

**MVP cut:** Solar + antenna + site/date comparison + correct scientific provenance is the core. Deployment is a high-priority extension; 3D, self-shadow, thermal simulation and detailed radio-link budget are explicitly outside the minimum if they jeopardize correctness.

## 4. Recommended technology stack

- **Web:** React + TypeScript + Vite, strictly typed. Tailwind CSS for basic layout if useful. Use SVG/D3 or a small custom Canvas renderer for the main horizon/compass; Recharts for battery and window plots.
- **3D (optional):** Three.js / React Three Fiber after the 2D functional MVP. An interactive top-down vector lander is enough to prove orientation math.
- **Scientific preprocessing:** Python 3.11+, NumPy, Rasterio/GDAL, PyProj, SciPy (only as needed), SpiceyPy/NAIF SPICE, pytest. JPL Horizons for independent ephemeris cross-checking.
- **Data:** Versioned JSON (ephemeris, local horizon, summary) + compressed or reduced-resolution terrain tiles. Keep original huge GeoTIFFs out of Git and browser bundles.
- **App runtime:** Static; run hardware evaluation directly in TypeScript using precomputed astronomy/terrain. No server, auth, DB, Docker, Kubernetes, Next.js or microservices unless a proved requirement emerges.
- **Tests:** Vitest for geometry, orientation, battery and contact logic; pytest for coordinate/frame, DEM and ephemeris checks; Playwright optional if time permits.
- **Deployment:** GitHub Pages or Vercel; verify route/base-path handling, static file hosting and public access.

## 5. Available NASA files (research assets, not guaranteed flight-ready)

**V3 DATA SOURCE-OF-TRUTH:** See `docs/DATA_ASSET_INDEX.md` (actual file checks), `data/provenance/DATA_MANIFEST.json` (hashes/grids/transforms), `docs/DATA_DELIVERY_INSTRUCTIONS.md` (data setup), `RESEARCH_ZIP_INDEX.md` (every research ZIP), and `docs/TEAM_INPUT_REQUESTS.md` (missing inputs). The science and terrain agents must read these before making any file request. Core raster files are supplied separately as `LANDERPRINT_NASA_CORE_Data.zip`; four corrected slope layers are also available in `lunar_slope_corrected_all_4.zip`. All pre-event research is reference-only and not JPL-verified.


- `A305_GLDELEV_005.tif`: NASA-enhanced shape-from-shading 5-m surface elevation, Connecting Ridge Extension, 4000×4000 pixels, 20×20 km. NASA PGDA: https://pgda.gsfc.nasa.gov/products/104 and original archive: https://zenodo.org/records/17954508 .
- `A305_GLDTSLP_005_005_lunar_crs.tif`, `_100_lunar_crs.tif`, `_200_lunar_crs.tif`, `_400_lunar_crs.tif`: corrected georeferenced 3990×3990 slope rasters. The original slope TIFFs have 5-m pixels and valid transforms but omitted the CRS. Corrected files copy the parent DEM's lunar CRS and keep each raster's **25-m inset**. **Never match by array index**; sample geographic positions. Source processing documentation is in the pre-event research archive.
- `A305_GLDMASK_005.tif`, `A305_GLDBRES_005.tif`, `A305_GLDSIGM_005.tif`: quality/uncertainty; masks and best-image-resolution products use a different 15-m grid in the uploaded pair. Sample by coordinates.
- `SL3_final_adj_5mpp_surf.tif`: older LOLA baseline, optional scientific validation, **not** the default operating map.
- Research data: `landerprint_real_nasa_research_tests.zip`; candidate preliminary location (-89.111829 latitude, -102.713980 longitude **east-positive**) and two October 2027 windows. These use approximate astronomy and 3-km horizons; **do not present them as JPL-validated mission outcomes**.

Important: Far terrain beyond local DEM footprint can obscure the Sun/Earth. If nested/remote LOLA terrain is not available and verified, label results **local terrain only; distant obstructions unmodeled**. Avoid blanket GO/NO-GO claims.

## 6. Real physics: model limits

Use a common local **ENU** frame: East +x, North +y, Up +z. Azimuth is degrees **clockwise from true lunar local north**, elevation above local horizontal. Lunar longitude is **east-positive**; store longitude convention explicitly. A lander heading/yaw is also clockwise from north and rotates body-forward into ENU.

The global direction vector for an azimuth/elevation pair is:

```
[east, north, up] = [cos(el)*sin(az), cos(el)*cos(az), sin(el)]
```

Angles are converted to radians first. In body coordinates `[right, forward, up]`, rotating heading `yaw` into ENU gives:

```
E = right*cos(yaw) + forward*sin(yaw)
N = -right*sin(yaw) + forward*cos(yaw)
U = up
```

Solar: `P_generated(t) = P_peak * sum(area_fraction_i * max(0, dot(panelNormal_world_i, sunDirection_world))) * terrainSunVisibleFraction(t) * chosenEfficiencyFactor`. Use **same total active PV area** when comparing architectures. If data are only Sun-centre visibility, clearly label the approximation; no claim about full solar disk or electrical subsystem losses. Constrain tracker angular range if modeled.

Battery: `E_next = clamp(E + (P_gen*eta_charge - P_load/eta_discharge) * deltaHours, 0, batteryCapacityWh)`. Record whether battery would fall below minimum reserve at any interval *before clipping* and whether reserve recovers; use hypothetical named assumptions, not NASA spacecraft specs.

Antenna: test Earth elevation versus terrain skyline at antenna height, and angle between antenna boresight/gimbal-reachable pointing and Earth direction against cone half-width. Note Earth-centre visibility is not a guaranteed DSN communications link; a true link budget is out of scope unless independently validated.

Slope/deployment: estimate *resolved-scale* slope along body-forward ramp direction and around a configurable footprint, report UNSCREENED/UNKNOWN for meter-scale obstacles that 5-m pixels cannot resolve. The NASA VIPER technical information provides **example requirements** for solar exposure, HGA visibility, landing effective slope <=10°, rover egress effective slope <=10°, and ramp total angle <=30°; these are **VIPER-specific draft requirements**, not general lunar standards. Do not equate the NASA slope raster directly with effective 4-foot lander slope.

## 7. Six-agent and six-person work split

Human team lead also acts as orchestrator. Each worker gets one branch/worktree and specific ownership. **All agents read AGENTS.md, docs/INTERFACES.md, docs/SOURCES_AND_LICENSES.md first.** Agent 0 (lead) freezes shared interfaces before module implementations. Agents 1–5 work in parallel using truthful test fixtures; Agent 6 can be the team lead/integration agent as tasks complete.

| Worker | Owns | First acceptable deliverable | No-touch boundary |
|---|---|---|---|
| Agent 1 SCIENCE | `science/`, `data/processed/` | 2-site, 2-date verified ephemeris+horizon JSON and provenance | UI, hardware formulas |
| Agent 2 POWER | `web/src/engine/power/` | fixed/tracking panel geometry, battery tests | science files, UI |
| Agent 3 COMMS | `web/src/engine/comms/` | fixed/gimballed antenna geometry tests | science files, UI |
| Agent 4 TERRAIN | `web/src/engine/terrain/` + slope preprocessing | preliminary footprint/ramp angle results and unknown limitations | ephemeris, UI |
| Agent 5 FRONTEND | `web/src/components/`, `web/src/pages/`, `web/src/styles/` | functional 2D heading/site/date selector, visible constraints | engine/science calculations |
| Agent 6 INTEGRATION & QA | `web/src/app/`, `web/src/integration/`, `tests/integration/`, docs/submission | wired view, cross-module validation, demo, deployment | proprietary rewrites of owned modules |

If only five humans, combine Agent 4 with Agent 6 and cut rover deployment before compromising solar/communications correctness. If only four, combine Agent 3 with Agent 2 after the science contract is frozen.

## 8. First-hour protocol and dependency graph

**After the official 9 AM start, not before:**

1. Lead creates repository, chooses package manager and verifies NASA challenge Resources tab. Commit AGENTS.md, docs/INTERFACES.md, source ledger and baseline minimal Vite app.
2. Freeze JSON schema and coordinate conventions at **v1**. Each owner signs off on input/output types. Prepare clearly labeled synthetic/unit-test fixtures for frontend/engine work; these are not actual site results.
3. Run a reuse audit, choose **individual** upstream functions/components rather than importing complete competitor apps. Record exact repository URL, commit SHA, file path, license, modifications and tests for each copy. Keep license notices.
4. Build each module on a separate branch/worktree; implement against the same fake fixture while Agent 1 prepares real datasets. The integration lead owns merges and contract changes.
5. As verified real science data arrives, replace fixtures without changing the type contract. If data fail verification, preserve an explicitly limited demo, do not silently swap in synthetic fake mission data.

Flow: Data Contract -> [Science + Power + Comms + Terrain + UI independently] -> Integration -> Validation -> Demo/submission.

## 9. Suggested repo skeleton (create after 9 AM)

```
landerprint/
  AGENTS.md  docs/MASTER_PLAN.md  docs/INTERFACES.md
  docs/SOURCES_AND_LICENSES.md  docs/THIRD_PARTY_NOTICES.md
  science/
    README.md  requirements.txt  preprocess/  tests/
  data/
    processed/  provenance/           # small generated assets only
  web/
    src/
      app/
      components/  pages/  styles/
      engine/
        power/  comms/  terrain/
      contracts/                    # single owner: integration lead
    public/data/
    package.json
  tests/integration/
  docs/
    VALIDATION.md  LIMITATIONS.md  DEMO.md  SUBMISSION.md
```

For every pull request require: changed files listed, input/output contract confirmed, unit tests and status, source/license changes, limitations, screenshot/CLI evidence when applicable. No direct pushes to main by parallel agents.

## 10. 48-hour execution, with hard cuts

- **Saturday 09:00–10:30:** repo, interface freeze, actual challenge Resources confirmation, license audit, basic app running.
- **Saturday 10:30–14:00:** SCIENCE source preparation; POWER, COMMS and TERRAIN engines on synthetic unit-test fixtures; FRONTEND 2D shell and controls.
- **Saturday 14:00–18:00:** first integrated vertical slice: one site/date/body heading produces solar + Earth-pointing results. Local-only warnings if far horizon missing.
- **Saturday 18:00–midnight:** two sites and two dates, battery series, constraint wheel, initial source attribution; deploy preview.
- **Sunday 09:00–12:00:** deployment screening if feasible, alternate hardware template, real-data verification and edge tests.
- **Sunday 12:00–15:00:** integrate and lock physics; select a real demonstration where competing constraints matter. If none, honestly show solar orientation and antenna checks separately.
- **Sunday 15:00–18:00:** freeze features, public deploy, test on another computer, prepare 30-second video/7-slide fallback, citations, third-party notices and AI disclosure.
- **Sunday evening:** submit ahead of 23:59 local time. Do not make first submission at the last minute.

Kill-switches: If validated solar/Earth data missing by Saturday evening, stop optional visual polish and focus science. If 3D not done by Sunday morning, use the proven 2D diagram. If rover slope is inconclusive by Sunday noon, mark preliminary/unknown or remove it. If only one NASA location is usable, implement two actual points within the valid tile and label them exploratory.

## 11. Required tests (no approval without these)

**Science**: north/east azimuth basis, east-positive longitude, lunar polar projection, slope 25-m inset, no-data propagation, observer/antenna height, far-field limit; Horizons-versus-SPICE at several UTC timestamps to a documented tolerance. No false precision or provenance-free ephemeris.

**Power**: Sun opposite fixed panel = zero direct incidence; directly normal = maximal incidence; 90-degree incidence = zero; yaw 360 equals yaw 0; four-sided and tracking models get *same total PV area*; batteries never report survival after dipping below reserve.

**Comms**: Earth above skyline but outside beam = failed pointing; Earth inside beam but below skyline = failed geometric visibility; full gimbal reach case handled; north/east/yaw transformations checked.

**Deployment**: slope sampled by geographic location; unknown terrain stays unknown; resolved-scale slope threshold unit tests; no 5-m pixel claims 15-cm rock safety.

**Integration**: same heading at two date ranges changes expected orientation geometry when Sun direction changes; same science inputs reused across all modules; no hardcoded winning heading; fail reason traceable to the corresponding calculation.

**Demo**: public links work in incognito; mobile/desktop; offline/static assets accessible; limitations visible; no NASA endorsement claim; full list of AI tools, upstream code and NASA data.

## 12. Reference register — read exact URLs, verify current license terms

### Official event/rules
- Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Challenge Resources tab (verify live): https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources
- Event timing and team size: https://www.spaceappschallenge.org/2026/
- GO Team on pre-event work, NASA resources, third-party reuse, attribution: https://github.com/nasa/spaceapps/discussions/1827
- GO Team on submission: https://github.com/nasa/spaceapps/discussions/1973
- Submission guide index: https://www.spaceappschallenge.org/resources/

### NASA science & engineering
- Enhanced 2026 lunar south-pole SfS terrain: https://pgda.gsfc.nasa.gov/products/104
- Full archive (Connecting Ridge Extension tile): https://zenodo.org/records/17954508
- LOLA baseline (optional validation): https://pgda.gsfc.nasa.gov/products/78
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- NAIF SPICE: https://naif.jpl.nasa.gov/naif/
- Lunar imagery/context: https://quickmap.lroc.asu.edu/ and https://trek.nasa.gov/moon/
- VIPER hardware/landing requirements (**NASA draft, not general rules**): https://assets.science.nasa.gov/content/dam/science/psd/lunar-science/documents/VIPER_Technical_Information_AFPP.pdf
- VIPER 2025 engineering paper on solar azimuth, orientation and thermal risk: https://ntrs.nasa.gov/api/citations/20250004028/downloads/ICES-2025-376_Final.pdf

### Existing open-source projects (third-party code, not NASA-validated)
- LUNAR//OPS — Apache-2.0, Python/SPICE, nested LOLA horizons, science and QA reference: https://github.com/RootVandal/lunar-ops
- Lunar Horizon Wheel — MIT, React/TypeScript/Vite/Three, horizon UI and testing reference: https://github.com/NetRunnerXD/lunar-horizon-wheel
- LunarSite Compass — MIT, Next.js/Python, alternative map/data reference: https://github.com/partofcosmos-site/lunarsite-compass
- Lunar Horizon — MIT, Flutter/Python, astronomy/data QA reference: https://github.com/localizedprojects/CLPS-MOON-BROWSER

**Reuse policy:** Research repositories are candidate references, not already approved code dependencies. Inspect the exact copied files, vendored dependencies, LICENSE/NOTICE, commit SHA, and output-data rights. Do not assert upstream algorithms are correct merely because a README claims validation. Keep a third-party ledger. For Apache-2.0, retain license/notice requirements and mark significant modifications; for MIT, preserve copyright and license. Disclose all code and AI in the NASA submission.

## 13. Agent operating instruction (paste before all other prompts)

"You are a bounded coding agent for LANDERPRINT. Read AGENTS.md, docs/MASTER_PLAN.md, docs/INTERFACES.md and docs/SOURCES_AND_LICENSES.md first. Do not begin coding before official November 14 09:00 local event time. You only own the files named in your assignment. Keep coordinates, units, timestamps and provenance exact. Never invent NASA measurements, mission outcomes, licensing permission or test results. If input data are absent, use separately labeled synthetic fixtures only for **unit tests**, never for a mission screenshot. Write tests, run them, report commands/results, list limitations and source/attribution changes. Do not merge to main, modify shared contracts or overwrite other workers' work. Ask the human integration lead before changing an interface. Prefer correct working 2D MVP over attractive unsupported 3D claims."

## 14. Submission story

**Problem:** Terrain-aware navigation typically models where Sun and Earth are visible, but visibility alone does not mean a particular spacecraft's fixed hardware can use those directions.

**Contribution:** A site × date × lander-heading explorer with transparent solar incidence, energy reserve, antenna pointing, and (where supported) deployment constraints, using NASA data.

**Proof:** A reproducible real NASA location/date comparison in which changing heading or hardware configuration changes modeled constraints. Cross-check the astronomy and explain every remaining terrain/equipment assumption.

**Honest limits:** educational research simulator only; default hardware and battery are hypothetical; no flight safety certification, thermal finite-element analysis, full DSN link budget, rock clearance or unvalidated 3D self-shadow claims.


## 15. Data handoff and dependency policy — v3 addition

- Science/Terrain agents obtain the supplied actual files through a human-shared local folder. Never assume another agent has the current research session's `/mnt/data` path.
- Each dataset has an exact filename, role, pixel grid, transform, SHA256 and tier documented in `data/provenance/DATA_MANIFEST.json`. **Confirm hashes and CRS** before processing.
- Research ZIPs are individually indexed, prioritized, and assigned to an agent in `RESEARCH_ZIP_INDEX.md`. They are NOT proof of validated NASA Sun/Earth or landing certification.
- Human team lead tracks missing NASA Resources screenshot/source, independent JPL/SPICE geometry, regional far-field LOLA, and aircraft/lander hardware inputs in `docs/TEAM_INPUT_REQUESTS.md`.
- Science grades ephemeris validity separately from horizon coverage. Do not conflate local-only high-quality elevation data with verified complete illumination.
- Missing critical data must produce `unknown` or an explicitly limited analysis rather than an invented pass/fail.
- Reuse external repositories only with license notices and exact commit/file tracking; reference compiled diagrams and data but no whole-solution rebranding.
