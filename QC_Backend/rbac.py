from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from fastapi import Header, HTTPException

from users.user_db import users_collection


STATUS_DRAFT = "DRAFT"
STATUS_SUBMITTED = "SUBMITTED"
STATUS_RETURNED = "RETURNED"
STATUS_APPROVED = "APPROVED"
WORKFLOW_STATUSES = {STATUS_DRAFT, STATUS_SUBMITTED, STATUS_RETURNED, STATUS_APPROVED}
REVIEWER_ROLES = {"Supervisor", "Manager"}
OPERATOR_ROLE = "Operator"


class CurrentUser(dict):
    @property
    def employee_id(self) -> str:
        return self["employee_id"]

    @property
    def name(self) -> str:
        return self["name"]

    @property
    def role(self) -> str:
        return self["role"]


async def get_current_user(
    x_employee_id: Optional[str] = Header(default=None, alias="X-Employee-Id"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    x_user_name: Optional[str] = Header(default=None, alias="X-User-Name"),
) -> CurrentUser:
    if not x_employee_id:
        raise HTTPException(status_code=401, detail="Authenticated employee is required")

    employee_id = x_employee_id.strip()
    user = users_collection.find_one({"employeeId": employee_id})
    if not user or user.get("status") != "Active":
        raise HTTPException(status_code=401, detail="Active authenticated user is required")

    role = user.get("role")
    name = user.get("name")
    if x_user_role and x_user_role.strip() != role:
        raise HTTPException(status_code=403, detail="Authenticated role mismatch")
    if x_user_name and x_user_name.strip() != name:
        raise HTTPException(status_code=403, detail="Authenticated user mismatch")

    return CurrentUser({
        "employee_id": employee_id,
        "name": name,
        "role": role,
    })


def now_iso() -> str:
    return datetime.now().isoformat()


def normalize_status(record: Optional[Dict[str, Any]]) -> str:
    if not record:
        return STATUS_DRAFT
    status = str(record.get("status") or "").upper()
    if status in WORKFLOW_STATUSES:
        return status
    # Existing production records predate workflow metadata. Treat them as
    # submitted so reviewers can retain access without a destructive migration.
    return STATUS_SUBMITTED


def is_operator(user: CurrentUser) -> bool:
    return user.role == OPERATOR_ROLE


def is_reviewer(user: CurrentUser) -> bool:
    return user.role in REVIEWER_ROLES


def is_owner(record: Dict[str, Any], user: CurrentUser) -> bool:
    created_by = record.get("created_by")
    if created_by:
        return created_by == user.employee_id
    created_by_name = record.get("created_by_name") or record.get("createdBy")
    return bool(created_by_name and created_by_name == user.name)


def ensure_can_create(user: CurrentUser) -> None:
    if not is_operator(user):
        raise HTTPException(status_code=403, detail="Only Operators can create checksheets")


def ensure_can_view(record: Dict[str, Any], user: CurrentUser) -> None:
    if is_reviewer(user):
        return
    if is_operator(user) and is_owner(record, user):
        return
    raise HTTPException(status_code=403, detail="You are not allowed to view this checksheet")


def ensure_can_update(record: Dict[str, Any], user: CurrentUser) -> None:
    status = normalize_status(record)
    if is_operator(user) and is_owner(record, user) and status in {STATUS_DRAFT, STATUS_RETURNED}:
        return
    if is_reviewer(user) and status == STATUS_SUBMITTED:
        return
    raise HTTPException(status_code=403, detail="You are not allowed to edit this checksheet in its current status")


def ensure_can_delete(record: Dict[str, Any], user: CurrentUser) -> None:
    if is_reviewer(user) and normalize_status(record) == STATUS_SUBMITTED:
        return
    raise HTTPException(status_code=403, detail="Only Supervisors or Managers can delete submitted checksheets")


def ensure_can_submit(record: Dict[str, Any], user: CurrentUser) -> None:
    status = normalize_status(record)
    if is_operator(user) and is_owner(record, user) and status in {STATUS_DRAFT, STATUS_RETURNED}:
        return
    raise HTTPException(status_code=403, detail="Only the owning Operator can submit draft or returned checksheets")


def ensure_can_return(record: Dict[str, Any], user: CurrentUser) -> None:
    if is_reviewer(user) and normalize_status(record) == STATUS_SUBMITTED:
        return
    raise HTTPException(status_code=403, detail="Only Supervisors or Managers can return submitted checksheets")


def ensure_can_export(record: Dict[str, Any], user: CurrentUser) -> None:
    if normalize_status(record) != STATUS_SUBMITTED:
        raise HTTPException(status_code=403, detail="Excel export is allowed only after checksheet submission")
    ensure_can_view(record, user)


def visibility_filter(user: CurrentUser, base_filter: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    query = dict(base_filter or {})
    if is_operator(user):
        query["created_by"] = user.employee_id
    return query


def create_metadata(user: CurrentUser) -> Dict[str, Any]:
    timestamp = now_iso()
    return {
        "status": STATUS_DRAFT,
        "created_by": user.employee_id,
        "created_by_name": user.name,
        "created_at": timestamp,
        "updated_by": user.employee_id,
        "updated_by_name": user.name,
        "updated_at": timestamp,
    }


def update_metadata(user: CurrentUser) -> Dict[str, Any]:
    return {
        "updated_by": user.employee_id,
        "updated_by_name": user.name,
        "updated_at": now_iso(),
    }


def submit_metadata(user: CurrentUser) -> Dict[str, Any]:
    timestamp = now_iso()
    return {
        "status": STATUS_SUBMITTED,
        "submitted_by": user.employee_id,
        "submitted_by_name": user.name,
        "submitted_at": timestamp,
        "updated_by": user.employee_id,
        "updated_by_name": user.name,
        "updated_at": timestamp,
    }


def return_metadata(user: CurrentUser, comment: str) -> Dict[str, Any]:
    timestamp = now_iso()
    return {
        "status": STATUS_RETURNED,
        "returned_by": user.employee_id,
        "returned_by_name": user.name,
        "returned_at": timestamp,
        "return_comment": comment,
        "updated_by": user.employee_id,
        "updated_by_name": user.name,
        "updated_at": timestamp,
    }


def workflow_response_fields(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": normalize_status(record),
        "created_by": record.get("created_by"),
        "created_by_name": record.get("created_by_name"),
        "created_at": record.get("created_at", record.get("timestamp")),
        "updated_by": record.get("updated_by"),
        "updated_by_name": record.get("updated_by_name"),
        "updated_at": record.get("updated_at", record.get("updated_timestamp", record.get("timestamp"))),
        "submitted_by": record.get("submitted_by"),
        "submitted_by_name": record.get("submitted_by_name"),
        "submitted_at": record.get("submitted_at"),
        "returned_by": record.get("returned_by"),
        "returned_by_name": record.get("returned_by_name"),
        "returned_at": record.get("returned_at"),
        "return_comment": record.get("return_comment"),
    }


def append_workflow_fields(response: Dict[str, Any], record: Dict[str, Any]) -> Dict[str, Any]:
    response.update(workflow_response_fields(record))
    return response


def require_return_comment(payload: Dict[str, Any]) -> str:
    comment = str(payload.get("return_comment") or payload.get("comment") or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Return comment is required")
    return comment


def ensure_entries_exportable(entries: Iterable[Dict[str, Any]], user: CurrentUser) -> None:
    for entry in entries:
        ensure_can_export(entry, user)
