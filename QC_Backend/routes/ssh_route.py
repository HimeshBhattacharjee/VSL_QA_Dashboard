import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from generators.SSHReportGenerator import generate_ssh_report
from models.ssh_test_models import SSHDailyEntry, ssh_entries_collection
from datetime import datetime
import calendar
from services.dashboard_analytics_service import (
    build_dashboard_response,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
)
from services.creator_resolution_service import (
    build_lock_owner_metadata,
    get_created_by_label as resolve_created_by_label,
    require_operator_signature,
)
from services.shift_entry_workflow_service import (
    APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
    EDITABLE_OPERATOR_STATES,
    LOCK_FIELDS,
    WORKFLOW_STATES,
    add_bulk_failure,
    add_bulk_skip,
    build_access_query,
    build_created_metadata,
    build_draft_lock_metadata,
    can_approve_entry,
    can_create_entry,
    can_delete_entry,
    can_edit_entry,
    can_export_entry,
    can_return_entry,
    can_submit_entry,
    can_view_entry,
    combine_queries,
    create_bulk_result,
    get_bulk_status_label,
    get_current_user,
    is_operator,
    is_reviewer_like,
    normalize_workflow_state,
    utc_timestamp,
)

ssh_router = APIRouter(prefix="/api/ssh-test-reports", tags=["SSH Test Reports"])

def _normalize_line_group(line_group):
    return 'Line-II' if line_group == 'Line-II' else 'Line-I'

def _signature_key(date, line_group, shift):
    return f"{date}_{_normalize_line_group(line_group)}_{shift}"

SSH_PASS_THRESHOLD = 39
SHIFT_OPTIONS = {"A", "B", "C"}
LINE_GROUP_OPTIONS = {"Line-I", "Line-II"}
SORT_OPTIONS = {
    "newest-created": ("createdAt", -1),
    "oldest-created": ("createdAt", 1),
    "newest-updated": ("updatedAt", -1),
    "oldest-updated": ("updatedAt", 1),
    "recently-updated": ("updatedAt", -1),
    "least-recently-updated": ("updatedAt", 1),
    "status": ("workflowState", 1),
    "created-by": ("createdByEmployeeName", 1),
    "shift": ("shift", 1),
    "line": ("lineGroup", 1),
    "date-newest": ("date", -1),
    "date-oldest": ("date", 1),
}
BUSINESS_ENTRY_FIELDS = {
    "date",
    "testingDate",
    "shift",
    "lineGroup",
    "checkedBy",
    "po",
    "lines",
    "signatures",
    "year",
    "month",
}
SHIFT_REQUIRED_FIELDS = [
    ("po", "PO Number"),
    ("checkedBy", "Checked By"),
]
LINE_REQUIRED_FIELDS = [
    ("sealantSupplier", "Sealant Supplier"),
    ("sealantExpDate", "Sealant Expiry Date"),
    ("sampleTakingTime", "Sample Taking Time"),
    ("sampleTestingTime", "Sample Testing Time"),
    ("result", "Result (Shore A)"),
]

def normalize_field_value(value):
    if value is None:
        return ""
    return str(value).strip()

def parse_result_value(value):
    normalized = normalize_field_value(value)
    if not normalized:
        return None
    try:
        return float(normalized)
    except (TypeError, ValueError):
        return None

def is_result_pass(value):
    normalized = normalize_field_value(value).lower()
    if normalized == "pass":
        return True
    parsed = parse_result_value(value)
    return parsed is not None and parsed >= SSH_PASS_THRESHOLD

def is_result_fail(value):
    normalized = normalize_field_value(value).lower()
    if normalized == "fail":
        return True
    parsed = parse_result_value(value)
    return parsed is not None and parsed < SSH_PASS_THRESHOLD

def get_line_required_details(line_data, line_num):
    return [
        {
            "label": f"Line {line_num} - {label}",
            "value": normalize_field_value(line_data.get(key, "")),
        }
        for key, label in LINE_REQUIRED_FIELDS
    ]

