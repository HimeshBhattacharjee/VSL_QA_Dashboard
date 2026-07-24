import re
import logging
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from line_status import is_line_off, normalize_line, with_default_line_statuses
from models.jb_sealant_wt_models import JBSealantDailyEntry, jb_sealant_entries_collection
from datetime import datetime
import calendar
from generators.JBSealantWeightReportGenerator import generate_jb_sealant_report
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
from services.shift_prepared_by_service import trusted_signature_update

logger = logging.getLogger(__name__)

jb_sealant_router = APIRouter(prefix="/api/jb-sealant-weight-reports", tags=["JB Sealant Weight Reports"])

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
    "lines",
    "signatures",
    "year",
    "month",
}

def _normalize_line_group(line_group):
    return 'Line-II' if line_group == 'Line-II' else 'Line-I'

def _signature_key(date, line_group, shift):
    return f"{date}_{_normalize_line_group(line_group)}_{shift}"

JB_PASS_MIN = 4
JB_PASS_MAX = 10

LINE_REQUIRED_FIELDS = (
    ("jbSupplier", "JB Supplier"),
    ("sealantSupplier", "Sealant Supplier"),
    ("sealantExpiry", "Sealant Expiry Date")
)

POSITION_REQUIRED_FIELDS = (
    ("jbWeight", "JB Wt"),
    ("jbWeightWithSealant", "JB Wt with Sealant")
)

POSITION_LABELS = {
    "positiveJB": "Positive JB",
    "middleJB": "Middle JB",
    "negativeJB": "Negative JB"
}

def _normalize_field_value(value):
    return str(value).strip() if value is not None else ""

def _default_position():
    return {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}

def _default_line(line_number: str):
    return {
        "line": line_number,
        "po": "",
        "jbSupplier": "",
        "sealantSupplier": "",
        "sealantExpiry": "",
        "positiveJB": _default_position(),
        "middleJB": _default_position(),
        "negativeJB": _default_position(),
        "totalModuleWeight": "",
        "remarks": ""
    }

def _get_line_required_details(line: dict):
    details = []

    for field_key, field_label in LINE_REQUIRED_FIELDS:
        details.append((field_label, _normalize_field_value(line.get(field_key))))

    for position_key, position_label in POSITION_LABELS.items():
        position = line.get(position_key, {}) or {}
        for field_key, field_label in POSITION_REQUIRED_FIELDS:
            details.append((f"{position_label} - {field_label}", _normalize_field_value(position.get(field_key))))

    return details

def _has_any_line_detail_input(line: dict):
    return any(value for _, value in _get_line_required_details(line)) or bool(_normalize_field_value(line.get("remarks")))

def _get_line_validation_error(line: dict, line_number: str):
    has_po = bool(_normalize_field_value(line.get("po")))
    has_any_line_input = _has_any_line_detail_input(line)

    if not has_po and not has_any_line_input:
        return None

    if not has_po:
        return f"Please enter the PO number for Line {line_number} before saving."

    first_missing_detail = next((label for label, value in _get_line_required_details(line) if not value), None)
    if first_missing_detail:
        return f"Please complete all mandatory details for Line {line_number} before saving. Missing: {first_missing_detail}."

    return None

def _parse_numeric_value(value):
    normalized = _normalize_field_value(value)
    if not normalized:
        return None
    try:
        return float(normalized)
    except (TypeError, ValueError):
        return None

def _has_any_position_input(position: dict):
    return any(
        _normalize_field_value(position.get(field))
        for field in ("jbWeight", "jbWeightWithSealant", "netSealantWeight")
    )

def _has_any_line_input(line: dict):
    return (
        bool(_normalize_field_value(line.get("po"))) or
        _has_any_line_detail_input(line) or
        bool(_normalize_field_value(line.get("totalModuleWeight"))) or
        any(_has_any_position_input(line.get(position_key, {}) or {}) for position_key in POSITION_LABELS)
    )

def _get_line_validity(line: dict):
    any_input = _has_any_line_input(line)
    pass_count = 0
    fail_count = 0
    for position_key in POSITION_LABELS:
        weight = _parse_numeric_value((line.get(position_key, {}) or {}).get("netSealantWeight"))
        if weight is None:
            continue
        if JB_PASS_MIN <= weight <= JB_PASS_MAX:
            pass_count += 1
        else:
            fail_count += 1

    return {"pass": pass_count > 0 and fail_count == 0, "fail": fail_count > 0, "any": any_input}

