"""JPL Horizons observer az/el from a lunar surface site.

Uses the public Horizons HTTP API (challenge Resources listing).
No API key. Responses are hashed for provenance; never invent angles on failure.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
SUN_COMMAND = "'10'"
EARTH_COMMAND = "'399'"
CENTER_MOON = 'coord@301'

# Marker column may be blank, "*", "*i", "m", etc.
_SOE_RE = re.compile(
    r'^\s*(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2})\s+'
    r'(?:[A-Za-z*]+\s+)?'
    r'([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s*$'
)
_MONTHS = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
}


@dataclass(frozen=True)
class HorizonsSample:
    utc: str
    az_deg: float
    el_deg: float


@dataclass(frozen=True)
class HorizonsSeries:
    target: str
    samples: tuple[HorizonsSample, ...]
    raw_result: str
    sha256: str
    query_url: str


class HorizonsError(RuntimeError):
    """Raised when Horizons cannot be queried or parsed safely."""


def _horizons_time(utc_z: str) -> str:
    if not utc_z.endswith('Z'):
        raise HorizonsError(f'UTC must end with Z: {utc_z}')
    dt = datetime.fromisoformat(utc_z[:-1] + '+00:00').astimezone(timezone.utc)
    return dt.strftime('%Y-%m-%d %H:%M')


def _parse_horizons_table(result_text: str) -> list[HorizonsSample]:
    if '$$SOE' not in result_text or '$$EOE' not in result_text:
        raise HorizonsError('Horizons response missing $$SOE/$$EOE table markers')
    body = result_text.split('$$SOE', 1)[1].split('$$EOE', 1)[0]
    samples: list[HorizonsSample] = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        match = _SOE_RE.match(line)
        if not match:
            # Skip daylight/marker-only rows Horizons sometimes inserts.
            continue
        stamp, az_s, el_s = match.groups()
        year = int(stamp[0:4])
        mon = _MONTHS[stamp[5:8]]
        day = int(stamp[9:11])
        hour = int(stamp[12:14])
        minute = int(stamp[15:17])
        utc = f'{year:04d}-{mon:02d}-{day:02d}T{hour:02d}:{minute:02d}:00Z'
        samples.append(HorizonsSample(utc=utc, az_deg=float(az_s), el_deg=float(el_s)))
    if not samples:
        raise HorizonsError('Horizons table contained no parseable az/el rows')
    return samples


def fetch_az_el_series(
    *,
    target: str,
    longitude_east_deg: float,
    latitude_deg: float,
    altitude_km: float,
    start_utc: str,
    stop_utc: str,
    step: str,
    timeout_s: float = 60.0,
    opener=None,
) -> HorizonsSeries:
    """Fetch observer azimuth/elevation for Sun (10) or Earth (399)."""
    if target not in {'sun', 'earth'}:
        raise HorizonsError("target must be 'sun' or 'earth'")
    command = SUN_COMMAND if target == 'sun' else EARTH_COMMAND
    site = f"'{longitude_east_deg},{latitude_deg},{altitude_km}'"
    params = {
        'format': 'json',
        'COMMAND': command,
        'MAKE_EPHEM': 'YES',
        'EPHEM_TYPE': 'OBSERVER',
        'OBJ_DATA': 'NO',
        'CENTER': CENTER_MOON,
        'COORD_TYPE': 'GEODETIC',
        'SITE_COORD': site,
        'START_TIME': _horizons_time(start_utc),
        'STOP_TIME': _horizons_time(stop_utc),
        'STEP_SIZE': step,
        'QUANTITIES': '4',
        'ANG_FORMAT': 'DEG',
        'CAL_FORMAT': 'CAL',
    }
    query_url = f'{HORIZONS_API}?{urllib.parse.urlencode(params)}'
    request = urllib.request.Request(query_url, method='GET', headers={'User-Agent': 'LANDERPRINT-science/0.1'})
    try:
        if opener is None:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                payload = json.loads(response.read().decode('utf-8'))
        else:
            with opener(request, timeout=timeout_s) as response:
                payload = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HorizonsError(f'Horizons request failed: {exc}') from exc

    if not isinstance(payload, dict):
        raise HorizonsError('Horizons JSON payload must be an object')
    result_text = payload.get('result')
    if not isinstance(result_text, str) or not result_text.strip():
        raise HorizonsError('Horizons JSON missing result text')
    digest = hashlib.sha256(result_text.encode('utf-8')).hexdigest()
    samples = _parse_horizons_table(result_text)
    return HorizonsSeries(
        target=target,
        samples=tuple(samples),
        raw_result=result_text,
        sha256=digest,
        query_url=HORIZONS_API,
    )
