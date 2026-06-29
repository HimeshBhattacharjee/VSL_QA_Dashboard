import calendar
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from generators.BusRibbonPullStrengthReportGenerator import generate_bus_ribbon_pull_strength_report
from models.bus_ribbon_pull_strength_models import BusRibbonPullStrengthDailyEntry, normalize_line
from services.pull_strength_lookup_service import PullStrengthLookupService


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
    return doc_copy


def serialize_docs(docs):
    return [serialize_doc(doc) for doc in docs]


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


def has_strength_data(entry: dict) -> bool:
    for machine in (entry.get("bussingData") or {}).values():
        if any(str(value).strip() for value in machine.get("strengths", [])):
            return True
    return False


@bus_ribbon_pull_strength_router.get("/entries/monthly")
async def get_monthly_entries(year: int = Query(...), month: int = Query(..., ge=1, le=12)):
    try:
        entries = BusRibbonPullStrengthDailyEntry.get_month_entries(year, month)
        grouped = {}
        date_signatures = {}
        for entry in entries:
            serialized = serialize_doc(entry)
            date = serialized.get("date")
            grouped.setdefault(date, []).append(serialized)
            signatures = serialized.get("signatures") or {}
            if signatures.get("preparedBy") or signatures.get("reviewedBy"):
                date_signatures[signature_key(date, serialized.get("line"), serialized.get("shift"))] = signatures

        return {
            "success": True,
            "data": serialize_docs(entries),
            "grouped": grouped,
            "date_signatures": date_signatures,
        }
    except Exception as e:
        return {"success": False, "data": [], "grouped": {}, "date_signatures": {}, "error": str(e)}


@bus_ribbon_pull_strength_router.get("/entries/{date}")
async def get_entries_for_date(date: str):
    try:
        date_key = date.split("T")[0]
        entries = BusRibbonPullStrengthDailyEntry.get_all_for_date(date_key)
        return {"success": True, "data": serialize_docs(entries)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")


@bus_ribbon_pull_strength_router.get("/entries/{date}/{line}/{shift}")
async def get_entry(date: str, line: str, shift: str):
    try:
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        return serialize_doc(entry) if entry else None
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
async def create_entry(entry: dict):
    try:
        normalized_entry = normalize_entry_payload(entry)
        existing_signatures = BusRibbonPullStrengthDailyEntry.get_context_signatures(
            normalized_entry["date"],
            normalized_entry["line"],
            normalized_entry["shift"],
        )
        if not normalized_entry.get("signatures") or not normalized_entry["signatures"].get("preparedBy"):
            normalized_entry["signatures"] = existing_signatures or {"preparedBy": "", "reviewedBy": ""}
        if "_id" in normalized_entry:
            del normalized_entry["_id"]

        BusRibbonPullStrengthDailyEntry.create(normalized_entry)
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


@bus_ribbon_pull_strength_router.post("/signatures")
async def update_signatures(payload: dict):
    try:
        date = payload.get("date")
        line = normalize_line(payload.get("line"))
        shift = payload.get("shift", "A")
        signatures = payload.get("signatures", {})

        if not date:
            raise HTTPException(status_code=400, detail="Date is required")
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")

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
            BusRibbonPullStrengthDailyEntry.create(placeholder_entry)

        return {"success": True, "message": "Signatures updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")


@bus_ribbon_pull_strength_router.delete("/entries/{date}/{line}/{shift}")
async def delete_entry(date: str, line: str, shift: str):
    try:
        if shift not in SHIFT_OPTIONS:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        deleted = BusRibbonPullStrengthDailyEntry.delete_by_date_line_shift(date, line, shift)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@bus_ribbon_pull_strength_router.post("/export/excel")
async def export_monthly_excel(payload: dict):
    try:
        output, filename = generate_bus_ribbon_pull_strength_report(payload)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
