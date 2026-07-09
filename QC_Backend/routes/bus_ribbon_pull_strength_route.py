import calendar
from datetime import datetime
import logging
import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from generators.BusRibbonPullStrengthReportGenerator import generate_bus_ribbon_pull_strength_report
from models.bus_ribbon_pull_strength_models import (
    BusRibbonPullStrengthDailyEntry,
    bus_ribbon_pull_strength_entries_collection,
    normalize_line,
)
from services.dashboard_analytics_service import (
    build_dashboard_response,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
)
from services.creator_resolution_service import (
    build_lock_owner_metadata,
    get_created_by_label as resolve_created_by_label,
    require_operator_signature,
)
from services.pull_strength_lookup_service import PullStrengthLookupService
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

logger = logging.getLogger(__name__)


bus_ribbon_pull_strength_router = APIRouter(
    prefix="/api/bus-ribbon-pull-strength-reports",
    tags=["Bus Ribbon Pull Strength Reports"],
)

SHIFT_OPTIONS = {"A", "B", "C"}
LINE_OPTIONS = {"FAB-II Line-I", "FAB-II Line-II"}
POSITION_OPTIONS = {
    "1-TOP",
    "1-MIDDLE",
    "1-BOTTOM",
    "2-TOP",
    "2-MIDDLE",
    "2-BOTTOM",
    "3-TOP",
    "3-MIDDLE",
    "3-BOTTOM",
}
LINE_BUSSING_KEYS = {
    "FAB-II Line-I": ("autoBussing1", "autoBussing2", "autoBussing3"),
    "FAB-II Line-II": ("autoBussing4", "autoBussing5"),
}
BUSSING_LABELS = {
    "autoBussing1": "Auto Bussing 1",
    "autoBussing2": "Auto Bussing 2",
    "autoBussing3": "Auto Bussing 3",
    "autoBussing4": "Auto Bussing 4",
    "autoBussing5": "Auto Bussing 5",
}
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
    "line": ("line", 1),
    "date-newest": ("date", -1),
    "date-oldest": ("date", 1),
}
BUSINESS_ENTRY_FIELDS = {
    "date",
    "testingDate",
    "shift",
    "line",
    "shiftDetails",
    "bussingData",
    "averages",
    "signatures",
    "year",
    "month",
}


def display_strength_number(index: int) -> int:
    return ((index - 1) % 16) + 1


def signature_key(date: str, line: str, shift: str) -> str:
    return f"{date}_{normalize_line(line)}_{shift}"


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
    doc_copy["line"] = normalize_line(doc_copy.get("line"))
    doc_copy.setdefault("shiftDetails", {"poNumber": "", "intcRibbonStatus": "", "busRibbonStatus": ""})
    doc_copy.setdefault("bussingData", {})
    doc_copy.setdefault("averages", {})
    doc_copy.setdefault("signatures", {"preparedBy": "", "reviewedBy": ""})
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
    return doc_copy


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


def parse_numeric(value):
    if value in (None, ""):
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def calculate_average(values):
    numeric_values = [value for value in (parse_numeric(item) for item in values) if value is not None]
    if not numeric_values:
        return ""
    return f"{sum(numeric_values) / len(numeric_values):.2f}"


def normalize_entry_payload(entry: dict) -> dict:
    required_fields = ["date", "testingDate", "shift", "line", "shiftDetails", "bussingData"]
    for field in required_fields:
        if field not in entry:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    if entry["shift"] not in SHIFT_OPTIONS:
        raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

    line = normalize_line(entry.get("line"))
    if line not in LINE_OPTIONS:
        raise HTTPException(status_code=400, detail="Line must be FAB-II Line-I or FAB-II Line-II")

    date_key = str(entry.get("date")).split("T")[0]
    try:
        date_obj = datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    shift_details = entry.get("shiftDetails") or {}
    normalized_bussing_data = {}
    normalized_averages = {}
    for machine_key in LINE_BUSSING_KEYS[line]:
        machine_label = BUSSING_LABELS[machine_key]
        machine = (entry.get("bussingData") or {}).get(machine_key) or {}
        position = str(machine.get("position") or "").strip()
        if position and position not in POSITION_OPTIONS:
            raise HTTPException(status_code=400, detail=f"{machine_label} position is invalid")

        strengths = machine.get("strengths") or []
        if not isinstance(strengths, list):
            raise HTTPException(status_code=400, detail=f"{machine_label} strengths must be a list")
        padded_strengths = [(strengths[index] if index < len(strengths) else "") for index in range(32)]
        for index, value in enumerate(padded_strengths, start=1):
            if value not in (None, "") and parse_numeric(value) is None:
                raise HTTPException(status_code=400, detail=f"{machine_label} Strength {display_strength_number(index)} must be a valid number")

        normalized_bussing_data[machine_key] = {
            "position": position,
            "strengths": ["" if value is None else str(value).strip() for value in padded_strengths],
        }
        normalized_averages[machine_key] = {
            "average1": calculate_average(padded_strengths[:16]),
            "average2": calculate_average(padded_strengths[16:]),
        }

    return {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "line": line,
        "shiftDetails": {
            "poNumber": str(shift_details.get("poNumber") or "").strip(),
            "intcRibbonStatus": str(shift_details.get("intcRibbonStatus") or "").strip(),
            "busRibbonStatus": str(shift_details.get("busRibbonStatus") or "").strip(),
        },
        "bussingData": normalized_bussing_data,
        "averages": normalized_averages,
        "signatures": entry.get("signatures") or {"preparedBy": "", "reviewedBy": ""},
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
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "reviewedBy": ""}

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
            {"shiftDetails.poNumber": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"line": {"$regex": escaped_search, "$options": "i"}},
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
        filters["line"] = normalize_line(line)
    return filters


