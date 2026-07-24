import calendar
from datetime import datetime
import logging
import re
from typing import List, Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from report_context import apply_report_context

from generators.JBContactBlockMaintenanceReportGenerator import generate_jb_contact_block_maintenance_report
from models.jb_contact_block_maintenance_models import (
    JBContactBlockMaintenanceDailyEntry,
    jb_contact_block_entries_collection,
    normalize_fab,
)
from services.creator_resolution_service import (
    build_lock_owner_metadata,
    get_created_by_label as resolve_created_by_label,
)
from services.dashboard_analytics_service import (
    build_dashboard_response,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
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


logger = logging.getLogger(__name__)

jb_contact_block_maintenance_router = APIRouter(
    prefix="/api/jb-contact-block-maintenance-reports",
    tags=["JB Contact Block Maintenance Reports"],
)

FAB_OPTIONS = {"FAB-II Line-I", "FAB-II Line-II"}
FAB_LINES = {
    "FAB-II Line-I": ("Line - 1", "Line - 2"),
    "FAB-II Line-II": ("Line - 3", "Line - 4"),
}
LINE_LABELS = ("Line - 1", "Line - 2", "Line - 3", "Line - 4")
NUMERIC_FIELDS = ("sortValuePositive", "sortValueNegative", "springTension")
TEXT_FIELDS = ("po", "jbNo")
NUMERIC_ONLY_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")

SORT_OPTIONS = {
    "newest-created": ("createdAt", -1),
    "oldest-created": ("createdAt", 1),
    "newest-updated": ("updatedAt", -1),
    "oldest-updated": ("updatedAt", 1),
    "recently-updated": ("updatedAt", -1),
    "least-recently-updated": ("updatedAt", 1),
    "status": ("workflowState", 1),
    "created-by": ("createdByEmployeeName", 1),
    "date-newest": ("date", -1),
    "date-oldest": ("date", 1),
}

BUSINESS_ENTRY_FIELDS = {
    "date", "reportDate", "fabLine", "lineGroup",
    "testingDate",
    "fab",
    "lines",
    "signatures",
    "preparedBySignature",
    "preparedByDetails",
    "verifiedBySignature",
    "verifiedByDetails",
    "reviewedBySignature",
    "approvedBySignature",
    "poSummary",
    "year",
    "month",
}


def empty_row() -> dict:
    return {
        "po": "",
        "jbNo": "",
        "sortValuePositive": None,
        "sortValueNegative": None,
        "springTension": None,
        "remarks": "",
        "checkedBy": "",
        "checkedByEmployeeId": "",
        "checkedByUserId": "",
        "checkedBySignature": "",
        "checkedAt": "",
        "checkerAudit": [],
    }


def parse_numeric_only(value):
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    if not NUMERIC_ONLY_RE.fullmatch(text):
        return value
    try:
        return float(text)
    except (TypeError, ValueError):
        return value


def to_stored_number(value):
    numeric_value = parse_numeric_only(value)
    if numeric_value is None:
        return None
    if not isinstance(numeric_value, (int, float)):
        return numeric_value
    return int(numeric_value) if float(numeric_value).is_integer() else numeric_value


def normalize_text(value) -> str:
    return str(value or "").strip()


def normalize_signatures(entry: dict) -> dict:
    signatures = entry.get("signatures") if isinstance(entry.get("signatures"), dict) else {}
    verified_by = (
        normalize_text(signatures.get("verifiedBy"))
        or normalize_text(entry.get("verifiedBySignature"))
        or normalize_text(signatures.get("reviewedBy"))
        or normalize_text(entry.get("reviewedBySignature"))
        or normalize_text(signatures.get("approvedBy"))
        or normalize_text(entry.get("approvedBySignature"))
    )
    return {
        "preparedBy": normalize_text(signatures.get("preparedBy") or entry.get("preparedBySignature")),
        "verifiedBy": verified_by,
    }


def calculate_remarks(row):
    spring_tension = parse_numeric_only(row.get("springTension"))
    sort_value_positive = parse_numeric_only(row.get("sortValuePositive"))
    sort_value_negative = parse_numeric_only(row.get("sortValueNegative"))

    if not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in (
        spring_tension,
        sort_value_positive,
        sort_value_negative,
    )):
        return ""

    return "OK" if spring_tension >= 75 and sort_value_positive < 20 and sort_value_negative < 20 else "NOT OK"


