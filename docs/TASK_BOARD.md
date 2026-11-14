# Task board — prioritize by dependency

## Gate 0 (Saturday 9:00–10:30)

Open inputs: `docs/INPUT_REQUESTS.md`. Data setup: `docs/DATA_DELIVERY_INSTRUCTIONS.md`.
- [ ] **Team data setup:** follow `docs/DATA_DELIVERY_INSTRUCTIONS.md`; download the public Connecting Ridge Extension dataset from NASA’s linked Zenodo record, validate it, prepare the corrected slope, and share local access details with Science/Terrain.
- [x] Read and assign `docs/DATA_ASSET_INDEX.md`, `RESEARCH_ZIP_INDEX.md`, `docs/AGENT_DATA_DEPENDENCIES.md`.
- [ ] Open `docs/TEAM_INPUT_REQUESTS.md` as a live request log and name a human lead for requested missing NASA resources/hardware.
- [x] Inventory Sun/Earth and far-field gaps; precise acquisition and validation remain pending (docs/INPUT_REQUESTS.md).

- [x] Check time against America/Toronto (past 09:00), verify Resources listing, select planned Horizons input. Event registration/location remains human confirmation.
- [x] Initialize existing empty repository on local setup branch, minimal Vite/TS app and Python science environment.
- [ ] Lead freezes `docs/INTERFACES.md` v1, assigns ownership/branches, creates truthful synthetic fixtures.
- [x] Audit two priority upstream repos, license/NOTICE and integration cost; no code copied (docs/SOURCES_AND_LICENSES.md).
- [x] App boots and test runner works (4 web tests, 15 Python integrity tests, TypeScript/Vite build).

## Gate 1 (Saturday 10:30–18:00)
- [ ] SCIENCE: two points + two dates, verified Sun/Earth position, local horizons, provenance.
- [ ] POWER: yaw transform, fixed/tracking solar, battery reserve tests.
- [ ] COMMS: antenna geometry tests independent of GUI.
- [ ] TERRAIN: coordinate-aware slope and 'unknown' behavior tests.
- [ ] UI: 2D heading compass, mission setup, site/date list, scenario result shell.
- [ ] INTEGRATION: vertical slice; no fake mission labels.

## Gate 2 (Saturday 18:00–Sunday noon)
- [ ] Show a real site/date/heading difference; validate with reference values.
- [ ] Combine solar and communication constraints on exactly same data samples.
- [ ] Publish a preview deployment and fix science/input issues.
- [ ] Add battery time series and second hardware template.
- [ ] Deployment screen only if valid at raster scale.

## Gate 3 (Sunday afternoon and evening)
- [ ] Freeze features; run unit and end-to-end smoke tests.
- [ ] Verify scientific limitations, citations, licenses, NASA Resources source and data lineage.
- [ ] Demo video <=30 seconds or slides <=7, public links, incognito check.
- [ ] Project summary, NASA sources and other sources, AI tools, limitations, credits, deployment.
- [ ] Submit well before 23:59 local time.
