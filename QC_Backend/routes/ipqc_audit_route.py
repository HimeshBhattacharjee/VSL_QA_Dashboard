from fastapi import APIRouter, HTTPException, Query
from models.ipqc_audit_models import ipqc_audit_collection, IPQCAudit
from bson import ObjectId
from typing import List, Optional
import json

ipqc_audit_router = APIRouter(prefix="/api/ipqc-audits", tags=["IPQC Audits"])

@ipqc_audit_router.get("/", response_model=List[dict])
async def get_all_ipqc_audits():
    """Get all IPQC audit reports"""
    try:
        audits = list(ipqc_audit_collection.find().sort("timestamp", -1))
        # Convert ObjectId to string and ensure proper structure
        converted_audits = []
        for audit in audits:
            converted_audit = {
                "_id": str(audit["_id"]),
                "name": audit["name"],
                "timestamp": audit["timestamp"],
                "data": audit["data"]
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
        
        response_data = {
            "_id": str(audit["_id"]),
            "name": audit["name"],
            "timestamp": audit["timestamp"],
            "data": audit["data"]
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
        
        # Insert new audit
        result = ipqc_audit_collection.insert_one(audit_data)
        
        # Return the created audit with ID
        created_audit = ipqc_audit_collection.find_one({"_id": result.inserted_id})
        created_audit["_id"] = str(created_audit["_id"])
        
        return created_audit
        
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
        
        # Update the audit
        ipqc_audit_collection.update_one(
            {"_id": ObjectId(audit_id)},
            {"$set": audit_data}
        )
        
        # Return the updated audit
        updated_audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        updated_audit["_id"] = str(updated_audit["_id"])
        
        return updated_audit
        
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
        
        # Delete the audit
        result = ipqc_audit_collection.delete_one({"_id": ObjectId(audit_id)})
        
        if result.deleted_count == 1:
            return {"message": "Audit deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete audit")
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
        query = {}
        if lineNumber:
            query["data.lineNumber"] = lineNumber
        if date:
            query["data.date"] = date
        if shift:
            query["data.shift"] = shift
        
        audits = list(ipqc_audit_collection.find(query).sort("timestamp", -1))
        
        # Convert ObjectId to string
        for audit in audits:
            audit["_id"] = str(audit["_id"])
        
        return audits
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