def get_entry_validation_message(entry):
    lines = entry.get("lines", {}) if isinstance(entry.get("lines"), dict) else {}
    line1 = lines.get("1", {}) if isinstance(lines.get("1"), dict) else {}
    line2 = lines.get("2", {}) if isinstance(lines.get("2"), dict) else {}
    has_po = normalize_field_value(entry.get("po")) != ""
    has_any_line_input = any(
        detail["value"] != ""
        for detail in [
            *get_line_required_details(line1, "1"),
            *get_line_required_details(line2, "2"),
        ]
    )
    if not has_po and not has_any_line_input:
        return "Please fill the entry details before saving."
    if not has_po and has_any_line_input:
        return "Please enter the PO number for this shift before saving."
    required_details = [
        *[
            {"label": label, "value": normalize_field_value(entry.get(key, ""))}
            for key, label in SHIFT_REQUIRED_FIELDS
        ],
        *get_line_required_details(line1, "1"),
        *get_line_required_details(line2, "2"),
    ]
    first_missing_detail = next((detail for detail in required_details if detail["value"] == ""), None)
    if first_missing_detail:
        return f"Please complete all entry fields before saving. Missing: {first_missing_detail['label']}."
    invalid_result = next(
        (
            detail
            for detail in [
                {"label": "Line 1 - Result (Shore A)", "value": line1.get("result")},
                {"label": "Line 2 - Result (Shore A)", "value": line2.get("result")},
            ]
            if normalize_field_value(detail["value"]) != "" and parse_result_value(detail["value"]) is None
        ),
        None,
    )
    if invalid_result:
        return f"Please enter a valid numeric value for {invalid_result['label']}."
    return None

def serialize_doc(doc):
    """Helper function to convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    doc_copy = doc.copy()
    if "_id" in doc_copy:
        doc_copy["_id"] = str(doc_copy["_id"])
    try:
        if "date" in doc_copy and doc_copy["date"] is not None:
            if isinstance(doc_copy["date"], datetime):
                doc_copy["date"] = doc_copy["date"].strftime("%Y-%m-%d")
            else:
                doc_copy["date"] = str(doc_copy["date"]).split('T')[0]
    except Exception:
        pass
    try:
        if "testingDate" in doc_copy and doc_copy["testingDate"] is not None:
            if isinstance(doc_copy["testingDate"], datetime):
                doc_copy["testingDate"] = doc_copy["testingDate"].strftime("%Y-%m-%d")
            else:
                doc_copy["testingDate"] = str(doc_copy["testingDate"]).split('T')[0]
    except Exception:
        pass
    return doc_copy

def serialize_docs(docs):
    """Helper function to convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

def build_monthly_stats(year: int, month: int):
    days_in_month = calendar.monthrange(year, month)[1]
    entries = SSHDailyEntry.get_month_entries(year, month)
    total_possible_entries = days_in_month * 3 * 2  # 3 shifts * 2 lines per day
    filled_entries = 0
    pass_count = 0
    fail_count = 0
    shift_stats = {
        "A": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
        "B": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
        "C": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}}
    }
    for entry in entries:
        shift = entry.get("shift")
        lines = entry.get("lines", {})

        if shift in shift_stats:
            line1 = lines.get("1", {})
            if line1.get("result"):
                filled_entries += 1
                shift_stats[shift]["filled"] += 1
                shift_stats[shift]["lines"]["1"] += 1
                if is_result_pass(line1["result"]):
                    pass_count += 1
                    shift_stats[shift]["pass"] += 1
                elif is_result_fail(line1["result"]):
                    fail_count += 1
                    shift_stats[shift]["fail"] += 1
            line2 = lines.get("2", {})
            if line2.get("result"):
                filled_entries += 1
                shift_stats[shift]["filled"] += 1
                shift_stats[shift]["lines"]["2"] += 1

                if is_result_pass(line2["result"]):
                    pass_count += 1
                    shift_stats[shift]["pass"] += 1
                elif is_result_fail(line2["result"]):
                    fail_count += 1
                    shift_stats[shift]["fail"] += 1
    completion_rate = round((filled_entries / total_possible_entries) * 100) if total_possible_entries > 0 else 0
    return {
        "totalDays": days_in_month,
        "totalPossibleEntries": total_possible_entries,
        "filledEntries": filled_entries,
        "completionRate": completion_rate,
        "passCount": pass_count,
        "failCount": fail_count,
        "shiftStats": shift_stats
    }

def build_default_monthly_stats(year: int, month: int):
    days_in_month = calendar.monthrange(year, month)[1]
    total_possible_entries = days_in_month * 3 * 2
    return {
        "totalDays": days_in_month,
        "totalPossibleEntries": total_possible_entries,
        "filledEntries": 0,
        "completionRate": 0,
        "passCount": 0,
        "failCount": 0,
        "shiftStats": {
            "A": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
            "B": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
            "C": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}}
        }
    }