def _build_default_monthly_stats(year: int, month: int):
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

def _build_monthly_stats(year: int, month: int):
    entries = JBSealantDailyEntry.get_month_entries(year, month)
    stats = _build_default_monthly_stats(year, month)

    for entry in entries:
        shift = entry.get("shift")
        lines = entry.get("lines", {})

        if shift not in stats["shiftStats"]:
            continue

        for line_number in ("1", "2"):
            line = lines.get(line_number, {}) or {}
            if not _has_any_line_input(line):
                continue

            stats["filledEntries"] += 1
            stats["shiftStats"][shift]["filled"] += 1
            stats["shiftStats"][shift]["lines"][line_number] += 1

            validity = _get_line_validity(line)
            if validity["pass"]:
                stats["passCount"] += 1
                stats["shiftStats"][shift]["pass"] += 1
            elif validity["fail"]:
                stats["failCount"] += 1
                stats["shiftStats"][shift]["fail"] += 1

    if stats["totalPossibleEntries"] > 0:
        stats["completionRate"] = round((stats["filledEntries"] / stats["totalPossibleEntries"]) * 100)

    return stats

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
    
    doc_copy["lineGroup"] = _normalize_line_group(doc_copy.get("lineGroup"))
    doc_copy.setdefault("signatures", {"preparedBy": "", "verifiedBy": ""})
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

    if "lines" not in doc_copy or not isinstance(doc_copy["lines"], dict):
        doc_copy["lines"] = {}

    for line_num in ["1", "2"]:
        line = {**_default_line(line_num), **(doc_copy["lines"].get(line_num) or {})}
        for position_key in POSITION_LABELS:
            line[position_key] = {**_default_position(), **(line.get(position_key) or {})}
        doc_copy["lines"][line_num] = line

    po_values = [
        _normalize_field_value(doc_copy["lines"].get("1", {}).get("po")),
        _normalize_field_value(doc_copy["lines"].get("2", {}).get("po")),
    ]
    doc_copy["productionOrder"] = " / ".join(value for value in po_values if value)
    
    return with_default_line_statuses(doc_copy)