def get_po_summary(entry: dict) -> str:
    lines = entry.get("lines") or {}
    seen: list[str] = []
    for line_label in FAB_LINES.get(normalize_fab(entry.get("fab")), FAB_LINES["FAB-II Line-I"]):
        rows = lines.get(line_label) or []
        if not isinstance(rows, list):
            continue
        for row in rows:
            po = normalize_text((row or {}).get("po") if isinstance(row, dict) else "")
            if po and po not in seen:
                seen.append(po)
    return ", ".join(seen[:3])


def normalize_row_payload(row_payload: dict, line_label: str, row_number: int) -> dict:
    row_payload = row_payload or {}
    normalized = empty_row()
    for field in TEXT_FIELDS:
        normalized[field] = str(row_payload.get(field) or "").strip()

    for field in NUMERIC_FIELDS:
        stored_value = to_stored_number(row_payload.get(field))
        if stored_value is not None and not isinstance(stored_value, (int, float)):
            raise HTTPException(status_code=400, detail=f"{line_label} row {row_number} {field} must be a valid number")
        normalized[field] = stored_value

    normalized["remarks"] = calculate_remarks(normalized)
    return normalized


def row_has_check_data(row: dict) -> bool:
    return any(normalize_text(row.get(field)) for field in TEXT_FIELDS) or any(
        row.get(field) not in (None, "") for field in NUMERIC_FIELDS
    )


def check_values(row: dict) -> tuple:
    return tuple(row.get(field) for field in (*TEXT_FIELDS, *NUMERIC_FIELDS))


def stamp_authenticated_checkers(normalized_entry: dict, existing_entry: dict | None, user: dict, now: str) -> dict:
    """Ignore client identity fields and stamp changed checks from the authenticated user."""
    old_lines = (existing_entry or {}).get("lines") or {}
    for line_label in FAB_LINES[normalized_entry["fab"]]:
        old_rows = old_lines.get(line_label) or []
        for index, row in enumerate(normalized_entry["lines"].get(line_label) or []):
            old_row = old_rows[index] if index < len(old_rows) and isinstance(old_rows[index], dict) else {}
            if not row_has_check_data(row):
                continue
            changed = not old_row or check_values(row) != check_values(old_row)
            if changed:
                audit = list(old_row.get("checkerAudit") or [])
                if old_row.get("checkedByEmployeeId") or old_row.get("checkedBy"):
                    audit.append({
                        "checkedBy": normalize_text(old_row.get("checkedBy")),
                        "checkedByEmployeeId": normalize_text(old_row.get("checkedByEmployeeId")),
                        "checkedByUserId": normalize_text(old_row.get("checkedByUserId")),
                        "checkedBySignature": normalize_text(old_row.get("checkedBySignature")),
                        "checkedAt": normalize_text(old_row.get("checkedAt")),
                        "supersededAt": now,
                    })
                row.update({
                    "checkedBy": user["name"],
                    "checkedByEmployeeId": user["employeeId"],
                    "checkedByUserId": user["id"],
                    "checkedBySignature": user.get("signature") or "",
                    "checkedAt": now,
                    "checkerAudit": audit,
                })
            else:
                for field in ("checkedBy", "checkedByEmployeeId", "checkedByUserId", "checkedBySignature", "checkedAt", "checkerAudit"):
                    row[field] = old_row.get(field, [] if field == "checkerAudit" else "")
    return normalized_entry


