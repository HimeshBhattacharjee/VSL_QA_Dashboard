from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status

from models.peel_test_models import PeelTestReport, peel_test_collection
from services.dashboard_analytics_service import (
    build_dashboard_response,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
)
from services.creator_resolution_service import (
    apply_approval_signature_to_form_data,
    build_lock_owner_metadata,
    get_created_by_label,
    is_creator_match,
    require_operator_signature,
)
from services.shift_entry_workflow_service import APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE
from users.user_db import users_collection

logger = logging.getLogger(__name__)


peel_test_router = APIRouter(prefix="/api/peel/peel-test-reports", tags=["Peel Test Reports"])

WORKFLOW_STATES = {"draft", "submitted", "approved", "returned"}
EDITABLE_OPERATOR_STATES = {"draft", "returned"}
FINALIZED_EXPORT_STATES = {"submitted", "approved"}
DELETABLE_WORKFLOW_STATES = WORKFLOW_STATES - {"approved"}
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
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
    "newest-updated": ("updatedAt", -1),
    "oldest-updated": ("updatedAt", 1),
    "recently-updated": ("updatedAt", -1),
    "least-recently-updated": ("updatedAt", 1),
    "name-asc": ("name", 1),
    "name-desc": ("name", -1),
    "status": ("workflowState", 1),
    "created-by": ("createdByEmployeeName", 1),
    "shift": ("shift", 1),
    "date-newest": ("date", -1),
    "date-oldest": ("date", 1),
}
ALLOWED_SHIFTS = {"A", "B", "C"}
PEEL_LINES = {
    "FAB-II Line-I": range(1, 7),
    "FAB-II Line-II": range(7, 13),
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_workflow_state(report: dict) -> str:
    state = report.get("workflowState") or report.get("status")
    return state if state in WORKFLOW_STATES else "submitted"


def normalize_line(value: Any) -> str:
    raw = str(value or "").strip()
    if raw in PEEL_LINES:
        return raw

    compact = raw.lower().replace("_", " ").replace("-", " ")
    compact = " ".join(compact.split())
    if compact in {"fab ii line i", "line i", "line 1", "line one"}:
        return "FAB-II Line-I"
    if compact in {"fab ii line ii", "line ii", "line 2", "line two"}:
        return "FAB-II Line-II"
    return ""


def normalize_shift_value(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    compact = raw.upper().replace("SHIFT", "").replace("-", "").strip()
    return compact if compact in ALLOWED_SHIFTS else ""


def get_string_value(data: dict, key: str) -> str:
    value = data.get(key)
    return value.strip() if isinstance(value, str) else ""


def normalize_date_value(value: Any) -> str:
    raw = str(value or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    legacy_match = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", raw)
    if legacy_match:
        day, month, year = legacy_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.date().isoformat()
    except (TypeError, ValueError):
        return ""


def line_to_line_number(line: str) -> str:
    normalized = normalize_line(line)
    if normalized == "FAB-II Line-I":
        return "I"
    if normalized == "FAB-II Line-II":
        return "II"
    return ""


def first_populated_row_value(form_data: dict, cell_index: int) -> str:
    for row_index in get_row_indexes(form_data):
        value = get_string_value(form_data, f"row_{row_index}_cell_{cell_index}")
        if value:
            return value
    return ""


def get_peel_current_user(employee_id: str | None) -> dict:
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


def is_report_owner(report: dict, user: dict) -> bool:
    return is_creator_match(report, user, (load_peel_report_form_data(report),))


def can_view_report(report: dict, user: dict) -> bool:
    return is_system_admin(user) or is_reviewer(user) or is_operator(user)


def can_edit_report(report: dict, user: dict) -> bool:
    state = normalize_workflow_state(report)
    if is_operator(user):
        return is_report_owner(report, user) and state in EDITABLE_OPERATOR_STATES
    if is_reviewer(user) or is_system_admin(user):
        return state == "submitted"
    return False


def can_delete_report(report: dict, user: dict) -> bool:
    state = normalize_workflow_state(report)
    if state == "approved":
        return False
    if is_system_admin(user):
        return True
    if is_reviewer(user):
        return state == "submitted"
    if is_operator(user):
        return is_report_owner(report, user) and state in EDITABLE_OPERATOR_STATES
    return False


def require_peel_export_access(report: dict, user: dict) -> None:
    if normalize_workflow_state(report) not in FINALIZED_EXPORT_STATES or not can_view_report(report, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to export this report")


def extract_report_signature(form_data: dict) -> str:
    signature = form_data.get("preparedBySignature")
    return signature.strip() if isinstance(signature, str) else ""


def load_peel_report_form_data(report: dict, report_payload: dict | None = None) -> dict:
    if isinstance(report_payload, dict) and isinstance(report_payload.get("form_data"), dict):
        return report_payload["form_data"]
    if not report or not report.get("s3_key"):
        return {}
    try:
        return PeelTestReport.from_dict(report).get_data().get("form_data", {})
    except Exception as exc:
        logger.warning("peel_signature_data_load_failed report_id=%s error=%s", report.get("_id"), exc, exc_info=True)
        return {}


def apply_peel_approval_signature(report: dict, user: dict) -> None:
    peel_report = PeelTestReport.from_dict(report)
    report_data = peel_report.get_data()
    form_data = report_data.get("form_data", {})
    if not isinstance(form_data, dict):
        form_data = {}
    apply_approval_signature_to_form_data(form_data, user["name"])
    if not peel_report.save_data(
        form_data=form_data,
        row_data=report_data.get("row_data", []),
        averages=report_data.get("averages", {}),
    ):
        raise HTTPException(status_code=500, detail="Failed to save approval signature")


def infer_line_from_form_data(form_data: dict) -> str:
    selected_line = normalize_line(form_data.get("selectedLine"))
    if selected_line:
        return selected_line

    stringers = []
    for key, value in form_data.items():
        if not str(key).startswith("row_") or not str(key).endswith("_cell_2"):
            continue
        try:
            stringers.append(int(str(value).strip()))
        except (TypeError, ValueError):
            continue

    if stringers and all(stringer in PEEL_LINES["FAB-II Line-I"] for stringer in stringers):
        return "FAB-II Line-I"
    if stringers and all(stringer in PEEL_LINES["FAB-II Line-II"] for stringer in stringers):
        return "FAB-II Line-II"
    return ""


def get_report_line(report: dict, form_data: Optional[dict] = None) -> str:
    line = normalize_line(report.get("line"))
    if line:
        return line
    if form_data:
        inferred_line = infer_line_from_form_data(form_data)
        if inferred_line:
            return inferred_line

    report_name = str(report.get("name") or "")
    if "Line_II" in report_name or "Line-II" in report_name:
        return "FAB-II Line-II"
    if "Line_I" in report_name or "Line-I" in report_name:
        return "FAB-II Line-I"
    return ""


def get_row_indexes(form_data: dict) -> List[int]:
    indexes = set()
    for key in form_data:
        parts = str(key).split("_")
        if len(parts) >= 4 and parts[0] == "row" and parts[1].isdigit() and parts[2] == "cell":
            indexes.add(int(parts[1]))
    return sorted(indexes)


def extract_peel_report_metadata(form_data: dict, report: dict | None = None) -> dict:
    report = report or {}
    report_name = str(report.get("name") or "")
    line = get_report_line(report, form_data) or normalize_line(form_data.get("selectedLine"))
    date_value = (
        normalize_date_value(get_string_value(form_data, "selectedDate"))
        or normalize_date_value(first_populated_row_value(form_data, 0))
    )
    shift = normalize_shift_value(get_string_value(form_data, "selectedShift")) or normalize_shift_value(first_populated_row_value(form_data, 1))
    production_order = get_string_value(form_data, "productionOrderNo")
    if not production_order:
        for row_index in get_row_indexes(form_data):
            value = get_string_value(form_data, f"row_{row_index}_cell_4")
            if value and not is_unknown_value(value):
                production_order = value
                break

    if not date_value:
        match = re.search(r"Peel_Test_Report_(\d+)_([A-Za-z]+)_(\d+)_Shift_", report_name)
        if match:
            day, month_name, year = match.groups()
            try:
                date_value = datetime.strptime(f"{day} {month_name} {year}", "%d %b %Y").date().isoformat()
            except ValueError:
                date_value = ""

    if not shift:
        match = re.search(r"_Shift_([A-Za-z])", report_name)
        if match:
            shift = normalize_shift_value(match.group(1))

    return {
        "date": date_value,
        "shift": shift,
        "line": line,
        "lineNumber": line_to_line_number(line),
        "productionOrderNo": production_order,
    }


def ensure_peel_report_metadata(report: dict, report_payload: dict | None = None) -> dict:
    line = get_report_line(report)
    existing_metadata = {
        "date": report.get("date") or "",
        "shift": report.get("shift") or "",
        "line": line,
        "lineNumber": report.get("lineNumber") or line_to_line_number(line),
        "productionOrderNo": report.get("productionOrderNo") or "",
        "status": report.get("status") or normalize_workflow_state(report),
    }
    has_required_metadata = all(existing_metadata.get(key) for key in ("date", "shift", "lineNumber", "productionOrderNo"))
    if has_required_metadata and report.get("status"):
        return existing_metadata

    try:
        payload = report_payload
        if payload is None and report.get("s3_key"):
            payload = PeelTestReport.from_dict(report).get_data()
        form_data = payload.get("form_data", {}) if isinstance(payload, dict) else {}
        extracted_metadata = extract_peel_report_metadata(form_data, report)
        metadata = {
            **existing_metadata,
            **{key: value for key, value in extracted_metadata.items() if value},
            "status": normalize_workflow_state(report),
        }
        update_data = {
            key: value
            for key, value in metadata.items()
            if value and report.get(key) != value
        }
        if update_data and report.get("_id"):
            peel_test_collection.update_one({"_id": report["_id"]}, {"$set": update_data})
            report.update(update_data)
        return metadata
    except Exception as exc:
        logger.warning("peel_report_metadata_extract_failed report_id=%s error=%s", report.get("_id"), exc, exc_info=True)
        return existing_metadata


def backfill_missing_peel_metadata(limit: int = 200) -> None:
    missing_metadata_query = {
        "$or": [
            {"date": {"$exists": False}},
            {"shift": {"$exists": False}},
            {"lineNumber": {"$exists": False}},
            {"productionOrderNo": {"$exists": False}},
            {"status": {"$exists": False}},
        ]
    }
    try:
        reports = peel_test_collection.find(missing_metadata_query).sort("updatedAt", -1).limit(limit)
        for report in reports:
            ensure_peel_report_metadata(report)
    except Exception as exc:
        logger.warning("peel_report_metadata_backfill_failed error=%s", exc, exc_info=True)


def get_display_status(report: dict) -> str:
    return normalize_workflow_state(report)


def create_bulk_result(requested: int) -> dict:
    return {
        "requested": requested,
        "skipped": {},
        "failed": [],
    }


def add_bulk_skip(result: dict, reason: str) -> None:
    result["skipped"][reason] = result["skipped"].get(reason, 0) + 1


def add_bulk_failure(result: dict, report_id: str, reason: str) -> None:
    result["failed"].append({"reportId": report_id, "reason": reason})


def get_bulk_status_label(report: dict) -> str:
    state = normalize_workflow_state(report)
    if state == "approved":
        return "Already Approved"
    return WORKFLOW_STATE_LABELS.get(state, "Unavailable")


def is_unknown_value(value: Any) -> bool:
    raw = str(value or "").strip()
    return not raw or raw.upper() == "UNKNOWN"


def row_has_report_data(form_data: dict, row_index: int) -> bool:
    for cell_index in range(0, 230):
        value = str(form_data.get(f"row_{row_index}_cell_{cell_index}") or "").strip()
        if value:
            return True
    return False


def validate_line_and_shift(form_data: dict, line: str) -> None:
    if line not in PEEL_LINES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid Peel report line is required")

    selected_shift = normalize_shift_value(form_data.get("selectedShift"))
    if not selected_shift:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift must be one of Shift-A, Shift-B, or Shift-C")

    for key, value in form_data.items():
        if str(key).startswith("row_") and str(key).endswith("_cell_1") and str(value or "").strip():
            if not normalize_shift_value(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift must be one of Shift-A, Shift-B, or Shift-C")

    allowed_stringers = set(PEEL_LINES[line])
    for row_index in get_row_indexes(form_data):
        raw_stringer = str(form_data.get(f"row_{row_index}_cell_2") or "").strip()
        if not raw_stringer:
            continue
        try:
            stringer = int(raw_stringer)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stringer must be numeric")
        if stringer not in allowed_stringers:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{line} can contain only stringers {min(allowed_stringers)}-{max(allowed_stringers)}")


def validate_submission_requirements(form_data: dict) -> None:
    require_operator_signature(form_data)

    populated_rows = [row_index for row_index in get_row_indexes(form_data) if row_has_report_data(form_data, row_index)]
    if not populated_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one peel test row is required before submission")

    for row_index in populated_rows:
        po_value = form_data.get(f"row_{row_index}_cell_4")
        vendor_value = form_data.get(f"row_{row_index}_cell_5")
        if is_unknown_value(po_value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PO cannot be UNKNOWN before submission")
        if is_unknown_value(vendor_value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cell Vendor cannot be UNKNOWN before submission")


def serialize_peel_report(report: dict, include_data: bool = False) -> dict:
    peel_report = PeelTestReport.from_dict(report)
    report_data = peel_report.to_dict(include_data=include_data)
    metadata = ensure_peel_report_metadata(report, report_data if include_data else None)
    state = normalize_workflow_state(report)
    creator_payload = load_peel_report_form_data(report, report_data)
    created_by_label = get_created_by_label(report, (creator_payload,))
    serialized = {
        "_id": str(report["_id"]),
        "id": str(report["_id"]),
        "name": report["name"],
        "timestamp": report["timestamp"],
        "s3_key": report["s3_key"],
        "line": metadata.get("line", ""),
        "status": state,
        "workflowState": state,
        "displayStatus": get_display_status(report),
        "date": metadata.get("date", ""),
        "shift": metadata.get("shift", ""),
        "lineNumber": metadata.get("lineNumber", ""),
        "productionOrderNo": metadata.get("productionOrderNo", ""),
        "createdBy": report.get("createdBy") or created_by_label,
        "createdByUserId": report.get("createdByUserId"),
        "createdByEmployeeName": report.get("createdByEmployeeName") or created_by_label,
        "createdByEmployeeId": report.get("createdByEmployeeId"),
        "submittedAt": report.get("submittedAt"),
        "submittedBy": report.get("submittedBy"),
        "approvedAt": report.get("approvedAt"),
        "approvedBy": report.get("approvedBy"),
        "returnedAt": report.get("returnedAt"),
        "returnedBy": report.get("returnedBy"),
        "returnComments": report.get("returnComments"),
        "isSigned": report.get("isSigned", state in FINALIZED_EXPORT_STATES),
        "signedAt": report.get("signedAt"),
        "updatedAt": report.get("updatedAt"),
        "lockedBy": report.get("lockedBy"),
        "lockedByUserId": report.get("lockedByUserId"),
        "lockedByEmployeeId": report.get("lockedByEmployeeId"),
        "lockTimestamp": report.get("lockTimestamp"),
        "lockSessionId": report.get("lockSessionId"),
        "isLocked": bool(report.get("lockTimestamp")),
    }

    if include_data:
        serialized["formData"] = report_data.get("form_data", {})
        serialized["rowData"] = report_data.get("row_data", [])
        serialized["averages"] = report_data.get("averages", {})

    return serialized


def validate_report_payload(report_data: dict) -> None:
    required_fields = ["timestamp", "formData"]
    for field in required_fields:
        if field not in report_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required field: {field}")
    if not isinstance(report_data.get("formData"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="formData must be an object")
    if "rowData" in report_data and not isinstance(report_data.get("rowData"), list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rowData must be an array")
    if "averages" in report_data and not isinstance(report_data.get("averages"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="averages must be an object")

    line = normalize_line(report_data.get("line") or report_data.get("formData", {}).get("selectedLine"))
    validate_line_and_shift(report_data["formData"], line)


def build_metadata_update(
    report_data: dict,
    existing_report: dict | None = None,
    user: dict | None = None,
    workflow_state: str | None = None,
) -> dict:
    now = utc_timestamp()
    form_data = report_data.get("formData", {})
    previous_signed_at = existing_report.get("signedAt") if existing_report else None
    state = workflow_state or (normalize_workflow_state(existing_report or {}) if existing_report else "draft")
    prepared_signature = extract_report_signature(form_data)
    is_signed = bool(prepared_signature) if state in FINALIZED_EXPORT_STATES else False
    if state in FINALIZED_EXPORT_STATES and existing_report and not prepared_signature:
        is_signed = existing_report.get("isSigned", True)
    peel_metadata = extract_peel_report_metadata(form_data, existing_report or {"name": report_data.get("name")})

    return {
        "name": (report_data.get("name") or "").strip(),
        "timestamp": report_data.get("timestamp") or now,
        "status": state,
        "workflowState": state,
        **peel_metadata,
        "createdBy": existing_report.get("createdBy") if existing_report else (user or {}).get("name"),
        "createdByUserId": existing_report.get("createdByUserId") if existing_report else (user or {}).get("id"),
        "createdByEmployeeName": existing_report.get("createdByEmployeeName") if existing_report else (user or {}).get("name"),
        "createdByEmployeeId": existing_report.get("createdByEmployeeId") if existing_report else (user or {}).get("employeeId"),
        "isSigned": is_signed,
        "signedAt": previous_signed_at or (now if prepared_signature and state in FINALIZED_EXPORT_STATES else None),
        "updatedAt": now,
    }


def ensure_unique_report_name(name: str, exclude_id: ObjectId | None = None) -> None:
    query: Dict[str, Any] = {"name": name}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    if peel_test_collection.find_one(query):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A report with this name already exists")


def build_search_query(search: Optional[str]) -> dict:
    if not search:
        return {}

    escaped_search = re.escape(search.strip())
    if not escaped_search:
        return {}

    return {
        "$or": [
            {"line": {"$regex": escaped_search, "$options": "i"}},
            {"lineNumber": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"productionOrderNo": {"$regex": escaped_search, "$options": "i"}},
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

    normalized_shift = normalize_shift_value(shift)
    if normalized_shift:
        filters["shift"] = normalized_shift
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


@peel_test_router.get("/")
async def get_all_peel_test_reports(
    include_data: bool = Query(False, description="Include full report data from S3"),
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
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_peel_current_user(x_employee_id)
        backfill_missing_peel_metadata()
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

        if summary:
            total = peel_test_collection.count_documents(query)
            reports = list(
                peel_test_collection
                .find(query)
                .sort(sort_field, sort_direction)
                .skip((page - 1) * page_size)
                .limit(page_size)
            )
            return {
                "items": [serialize_peel_report(report, include_data=False) for report in reports],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

        reports = list(peel_test_collection.find(query).sort(sort_field, sort_direction))
        return [
            serialize_peel_report(
                report,
                include_data=include_data and can_view_report(report, user),
            )
            for report in reports
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")


@peel_test_router.get("/dashboard")
async def get_peel_test_dashboard(
    view: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_peel_current_user(x_employee_id)
        backfill_missing_peel_metadata()
        date_from, date_to = resolve_analytics_dashboard_date_range(view)
        query = combine_queries(
            build_access_query(user),
            build_field_filter_query(date_from=date_from, date_to=date_to),
        )

        def serialize_dashboard_report(report: dict) -> dict:
            ensure_peel_report_metadata(report)
            return serialize_peel_report(report, include_data=False)

        return build_dashboard_response(
            collection=peel_test_collection,
            query=query,
            view=view,
            total_key="totalReports",
            state_fields=("workflowState", "status"),
            serialize_item=serialize_dashboard_report,
            item_sort=[("date", -1), ("timestamp", -1)],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch peel dashboard: {str(e)}")


@peel_test_router.get("/name/{report_name}")
async def check_report_name_exists(
    report_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this report ID from check"),
    excludeId: Optional[str] = Query(None, description="Backward-compatible camelCase exclude ID"),
):
    try:
        resolved_exclude_id = exclude_id or excludeId
        query: Dict[str, Any] = {"name": report_name}
        if resolved_exclude_id and ObjectId.is_valid(resolved_exclude_id):
            query["_id"] = {"$ne": ObjectId(resolved_exclude_id)}
        existing_report = peel_test_collection.find_one(query)
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")


@peel_test_router.get("/{report_id}")
async def get_peel_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_view_report(report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this report")

        return serialize_peel_report(report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")


@peel_test_router.post("/")
async def create_peel_test_report(report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not is_operator(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create peel reports")

        validate_report_payload(report_data)
        now = utc_timestamp()
        line = normalize_line(report_data.get("line") or report_data["formData"].get("selectedLine"))
        draft_suffix = now[:19].replace(":", "-")
        report_name = (report_data.get("name") or f"Peel Draft - {line} - {user['name']} - {draft_suffix}").strip()
        ensure_unique_report_name(report_name)

        metadata = build_metadata_update({**report_data, "name": report_name}, None, user, "draft")
        mongo_data = {
            **metadata,
            "s3_key": "",
            "lockedBy": user["name"],
            "lockedByUserId": user["id"],
            "lockedByEmployeeId": user["employeeId"],
            "lockTimestamp": now,
            "lockSessionId": None,
        }
        result = peel_test_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        peel_report = PeelTestReport.create_from_data(
            name=report_name,
            timestamp=metadata["timestamp"],
            mongo_id=mongo_id,
            form_data=report_data["formData"],
            row_data=report_data.get("rowData", []),
            averages=report_data.get("averages", {}),
        )
        peel_test_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": peel_report.s3_key}},
        )

        created_report = peel_test_collection.find_one({"_id": result.inserted_id})
        return serialize_peel_report(created_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@peel_test_router.put("/{report_id}")
async def update_peel_test_report(report_id: str, report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_edit_report(existing_report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this report in its current workflow state")

        validate_report_payload(report_data)
        report_name = (report_data.get("name") or existing_report["name"]).strip()
        ensure_unique_report_name(report_name, report_object_id)

        peel_report = PeelTestReport(
            _id=str(existing_report["_id"]),
            name=report_name,
            timestamp=report_data["timestamp"],
            s3_key=existing_report["s3_key"],
        )
        success = peel_report.save_data(
            form_data=report_data["formData"],
            row_data=report_data.get("rowData", []),
            averages=report_data.get("averages", {}),
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save report data to S3")

        update_data = build_metadata_update({**report_data, "name": report_name}, existing_report, user)
        peel_test_collection.update_one({"_id": report_object_id}, {"$set": update_data})

        updated_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(updated_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")


@peel_test_router.post("/{report_id}/submit")
async def submit_peel_test_report(report_id: str, report_data: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not (is_operator(user) and is_report_owner(existing_report, user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit this report")
        if normalize_workflow_state(existing_report) not in EDITABLE_OPERATOR_STATES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only draft or returned reports can be submitted")

        if report_data:
            validate_report_payload(report_data)
            report_name = (report_data.get("name") or existing_report["name"]).strip()
            ensure_unique_report_name(report_name, report_object_id)
            form_data = report_data["formData"]
            validate_submission_requirements(form_data)
            peel_report = PeelTestReport(
                _id=str(existing_report["_id"]),
                name=report_name,
                timestamp=report_data["timestamp"],
                s3_key=existing_report["s3_key"],
            )
            success = peel_report.save_data(
                form_data=form_data,
                row_data=report_data.get("rowData", []),
                averages=report_data.get("averages", {}),
            )
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save report data to S3")
            metadata = build_metadata_update({**report_data, "name": report_name}, existing_report, user, "submitted")
        else:
            peel_report = PeelTestReport.from_dict(existing_report)
            loaded_data = peel_report.get_data()
            form_data = loaded_data.get("form_data", {})
            validate_line_and_shift(form_data, get_report_line(existing_report, form_data))
            validate_submission_requirements(form_data)
            metadata = build_metadata_update(
                {
                    "name": existing_report["name"],
                    "timestamp": existing_report["timestamp"],
                    "line": get_report_line(existing_report, form_data),
                    "formData": form_data,
                },
                existing_report,
                user,
                "submitted",
            )

        now = utc_timestamp()
        update_data = {
            **metadata,
            "status": "submitted",
            "workflowState": "submitted",
            "isSigned": True,
            "signedAt": existing_report.get("signedAt") or now,
            "submittedAt": now,
            "submittedBy": user["name"],
            "approvedAt": None,
            "approvedBy": None,
            "returnedAt": None,
            "returnedBy": None,
            "returnComments": None,
            "updatedAt": now,
        }
        peel_test_collection.update_one(
            {"_id": report_object_id},
            {"$set": update_data, "$unset": {field: "" for field in LOCK_FIELDS}},
        )

        submitted_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(submitted_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")


@peel_test_router.post("/{report_id}/return")
async def return_peel_test_report(report_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can return peel reports")
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if normalize_workflow_state(existing_report) != "submitted":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted reports can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        creator_payload = load_peel_report_form_data(existing_report)
        lock_owner = build_lock_owner_metadata(existing_report, (creator_payload,))
        peel_test_collection.update_one(
            {"_id": report_object_id},
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
                    "updatedAt": now,
                }
            },
        )

        returned_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(returned_report, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return report: {str(e)}")


@peel_test_router.post("/bulk/approve")
async def bulk_approve_peel_test_reports(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can approve reports")

        report_ids = request_data.get("reportIds") or request_data.get("report_ids")
        if not isinstance(report_ids, list) or not report_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reportIds must be a non-empty list")

        result = create_bulk_result(len(report_ids))
        approved_count = 0
        now = utc_timestamp()

        for raw_report_id in report_ids:
            report_id = str(raw_report_id or "").strip()
            if not ObjectId.is_valid(report_id):
                add_bulk_failure(result, report_id, "Invalid ID")
                continue

            try:
                report_object_id = ObjectId(report_id)
                existing_report = peel_test_collection.find_one({"_id": report_object_id})
                if not existing_report:
                    add_bulk_failure(result, report_id, "Not Found")
                    continue

                if normalize_workflow_state(existing_report) != "submitted":
                    add_bulk_skip(result, get_bulk_status_label(existing_report))
                    continue

                apply_peel_approval_signature(existing_report, user)
                update_result = peel_test_collection.update_one(
                    {"_id": report_object_id},
                    {
                        "$set": {
                            "status": "approved",
                            "workflowState": "approved",
                            "approvedAt": now,
                            "approvedBy": user["name"],
                            "updatedAt": now,
                        },
                        "$unset": {field: "" for field in LOCK_FIELDS},
                    },
                )
                if update_result.matched_count != 1:
                    add_bulk_failure(result, report_id, "Update Failed")
                    continue
                approved_count += 1
            except Exception as item_error:
                add_bulk_failure(result, report_id, str(item_error))

        result["approved"] = approved_count
        result["processed"] = approved_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk approve peel reports: {str(e)}")


@peel_test_router.post("/bulk/delete")
async def bulk_delete_peel_test_reports(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_operator(user) or is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete reports")

        report_ids = request_data.get("reportIds") or request_data.get("report_ids")
        if not isinstance(report_ids, list) or not report_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reportIds must be a non-empty list")

        result = create_bulk_result(len(report_ids))
        deleted_count = 0

        for raw_report_id in report_ids:
            report_id = str(raw_report_id or "").strip()
            if not ObjectId.is_valid(report_id):
                continue
            existing_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
            if existing_report and normalize_workflow_state(existing_report) == "approved":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                )

        for raw_report_id in report_ids:
            report_id = str(raw_report_id or "").strip()
            if not ObjectId.is_valid(report_id):
                add_bulk_failure(result, report_id, "Invalid ID")
                continue

            try:
                report_object_id = ObjectId(report_id)
                existing_report = peel_test_collection.find_one({"_id": report_object_id})
                if not existing_report:
                    add_bulk_failure(result, report_id, "Not Found")
                    continue

                workflow_state = normalize_workflow_state(existing_report)
                if workflow_state == "approved":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                    )
                if workflow_state not in DELETABLE_WORKFLOW_STATES or not can_delete_report(existing_report, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_report))
                    continue

                peel_report = PeelTestReport.from_dict(existing_report)
                peel_report.delete_data()
                delete_result = peel_test_collection.delete_one({"_id": report_object_id})
                if delete_result.deleted_count != 1:
                    add_bulk_failure(result, report_id, "Delete Failed")
                    continue
                deleted_count += 1
            except Exception as item_error:
                add_bulk_failure(result, report_id, str(item_error))

        result["deleted"] = deleted_count
        result["processed"] = deleted_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete peel reports: {str(e)}")


@peel_test_router.post("/{report_id}/approve")
async def approve_peel_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can approve reports")
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if normalize_workflow_state(existing_report) != "submitted":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted reports can be approved")

        now = utc_timestamp()
        apply_peel_approval_signature(existing_report, user)
        peel_test_collection.update_one(
            {"_id": report_object_id},
            {
                "$set": {
                    "status": "approved",
                    "workflowState": "approved",
                    "approvedAt": now,
                    "approvedBy": user["name"],
                    "updatedAt": now,
                },
                "$unset": {field: "" for field in LOCK_FIELDS},
            },
        )
        approved_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(approved_report, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve report: {str(e)}")


@peel_test_router.delete("/{report_id}")
async def delete_peel_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        existing_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        workflow_state = normalize_workflow_state(existing_report)
        if workflow_state == "approved":
            # Approved reports are permanent records and must never reach the delete path.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if workflow_state not in DELETABLE_WORKFLOW_STATES or not can_delete_report(existing_report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this report")

        peel_report = PeelTestReport.from_dict(existing_report)
        peel_report.delete_data()
        result = peel_test_collection.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully from both MongoDB and S3"}
        raise HTTPException(status_code=500, detail="Failed to delete report from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")
