import re
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from models.rot_test_models import RoTDailyEntry, rot_entries_collection
from typing import List, Optional
from datetime import datetime
import io
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
import calendar
from report_context import apply_report_context
from services.dashboard_analytics_service import (
    build_dashboard_response,
    resolve_dashboard_date_range as resolve_analytics_dashboard_date_range,
)
from services.creator_resolution_service import (
    build_lock_owner_metadata,
    get_created_by_label as resolve_created_by_label,
    has_operator_signature,
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

rot_router = APIRouter(prefix="/api/rot-test-reports", tags=["RoT Test Reports"])

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
    "date", "reportDate", "fabLine", "fab", "lineGroup",
    "testingDate",
    "po",
    "moduleType",
    "moduleSerial",
    "jbSupplier",
    "sealantSupplier",
    "backsheetSupplier",
    "result",
    "testDoneBy",
    "remarks",
    "signatures",
    "preparedBySignature",
    "reviewedBySignature",
    "approvedBySignature",
    "year",
    "month",
}

REQUIRED_ENTRY_FIELDS = {
    "po": "P.O. Number",
    "moduleType": "Module Type",
    "moduleSerial": "Module Serial No.",
    "jbSupplier": "JB Supplier",
    "sealantSupplier": "Sealant Supplier",
    "backsheetSupplier": "Rear Glass/ Backsheet Supplier",
    "result": "Result",
    "testDoneBy": "Test Done By",
}

def _normalize_line_group(line_group):
    return 'Line-II' if str(line_group or '').endswith('Line-II') or str(line_group or '') == 'Line-II' else 'Line-I'

