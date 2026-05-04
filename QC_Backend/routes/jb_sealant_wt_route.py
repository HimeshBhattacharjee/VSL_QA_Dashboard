from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from models.jb_sealant_wt_models import JBSealantDailyEntry
from datetime import datetime
import calendar
from generators.JBSealantWeightReportGenerator import generate_jb_sealant_report

jb_sealant_router = APIRouter(prefix="/api/jb-sealant-weight-reports", tags=["JB Sealant Weight Reports"])

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
    return any(value for _, value in _get_line_required_details(line))

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
    
    # Ensure all JB position fields exist
    if "lines" in doc_copy:
        for line_num in ["1", "2"]:
            if line_num in doc_copy["lines"]:
                line = doc_copy["lines"][line_num]
                if "positiveJB" not in line:
                    line["positiveJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
                if "middleJB" not in line:
                    line["middleJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
                if "negativeJB" not in line:
                    line["negativeJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
    
    return doc_copy

def serialize_docs(docs):
    """Helper function to convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

@jb_sealant_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get all entries for a specific month"""
    try:
        entries = JBSealantDailyEntry.get_month_entries(year, month)
        
        # Group entries by date for easier frontend consumption
        entries_by_date = {}
        date_signatures = {}
        
        for entry in entries:
            date = entry.get("date")
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(serialize_doc(entry))
            
            # Collect signatures (all shifts on same date should have same signatures)
            if entry.get("signatures") and (entry["signatures"].get("preparedBy") or entry["signatures"].get("verifiedBy")):
                date_signatures[_signature_key(date, entry.get("lineGroup"), entry.get("shift"))] = entry["signatures"]
        
        return {
            "success": True,
            "data": serialize_docs(entries),
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
async def get_entries_for_date(date: str):
    """Get all shift entries for a specific date"""
    try:
        date_key = date.split('T')[0]
        entries = JBSealantDailyEntry.get_all_for_date(date_key)
        date_signatures = JBSealantDailyEntry.get_context_signatures(date_key, "Line-I", "A")
        return {
            "success": True,
            "data": serialize_docs(entries),
            "date_signatures": date_signatures
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")

@jb_sealant_router.get("/entries/{date}/{line_group}/{shift}")
async def get_entry_by_line_group(date: str, line_group: str, shift: str):
    """Get a single entry by date, line group, and shift."""
    try:
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = date.split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if entry:
            return serialize_doc(entry)
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")

@jb_sealant_router.get("/entries/{date}/{shift}")
async def get_entry(date: str, shift: str):
    """Get a single entry by date and shift"""
    try:
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = date.split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if entry:
            return serialize_doc(entry)
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
async def create_entry(entry: dict):
    """Create or update a daily entry for a specific shift with two lines"""
    try:
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

@jb_sealant_router.post("/signatures")
async def update_signatures(payload: dict):
    """Update signatures for a specific date (applies to all shifts on that date)"""
    try:
        date = payload.get("date")
        signatures = payload.get("signatures", {})
        line_group = _normalize_line_group(payload.get("lineGroup"))
        shift = payload.get("shift", "A")
        
        if not date:
            raise HTTPException(status_code=400, detail="Date is required")
        
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
            JBSealantDailyEntry.create(placeholder_entry)
        
        return {
            "success": True,
            "message": "Signatures updated successfully for all shifts on this date"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update signatures: {str(e)}")

@jb_sealant_router.delete("/entries/{date}/{line_group}/{shift}")
async def delete_entry_by_line_group(date: str, line_group: str, shift: str):
    """Delete an entry by date, line group, and shift."""
    try:
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        date_key = str(date).split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, line_group)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        deleted = JBSealantDailyEntry.delete_by_date_and_shift(date_key, shift, line_group)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

@jb_sealant_router.delete("/entries/{date}/{shift}")
async def delete_entry(date: str, shift: str):
    """Delete an entry by date and shift"""
    try:
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = str(date).split('T')[0]
        entry = JBSealantDailyEntry.get_by_date_and_shift(date_key, shift, "Line-I")
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
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
async def export_monthly_excel_post(payload: dict):
    """Generate Excel with multiple sheets - one sheet per day of the month"""
    try:
        output, filename = generate_jb_sealant_report(payload)
        
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except Exception as e:
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
