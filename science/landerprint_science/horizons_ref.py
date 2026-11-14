"""Fetch JPL Horizons topocentric Sun/Earth tables used to cross-check SPICE.

Follows the SSD API fair-use policy: one request at a time, a pause between
requests, an application User-Agent, and cached files reused on later runs.

Usage: python -m landerprint_science.horizons_ref [--refresh]
"""
from __future__ import annotations

import datetime as dt
import sys
import time
import urllib.parse
import urllib.request

import numpy as np

from . import frame
from .config import (A305_DEM, ANTENNA_HEIGHT_M, HORIZONS_DIR, PANEL_HEIGHT_M, SITES, USER_AGENT,
                     WINDOWS)
from .terrain import Grid

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
TARGETS = {'sun': ('10', PANEL_HEIGHT_M), 'earth': ('399', ANTENNA_HEIGHT_M)}


def ground_height_m(site: dict) -> float:
    x, y = frame.to_map(site['latitudeDeg'], site['longitudeEastDeg'])
    grid = Grid.read(A305_DEM, 'a305', bounds=(x - 50, y - 50, x + 50, y + 50))
    return float(grid.heights(np.array([x]), np.array([y]))[0])


def reference_path(site_id: str, window_id: str, target: str):
    return HORIZONS_DIR / f'{site_id}_{window_id}_{target}.txt'


def query(site: dict, window: dict, command: str, altitude_m: float) -> str:
    start = window['startUtc'].rstrip('Z').replace('T', ' ')
    stop = (dt.datetime.fromisoformat(window['stopUtc'].rstrip('Z')) - dt.timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    params = {
        'format': 'text', 'COMMAND': f"'{command}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'",
        'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'coord@301'", 'COORD_TYPE': "'GEODETIC'",
        'SITE_COORD': f"'{site['longitudeEastDeg']},{site['latitudeDeg']},{altitude_m / 1000.0:.6f}'",
        'START_TIME': f"'{start}'", 'STOP_TIME': f"'{stop}'", 'STEP_SIZE': "'1 h'",
        'QUANTITIES': "'4'", 'ANG_FORMAT': "'DEG'", 'TIME_TYPE': "'UT'", 'CSV_FORMAT': "'YES'",
        'EXTRA_PREC': "'YES'",
    }
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode('utf-8')
    if '$$SOE' not in text:
        raise RuntimeError(f'Horizons returned no table:\n{text[:2000]}')
    return text


def parse(text: str) -> list[tuple[str, float, float]]:
    """Rows of (UTC 'YYYY-MM-DDTHH:MM:SSZ', azimuth deg, elevation deg)."""
    body = text.split('$$SOE')[1].split('$$EOE')[0]
    rows = []
    for line in body.strip().splitlines():
        f = [p.strip() for p in line.split(',')]
        stamp = dt.datetime.strptime(f[0], '%Y-%b-%d %H:%M')
        rows.append((stamp.strftime('%Y-%m-%dT%H:%M:%SZ'), float(f[3]), float(f[4])))
    return rows


def api_version(text: str) -> str:
    first = text.splitlines()[0]
    return first.split(':', 1)[1].strip() if first.startswith('API VERSION') else 'unknown'


def main(refresh: bool = False) -> int:
    HORIZONS_DIR.mkdir(parents=True, exist_ok=True)
    for site in SITES:
        ground = ground_height_m(site)
        for window in WINDOWS:
            for target, (command, height) in TARGETS.items():
                path = reference_path(site['id'], window['id'], target)
                if path.exists() and not refresh:
                    continue
                text = query(site, window, command, ground + height)
                path.write_text(text, encoding='utf-8')
                print(f'{path.name}: {len(parse(text))} rows, API {api_version(text)}')
                time.sleep(2)
    return 0


if __name__ == '__main__':
    sys.exit(main('--refresh' in sys.argv))
