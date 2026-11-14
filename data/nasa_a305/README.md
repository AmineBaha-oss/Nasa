# A305 Connecting Ridge Extension terrain

Redistributed subset of the NASA enhanced south-pole shape-from-shading terrain so team members do not need the 2.2 GB archive.

Set `NASA_DATA_DIR` to `data/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension`.

## Source and license

- Bertone, S., McKenna, T. E., Barker, M. K., Mazarico, E., Beyer, R. A., Petro, N. (2026). *Archived Dataset for "Enhanced Topography Models for selected Lunar South Pole regions with Shape-from-Shading"*, version 1.0.0. Zenodo. https://doi.org/10.5281/zenodo.17954508
- Paper: Bertone, S., McKenna, T. E., Barker, M. K., Mazarico, E., Beyer, R. A., Petro, N., *Enhanced Topography Models for selected Lunar South Pole regions with Shape-from-Shading*, The Planetary Science Journal, https://doi.org/10.3847/PSJ/ae5b70
- NASA PGDA product 104: https://pgda.gsfc.nasa.gov/products/104
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Not endorsed by NASA or the authors.

## Contents

| File | Origin |
|---|---|
| `A3CLR22_5_Connecting_Ridge_Extension/README.txt` | Unmodified publisher file |
| `A3CLR22_5_Connecting_Ridge_Extension/A305_GLDELEV_005.tif` | Unmodified publisher file |
| `A3CLR22_5_Connecting_Ridge_Extension/A305_GLDMASK_005.tif` | Unmodified publisher file |
| `A3CLR22_5_Connecting_Ridge_Extension/A305_GLDBRES_005.tif` | Unmodified publisher file |
| `A3CLR22_5_Connecting_Ridge_Extension/A305_GLDSIGM_005.tif` | Unmodified publisher file |
| `A3CLR22_5_Connecting_Ridge_Extension/SLOPE_MAPS/A305_GLDTSLP_005_005.tif` | Unmodified publisher file; no embedded CRS |
| `A3CLR22_5_Connecting_Ridge_Extension/derived/A305_GLDTSLP_005_005_lunar_crs.tif` | **Modified:** original slope with the DEM's lunar CRS added; pixel values, transform and 25 m inset unchanged |

The other archive members (other slope baselines, roughness, hillshade, imagery) are not included. Hashes and the download record are in `data/provenance/A305_DOWNLOAD.json`. Regenerate the derivative with `science/preprocess/prepare_a305.py`.