def _normalize_lines(lines: dict) -> dict:
    normalized_lines = {}
    for line_num in ("1", "2"):
        line = (lines or {}).get(line_num) or {}
        normalized_lines[line_num] = {
            **line,
            "line": line_num,
            "sealantSupplier": normalize_field_value(line.get("sealantSupplier")),
            "sealantExpDate": normalize_field_value(line.get("sealantExpDate")),
            "sampleTakingTime": normalize_field_value(line.get("sampleTakingTime")),
            "sampleTestingTime": normalize_field_value(line.get("sampleTestingTime")),
            "result": normalize_field_value(line.get("result")),
            "remarks": normalize_field_value(line.get("remarks")),
        }
    return normalized_lines


def get_entry_validation_message(entry, *, allow_blank_lines: bool = False):
    lines = entry.get("lines", {}) if isinstance(entry.get("lines"), dict) else {}
    line1 = lines.get("1", {}) if isinstance(lines.get("1"), dict) else {}
    line2 = lines.get("2", {}) if isinstance(lines.get("2"), dict) else {}
    has_po = normalize_field_value(entry.get("po")) != ""
    has_any_line_input = any(
        detail["value"] != ""
        for detail in [
            *get_line_required_details(line1, "1"),
            *get_line_required_details(line2, "2"),
        ]
    )
    if allow_blank_lines and not has_po and not has_any_line_input:
        return None
    if not has_po and not has_any_line_input:
        return "Please fill the entry details before saving."
    if not has_po and has_any_line_input:
        return "Please enter the PO number for this shift before saving."

    required_details = [
        *[
            {"label": label, "value": normalize_field_value(entry.get(key, ""))}
            for key, label in SHIFT_REQUIRED_FIELDS
        ],
        *get_line_required_details(line1, "1"),
        *get_line_required_details(line2, "2"),
    ]
    first_missing_detail = next((detail for detail in required_details if detail["value"] == ""), None)
    if first_missing_detail:
        return f"Please complete all entry fields before saving. Missing: {first_missing_detail['label']}."

    invalid_result = next(
        (
            detail
            for detail in [
                {"label": "Line 1 - Result (Shore A)", "value": line1.get("result")},
                {"label": "Line 2 - Result (Shore A)", "value": line2.get("result")},
            ]
            if normalize_field_value(detail["value"]) != "" and parse_result_value(detail["value"]) is None
        ),
        None,
    )
    if invalid_result:
        return f"Please enter a valid numeric value for {invalid_result['label']}."
    return None


def serialize_doc(doc):
    if doc is None:
        return None
    doc_copy = doc.copy()
    if "_id" in doc_copy:
        doc_copy["_id"] = str(doc_copy["_id"])
    for date_field in ("date", "testingDate"):
        if date_field in doc_copy and doc_copy[date_field] is not None:
            if isinstance(doc_copy[date_field], datetime):
                doc_copy[date_field] = doc_copy[date_field].strftime("%Y-%m-%d")
            else:
                doc_copy[date_field] = str(doc_copy[date_field]).split("T")[0]

    doc_copy["lineGroup"] = _normalize_line_group(doc_copy.get("lineGroup"))
    doc_copy["checkedBy"] = normalize_field_value(doc_copy.get("checkedBy"))
    doc_copy["po"] = normalize_field_value(doc_copy.get("po"))
    doc_copy.setdefault("signatures", {"preparedBy": "", "approvedBy": ""})
    state = normalize_workflow_state(doc_copy)
    doc_copy["status"] = state
    doc_copy["workflowState"] = state
    doc_copy["displayStatus"] = state
    doc_copy["createdAt"] = doc_copy.get("createdAt") or doc_copy.get("created_at")
    doc_copy["updatedAt"] = doc_copy.get("updatedAt") or doc_copy.get("updated_at")
    created_by_label = resolve_created_by_label(doc_copy)
    doc_copy["createdBy"] = doc_copy.get("createdBy") or created_by_label
    doc_copy["createdByEmployeeName"] = doc_copy.get("createdByEmployeeName") or created_by_label
    doc_copy["isLocked"] = bool(doc_copy.get("lockTimestamp"))
    doc_copy["lines"] = _normalize_lines(doc_copy.get("lines") or {})
    doc_copy["productionOrder"] = doc_copy["po"]
    return doc_copy


def serialize_docs(docs):
    return [serialize_doc(doc) for doc in docs]


