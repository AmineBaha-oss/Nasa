"""Moon sphere geographic and south-polar stereographic helpers.

Uses lunar radius 1_737_400 m (IAU / A305 CRS). Longitude is east-positive.
Never route lunar coordinates through Earth WGS84 / EPSG:4326.
"""

from __future__ import annotations

from pyproj import Transformer

LUNAR_RADIUS_M = 1_737_400.0
_GEOGRAPHIC = (
    f'+proj=latlong +a={LUNAR_RADIUS_M} +b={LUNAR_RADIUS_M} +no_defs'
)
_STEREO = (
    f'+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 '
    f'+a={LUNAR_RADIUS_M} +b={LUNAR_RADIUS_M} +units=m +no_defs'
)

_TO_STEREO = Transformer.from_crs(_GEOGRAPHIC, _STEREO, always_xy=True)
_TO_LONLAT = Transformer.from_crs(_STEREO, _GEOGRAPHIC, always_xy=True)


def lonlat_to_stereographic(longitude_east_deg: float, latitude_deg: float) -> tuple[float, float]:
    """Return (easting_m, northing_m) in lunar south-polar stereographic."""
    easting, northing = _TO_STEREO.transform(longitude_east_deg, latitude_deg)
    return (float(easting), float(northing))


def stereographic_to_lonlat(easting_m: float, northing_m: float) -> tuple[float, float]:
    """Return (longitude_east_deg, latitude_deg)."""
    lon, lat = _TO_LONLAT.transform(easting_m, northing_m)
    return (float(lon), float(lat))