def serialize_docs(docs):
    """Helper function to convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

def serialize_entry(doc, user: dict | None = None, include_permissions: bool = False):
    serialized = with_default_line_statuses(serialize_doc(doc))
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

def normalize_entry_payload(entry: dict) -> dict:
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

    for line_number in ("1", "2"):
        line = entry["lines"].get(line_number, {})
        validation_error = None if is_line_off(line) else _get_line_validation_error(line, line_number)
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)

    date_key = str(entry.get("date")).split("T")[0]
    try:
        date_obj = datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    normalized_lines = {}
    for line_number in ("1", "2"):
        line = {**_default_line(line_number), **((entry.get("lines") or {}).get(line_number) or {})}
        for position_key in POSITION_LABELS:
            position = {**_default_position(), **(line.get(position_key) or {})}
            position["jbWeight"] = _normalize_field_value(position.get("jbWeight"))
            position["jbWeightWithSealant"] = _normalize_field_value(position.get("jbWeightWithSealant"))
            position["netSealantWeight"] = _normalize_field_value(position.get("netSealantWeight"))
            line[position_key] = position

        normalized_lines[line_number] = normalize_line({
            **line,
            "line": line_number,
            "po": _normalize_field_value(line.get("po")),
            "jbSupplier": _normalize_field_value(line.get("jbSupplier")),
            "sealantSupplier": _normalize_field_value(line.get("sealantSupplier")),
            "sealantExpiry": _normalize_field_value(line.get("sealantExpiry")),
            "totalModuleWeight": _normalize_field_value(line.get("totalModuleWeight")),
            "remarks": _normalize_field_value(line.get("remarks")),
        })

    return {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "shift": entry["shift"],
        "lineGroup": line_group,
        "lines": normalized_lines,
        "signatures": entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""},
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
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""}

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
            {"lines.1.po": {"$regex": escaped_search, "$options": "i"}},
            {"lines.2.po": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"lineGroup": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
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

def get_created_by_label(entry: dict) -> str:
    return resolve_created_by_label(entry)

def serialize_entry_summary(entry: dict, user: dict | None = None) -> dict:
    serialized = serialize_entry(entry, user, include_permissions=bool(user))
    if not serialized:
        return {}
    serialized["createdByLabel"] = get_created_by_label(entry)
    return serialized

@jb_sealant_router.get("/dashboard")
async def get_jb_sealant_dashboard(
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
            collection=jb_sealant_entries_collection,
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch JB sealant dashboard: {str(e)}")

@jb_sealant_router.get("/entries/register")
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
        total = jb_sealant_entries_collection.count_documents(query)
        entries = list(
            jb_sealant_entries_collection
            .find(query, {
                "lines.1.positiveJB": 0,
                "lines.1.middleJB": 0,
                "lines.1.negativeJB": 0,
                "lines.2.positiveJB": 0,
                "lines.2.middleJB": 0,
                "lines.2.negativeJB": 0,
            })
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

@jb_sealant_router.get("/entries/by-id/{entry_id}")
async def get_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        entry = JBSealantDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_view_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this entry")
        return serialize_entry(entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@jb_sealant_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    x_employee_id: str | None = Header(default=None),
):
    """Get all entries for a specific month"""
    try:
        user = get_optional_user(x_employee_id)
        entries = JBSealantDailyEntry.get_month_entries(year, month)
        
        # Group entries by date for easier frontend consumption
        entries_by_date = {}
        date_signatures = {}
        
        for entry in entries:
            serialized = serialize_entry(entry, user, include_permissions=bool(user))
            date = serialized.get("date")
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(serialized)
            
            # Collect signatures (all shifts on same date should have same signatures)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("verifiedBy"):
                date_signatures[_signature_key(date, serialized.get("lineGroup"), serialized.get("shift"))] = signatures
        
        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
            "grouped": entries_by_date,
            "date_signatures": date_signatures
        }
    except Exception as e:
        return {
            "success": False,
            "data": [],
            "grouped": {},
            "date_signatures": {},
            "error": str(e)
        }

@jb_sealant_router.get("/entries/{date}")
async def get_entries_for_date(date: str, x_employee_id: str | None = Header(default=None)):
    """Get all shift entries for a specific date"""
    try:
        user = get_optional_user(x_employee_id)
        date_key = date.split('T')[0]
        entries = JBSealantDailyEntry.get_all_for_date(date_key)
        date_signatures = JBSealantDailyEntry.get_context_signatures(date_key, "Line-I", "A")
        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
            "date_signatures": date_signatures
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")

@jb_sealant_router.get("/entries/{date}/{line_group}/{shift}")
async def get_entry_by_line_group(date: str, line_group: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date, line group, and shift."""
    try:
        user = get_optional_user(x_employee_id)
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = date.split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@jb_sealant_router.get("/entries/{date}/{shift}")
async def get_entry(date: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date and shift"""
    try:
        user = get_optional_user(x_employee_id)
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = date.split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@jb_sealant_router.get("/stats/monthly")
async def get_monthly_stats(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get statistics for a specific month - counting lines not shifts"""
    try:
        return {
            "success": True,
            "data": _build_monthly_stats(year, month)
        }
        days_in_month = calendar.monthrange(year, month)[1]
        
        # Get all entries for the month
        entries = JBSealantDailyEntry.get_month_entries(year, month)
        
        # Calculate stats based on lines
        total_possible_entries = days_in_month * 3 * 2  # 3 shifts * 2 lines per day
        filled_entries = 0
        pass_count = 0
        fail_count = 0
        
        # Initialize shift stats with lines
        shift_stats = {
            "A": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
            "B": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}},
            "C": {"filled": 0, "pass": 0, "fail": 0, "lines": {"1": 0, "2": 0}}
        }
        
        for entry in entries:
            shift = entry.get("shift")
            lines = entry.get("lines", {})
            
            if shift in shift_stats:
                # Process line 1 - check all three JB positions
                line1 = lines.get("1", {})
                if is_line_off(line1):
                    line1 = {}
                positions = [
                    line1.get("positiveJB", {}).get("netSealantWeight"),
                    line1.get("middleJB", {}).get("netSealantWeight"),
                    line1.get("negativeJB", {}).get("netSealantWeight")
                ]
                
                for net_weight in positions:
                    if net_weight:
                        filled_entries += 1
                        shift_stats[shift]["filled"] += 1
                        shift_stats[shift]["lines"]["1"] += 1
                        
                        try:
                            weight = float(net_weight)
                            if JB_PASS_MIN <= weight <= JB_PASS_MAX:
                                pass_count += 1
                                shift_stats[shift]["pass"] += 1
                            else:
                                fail_count += 1
                                shift_stats[shift]["fail"] += 1
                        except (ValueError, TypeError):
                            fail_count += 1
                            shift_stats[shift]["fail"] += 1
                
                # Process line 2 - check all three JB positions
                line2 = lines.get("2", {})
                if is_line_off(line2):
                    line2 = {}
                positions = [
                    line2.get("positiveJB", {}).get("netSealantWeight"),
                    line2.get("middleJB", {}).get("netSealantWeight"),
                    line2.get("negativeJB", {}).get("netSealantWeight")
                ]
                
                for net_weight in positions:
                    if net_weight:
                        filled_entries += 1
                        shift_stats[shift]["filled"] += 1
                        shift_stats[shift]["lines"]["2"] += 1
                        
                        try:
                            weight = float(net_weight)
                            if JB_PASS_MIN <= weight <= JB_PASS_MAX:
                                pass_count += 1
                                shift_stats[shift]["pass"] += 1
                            else:
                                fail_count += 1
                                shift_stats[shift]["fail"] += 1
                        except (ValueError, TypeError):
                            fail_count += 1
                            shift_stats[shift]["fail"] += 1
        
        completion_rate = round((filled_entries / total_possible_entries) * 100) if total_possible_entries > 0 else 0
        
        return {
            "success": True,
            "data": {
                "totalDays": days_in_month,
                "totalPossibleEntries": total_possible_entries,
                "filledEntries": filled_entries,
                "completionRate": completion_rate,
                "passCount": pass_count,
                "failCount": fail_count,
                "shiftStats": shift_stats
            }
        }
    except Exception as e:
        days_in_month = calendar.monthrange(year, month)[1]
        total_possible_entries = days_in_month * 3 * 2
        return {
            "success": False,
            "data": {
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
            },
            "error": str(e)
        }

