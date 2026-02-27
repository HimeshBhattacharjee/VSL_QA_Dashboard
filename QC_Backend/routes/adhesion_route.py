from fastapi import APIRouter, HTTPException, Query
from models.adhesion_test_models import adhesion_test_collection, AdhesionTestReport
from bson import ObjectId
from typing import List, Optional

adhesion_router = APIRouter(prefix="/api/adhesion-test-reports", tags=["Adhesion Test Reports"])

@adhesion_router.get("/", response_model=List[dict])
async def get_all_adhesion_test_reports(include_data: bool = Query(False, description="Include full report data from S3")):
    try:
        reports = list(adhesion_test_collection.find().sort("timestamp", -1))
        converted_reports = []
        for report in reports:
            adhesion_report = AdhesionTestReport.from_dict(report)
            if include_data:
                report_data = adhesion_report.to_dict(include_data=True)
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

@adhesion_router.get("/{report_id}")
async def get_adhesion_test_report(report_id: str):
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        adhesion_report = AdhesionTestReport.from_dict(report)
        report_data = adhesion_report.to_dict(include_data=True)
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

@adhesion_router.post("/")
async def create_adhesion_test_report(report_data: dict):
    try:
        required_fields = ["name", "timestamp", "formData", "averages"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        existing_report = adhesion_test_collection.find_one({"name": report_data["name"]})
        if existing_report:
            raise HTTPException(status_code=409, detail="A report with this name already exists")
        mongo_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"],
            "s3_key": ""
        }
        result = adhesion_test_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)
        adhesion_report = AdhesionTestReport.create_from_data(
            name=report_data["name"],
            timestamp=report_data["timestamp"],
            mongo_id=mongo_id,
            form_data=report_data["formData"],
            averages=report_data["averages"]
        )
        adhesion_test_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": adhesion_report.s3_key}}
        )
        return {
            "_id": mongo_id,
            "name": adhesion_report.name,
            "timestamp": adhesion_report.timestamp,
            "formData": report_data["formData"],
            "averages": report_data["averages"],
            "s3_key": adhesion_report.s3_key
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")

@adhesion_router.put("/{report_id}")
async def update_adhesion_test_report(report_id: str, report_data: dict):
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        existing_report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        required_fields = ["name", "timestamp", "formData", "averages"]
        for field in required_fields:
            if field not in report_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        adhesion_report = AdhesionTestReport(
            _id=str(existing_report["_id"]),
            name=report_data["name"],
            timestamp=report_data["timestamp"],
            s3_key=existing_report["s3_key"]
        )
        success = adhesion_report.save_data(
            form_data=report_data["formData"],
            averages=report_data["averages"]
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save report data to S3")
        update_data = {
            "name": report_data["name"],
            "timestamp": report_data["timestamp"]
        }
        adhesion_test_collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": update_data}
        )
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

@adhesion_router.delete("/{report_id}")
async def delete_adhesion_test_report(report_id: str):
    try:
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")
        existing_report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        adhesion_report = AdhesionTestReport.from_dict(existing_report)
        adhesion_report.delete_data()
        result = adhesion_test_collection.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully from both MongoDB and S3"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete report from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

@adhesion_router.get("/name/{report_name}")
async def check_report_name_exists(
    report_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this report ID from check")
):
    try:
        query = {"name": report_name}
        if exclude_id and ObjectId.is_valid(exclude_id):
            query["_id"] = {"$ne": ObjectId(exclude_id)}
        existing_report = adhesion_test_collection.find_one(query)
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")