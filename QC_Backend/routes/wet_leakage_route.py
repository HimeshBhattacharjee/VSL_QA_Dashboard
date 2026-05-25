from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from models.wet_leakage_test_models import wet_leakage_entries_collection
from datetime import datetime
import calendar

wet_leakage_router = APIRouter(prefix="/api/wet-leakage-test-reports", tags=["Wet Leakage Test Reports"])

WET_LEAKAGE_PASS_THRESHOLD = 40

ENTRY_REQUIRED_FIELDS = [
    ("po", "P.O. Number"),
    ("moduleType", "Module Type"),
    ("moduleNo", "Module No."),
    ("cellSupplier", "Cell Supplier"),
    ("encapsulantSupplier", "Encapsulant Supplier"),
    ("rearGlassSupplier", "Rear Glass/ Backsheet Supplier"),
    ("jbSupplier", "JB Supplier"),
    ("adhesiveSealantSupplier", "Adhesive Sealant Supplier"),
    ("pottingSealantSupplier", "Potting Sealant Supplier"),
    ("waterTemp", "Water Temperature (°C)"),
    ("waterResistivity", "Water Resistivity (Ω-cm)"),
    ("IR", "IR (MΩ)"),
    ("testDoneBy", "Test Done By"),
]

def _normalize_line_group(line_group):
    return 'Line-II' if str(line_group or '').endswith('Line-II') or str(line_group or '') == 'Line-II' else 'Line-I'


def normalize_field_value(value):
    if value is None:
        return ""
    return str(value).strip()


def parse_ir_value(value):
    normalized = normalize_field_value(value)
    if not normalized:
        return None

    try:
        return float(normalized)
    except (TypeError, ValueError):
        return None


def derive_result_from_ir(ir_value):
    parsed = parse_ir_value(ir_value)
    if parsed is None:
        return ""
    return "Pass" if parsed > WET_LEAKAGE_PASS_THRESHOLD else "Fail"


def get_entry_result(entry):
    derived_result = derive_result_from_ir(entry.get("IR"))
    if derived_result:
        return derived_result

    stored_result = normalize_field_value(entry.get("result"))
    return stored_result if stored_result in {"Pass", "Fail"} else ""


def normalize_entry(entry):
    normalized_entry = entry.copy()
    normalized_entry["result"] = derive_result_from_ir(normalized_entry.get("IR"))
    return normalized_entry


def get_entry_validation_message(entry):
    required_details = [
        (label, normalize_field_value(entry.get(key)))
        for key, label in ENTRY_REQUIRED_FIELDS
    ]

    filled_details = [(label, value) for label, value in required_details if value != ""]

    if len(filled_details) == 0:
        return "Please fill the entry details before saving."

    if len(filled_details) != len(required_details):
        first_missing_detail = next((label for label, value in required_details if value == ""), None)
        return f"Please complete all entry fields before saving. Missing: {first_missing_detail}."

    if parse_ir_value(entry.get("IR")) is None:
        return "Please enter a valid numeric value for IR (MΩ)."

    return None


def build_default_monthly_stats(year, month):
    days_in_month = calendar.monthrange(year, month)[1]
    return {
        "totalDays": days_in_month * 2,
        "filledDays": 0,
        "completionRate": 0,
        "passCount": 0,
        "failCount": 0
    }


def build_monthly_stats(year, month):
    entries = list(wet_leakage_entries_collection.find({"year": year, "month": month}))
    days_in_month = calendar.monthrange(year, month)[1]
    filled_days = len(entries)
    pass_count = sum(1 for entry in entries if get_entry_result(entry) == "Pass")
    fail_count = sum(1 for entry in entries if get_entry_result(entry) == "Fail")
    total_possible_entries = days_in_month * 2
    completion_rate = round((filled_days / total_possible_entries) * 100) if total_possible_entries > 0 else 0

    return {
        "totalDays": total_possible_entries,
        "filledDays": filled_days,
        "completionRate": completion_rate,
        "passCount": pass_count,
        "failCount": fail_count
    }

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
    doc_copy["result"] = get_entry_result(doc_copy)
    doc_copy["lineGroup"] = _normalize_line_group(doc_copy.get("lineGroup"))
    return doc_copy