def serialize_entry(doc, user: dict | None = None, include_permissions: bool = False):
    serialized = serialize_doc(doc)
    if serialized and user and include_permissions:
        serialized["permissions"] = {
            "canView": can_view_entry(doc, user),
            "canEdit": can_edit_entry(doc, user),
            "canSubmit": can_submit_entry(doc, user),
            "canApprove": can_approve_entry(doc, user),
            "canReturn": can_return_entry(doc, user),
            "canDelete": can_delete_entry(doc, user),
            "canExport": can_export_entry(doc, user),
        }
    return serialized


def get_optional_user(employee_id: str | None) -> dict | None:
    if not employee_id:
        return None
    return get_current_user(employee_id)


def normalize_entry_payload(entry: dict, *, allow_blank_lines: bool = False) -> dict:
    required_fields = ["date", "testingDate", "shift", "lines"]
    for field in required_fields:
        if field not in entry or not entry[field]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    if entry["shift"] not in SHIFT_OPTIONS:
        raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
    line_group = _normalize_line_group(entry.get("lineGroup"))
    if line_group not in LINE_GROUP_OPTIONS:
        raise HTTPException(status_code=400, detail="Line must be Line-I or Line-II")
    if not isinstance(entry["lines"], dict) or "1" not in entry["lines"] or "2" not in entry["lines"]:
        raise HTTPException(status_code=400, detail="Both lines 1 and 2 must be provided")

    validation_message = get_entry_validation_message(entry, allow_blank_lines=allow_blank_lines)
    if validation_message:
        raise HTTPException(status_code=400, detail=validation_message)

    date_key = str(entry.get("date")).split("T")[0]
    try:
        date_obj = datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    return {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "shift": entry["shift"],
        "lineGroup": line_group,
        "checkedBy": normalize_field_value(entry.get("checkedBy")),
        "po": normalize_field_value(entry.get("po")),
        "lines": _normalize_lines(entry.get("lines") or {}),
        "signatures": entry.get("signatures") or {"preparedBy": "", "approvedBy": ""},
        "year": date_obj.year,
        "month": date_obj.month,
    }


def build_entry_update_data(
    normalized_entry: dict,
    *,
    existing_entry: dict | None,
    user: dict,
    workflow_state: str,
) -> dict:
    now = utc_timestamp()
    update_data = {
        field: normalized_entry[field]
        for field in BUSINESS_ENTRY_FIELDS
        if field in normalized_entry
    }
    signatures = update_data.get("signatures") or {}
    if existing_entry and not signatures:
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "approvedBy": ""}

    update_data.update({
        "signatures": signatures,
        "status": workflow_state,
        "workflowState": workflow_state,
        "updatedAt": now,
        "updated_at": now,
    })
    if existing_entry:
        update_data.update({
            "createdBy": existing_entry.get("createdBy", existing_entry.get("createdByEmployeeName")),
            "createdByUserId": existing_entry.get("createdByUserId"),
            "createdByEmployeeName": existing_entry.get("createdByEmployeeName"),
            "createdByEmployeeId": existing_entry.get("createdByEmployeeId"),
            "createdAt": existing_entry.get("createdAt") or existing_entry.get("created_at"),
            "created_at": existing_entry.get("created_at") or existing_entry.get("createdAt"),
        })
    else:
        update_data.update(build_created_metadata(user, now))
        update_data.update(build_draft_lock_metadata(user, now))
        update_data["created_at"] = now
    return update_data