def get_created_by_label(entry: dict) -> str:
    return resolve_created_by_label(entry)


def serialize_entry_summary(entry: dict, user: dict | None = None) -> dict:
    serialized = serialize_entry(entry, user, include_permissions=bool(user))
    if not serialized:
        return {}
    serialized["createdByLabel"] = get_created_by_label(entry)
    return serialized


def has_strength_data(entry: dict) -> bool:
    for machine in (entry.get("bussingData") or {}).values():
        if any(str(value).strip() for value in machine.get("strengths", [])):
            return True
    return False


@bus_ribbon_pull_strength_router.get("/dashboard")
async def get_bus_ribbon_pull_strength_dashboard(
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
            collection=bus_ribbon_pull_strength_entries_collection,
            query=query,
            view=view,
            total_key="totalEntries",
            state_fields=("workflowState", "status"),
            serialize_item=lambda entry: serialize_entry_summary(entry, user),
            item_sort=[("date", -1), ("shift", 1), ("line", 1)],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch bus ribbon dashboard: {str(e)}")


@bus_ribbon_pull_strength_router.get("/entries/register")
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
        total = bus_ribbon_pull_strength_entries_collection.count_documents(query)
        entries = list(
            bus_ribbon_pull_strength_entries_collection
            .find(query, {"bussingData": 0})
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


@bus_ribbon_pull_strength_router.get("/entries/by-id/{entry_id}")
async def get_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_view_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this entry")
        return serialize_entry(entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@bus_ribbon_pull_strength_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_optional_user(x_employee_id)
        entries = BusRibbonPullStrengthDailyEntry.get_month_entries(year, month)
        grouped = {}
        date_signatures = {}
        for entry in entries:
            serialized = serialize_entry(entry, user, include_permissions=bool(user))
            date = serialized.get("date")
            grouped.setdefault(date, []).append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("reviewedBy"):
                date_signatures[signature_key(date, serialized.get("line"), serialized.get("shift"))] = signatures

        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
            "grouped": grouped,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        return {"success": False, "data": [], "grouped": {}, "date_signatures": {}, "error": str(e)}


@bus_ribbon_pull_strength_router.get("/entries/{date}")
async def get_entries_for_date(date: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        date_key = date.split("T")[0]
        entries = BusRibbonPullStrengthDailyEntry.get_all_for_date(date_key)
        return {"success": True, "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@bus_ribbon_pull_strength_router.get("/entries/{date}/{line}/{shift}")
async def get_entry(date: str, line: str, shift: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        return serialize_entry(entry, user, include_permissions=bool(user)) if entry else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@bus_ribbon_pull_strength_router.get("/stats/monthly")
async def get_monthly_stats(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        days_in_month = calendar.monthrange(year, month)[1]
        total_possible_entries = days_in_month * 3 * 2
        entries = BusRibbonPullStrengthDailyEntry.get_month_entries(year, month)
        filled_entries = sum(1 for entry in entries if has_strength_data(entry))
        shift_stats = {
            "A": {"filled": 0},
            "B": {"filled": 0},
            "C": {"filled": 0},
        }
        for entry in entries:
            shift = entry.get("shift")
            if shift in shift_stats and has_strength_data(entry):
                shift_stats[shift]["filled"] += 1

        return {
            "success": True,
            "data": {
                "totalDays": days_in_month,
                "totalPossibleEntries": total_possible_entries,
                "filledEntries": filled_entries,
                "completionRate": round((filled_entries / total_possible_entries) * 100) if total_possible_entries else 0,
                "shiftStats": shift_stats,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@bus_ribbon_pull_strength_router.get("/lookup")
async def lookup_pull_strength_measurements(
    date: str = Query(...),
    shift: str = Query(...),
    line: str = Query(...),
    position: str = Query(...),
    side: str = Query(...),
):
    try:
        return {
            "success": True,
            "data": PullStrengthLookupService.lookup(date, shift, line, position, side),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to lookup pull strength measurements: {str(exc)}")


@bus_ribbon_pull_strength_router.post("/entries")
async def create_entry(entry: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        normalized_entry = normalize_entry_payload(entry)
        existing_entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(
            normalized_entry["date"],
            normalized_entry["line"],
            normalized_entry["shift"],
        )

        if existing_entry:
            if not can_edit_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this entry in its current workflow state")
            workflow_state = normalize_workflow_state(existing_entry)
        else:
            if not can_create_entry(user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entries")
            workflow_state = "draft"

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

        BusRibbonPullStrengthDailyEntry.create(update_data)
        saved_entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(
            normalized_entry["date"],
            normalized_entry["line"],
            normalized_entry["shift"],
        )
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {"entry": serialize_doc(saved_entry)},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/entries/{entry_id}/submit")
async def submit_entry(entry_id: str, entry: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_submit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit draft or returned entries")

        normalized_entry = normalize_entry_payload(entry or existing_entry)
        signatures = normalized_entry.get("signatures") or existing_entry.get("signatures") or {"preparedBy": "", "reviewedBy": ""}
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

        updated = BusRibbonPullStrengthDailyEntry.update_by_id(
            entry_id,
            update_data,
            {field: "" for field in LOCK_FIELDS},
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to submit entry")

        submitted_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        return serialize_entry(submitted_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/entries/{entry_id}/approve")
async def approve_entry(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_approve_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be approved")

        now = utc_timestamp()
        signatures = existing_entry.get("signatures") or {"preparedBy": "", "reviewedBy": ""}
        signatures["reviewedBy"] = user["name"]
        updated = BusRibbonPullStrengthDailyEntry.update_by_id(
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

        approved_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        return serialize_entry(approved_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/entries/{entry_id}/return")
async def return_entry(entry_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_return_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        lock_owner = build_lock_owner_metadata(existing_entry)
        updated = BusRibbonPullStrengthDailyEntry.update_by_id(
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

        returned_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        return serialize_entry(returned_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/bulk/approve")
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
                existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
                if not existing_entry:
                    add_bulk_failure(result, entry_id, "Not Found")
                    continue
                if not can_approve_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                signatures = existing_entry.get("signatures") or {"preparedBy": "", "reviewedBy": ""}
                signatures["reviewedBy"] = user["name"]
                updated = BusRibbonPullStrengthDailyEntry.update_by_id(
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


@bus_ribbon_pull_strength_router.post("/bulk/delete")
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
            existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
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
                existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
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
                if not BusRibbonPullStrengthDailyEntry.delete_by_id(entry_id):
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


@bus_ribbon_pull_strength_router.post("/signatures")
async def update_signatures(payload: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        date = payload.get("date")
        line = normalize_line(payload.get("line"))
        shift = payload.get("shift", "A")
        signatures = payload.get("signatures", {})

        if not date:
            raise HTTPException(status_code=400, detail="Date is required")
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

        existing_entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        if existing_entry and not can_edit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to update signatures for this entry")
        if not existing_entry and not can_create_entry(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create entry signatures")

        success = BusRibbonPullStrengthDailyEntry.update_context_signatures(date, line, shift, signatures)
        if not success:
            date_obj = datetime.strptime(str(date).split("T")[0], "%Y-%m-%d")
            placeholder_entry = normalize_entry_payload({
                "date": date_obj.strftime("%Y-%m-%d"),
                "testingDate": date_obj.strftime("%Y-%m-%d"),
                "line": line,
                "shift": shift,
                "shiftDetails": {"poNumber": "", "intcRibbonStatus": "", "busRibbonStatus": ""},
                "bussingData": {},
                "signatures": signatures,
            })
            placeholder_entry = build_entry_update_data(
                placeholder_entry,
                existing_entry=None,
                user=user,
                workflow_state="draft",
            )
            BusRibbonPullStrengthDailyEntry.create(placeholder_entry)

        return {"success": True, "message": "Signatures updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")


@bus_ribbon_pull_strength_router.delete("/entries/by-id/{entry_id}")
async def delete_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        entry = BusRibbonPullStrengthDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            # Approved entries are permanent records and must never reach the delete path.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = BusRibbonPullStrengthDailyEntry.delete_by_id(entry_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@bus_ribbon_pull_strength_router.delete("/entries/{date}/{line}/{shift}")
async def delete_entry(date: str, line: str, shift: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            # Approved entries are permanent records and must never reach the delete path.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE,
            )
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = BusRibbonPullStrengthDailyEntry.delete_by_date_line_shift(date, line, shift)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/export/excel")
async def export_monthly_excel(payload: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        if user:
            for entry in payload.get("entries") or []:
                existing_entry = None
                entry_id = entry.get("_id") or entry.get("id")
                if entry_id and ObjectId.is_valid(str(entry_id)):
                    existing_entry = BusRibbonPullStrengthDailyEntry.get_by_id(str(entry_id))
                if not existing_entry:
                    existing_entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(
                        entry.get("date"),
                        entry.get("line"),
                        entry.get("shift"),
                    )
                if not existing_entry or not can_export_entry(existing_entry, user):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Monthly Excel can be generated only from submitted or approved entries")
        output, filename = generate_bus_ribbon_pull_strength_report(payload)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.exception("bus_ribbon_excel_generation_failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
