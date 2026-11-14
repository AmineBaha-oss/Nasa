# Team input request protocol — DO NOT BLOCK OR INVENT

**Current acquisition workflow:** download directly from the official online sources in `docs/DATA_DELIVERY_INSTRUCTIONS.md`. References below to team-supplied CORE/slope ZIPs describe the historical handoff, not a prerequisite for the team. Corrected slope derivatives must be prepared and validated locally.

**If the agent needs a NASA file, spacecraft design parameter, site coordinate, access permission, or scientific reference that the team has not supplied, it must issue a precise request to the human lead.** It must not silently download unrelated substitutes, assume a NASA-specific hardware specification, or assert that nonexistent data are verified.

## Exact request format (agents must use this)

```
REQUEST ID: DATA-001 / HARDWARE-001 / ACCESS-001 / SCIENCE-001 / POLICY-001
Requested by / workstream: <agent>
Priority: BLOCKER | MVP | OPTIONAL
Exact file/data/parameter: <name, expected unit/format and source>
Reason: <calculation and feature blocked>
Already checked: <archives, paths, URLs, and observations>
How team can supply: <upload file, repository path, value, screenshot of Resources tab, approved URL>
Deadline / gate: <e.g., before Gate 1 integration>
Safe fallback if unavailable: <explicit degraded feature/unknown state; never fabricated verified output>
Needed approval: <human team lead>
```

## Requests to check proactively at Gate 0

| ID | Needed from team | Why | Required? | Fallback |
|---|---|---|---|---|
| DATA-001 | **Verify challenge Resources tab**; send a screenshot or exact listed NASA source name/URL and identify which cited data are used | Global Awards NASA-resource requirement | **BLOCKER for eligibility** | NASA-related content must not be falsely represented as resource-listed |
| DATA-002 | Place `LANDERPRINT_NASA_CORE_Data.zip` contents in shared non-Git data folder; send accessible local path to Science/Terrain agents | Actual DEM/slope/quality rasters | **MVP** | Use synthetic only for unit tests, no real landing claims |
| DATA-003 | `lunar_slope_corrected_all_4.zip` if 100/200/400m baselines needed | Extended terrain suitability screen | Optional if 5m CORE layer present | Show only 5m slope baseline with clear limits |
| DATA-004 | Audited coarse far-field LOLA raster/mesh and lunar reprojection details, if source not found in repos | Complete distant terrain Sun/Earth horizon | **Science blocker for global visibility claims** | Mark results `local-only`; unknown outside coverage |
| SCIENCE-001 | Valid JPL Horizons output or properly configured NAIF SPICE kernels, time interval, lunar body frame, source links and verification checkpoints | Accurate lunar Sun/Earth times for chosen sites/dates | **MVP for verified astronomical outputs** | Mark date-specific numbers preliminary/unknown, don't fake NASA confirmation |
| HARDWARE-001 | Is the lander a **hypothetical engineering model** or a named public NASA design? If real, provide approved spec/document | Truthful hardware identity | **MVP** | Use plainly labeled hypothetical preset |
| HARDWARE-002 | Panel normals, area distribution, fixed/gimballed tracking limits, solar efficiency, load profile, battery Wh and reserve Wh | Meaningful solar/battery output | **MVP** | Team signs off a clearly hypothetical preset; no real hardware claim |
| HARDWARE-003 | Antenna boresight relative to lander, cone half-angle, gimbal ranges, observer height; whether yaw is controllable | Geometric Earth pointing | **MVP** | Hypothetical fixed antenna with clear parameters |
| HARDWARE-004 | Landing footprint and ramp/rover orientation, allowable slope and clearance | Terrain/deployment screen | Optional extension | Explicitly show `unknown`; cannot certify safety |
| ACCESS-001 | Shared Git repo URL, agent write permissions, preferred deploy account, human approver | Multi-agent work | **Gate 0** | Work in isolated local branches; don't merge/deploy without approval |
| POLICY-001 | Actual 2026 submission form, video limits and deadline as shown in event UI | Correct final deliverables | **Before submission** | Verify from official instructions; do not rely on historical form examples |

## Rules for requests

1. **Ask the team ONLY for truly missing items**. The 5m SDEM, mask, best-resolution raster, sigma and all corrected slope rasters were already provided in these packages.
2. Show what was checked; do not keep requesting the same data from different agents. The lead owns a single request board.
3. A request does not authorize copying copyrighted data, scraping restricted services, accessing private accounts, or sharing credentials in plain text.
4. Request only the minimum required inputs and give a safe fallback so other agents keep working on their modules.
5. When supplied, verify file checksum/CRS/time convention/schema, mark request RESOLVED, and tell dependent agents which exact path/version to use.
6. Only the human lead can approve hypothetical values, API keys, team hardware choices, source reuse and public scientific claims.
