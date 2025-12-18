from fastapi import APIRouter, HTTPException, Query
from models.ipqc_audit_models import ipqc_audit_collection, IPQCAudit
from bson import ObjectId
from typing import List, Optional
import json

ipqc_audit_router = APIRouter(prefix="/api/ipqc-audits", tags=["IPQC Audits"])

@ipqc_audit_router.get("/", response_model=List[dict])
async def get_all_ipqc_audits(
    include_data: bool = Query(False, description="Include full audit data from S3")
):
    """Get all IPQC audit reports"""
    try:
        audits = list(ipqc_audit_collection.find().sort("timestamp", -1))
        converted_audits = []

        for audit in audits:
            # Create IPQCAudit instance
            ipqc_audit = IPQCAudit.from_dict(audit)

            # Get data from S3 if requested
            if include_data:
                audit_data = ipqc_audit.to_dict(include_data=True)
                converted_audit = {
                    "_id": str(audit["_id"]),
                    "name": audit["name"],
                    "timestamp": audit["timestamp"],
                    "data": audit_data.get("data", {}),
                    "s3_key": audit["s3_key"]
                }
            else:
                converted_audit = {
                    "_id": str(audit["_id"]),
                    "name": audit["name"],
                    "timestamp": audit["timestamp"],
                    "s3_key": audit["s3_key"]
                }

            converted_audits.append(converted_audit)

        return converted_audits
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audits: {str(e)}")

@ipqc_audit_router.get("/{audit_id}")
async def get_ipqc_audit(audit_id: str):
    """Get a specific IPQC audit by ID"""
    try:
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")

        # Create IPQCAudit instance and get data from S3
        ipqc_audit = IPQCAudit.from_dict(audit)
        audit_data = ipqc_audit.to_dict(include_data=True)

        response_data = {
            "_id": str(audit["_id"]),
            "name": audit["name"],
            "timestamp": audit["timestamp"],
            "data": audit_data.get("data", {}),
            "s3_key": audit["s3_key"]
        }

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit: {str(e)}")

@ipqc_audit_router.post("/")
async def create_ipqc_audit(audit_data: dict):
    """Create a new IPQC audit"""
    try:
        # Validate required fields - now expecting the frontend structure
        required_fields = ["name", "timestamp", "data"]
        for field in required_fields:
            if field not in audit_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        # Check if audit with same name already exists
        existing_audit = ipqc_audit_collection.find_one({"name": audit_data["name"]})
        if existing_audit:
            raise HTTPException(status_code=409, detail="An audit with this name already exists")

        # First, insert metadata into MongoDB to get the _id
        mongo_data = {
            "name": audit_data["name"],
            "timestamp": audit_data["timestamp"],
            "s3_key": ""  # Will be updated after S3 upload
        }
        result = ipqc_audit_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        # Now create the audit with S3 storage using the MongoDB _id
        ipqc_audit = IPQCAudit.create_from_data(
            name=audit_data["name"],
            timestamp=audit_data["timestamp"],
            mongo_id=mongo_id,
            data=audit_data["data"]
        )

        # Update MongoDB with the correct s3_key
        ipqc_audit_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": ipqc_audit.s3_key}}
        )

        # Return the created audit with ID
        return {
            "_id": mongo_id,
            "name": ipqc_audit.name,
            "timestamp": ipqc_audit.timestamp,
            "data": audit_data["data"],
            "s3_key": ipqc_audit.s3_key
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create audit: {str(e)}")

@ipqc_audit_router.put("/{audit_id}")
async def update_ipqc_audit(audit_id: str, audit_data: dict):
    """Update an existing IPQC audit"""
    try:
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        # Check if audit exists
        existing_audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")

        # Validate required fields
        required_fields = ["name", "timestamp", "data"]
        for field in required_fields:
            if field not in audit_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        # Create IPQCAudit instance
        ipqc_audit = IPQCAudit(
            _id=str(existing_audit["_id"]),
            name=audit_data["name"],
            timestamp=audit_data["timestamp"],
            s3_key=existing_audit["s3_key"]
        )

        # Update data in S3
        success = ipqc_audit.save_data(data=audit_data["data"])

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save audit data to S3")

        # Update metadata in MongoDB
        update_data = {
            "name": audit_data["name"],
            "timestamp": audit_data["timestamp"]
        }

        ipqc_audit_collection.update_one(
            {"_id": ObjectId(audit_id)},
            {"$set": update_data}
        )

        # Return the updated audit
        return {
            "_id": audit_id,
            "name": audit_data["name"],
            "timestamp": audit_data["timestamp"],
            "data": audit_data["data"],
            "s3_key": existing_audit["s3_key"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update audit: {str(e)}")

@ipqc_audit_router.delete("/{audit_id}")
async def delete_ipqc_audit(audit_id: str):
    """Delete an IPQC audit"""
    try:
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        # Check if audit exists
        existing_audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")

        # Create IPQCAudit instance
        ipqc_audit = IPQCAudit.from_dict(existing_audit)

        # Delete data from S3
        ipqc_audit.delete_data()

        # Delete metadata from MongoDB
        result = ipqc_audit_collection.delete_one({"_id": ObjectId(audit_id)})

        if result.deleted_count == 1:
            return {"message": "Audit deleted successfully from both MongoDB and S3"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete audit from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete audit: {str(e)}")

@ipqc_audit_router.get("/search/by-filters")
async def search_audits_by_filters(
    lineNumber: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    shift: Optional[str] = Query(None)
):
    """Search for audits by filters"""
    try:
        # Get all audits with data included
        audits = list(ipqc_audit_collection.find().sort("timestamp", -1))
        filtered_audits = []

        for audit in audits:
            # Create IPQCAudit instance and get data from S3
            ipqc_audit = IPQCAudit.from_dict(audit)
            audit_data = ipqc_audit.to_dict(include_data=True)

            # Apply filters to the data
            data = audit_data.get("data", {})
            match = True

            if lineNumber and data.get("lineNumber") != lineNumber:
                match = False
            if date and data.get("date") != date:
                match = False
            if shift and data.get("shift") != shift:
                match = False

            if match:
                filtered_audit = {
                    "_id": str(audit["_id"]),
                    "name": audit["name"],
                    "timestamp": audit["timestamp"],
                    "data": data,
                    "s3_key": audit["s3_key"]
                }
                filtered_audits.append(filtered_audit)

        return filtered_audits
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search audits: {str(e)}")

@ipqc_audit_router.get("/name/{audit_name}")
async def check_audit_name_exists(
    audit_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this audit ID from check")
):
    """Check if an audit name already exists"""
    try:
        query = {"name": audit_name}

        # Exclude current audit if provided
        if exclude_id and ObjectId.is_valid(exclude_id):
            query["_id"] = {"$ne": ObjectId(exclude_id)}

        existing_audit = ipqc_audit_collection.find_one(query)

        return {"exists": existing_audit is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check audit name: {str(e)}")