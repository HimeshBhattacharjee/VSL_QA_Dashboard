from fastapi import APIRouter, HTTPException, Query
from models.gel_test_models import gel_test_collection, GelTestReport
from bson import ObjectId
from typing import List, Optional
import json

gel_router = APIRouter(prefix="/api/gel-test-reports", tags=["Gel Test Reports"])

@gel_router.get("/", response_model=List[dict])
async def get_all_gel_test_reports(include_data: bool = Query(False, description="Include full report data from S3")):
    """Get all gel test reports"""
    try:
        reports = list(gel_test_collection.find().sort("timestamp", -1))
        converted_reports = []

        for report in reports:
            # Create GelTestReport instance
            gel_report = GelTestReport.from_dict(report)

            # Get data from S3 if requested
            if include_data:
                report_data = gel_report.to_dict(include_data=True)
                converted_report = {
                    "_id": str(report["_id"]),
                    "name": report["name"],
                    "timestamp": report["timestamp"],
                    "formData": report_data.get("form_data", {}),
                    "averages": report_data.get("averages", {}),
                    "s3_key": report["s3_key"]
                }
            else:
                converted_report = {
                    "_id": str(report["_id"]),
                    "name": report["name"],
                    "timestamp": report["timestamp"],
                    "s3_key": report["s3_key"]
                }

            converted_reports.append(converted_report)

        return converted_reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@gel_router.get("/{report_id}")
async def get_gel_test_report(report_id: str):
    """Get a specific gel test report by ID (always includes data)"""
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        # Create GelTestReport instance and get data from S3
        gel_report = GelTestReport.from_dict(report)
        report_data = gel_report.to_dict(include_data=True)

        # Convert to frontend format
        response_data = {
            "_id": str(report["_id"]),
            "name": report["name"],
            "timestamp": report["timestamp"],
            "formData": report_data.get("form_data", {}),
            "averages": report_data.get("averages", {}),
            "s3_key": report["s3_key"]
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

        # First, insert metadata into MongoDB to get the _id
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "s3_key": ""  # Will be updated after S3 upload
        }
        result = gel_test_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        # Now create the report with S3 storage using the MongoDB _id
        gel_report = GelTestReport.create_from_data(
            name=report_data["name"],
            timestamp=report_data["timestamp"],
            mongo_id=mongo_id,
            form_data=report_data["formData"],
            averages=report_data["averages"]
        )

        # Update MongoDB with the correct s3_key
        gel_test_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": gel_report.s3_key}}
        )

        # Return the created report
        return {
            "_id": mongo_id,
            "name": gel_report.name,
            "timestamp": gel_report.timestamp,
            "formData": report_data["formData"],
            "averages": report_data["averages"],
            "s3_key": gel_report.s3_key
        }

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

        # Create GelTestReport instance
        gel_report = GelTestReport(
            _id=str(existing_report["_id"]),
            name=report_data["name"],
            timestamp=report_data["timestamp"],
            s3_key=existing_report["s3_key"]
        )

        # Update data in S3
        success = gel_report.save_data(
            form_data=report_data["formData"],
            averages=report_data["averages"]
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save report data to S3")

        # Update metadata in MongoDB (except s3_key remains the same)
        update_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"]
        }

        gel_test_collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": update_data}
        )

        # Return the updated report
        return {
            "_id": report_id,
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "formData": report_data["formData"],
            "averages": report_data["averages"],
            "s3_key": existing_report["s3_key"]
        }

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

        # Create GelTestReport instance
        gel_report = GelTestReport.from_dict(existing_report)

        # Delete data from S3
        gel_report.delete_data()

        # Delete metadata from MongoDB
        result = gel_test_collection.delete_one({"_id": ObjectId(report_id)})

        if result.deleted_count == 1:
            return {"message": "Report deleted successfully from both MongoDB and S3"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete report from MongoDB")
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