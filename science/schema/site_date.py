"""Validate SiteDateData v1.0 dicts without fabricating mission claims.

Rules align with docs/INTERFACES.md and web/src/integration/quality.ts:
- schemaVersion must be \"1.0\"; UTC timestamps end in Z.
- Null sun/earth directions mean unknown (never coerced to zero).
- ephemerisQuality \"jpl-verified\" is forbidden on synthetic-test purpose and requires
  provenance with a matching sourceId, non-null sha256, and a non-synthetic URL.
- horizonCoverage \"far-field-validated\" requires sourceId in provenance, extentKm > 0,
  and a fully populated finite angle list.
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any, Mapping

SCHEMA_VERSION = '1.0'
EPHEMERIS_QUALITIES = frozenset({'jpl-verified', 'approximate', 'missing'})
HORIZON_COVERAGES = frozenset({'far-field-validated', 'local-only', 'missing'})
DATA_PURPOSES = frozenset({'research', 'synthetic-test'})
UTC_Z_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$')
SYNTHETIC_URL_MARKERS = ('urn:landerprint:synthetic', 'synthetic-test')
MAX_SAMPLES = 10_000
MAX_HORIZON_BINS = 3600


class SiteDateValidationError(ValueError):
    """Raised when a SiteDateData payload fails contract checks."""


def _require_mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise SiteDateValidationError(f'{label} must be an object')
    return value


def _require_str(obj: Mapping[str, Any], key: str, label: str | None = None) -> str:
    where = label or key
    if key not in obj or not isinstance(obj[key], str) or not obj[key]:
        raise SiteDateValidationError(f'{where} must be a non-empty string')
    return obj[key]


def _require_number(obj: Mapping[str, Any], key: str, label: str | None = None) -> float:
    where = label or key
    value = obj.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SiteDateValidationError(f'{where} must be a number')
    if not math.isfinite(value):
        raise SiteDateValidationError(f'{where} must be finite')
    return float(value)


def _require_utc_z(value: str, label: str) -> str:
    if not UTC_Z_RE.match(value):
        raise SiteDateValidationError(f'{label} must be UTC ISO-8601 ending in Z')
    try:
        datetime.fromisoformat(value[:-1] + '+00:00')
    except ValueError as exc:
        raise SiteDateValidationError(f'{label} is not a valid UTC date/time') from exc
    return value


def _is_synthetic_url(url: str) -> bool:
    lowered = url.lower()
    return any(marker in lowered for marker in SYNTHETIC_URL_MARKERS)


def _validate_direction(value: Any, label: str) -> None:
    if value is None:
        return
    direction = _require_mapping(value, label)
    _require_number(direction, 'azDeg', f'{label}.azDeg')
    _require_number(direction, 'elDeg', f'{label}.elDeg')


def _validate_provenance(entry: Any, index: int) -> dict[str, Any]:
    label = f'provenance[{index}]'
    prov = _require_mapping(entry, label)
    prov_id = _require_str(prov, 'id', f'{label}.id')
    _require_str(prov, 'filename', f'{label}.filename')
    url = _require_str(prov, 'url', f'{label}.url')
    _require_str(prov, 'sourceVersion', f'{label}.sourceVersion')
    if 'sha256' not in prov:
        raise SiteDateValidationError(f'{label}.sha256 is required (string or null)')
    if prov['sha256'] is not None and not isinstance(prov['sha256'], str):
        raise SiteDateValidationError(f'{label}.sha256 must be string or null')
    if isinstance(prov['sha256'], str) and not prov['sha256'].strip():
        raise SiteDateValidationError(f'{label}.sha256 must be null or a non-empty digest')
    _require_utc_z(_require_str(prov, 'generatedUtc', f'{label}.generatedUtc'), f'{label}.generatedUtc')
    return {
        'id': prov_id,
        'url': url,
        'sha256': prov['sha256'],
    }


def _validate_site(site: Any) -> None:
    obj = _require_mapping(site, 'site')
    for key in ('id', 'name', 'terrainSource', 'label'):
        _require_str(obj, key, f'site.{key}')
    _require_number(obj, 'latitudeDeg', 'site.latitudeDeg')
    _require_number(obj, 'longitudeEastDeg', 'site.longitudeEastDeg')
    _require_number(obj, 'terrainCoverageKm', 'site.terrainCoverageKm')


def _assert_jpl_provenance(source_id: str, provenance_by_id: Mapping[str, dict[str, Any]], label: str) -> None:
    record = provenance_by_id.get(source_id)
    if record is None:
        raise SiteDateValidationError(f'{label}: sourceId {source_id!r} not found in provenance ids')
    if record['sha256'] is None:
        raise SiteDateValidationError(
            f'{label}: jpl-verified requires provenance sha256 for sourceId {source_id!r}'
        )
    if _is_synthetic_url(record['url']):
        raise SiteDateValidationError(
            f'{label}: jpl-verified cannot use synthetic provenance URL for sourceId {source_id!r}'
        )


def _validate_sample(
    sample: Any,
    index: int,
    provenance_by_id: Mapping[str, dict[str, Any]],
    purpose: str,
) -> None:
    label = f'samples[{index}]'
    obj = _require_mapping(sample, label)
    _require_utc_z(_require_str(obj, 'utc', f'{label}.utc'), f'{label}.utc')
    for body in ('sun', 'earth'):
        if body not in obj:
            raise SiteDateValidationError(f'{label}.{body} is required (direction or null)')
        _validate_direction(obj[body], f'{label}.{body}')
    quality = _require_str(obj, 'ephemerisQuality', f'{label}.ephemerisQuality')
    if quality not in EPHEMERIS_QUALITIES:
        raise SiteDateValidationError(f'{label}.ephemerisQuality invalid: {quality}')
    source_id = obj.get('sourceId')
    if source_id is not None and not isinstance(source_id, str):
        raise SiteDateValidationError(f'{label}.sourceId must be string or null')

    if quality == 'jpl-verified':
        if purpose == 'synthetic-test':
            raise SiteDateValidationError(
                f'{label}: ephemerisQuality jpl-verified is forbidden when purpose is synthetic-test'
            )
        if not provenance_by_id:
            raise SiteDateValidationError(
                f'{label}: ephemerisQuality jpl-verified requires non-empty provenance'
            )
        if not source_id:
            raise SiteDateValidationError(
                f'{label}: ephemerisQuality jpl-verified requires sourceId'
            )
        _assert_jpl_provenance(source_id, provenance_by_id, label)


def _validate_horizon(
    profile: Any,
    label: str,
    provenance_by_id: Mapping[str, dict[str, Any]],
) -> None:
    obj = _require_mapping(profile, label)
    _require_number(obj, 'observerHeightM', f'{label}.observerHeightM')
    step = _require_number(obj, 'azimuthStepDeg', f'{label}.azimuthStepDeg')
    if step <= 0:
        raise SiteDateValidationError(f'{label}.azimuthStepDeg must be > 0')
    extent = _require_number(obj, 'extentKm', f'{label}.extentKm')
    coverage = _require_str(obj, 'horizonCoverage', f'{label}.horizonCoverage')
    if coverage not in HORIZON_COVERAGES:
        raise SiteDateValidationError(f'{label}.horizonCoverage invalid: {coverage}')
    source_id = obj.get('sourceId')
    if source_id is not None and not isinstance(source_id, str):
        raise SiteDateValidationError(f'{label}.sourceId must be string or null')
    angles = obj.get('anglesDeg')
    if not isinstance(angles, list):
        raise SiteDateValidationError(f'{label}.anglesDeg must be a list')
    if len(angles) > MAX_HORIZON_BINS:
        raise SiteDateValidationError(f'{label}.anglesDeg exceeds max bins ({MAX_HORIZON_BINS})')
    for i, angle in enumerate(angles):
        if angle is None:
            continue
        if isinstance(angle, bool) or not isinstance(angle, (int, float)) or not math.isfinite(angle):
            raise SiteDateValidationError(f'{label}.anglesDeg[{i}] must be a finite number or null')

    if coverage == 'missing':
        if angles:
            raise SiteDateValidationError(f'{label}: missing coverage requires empty anglesDeg')
        if extent != 0:
            raise SiteDateValidationError(f'{label}: missing coverage requires extentKm 0')
        if source_id is not None:
            raise SiteDateValidationError(f'{label}: missing coverage requires null sourceId')
        return

    if coverage == 'far-field-validated':
        if not source_id:
            raise SiteDateValidationError(f'{label}: far-field-validated requires sourceId')
        if source_id not in provenance_by_id:
            raise SiteDateValidationError(
                f'{label}: sourceId {source_id!r} not found in provenance ids'
            )
        if extent <= 0:
            raise SiteDateValidationError(f'{label}: far-field-validated requires extentKm > 0')
        if not angles:
            raise SiteDateValidationError(f'{label}: far-field-validated requires populated anglesDeg')
        if any(angle is None for angle in angles):
            raise SiteDateValidationError(f'{label}: far-field-validated forbids null horizon bins')

    if angles:
        expected = int(round(360.0 / step))
        if abs(360.0 / step - expected) > 1e-9:
            raise SiteDateValidationError(
                f'{label}.azimuthStepDeg must divide 360 evenly for populated profiles'
            )
        if len(angles) != expected:
            raise SiteDateValidationError(
                f'{label}.anglesDeg length {len(angles)} != 360/azimuthStepDeg ({expected})'
            )


def validate_site_date_data(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """Validate a SiteDateData-like mapping; return the same object if valid."""
    data = _require_mapping(payload, 'SiteDateData')
    version = _require_str(data, 'schemaVersion', 'schemaVersion')
    if version != SCHEMA_VERSION:
        raise SiteDateValidationError(f'schemaVersion must be {SCHEMA_VERSION!r}, got {version!r}')
    purpose = _require_str(data, 'purpose', 'purpose')
    if purpose not in DATA_PURPOSES:
        raise SiteDateValidationError(f'purpose invalid: {purpose}')

    provenance = data.get('provenance')
    if not isinstance(provenance, list):
        raise SiteDateValidationError('provenance must be a list')
    provenance_records = [_validate_provenance(entry, i) for i, entry in enumerate(provenance)]
    provenance_by_id = {record['id']: record for record in provenance_records}
    if len(provenance_by_id) != len(provenance_records):
        raise SiteDateValidationError('provenance ids must be unique')

    _validate_site(data.get('site'))

    samples = data.get('samples')
    if not isinstance(samples, list):
        raise SiteDateValidationError('samples must be a list')
    if len(samples) > MAX_SAMPLES:
        raise SiteDateValidationError(f'samples exceeds max length ({MAX_SAMPLES})')
    for i, sample in enumerate(samples):
        _validate_sample(sample, i, provenance_by_id, purpose)

    _validate_horizon(data.get('sunHorizon'), 'sunHorizon', provenance_by_id)
    _validate_horizon(data.get('earthHorizon'), 'earthHorizon', provenance_by_id)

    if 'slopeSourceId' in data and data['slopeSourceId'] is not None:
        slope_id = data['slopeSourceId']
        if not isinstance(slope_id, str) or not slope_id:
            raise SiteDateValidationError('slopeSourceId must be a non-empty string when set')
        if slope_id not in provenance_by_id:
            raise SiteDateValidationError(
                f'slopeSourceId {slope_id!r} not found in provenance ids'
            )

    return data
