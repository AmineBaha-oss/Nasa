import json
import re

import pytest

from landerprint_science.config import ANTENNA_HEIGHT_M, PANEL_HEIGHT_M, PROCESSED, SITES, WINDOWS

FILES = [PROCESSED / f'{s["id"]}_{w["id"]}.json' for s in SITES for w in WINDOWS]
TOP = {'schemaVersion', 'purpose', 'provenance', 'site', 'samples', 'sunHorizon', 'earthHorizon'}
PROVENANCE = {'id', 'filename', 'url', 'sourceVersion', 'sha256', 'generatedUtc'}
SITE = {'id', 'name', 'latitudeDeg', 'longitudeEastDeg', 'terrainSource', 'terrainCoverageKm', 'label'}
SAMPLE = {'utc', 'sun', 'earth', 'ephemerisQuality', 'sourceId'}
PROFILE = {'observerHeightM', 'azimuthStepDeg', 'anglesDeg', 'extentKm', 'horizonCoverage', 'sourceId'}
UTC = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')


def load(path):
    if not path.exists():
        pytest.skip(f'{path.name} not built; run python -m landerprint_science.build')
    return json.loads(path.read_text())


@pytest.mark.parametrize('path', FILES, ids=[p.stem for p in FILES])
def test_contract_fields(path):
    data = load(path)
    assert TOP <= set(data) <= TOP | {'slopeSourceId'}
    assert data['schemaVersion'] == '1.0'
    assert data['purpose'] == 'research'
    assert set(data['site']) == SITE
    assert all(set(p) == PROVENANCE for p in data['provenance'])
    assert all(UTC.match(p['generatedUtc']) for p in data['provenance'])
    assert len(data['samples']) == 168
    for s in data['samples']:
        assert set(s) == SAMPLE and UTC.match(s['utc'])
        assert s['ephemerisQuality'] in {'jpl-verified', 'approximate', 'missing'}
        for target in ('sun', 'earth'):
            assert set(s[target]) == {'azDeg', 'elDeg'} and 0 <= s[target]['azDeg'] < 360
    for key in ('sunHorizon', 'earthHorizon'):
        prof = data[key]
        assert set(prof) == PROFILE
        assert len(prof['anglesDeg']) == 360 / prof['azimuthStepDeg'] == 360
        assert prof['horizonCoverage'] in {'far-field-validated', 'local-only', 'missing'}
        if prof['horizonCoverage'] == 'far-field-validated':
            assert None not in prof['anglesDeg']


@pytest.mark.parametrize('path', FILES, ids=[p.stem for p in FILES])
def test_every_source_resolves(path):
    data = load(path)
    ids = [p['id'] for p in data['provenance']]
    assert len(ids) == len(set(ids))
    known = {p['id']: p for p in data['provenance']}
    refs = {s['sourceId'] for s in data['samples']} | {data['sunHorizon']['sourceId'], data['earthHorizon']['sourceId'],
                                                       data.get('slopeSourceId')}
    for ref in refs - {None}:
        assert ref in known
        assert re.fullmatch(r'[0-9a-f]{64}', known[ref]['sha256'])


@pytest.mark.parametrize('path', FILES, ids=[p.stem for p in FILES])
def test_observer_heights(path):
    data = load(path)
    assert data['sunHorizon']['observerHeightM'] == PANEL_HEIGHT_M
    assert data['earthHorizon']['observerHeightM'] == ANTENNA_HEIGHT_M
    assert PANEL_HEIGHT_M != ANTENNA_HEIGHT_M
