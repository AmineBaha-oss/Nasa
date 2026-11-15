# Science sources, licenses and usage terms

Checked 2026-11-14 (UTC). Lists where each Science input comes from, how it may be used, and what was confirmed. Exact files, sizes and SHA256 for downloaded inputs are in `data/provenance/SCIENCE_INPUTS.json`; validation numbers are in `data/processed/validation_report.json`.

## 1. Local terrain — NASA A305 Connecting Ridge Extension SDEM

| | |
|---|---|
| Product | Enhanced Topography Models for selected Lunar South Pole regions with Shape-from-Shading, region A3CLR22-#5 (A305) |
| Pages | https://pgda.gsfc.nasa.gov/products/104 ; https://doi.org/10.5281/zenodo.17954508 (v1.0.0) |
| License | CC BY 4.0 (Zenodo record metadata). Redistribution allowed with attribution and a note of changes. |
| Required citation | Bertone, S., McKenna, T. E., Barker, M. K., Mazarico, E., Beyer, R. A., Petro, N., *Enhanced Topography Models for selected Lunar South Pole regions with Shape-from-Shading*, The Planetary Science Journal, doi:10.3847/PSJ/ae5b70; and the Zenodo archive above. |
| In repo | `data/nasa_a305/` (hashes in `data/provenance/A305_DOWNLOAD.json`) |
| Projection | `+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m` (IAU 30135, Moon 2015 sphere) |
| Frame | Not stated in the README. PGDA says the SDEMs stay "consistent with the LOLA geodetic reference" (MOON_ME / DE421). Confirmed 2026-11-14: LOLA 80 m minus A305 (averaged per 80 m pixel) at 1000 random points has median 0.02 m, std 1.12 m, and the best fit is at zero horizontal shift (`data/provenance/A305_FRAME_CHECK.json`). |
| Coverage | 20 × 20 km; local horizon only |
| Excerpts shipped | `data/processed/terrain/site-<n>.json`: 400 m × 400 m (80 × 80 pixel) windows of `A305_GLDELEV_005.tif` and the CRS-corrected 5 m slope, one per site, values rounded to 0.001 m / 0.001°. Changes: cropped and rounded only. Each file carries the source URL and SHA256; CC BY 4.0 attribution as above. |

## 2. Far-field terrain — LOLA south-pole DEMs (DATA-004)