def build_search_query(search: Optional[str]) -> dict:
    if not search:
        return {}
    escaped_search = re.escape(search.strip())
    if not escaped_search:
        return {}
    status_terms = []
    if "submitted".startswith(escaped_search.lower()) or escaped_search.lower() == "submitted":
        status_terms.extend([
            {"workflowState": {"$exists": False}},
            {"workflowState": None},
            {"status": {"$exists": False}},
        ])
    return {
        "$or": [
            {"po": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"lineGroup": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
            {"checkedBy": {"$regex": escaped_search, "$options": "i"}},
            {"createdBy": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeName": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeId": {"$regex": escaped_search, "$options": "i"}},
            {"status": {"$regex": escaped_search, "$options": "i"}},
            {"workflowState": {"$regex": escaped_search, "$options": "i"}},
            *status_terms,
        ]
    }


def build_status_query(status_filter: Optional[str]) -> dict:
    if status_filter not in WORKFLOW_STATES:
        return {}
    if status_filter == "submitted":
        return {
            "$or": [
                {"workflowState": "submitted"},
                {"workflowState": {"$exists": False}},
                {"workflowState": None},
                {"status": "submitted"},
            ]
        }
    return {"workflowState": status_filter}


def build_entry_filter_query(
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    shift: Optional[str] = None,
    line: Optional[str] = None,
) -> dict:
    filters: dict = {}
    if date_from or date_to:
        date_query: dict = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        filters["date"] = date_query
    if shift:
        filters["shift"] = shift
    if line:
        filters["lineGroup"] = _normalize_line_group(line)
    return filters


def serialize_entry_summary(entry: dict, user: dict | None = None) -> dict:
    serialized = serialize_entry(entry, user, include_permissions=bool(user))
    if not serialized:
        return {}
    serialized["createdByLabel"] = resolve_created_by_label(entry)
    return serialized


@ssh_router.get("/dashboard")
async def get_ssh_dashboard(
    view: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_current_user(x_employee_id)
        date_from, date_to = resolve_analytics_dashboard_date_range(view)
        query = combine_queries(
            build_access_query(user),
            build_entry_filter_query(date_from=date_from, date_to=date_to),
        )
        return build_dashboard_response(
            collection=ssh_entries_collection,
            query=query,
            view=view,
            total_key="totalEntries",
            state_fields=("workflowState", "status"),
            serialize_item=lambda entry: serialize_entry_summary(entry, user),
            item_sort=[("date", -1), ("shift", 1), ("lineGroup", 1)],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SSH dashboard: {str(e)}")


@ssh_router.get("/entries/register")
async def get_entry_register(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort: str = Query("date-newest"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    line: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_current_user(x_employee_id)
        query = combine_queries(
            build_access_query(user),
            build_search_query(search),
            build_entry_filter_query(date_from=date_from, date_to=date_to, shift=shift, line=line),
            build_status_query(status_filter),
        )
        sort_field, sort_direction = SORT_OPTIONS.get(sort, SORT_OPTIONS["date-newest"])
        total = ssh_entries_collection.count_documents(query)
        entries = list(
            ssh_entries_collection
            .find(query)
            .sort(sort_field, sort_direction)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        return {
            "items": [serialize_entry_summary(entry, user) for entry in entries],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry register: {str(e)}")


@ssh_router.get("/entries/by-id/{entry_id}")
async def get_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        entry = SSHDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_view_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this entry")
        return serialize_entry(entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@ssh_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    x_employee_id: str | None = Header(default=None),
):
    """Get all entries for a specific month - always returns 200 with empty array if no data"""
    try:
        user = get_optional_user(x_employee_id)
        entries = SSHDailyEntry.get_month_entries(year, month)
        
        # Group entries by date for easier frontend consumption
        entries_by_date = {}
        date_signatures = {}
        for entry in entries:
            serialized = serialize_entry(entry, user, include_permissions=bool(user))
            date = serialized.get("date")
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("approvedBy"):
                date_signatures[_signature_key(date, serialized.get("lineGroup"), serialized.get("shift"))] = signatures
        
        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
            "grouped": entries_by_date,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        # Return empty data on error instead of throwing 500
        return {
            "success": False,
            "data": [],
            "grouped": {},
            "date_signatures": {},
            "error": str(e)
        }

@ssh_router.get("/entries/{date}")
async def get_entries_for_date(date: str, x_employee_id: str | None = Header(default=None)):
    """Get all shift entries for a specific date"""
    try:
        user = get_optional_user(x_employee_id)
        date_key = date.split('T')[0]
        entries = SSHDailyEntry.get_all_for_date(date_key)
        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")

@ssh_router.get("/entries/{date}/{line_group}/{shift}")
async def get_entry_by_line_group(date: str, line_group: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date, line group, and shift."""
    try:
        user = get_optional_user(x_employee_id)
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = date.split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@ssh_router.get("/entries/{date}/{shift}")
async def get_entry(date: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date and shift"""
    try:
        user = get_optional_user(x_employee_id)
        # Validate shift
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = date.split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@ssh_router.get("/stats/monthly")
async def get_monthly_stats(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get statistics for a specific month - counting lines not shifts"""
    try:
        return {
            "success": True,
            "data": build_monthly_stats(year, month)
        }
    except Exception as e:
        # Return default stats on error
        return {
            "success": False,
            "data": build_default_monthly_stats(year, month) if 1 <= month <= 12 else {},
            "error": str(e)
        }

@ssh_router.post("/entries")
async def create_entry(entry: dict, x_employee_id: str | None = Header(default=None)):
    """Create or update a daily entry for a specific shift with two lines"""
    try:
        user = get_current_user(x_employee_id)
        normalized_entry = normalize_entry_payload(entry)
        existing_entry = SSHDailyEntry.get_by_date_and_shift(
            normalized_entry["date"],
            normalized_entry["shift"],
            normalized_entry["lineGroup"],
        )

        if existing_entry:
            if not can_edit_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this entry in its current workflow state")
            workflow_state = normalize_workflow_state(existing_entry)
        else:
            if not can_create_entry(user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entries")
            workflow_state = "draft"

        if existing_entry and not normalized_entry.get("signatures", {}).get("preparedBy"):
            normalized_entry["signatures"] = existing_entry.get("signatures") or {"preparedBy": "", "approvedBy": ""}

        update_data = build_entry_update_data(
            normalized_entry,
            existing_entry=existing_entry,
            user=user,
            workflow_state=workflow_state,
        )
        if existing_entry and normalize_workflow_state(existing_entry) in EDITABLE_OPERATOR_STATES:
            update_data.update({
                "lockedBy": existing_entry.get("lockedBy") or user["name"],
                "lockedByUserId": existing_entry.get("lockedByUserId") or user["id"],
                "lockedByEmployeeId": existing_entry.get("lockedByEmployeeId") or user["employeeId"],
                "lockTimestamp": existing_entry.get("lockTimestamp") or utc_timestamp(),
                "lockSessionId": existing_entry.get("lockSessionId"),
            })

        SSHDailyEntry.create(update_data)
        saved_entry = SSHDailyEntry.get_by_date_and_shift(
            normalized_entry["date"],
            normalized_entry["shift"],
            normalized_entry["lineGroup"],
        )
        stats = build_monthly_stats(normalized_entry["year"], normalized_entry["month"])
        
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_entry(saved_entry, user, include_permissions=True),
                "stats": stats
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")


@ssh_router.post("/entries/{entry_id}/submit")
async def submit_entry(entry_id: str, entry: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = SSHDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_submit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit draft or returned entries")

        normalized_entry = normalize_entry_payload(entry or existing_entry)
        signatures = normalized_entry.get("signatures") or existing_entry.get("signatures") or {"preparedBy": "", "approvedBy": ""}
        require_operator_signature({"signatures": signatures})
        normalized_entry["signatures"] = signatures

        now = utc_timestamp()
        update_data = build_entry_update_data(
            normalized_entry,
            existing_entry=existing_entry,
            user=user,
            workflow_state="submitted",
        )
        update_data.update({
            "submittedAt": now,
            "submittedBy": user["name"],
            "approvedAt": None,
            "approvedBy": None,
            "returnedAt": None,
            "returnedBy": None,
            "returnComments": None,
            "isSigned": True,
            "signedAt": existing_entry.get("signedAt") or now,
        })

        updated = SSHDailyEntry.update_by_id(entry_id, update_data, {field: "" for field in LOCK_FIELDS})
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to submit entry")

        submitted_entry = SSHDailyEntry.get_by_id(entry_id)
        return serialize_entry(submitted_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit entry: {str(e)}")


@ssh_router.post("/entries/{entry_id}/approve")
async def approve_entry(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = SSHDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_approve_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be approved")

        now = utc_timestamp()
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "approvedBy": ""}
        signatures["approvedBy"] = user["name"]
        updated = SSHDailyEntry.update_by_id(
            entry_id,
            {
                "status": "approved",
                "workflowState": "approved",
                "signatures": signatures,
                "approvedAt": now,
                "approvedBy": user["name"],
                "updatedAt": now,
                "updated_at": now,
            },
            {field: "" for field in LOCK_FIELDS},
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to approve entry")

        approved_entry = SSHDailyEntry.get_by_id(entry_id)
        return serialize_entry(approved_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve entry: {str(e)}")


@ssh_router.post("/entries/{entry_id}/return")
async def return_entry(entry_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = SSHDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_return_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        lock_owner = build_lock_owner_metadata(existing_entry)
        updated = SSHDailyEntry.update_by_id(
            entry_id,
            {
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
                "updated_at": now,
            },
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to return entry")

        returned_entry = SSHDailyEntry.get_by_id(entry_id)
        return serialize_entry(returned_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return entry: {str(e)}")


@ssh_router.post("/bulk/approve")
async def bulk_approve_entries(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not is_reviewer_like(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can approve entries")

        entry_ids = request_data.get("entryIds") or request_data.get("entry_ids") or request_data.get("reportIds")
        if not isinstance(entry_ids, list) or not entry_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entryIds must be a non-empty list")

        result = create_bulk_result(len(entry_ids))
        approved_count = 0
        now = utc_timestamp()
        for raw_entry_id in entry_ids:
            entry_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(entry_id):
                add_bulk_failure(result, entry_id, "Invalid ID")
                continue
            try:
                existing_entry = SSHDailyEntry.get_by_id(entry_id)
                if not existing_entry:
                    add_bulk_failure(result, entry_id, "Not Found")
                    continue
                if not can_approve_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                signatures = existing_entry.get("signatures") or {"preparedBy": "", "approvedBy": ""}
                signatures["approvedBy"] = user["name"]
                updated = SSHDailyEntry.update_by_id(
                    entry_id,
                    {
                        "status": "approved",
                        "workflowState": "approved",
                        "signatures": signatures,
                        "approvedAt": now,
                        "approvedBy": user["name"],
                        "updatedAt": now,
                        "updated_at": now,
                    },
                    {field: "" for field in LOCK_FIELDS},
                )
                if not updated:
                    add_bulk_failure(result, entry_id, "Update Failed")
                    continue
                approved_count += 1
            except Exception as item_error:
                add_bulk_failure(result, entry_id, str(item_error))

        result["approved"] = approved_count
        result["processed"] = approved_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk approve entries: {str(e)}")


@ssh_router.post("/bulk/delete")
async def bulk_delete_entries(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not (is_operator(user) or is_reviewer_like(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete entries")

        entry_ids = request_data.get("entryIds") or request_data.get("entry_ids") or request_data.get("reportIds")
        if not isinstance(entry_ids, list) or not entry_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entryIds must be a non-empty list")

        result = create_bulk_result(len(entry_ids))
        deleted_count = 0

        for raw_entry_id in entry_ids:
            entry_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(entry_id):
                continue
            existing_entry = SSHDailyEntry.get_by_id(entry_id)
            if existing_entry and normalize_workflow_state(existing_entry) == "approved":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                )

        for raw_entry_id in entry_ids:
            entry_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(entry_id):
                add_bulk_failure(result, entry_id, "Invalid ID")
                continue
            try:
                existing_entry = SSHDailyEntry.get_by_id(entry_id)
                if not existing_entry:
                    add_bulk_failure(result, entry_id, "Not Found")
                    continue
                if normalize_workflow_state(existing_entry) == "approved":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
                    )
                if not can_delete_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                if not SSHDailyEntry.delete_by_id(entry_id):
                    add_bulk_failure(result, entry_id, "Delete Failed")
                    continue
                deleted_count += 1
            except Exception as item_error:
                add_bulk_failure(result, entry_id, str(item_error))

        result["deleted"] = deleted_count
        result["processed"] = deleted_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete entries: {str(e)}")


@ssh_router.post("/signatures")
async def update_signatures(payload: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        date = payload.get("date")
        signatures = payload.get("signatures", {})
        line_group = _normalize_line_group(payload.get("lineGroup"))
        shift = payload.get("shift", "A")

        if not date:
            raise HTTPException(status_code=400, detail="Date is required")
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

        existing_entry = SSHDailyEntry.get_by_date_and_shift(date, shift, line_group)
        if existing_entry and not can_edit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to update signatures for this entry")
        if not existing_entry and not can_create_entry(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entry signatures")

        success = SSHDailyEntry.update_context_signatures(date, line_group, shift, signatures)
        if not success:
            date_obj = datetime.strptime(str(date).split("T")[0], "%Y-%m-%d")
            placeholder_entry = {
                "date": date_obj.strftime("%Y-%m-%d"),
                "testingDate": date_obj.strftime("%Y-%m-%d"),
                "shift": shift,
                "lineGroup": line_group,
                "checkedBy": "",
                "po": "",
                "lines": {
                    "1": {"sealantSupplier": "", "sealantExpDate": "", "sampleTakingTime": "", "sampleTestingTime": "", "result": "", "remarks": ""},
                    "2": {"sealantSupplier": "", "sealantExpDate": "", "sampleTakingTime": "", "sampleTestingTime": "", "result": "", "remarks": ""},
                },
                "signatures": signatures,
            }
            placeholder_entry = build_entry_update_data(
                normalize_entry_payload(placeholder_entry, allow_blank_lines=True),
                existing_entry=None,
                user=user,
                workflow_state="draft",
            )
            SSHDailyEntry.create(placeholder_entry)

        return {"success": True, "message": "Signatures updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")


@ssh_router.delete("/entries/by-id/{entry_id}")
async def delete_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        entry = SSHDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = SSHDailyEntry.delete_by_id(entry_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@ssh_router.delete("/entries/{date}/{line_group}/{shift}")
async def delete_entry_by_line_group(date: str, line_group: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Delete an entry by date, line group, and shift."""
    try:
        user = get_current_user(x_employee_id)
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = str(date).split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = SSHDailyEntry.delete_by_date_and_shift(date_key, shift, line_group)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@ssh_router.delete("/entries/{date}/{shift}")
async def delete_entry(date: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Delete an entry by date and shift"""
    try:
        user = get_current_user(x_employee_id)
        # Validate shift
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        # Normalize date param and get entry first to know year/month for stats
        date_key = str(date).split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        
        # Delete the entry
        deleted = SSHDailyEntry.delete_by_date_and_shift(date_key, shift, "Line-I")
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")

        year = entry.get("year")
        month = entry.get("month")
        if not year or not month:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
            year = date_obj.year
            month = date_obj.month

        stats = build_monthly_stats(year, month)
        
        return {
            "success": True,
            "message": "Entry deleted successfully",
            "data": {
                "stats": stats
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@ssh_router.get("/export/excel")
async def export_monthly_excel(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    filename: str = Query("SSH_Report", description="Export filename (without extension)")
):
    """Export monthly data as Excel file"""
    try:
        from generators.SSHReportGenerator import generate_ssh_report

        # Get entries for the month from DB
        entries = SSHDailyEntry.get_month_entries(year, month)

        # Prepare data for Excel generation
        report_data = {
            "form_data": {},
            "entries": serialize_docs(entries),
            "name": filename,
            "year": year,
            "month": month
        }

        output, out_filename = generate_ssh_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")


@ssh_router.post("/export/excel")
async def export_monthly_excel_post(payload: dict, x_employee_id: str | None = Header(default=None)):
    """Accept monthly JSON (or payload with entries) and return generated Excel in one step

    Payload can be:
    - The exact object returned by `/entries/monthly` (i.e. {"success": True, "data": [...]})
    - An object containing `entries` (list) and optional `form_data` and `name`/`filename`
    - A plain list of entries
    """
    try:
        user = get_optional_user(x_employee_id)
        if user and isinstance(payload, dict):
            for entry in payload.get("entries") or []:
                existing_entry = None
                entry_id = entry.get("_id") or entry.get("id")
                if entry_id and ObjectId.is_valid(str(entry_id)):
                    existing_entry = SSHDailyEntry.get_by_id(str(entry_id))
                if not existing_entry:
                    existing_entry = SSHDailyEntry.get_by_date_and_shift(
                        entry.get("date"),
                        entry.get("shift"),
                        entry.get("lineGroup"),
                    )
                if not existing_entry or not can_export_entry(existing_entry, user):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Monthly Excel can be generated only from submitted or approved entries")

        # Determine entries list
        entries = []
        form_data = {}
        name = 'SSH_Test_Report'
        year = datetime.now().year
        month = datetime.now().month

        if isinstance(payload, dict):
            # If payload is the monthly endpoint response
            if 'data' in payload and isinstance(payload['data'], list):
                entries = payload['data']
            elif 'entries' in payload and isinstance(payload['entries'], list):
                entries = payload['entries']
            else:
                # Look for a nested structure
                for k in ['rows', 'items', 'entries', 'data']:
                    if k in payload and isinstance(payload[k], list):
                        entries = payload[k]
                        break

            form_data = payload.get('form_data') or payload.get('formData') or {}
            name = payload.get('name') or payload.get('filename') or payload.get('report_name') or 'SSH_Test_Report'
            year = payload.get('year', year)
            month = payload.get('month', month)
        elif isinstance(payload, list):
            entries = payload
        else:
            raise HTTPException(status_code=400, detail='Invalid payload for Excel export')

        # Ensure entries are JSON-serializable and dates normalized
        safe_entries = []
        for e in entries:
            safe_entries.append(serialize_doc(e) if isinstance(e, dict) else e)

        report_data = {
            'form_data': form_data,
            'entries': safe_entries,
            'name': name,
            'year': year,
            'month': month,
            'lineGroup': payload.get('lineGroup') if isinstance(payload, dict) else None
        }

        output, out_filename = generate_ssh_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel from payload: {str(e)}")
