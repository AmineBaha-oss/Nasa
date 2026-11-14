# Data sources

## Download

- NASA product: [Enhanced Topography Models for Selected Lunar South Pole Regions with Shape-from-Shading](https://pgda.gsfc.nasa.gov/products/104)
- Project region: [Connecting Ridge Extension ZIP, Zenodo v1.0.0](https://zenodo.org/records/17954508/files/A3CLR22_5_Connecting_Ridge_Extension.zip?download=1)
- Archive MD5: `9141ec5d298a3aebab4d3671f7f38a79`
- Dataset record and license details: [Zenodo](https://zenodo.org/records/17954508)

The regional ZIP is about 2.2 GB. The full Zenodo record holds 13 regions and 26.6 GB of ZIP files. Download only Connecting Ridge Extension for this project unless the team chooses another region.

## What's in the regional archive

The archive has much more than the first five rasters:

- 5m surface elevation, hillshade, illumination mosaic, image coverage, best input resolution, uncertainty and SDEM-minus-LOLA difference.
- Slope maps at 5, 10, 20, 50, 100, 200, 400, 800 and 1600m baselines.
- Roughness maps at corresponding scales.
- Many source and processed LROC NAC images, camera adjustment JSON files, illumination-bin products, README files and other processing metadata.

Check the archive's `README.txt` and directory listing before selecting products. The exact bundle contains many gigabytes of supplementary imagery and intermediate files; do not load the full archive into Git or the browser.

## Start with these inputs

| File | Grid | Initial use |
|---|---:|---|
| `A305_GLDELEV_005.tif` | 4000 × 4000, 5m | Elevation and local terrain horizon |
| `SLOPE_MAPS/A305_GLDTSLP_005_005.tif` | 3990 × 3990, 5m | Original slope; check CRS and prepare a corrected derivative |
| `A305_GLDMASK_005.tif` | 1333 × 1333, 15m | Image coverage quality |
| `A305_GLDBRES_005.tif` | 1333 × 1333, 15m | Best input image resolution |
| `A305_GLDSIGM_005.tif` | 4000 × 4000, 5m | Elevation uncertainty product; review its meaning before use |

The corrected slope used by prior research is a local derivative, not the file directly published in the ZIP. Keep the downloaded slope unchanged and document any CRS correction. `data/provenance/` contains metadata for the previously prepared files; verify downloaded originals separately and record new hashes for derivatives.

See [data setup](DATA_DELIVERY_INSTRUCTIONS.md) for download, extraction and validation commands.

## Other project inputs and limits

- The regional terrain covers about 20 × 20 km. It cannot establish the full Sun/Earth horizon without distant terrain.
- Five metre pixels cannot resolve footpad or small rock hazards.
- Sun/Earth positions require [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), also listed in the challenge Resources tab. Choose sites, UTC dates and lunar frames, then independently check results.
- Solar, battery and antenna parameters must come from the team or use a clearly labeled hypothetical configuration.
- The old LOLA comparison raster and the 100/200/400m CRS-corrected slope derivatives are optional historical research inputs; they are not part of the direct project-region download as prepared.