@jb_sealant_router.post("/entries")
async def create_entry(entry: dict, x_employee_id: str | None = Header(default=None)):
    """Create or update a daily entry for a specific shift with two lines"""
    try:
        user = get_current_user(x_employee_id)
        normalized_entry = normalize_entry_payload(entry)
        existing_entry = None
        entry_id = entry.get("_id") or entry.get("id")
        if entry_id and ObjectId.is_valid(str(entry_id)):
            existing_entry = JBSealantDailyEntry.get_by_id(str(entry_id))
        if not existing_entry:
            existing_entry = JBSealantDailyEntry.get_by_date_and_shift(
                normalized_entry["date"],
                normalized_entry["shift"],
                normalized_entry["lineGroup"],
            )

        if existing_entry:
            if not can_edit_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this entry")
            workflow_state = normalize_workflow_state(existing_entry)
        else:
            if not can_create_entry(user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entries")
            workflow_state = "draft"

        date_signatures = JBSealantDailyEntry.get_context_signatures(
            normalized_entry["date"],
            normalized_entry.get("lineGroup"),
            normalized_entry["shift"],
        )
        if "signatures" not in normalized_entry or not normalized_entry["signatures"].get("preparedBy"):
            normalized_entry["signatures"] = date_signatures or {"preparedBy": "", "verifiedBy": ""}

        update_data = build_entry_update_data(
            normalized_entry,
            existing_entry=existing_entry,
            user=user,
            workflow_state=workflow_state,
        )
        if existing_entry and normalize_workflow_state(existing_entry) in {"draft", "returned"}:
            update_data.update({
                "lockedBy": existing_entry.get("lockedBy") or user["name"],
                "lockedByUserId": existing_entry.get("lockedByUserId") or user["id"],
                "lockedByEmployeeId": existing_entry.get("lockedByEmployeeId") or user["employeeId"],
                "lockTimestamp": existing_entry.get("lockTimestamp") or utc_timestamp(),
                "lockSessionId": existing_entry.get("lockSessionId"),
            })

        JBSealantDailyEntry.create(update_data)
        saved_entry = JBSealantDailyEntry.get_by_date_and_shift(
            normalized_entry["date"],
            normalized_entry["shift"],
            normalized_entry["lineGroup"],
        )

        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_entry(saved_entry, user, include_permissions=True)
            }
        }
        # Validate required fields
        required_fields = ["date", "testingDate", "shift", "lines"]
        for field in required_fields:
            if field not in entry or not entry[field]:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate shift value
        if entry["shift"] not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        
        # Validate lines structure
        if not isinstance(entry["lines"], dict) or "1" not in entry["lines"] or "2" not in entry["lines"]:
            raise HTTPException(status_code=400, detail="Both lines 1 and 2 must be provided")
        
        for line_number in ("1", "2"):
            validation_error = _get_line_validation_error(entry["lines"].get(line_number, {}), line_number)
            if validation_error:
                raise HTTPException(status_code=400, detail=validation_error)
        
        # Normalize and extract year/month from date
        raw_date = entry.get("date")
        date_key = str(raw_date).split('T')[0]
        try:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
        except Exception:
            date_obj = datetime.fromisoformat(date_key)

        entry["date"] = date_obj.strftime("%Y-%m-%d")
        entry["testingDate"] = entry.get("testingDate") and str(entry.get("testingDate")).split('T')[0] or entry["date"]
        entry["year"] = date_obj.year
        entry["month"] = date_obj.month
        entry["lineGroup"] = _normalize_line_group(entry.get("lineGroup"))
        entry["updated_at"] = datetime.now().isoformat()
        
        # Get existing context signatures if any
        date_signatures = JBSealantDailyEntry.get_context_signatures(entry["date"], entry.get("lineGroup"), entry["shift"])
        
        # Preserve signatures if they exist at date level, otherwise initialize
        if "signatures" not in entry or not entry["signatures"].get("preparedBy"):
            entry["signatures"] = date_signatures or {"preparedBy": "", "verifiedBy": ""}
        
        # Remove _id if present
        if "_id" in entry:
            del entry["_id"]
        
        # Use the model's create method which handles upsert by date and shift
        JBSealantDailyEntry.create(entry)
        
        # Get the saved entry
        saved_entry = JBSealantDailyEntry.get_by_date_and_shift(entry["date"], entry["shift"], entry.get("lineGroup"))
        
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_doc(saved_entry)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@jb_sealant_router.post("/entries/{entry_id}/submit")
async def submit_entry(entry_id: str, entry: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_submit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit draft or returned entries")

        normalized_entry = normalize_entry_payload(entry or existing_entry)
        signatures = normalized_entry.get("signatures") or existing_entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""}
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

        updated = JBSealantDailyEntry.update_by_id(entry_id, update_data, {field: "" for field in LOCK_FIELDS})
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to submit entry")

        submitted_entry = JBSealantDailyEntry.get_by_id(entry_id)
        return serialize_entry(submitted_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit entry: {str(e)}")

@jb_sealant_router.post("/entries/{entry_id}/approve")
async def approve_entry(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_approve_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be approved")

        now = utc_timestamp()
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""}
        signatures["verifiedBy"] = user["name"]
        updated = JBSealantDailyEntry.update_by_id(
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

        approved_entry = JBSealantDailyEntry.get_by_id(entry_id)
        return serialize_entry(approved_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve entry: {str(e)}")

@jb_sealant_router.post("/entries/{entry_id}/return")
async def return_entry(entry_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_return_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        lock_owner = build_lock_owner_metadata(existing_entry)
        updated = JBSealantDailyEntry.update_by_id(
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

        returned_entry = JBSealantDailyEntry.get_by_id(entry_id)
        return serialize_entry(returned_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return entry: {str(e)}")

@jb_sealant_router.post("/bulk/approve")
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
                existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
                if not existing_entry:
                    add_bulk_failure(result, entry_id, "Not Found")
                    continue
                if not can_approve_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                signatures = existing_entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""}
                signatures["verifiedBy"] = user["name"]
                updated = JBSealantDailyEntry.update_by_id(
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

@jb_sealant_router.post("/bulk/delete")
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
            existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
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
                existing_entry = JBSealantDailyEntry.get_by_id(entry_id)
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
                if not JBSealantDailyEntry.delete_by_id(entry_id):
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

@jb_sealant_router.post("/signatures")
async def update_signatures(payload: dict, x_employee_id: str | None = Header(default=None)):
    """Update signatures for a specific date (applies to all shifts on that date)"""
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

        existing_entry = JBSealantDailyEntry.get_by_date_and_shift(date, shift, line_group)
        if existing_entry and not can_edit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to update signatures for this entry")
        if not existing_entry and not can_create_entry(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entry signatures")

        signatures = trusted_signature_update(signatures, (existing_entry or {}).get("signatures"), user)
        
        # Update signatures only for the selected line group and shift.
        success = JBSealantDailyEntry.update_context_signatures(date, line_group, shift, signatures)
        
        if not success:
            # If no entries exist, create a placeholder entry for Shift A with signatures
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            placeholder_entry = {
                "date": date,
                "testingDate": date,
                "shift": shift,
                "lineGroup": line_group,
                "lines": {
                    "1": {
                        "po": "", "jbSupplier": "", "sealantSupplier": "", "sealantExpiry": "",
                        "positiveJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "middleJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "negativeJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "totalModuleWeight": "", "remarks": ""
                    },
                    "2": {
                        "po": "", "jbSupplier": "", "sealantSupplier": "", "sealantExpiry": "",
                        "positiveJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "middleJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "negativeJB": {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""},
                        "totalModuleWeight": "", "remarks": ""
                    }
                },
                "signatures": signatures,
                "year": date_obj.year,
                "month": date_obj.month
            }
            placeholder_entry = build_entry_update_data(
                normalize_entry_payload(placeholder_entry),
                existing_entry=None,
                user=user,
                workflow_state="draft",
            )
            JBSealantDailyEntry.create(placeholder_entry)
        
        return {
            "success": True,
            "message": "Signatures updated successfully for all shifts on this date"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")

@jb_sealant_router.delete("/entries/by-id/{entry_id}")
async def delete_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        entry = JBSealantDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = JBSealantDailyEntry.delete_by_id(entry_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@jb_sealant_router.delete("/entries/{date}/{line_group}/{shift}")
async def delete_entry_by_line_group(date: str, line_group: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Delete an entry by date, line group, and shift."""
    try:
        user = get_current_user(x_employee_id)
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = str(date).split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = JBSealantDailyEntry.delete_by_date_and_shift(date_key, shift, line_group)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@jb_sealant_router.delete("/entries/{date}/{shift}")
async def delete_entry(date: str, shift: str, x_employee_id: str | None = Header(default=None)):
    """Delete an entry by date and shift"""
    try:
        user = get_current_user(x_employee_id)
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = str(date).split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        
        deleted = JBSealantDailyEntry.delete_by_date_and_shift(date_key, shift, "Line-I")
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {
            "success": True,
            "message": "Entry deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@jb_sealant_router.post("/export/excel")
async def export_monthly_excel_post(payload: dict, x_employee_id: str | None = Header(default=None)):
    """Generate Excel with multiple sheets - one sheet per day of the month"""
    try:
        user = get_current_user(x_employee_id)
        if user:
            for entry in payload.get("entries") or []:
                existing_entry = None
                entry_id = entry.get("_id") or entry.get("id")
                if entry_id and ObjectId.is_valid(str(entry_id)):
                    existing_entry = JBSealantDailyEntry.get_by_id(str(entry_id))
                if not existing_entry:
                    existing_entry = JBSealantDailyEntry.get_by_date_and_shift(
                        entry.get("date"),
                        entry.get("shift"),
                        entry.get("lineGroup"),
                    )
                if not existing_entry or not can_export_entry(existing_entry, user):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Monthly Excel can be generated only from submitted or approved entries")
                entry.clear()
                entry.update(serialize_doc(existing_entry))

        output, filename = generate_jb_sealant_report(payload)
        
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("jb_sealant_excel_generation_failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
