"""Horizons table parsing tests (no live network)."""
import io
import json

import pytest

from science.ephemeris.horizons import HorizonsError, _parse_horizons_table, fetch_az_el_series


SAMPLE = """
*******************************************************************************
$$SOE
 2027-Oct-01 00:00 *   275.759899   1.403058
 2027-Oct-01 06:00 *   272.703982   1.360210
$$EOE
*******************************************************************************
"""

SAMPLE_WITH_FLAGS = """
$$SOE
 2027-Oct-15 00:00 *i  105.154287   1.268581
 2027-Oct-15 06:00 *i  102.116071   1.315637
$$EOE
"""


def test_parse_az_el_rows():
    samples = _parse_horizons_table(SAMPLE)
    assert len(samples) == 2
    assert samples[0].utc == '2027-10-01T00:00:00Z'
    assert samples[0].az_deg == pytest.approx(275.759899)
    assert samples[0].el_deg == pytest.approx(1.403058)


def test_parse_rows_with_letter_flags():
    samples = _parse_horizons_table(SAMPLE_WITH_FLAGS)
    assert len(samples) == 2
    assert samples[0].utc == '2027-10-15T00:00:00Z'
    assert samples[0].az_deg == pytest.approx(105.154287)


def test_parse_requires_markers():
    with pytest.raises(HorizonsError):
        _parse_horizons_table('no table here')


@pytest.mark.parametrize('body', [[], None, 'oops'])
def test_non_object_json_payload_raises(body):
    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def opener(request, timeout=60.0):  # noqa: ARG001
        return _Resp(json.dumps(body).encode('utf-8'))

    with pytest.raises(HorizonsError, match='must be an object'):
        fetch_az_el_series(
            target='sun',
            longitude_east_deg=-102.7,
            latitude_deg=-89.1,
            altitude_km=0.0,
            start_utc='2027-10-01T00:00:00Z',
            stop_utc='2027-10-01T06:00:00Z',
            step='6h',
            opener=opener,
        )
