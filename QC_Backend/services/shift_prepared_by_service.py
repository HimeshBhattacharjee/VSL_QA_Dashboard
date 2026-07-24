"""Trusted, deterministic Prepared By rendering for shift-based reports."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from services.creator_resolution_service import normalize_text


SHIFT_ORDER = ("A", "B", "C")
DEFAULT_BLANK = "-"


def _snapshot_name(entry: Mapping[str, Any]) -> str:
    """Return the immutable operator name captured on the report, never a live profile."""
    # submittedBy is written by the authenticated submit endpoint. Older records use
    # the authenticated signature/creator snapshots captured when the entry was made.
    for value in (
        entry.get("submittedBy"),
        (entry.get("signatures") or {}).get("preparedBy") if isinstance(entry.get("signatures"), Mapping) else None,
        entry.get("createdByEmployeeName"),
        entry.get("createdBy"),
    ):
        name = normalize_text(value)
        if name:
            return name
    return ""


def aggregate_prepared_by(entries: Iterable[Mapping[str, Any]], blank: str = DEFAULT_BLANK) -> dict[str, list[str]]:
    """Group stable, unique operator snapshots by A/B/C shift."""
    grouped = {shift: [] for shift in SHIFT_ORDER}
    seen = {shift: set() for shift in SHIFT_ORDER}
    for entry in entries:
        shift = normalize_text(entry.get("shift")).upper()
        if shift not in grouped:
            continue
        name = _snapshot_name(entry)
        folded = name.casefold()
        if name and folded not in seen[shift]:
            seen[shift].add(folded)
            grouped[shift].append(name)
    return {shift: names or [blank] for shift, names in grouped.items()}


def format_prepared_by(entries: Iterable[Mapping[str, Any]], blank: str = DEFAULT_BLANK) -> str:
    grouped = aggregate_prepared_by(entries, blank=blank)
    return "; ".join(f"{shift}: {', '.join(grouped[shift])}" for shift in SHIFT_ORDER)


def trusted_signature_update(
    requested: Mapping[str, Any], existing: Mapping[str, Any] | None, user: Mapping[str, Any]
) -> dict[str, Any]:
    """Prevent client text from impersonating the authenticated preparer."""
    from fastapi import HTTPException, status

    result = dict(existing or {})
    requested_preparer = normalize_text(requested.get("preparedBy"))
    current_preparer = normalize_text(result.get("preparedBy"))
    user_name = normalize_text(user.get("name"))
    role = normalize_text(user.get("role")).casefold()
    if "preparedBy" in requested:
        if requested_preparer:
            if role != "operator":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can sign Prepared By")
            result["preparedBy"] = user_name
        elif current_preparer:
            if current_preparer.casefold() != user_name.casefold():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the signing operator can remove Prepared By")
            result["preparedBy"] = ""

    # Preserve the established reviewer/approver flow; only Prepared By is system-owned here.
    for key, value in requested.items():
        if key != "preparedBy":
            result[key] = value
    return result
