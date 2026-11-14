"""SiteDateData v1 schema validation — synthetic fixtures only."""
import copy
import json
from pathlib import Path

import pytest

from science.schema.site_date import SiteDateValidationError, validate_site_date_data

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'tests' / 'fixtures' / 'synthetic-site-date.json'


def _load_fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding='utf-8'))


def _research_payload() -> dict:
    payload = _load_fixture()
    payload['purpose'] = 'research'
    payload['provenance'] = [
        {
            'id': 'horizons-check',
            'filename': 'horizons_sample.csv',
            'url': 'https://ssd.jpl.nasa.gov/horizons/',
            'sourceVersion': '1',
            'sha256': 'a' * 64,
            'generatedUtc': '2026-11-14T12:00:00Z',
        }
    ]
    payload['samples'][0]['ephemerisQuality'] = 'jpl-verified'
    payload['samples'][0]['sourceId'] = 'horizons-check'
    return payload


def test_synthetic_fixture_validates_as_approximate():
    payload = _load_fixture()
    validate_site_date_data(payload)
    assert payload['purpose'] == 'synthetic-test'
    assert payload['samples'][0]['ephemerisQuality'] == 'approximate'


def test_null_directions_allowed_without_coercion():
    payload = _load_fixture()
    payload['samples'][0]['sun'] = None
    payload['samples'][0]['earth'] = None
    payload['samples'][0]['ephemerisQuality'] = 'missing'
    payload['samples'][0]['sourceId'] = None
    validate_site_date_data(payload)
    assert payload['samples'][0]['sun'] is None
    assert payload['samples'][0]['earth'] is None


def test_forged_jpl_verified_on_synthetic_purpose_rejected():
    payload = _load_fixture()
    payload['samples'][0]['ephemerisQuality'] = 'jpl-verified'
    payload['samples'][0]['sourceId'] = 'synthetic'
    with pytest.raises(SiteDateValidationError, match='forbidden when purpose is synthetic-test'):
        validate_site_date_data(payload)


def test_forged_jpl_verified_without_provenance_rejected():
    payload = _research_payload()
    payload['provenance'] = []
    with pytest.raises(SiteDateValidationError, match='non-empty provenance'):
        validate_site_date_data(payload)


def test_forged_jpl_verified_without_source_id_rejected():
    payload = _research_payload()
    payload['samples'][0]['sourceId'] = None
    with pytest.raises(SiteDateValidationError, match='requires sourceId'):
        validate_site_date_data(payload)


def test_jpl_verified_with_unknown_source_id_rejected():
    payload = _research_payload()
    payload['samples'][0]['sourceId'] = 'not-in-provenance'
    with pytest.raises(SiteDateValidationError, match='not found in provenance'):
        validate_site_date_data(payload)


def test_jpl_verified_with_synthetic_url_rejected():
    payload = _research_payload()
    payload['provenance'][0]['url'] = 'urn:landerprint:synthetic-test'
    with pytest.raises(SiteDateValidationError, match='synthetic provenance URL'):
        validate_site_date_data(payload)


def test_jpl_verified_with_null_sha256_rejected():
    payload = _research_payload()
    payload['provenance'][0]['sha256'] = None
    with pytest.raises(SiteDateValidationError, match='requires provenance sha256'):
        validate_site_date_data(payload)


def test_jpl_verified_with_matching_research_provenance_accepted():
    payload = _research_payload()
    validate_site_date_data(payload)


def test_far_field_requires_provenance_source():
    payload = _load_fixture()
    payload['sunHorizon']['horizonCoverage'] = 'far-field-validated'
    payload['sunHorizon']['sourceId'] = 'missing-source'
    with pytest.raises(SiteDateValidationError, match='not found in provenance'):
        validate_site_date_data(payload)


def test_far_field_with_matching_source_accepted():
    payload = _load_fixture()
    payload['sunHorizon']['horizonCoverage'] = 'far-field-validated'
    payload['sunHorizon']['sourceId'] = 'synthetic'
    payload['sunHorizon']['extentKm'] = 10
    validate_site_date_data(payload)


def test_slope_source_must_resolve_to_provenance():
    payload = _load_fixture()
    payload['slopeSourceId'] = 'not-real'
    with pytest.raises(SiteDateValidationError, match='slopeSourceId'):
        validate_site_date_data(payload)


def test_utc_must_end_with_z():
    payload = _load_fixture()
    payload['samples'][0]['utc'] = '2027-10-01T00:00:00'
    with pytest.raises(SiteDateValidationError, match='UTC'):
        validate_site_date_data(payload)


def test_missing_horizon_requires_empty_angles():
    payload = _load_fixture()
    payload['sunHorizon'] = {
        'observerHeightM': 2,
        'azimuthStepDeg': 90,
        'anglesDeg': [0],
        'extentKm': 1,
        'horizonCoverage': 'missing',
        'sourceId': 'synthetic',
    }
    with pytest.raises(SiteDateValidationError, match='empty anglesDeg'):
        validate_site_date_data(payload)


def test_schema_version_must_be_v1():
    payload = _load_fixture()
    bad = copy.deepcopy(payload)
    bad['schemaVersion'] = '2.0'
    with pytest.raises(SiteDateValidationError, match='schemaVersion'):
        validate_site_date_data(bad)