def serialize_docs(docs):
    """Helper function to convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

def _legacy_line_i_filter(date_key):
    return {"date": date_key, "lineGroup": {"$exists": False}}

def _entry_update_filter(entry):
    if entry.get("lineGroup") == "Line-I":
        legacy_entry = wet_leakage_entries_collection.find_one(_legacy_line_i_filter(entry["date"]))
        if legacy_entry:
            return {"_id": legacy_entry["_id"]} if "_id" in legacy_entry else {"date": entry["date"]}
    return {"date": entry["date"], "lineGroup": entry["lineGroup"]}

@wet_leakage_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get all entries for a specific month - always returns 200 with empty array if no data"""
    try:
        entries = list(wet_leakage_entries_collection.find(
            {"year": year, "month": month}
        ).sort("date", 1))
        
        # Always return a successful response with data array
        # Ensure date fields normalized in returned docs
        return {
            "success": True,
            "data": serialize_docs(entries)
        }
    except Exception as e:
        # Return empty data on error instead of throwing 500
        return {
            "success": False,
            "data": [],
            "error": str(e)
        }

@wet_leakage_router.get("/entries/{date}")
async def get_entry(date: str):
    """Get a single entry by date"""
    try:
        # Normalize incoming date param to YYYY-MM-DD (strip time if present)
        date_key = date.split('T')[0]
        entry = wet_leakage_entries_collection.find_one({"date": date_key, "lineGroup": "Line-I"}) or wet_leakage_entries_collection.find_one(_legacy_line_i_filter(date_key))
        if entry:
            return serialize_doc(entry)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@wet_leakage_router.get("/entries/{date}/{line_group}")
async def get_entry_by_line_group(date: str, line_group: str):
    """Get a single entry by date and FAB-II line group."""
    try:
        date_key = date.split('T')[0]
        normalized_line_group = _normalize_line_group(line_group)
        entry = wet_leakage_entries_collection.find_one({"date": date_key, "lineGroup": normalized_line_group})
        if not entry and normalized_line_group == "Line-I":
            entry = wet_leakage_entries_collection.find_one(_legacy_line_i_filter(date_key))
        if entry:
            return serialize_doc(entry)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@wet_leakage_router.get("/stats/monthly")
