from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from users.user_db import users_collection


WORKFLOW_STATES = {"draft", "submitted", "approved", "returned"}
EDITABLE_OPERATOR_STATES = {"draft", "returned"}
FINALIZED_EXPORT_STATES = {"submitted", "approved"}
DELETABLE_WORKFLOW_STATES = WORKFLOW_STATES - {"approved"}
APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE = "This report has been approved and is permanently retained. Approved reports cannot be deleted."
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
LOCK_FIELDS = ("lockedBy", "lockedByUserId", "lockedByEmployeeId", "lockTimestamp", "lockSessionId")
WORKFLOW_STATE_LABELS = {
    "draft": "Draft",
    "submitted": "Submitted",
    "approved": "Approved",
    "returned": "Returned",
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_current_user(employee_id: str | None) -> dict:
    if not employee_id or not employee_id.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User authorization is required")

    user = users_collection.find_one({"employeeId": employee_id.strip()})
    if not user or user.get("status") != "Active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active user authorization is required")

    return {
        "id": str(user["_id"]),
        "employeeId": user["employeeId"],
        "name": user["name"],
        "role": user["role"],
    }


def is_system_admin(user: dict) -> bool:
    return user.get("role") in SYSTEM_ADMIN_ROLES


def is_reviewer(user: dict) -> bool:
    return user.get("role") in REVIEWER_ROLES


def is_reviewer_like(user: dict) -> bool:
    return is_reviewer(user) or is_system_admin(user)


def is_operator(user: dict) -> bool:
    return user.get("role") == "Operator"


def normalize_workflow_state(entry: dict | None) -> str:
    if not entry:
        return "draft"
    state = entry.get("workflowState") or entry.get("status")
    return state if state in WORKFLOW_STATES else "submitted"


def is_entry_owner(entry: dict, user: dict) -> bool:
    return (
        entry.get("createdByEmployeeId") == user.get("employeeId")
        or entry.get("createdByUserId") == user.get("id")
        or (
            not entry.get("createdByEmployeeId")
            and entry.get("createdByEmployeeName") == user.get("name")
        )
        or (
            not entry.get("createdByEmployeeId")
            and not entry.get("createdByEmployeeName")
            and entry.get("createdBy") == user.get("name")
        )
    )


def can_view_entry(entry: dict, user: dict) -> bool:
    return is_operator(user) or is_reviewer_like(user)


def can_create_entry(user: dict) -> bool:
    return is_operator(user)


def can_edit_entry(entry: dict, user: dict) -> bool:
    state = normalize_workflow_state(entry)
    if is_operator(user):
        return is_entry_owner(entry, user) and state in EDITABLE_OPERATOR_STATES
    if is_reviewer_like(user):
        return state == "submitted"
    return False


def can_submit_entry(entry: dict, user: dict) -> bool:
    return is_operator(user) and is_entry_owner(entry, user) and normalize_workflow_state(entry) in EDITABLE_OPERATOR_STATES


def can_approve_entry(entry: dict, user: dict) -> bool:
    return is_reviewer_like(user) and normalize_workflow_state(entry) == "submitted"


def can_return_entry(entry: dict, user: dict) -> bool:
    return is_reviewer_like(user) and normalize_workflow_state(entry) == "submitted"


def can_delete_entry(entry: dict, user: dict) -> bool:
    state = normalize_workflow_state(entry)
    if state == "approved":
        return False
    if is_system_admin(user):
        return True
    if is_reviewer(user):
        return state == "submitted"
    if is_operator(user):
        return is_entry_owner(entry, user) and state in EDITABLE_OPERATOR_STATES
    return False


def can_export_entry(entry: dict, user: dict) -> bool:
    return can_view_entry(entry, user) and normalize_workflow_state(entry) in FINALIZED_EXPORT_STATES


def build_created_metadata(user: dict, now: str | None = None) -> dict[str, Any]:
    timestamp = now or utc_timestamp()
    return {
        "createdBy": user["name"],
        "createdByUserId": user["id"],
        "createdByEmployeeName": user["name"],
        "createdByEmployeeId": user["employeeId"],
        "createdAt": timestamp,
    }


def build_draft_lock_metadata(user: dict, now: str | None = None) -> dict[str, Any]:
    timestamp = now or utc_timestamp()
    return {
        "lockedBy": user["name"],
        "lockedByUserId": user["id"],
        "lockedByEmployeeId": user["employeeId"],
        "lockTimestamp": timestamp,
        "lockSessionId": None,
    }


def build_access_query(user: dict) -> dict:
    if is_operator(user) or is_reviewer_like(user):
        return {}
    return {"_id": {"$exists": False}}


def combine_queries(*queries: dict) -> dict:
    active_queries = [query for query in queries if query]
    if not active_queries:
        return {}
    if len(active_queries) == 1:
        return active_queries[0]
    return {"$and": active_queries}


def create_bulk_result(requested: int) -> dict:
    return {
        "requested": requested,
        "skipped": {},
        "failed": [],
    }


def add_bulk_skip(result: dict, reason: str) -> None:
    result["skipped"][reason] = result["skipped"].get(reason, 0) + 1


def add_bulk_failure(result: dict, entry_id: str, reason: str) -> None:
    result["failed"].append({"entryId": entry_id, "reason": reason})


def get_bulk_status_label(entry: dict) -> str:
    state = normalize_workflow_state(entry)
    if state == "approved":
        return "Already Approved"
    return WORKFLOW_STATE_LABELS.get(state, "Unavailable")
