from datetime import datetime, timedelta, timezone
import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status

from models.calibration_data_models import apply_calibration_autofill_to_audit_data
from models.ipqc_audit_models import (
    IPQCAudit,
    IPQC_TOTAL_STAGE_COUNT,
    build_ipqc_audit_metadata,
    calculate_ipqc_completion,
    ipqc_audit_collection,
    normalize_ipqc_audit_data,
)
from services.dashboard_analytics_service import (
    build_dashboard_response,
    ensure_missing_completion_metadata,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
)
from services.creator_resolution_service import (
    apply_approval_signature_to_signatures,
    build_lock_owner_metadata,
    get_created_by_label,
    is_creator_match,
    require_operator_signature,
)
from services.shift_entry_workflow_service import APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE
from users.user_db import users_collection


ipqc_audit_router = APIRouter(prefix="/api/ipqc-audits", tags=["IPQC Audits"])

WORKFLOW_STATES = {"draft", "submitted", "approved", "returned"}
EDITABLE_OPERATOR_STATES = {"draft", "returned"}
FINALIZED_EXPORT_STATES = {"submitted", "approved"}
DELETABLE_WORKFLOW_STATES = WORKFLOW_STATES - {"approved"}
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
LOCK_TIMEOUT_MINUTES = 15
LOCK_FIELDS = ("lockedBy", "lockedByUserId", "lockedByEmployeeId", "lockTimestamp", "lockSessionId")
WORKFLOW_STATE_LABELS = {
    "draft": "Draft",
    "submitted": "Submitted",
    "approved": "Approved",
    "returned": "Returned",
}

SORT_OPTIONS = {
    "newest-created": ("timestamp", -1),
    "oldest-created": ("timestamp", 1),
    "newest-updated": ("updated_timestamp", -1),
    "oldest-updated": ("updated_timestamp", 1),
    "recently-updated": ("updated_timestamp", -1),
    "least-recently-updated": ("updated_timestamp", 1),
    "name-asc": ("name", 1),
    "name-desc": ("name", -1),
    "completion-desc": ("completionPercentage", -1),
    "completion-asc": ("completionPercentage", 1),
    "status": ("workflowState", 1),
    "created-by": ("createdByEmployeeName", 1),
    "shift": ("shift", 1),
    "date-newest": ("date", -1),
    "date-oldest": ("date", 1),
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_workflow_state(audit: dict) -> str:
    state = audit.get("workflowState")
    if state in WORKFLOW_STATES:
        return state
    # Legacy audits predate workflow metadata. Treat them as submitted so historical exports remain available.
    return "submitted"


def get_ipqc_current_user(employee_id: str | None) -> dict:
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
        "signature": user.get("signature"),
    }


def is_system_admin(user: dict) -> bool:
    return user.get("role") in SYSTEM_ADMIN_ROLES


def is_reviewer(user: dict) -> bool:
    return user.get("role") in REVIEWER_ROLES


def is_operator(user: dict) -> bool:
    return user.get("role") == "Operator"


def is_audit_owner(audit: dict, user: dict) -> bool:
    return is_creator_match(audit, user, (load_ipqc_audit_data(audit),))


def can_view_audit(audit: dict, user: dict) -> bool:
    if is_system_admin(user):
        return True
    if is_operator(user):
        return True
    return is_reviewer(user)


def can_edit_audit(audit: dict, user: dict) -> bool:
    state = normalize_workflow_state(audit)
    if is_operator(user):
        return is_audit_owner(audit, user) and state in EDITABLE_OPERATOR_STATES
    if is_reviewer(user) or is_system_admin(user):
        return state == "submitted"
    return False


def can_delete_audit(audit: dict, user: dict) -> bool:
    state = normalize_workflow_state(audit)
    if state == "approved":
        return False
    if is_system_admin(user):
        return True
    if is_reviewer(user):
        return state == "submitted"
    if is_operator(user):
        return is_audit_owner(audit, user) and state in EDITABLE_OPERATOR_STATES
    return False


def parse_utc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_lock_active(audit: dict) -> bool:
    lock_timestamp = parse_utc_datetime(audit.get("lockTimestamp"))
    if not lock_timestamp:
        return False
    if lock_timestamp.tzinfo is None:
        lock_timestamp = lock_timestamp.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - lock_timestamp <= timedelta(minutes=LOCK_TIMEOUT_MINUTES)


def get_active_lock_info(audit: dict) -> dict | None:
    if not is_lock_active(audit):
        return None
    return {
        "lockedBy": audit.get("lockedBy"),
        "lockedByUserId": audit.get("lockedByUserId"),
        "lockedByEmployeeId": audit.get("lockedByEmployeeId"),
        "lockTimestamp": audit.get("lockTimestamp"),
        "lockSessionId": audit.get("lockSessionId"),
    }