| | |
|---|---|
| Product | A New View of the Lunar South Pole from LOLA (Barker et al.) |
| Page | https://pgda.gsfc.nasa.gov/products/90 ; data DOI https://doi.org/10.60903/gsfcpgda-lola-spole |
| Required citation | Barker, M. K., et al. (2023), The Planetary Science Journal, doi:10.3847/PSJ/acf3e1 (PGDA: "cite this paper when using these products") |
| License | NASA GSFC public data product; no license file found. Cite as above; confirm terms before redistributing files. |
| Files used | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF` (189,158,392 bytes; 7600 × 7600, 80 m, ±304 km) and `LDEM_60S_240MPP_ADJ.TIF` (218,961,039 bytes; 240 m, to 60° S). Not in Git; `python -m landerprint_science.kernels` downloads them to `data/raw/lola/` and checks size and SHA256. Not used: 40 m (685 MB) and 20 m (2.6 GB) versions. |
| Confirmed | Same projection and 1737.4 km sphere as A305; float32, nodata NaN. Agrees with A305 (see the frame row above). |
| Frame | MOON_ME of DE421 (stated on product page) |
| Status | Validated and nested with A305: each ray sample uses A305 5 m where present, then LOLA 80 m, then LOLA 240 m, out to 300 km. All seven sites have all 360 bins complete, so profiles are `far-field-validated`. |

Older LOLA reference (optional validation only): https://pgda.gsfc.nasa.gov/products/78.

## 3. Sun/Earth ephemeris — JPL Horizons (challenge-listed resource)

| | |
|---|---|
| Docs | https://ssd.jpl.nasa.gov/horizons/ ; API https://ssd-api.jpl.nasa.gov/doc/horizons.html (doc v1.3) |
| Terms | SSD API fair-use policy (https://ssd-api.jpl.nasa.gov/): one request at a time, cache results, back off on errors, send an application-specific `User-Agent` with contact info, and **do not call the API from the website** (NASA CORS policy). Precompute and ship JSON. Formats can change: check the returned API version. |
| Required citation | "NASA/JPL Solar System Dynamics. Data retrieved on (YYYY-MM-DD). Horizons System. https://ssd.jpl.nasa.gov" (https://ssd.jpl.nasa.gov/about/) |
| Copyright note | Horizons table layouts are JPL work; numeric values may be used with citation. Do not republish raw tables as our own. |

Confirmed with one live query (2026-11-14, target Sun, 2027-10-01 00:00–02:00 UT, site −102.713980° E, −89.111829°, 0 km):

```
CENTER='coord@301' COORD_TYPE='GEODETIC' SITE_COORD='-102.713980,-89.111829,0'
EPHEM_TYPE='OBSERVER' QUANTITIES='4' ANG_FORMAT='DEG' TIME_TYPE='UT' CSV_FORMAT='YES'
```

- Returned API VERSION 1.2, ephemeris DE441.
- Site frame `MEAN_ME (high precision)`, east-longitude positive, Moon radius 1737.4 km sphere.
- Azimuth clockwise from north (N 0 → E 90 → S 180 → W 270); elevation from the plane perpendicular to the local zenith; airless apparent position of the **target centre**.
- Result: Sun az 275.76°, el 1.40° at 2027-10-01 00:00 UT.
- Reference tables for all seven sites, both windows, Sun (2 m) and Earth (3 m), hourly with `EXTRA_PREC`, are cached in `science/reference/horizons/` (28 files, 168 rows each, API 1.2). SPICE agrees with every row to under 5e-7 deg.
- UTC after the last announced leap second uses that leap second as constant.
- Use `COMMAND='399'` for Earth. Site altitude is km above the 1737.4 km sphere; set it from DEM height + instrument height.

## 4. Independent check — NAIF SPICE via SpiceyPy

| | |
|---|---|
| Rules | https://naif.jpl.nasa.gov/naif/rules.html — no fees or license required; kernels from the NAIF server may be used and redistributed **unmodified**; modified kernels need renamed files and updated attribution. Acknowledge SPICE/NAIF use (encouraged). Toolkit is export-designated TSPA. |
| Kernels used | `lsk/naif0012.tls`; `pck/pck00011.tpc`; `spk/planets/de440s.bsp` (31 MB); `pck/moon_pa_de440_200625.bpc` (12 MB, covers 1549–2650); `fk/satellites/moon_de440_250416.tf`. Unmodified; downloaded to `data/raw/kernels/` with hashes pinned in `data/provenance/SCIENCE_INPUTS.json`. |
| Base URL | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ |
| Note | The PCK comments cite `moon_de440_200625.tf`; the server now has `moon_de440_250416.tf`, which defines `MOON_ME` and loads with the PA kernel. Results match Horizons `MEAN_ME`, confirming the frame. |
| Method | `azlcpo` (ellipsoid normal on the 1737.4 km sphere, `LT+S`, azimuth clockwise from north), observer at terrain height + instrument height. Body centre only. |
| Independence | Horizons (DE441) and SPICE (DE440) both come from JPL SSD. The comparison checks our site, frame, time and az/el handling, not the ephemeris itself. Record that limit. |

## 5. Software

| Package | Version (pinned) | License | Citation / note |
|---|---|---|---|
| SpiceyPy | 8.4.0 | MIT | Annex et al. (2020), JOSS, doi:10.21105/joss.02050; wraps NAIF CSPICE (rules above) |
| rasterio | 1.5.2 | BSD-3-Clause | Bundles GDAL (MIT/X) |
| pyproj | 3.8.0 | MIT | Bundles PROJ (MIT) |
| NumPy | 2.5.4 | BSD-3-Clause (plus bundled 0BSD, MIT, Zlib, CC0-1.0 parts) | |
| affine | 3.0.1 | BSD-3-Clause | |
| pytest | 9.2.0 | MIT | Test only |

Licenses read from installed package metadata in `.venv`.

## 6. Pre-event research (reference only)

`landerprint_real_nasa_research_tests.zip` and `second_opinion_actual_nasa_pair_tests.zip` sit in the handoff (`research_zips/`, outside Git). They use approximate astronomy and 3 km horizons: regression comparison only, never published as results.

## Open items

- Panel 2 m and antenna 3 m heights are hypothetical (HARDWARE-001). Change them in `landerprint_science/config.py`, then rerun `horizons_ref --refresh` and `build`.
- Sun and Earth are treated as points at their centres; partial-disc visibility near the horizon is not modelled.
- A 5 m grid cannot resolve small landing or ramp hazards.
