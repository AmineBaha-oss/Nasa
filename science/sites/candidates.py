"""Gate-1 candidate locations and 2027 date windows.

Both sites lie inside the A305 Connecting Ridge Extension 5 m SDEM.
They are engineering comparison points, not approved landing zones.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SiteCandidate:
    id: str
    name: str
    latitude_deg: float
    longitude_east_deg: float
    label: str
    terrain_source: str = 'A305_GLDELEV_005'
    terrain_coverage_km: float = 20.0


@dataclass(frozen=True)
class DateWindow:
    id: str
    start_utc: str
    stop_utc: str
    step: str
    label: str


# Research preliminary location from MASTER_PLAN (east-positive longitude).
CANDIDATE_SITES: tuple[SiteCandidate, ...] = (
    SiteCandidate(
        id='cre-ridge-a',
        name='Connecting Ridge Ext. A',
        latitude_deg=-89.111829,
        longitude_east_deg=-102.713980,
        label='Preliminary research point inside A305; not an approved landing zone',
    ),
    SiteCandidate(
        id='cre-ridge-b',
        name='Connecting Ridge Ext. B',
        latitude_deg=-89.120000,
        longitude_east_deg=-102.500000,
        label='Second A305 comparison point (~1 km class offset); not an approved landing zone',
    ),
)

# Two October 2027 windows for site/date comparison (UTC).
DATE_WINDOWS: tuple[DateWindow, ...] = (
    DateWindow(
        id='2027-oct-early',
        start_utc='2027-10-01T00:00:00Z',
        stop_utc='2027-10-03T00:00:00Z',
        step='6h',
        label='Early October 2027 comparison window',
    ),
    DateWindow(
        id='2027-oct-mid',
        start_utc='2027-10-15T00:00:00Z',
        stop_utc='2027-10-17T00:00:00Z',
        step='6h',
        label='Mid October 2027 comparison window',
    ),
)
