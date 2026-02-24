from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from models.rot_test_models import RoTDailyEntry, rot_entries_collection
from typing import List, Optional
from datetime import datetime
import io
from bson import ObjectId
import calendar

rot_router = APIRouter(prefix="/api/rot-test-reports", tags=["RoT Test Reports"])

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
    return doc_copy

def serialize_docs(docs):
    """Helper function to convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

@rot_router.get("/entries/monthly")
async def get_monthly_entries(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12)
):
    """Get all entries for a specific month - always returns 200 with empty array if no data"""
    try:
        entries = list(rot_entries_collection.find(
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

@rot_router.get("/entries/{date}")
async def get_entry(date: str):
    """Get a single entry by date"""
    try:
        # Normalize incoming date param to YYYY-MM-DD (strip time if present)
        date_key = date.split('T')[0]
        entry = rot_entries_collection.find_one({"date": date_key})
        if entry:
            return serialize_doc(entry)
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
        
        # Calculate stats
        filled_days = len(entries)
        pass_count = sum(1 for e in entries if e.get("result") == "Pass")
        fail_count = sum(1 for e in entries if e.get("result") == "Fail")
        completion_rate = round((filled_days / days_in_month) * 100) if days_in_month > 0 else 0
        
        return {
            "success": True,
            "data": {
                "totalDays": days_in_month,
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
                "totalDays": days_in_month,
                "filledDays": 0,
                "completionRate": 0,
                "passCount": 0,
                "failCount": 0
            },
            "error": str(e)
        }

@rot_router.post("/entries")
async def create_entry(entry: dict):
    """Create or update a daily entry"""
    try:
        # Validate required fields
        required_fields = ["date", "testingDate", "moduleType", "result"]
        for field in required_fields:
            if field not in entry or not entry[field]:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
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

        entry["date"] = date_obj.strftime("%Y-%m-%d")
        # ensure testingDate matches normalized date
        entry["testingDate"] = entry.get("testingDate") and str(entry.get("testingDate")).split('T')[0] or entry["date"]
        entry["year"] = date_obj.year
        entry["month"] = date_obj.month
        entry["updated_at"] = datetime.now().isoformat()
        
        # Remove _id if present
        if "_id" in entry:
            del entry["_id"]
        
        # Upsert by date
        result = rot_entries_collection.update_one(
            {"date": entry["date"]},
            {"$set": entry},
            upsert=True
        )
        
        # Get the saved entry
        saved_entry = rot_entries_collection.find_one({"date": entry["date"]})
        
        # Get updated stats for the month
        entries = list(rot_entries_collection.find(
            {"year": date_obj.year, "month": date_obj.month}
        ))
        days_in_month = calendar.monthrange(date_obj.year, date_obj.month)[1]
        filled_days = len(entries)
        pass_count = sum(1 for e in entries if e.get("result") == "Pass")
        fail_count = sum(1 for e in entries if e.get("result") == "Fail")
        completion_rate = round((filled_days / days_in_month) * 100) if days_in_month > 0 else 0
        
        return {
            "success": True,
            "message": "Entry saved successfully",
            "data": {
                "entry": serialize_doc(saved_entry),
                "stats": {
                    "totalDays": days_in_month,
                    "filledDays": filled_days,
                    "completionRate": completion_rate,
                    "passCount": pass_count,
                    "failCount": fail_count
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")

@rot_router.delete("/entries/{date}")
async def delete_entry(date: str):
    """Delete an entry by date"""
    try:
        # Normalize date param and get entry first to know year/month for stats
        date_key = str(date).split('T')[0]
        entry = rot_entries_collection.find_one({"date": date_key})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        year = entry.get("year")
        month = entry.get("month")
        
        # Delete the entry
        result = rot_entries_collection.delete_one({"date": date_key})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Get updated stats for the month
        if year and month:
            entries = list(rot_entries_collection.find({"year": year, "month": month}))
            days_in_month = calendar.monthrange(year, month)[1]
            filled_days = len(entries)
            pass_count = sum(1 for e in entries if e.get("result") == "Pass")
            fail_count = sum(1 for e in entries if e.get("result") == "Fail")
            completion_rate = round((filled_days / days_in_month) * 100) if days_in_month > 0 else 0
            
            stats = {
                "totalDays": days_in_month,
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
                "totalDays": days_in_month,
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
async def export_monthly_excel_post(payload: dict):
    """Accept monthly JSON (or payload with entries) and return generated Excel in one step

    Payload can be:
    - The exact object returned by `/entries/monthly` (i.e. {"success": True, "data": [...]})
    - An object containing `entries` (list) and optional `form_data` and `name`/`filename`
    - A plain list of entries
    """
    try:
        from generators.RoTReportGenerator import generate_rot_report

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

        # Ensure entries are JSON-serializable and dates normalized
        safe_entries = []
        for e in entries:
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