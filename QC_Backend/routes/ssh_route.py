from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from models.ssh_test_models import SSHDailyEntry
from datetime import datetime
import calendar

ssh_router = APIRouter(prefix="/api/ssh-test-reports", tags=["SSH Test Reports"])

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

@ssh_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get all entries for a specific month - always returns 200 with empty array if no data"""
    try:
        entries = SSHDailyEntry.get_month_entries(year, month)
        
        # Group entries by date for easier frontend consumption
        entries_by_date = {}
        for entry in entries:
            date = entry.get("date")
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(serialize_doc(entry))
        
        return {
            "success": True,
            "data": serialize_docs(entries),
            "grouped": entries_by_date
        }
    except Exception as e:
        # Return empty data on error instead of throwing 500
        return {
            "success": False,
            "data": [],
            "grouped": {},
            "error": str(e)
        }

@ssh_router.get("/entries/{date}")
async def get_entries_for_date(date: str):
    """Get all shift entries for a specific date"""
    try:
        date_key = date.split('T')[0]
        entries = SSHDailyEntry.get_all_for_date(date_key)
        return {
            "success": True,
            "data": serialize_docs(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entries: {str(e)}")

@ssh_router.get("/entries/{date}/{shift}")
async def get_entry(date: str, shift: str):
    """Get a single entry by date and shift"""
    try:
        # Validate shift
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        date_key = date.split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift)
        if entry:
            return serialize_doc(entry)
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
    """Get statistics for a specific month - always returns 200 with default stats if no data"""
    try:
        days_in_month = calendar.monthrange(year, month)[1]
        
        # Get all entries for the month
        entries = SSHDailyEntry.get_month_entries(year, month)
        
        # Calculate stats (each shift counts as a separate entry)
        total_possible_entries = days_in_month * 3  # 3 shifts per day
        filled_entries = len(entries)
        pass_count = sum(1 for e in entries if e.get("result") == "Pass")
        fail_count = sum(1 for e in entries if e.get("result") == "Fail")
        
        # Calculate completion rate based on possible entries (3 per day)
        completion_rate = round((filled_entries / total_possible_entries) * 100) if total_possible_entries > 0 else 0
        
        # Also calculate per-shift stats
        shift_stats = {
            "A": {"filled": 0, "pass": 0, "fail": 0},
            "B": {"filled": 0, "pass": 0, "fail": 0},
            "C": {"filled": 0, "pass": 0, "fail": 0}
        }
        
        for entry in entries:
            shift = entry.get("shift")
            result = entry.get("result")
            if shift in shift_stats:
                shift_stats[shift]["filled"] += 1
                if result == "Pass":
                    shift_stats[shift]["pass"] += 1
                elif result == "Fail":
                    shift_stats[shift]["fail"] += 1
        
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
        # Return default stats on error
        days_in_month = calendar.monthrange(year, month)[1]
        return {
            "success": False,
            "data": {
                "totalDays": days_in_month,
                "totalPossibleEntries": days_in_month * 3,
                "filledEntries": 0,
                "completionRate": 0,
                "passCount": 0,
                "failCount": 0,
                "shiftStats": {
                    "A": {"filled": 0, "pass": 0, "fail": 0},
                    "B": {"filled": 0, "pass": 0, "fail": 0},
                    "C": {"filled": 0, "pass": 0, "fail": 0}
                }
            },
            "error": str(e)
        }

@ssh_router.post("/entries")
async def create_entry(entry: dict):
    """Create or update a daily entry for a specific shift"""
    try:
        # Validate required fields
        required_fields = ["date", "testingDate", "moduleType", "result", "shift"]
        for field in required_fields:
            if field not in entry or not entry[field]:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate shift value
        if entry["shift"] not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        
        # Normalize and extract year/month from date
        raw_date = entry.get("date")
        if not raw_date:
            raise HTTPException(status_code=400, detail="Missing required field: date")
        date_key = str(raw_date).split('T')[0]
        try:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
        except Exception:
            # Try fromisoformat fallback
            date_obj = datetime.fromisoformat(date_key)

        entry["date"] = date_obj.strftime("%Y-%m-%d")
        # ensure testingDate matches normalized date
        entry["testingDate"] = entry.get("testingDate") and str(entry.get("testingDate")).split('T')[0] or entry["date"]
        entry["year"] = date_obj.year
        entry["month"] = date_obj.month
        entry["updated_at"] = datetime.now().isoformat()
        
        # Remove _id if present
        if "_id" in entry:
            del entry["_id"]
        
        # Use the model's create method which handles upsert by date and shift
        SSHDailyEntry.create(entry)
        
        # Get the saved entry
        saved_entry = SSHDailyEntry.get_by_date_and_shift(entry["date"], entry["shift"])
        
        # Get updated stats for the month
        entries = SSHDailyEntry.get_month_entries(date_obj.year, date_obj.month)
        days_in_month = calendar.monthrange(date_obj.year, date_obj.month)[1]
        total_possible_entries = days_in_month * 3
        filled_entries = len(entries)
        pass_count = sum(1 for e in entries if e.get("result") == "Pass")
        fail_count = sum(1 for e in entries if e.get("result") == "Fail")
        completion_rate = round((filled_entries / total_possible_entries) * 100) if total_possible_entries > 0 else 0
        
        # Calculate per-shift stats
        shift_stats = {
            "A": {"filled": 0, "pass": 0, "fail": 0},
            "B": {"filled": 0, "pass": 0, "fail": 0},
            "C": {"filled": 0, "pass": 0, "fail": 0}
        }
        
        for e in entries:
            shift = e.get("shift")
            result = e.get("result")
            if shift in shift_stats:
                shift_stats[shift]["filled"] += 1
                if result == "Pass":
                    shift_stats[shift]["pass"] += 1
                elif result == "Fail":
                    shift_stats[shift]["fail"] += 1
        
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_doc(saved_entry),
                "stats": {
                    "totalDays": days_in_month,
                    "totalPossibleEntries": total_possible_entries,
                    "filledEntries": filled_entries,
                    "completionRate": completion_rate,
                    "passCount": pass_count,
                    "failCount": fail_count,
                    "shiftStats": shift_stats
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@ssh_router.delete("/entries/{date}/{shift}")
async def delete_entry(date: str, shift: str):
    """Delete an entry by date and shift"""
    try:
        # Validate shift
        if shift not in ["A", "B", "C"]:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            
        # Normalize date param and get entry first to know year/month for stats
        date_key = str(date).split('T')[0]
        entry = SSHDailyEntry.get_by_date_and_shift(date_key, shift)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        year = entry.get("year")
        month = entry.get("month")
        
        # Delete the entry
        deleted = SSHDailyEntry.delete_by_date_and_shift(date_key, shift)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Get updated stats for the month
        if year and month:
            entries = SSHDailyEntry.get_month_entries(year, month)
            days_in_month = calendar.monthrange(year, month)[1]
            total_possible_entries = days_in_month * 3
            filled_entries = len(entries)
            pass_count = sum(1 for e in entries if e.get("result") == "Pass")
            fail_count = sum(1 for e in entries if e.get("result") == "Fail")
            completion_rate = round((filled_entries / total_possible_entries) * 100) if total_possible_entries > 0 else 0
            
            # Calculate per-shift stats
            shift_stats = {
                "A": {"filled": 0, "pass": 0, "fail": 0},
                "B": {"filled": 0, "pass": 0, "fail": 0},
                "C": {"filled": 0, "pass": 0, "fail": 0}
            }
            
            for e in entries:
                s = e.get("shift")
                result = e.get("result")
                if s in shift_stats:
                    shift_stats[s]["filled"] += 1
                    if result == "Pass":
                        shift_stats[s]["pass"] += 1
                    elif result == "Fail":
                        shift_stats[s]["fail"] += 1
            
            stats = {
                "totalDays": days_in_month,
                "totalPossibleEntries": total_possible_entries,
                "filledEntries": filled_entries,
                "completionRate": completion_rate,
                "passCount": pass_count,
                "failCount": fail_count,
                "shiftStats": shift_stats
            }
        else:
            # If we couldn't get year/month, return default stats for current month
            today = datetime.now()
            days_in_month = calendar.monthrange(today.year, today.month)[1]
            stats = {
                "totalDays": days_in_month,
                "totalPossibleEntries": days_in_month * 3,
                "filledEntries": 0,
                "completionRate": 0,
                "passCount": 0,
                "failCount": 0,
                "shiftStats": {
                    "A": {"filled": 0, "pass": 0, "fail": 0},
                    "B": {"filled": 0, "pass": 0, "fail": 0},
                    "C": {"filled": 0, "pass": 0, "fail": 0}
                }
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
async def export_monthly_excel_post(payload: dict):
    """Accept monthly JSON (or payload with entries) and return generated Excel in one step

    Payload can be:
    - The exact object returned by `/entries/monthly` (i.e. {"success": True, "data": [...]})
    - An object containing `entries` (list) and optional `form_data` and `name`/`filename`
    - A plain list of entries
    """
    try:
        from generators.SSHReportGenerator import generate_ssh_report

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
            'month': month
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