def derive_prepared_by(entry: dict) -> dict:
    """Return distinct authenticated checkers in fixed report line/row order."""
    people = []
    seen = set()
    fab = normalize_fab(entry.get("fab"))
    for line_label in FAB_LINES[fab]:
        for row in ((entry.get("lines") or {}).get(line_label) or []):
            employee_id = normalize_text((row or {}).get("checkedByEmployeeId"))
            name = normalize_text((row or {}).get("checkedBy"))
            if not employee_id or not name:
                continue
            identity = employee_id.casefold()
            if identity in seen:
                continue
            seen.add(identity)
            people.append({
                "name": name,
                "employeeId": employee_id,
                "userId": normalize_text(row.get("checkedByUserId")),
                "signature": normalize_text(row.get("checkedBySignature")),
            })
    return {"name": ", ".join(person["name"] for person in people), "people": people}


def apply_derived_preparer(entry: dict, *, preserve_verified: bool = True) -> dict:
    if preserve_verified and normalize_workflow_state(entry) == "approved":
        return entry
    derived = derive_prepared_by(entry)
    signatures = normalize_signatures(entry)
    signatures["preparedBy"] = derived["name"]
    entry["signatures"] = signatures
    entry["preparedBySignature"] = derived["name"]
    entry["preparedByDetails"] = derived["people"]
    return entry


def normalize_entry_payload(entry: dict) -> dict:
    required_fields = ["date", "testingDate", "fab", "lines"]
    for field in required_fields:
        if field not in entry:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    fab = normalize_fab(entry.get("fab"))
    if fab not in FAB_OPTIONS:
        raise HTTPException(status_code=400, detail="FAB must be FAB-II Line-I or FAB-II Line-II")

    date_key = str(entry.get("date")).split("T")[0]
    try:
        date_obj = datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    raw_lines = entry.get("lines") or {}
    if not isinstance(raw_lines, dict):
        raise HTTPException(status_code=400, detail="Lines must be an object")

    normalized_lines = {}
    for line_label in FAB_LINES[fab]:
        rows = raw_lines.get(line_label) or [empty_row()]
        if not isinstance(rows, list):
            raise HTTPException(status_code=400, detail=f"{line_label} rows must be a list")
        normalized_rows = [
            normalize_row_payload(row, line_label, index + 1)
            for index, row in enumerate(rows or [empty_row()])
        ]
        normalized_lines[line_label] = normalized_rows or [empty_row()]

    normalized = {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "fab": fab,
        "lines": normalized_lines,
        "signatures": normalize_signatures(entry),
        "year": date_obj.year,
        "month": date_obj.month,
    }
    normalized = apply_report_context(normalized)
    normalized["preparedBySignature"] = normalized["signatures"]["preparedBy"]
    normalized["verifiedBySignature"] = normalized["signatures"]["verifiedBy"]
    normalized["poSummary"] = get_po_summary(normalized)
    return normalized


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

    fab = normalize_fab(doc_copy.get("fab"))
    doc_copy["fab"] = fab
    raw_lines = doc_copy.get("lines") or {}
    normalized_lines = {}
    for line_label in FAB_LINES[fab]:
        normalized_rows = []
        for row in (raw_lines.get(line_label) or [empty_row()]):
            normalized_row = {**empty_row(), **(row or {})}
            normalized_row["remarks"] = calculate_remarks(normalized_row) or normalize_text(normalized_row.get("remarks"))
            normalized_rows.append(normalized_row)
        normalized_lines[line_label] = normalized_rows
    doc_copy["lines"] = normalized_lines
    doc_copy = apply_derived_preparer(doc_copy)
    doc_copy["signatures"] = normalize_signatures(doc_copy)
    doc_copy["preparedBySignature"] = doc_copy["signatures"]["preparedBy"]
    doc_copy["verifiedBySignature"] = doc_copy["signatures"]["verifiedBy"]
    doc_copy["poSummary"] = doc_copy.get("poSummary") or get_po_summary(doc_copy)
    state = normalize_workflow_state(doc_copy)
    doc_copy["status"] = state
    doc_copy["workflowState"] = state
    doc_copy["displayStatus"] = state
    doc_copy["createdAt"] = doc_copy.get("createdAt") or doc_copy.get("created_at")
    doc_copy["updatedAt"] = doc_copy.get("updatedAt") or doc_copy.get("updated_at")
    created_by_label = resolve_created_by_label(doc_copy)
    doc_copy["createdBy"] = doc_copy.get("createdBy") or created_by_label
    doc_copy["createdByEmployeeName"] = doc_copy.get("createdByEmployeeName") or created_by_label
    doc_copy["createdByLabel"] = created_by_label
    doc_copy["isLocked"] = bool(doc_copy.get("lockTimestamp"))
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


