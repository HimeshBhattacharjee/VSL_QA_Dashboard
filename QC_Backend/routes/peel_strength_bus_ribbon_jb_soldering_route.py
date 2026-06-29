import calendar
from datetime import datetime
import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from generators.PeelStrengthBusRibbonJBSolderingReportGenerator import (
    generate_peel_strength_bus_ribbon_jb_soldering_report,
)
from models.peel_strength_bus_ribbon_jb_soldering_models import (
    PeelStrengthBusRibbonJBDailyEntry,
    normalize_fab,
)


peel_strength_bus_ribbon_jb_router = APIRouter(
    prefix="/api/peel-strength-bus-ribbon-jb-soldering-reports",
    tags=["Peel Strength Bus Ribbon JB Soldering Reports"],
)

SHIFT_OPTIONS = {"A", "B", "C"}
FAB_OPTIONS = {"FAB-II Line-I", "FAB-II Line-II"}
FAB_LINES = {
    "FAB-II Line-I": ("Line - 1", "Line - 2"),
    "FAB-II Line-II": ("Line - 3", "Line - 4"),
}
READING_FIELDS = ("plusVe1", "plusVe2", "middle1", "middle2", "minusVe1", "minusVe2")
TEXT_FIELDS = ("po", "jbStatus", "busRibbonStatus", "busRibbonDimension")
MIN_AVERAGE_N = 25
NUMERIC_ONLY_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")


def signature_key(date: str, fab: str, shift: str) -> str:
    return f"{date}_{normalize_fab(fab)}_{shift}"


