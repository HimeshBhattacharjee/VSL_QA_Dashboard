import calendar
from datetime import datetime
import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from generators.JBContactBlockMaintenanceReportGenerator import generate_jb_contact_block_maintenance_report
from models.jb_contact_block_maintenance_models import (
    JBContactBlockMaintenanceDailyEntry,
    normalize_fab,
)


jb_contact_block_maintenance_router = APIRouter(
    prefix="/api/jb-contact-block-maintenance-reports",
    tags=["JB Contact Block Maintenance Reports"],
)

FAB_OPTIONS = {"FAB-II Line-I", "FAB-II Line-II"}
FAB_LINES = {
    "FAB-II Line-I": ("Line - 1", "Line - 2"),
    "FAB-II Line-II": ("Line - 3", "Line - 4"),
}
NUMERIC_FIELDS = ("sortValuePositive", "sortValueNegative", "springTension")
TEXT_FIELDS = ("po", "jbNo", "checkedBy")
NUMERIC_ONLY_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")


def empty_row() -> dict:
    return {
        "po": "",
        "jbNo": "",
        "sortValuePositive": None,
        "sortValueNegative": None,
        "springTension": None,
        "remarks": "",
        "checkedBy": "",
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

    signatures = entry.get("signatures") or {}
    return {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "fab": fab,
        "lines": normalized_lines,
        "signatures": {
            "preparedBy": signatures.get("preparedBy", ""),
            "verifiedBy": signatures.get("verifiedBy") or signatures.get("reviewedBy", ""),
        },
        "year": date_obj.year,
        "month": date_obj.month,
    }


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
    doc_copy["lines"] = {
        line_label: [
            {**empty_row(), **(row or {})}
            for row in (raw_lines.get(line_label) or [empty_row()])
        ]
        for line_label in FAB_LINES[fab]
    }
    signatures = doc_copy.get("signatures") or {}
    doc_copy["signatures"] = {
        "preparedBy": signatures.get("preparedBy", ""),
        "verifiedBy": signatures.get("verifiedBy") or signatures.get("reviewedBy", ""),
    }
    return doc_copy


def serialize_docs(docs):
    return [serialize_doc(doc) for doc in docs]


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


@jb_contact_block_maintenance_router.get("/entries/monthly")
async def get_monthly_entries(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        entries = JBContactBlockMaintenanceDailyEntry.get_month_entries(year, month)
        grouped = {}
        date_signatures = {}
        for entry in entries:
            serialized = serialize_doc(entry)
            date = serialized.get("date")
            grouped.setdefault(date, []).append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("verifiedBy"):
                date_signatures[date] = signatures

        return {
            "success": True,
            "data": serialize_docs(entries),
            "grouped": grouped,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        return {"success": False, "data": [], "grouped": {}, "date_signatures": {}, "error": str(e)}


@jb_contact_block_maintenance_router.get("/entries/{date}")
async def get_entries_for_date(date: str):
    try:
        date_key = date.split("T")[0]
        entries = JBContactBlockMaintenanceDailyEntry.get_all_for_date(date_key)
        return {
            "success": True,
            "data": serialize_docs(entries),
            "date_signatures": JBContactBlockMaintenanceDailyEntry.get_date_signatures(date_key),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@jb_contact_block_maintenance_router.get("/entries/{date}/{fab}")
async def get_entry(date: str, fab: str):
    try:
        entry = JBContactBlockMaintenanceDailyEntry.get_by_date_fab(date, fab)
        return serialize_doc(entry) if entry else None
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
async def create_entry(entry: dict):
    try:
        normalized_entry = normalize_entry_payload(entry)
        existing_signatures = JBContactBlockMaintenanceDailyEntry.get_date_signatures(normalized_entry["date"])
        incoming_signatures = normalized_entry.get("signatures") or {}
        if not (incoming_signatures.get("preparedBy") or incoming_signatures.get("verifiedBy")):
            normalized_entry["signatures"] = existing_signatures or {"preparedBy": "", "verifiedBy": ""}
        if "_id" in normalized_entry:
            del normalized_entry["_id"]

        JBContactBlockMaintenanceDailyEntry.create(normalized_entry)
        if normalized_entry.get("signatures"):
            JBContactBlockMaintenanceDailyEntry.update_date_signatures(
                normalized_entry["date"],
                normalized_entry["signatures"],
            )
        saved_entry = JBContactBlockMaintenanceDailyEntry.get_by_date_fab(
            normalized_entry["date"],
            normalized_entry["fab"],
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


@jb_contact_block_maintenance_router.post("/signatures")
async def update_signatures(payload: dict):
    try:
        date = payload.get("date")
        fab = normalize_fab(payload.get("fab"))
        signatures = payload.get("signatures", {})
        if not date:
            raise HTTPException(status_code=400, detail="Date is required")

        normalized_signatures = {
            "preparedBy": signatures.get("preparedBy", ""),
            "verifiedBy": signatures.get("verifiedBy") or signatures.get("reviewedBy", ""),
        }
        success = JBContactBlockMaintenanceDailyEntry.update_date_signatures(date, normalized_signatures)
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
async def delete_entry(date: str, fab: str):
    try:
        entry = JBContactBlockMaintenanceDailyEntry.get_by_date_fab(date, fab)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        deleted = JBContactBlockMaintenanceDailyEntry.delete_by_date_fab(date, fab)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@jb_contact_block_maintenance_router.post("/export/excel")
async def export_monthly_excel(payload: dict):
    try:
        output, filename = generate_jb_contact_block_maintenance_report(payload)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
