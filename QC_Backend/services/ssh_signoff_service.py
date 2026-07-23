"""Audit-safe monthly sign-off resolution for Sealant Shore Hardness reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from bson import ObjectId


VALID_CHECK_STATES = {"submitted", "approved"}
INVALID_EVENT_STATUSES = {"revoked", "rejected", "deleted", "superseded"}


def new_signoff_event(kind: str, user: dict, occurred_at: str, *, status: str = "valid") -> dict:
    """Create an immutable identity snapshot; never resolve historical names from live profiles."""
    return {
        "eventId": str(ObjectId()),
        "kind": kind,
        "status": status,
        "name": str(user.get("name") or "").strip(),
        "employeeId": str(user.get("employeeId") or "").strip(),
        "userId": str(user.get("id") or "").strip(),
        "signature": str(user.get("signature") or "").strip(),
        "occurredAt": occurred_at,
    }


def append_signoff_event(entry: dict, event: dict) -> list[dict]:
    return [*(entry.get("signoffHistory") or []), event]


def invalidate_approval_events(entry: dict, occurred_at: str, reason: str) -> list[dict]:
    """Append revocations instead of changing/removing earlier approval events."""
    history = list(entry.get("signoffHistory") or [])
    for event in reversed(history):
        if event.get("kind") == "approved" and event.get("status", "valid") == "valid":
            history.append({
                "eventId": str(ObjectId()),
                "kind": "approval_revoked",
                "status": "valid",
                "targetEventId": event.get("eventId"),
                "reason": reason,
                "occurredAt": occurred_at,
            })
            break
    return history


def _timestamp(value) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        except ValueError:
            parsed = datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _event_key(event: dict) -> tuple[datetime, str]:
    return (_timestamp(event.get("occurredAt")), str(event.get("eventId") or ""))


def _entry_in_scope(entry: dict, year: int, month: int, line_group: str) -> bool:
    date = str(entry.get("date") or "")[:10]
    return (
        date.startswith(f"{year:04d}-{month:02d}-")
        and entry.get("lineGroup", "Line-I") == line_group
        and not entry.get("deletedAt")
    )


def _events(entry: dict) -> Iterable[dict]:
    history = list(entry.get("signoffHistory") or [])
    revoked_ids = {
        event.get("targetEventId") for event in history
        if event.get("kind") == "approval_revoked" and event.get("status", "valid") == "valid"
    }
    for event in history:
        if event.get("status", "valid") in INVALID_EVENT_STATUSES:
            continue
        if event.get("eventId") in revoked_ids:
            continue
        yield event


def resolve_monthly_signoff(entries: Iterable[dict], year: int, month: int, line_group: str) -> dict:
    """Resolve latest valid check and approval using UTC timestamp then event/record id."""
    check_events: list[dict] = []
    approval_events: list[dict] = []
    for entry in entries:
        if not _entry_in_scope(entry, year, month, line_group):
            continue
        state = str(entry.get("workflowState") or entry.get("status") or "submitted").lower()
        entry_events = list(_events(entry))
        check_events.extend(event for event in entry_events if event.get("kind") == "checked" and state in VALID_CHECK_STATES)
        approval_events.extend(event for event in entry_events if event.get("kind") == "approved" and state == "approved")

        # Backward-compatible read path for records created before signoffHistory existed.
        if not any(event.get("kind") == "checked" for event in entry_events) and state in VALID_CHECK_STATES:
            name = str(entry.get("checkedBy") or (entry.get("signatures") or {}).get("preparedBy") or "").strip()
            if name:
                check_events.append({"eventId": str(entry.get("_id") or ""), "kind": "checked", "name": name,
                                     "signature": (entry.get("signatures") or {}).get("preparedBy", ""),
                                     "occurredAt": entry.get("submittedAt") or entry.get("updatedAt") or entry.get("updated_at")})
        if not any(event.get("kind") == "approved" for event in entry_events) and state == "approved":
            name = str(entry.get("approvedBy") or (entry.get("signatures") or {}).get("approvedBy") or "").strip()
            if name:
                approval_events.append({"eventId": str(entry.get("_id") or ""), "kind": "approved", "name": name,
                                        "signature": (entry.get("signatures") or {}).get("approvedBy", ""),
                                        "occurredAt": entry.get("approvedAt") or entry.get("updatedAt") or entry.get("updated_at")})

    checked = max(check_events, key=_event_key, default=None)
    approved = max(approval_events, key=_event_key, default=None)
    return {
        "preparedBy": checked.get("name", "") if checked else "",
        "preparedBySignature": checked.get("signature", "") if checked else "",
        "approvedBy": approved.get("name", "") if approved else "",
        "approvedBySignature": approved.get("signature", "") if approved else "",
        "checkedEventId": checked.get("eventId") if checked else None,
        "approvedEventId": approved.get("eventId") if approved else None,
    }