def serialize_entry_summary(entry: dict, user: dict | None = None) -> dict:
    serialized = serialize_entry(entry, user, include_permissions=bool(user))
    if not serialized:
        return {}
    serialized["createdByLabel"] = resolve_created_by_label(entry)
    return serialized


def get_optional_user(employee_id: str | None) -> dict | None:
    if not employee_id:
        return None
    return get_current_user(employee_id)


def has_row_data(row: dict) -> bool:
    if any(str(row.get(field) or "").strip() for field in TEXT_FIELDS):
        return True
    return any(row.get(field) not in (None, "") for field in NUMERIC_FIELDS)


def has_entry_data(entry: dict) -> bool:
    fab = normalize_fab(entry.get("fab"))
    lines = entry.get("lines") or {}
    return any(
        has_row_data(row or {})
        for line_label in FAB_LINES[fab]
        for row in (lines.get(line_label) or [])
    )


def build_entry_update_data(
    normalized_entry: dict,
    *,
    existing_entry: dict | None,
    user: dict,
    workflow_state: str,
) -> dict:
    now = utc_timestamp()
    normalized_entry = stamp_authenticated_checkers(normalized_entry, existing_entry, user, now)
    normalized_entry = apply_derived_preparer(normalized_entry, preserve_verified=False)
    update_data = {
        field: normalized_entry[field]
        for field in BUSINESS_ENTRY_FIELDS
        if field in normalized_entry
    }
    update_data.update({
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
            {"poSummary": {"$regex": escaped_search, "$options": "i"}},
            *[{f"lines.{line_label}.po": {"$regex": escaped_search, "$options": "i"}} for line_label in LINE_LABELS],
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


def build_entry_filter_query(*, date_from: Optional[str] = None, date_to: Optional[str] = None) -> dict:
    filters: dict = {}
    if date_from or date_to:
        date_query: dict = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        filters["date"] = date_query
    return filters


def get_export_form_data(entries: List[dict], fallback: dict | None = None) -> dict:
    form_data = dict(fallback or {})
    for entry in entries:
        serialized = serialize_doc(entry) or {}
        signatures = serialized.get("signatures") or {}
        if not form_data.get("preparedBySignature") and signatures.get("preparedBy"):
            form_data["preparedBySignature"] = signatures.get("preparedBy")
        if not form_data.get("verifiedBySignature") and signatures.get("verifiedBy"):
            form_data["verifiedBySignature"] = signatures.get("verifiedBy")
    return form_data


@jb_contact_block_maintenance_router.get("/dashboard")
async def get_jb_contact_block_dashboard(
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
            collection=jb_contact_block_entries_collection,
            query=query,
            view=view,
            total_key="totalEntries",
            state_fields=("workflowState", "status"),
            serialize_item=lambda entry: serialize_entry_summary(entry, user),
            item_sort=[("date", -1), ("createdAt", 1), ("created_at", 1)],
            daily_group_field="date",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch JB Contact Block dashboard: {str(e)}")


@jb_contact_block_maintenance_router.get("/entries/register")
async def get_entry_register(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort: str = Query("date-newest"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_current_user(x_employee_id)
        query = combine_queries(
            build_access_query(user),
            build_search_query(search),
            build_entry_filter_query(date_from=date_from, date_to=date_to),
            build_status_query(status_filter),
        )
        sort_field, sort_direction = SORT_OPTIONS.get(sort, SORT_OPTIONS["date-newest"])
        total = jb_contact_block_entries_collection.count_documents(query)
        entries = list(
            jb_contact_block_entries_collection
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


@jb_contact_block_maintenance_router.get("/entries/by-id/{entry_id}")
async def get_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_view_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this entry")
        return serialize_entry(entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@jb_contact_block_maintenance_router.get("/entries/by-date/{date}")
async def get_entries_by_date(date: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        entries = JBContactBlockMaintenanceDailyEntry.get_all_for_date(date)
        return {"success": True, "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@jb_contact_block_maintenance_router.get("/entries/legacy/{legacy_key}")
async def get_legacy_entry(legacy_key: str, x_employee_id: str | None = Header(default=None)):
    user = get_current_user(x_employee_id)
    entry = JBContactBlockMaintenanceDailyEntry.get_by_id(legacy_key) if ObjectId.is_valid(legacy_key) else jb_contact_block_entries_collection.find_one({"$or": [{"entryNumber": legacy_key}, {"entryNo": legacy_key}]})
    if not entry:
        raise HTTPException(status_code=404, detail="Legacy entry not found")
    if not can_view_entry(entry, user):
        raise HTTPException(status_code=403, detail="You are not authorized to open this entry")
    return {"legacy": True, "canonical": {"reportDate": entry.get("reportDate") or entry.get("date"), "fabLine": entry.get("fabLine") or entry.get("fab")}, "entry": serialize_entry(entry, user, include_permissions=True)}


@jb_contact_block_maintenance_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_optional_user(x_employee_id)
        entries = JBContactBlockMaintenanceDailyEntry.get_month_entries(year, month)
        serialized_entries = [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries]
        grouped = {}
        date_signatures = {}
        for serialized in serialized_entries:
            date = serialized.get("date")
            grouped.setdefault(date, []).append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("verifiedBy"):
                date_signatures.setdefault(date, {})[serialized.get("fab")] = signatures

        return {
            "success": True,
            "data": serialized_entries,
            "grouped": grouped,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        return {"success": False, "data": [], "grouped": {}, "date_signatures": {}, "error": str(e)}


@jb_contact_block_maintenance_router.get("/entries/{date}")
async def get_entries_for_date(date: str, x_employee_id: str | None = Header(default=None)):
    try:
        date_key = date.split("T")[0]
        user = get_optional_user(x_employee_id)
        entries = JBContactBlockMaintenanceDailyEntry.get_all_for_date(date_key)
        return {
            "success": True,
            "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries],
            "date_signatures": {
                fab: JBContactBlockMaintenanceDailyEntry.get_daily_context_signatures(date_key, fab)
                for fab in FAB_OPTIONS
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@jb_contact_block_maintenance_router.get("/entries/{date}/{fab}")
async def get_entry(date: str, fab: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        entry = JBContactBlockMaintenanceDailyEntry.get_by_date_fab(date, fab)
        return serialize_entry(entry, user, include_permissions=bool(user)) if entry else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@jb_contact_block_maintenance_router.get("/stats/monthly")
async def get_monthly_stats(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        days_in_month = calendar.monthrange(year, month)[1]
        total_possible_entries = days_in_month * 2
        entries = JBContactBlockMaintenanceDailyEntry.get_month_entries(year, month)
        filled_entries = sum(1 for entry in entries if has_entry_data(entry))

        return {
            "success": True,
            "data": {
                "totalDays": days_in_month,
                "totalPossibleEntries": total_possible_entries,
                "filledEntries": filled_entries,
                "completionRate": round((filled_entries / total_possible_entries) * 100) if total_possible_entries else 0,
                "fabStats": {
                    "FAB-II Line-I": sum(1 for entry in entries if normalize_fab(entry.get("fab")) == "FAB-II Line-I" and has_entry_data(entry)),
                    "FAB-II Line-II": sum(1 for entry in entries if normalize_fab(entry.get("fab")) == "FAB-II Line-II" and has_entry_data(entry)),
                },
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@jb_contact_block_maintenance_router.post("/entries")
async def create_entry(entry: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        normalized_entry = normalize_entry_payload(entry)
        entry_id = str(entry.get("_id") or entry.get("id") or "").strip()
        existing_entry = (
            JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
            if entry_id and ObjectId.is_valid(entry_id)
            else None
        )

        if existing_entry:
            if not can_edit_entry(existing_entry, user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to edit this entry in its current workflow state",
                )
            workflow_state = normalize_workflow_state(existing_entry)
        else:
            if not can_create_entry(user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create draft entries")
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

        if existing_entry:
            JBContactBlockMaintenanceDailyEntry.update_by_id(entry_id, update_data)
            saved_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        else:
            new_entry_id = JBContactBlockMaintenanceDailyEntry.create(update_data)
            saved_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(new_entry_id)

        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {"entry": serialize_entry(saved_entry, user, include_permissions=True)},
        }
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A JB Contact Block report already exists for this date and FAB line")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/entries/{entry_id}/submit")
async def submit_entry(entry_id: str, entry: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_submit_entry(existing_entry, user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creating operator can submit draft or returned entries",
            )
        normalized_entry = normalize_entry_payload(entry or existing_entry)
        normalized_entry = stamp_authenticated_checkers(normalized_entry, existing_entry, user, utc_timestamp())
        normalized_entry = apply_derived_preparer(normalized_entry, preserve_verified=False)
        signatures = normalized_entry.get("signatures") or {}
        if not signatures.get("preparedBy"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prepared By is pending because no authenticated Checked By record exists for this date and FAB line.",
            )

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
        updated = JBContactBlockMaintenanceDailyEntry.update_by_id(entry_id, update_data, {field: "" for field in LOCK_FIELDS})
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to submit entry")
        submitted_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        return serialize_entry(submitted_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/entries/{entry_id}/verify")
@jb_contact_block_maintenance_router.post("/entries/{entry_id}/approve", include_in_schema=False)
async def verify_entry(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_approve_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only authorized supervisors or managers can verify submitted entries")

        now = utc_timestamp()
        signatures = normalize_signatures(existing_entry)
        prepared = derive_prepared_by(existing_entry)
        if not prepared["name"]:
            raise HTTPException(status_code=400, detail="Verification blocked: Prepared By cannot be derived because no authenticated Checked By record exists for this date and FAB line.")
        signatures["preparedBy"] = prepared["name"]
        signatures["verifiedBy"] = user["name"]
        updated = JBContactBlockMaintenanceDailyEntry.update_by_id(
            entry_id,
            {
                **existing_entry,
                "status": "approved",
                "workflowState": "approved",
                "signatures": signatures,
                "preparedBySignature": prepared["name"],
                "preparedByDetails": prepared["people"],
                "verifiedBySignature": user["name"],
                "verifiedByDetails": {"name": user["name"], "employeeId": user.get("employeeId", ""), "userId": user.get("id", ""), "signature": user.get("signature") or ""},
                "verifiedAt": now,
                "verifiedBy": user["name"],
                "updatedAt": now,
                "updated_at": now,
            },
            {field: "" for field in LOCK_FIELDS},
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to verify entry")
        approved_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        return serialize_entry(approved_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/entries/{entry_id}/return")
async def return_entry(entry_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_return_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        lock_owner = build_lock_owner_metadata(existing_entry)
        updated = JBContactBlockMaintenanceDailyEntry.update_by_id(
            entry_id,
            {
                **existing_entry,
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
        returned_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        return serialize_entry(returned_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return entry: {str(e)}")


@jb_contact_block_maintenance_router.delete("/entries/by-id/{entry_id}")
async def delete_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        entry = JBContactBlockMaintenanceDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE)
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        if not JBContactBlockMaintenanceDailyEntry.delete_by_id(entry_id):
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/bulk/verify")
@jb_contact_block_maintenance_router.post("/bulk/approve", include_in_schema=False)
async def bulk_approve_entries(request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not is_reviewer_like(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can verify entries")

        entry_ids = request_data.get("entryIds") or request_data.get("entry_ids") or request_data.get("reportIds")
        if not isinstance(entry_ids, list) or not entry_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entryIds must be a non-empty list")

        result = create_bulk_result(len(entry_ids))
        approved_count = 0
        now = utc_timestamp()
        for raw_entry_id in entry_ids:
            item_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(item_id):
                add_bulk_failure(result, item_id, "Invalid ID")
                continue
            try:
                existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(item_id)
                if not existing_entry:
                    add_bulk_failure(result, item_id, "Not Found")
                    continue
                if not can_approve_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                signatures = normalize_signatures(existing_entry)
                prepared = derive_prepared_by(existing_entry)
                if not prepared["name"]:
                    add_bulk_failure(result, item_id, "Prepared By cannot be derived: no authenticated Checked By record")
                    continue
                signatures["preparedBy"] = prepared["name"]
                signatures["verifiedBy"] = user["name"]
                updated = JBContactBlockMaintenanceDailyEntry.update_by_id(
                    item_id,
                    {
                        **existing_entry,
                        "status": "approved",
                        "workflowState": "approved",
                        "signatures": signatures,
                        "preparedBySignature": prepared["name"],
                        "preparedByDetails": prepared["people"],
                        "verifiedBySignature": user["name"],
                        "verifiedByDetails": {"name": user["name"], "employeeId": user.get("employeeId", ""), "userId": user.get("id", ""), "signature": user.get("signature") or ""},
                        "verifiedAt": now,
                        "verifiedBy": user["name"],
                        "updatedAt": now,
                        "updated_at": now,
                    },
                    {field: "" for field in LOCK_FIELDS},
                )
                if not updated:
                    add_bulk_failure(result, item_id, "Update Failed")
                    continue
                approved_count += 1
            except Exception as item_error:
                add_bulk_failure(result, item_id, str(item_error))

        result["approved"] = approved_count
        result["processed"] = approved_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk verify entries: {str(e)}")


@jb_contact_block_maintenance_router.post("/bulk/delete")
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
            item_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(item_id):
                continue
            existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(item_id)
            if existing_entry and normalize_workflow_state(existing_entry) == "approved":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE)

        for raw_entry_id in entry_ids:
            item_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(item_id):
                add_bulk_failure(result, item_id, "Invalid ID")
                continue
            try:
                existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(item_id)
                if not existing_entry:
                    add_bulk_failure(result, item_id, "Not Found")
                    continue
                if not can_delete_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                if not JBContactBlockMaintenanceDailyEntry.delete_by_id(item_id):
                    add_bulk_failure(result, item_id, "Delete Failed")
                    continue
                deleted_count += 1
            except Exception as item_error:
                add_bulk_failure(result, item_id, str(item_error))

        result["deleted"] = deleted_count
        result["processed"] = deleted_count
        result["skippedCount"] = sum(result["skipped"].values())
        result["failedCount"] = len(result["failed"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete entries: {str(e)}")


@jb_contact_block_maintenance_router.post("/signatures")
async def update_signatures(payload: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        date = payload.get("date")
        raw_fab = payload.get("fab")
        if raw_fab not in FAB_OPTIONS:
            raise HTTPException(status_code=400, detail="FAB line context is required")
        fab = normalize_fab(raw_fab)
        signatures = payload.get("signatures", {})
        if not date:
            raise HTTPException(status_code=400, detail="Date is required")

        normalized_signatures = dict(JBContactBlockMaintenanceDailyEntry.get_daily_context_signatures(date, fab))
        if "preparedBy" in signatures:
            raise HTTPException(status_code=400, detail="Prepared By is system-managed from authenticated Checked By records")
        if signatures.get("verifiedBy") or signatures.get("reviewedBy"):
            raise HTTPException(status_code=400, detail="Verified By must be completed through the authenticated report verification workflow")
        success = JBContactBlockMaintenanceDailyEntry.update_daily_context_signatures(date, fab, normalized_signatures)
        if not success:
            date_obj = datetime.strptime(str(date).split("T")[0], "%Y-%m-%d")
            placeholder_entry = normalize_entry_payload({
                "date": date_obj.strftime("%Y-%m-%d"),
                "testingDate": date_obj.strftime("%Y-%m-%d"),
                "fab": fab,
                "lines": {},
                "signatures": normalized_signatures,
            })
            JBContactBlockMaintenanceDailyEntry.create(placeholder_entry)

        return {"success": True, "message": "Signatures updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")


@jb_contact_block_maintenance_router.delete("/entries/{date}/{fab}")
async def delete_entry(date: str, fab: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        entry = JBContactBlockMaintenanceDailyEntry.get_by_date_fab(date, fab)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE)
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = JBContactBlockMaintenanceDailyEntry.delete_by_date_fab(date, fab)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/export/excel")
async def export_monthly_excel(payload: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        entries = []
        if isinstance(payload, dict):
            if "data" in payload and isinstance(payload["data"], list):
                entries = payload["data"]
            elif "entries" in payload and isinstance(payload["entries"], list):
                entries = payload["entries"]
            else:
                for key in ["rows", "items", "entries", "data"]:
                    if key in payload and isinstance(payload[key], list):
                        entries = payload[key]
                        break
            form_data = payload.get("form_data") or payload.get("formData") or {}
            name = payload.get("name") or payload.get("filename") or payload.get("report_name") or "JB_Contact_Block_Maintenance_Report"
        elif isinstance(payload, list):
            entries = payload
            form_data = {}
            name = "JB_Contact_Block_Maintenance_Report"
        else:
            raise HTTPException(status_code=400, detail="Invalid payload for Excel export")

        authorized_entries = []
        for entry in entries:
            existing_entry = None
            if isinstance(entry, dict):
                entry_id = entry.get("_id") or entry.get("id")
                if entry_id and ObjectId.is_valid(str(entry_id)):
                    existing_entry = JBContactBlockMaintenanceDailyEntry.get_by_id(str(entry_id))
                if not existing_entry and entry.get("date"):
                    date_entries = JBContactBlockMaintenanceDailyEntry.get_all_for_date(entry.get("date"))
                    entry_po_summary = entry.get("poSummary") or get_po_summary(entry)
                    existing_entry = next(
                        (
                            candidate for candidate in date_entries
                            if normalize_fab(candidate.get("fab")) == normalize_fab(entry.get("fab"))
                            and (candidate.get("poSummary") or get_po_summary(candidate)) == entry_po_summary
                        ),
                        None,
                    )
            if not existing_entry or not can_export_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel can be generated only from submitted or verified entries")
            authorized_entries.append(existing_entry)

        if not authorized_entries:
            raise HTTPException(status_code=400, detail="No entries available for Excel export")

        report_payload = dict(payload or {}) if isinstance(payload, dict) else {}
        report_payload["entries"] = [serialize_doc(entry) for entry in authorized_entries]
        report_payload["form_data"] = get_export_form_data(authorized_entries, form_data)
        report_payload["name"] = name

        output, filename = generate_jb_contact_block_maintenance_report(report_payload)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("jb_contact_block_excel_generation_failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
