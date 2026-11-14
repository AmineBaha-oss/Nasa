# Open inputs

| Item | Needed | Owner | Until available |
|---|---|---|---|
| HARDWARE-001–003: lander | Agree on PV area/normals/tracking, loads, battery/reserve, efficiencies, antenna geometry, heights and yaw control. Science currently uses hypothetical heights (panels 2 m, antenna 3 m) in `science/landerprint_science/config.py`. | Team lead / Power / Comms | No approved hardware results; Science outputs labelled hypothetical |
| ACCESS-001: deployment | Owners assigned in `docs/TASK_BOARD.md` (Amine reviews and merges). Choose deployment account when needed. | Team lead | Work locally |
| POLICY-001: submission | Check the actual submission form, deadline and demo format. | Team lead | Keep submission as a draft |

The challenge Resources list was checked: Horizons is listed and selected for planned use. See `docs/CHALLENGE_RESOURCES.json`. Actual data integration is pending.

SCIENCE-001 (ephemeris) resolved 2026-11-14: seven exploratory sites (`science/CANDIDATE_SITES.md`) and two 2027 windows; SPICE (DE440, MOON_ME) agrees with cached JPL Horizons tables to under 5e-7 deg at all 2352 site-hours (tolerance 0.01 deg). Outputs in `data/processed/`; numbers in `data/processed/validation_report.json`.

DATA-004 (distant terrain) resolved 2026-11-14: LOLA 80 m and 240 m (PGDA product 90) downloaded with pinned hashes (`data/provenance/SCIENCE_INPUTS.json`); A305 vs LOLA 80 m median offset 0.02 m at 1000 points (`data/provenance/A305_FRAME_CHECK.json`). Horizons are complete to 300 km at all seven sites.

DATA-002 (terrain) resolved 2026-11-14: Zenodo v1.0.0 archive MD5 matched; five originals match the manifest; corrected 5m slope verified pixel-equal. Files are in `data/nasa_a305/`; record in `data/provenance/A305_DOWNLOAD.json`.

Update this list when an input arrives. Record its source, validation result and usable local path; keep machine-specific paths out of Git. Additional slope baselines and ramp geometry are optional extension inputs.
