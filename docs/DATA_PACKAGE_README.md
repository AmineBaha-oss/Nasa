# Data bundle index and handoff releases

**Current acquisition workflow:** download directly from the official online sources in `docs/DATA_DELIVERY_INSTRUCTIONS.md`. References below to team-supplied CORE/slope ZIPs describe the historical handoff, not a prerequisite for the team. Corrected slope derivatives must be prepared and validated locally.

Three separate artifacts are supplied to avoid duplicating 150 MB raster archives inside a small handoff ZIP.

1. `LANDERPRINT_Agent_Handoff_v3_Data_Sources.zip` — **master documentation**, seven prompts, skills, MCP instructions, exact file hashes, dataset map, source list, request protocol; includes small historical research archive ZIPs nested under `research_zips/`. **No 2026 NASA GeoTIFF data.**
2. `LANDERPRINT_NASA_CORE_Data.zip` — primary newer SDEM, corrected 5m slope, 15m mask, 15m best-resolution, sigma, original NASA README, current inventory and checksums. **Essential for real lunar terrain work.**
3. `lunar_slope_corrected_all_4.zip` — full corrected slope baseline set; optional beyond the corrected 5m layer already inside CORE.

The historical old LOLA DEM `SL3_final_adj_5mpp_surf.tif`, reference difference raster `A305_GLDDIFF_005.tif`, and original uncorrected slope maps are **available from the original research session, but not included in the default MVP transfer**; their sizes are substantial and they are not essential to LANDERPRINT. If asked, provide them separately from the original source, recording exact checksums in `data/provenance/DATA_MANIFEST.json`.

The GIS QA files `lunar_slope_georeference_fix_and_tests.zip`, `landerprint_real_nasa_research_tests.zip` and `lunar_creative_hardware_research_nov13.zip` are already inside the lightweight handoff's `research_zips/`. Agents should not ask the team for these again if they were given the v3 handoff.

The 2027 research scripts use approximate astronomy. The core data archive DOES NOT magically supply verified planetary ephemerides or comprehensive far-field lunar topography. Those must be acquired and checked after the official project start.

The CORE ZIP includes `data/provenance/CORE_FILE_HASHES.sha256` to validate only the five actually bundled raster files. `DATA_FILE_HASHES.sha256` covers all 14 verified source/derivative raster files, including separately delivered ones.
