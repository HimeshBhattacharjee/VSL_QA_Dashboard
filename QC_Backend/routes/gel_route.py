from fastapi import APIRouter, HTTPException, Query
from models.gel_test_models import gel_test_collection, GelTestReport
from bson import ObjectId
from typing import List, Optional
import json

gel_router = APIRouter(prefix="/api/gel-test-reports", tags=["Gel Test Reports"])

@gel_router.get("/", response_model=List[dict])
async def get_all_gel_test_reports():
    """Get all gel test reports"""
    try:
        reports = list(gel_test_collection.find().sort("timestamp", -1))
        # Convert ObjectId to string and field names to frontend format
        converted_reports = []
        for report in reports:
            converted_report = {
                "_id": str(report["_id"]),
                "name": report["name"],
                "timestamp": report["timestamp"],
                "formData": report["form_data"],  # Convert form_data to formData
                "averages": report["averages"]
            }
            converted_reports.append(converted_report)
        return converted_reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@gel_router.get("/{report_id}")
async def get_gel_test_report(report_id: str):
    """Get a specific gel test report by ID"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Convert to frontend format
        response_data = {
            "_id": str(report["_id"]),
            "name": report["name"],
            "timestamp": report["timestamp"],
            "formData": report["form_data"],  # Convert form_data to formData
            "averages": report["averages"]
        }
        
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")

@gel_router.post("/")
async def create_gel_test_report(report_data: dict):
    """Create a new gel test report"""
    try:
        # Validate required fields
        required_fields = ["name", "timestamp", "formData", "averages"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Check if report with same name already exists
        existing_report = gel_test_collection.find_one({"name": report_data["name"]})
        if existing_report:
            raise HTTPException(status_code=409, detail="A report with this name already exists")
        
        # Convert formData to form_data for MongoDB (or keep as formData)
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "form_data": report_data["formData"],  # Convert formData to form_data
            "averages": report_data["averages"]
        }
        
        # Insert new report
        result = gel_test_collection.insert_one(mongo_data)
        
        # Return the created report with ID
        created_report = gel_test_collection.find_one({"_id": result.inserted_id})
        created_report["_id"] = str(created_report["_id"])
        
        # Convert back to frontend format
        response_data = {
            "_id": created_report["_id"],
            "name": created_report["name"],
            "timestamp": created_report["timestamp"],
            "formData": created_report["form_data"],  # Convert back to formData
            "averages": created_report["averages"]
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")

@gel_router.put("/{report_id}")
async def update_gel_test_report(report_id: str, report_data: dict):
    """Update an existing gel test report"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        # Check if report exists
        existing_report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Validate required fields
        required_fields = ["name", "timestamp", "formData", "averages"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Convert formData to form_data for MongoDB
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "form_data": report_data["formData"],  # Convert formData to form_data
            "averages": report_data["averages"]
        }
        
        # Update the report
        gel_test_collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": mongo_data}
        )
        
        # Return the updated report
        updated_report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
        
        # Convert back to frontend format
        response_data = {
            "_id": str(updated_report["_id"]),
            "name": updated_report["name"],
            "timestamp": updated_report["timestamp"],
            "formData": updated_report["form_data"],  # Convert back to formData
            "averages": updated_report["averages"]
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")

@gel_router.delete("/{report_id}")
async def delete_gel_test_report(report_id: str):
    """Delete a gel test report"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        
        # Check if report exists
        existing_report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Delete the report
        result = gel_test_collection.delete_one({"_id": ObjectId(report_id)})
        
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete report")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

@gel_router.get("/name/{report_name}")
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
        
        existing_report = gel_test_collection.find_one(query)
        
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")

@gel_router.get("/search/{name}")
async def search_reports_by_name(name: str):
    """Search for reports by name"""
    try:
        # Case-insensitive search
        regex_pattern = f".*{name}.*"
        reports = list(gel_test_collection.find(
            {"name": {"$regex": regex_pattern, "$options": "i"}}
        ).sort("timestamp", -1))
        
        # Convert ObjectId to string
        for report in reports:
            report["_id"] = str(report["_id"])
        
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search reports: {str(e)}")