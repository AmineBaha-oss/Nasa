# Open inputs

| Item | Needed | Owner | Until available |
|---|---|---|---|
| SCIENCE-001: ephemeris | Choose sites, UTC dates and lunar frame; obtain and independently compare Horizons/SPICE geometry. | Science | Partial: 2 A305 sites × 2 Oct-2027 windows fetched from Horizons into `data/processed/` (`jpl-verified`). SPICE independent cross-check still open. |
| DATA-004: distant terrain | Select and validate far-field LOLA coverage. | Science | Label analysis local-only |
| HARDWARE-001–003: lander | Agree on PV area/normals/tracking, loads, battery/reserve, efficiencies, antenna geometry, heights and yaw control. | Team lead / Power / Comms | No approved hardware results |
| ACCESS-001: deployment | Owners assigned in `docs/TASK_BOARD.md` (Amine reviews and merges). Choose deployment account when needed. | Team lead | Work locally |
| POLICY-001: submission | Check the actual submission form, deadline and demo format. | Team lead | Keep submission as a draft |

The challenge Resources list was checked: Horizons is listed and selected for planned use. See `docs/CHALLENGE_RESOURCES.json`. Actual data integration is pending.

DATA-002 (terrain) resolved 2026-11-14: Zenodo v1.0.0 archive MD5 matched; five originals match the manifest; corrected 5m slope verified pixel-equal. Files are in `data/nasa_a305/`; record in `data/provenance/A305_DOWNLOAD.json`.

Update this list when an input arrives. Record its source, validation result and usable local path; keep machine-specific paths out of Git. Additional slope baselines and ramp geometry are optional extension inputs.