async def get_monthly_stats(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get statistics for a specific month - always returns 200 with default stats if no data"""
    try:
        return {
            "success": True,
            "data": build_monthly_stats(year, month)
        }
    except Exception as e:
        # Return default stats on error
        return {
            "success": False,
            "data": build_default_monthly_stats(year, month),
            "error": str(e)
        }

@wet_leakage_router.post("/entries")
async def create_entry(entry: dict):
    """Create or update a daily entry"""
    try:
        # Validate required fields
        required_fields = ["date"]
        for field in required_fields:
            if field not in entry or not entry[field]:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        validation_message = get_entry_validation_message(entry)
        if validation_message:
            raise HTTPException(status_code=400, detail=validation_message)
        
        # Normalize and extract year/month from date - accept full ISO strings too
        raw_date = entry.get("date")
        if not raw_date:
            raise HTTPException(status_code=400, detail="Missing required field: date")
        date_key = str(raw_date).split('T')[0]
        try:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
        except Exception:
            # Try fromisoformat fallback
            date_obj = datetime.fromisoformat(date_key)

        entry = normalize_entry(entry)
        entry["date"] = date_obj.strftime("%Y-%m-%d")
        entry["lineGroup"] = _normalize_line_group(entry.get("lineGroup"))
        # ensure testingDate matches normalized date
        entry["testingDate"] = entry.get("testingDate") and str(entry.get("testingDate")).split('T')[0] or entry["date"]
        entry["year"] = date_obj.year
        entry["month"] = date_obj.month
        entry["updated_at"] = datetime.now().isoformat()
        
        # Remove _id if present
        if "_id" in entry:
            del entry["_id"]
        
        # Upsert by date and FAB-II line group
        result = wet_leakage_entries_collection.update_one(
            _entry_update_filter(entry),
            {"$set": entry},
            upsert=True
        )
        
        # Get the saved entry
        saved_entry = wet_leakage_entries_collection.find_one({"date": entry["date"], "lineGroup": entry["lineGroup"]})
        stats = build_monthly_stats(date_obj.year, date_obj.month)
        
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_doc(saved_entry),
                "stats": stats
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@wet_leakage_router.delete("/entries/{date}/{line_group}")
async def delete_entry_by_line_group(date: str, line_group: str):
    """Delete an entry by date and FAB-II line group."""
    try:
        # Normalize date param and get entry first to know year/month for stats
        date_key = str(date).split('T')[0]
        normalized_line_group = _normalize_line_group(line_group)
        entry = wet_leakage_entries_collection.find_one({"date": date_key, "lineGroup": normalized_line_group})
        delete_filter = {"date": date_key, "lineGroup": normalized_line_group}
        if not entry and normalized_line_group == "Line-I":
            delete_filter = _legacy_line_i_filter(date_key)
            entry = wet_leakage_entries_collection.find_one(delete_filter)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        year = entry.get("year")
        month = entry.get("month")
        
        # Delete the entry
        result = wet_leakage_entries_collection.delete_one(delete_filter)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Get updated stats for the month
        if year and month:
            stats = build_monthly_stats(year, month)
        else:
            # If we couldn't get year/month, return default stats for current month
            today = datetime.now()
            stats = build_default_monthly_stats(today.year, today.month)
        
        return {
            "success": True,
            "message": "Entry deleted successfully",
            "data": {"stats": stats}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@wet_leakage_router.delete("/entries/{date}")
async def delete_entry(date: str):
    """Delete the Line-I entry by date for backward compatibility."""
    return await delete_entry_by_line_group(date, "Line-I")

@wet_leakage_router.get("/export/excel")
async def export_monthly_excel(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    filename: str = Query("Wet_Leakage_Report", description="Export filename (without extension)")
):
    """Export monthly data as Excel file"""
    try:
        from generators.WetLeakageReportGenerator import generate_wet_leakage_report

        # Get entries for the month from DB
        entries = list(wet_leakage_entries_collection.find(
            {"year": year, "month": month}
        ).sort("date", 1))

        # Prepare data for Excel generation
        report_data = {
            "form_data": {},
            "entries": serialize_docs(entries),
            "name": filename
        }

        output, out_filename = generate_wet_leakage_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")


@wet_leakage_router.post("/export/excel")
async def export_monthly_excel_post(payload: dict):
    """Accept monthly JSON (or payload with entries) and return generated Excel in one step

    Payload can be:
    - The exact object returned by `/entries/monthly` (i.e. {"success": True, "data": [...]})
    - An object containing `entries` (list) and optional `form_data` and `name`/`filename`
    - A plain list of entries
    """
    try:
        from generators.WetLeakageReportGenerator import generate_wet_leakage_report

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
            name = payload.get('name') or payload.get('filename') or payload.get('report_name') or 'Wet_Leakage_Test_Report'
        elif isinstance(payload, list):
            entries = payload
            form_data = {}
            name = 'Wet_Leakage_Test_Report'
        else:
            raise HTTPException(status_code=400, detail='Invalid payload for Excel export')

        # Ensure entries are JSON-serializable and dates normalized
        safe_entries = []
        for e in entries:
            safe_entries.append(serialize_doc(e) if isinstance(e, dict) else e)

        report_data = {
            'form_data': form_data,
            'entries': safe_entries,
            'name': name
        }

        output, out_filename = generate_wet_leakage_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel from payload: {str(e)}")
