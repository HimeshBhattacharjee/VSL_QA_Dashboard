"""Shared line-level ON/OFF rules for shift-based quality reports."""

from copy import deepcopy
from typing import Any, Mapping

LINE_ON = "ON"
LINE_OFF = "OFF"


def get_line_status(line: Mapping[str, Any] | None) -> str:
    """Legacy/missing values are deliberately ON for backwards compatibility."""
    return LINE_OFF if str((line or {}).get("status", LINE_ON)).upper() == LINE_OFF else LINE_ON


def is_line_off(line: Mapping[str, Any] | None) -> bool:
    return get_line_status(line) == LINE_OFF


def normalize_line(line: Mapping[str, Any] | None) -> dict[str, Any]:
    """Remove contradictory measurements when OFF; otherwise add the ON default."""
    if is_line_off(line):
        return {"status": LINE_OFF}
    normalized = deepcopy(dict(line or {}))
    normalized["status"] = LINE_ON
    return normalized


def normalize_lines(lines: Mapping[str, Any] | None, keys) -> dict[str, dict[str, Any]]:
    raw = lines or {}
    return {key: normalize_line(raw.get(key)) for key in keys}


def with_default_line_statuses(entry: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Normalize arbitrary line keys for API responses and legacy database reads."""
    if entry is None:
        return None
    normalized = deepcopy(dict(entry))
    lines = normalized.get("lines")
    if isinstance(lines, Mapping):
        normalized["lines"] = {key: normalize_line(value) for key, value in lines.items()}
    return normalized


def excel_value(line: Mapping[str, Any] | None, value: Any) -> Any:
    return LINE_OFF if is_line_off(line) else ("" if value is None else value)