def empty_line_data() -> dict:
    return {
        "po": "",
        "jbStatus": "",
        "busRibbonStatus": "",
        "busRibbonDimension": "",
        "plusVe1": None,
        "plusVe2": None,
        "middle1": None,
        "middle2": None,
        "minusVe1": None,
        "minusVe2": None,
        "average": None,
        "remarks": "",
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


def calculate_average(line_data: dict):
    numeric_values = []
    for field in READING_FIELDS:
        numeric_value = parse_numeric_only(line_data.get(field))
        if isinstance(numeric_value, (int, float)) and not isinstance(numeric_value, bool):
            numeric_values.append(float(numeric_value))
    if not numeric_values:
        return None
    average = round(sum(numeric_values) / len(numeric_values), 2)
    return int(average) if float(average).is_integer() else average


def calculate_remarks(average):
    if average is None:
        return ""
    return "OK" if float(average) >= MIN_AVERAGE_N else "NOT OK"


def normalize_line_payload(line_payload: dict, line_label: str) -> dict:
    line_payload = line_payload or {}
    normalized = empty_line_data()
    for field in TEXT_FIELDS:
        normalized[field] = str(line_payload.get(field) or "").strip()

    for field in READING_FIELDS:
        stored_value = to_stored_number(line_payload.get(field))
        if stored_value is not None and not isinstance(stored_value, (int, float)):
            raise HTTPException(status_code=400, detail=f"{line_label} {field} must be a valid number")
        normalized[field] = stored_value

    average = calculate_average(normalized)
    normalized["average"] = average
    normalized["remarks"] = calculate_remarks(average)
    return normalized


def normalize_entry_payload(entry: dict) -> dict:
    required_fields = ["date", "testingDate", "shift", "fab", "lines"]
    for field in required_fields:
        if field not in entry:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    if entry["shift"] not in SHIFT_OPTIONS:
        raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

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

    normalized_lines = {
        line_label: normalize_line_payload(raw_lines.get(line_label, {}), line_label)
        for line_label in FAB_LINES[fab]
    }

    return {
        **entry,
        "date": date_obj.strftime("%Y-%m-%d"),
        "testingDate": str(entry.get("testingDate") or date_obj.strftime("%Y-%m-%d")).split("T")[0],
        "fab": fab,
        "lines": normalized_lines,
        "signatures": entry.get("signatures") or {"preparedBy": "", "verifiedBy": ""},
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
        line_label: {**empty_line_data(), **(raw_lines.get(line_label, {}) or {})}
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


def has_line_data(line_data: dict) -> bool:
    if any(str(line_data.get(field) or "").strip() for field in TEXT_FIELDS):
        return True
    return any(line_data.get(field) not in (None, "") for field in READING_FIELDS)


def has_entry_data(entry: dict) -> bool:
    fab = normalize_fab(entry.get("fab"))
    lines = entry.get("lines") or {}
    return any(has_line_data(lines.get(line_label, {}) or {}) for line_label in FAB_LINES[fab])


@peel_strength_bus_ribbon_jb_router.get("/entries/monthly")
async def get_monthly_entries(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        entries = PeelStrengthBusRibbonJBDailyEntry.get_month_entries(year, month)
        grouped = {}
        date_signatures = {}
        for entry in entries:
            serialized = serialize_doc(entry)
            date = serialized.get("date")
            grouped.setdefault(date, []).append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("verifiedBy"):
                date_signatures[signature_key(date, serialized.get("fab"), serialized.get("shift"))] = signatures

        return {
            "success": True,
            "data": serialize_docs(entries),
            "grouped": grouped,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        return {"success": False, "data": [], "grouped": {}, "date_signatures": {}, "error": str(e)}


@peel_strength_bus_ribbon_jb_router.get("/entries/{date}")
async def get_entries_for_date(date: str):
    try:
        date_key = date.split("T")[0]
        entries = PeelStrengthBusRibbonJBDailyEntry.get_all_for_date(date_key)
        return {"success": True, "data": serialize_docs(entries)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@peel_strength_bus_ribbon_jb_router.get("/entries/{date}/{fab}/{shift}")
async def get_entry(date: str, fab: str, shift: str):
    try:
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = PeelStrengthBusRibbonJBDailyEntry.get_by_date_fab_shift(date, fab, shift)
        return serialize_doc(entry) if entry else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@peel_strength_bus_ribbon_jb_router.get("/stats/monthly")
async def get_monthly_stats(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        days_in_month = calendar.monthrange(year, month)[1]
        total_possible_entries = days_in_month * 3 * 2
        entries = PeelStrengthBusRibbonJBDailyEntry.get_month_entries(year, month)
        filled_entries = sum(1 for entry in entries if has_entry_data(entry))
        shift_stats = {
            "A": {"filled": 0},
            "B": {"filled": 0},
            "C": {"filled": 0},
        }
        for entry in entries:
            shift = entry.get("shift")
            if shift in shift_stats and has_entry_data(entry):
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


@peel_strength_bus_ribbon_jb_router.post("/entries")
async def create_entry(entry: dict):
    try:
        normalized_entry = normalize_entry_payload(entry)
        existing_signatures = PeelStrengthBusRibbonJBDailyEntry.get_context_signatures(
            normalized_entry["date"],
            normalized_entry["fab"],
            normalized_entry["shift"],
        )
        incoming_signatures = normalized_entry.get("signatures") or {}
        has_incoming_signature = bool(incoming_signatures.get("preparedBy") or incoming_signatures.get("verifiedBy"))
        if not has_incoming_signature:
            normalized_entry["signatures"] = existing_signatures or {"preparedBy": "", "verifiedBy": ""}
        else:
            normalized_entry["signatures"] = {
                "preparedBy": incoming_signatures.get("preparedBy", ""),
                "verifiedBy": incoming_signatures.get("verifiedBy") or incoming_signatures.get("reviewedBy", ""),
            }
        if "_id" in normalized_entry:
            del normalized_entry["_id"]

        PeelStrengthBusRibbonJBDailyEntry.create(normalized_entry)
        saved_entry = PeelStrengthBusRibbonJBDailyEntry.get_by_date_fab_shift(
            normalized_entry["date"],
            normalized_entry["fab"],
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


@peel_strength_bus_ribbon_jb_router.post("/signatures")
async def update_signatures(payload: dict):
    try:
        date = payload.get("date")
        fab = normalize_fab(payload.get("fab"))
        shift = payload.get("shift", "A")
        signatures = payload.get("signatures", {})

        if not date:
            raise HTTPException(status_code=400, detail="Date is required")
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

        success = PeelStrengthBusRibbonJBDailyEntry.update_context_signatures(date, fab, shift, signatures)
        if not success:
            date_obj = datetime.strptime(str(date).split("T")[0], "%Y-%m-%d")
            placeholder_entry = normalize_entry_payload({
                "date": date_obj.strftime("%Y-%m-%d"),
                "testingDate": date_obj.strftime("%Y-%m-%d"),
                "fab": fab,
                "shift": shift,
                "lines": {},
                "signatures": signatures,
            })
            PeelStrengthBusRibbonJBDailyEntry.create(placeholder_entry)

        return {"success": True, "message": "Signatures updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")


@peel_strength_bus_ribbon_jb_router.delete("/entries/{date}/{fab}/{shift}")
async def delete_entry(date: str, fab: str, shift: str):
    try:
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = PeelStrengthBusRibbonJBDailyEntry.get_by_date_fab_shift(date, fab, shift)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        deleted = PeelStrengthBusRibbonJBDailyEntry.delete_by_date_fab_shift(date, fab, shift)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@peel_strength_bus_ribbon_jb_router.post("/export/excel")
async def export_monthly_excel(payload: dict):
    try:
        output, filename = generate_peel_strength_bus_ribbon_jb_soldering_report(payload)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
