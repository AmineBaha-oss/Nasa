"""Sites, windows, instrument heights and input files for the science build."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw'
KERNEL_DIR = RAW / 'kernels'
LOLA_DIR = RAW / 'lola'
PROCESSED = ROOT / 'data/processed'
PROVENANCE = ROOT / 'data/provenance'
INPUTS_LOCK = PROVENANCE / 'SCIENCE_INPUTS.json'
HORIZONS_DIR = ROOT / 'science/reference/horizons'
A305_DIR = Path(os.environ.get('NASA_DATA_DIR') or ROOT / 'data/nasa_a305/A3CLR22_5_Connecting_Ridge_Extension')
A305_DEM = A305_DIR / 'A305_GLDELEV_005.tif'

# Hypothetical until Power/Comms approve hardware (HARDWARE-001..003).
HEIGHTS_ARE_HYPOTHETICAL = True
PANEL_HEIGHT_M = 2.0
ANTENNA_HEIGHT_M = 3.0

SITES = [
    {'id': 'site-1', 'name': 'Connecting Ridge Extension site 1 (ridge)',
     'latitudeDeg': -89.147356, 'longitudeEastDeg': -104.714801},
    {'id': 'site-2', 'name': 'Connecting Ridge Extension site 2 (lower terrain)',
     'latitudeDeg': -89.179543, 'longitudeEastDeg': -92.666612},
    {'id': 'site-3', 'name': 'Connecting Ridge Extension site 3 (high ridge)',
     'latitudeDeg': -89.226289, 'longitudeEastDeg': -111.378532},
    {'id': 'site-4', 'name': 'Connecting Ridge Extension site 4 (ridge north)',
     'latitudeDeg': -89.115272, 'longitudeEastDeg': -102.840947},
    {'id': 'site-5', 'name': 'Connecting Ridge Extension site 5 (lower slope)',
     'latitudeDeg': -89.243060, 'longitudeEastDeg': -94.954874},
    {'id': 'site-6', 'name': 'Connecting Ridge Extension site 6 (outer plain)',
     'latitudeDeg': -88.799372, 'longitudeEastDeg': -107.053845},
    {'id': 'site-7', 'name': 'Connecting Ridge Extension site 7 (outer low)',
     'latitudeDeg': -88.724016, 'longitudeEastDeg': -108.554354},
]
SITE_LABEL = 'Exploratory point from a 5 m slope/coverage screen; not an approved or certified landing site'

WINDOWS = [
    {'id': 'window-a', 'startUtc': '2027-10-10T00:00:00Z', 'stopUtc': '2027-10-17T00:00:00Z'},
    {'id': 'window-b', 'startUtc': '2027-10-24T00:00:00Z', 'stopUtc': '2027-10-31T00:00:00Z'},
]
STEP_S = 3600.0

NAIF = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
KERNELS = [
    {'id': 'naif-lsk', 'name': 'naif0012.tls', 'url': NAIF + 'lsk/naif0012.tls'},
    {'id': 'naif-pck', 'name': 'pck00011.tpc', 'url': NAIF + 'pck/pck00011.tpc'},
    {'id': 'naif-moon-pa', 'name': 'moon_pa_de440_200625.bpc', 'url': NAIF + 'pck/moon_pa_de440_200625.bpc'},
    {'id': 'naif-moon-fk', 'name': 'moon_de440_250416.tf', 'url': NAIF + 'fk/satellites/moon_de440_250416.tf'},
    {'id': 'naif-de440s', 'name': 'de440s.bsp', 'url': NAIF + 'spk/planets/de440s.bsp'},
]

LOLA_BASE = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/'
LOLA = [
    {'id': 'lola-80m', 'name': 'LDEM_80S_80MPP_ADJ.TIF', 'url': LOLA_BASE + 'LDEM_80S_80MPP_ADJ.TIF'},
    {'id': 'lola-240m', 'name': 'LDEM_60S_240MPP_ADJ.TIF', 'url': LOLA_BASE + 'LDEM_60S_240MPP_ADJ.TIF'},
]

# Ray segments (start_m, stop_m, step_m). Beyond 300 km, terrain cannot rise
# above about -3 deg elevation (8 km relief versus s/2R curvature drop), well
# below the +0.6 deg minimum Sun elevation in both windows.
SEGMENTS = [
    (5.0, 5_000.0, 5.0),
    (5_000.0, 40_000.0, 40.0),
    (40_000.0, 120_000.0, 120.0),
    (120_000.0, 300_000.0, 400.0),
]
HORIZON_EXTENT_KM = 300.0
AZIMUTH_STEP_DEG = 1.0
FINE_AZIMUTH_STEP_DEG = 0.25

USER_AGENT = 'LANDERPRINT-science/0.1 (NASA Space Apps 2026; https://github.com/AmineBaha-oss/Nasa)'
REPO_URL = 'https://github.com/AmineBaha-oss/Nasa'
