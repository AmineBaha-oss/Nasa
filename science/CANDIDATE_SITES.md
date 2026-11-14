# Candidate sites and date windows (proposed, pending lead sign-off)

Exploratory points inside the A305 Connecting Ridge Extension tile. **Not approved or certified landing sites.** A 5 m grid cannot resolve footpad-scale hazards.

## Sites

Found with `science/preprocess/find_sites.py` (rerun to reproduce). A cell qualifies when no 5 m slope within a ±100 m square reaches 8°, at least 90% of the surrounding 15 m mask cells have one or more contributing LROC images, and it is at least 2 km from the tile edge (the far field comes from LOLA). 5,728 of 15.9 M cells qualify (about 0.14 km²). Taking the highest cell first and requiring 1 km between picks gives exactly seven distinct sites. Site 1 and site 2 were chosen first, under a 5 km edge margin, and keep their IDs. Projection: south polar stereographic, R = 1,737,400 m. Loosening the slope limit to 10° would give about 21 sites; that is not done because it weakens the hazard proxy.

| ID | Latitude | Longitude (E+) | Easting / northing (m) | Elevation (m) | 5 m slope | Imaged | Edge distance |
|---|---:|---:|---|---:|---:|---:|---:|
| site-1 (ridge) | −89.147356 | −104.714801 | −25007.5 / −6567.5 | 1111.1 | 3.4° | 99.6% | 6.3 km |
| site-2 (lower terrain) | −89.179543 | −92.666612 | −24852.5 / −1157.5 | 509.7 | 5.8° | 100% | 5.1 km |
| site-3 (high ridge) | −89.226289 | −111.378532 | −21848 / −8552 | 1452.8 | 3.1° | 100% | 3.2 km |
| site-4 (ridge north) | −89.115272 | −102.840947 | −26158 / −5962 | 1029.9 | 0.2° | 97% | 7.5 km |
| site-5 (lower slope) | −89.243060 | −94.954874 | −22868 / −1982 | 399.1 | 4.1° | 97.3% | 4.2 km |
| site-6 (outer plain) | −88.799372 | −107.053845 | −34808 / −10678 | 300.3 | 2.8° | 91.4% | 3.9 km |
| site-7 (outer low) | −88.724016 | −108.554354 | −36682 / −12312 | 93.9 | 4.1° | 92.1% | 2.0 km |

Hours with the Sun or Earth centre above the terrain horizon (panel 2 m, antenna 3 m; out of 168):

| Site | window-a Sun | window-a Earth | window-b Sun | window-b Earth |
|---|---:|---:|---:|---:|
| site-1 | 168 | 168 | 160 | 0 |
| site-2 | 168 | 168 | 0 | 0 |
| site-3 | 104 | 168 | 168 | 1 |
| site-4 | 156 | 168 | 168 | 0 |
| site-5 | 168 | 168 | 0 | 0 |
| site-6 | 0 | 116 | 168 | 0 |
| site-7 | 1 | 108 | 91 | 0 |

The 8° / 100 m screen follows published HLS screening context (see `ROUND12_RESEARCH_SUMMARY.md` in the handoff); it is a proxy, not a landing criterion.

Rejected: pre-event Site B (−89.207574, −92.952007) has 0 contributing images, so the SDEM there inherits smoothed LOLA. Pre-event Site C (−89.111829, −102.713980) has a 5 m slope of 8.08° within 100 m; keep it only as the regression reference for the pre-event research.

## Date windows

| ID | UTC window | Sun azimuth | Sun elevation | Earth centre above 0° elevation |
|---|---|---|---|---|
| window-a | 2027-10-10T00:00Z – 2027-10-17T00:00Z | 71–168° | +0.6 to +1.8° | 168 / 168 h at sites 1 and 2 |
| window-b | 2027-10-24T00:00Z – 2027-10-31T00:00Z | 261–358° | +1.4 to +2.4° | 0 / 168 h at sites 1 and 2 |

Source: JPL Horizons API v1.2 (DE441), topocentric `coord@301`, site altitude = DEM elevation + 2 m, 1 h steps, retrieved 2026-11-14. Values are relative to the **mathematical horizon only**; terrain is not applied and SPICE cross-check is not done. Sun elevation stays below 2.4°, so terrain will remove some sunlit hours.

Why these windows: the Sun moves from the east to the west/north between them, so the best fixed-panel heading should change; Earth is up for all of window-a and below the horizon for all of window-b, so direct-to-Earth pointing is possible in one and impossible in the other regardless of heading.