def clear_expired_lock(audit: dict) -> None:
    if audit.get("lockTimestamp") and not is_lock_active(audit):
        ipqc_audit_collection.update_one(
            {"_id": audit["_id"]},
            {"$unset": {field: "" for field in LOCK_FIELDS}},
        )
        for field in LOCK_FIELDS:
            audit.pop(field, None)


def lock_belongs_to_user_session(audit: dict, user: dict, lock_session_id: str | None) -> bool:
    active_lock = get_active_lock_info(audit)
    if not active_lock:
        return True
    if active_lock.get("lockedByEmployeeId") == user.get("employeeId") and not lock_session_id:
        return True
    return (
        active_lock.get("lockedByEmployeeId") == user.get("employeeId")
        and active_lock.get("lockSessionId") == lock_session_id
    )


def require_edit_lock_if_operator(audit: dict, user: dict, lock_session_id: str | None) -> None:
    clear_expired_lock(audit)
    if not is_operator(user):
        return
    if not lock_belongs_to_user_session(audit, user, lock_session_id):
        lock_info = get_active_lock_info(audit) or {}
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"This audit is currently being completed by {lock_info.get('lockedBy') or 'another operator'}. Editing is locked until submission.",
        )


def require_ipqc_export_access(audit: dict, user: dict) -> None:
    state = normalize_workflow_state(audit)
    can_export = state in FINALIZED_EXPORT_STATES and (is_system_admin(user) or is_reviewer(user) or is_operator(user))
    if not can_export or not can_view_audit(audit, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to export this checksheet")


def create_bulk_result(requested: int) -> dict:
    return {
        "requested": requested,
        "skipped": {},
        "failed": [],
    }


def add_bulk_skip(result: dict, reason: str) -> None:
    result["skipped"][reason] = result["skipped"].get(reason, 0) + 1


def add_bulk_failure(result: dict, audit_id: str, reason: str) -> None:
    result["failed"].append({"auditId": audit_id, "reason": reason})


def get_bulk_status_label(audit: dict) -> str:
    state = normalize_workflow_state(audit)
    if state == "approved":
        return "Already Approved"
    return WORKFLOW_STATE_LABELS.get(state, "Unavailable")


def extract_audit_signature(data: dict) -> str:
    signatures = data.get("signatures") if isinstance(data.get("signatures"), dict) else {}
    signature = signatures.get("auditBy") or data.get("auditBy")
    if isinstance(signature, dict):
        signature = signature.get("name") or signature.get("text") or signature.get("value")
    return signature.strip() if isinstance(signature, str) else ""


def load_ipqc_audit_data(audit: dict, audit_payload: dict | None = None) -> dict:
    if isinstance(audit_payload, dict) and isinstance(audit_payload.get("data"), dict):
        return audit_payload["data"]
    if not audit or not audit.get("s3_key"):
        return {}
    try:
        return IPQCAudit.from_dict(audit).get_data()
    except Exception as exc:
        print(f"Warning: failed to load IPQC signature data for {audit.get('_id')}: {exc}")
        return {}


def apply_ipqc_approval_signature(audit: dict, user: dict) -> None:
    ipqc_audit = IPQCAudit.from_dict(audit)
    audit_data = ipqc_audit.get_data()
    if not isinstance(audit_data, dict):
        audit_data = {}
    apply_approval_signature_to_signatures(
        audit_data,
        user["name"],
        text_field="reviewedBy",
        image_field="reviewedByImage",
        signature_image=user.get("signature"),
    )
    if not ipqc_audit.save_data(audit_data):
        raise HTTPException(status_code=500, detail="Failed to save approval signature")


def ensure_completion_metadata(audit: dict, audit_data: dict | None = None) -> dict:
    if audit_data is not None:
        try:
            completion = calculate_ipqc_completion(audit_data if isinstance(audit_data, dict) else {})
            if any(audit.get(key) != value for key, value in completion.items()):
                ipqc_audit_collection.update_one(
                    {"_id": audit["_id"]},
                    {"$set": completion},
                )
                audit.update(completion)
            return completion
        except Exception as exc:
            print(f"Warning: failed to calculate completion for IPQC audit {audit.get('_id')}: {exc}")

    has_completion_metadata = all(
        key in audit
        for key in ("completedStages", "totalStages", "completionPercentage")
    )
    if has_completion_metadata:
        return {
            "completedStages": audit.get("completedStages", 0),
            "totalStages": audit.get("totalStages", IPQC_TOTAL_STAGE_COUNT),
            "completionPercentage": audit.get("completionPercentage", 0),
        }

    try:
        data = audit_data or IPQCAudit.from_dict(audit).get_data()
        completion = calculate_ipqc_completion(data if isinstance(data, dict) else {})
        ipqc_audit_collection.update_one(
            {"_id": audit["_id"]},
            {"$set": completion},
        )
        audit.update(completion)
        return completion
    except Exception as exc:
        print(f"Warning: failed to calculate completion for IPQC audit {audit.get('_id')}: {exc}")
        return {
            "completedStages": audit.get("completedStages", 0),
            "totalStages": audit.get("totalStages", IPQC_TOTAL_STAGE_COUNT),
            "completionPercentage": audit.get("completionPercentage", 0),
        }


def get_display_status(audit: dict, completion: dict | None = None) -> str:
    clear_expired_lock(audit)
    return normalize_workflow_state(audit)


def serialize_ipqc_audit(audit: dict, include_data: bool = False) -> dict:
    data = {}
    metadata = {}
    audit_payload = None
    if include_data:
        audit_payload = IPQCAudit.from_dict(audit).to_dict(include_data=True)
        data = audit_payload.get("data", {})
        data = apply_calibration_autofill_to_audit_data(data)
        metadata = build_ipqc_audit_metadata(data)
        completion = ensure_completion_metadata(audit, data)
    else:
        completion = ensure_completion_metadata(audit)

    state = normalize_workflow_state(audit)
    active_lock = get_active_lock_info(audit)
    creator_payload = load_ipqc_audit_data(audit, audit_payload)
    created_by_label = get_created_by_label(audit, (creator_payload,))
    return {
        "_id": str(audit["_id"]),
        "id": str(audit["_id"]),
        "name": audit["name"],
        "timestamp": audit["timestamp"],
        "updated_timestamp": audit.get("updated_timestamp", audit["timestamp"]),
        "s3_key": audit["s3_key"],
        "lineNumber": audit.get("lineNumber", metadata.get("lineNumber", "")),
        "date": audit.get("date", metadata.get("date", "")),
        "shift": audit.get("shift", metadata.get("shift", "")),
        "productionOrderNo": audit.get("productionOrderNo", metadata.get("productionOrderNo", "")),
        "moduleType": audit.get("moduleType", metadata.get("moduleType", "")),
        "status": state,
        "workflowState": state,
        "displayStatus": get_display_status(audit, completion),
        **completion,
        "createdBy": audit.get("createdBy") or created_by_label,
        "createdByUserId": audit.get("createdByUserId"),
        "createdByEmployeeName": audit.get("createdByEmployeeName") or created_by_label,
        "createdByEmployeeId": audit.get("createdByEmployeeId"),
        "submittedAt": audit.get("submittedAt"),
        "submittedBy": audit.get("submittedBy"),
        "approvedAt": audit.get("approvedAt"),
        "approvedBy": audit.get("approvedBy"),
        "returnedAt": audit.get("returnedAt"),
        "returnedBy": audit.get("returnedBy"),
        "returnComments": audit.get("returnComments"),
        "isSigned": audit.get("isSigned", state == "submitted"),
        "signedAt": audit.get("signedAt"),
        "lockedBy": active_lock.get("lockedBy") if active_lock else None,
        "lockedByUserId": active_lock.get("lockedByUserId") if active_lock else None,
        "lockedByEmployeeId": active_lock.get("lockedByEmployeeId") if active_lock else None,
        "lockTimestamp": active_lock.get("lockTimestamp") if active_lock else None,
        "lockSessionId": active_lock.get("lockSessionId") if active_lock else None,
        "isLocked": bool(active_lock),
        **({"data": data} if include_data else {}),
    }


def build_search_query(search: Optional[str]) -> dict:
    if not search:
        return {}

    escaped_search = re.escape(search.strip())
    if not escaped_search:
        return {}

    return {
        "$or": [
            {"name": {"$regex": escaped_search, "$options": "i"}},
            {"lineNumber": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"productionOrderNo": {"$regex": escaped_search, "$options": "i"}},
            {"moduleType": {"$regex": escaped_search, "$options": "i"}},
            {"status": {"$regex": escaped_search, "$options": "i"}},
            {"workflowState": {"$regex": escaped_search, "$options": "i"}},
            {"createdBy": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeName": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeId": {"$regex": escaped_search, "$options": "i"}},
        ]
    }


def build_access_query(user: dict) -> dict:
    if is_system_admin(user) or is_reviewer(user) or is_operator(user):
        return {}
    return {"_id": {"$exists": False}}


def combine_queries(*queries: dict) -> dict:
    active_queries = [query for query in queries if query]
    if not active_queries:
        return {}
    if len(active_queries) == 1:
        return active_queries[0]
    return {"$and": active_queries}


def build_field_filter_query(
    date_value: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    shift: Optional[str] = None,
    line_number: Optional[str] = None,
    production_order: Optional[str] = None,
    created_by: Optional[str] = None,
    workflow_state: Optional[str] = None,
    exclude_workflow_state: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> dict:
    filters: dict = {}
    if date_value:
        filters["date"] = date_value
    elif date_from or date_to:
        date_query: dict = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        filters["date"] = date_query

    if shift:
        filters["shift"] = shift
    if line_number:
        filters["lineNumber"] = line_number
    if production_order:
        filters["productionOrderNo"] = {"$regex": re.escape(production_order.strip()), "$options": "i"}
    if created_by:
        escaped_created_by = re.escape(created_by.strip())
        filters["$or"] = [
            {"createdBy": {"$regex": escaped_created_by, "$options": "i"}},
            {"createdByEmployeeName": {"$regex": escaped_created_by, "$options": "i"}},
            {"createdByEmployeeId": {"$regex": escaped_created_by, "$options": "i"}},
        ]
    if workflow_state in WORKFLOW_STATES:
        filters["workflowState"] = workflow_state
    if exclude_workflow_state in WORKFLOW_STATES:
        filters["workflowState"] = {"$ne": exclude_workflow_state}
    if status_filter in WORKFLOW_STATES:
        filters["workflowState"] = status_filter
    return filters


def completion_range_bounds(completion_range: Optional[str]) -> tuple[int, int] | None:
    ranges = {
        "0-25": (0, 25),
        "26-50": (26, 50),
        "51-75": (51, 75),
        "76-99": (76, 99),
        "100": (100, 100),
    }
    return ranges.get(completion_range or "")


def audit_matches_post_filters(
    audit: dict,
    status_filter: Optional[str] = None,
    completion_range: Optional[str] = None,
) -> bool:
    completion = ensure_completion_metadata(audit)
    bounds = completion_range_bounds(completion_range)
    if bounds:
        low, high = bounds
        percentage = completion.get("completionPercentage", 0)
        return low <= percentage <= high

    return True


def validate_audit_payload(audit_data: dict) -> None:
    required_fields = ["name", "timestamp", "data"]
    for field in required_fields:
        if field not in audit_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    if not isinstance(audit_data.get("data"), dict):
        raise HTTPException(status_code=400, detail="Audit data must be an object")


def validate_draft_required_metadata(data: dict) -> None:
    required_fields = {
        "lineNumber": "Line",
        "date": "Date",
        "shift": "Shift",
        "productionOrderNo": "Production Order Number",
        "moduleType": "Module Type",
    }
    missing_fields = [
        label
        for field, label in required_fields.items()
        if not str(data.get(field) or "").strip()
    ]
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required checksheet fields: {', '.join(missing_fields)}",
        )


def ensure_unique_audit_name(name: str, exclude_id: ObjectId | None = None) -> None:
    query = {"name": name}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    if ipqc_audit_collection.find_one(query):
        raise HTTPException(status_code=409, detail="An audit with this name already exists")


def find_matching_draft_audit(data: dict, user: dict) -> dict | None:
    line_number = str(data.get("lineNumber") or "").strip()
    audit_date = str(data.get("date") or "").strip()
    shift = str(data.get("shift") or "").strip()
    if not (line_number and audit_date and shift):
        return None

    query = combine_queries(
        {
            "$or": [
                {"createdByEmployeeId": user["employeeId"]},
                {"createdByUserId": user["id"]},
                {"createdBy": user["name"]},
            ]
        },
        {
            "workflowState": "draft",
            "lineNumber": line_number,
            "date": audit_date,
            "shift": shift,
        },
    )
    return ipqc_audit_collection.find_one(query, sort=[("updated_timestamp", -1), ("timestamp", -1)])


def build_metadata_update(audit_data: dict, existing_audit: dict | None, user: dict, workflow_state: str | None = None) -> tuple[dict, dict]:
    now = utc_timestamp()
    normalized_data = normalize_ipqc_audit_data(audit_data["data"])
    audit_metadata = build_ipqc_audit_metadata(normalized_data)
    state = workflow_state or (normalize_workflow_state(existing_audit) if existing_audit else "draft")
    normalized_data["workflowState"] = state
    normalized_data["status"] = state
    completion = calculate_ipqc_completion(normalized_data)
    prepared_signature = extract_audit_signature(normalized_data)
    previous_signed_at = existing_audit.get("signedAt") if existing_audit else None

    metadata = {
        "name": audit_data["name"],
        "timestamp": existing_audit["timestamp"] if existing_audit else audit_data["timestamp"],
        "updated_timestamp": audit_data.get("updated_timestamp", now),
        **audit_metadata,
        **completion,
        "status": state,
        "workflowState": state,
        "createdBy": existing_audit.get("createdBy") if existing_audit else user["name"],
        "createdByUserId": existing_audit.get("createdByUserId") if existing_audit else user["id"],
        "createdByEmployeeName": existing_audit.get("createdByEmployeeName") if existing_audit else user["name"],
        "createdByEmployeeId": existing_audit.get("createdByEmployeeId") if existing_audit else user["employeeId"],
        "isSigned": bool(prepared_signature) if state in FINALIZED_EXPORT_STATES else False,
        "signedAt": previous_signed_at or (now if prepared_signature and state in FINALIZED_EXPORT_STATES else None),
        "updatedAt": now,
    }
    return metadata, normalized_data


@ipqc_audit_router.get("/")
async def get_all_ipqc_audits(
    include_data: bool = Query(False, description="Include full audit data from S3"),
    summary: bool = Query(False, description="Return paginated summary data"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort: str = Query("newest-created"),
    workflow_state: Optional[str] = Query(None),
    exclude_workflow_state: Optional[str] = Query(None),
    date_value: Optional[str] = Query(None, alias="date"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    lineNumber: Optional[str] = Query(None),
    productionOrderNo: Optional[str] = Query(None),
    createdBy: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    completion_range: Optional[str] = Query(None),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        field_query = build_field_filter_query(
            date_value=date_value,
            date_from=date_from,
            date_to=date_to,
            shift=shift,
            line_number=lineNumber,
            production_order=productionOrderNo,
            created_by=createdBy,
            workflow_state=workflow_state,
            exclude_workflow_state=exclude_workflow_state,
            status_filter=status_filter,
        )
        query = combine_queries(build_access_query(user), build_search_query(search), field_query)
        sort_field, sort_direction = SORT_OPTIONS.get(sort, SORT_OPTIONS["newest-created"])
        requires_post_filter = bool(completion_range)

        if summary:
            if requires_post_filter:
                matching_audits = [
                    audit
                    for audit in ipqc_audit_collection.find(query).sort(sort_field, sort_direction)
                    if audit_matches_post_filters(audit, status_filter, completion_range)
                ]
                total = len(matching_audits)
                audits = matching_audits[(page - 1) * page_size:page * page_size]
            else:
                total = ipqc_audit_collection.count_documents(query)
                audits = list(
                    ipqc_audit_collection
                    .find(query)
                    .sort(sort_field, sort_direction)
                    .skip((page - 1) * page_size)
                    .limit(page_size)
                )
            return {
                "items": [serialize_ipqc_audit(audit, include_data=False) for audit in audits],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

        audits = [
            audit
            for audit in ipqc_audit_collection.find(query).sort(sort_field, sort_direction)
            if not requires_post_filter or audit_matches_post_filters(audit, status_filter, completion_range)
        ]
        return [
            serialize_ipqc_audit(
                audit,
                include_data=include_data and can_view_audit(audit, user),
            )
            for audit in audits
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audits: {str(e)}")


@ipqc_audit_router.get("/search/by-filters")
async def search_audits_by_filters(
    lineNumber: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    workflow_state: Optional[str] = Query(None),
    owner_only: bool = Query(False),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        filters = {}
        if lineNumber:
            filters["lineNumber"] = lineNumber
        if date:
            filters["date"] = date
        if shift:
            filters["shift"] = shift
        if workflow_state in WORKFLOW_STATES:
            filters["workflowState"] = workflow_state

        owner_query = {
            "$or": [
                {"createdByEmployeeId": user["employeeId"]},
                {"createdByUserId": user["id"]},
                {"createdBy": user["name"]},
            ]
        } if owner_only else {}
        query = combine_queries(build_access_query(user), owner_query, filters)
        audits = list(ipqc_audit_collection.find(query).sort([("updated_timestamp", -1), ("timestamp", -1)])) if filters else []
        return [
            serialize_ipqc_audit(audit, include_data=can_view_audit(audit, user))
            for audit in audits
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search audits: {str(e)}")


@ipqc_audit_router.get("/dashboard")
async def get_ipqc_audit_dashboard(
    view: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        date_from, date_to = resolve_analytics_dashboard_date_range(view)
        query = combine_queries(
            build_access_query(user),
            build_field_filter_query(date_from=date_from, date_to=date_to),
        )

        ensure_missing_completion_metadata(
            collection=ipqc_audit_collection,
            query=query,
            ensure_completion=ensure_completion_metadata,
        )

        def serialize_dashboard_audit(audit: dict) -> dict:
            clear_expired_lock(audit)
            ensure_completion_metadata(audit)
            return serialize_ipqc_audit(audit, include_data=False)

        return build_dashboard_response(
            collection=ipqc_audit_collection,
            query=query,
            view=view,
            total_key="totalAudits",
            include_completion=True,
            state_fields=("workflowState",),
            serialize_item=serialize_dashboard_audit,
            item_sort=[("date", -1), ("timestamp", -1)],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit dashboard: {str(e)}")


@ipqc_audit_router.get("/name/{audit_name}")
async def check_audit_name_exists(
    audit_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this audit ID from check"),
    excludeId: Optional[str] = Query(None, description="Legacy camelCase exclude ID"),
):
    try:
        query = {"name": audit_name}
        effective_exclude_id = exclude_id or excludeId
        if effective_exclude_id and ObjectId.is_valid(effective_exclude_id):
            query["_id"] = {"$ne": ObjectId(effective_exclude_id)}
        existing_audit = ipqc_audit_collection.find_one(query)
        return {"exists": existing_audit is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check audit name: {str(e)}")


@ipqc_audit_router.get("/{audit_id}")
async def get_ipqc_audit(audit_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not can_view_audit(audit, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this checksheet")

        return serialize_ipqc_audit(audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit: {str(e)}")


@ipqc_audit_router.post("/")
async def create_ipqc_audit(
    audit_data: dict,
    x_employee_id: str | None = Header(default=None),
    x_lock_session_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not is_operator(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create checksheets")

        validate_audit_payload(audit_data)
        audit_name = audit_data["name"].strip()
        metadata, normalized_data = build_metadata_update({**audit_data, "name": audit_name}, None, user, "draft")
        normalized_data = apply_calibration_autofill_to_audit_data(normalized_data)
        validate_draft_required_metadata(normalized_data)

        existing_draft = find_matching_draft_audit(normalized_data, user)
        if existing_draft:
            return serialize_ipqc_audit(existing_draft, include_data=True)

        ensure_unique_audit_name(audit_name)

        mongo_data = {
            "name": audit_name,
            "timestamp": audit_data["timestamp"],
            "updated_timestamp": metadata["updated_timestamp"],
            "s3_key": "",
            "lockedBy": user["name"],
            "lockedByUserId": user["id"],
            "lockedByEmployeeId": user["employeeId"],
            "lockTimestamp": utc_timestamp(),
            "lockSessionId": x_lock_session_id,
            **metadata,
        }
        result = ipqc_audit_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        ipqc_audit = IPQCAudit.create_from_data(
            name=audit_name,
            timestamp=audit_data["timestamp"],
            mongo_id=mongo_id,
            data=normalized_data,
        )
        ipqc_audit_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": ipqc_audit.s3_key}},
        )

        created_audit = ipqc_audit_collection.find_one({"_id": result.inserted_id})
        return serialize_ipqc_audit(created_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create audit: {str(e)}")


@ipqc_audit_router.put("/{audit_id}")
async def update_ipqc_audit(
    audit_id: str,
    audit_data: dict,
    x_employee_id: str | None = Header(default=None),
    x_lock_session_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not can_edit_audit(existing_audit, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to modify this checksheet")
        require_edit_lock_if_operator(existing_audit, user, x_lock_session_id)

        validate_audit_payload({**audit_data, "timestamp": audit_data.get("timestamp", existing_audit["timestamp"])})
        updated_name = (audit_data.get("name") or existing_audit["name"]).strip()
        ensure_unique_audit_name(updated_name, audit_object_id)

        existing_ipqc_audit = IPQCAudit.from_dict(existing_audit)
        existing_data = existing_ipqc_audit.get_data()
        merged_data = {**existing_data, **audit_data.get("data", {})}
        metadata, normalized_data = build_metadata_update(
            {
                **audit_data,
                "name": updated_name,
                "timestamp": existing_audit["timestamp"],
                "data": merged_data,
            },
            existing_audit,
            user,
        )

        ipqc_audit = IPQCAudit(
            _id=str(existing_audit["_id"]),
            name=updated_name,
            timestamp=existing_audit["timestamp"],
            s3_key=existing_audit["s3_key"],
        )
        if not ipqc_audit.save_data(data=normalized_data):
            raise HTTPException(status_code=500, detail="Failed to save audit data to S3")

        ipqc_audit_collection.update_one({"_id": audit_object_id}, {"$set": metadata})
        updated_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(updated_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/submit")
async def submit_ipqc_audit(
    audit_id: str,
    audit_data: dict | None = None,
    x_employee_id: str | None = Header(default=None),
    x_lock_session_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not (is_operator(user) and is_audit_owner(existing_audit, user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit this checksheet")
        if normalize_workflow_state(existing_audit) not in EDITABLE_OPERATOR_STATES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only draft or returned checksheets can be submitted")
        require_edit_lock_if_operator(existing_audit, user, x_lock_session_id)

        if audit_data:
            validate_audit_payload({**audit_data, "timestamp": audit_data.get("timestamp", existing_audit["timestamp"])})
            updated_name = (audit_data.get("name") or existing_audit["name"]).strip()
            ensure_unique_audit_name(updated_name, audit_object_id)
            existing_ipqc_audit = IPQCAudit.from_dict(existing_audit)
            existing_data = existing_ipqc_audit.get_data()
            merged_data = {**existing_data, **audit_data.get("data", {})}
            metadata, normalized_data = build_metadata_update(
                {
                    **audit_data,
                    "name": updated_name,
                    "timestamp": existing_audit["timestamp"],
                    "data": merged_data,
                },
                existing_audit,
                user,
                "submitted",
            )
            ipqc_audit = IPQCAudit(
                _id=str(existing_audit["_id"]),
                name=updated_name,
                timestamp=existing_audit["timestamp"],
                s3_key=existing_audit["s3_key"],
            )
            if not ipqc_audit.save_data(data=normalized_data):
                raise HTTPException(status_code=500, detail="Failed to save audit data to S3")
        else:
            ipqc_audit = IPQCAudit.from_dict(existing_audit)
            normalized_data = ipqc_audit.get_data()
            metadata, _ = build_metadata_update(
                {
                    "name": existing_audit["name"],
                    "timestamp": existing_audit["timestamp"],
                    "data": normalized_data,
                },
                existing_audit,
                user,
                "submitted",
            )

        require_operator_signature(normalized_data)

        now = utc_timestamp()
        update_data = {
            **metadata,
            "status": "submitted",
            "workflowState": "submitted",
            "isSigned": True,
            "signedAt": existing_audit.get("signedAt") or now,
            "submittedAt": now,
            "submittedBy": user["name"],
            "returnedAt": None,
            "returnedBy": None,
            "returnComments": None,
            "updated_timestamp": now,
            "updatedAt": now,
        }
        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {"$set": update_data, "$unset": {field: "" for field in LOCK_FIELDS}},
        )
        submitted_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(submitted_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/return")
async def return_ipqc_audit(audit_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can return checksheets")
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if normalize_workflow_state(existing_audit) != "submitted":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted checksheets can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        creator_payload = load_ipqc_audit_data(existing_audit)
        lock_owner = build_lock_owner_metadata(existing_audit, (creator_payload,))
        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {
                "$set": {
                    "status": "returned",
                    "workflowState": "returned",
                    "returnedAt": now,
                    "returnedBy": user["name"],
                    "returnComments": return_comments,
                    "lockedBy": lock_owner.get("lockedBy") or "Operator",
                    "lockedByUserId": lock_owner.get("lockedByUserId"),
                    "lockedByEmployeeId": lock_owner.get("lockedByEmployeeId"),
                    "lockTimestamp": now,
                    "lockSessionId": None,
                    "updated_timestamp": now,
                    "updatedAt": now,
                },
            },
        )
        returned_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(returned_audit, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return audit: {str(e)}")


@ipqc_audit_router.post("/bulk/approve")
async def bulk_approve_ipqc_audits(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can approve checksheets")

        audit_ids = request_data.get("auditIds") or request_data.get("audit_ids")
        if not isinstance(audit_ids, list) or not audit_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="auditIds must be a non-empty list")

        result = create_bulk_result(len(audit_ids))
        approved_count = 0
        now = utc_timestamp()

        for raw_audit_id in audit_ids:
            audit_id = str(raw_audit_id or "").strip()
            if not ObjectId.is_valid(audit_id):
                add_bulk_failure(result, audit_id, "Invalid ID")
                continue

            try:
                audit_object_id = ObjectId(audit_id)
                existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
                if not existing_audit:
                    add_bulk_failure(result, audit_id, "Not Found")
                    continue

                if normalize_workflow_state(existing_audit) != "submitted":
                    add_bulk_skip(result, get_bulk_status_label(existing_audit))
                    continue

                apply_ipqc_approval_signature(existing_audit, user)
                update_result = ipqc_audit_collection.update_one(
                    {"_id": audit_object_id},
                    {
                        "$set": {
                            "status": "approved",
                            "workflowState": "approved",
                            "approvedAt": now,
                            "approvedBy": user["name"],
                            "updated_timestamp": now,
                            "updatedAt": now,
                        },
                        "$unset": {field: "" for field in LOCK_FIELDS},
                    },
                )
                if update_result.matched_count != 1:
                    add_bulk_failure(result, audit_id, "Update Failed")
                    continue
                approved_count += 1
            except Exception as item_error:
                add_bulk_failure(result, audit_id, str(item_error))

        result["approved"] = approved_count
        result["processed"] = approved_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk approve audits: {str(e)}")


@ipqc_audit_router.post("/bulk/delete")
async def bulk_delete_ipqc_audits(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not (is_operator(user) or is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete checksheets")

        audit_ids = request_data.get("auditIds") or request_data.get("audit_ids")
        if not isinstance(audit_ids, list) or not audit_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="auditIds must be a non-empty list")

        result = create_bulk_result(len(audit_ids))
        deleted_count = 0

        for raw_audit_id in audit_ids:
            audit_id = str(raw_audit_id or "").strip()
            if not ObjectId.is_valid(audit_id):
                continue
            existing_audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
            if existing_audit and normalize_workflow_state(existing_audit) == "approved":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                )

        for raw_audit_id in audit_ids:
            audit_id = str(raw_audit_id or "").strip()
            if not ObjectId.is_valid(audit_id):
                add_bulk_failure(result, audit_id, "Invalid ID")
                continue

            try:
                audit_object_id = ObjectId(audit_id)
                existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
                if not existing_audit:
                    add_bulk_failure(result, audit_id, "Not Found")
                    continue

                workflow_state = normalize_workflow_state(existing_audit)
                if workflow_state == "approved":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                    )
                if workflow_state not in DELETABLE_WORKFLOW_STATES or not can_delete_audit(existing_audit, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_audit))
                    continue

                clear_expired_lock(existing_audit)
                if get_active_lock_info(existing_audit):
                    add_bulk_skip(result, "Locked")
                    continue

                ipqc_audit = IPQCAudit.from_dict(existing_audit)
                ipqc_audit.delete_data()
                delete_result = ipqc_audit_collection.delete_one({"_id": audit_object_id})
                if delete_result.deleted_count != 1:
                    add_bulk_failure(result, audit_id, "Delete Failed")
                    continue
                deleted_count += 1
            except Exception as item_error:
                add_bulk_failure(result, audit_id, str(item_error))

        result["deleted"] = deleted_count
        result["processed"] = deleted_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete audits: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/approve")
async def approve_ipqc_audit(audit_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can approve checksheets")
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if normalize_workflow_state(existing_audit) != "submitted":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted checksheets can be approved")

        now = utc_timestamp()
        apply_ipqc_approval_signature(existing_audit, user)
        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {
                "$set": {
                    "status": "approved",
                    "workflowState": "approved",
                    "approvedAt": now,
                    "approvedBy": user["name"],
                    "updated_timestamp": now,
                    "updatedAt": now,
                },
                "$unset": {field: "" for field in LOCK_FIELDS},
            },
        )
        approved_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(approved_audit, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/lock")
async def lock_ipqc_audit(audit_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        lock_session_id = str(request_data.get("lockSessionId") or "").strip()
        if not lock_session_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lock session ID is required")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not (is_operator(user) and is_audit_owner(existing_audit, user) and normalize_workflow_state(existing_audit) in EDITABLE_OPERATOR_STATES):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can lock this checksheet for editing")

        clear_expired_lock(existing_audit)
        active_lock = get_active_lock_info(existing_audit)
        if active_lock and active_lock.get("lockedByEmployeeId") != user["employeeId"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This audit is currently being completed by {active_lock.get('lockedBy') or 'another operator'}. Editing is locked until submission.",
            )

        now = utc_timestamp()
        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {
                "$set": {
                    "lockedBy": user["name"],
                    "lockedByUserId": user["id"],
                    "lockedByEmployeeId": user["employeeId"],
                    "lockTimestamp": now,
                    "lockSessionId": lock_session_id,
                    "updatedAt": now,
                }
            },
        )
        locked_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(locked_audit, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lock audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/unlock")
async def unlock_ipqc_audit(audit_id: str, request_data: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")

        clear_expired_lock(existing_audit)
        active_lock = get_active_lock_info(existing_audit)
        lock_session_id = str((request_data or {}).get("lockSessionId") or "").strip()
        can_unlock = (
            not active_lock
            or is_system_admin(user)
            or is_reviewer(user)
            or (
                is_operator(user)
                and active_lock.get("lockedByEmployeeId") == user["employeeId"]
                and (not lock_session_id or active_lock.get("lockSessionId") == lock_session_id)
            )
        )
        if not can_unlock:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to unlock this checksheet")

        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {"$unset": {field: "" for field in LOCK_FIELDS}},
        )
        unlocked_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(unlocked_audit, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unlock audit: {str(e)}")


@ipqc_audit_router.delete("/{audit_id}")
async def delete_ipqc_audit(audit_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        workflow_state = normalize_workflow_state(existing_audit)
        if workflow_state == "approved":
            # Approved audits are permanent records and must never reach the delete path.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )

        if workflow_state not in DELETABLE_WORKFLOW_STATES or not can_delete_audit(existing_audit, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this checksheet")

        ipqc_audit = IPQCAudit.from_dict(existing_audit)
        ipqc_audit.delete_data()
        result = ipqc_audit_collection.delete_one({"_id": audit_object_id})
        if result.deleted_count == 1:
            return {"message": "Audit deleted successfully from both MongoDB and S3"}
        raise HTTPException(status_code=500, detail="Failed to delete audit from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete audit: {str(e)}")
