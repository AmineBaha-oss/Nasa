# Data setup — download from the official online sources

**Status: TODO for the lead and Science/Terrain team.** Source pages and archive member names checked on 2026-11-14; dataset bytes have not been downloaded or validated here. This workflow does not require the team's handoff or repackaged CORE ZIP.

## Online sources

- [NASA PGDA product 104](https://pgda.gsfc.nasa.gov/products/104): official product description and citation guidance; links to the public archive.
- [Zenodo record 17954508](https://zenodo.org/records/17954508): version 1.0.0. Select **A3CLR22_5_Connecting_Ridge_Extension.zip** (about 2.2 GB).
- [Direct regional dataset download](https://zenodo.org/records/17954508/files/A3CLR22_5_Connecting_Ridge_Extension.zip?download=1).
- [Public file listing](https://zenodo.org/records/17954508/preview/A3CLR22_5_Connecting_Ridge_Extension.zip?include_deleted=0).

The publisher distributes this dataset as a regional ZIP. Download it directly from Zenodo; do not wait for a teammate's custom data bundle.

## Team TODO

- [ ] **Each data user:** download the regional dataset from the link above into ignored `data/raw/`.
- [ ] **Science:** verify its published MD5 (`9141ec5d298a3aebab4d3671f7f38a79` as checked above), record download UTC, URL, record version and a SHA256 of the download.
- [ ] **Science/Terrain:** extract only the required files listed below plus README.txt; preserve originals unchanged.
- [ ] **Terrain:** inspect slope CRS. If missing, create a separate corrected derivative with the DEM's lunar CRS only after confirming the slope's coordinate transform and 25m inset. Preserve dimensions, transform, nodata and pixel values; verify pixel equality. Never assign the DEM's transform to the inset slope.
- [ ] **Science:** compare original file hashes, byte counts and grids against `data/provenance/DATA_MANIFEST.json`. Investigate mismatches; do not overwrite historical expectations to force a pass. Record new derivative hashes and processing versions separately.
- [ ] **Each data user:** set `NASA_DATA_DIR` to their local dataset directory and provide that path to their agent. Keep absolute paths out of Git.
- [ ] **Lead:** resolve DATA-002 in `docs/INPUT_REQUESTS.md` only after file access and validation succeed.

Required members within `A3CLR22_5_Connecting_Ridge_Extension/`:

```text
README.txt
A305_GLDELEV_005.tif
A305_GLDMASK_005.tif
A305_GLDBRES_005.tif
A305_GLDSIGM_005.tif
SLOPE_MAPS/A305_GLDTSLP_005_005.tif
```

The `_lunar_crs.tif` slope in the historical CORE manifest is a locally prepared derivative, not a publisher download. A newly written GeoTIFF may have a different byte hash despite identical pixel values; record its lineage and verify metadata and values independently. Do not run the historical five-file CORE checksum list against unmodified publisher files and expect the derivative to exist.

## Example download commands — not executed

Run from the repository root:

```sh
mkdir -p data/raw/nasa_a305
curl --fail --location --retry 3 \
  'https://zenodo.org/records/17954508/files/A3CLR22_5_Connecting_Ridge_Extension.zip?download=1' \
  --output data/raw/A3CLR22_5_Connecting_Ridge_Extension.zip
```

On macOS, check the archive against the MD5 above and record SHA256:

```sh
md5 -q data/raw/A3CLR22_5_Connecting_Ridge_Extension.zip
shasum -a 256 data/raw/A3CLR22_5_Connecting_Ridge_Extension.zip
```

On Linux use `md5sum` and `sha256sum`. Stop on an unexpected archive checksum. After checking, extract only these members:

```sh
unzip data/raw/A3CLR22_5_Connecting_Ridge_Extension.zip \
  'A3CLR22_5_Connecting_Ridge_Extension/README.txt' \
  'A3CLR22_5_Connecting_Ridge_Extension/A305_GLDELEV_005.tif' \
  'A3CLR22_5_Connecting_Ridge_Extension/A305_GLDMASK_005.tif' \
  'A3CLR22_5_Connecting_Ridge_Extension/A305_GLDBRES_005.tif' \
  'A3CLR22_5_Connecting_Ridge_Extension/A305_GLDSIGM_005.tif' \
  'A3CLR22_5_Connecting_Ridge_Extension/SLOPE_MAPS/A305_GLDTSLP_005_005.tif' \
  -d data/raw/nasa_a305
export NASA_DATA_DIR="$PWD/data/raw/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension"
```

## Validation and remaining inputs

The project manifest expects DEM 4000×4000 at 5m, slope 3990×3990 with a 25m inset, and MASK/BRES 1333×1333 at 15m. Verify these on downloaded files using Rasterio and native lunar CRS. Sample layers by coordinates, never matching indices. Keep the slope subdirectory and record actual paths in preprocessing.

Sun/Earth data require a separate reproducible [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) / [NAIF SPICE](https://naif.jpl.nasa.gov/naif/) workflow with selected sites, dates, frames and independent verification. Far-field terrain also remains a separate acquisition task. A regional DEM alone does not establish a complete horizon.

Raw downloads, extracted rasters and credentials stay out of Git. Commit only processing code, compact outputs and provenance. Preserve the dataset's citation and usage terms from the source pages and README.
