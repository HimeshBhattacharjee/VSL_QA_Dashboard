from fastapi import APIRouter, HTTPException, Query
from models.peel_test_models import peel_test_collection, PeelTestReport
from bson import ObjectId
from typing import List, Optional
import json

peel_test_router = APIRouter(prefix="/api/peel/peel-test-reports", tags=["Peel Test Reports"])

@peel_test_router.get("/", response_model=List[dict])
async def get_all_peel_test_reports():
    """Get all peel test reports"""
    try:
        reports = list(peel_test_collection.find().sort("timestamp", -1))
        # Convert ObjectId to string and field names to frontend format
        converted_reports = []
        for report in reports:
            converted_report = {
                "_id": str(report["_id"]),
                "name": report["name"],
                "timestamp": report["timestamp"],
                "formData": report["form_data"],
                "rowData": report.get("row_data", []),
                "averages": report.get("averages", {})
            }
            converted_reports.append(converted_report)
        return converted_reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@peel_test_router.get("/{report_id}")
async def get_peel_test_report(report_id: str):
    """Get a specific peel test report by ID"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Convert to frontend format
        response_data = {
            "_id": str(report["_id"]),
            "name": report["name"],
            "timestamp": report["timestamp"],
            "formData": report["form_data"],
            "rowData": report.get("row_data", []),
            "averages": report.get("averages", {})
        }
        
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")

@peel_test_router.post("/")
async def create_peel_test_report(report_data: dict):
    """Create a new peel test report"""
    try:
        # Validate required fields
        required_fields = ["name", "timestamp", "formData"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Check if report with same name already exists
        existing_report = peel_test_collection.find_one({"name": report_data["name"]})
        if existing_report:
            raise HTTPException(status_code=409, detail="A report with this name already exists")
        
        # Convert to MongoDB format
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "form_data": report_data["formData"],
            "row_data": report_data.get("rowData", []),
            "averages": report_data.get("averages", {})
        }
        
        # Insert new report
        result = peel_test_collection.insert_one(mongo_data)
        
        # Return the created report with ID
        created_report = peel_test_collection.find_one({"_id": result.inserted_id})
        
        # Convert back to frontend format
        response_data = {
            "_id": str(created_report["_id"]),
            "name": created_report["name"],
            "timestamp": created_report["timestamp"],
            "formData": created_report["form_data"],
            "rowData": created_report.get("row_data", []),
            "averages": created_report.get("averages", {})
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")

@peel_test_router.put("/{report_id}")
async def update_peel_test_report(report_id: str, report_data: dict):
    """Update an existing peel test report"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        # Check if report exists
        existing_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Validate required fields
        required_fields = ["name", "timestamp", "formData"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Convert to MongoDB format
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "form_data": report_data["formData"],
            "row_data": report_data.get("rowData", []),
            "averages": report_data.get("averages", {})
        }
        
        # Update the report
        peel_test_collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": mongo_data}
        )
        
        # Return the updated report
        updated_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        
        # Convert back to frontend format
        response_data = {
            "_id": str(updated_report["_id"]),
            "name": updated_report["name"],
            "timestamp": updated_report["timestamp"],
            "formData": updated_report["form_data"],
            "rowData": updated_report.get("row_data", []),
            "averages": updated_report.get("averages", {})
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")

@peel_test_router.delete("/{report_id}")
async def delete_peel_test_report(report_id: str):
    """Delete a peel test report"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        # Check if report exists
        existing_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Delete the report
        result = peel_test_collection.delete_one({"_id": ObjectId(report_id)})
        
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete report")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

@peel_test_router.get("/name/{report_name}")
async def check_report_name_exists(
    report_name: str, 
    exclude_id: Optional[str] = Query(None, description="Exclude this report ID from check")
):
    """Check if a report name already exists"""
    try:
        query = {"name": report_name}
        
        # Exclude current report if provided
        if exclude_id and ObjectId.is_valid(exclude_id):
            query["_id"] = {"$ne": ObjectId(exclude_id)}
        
        existing_report = peel_test_collection.find_one(query)
        
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")