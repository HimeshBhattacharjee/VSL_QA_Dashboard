"""Canonical date/FAB context shared by line-wise quality reports."""

from datetime import datetime
from typing import Any


FAB_LINE_I = "FAB-II Line-I"
FAB_LINE_II = "FAB-II Line-II"
FAB_LINES = (FAB_LINE_I, FAB_LINE_II)
LINE_GROUP_BY_FAB = {FAB_LINE_I: "Line-I", FAB_LINE_II: "Line-II"}
FAB_BY_LINE_GROUP = {value: key for key, value in LINE_GROUP_BY_FAB.items()}
PHYSICAL_LINES_BY_FAB = {
    FAB_LINE_I: ("1", "2"),
    FAB_LINE_II: ("3", "4"),
}


def normalize_report_date(value: Any) -> str:
    date_key = str(value or "").split("T")[0]
    datetime.strptime(date_key, "%Y-%m-%d")
    return date_key


def normalize_fab_line(value: Any, *, allow_legacy: bool = False) -> str | None:
    text = " ".join(str(value or "").strip().replace("_", " ").split())
    folded = text.upper().replace("FAB II", "FAB-II").replace("LINE ", "LINE-")
    aliases = {
        FAB_LINE_I.upper(): FAB_LINE_I,
        FAB_LINE_II.upper(): FAB_LINE_II,
        "LINE-I": FAB_LINE_I,
        "LINE-II": FAB_LINE_II,
        "I": FAB_LINE_I,
        "II": FAB_LINE_II,
    }
    normalized = aliases.get(folded)
    if normalized or allow_legacy:
        return normalized
    raise ValueError(f"fab_line must be one of: {', '.join(FAB_LINES)}")


def line_group_for(value: Any) -> str:
    normalized = normalize_fab_line(value)
    return LINE_GROUP_BY_FAB[normalized]


def physical_line_numbers(value: Any) -> tuple[str, str]:
    """Return physical lines in logical-slot order; reject missing/unknown context."""
    normalized = normalize_fab_line(value)
    return PHYSICAL_LINES_BY_FAB[normalized]


def logical_physical_line_pairs(value: Any) -> tuple[tuple[str, str], tuple[str, str]]:
    """Map persisted logical slots to the physical line labels shown in reports."""
    return tuple(zip(("1", "2"), physical_line_numbers(value)))


def fab_line_for(entry: dict, *, allow_legacy: bool = False) -> str | None:
    return normalize_fab_line(entry.get("fabLine") or entry.get("fab") or entry.get("lineGroup"), allow_legacy=allow_legacy)


def report_key(entry: dict, module: str) -> tuple[str, str, str]:
    return module, normalize_report_date(entry.get("reportDate") or entry.get("date") or entry.get("testingDate")), fab_line_for(entry)


def apply_report_context(entry: dict) -> dict:
    normalized = dict(entry)
    report_date = normalize_report_date(entry.get("reportDate") or entry.get("date") or entry.get("testingDate"))
    fab_line = fab_line_for(entry)
    normalized.update({
        "reportDate": report_date,
        "date": report_date,
        "testingDate": str(entry.get("testingDate") or report_date).split("T")[0],
        "fabLine": fab_line,
        "fab": fab_line,
        "lineGroup": LINE_GROUP_BY_FAB[fab_line],
    })
    return normalized


def file_part(value: Any) -> str:
    return str(normalize_fab_line(value)).replace(" ", "_").replace("-", "")