def serialize_doc(doc):
    """Helper function to convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    doc_copy = doc.copy()
    if "_id" in doc_copy:
        doc_copy["_id"] = str(doc_copy["_id"])
    # Normalize date fields to YYYY-MM-DD for consistent frontend consumption
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
    if doc_copy.get("lineGroup"):
        doc_copy["lineGroup"] = _normalize_line_group(doc_copy.get("lineGroup"))
    signatures = doc_copy.get("signatures")
    if not isinstance(signatures, dict):
        signatures = {}
    signatures.setdefault("preparedBy", doc_copy.get("preparedBySignature", ""))
    signatures.setdefault("reviewedBy", doc_copy.get("reviewedBySignature", ""))
    signatures.setdefault("approvedBy", doc_copy.get("approvedBySignature", ""))
    doc_copy["signatures"] = signatures
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
    """Helper function to convert list of MongoDB documents"""
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


def normalize_entry_payload(entry: dict) -> dict:
    try:
        entry = apply_report_context(entry)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="FAB line is required and must be FAB-II Line-I or FAB-II Line-II")
    date_key = str(entry.get("date") or entry.get("testingDate") or "").split("T")[0]
    if not date_key:
        raise HTTPException(status_code=400, detail="Missing required field: date")
    try:
        date_obj = datetime.strptime(date_key, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    for field, label in REQUIRED_ENTRY_FIELDS.items():
        if not str(entry.get(field) or "").strip():
            raise HTTPException(status_code=400, detail=f"Missing required field: {label}")

    result = str(entry.get("result") or "").strip()
    if result not in {"Pass", "Fail"}:
        raise HTTPException(status_code=400, detail="Result must be Pass or Fail")

    signatures = entry.get("signatures") if isinstance(entry.get("signatures"), dict) else {}
    normalized = {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "po": str(entry.get("po") or "").strip(),
        "moduleType": str(entry.get("moduleType") or "").strip(),
        "moduleSerial": str(entry.get("moduleSerial") or "").strip(),
        "jbSupplier": str(entry.get("jbSupplier") or "").strip(),
        "sealantSupplier": str(entry.get("sealantSupplier") or "").strip(),
        "backsheetSupplier": str(entry.get("backsheetSupplier") or "").strip(),
        "result": result,
        "testDoneBy": str(entry.get("testDoneBy") or "").strip(),
        "remarks": str(entry.get("remarks") or "").strip(),
        "signatures": {
            "preparedBy": str(signatures.get("preparedBy") or entry.get("preparedBySignature") or "").strip(),
            "reviewedBy": str(signatures.get("reviewedBy") or entry.get("reviewedBySignature") or "").strip(),
            "approvedBy": str(signatures.get("approvedBy") or entry.get("approvedBySignature") or "").strip(),
        },
        "year": date_obj.year,
        "month": date_obj.month,
    }
    normalized["preparedBySignature"] = normalized["signatures"]["preparedBy"]
    normalized["reviewedBySignature"] = normalized["signatures"]["reviewedBy"]
    normalized["approvedBySignature"] = normalized["signatures"]["approvedBy"]
    return normalized


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
            {"po": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
            {"fabLine": {"$regex": escaped_search, "$options": "i"}},
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
        if not form_data.get("reviewedBySignature") and signatures.get("reviewedBy"):
            form_data["reviewedBySignature"] = signatures.get("reviewedBy")
        if not form_data.get("approvedBySignature") and signatures.get("approvedBy"):
            form_data["approvedBySignature"] = signatures.get("approvedBy")
    return form_data

def _legacy_line_i_filter(date_key):
    return {"date": date_key, "lineGroup": {"$exists": False}}

def _entry_update_filter(entry):
    if entry.get("lineGroup") == "Line-I":
        legacy_entry = rot_entries_collection.find_one(_legacy_line_i_filter(entry["date"]))
        if legacy_entry:
            return {"_id": legacy_entry["_id"]} if "_id" in legacy_entry else {"date": entry["date"]}
    return {"date": entry["date"], "lineGroup": entry["lineGroup"]}


@rot_router.get("/dashboard")
async def get_rot_dashboard(
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
            collection=rot_entries_collection,
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch Robustness dashboard: {str(e)}")


@rot_router.get("/entries/register")
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
        total = rot_entries_collection.count_documents(query)
        entries = list(
            rot_entries_collection
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


@rot_router.get("/entries/by-id/{entry_id}")
async def get_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        entry = RoTDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_view_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this entry")
        return serialize_entry(entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@rot_router.get("/entries/by-date/{date}")
async def get_entries_by_date(date: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_optional_user(x_employee_id)
        entries = RoTDailyEntry.get_all_for_date(date)
        return {"success": True, "data": [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@rot_router.get("/entries/legacy/{legacy_key}")
async def get_legacy_entry(legacy_key: str, x_employee_id: str | None = Header(default=None)):
    user = get_current_user(x_employee_id)
    entry = RoTDailyEntry.get_by_id(legacy_key) if ObjectId.is_valid(legacy_key) else rot_entries_collection.find_one({"$or": [{"entryNumber": legacy_key}, {"entryNo": legacy_key}]})
    if not entry:
        raise HTTPException(status_code=404, detail="Legacy entry not found")
    if not can_view_entry(entry, user):
        raise HTTPException(status_code=403, detail="You are not authorized to open this entry")
    return {"legacy": True, "canonical": {"reportDate": entry.get("reportDate") or entry.get("date"), "fabLine": entry.get("fabLine")}, "entry": serialize_entry(entry, user, include_permissions=True)}

@rot_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    x_employee_id: str | None = Header(default=None),
):
    """Get all entries for a specific month - always returns 200 with empty array if no data"""
    try:
        user = get_optional_user(x_employee_id)
        entries = RoTDailyEntry.get_month_entries(year, month)
        serialized_entries = [serialize_entry(entry, user, include_permissions=bool(user)) for entry in entries]
        grouped = {}
        for entry in serialized_entries:
            grouped.setdefault(entry.get("date"), []).append(entry)
        
        # Always return a successful response with data array
        # Ensure date fields normalized in returned docs
        return {
            "success": True,
            "data": serialized_entries,
            "grouped": grouped,
        }
    except Exception as e:
        # Return empty data on error instead of throwing 500
        return {
            "success": False,
            "data": [],
            "grouped": {},
            "error": str(e)
        }

@rot_router.get("/entries/{date}")
async def get_entry(date: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date"""
    try:
        # Normalize incoming date param to YYYY-MM-DD (strip time if present)
        date_key = date.split('T')[0]
        user = get_optional_user(x_employee_id)
        entry = rot_entries_collection.find_one({"date": date_key, "lineGroup": "Line-I"}) or rot_entries_collection.find_one(_legacy_line_i_filter(date_key)) or rot_entries_collection.find_one({"date": date_key})
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@rot_router.get("/entries/{date}/{line_group}")
async def get_entry_by_line_group(date: str, line_group: str, x_employee_id: str | None = Header(default=None)):
    """Get a single entry by date and FAB-II line group."""
    try:
        date_key = date.split('T')[0]
        user = get_optional_user(x_employee_id)
        normalized_line_group = _normalize_line_group(line_group)
        entry = rot_entries_collection.find_one({"date": date_key, "lineGroup": normalized_line_group})
        if not entry and normalized_line_group == "Line-I":
            entry = rot_entries_collection.find_one(_legacy_line_i_filter(date_key))
        if entry:
            return serialize_entry(entry, user, include_permissions=bool(user))
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@rot_router.get("/stats/monthly")
async def get_monthly_stats(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get statistics for a specific month - always returns 200 with default stats if no data"""
    try:
        days_in_month = calendar.monthrange(year, month)[1]
        
        # Get all entries for the month
        entries = list(rot_entries_collection.find(
            {"year": year, "month": month}
        ))
        
        # Calculate stats. Each FAB-II line is an independent monthly entry.
        filled_days = len(entries)
        pass_count = sum(1 for e in entries if e.get("result") == "Pass")
        fail_count = sum(1 for e in entries if e.get("result") == "Fail")
        total_possible_entries = days_in_month * 2
        completion_rate = round((filled_days / total_possible_entries) * 100) if total_possible_entries > 0 else 0
        
        return {
            "success": True,
            "data": {
                "totalDays": total_possible_entries,
                "filledDays": filled_days,
                "completionRate": completion_rate,
                "passCount": pass_count,
                "failCount": fail_count
            }
        }
    except Exception as e:
        # Return default stats on error
        days_in_month = calendar.monthrange(year, month)[1]
        return {
            "success": False,
            "data": {
                "totalDays": days_in_month * 2,
                "filledDays": 0,
                "completionRate": 0,
                "passCount": 0,
                "failCount": 0
            },
            "error": str(e)
        }

@rot_router.post("/entries")
async def create_entry(entry: dict, x_employee_id: str | None = Header(default=None)):
    """Create or update a daily workflow entry."""
    try:
        user = get_current_user(x_employee_id)
        normalized_entry = normalize_entry_payload(entry)
        entry_id = str(entry.get("_id") or entry.get("id") or "").strip()
        existing_entry = RoTDailyEntry.get_by_id(entry_id) if entry_id and ObjectId.is_valid(entry_id) else None

        if existing_entry:
            if not can_edit_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this entry in its current workflow state")
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
            RoTDailyEntry.update_by_id(entry_id, update_data)
            saved_entry = RoTDailyEntry.get_by_id(entry_id)
        else:
            new_entry_id = RoTDailyEntry.create(update_data)
            saved_entry = RoTDailyEntry.get_by_id(new_entry_id)

        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {"entry": serialize_entry(saved_entry, user, include_permissions=True)},
        }
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A Robustness report already exists for this date and FAB line")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")


@rot_router.post("/entries/{entry_id}/submit")
async def submit_entry(entry_id: str, entry: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = RoTDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_submit_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit draft or returned entries")
        if not user.get("signature"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operator signature is required before submitting this report.")

        normalized_entry = normalize_entry_payload(entry or existing_entry)
        signatures = normalized_entry.get("signatures") or {}
        signatures["preparedBy"] = user["name"]
        normalized_entry["signatures"] = signatures
        normalized_entry["preparedBySignature"] = user["name"]
        if not has_operator_signature({"signatures": signatures}, (normalized_entry,)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operator signature is required before submitting this report.")

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
        updated = RoTDailyEntry.update_by_id(entry_id, update_data, {field: "" for field in LOCK_FIELDS})
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to submit entry")
        submitted_entry = RoTDailyEntry.get_by_id(entry_id)
        return serialize_entry(submitted_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit entry: {str(e)}")


@rot_router.post("/entries/{entry_id}/approve")
async def approve_entry(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = RoTDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_approve_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be approved")

        now = utc_timestamp()
        signatures = existing_entry.get("signatures") if isinstance(existing_entry.get("signatures"), dict) else {}
        signatures["approvedBy"] = user["name"]
        updated = RoTDailyEntry.update_by_id(
            entry_id,
            {
                **existing_entry,
                "status": "approved",
                "workflowState": "approved",
                "signatures": signatures,
                "approvedBySignature": user["name"],
                "approvedAt": now,
                "approvedBy": user["name"],
                "updatedAt": now,
                "updated_at": now,
            },
            {field: "" for field in LOCK_FIELDS},
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to approve entry")
        approved_entry = RoTDailyEntry.get_by_id(entry_id)
        return serialize_entry(approved_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve entry: {str(e)}")


@rot_router.post("/entries/{entry_id}/return")
async def return_entry(entry_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        existing_entry = RoTDailyEntry.get_by_id(entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if not can_return_entry(existing_entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted entries can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        lock_owner = build_lock_owner_metadata(existing_entry)
        updated = RoTDailyEntry.update_by_id(
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
        returned_entry = RoTDailyEntry.get_by_id(entry_id)
        return serialize_entry(returned_entry, user, include_permissions=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return entry: {str(e)}")


@rot_router.delete("/entries/by-id/{entry_id}")
async def delete_entry_by_id(entry_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_current_user(x_employee_id)
        if not ObjectId.is_valid(entry_id):
            raise HTTPException(status_code=400, detail="Invalid entry ID")
        entry = RoTDailyEntry.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        if normalize_workflow_state(entry) == "approved":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE)
        if not can_delete_entry(entry, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this entry")
        deleted = RoTDailyEntry.delete_by_id(entry_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@rot_router.post("/bulk/approve")
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
            item_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(item_id):
                add_bulk_failure(result, item_id, "Invalid ID")
                continue
            try:
                existing_entry = RoTDailyEntry.get_by_id(item_id)
                if not existing_entry:
                    add_bulk_failure(result, item_id, "Not Found")
                    continue
                if not can_approve_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                signatures = existing_entry.get("signatures") if isinstance(existing_entry.get("signatures"), dict) else {}
                signatures["approvedBy"] = user["name"]
                updated = RoTDailyEntry.update_by_id(
                    item_id,
                    {
                        **existing_entry,
                        "status": "approved",
                        "workflowState": "approved",
                        "signatures": signatures,
                        "approvedBySignature": user["name"],
                        "approvedAt": now,
                        "approvedBy": user["name"],
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
        raise HTTPException(status_code=500, detail=f"Failed to bulk approve entries: {str(e)}")


@rot_router.post("/bulk/delete")
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
            existing_entry = RoTDailyEntry.get_by_id(item_id)
            if existing_entry and normalize_workflow_state(existing_entry) == "approved":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=APPROVED_REPORT_DELETE_FORBIDDEN_MESSAGE)

        for raw_entry_id in entry_ids:
            item_id = str(raw_entry_id or "").strip()
            if not ObjectId.is_valid(item_id):
                add_bulk_failure(result, item_id, "Invalid ID")
                continue
            try:
                existing_entry = RoTDailyEntry.get_by_id(item_id)
                if not existing_entry:
                    add_bulk_failure(result, item_id, "Not Found")
                    continue
                if not can_delete_entry(existing_entry, user):
                    add_bulk_skip(result, get_bulk_status_label(existing_entry))
                    continue
                if not RoTDailyEntry.delete_by_id(item_id):
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

@rot_router.delete("/entries/{date}/{line_group}")
async def delete_entry_by_line_group(date: str, line_group: str):
    """Delete an entry by date and FAB-II line group."""
    try:
        # Normalize date param and get entry first to know year/month for stats
        date_key = str(date).split('T')[0]
        normalized_line_group = _normalize_line_group(line_group)
        entry = rot_entries_collection.find_one({"date": date_key, "lineGroup": normalized_line_group})
        delete_filter = {"date": date_key, "lineGroup": normalized_line_group}
        if not entry and normalized_line_group == "Line-I":
            delete_filter = _legacy_line_i_filter(date_key)
            entry = rot_entries_collection.find_one(delete_filter)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        year = entry.get("year")
        month = entry.get("month")
        
        # Delete the entry
        result = rot_entries_collection.delete_one(delete_filter)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Get updated stats for the month
        if year and month:
            entries = list(rot_entries_collection.find({"year": year, "month": month}))
            days_in_month = calendar.monthrange(year, month)[1]
            filled_days = len(entries)
            pass_count = sum(1 for e in entries if e.get("result") == "Pass")
            fail_count = sum(1 for e in entries if e.get("result") == "Fail")
            total_possible_entries = days_in_month * 2
            completion_rate = round((filled_days / total_possible_entries) * 100) if total_possible_entries > 0 else 0
            
            stats = {
                "totalDays": total_possible_entries,
                "filledDays": filled_days,
                "completionRate": completion_rate,
                "passCount": pass_count,
                "failCount": fail_count
            }
        else:
            # If we couldn't get year/month, return default stats for current month
            today = datetime.now()
            days_in_month = calendar.monthrange(today.year, today.month)[1]
            stats = {
                "totalDays": days_in_month * 2,
                "filledDays": 0,
                "completionRate": 0,
                "passCount": 0,
                "failCount": 0
            }
        
        return {
            "success": True,
            "message": "Entry deleted successfully",
            "data": {"stats": stats}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@rot_router.delete("/entries/{date}")
async def delete_entry(date: str):
    """Delete the Line-I entry by date for backward compatibility."""
    return await delete_entry_by_line_group(date, "Line-I")

@rot_router.get("/export/excel")
async def export_monthly_excel(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    filename: str = Query("RoT_Report", description="Export filename (without extension)")
):
    """Export monthly data as Excel file"""
    try:
        from generators.RoTReportGenerator import generate_rot_report

        # Get entries for the month from DB
        entries = list(rot_entries_collection.find(
            {"year": year, "month": month}
        ).sort("date", 1))

        # Prepare data for Excel generation
        report_data = {
            "form_data": {},
            "entries": serialize_docs(entries),
            "name": filename
        }

        output, out_filename = generate_rot_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")


@rot_router.post("/export/excel")
async def export_monthly_excel_post(payload: dict, x_employee_id: str | None = Header(default=None)):
    """Accept monthly JSON (or payload with entries) and return generated Excel in one step

    Payload can be:
    - The exact object returned by `/entries/monthly` (i.e. {"success": True, "data": [...]})
    - An object containing `entries` (list) and optional `form_data` and `name`/`filename`
    - A plain list of entries
    """
    try:
        from generators.RoTReportGenerator import generate_rot_report
        user = get_current_user(x_employee_id)

        # Determine entries list
        entries = []
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
            name = payload.get('name') or payload.get('filename') or payload.get('report_name') or 'RoT_Test_Report'
        elif isinstance(payload, list):
            entries = payload
            form_data = {}
            name = 'RoT_Test_Report'
        else:
            raise HTTPException(status_code=400, detail='Invalid payload for Excel export')

        authorized_entries = []
        for entry in entries:
            existing_entry = None
            if isinstance(entry, dict):
                entry_id = entry.get("_id") or entry.get("id")
                if entry_id and ObjectId.is_valid(str(entry_id)):
                    existing_entry = RoTDailyEntry.get_by_id(str(entry_id))
                if not existing_entry and entry.get("date"):
                    date_entries = RoTDailyEntry.get_all_for_date(entry.get("date"))
                    existing_entry = next(
                        (
                            candidate for candidate in date_entries
                            if candidate.get("po") == entry.get("po")
                            and candidate.get("moduleSerial") == entry.get("moduleSerial")
                            and candidate.get("moduleType") == entry.get("moduleType")
                        ),
                        None,
                    )
            if not existing_entry or not can_export_entry(existing_entry, user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel can be generated only from submitted or approved entries")
            authorized_entries.append(existing_entry)

        if not authorized_entries:
            raise HTTPException(status_code=400, detail="No entries available for Excel export")

        form_data = get_export_form_data(authorized_entries, form_data)

        # Ensure entries are JSON-serializable and dates normalized
        safe_entries = []
        for e in authorized_entries:
            safe_entries.append(serialize_doc(e) if isinstance(e, dict) else e)

        report_data = {
            'form_data': form_data,
            'entries': safe_entries,
            'name': name
        }

        output, out_filename = generate_rot_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel from payload: {str(e)}")
