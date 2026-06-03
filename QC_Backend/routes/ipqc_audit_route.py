from datetime import datetime, timezone
import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status

from models.ipqc_audit_models import build_ipqc_audit_metadata, ipqc_audit_collection, IPQCAudit, normalize_ipqc_audit_data
from users.user_db import users_collection


ipqc_audit_router = APIRouter(prefix="/api/ipqc-audits", tags=["IPQC Audits"])

WORKFLOW_STATES = {"draft", "submitted", "returned"}
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}

SORT_OPTIONS = {
    "newest-created": ("timestamp", -1),
    "oldest-created": ("timestamp", 1),
    "newest-updated": ("updated_timestamp", -1),
    "oldest-updated": ("updated_timestamp", 1),
    "recently-updated": ("updated_timestamp", -1),
    "least-recently-updated": ("updated_timestamp", 1),
    "name-asc": ("name", 1),
    "name-desc": ("name", -1),
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_workflow_state(audit: dict) -> str:
    state = audit.get("workflowState")
    if state in WORKFLOW_STATES:
        return state
    # Legacy audits predate workflow metadata. Treat them as submitted so historical exports remain available.
    return "submitted"


def get_ipqc_current_user(employee_id: str | None) -> dict:
    if not employee_id or not employee_id.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User authorization is required")

    user = users_collection.find_one({"employeeId": employee_id.strip()})
    if not user or user.get("status") != "Active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Active user authorization is required")

    return {
        "id": str(user["_id"]),
        "employeeId": user["employeeId"],
        "name": user["name"],
        "role": user["role"],
    }


def is_system_admin(user: dict) -> bool:
    return user.get("role") in SYSTEM_ADMIN_ROLES


def is_reviewer(user: dict) -> bool:
    return user.get("role") in REVIEWER_ROLES


def is_operator(user: dict) -> bool:
    return user.get("role") == "Operator"


def is_audit_owner(audit: dict, user: dict) -> bool:
    return (
        audit.get("createdByEmployeeId") == user.get("employeeId")
        or audit.get("createdByUserId") == user.get("id")
        or (
            not audit.get("createdByEmployeeId")
            and audit.get("createdBy") == user.get("name")
        )
    )


def can_view_audit(audit: dict, user: dict) -> bool:
    if is_system_admin(user):
        return True
    if is_operator(user):
        return is_audit_owner(audit, user)
    return is_reviewer(user) and normalize_workflow_state(audit) == "submitted"


def can_edit_audit(audit: dict, user: dict) -> bool:
    state = normalize_workflow_state(audit)
    if is_system_admin(user):
        return True
    if is_operator(user):
        return is_audit_owner(audit, user) and state in {"draft", "returned"}
    return is_reviewer(user) and state == "submitted"


def require_ipqc_export_access(audit: dict, user: dict) -> None:
    if normalize_workflow_state(audit) != "submitted":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel can be generated only for submitted checksheets")
    if not can_view_audit(audit, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to export this checksheet")


def extract_audit_signature(data: dict) -> str:
    signatures = data.get("signatures") if isinstance(data.get("signatures"), dict) else {}
    signature = signatures.get("auditBy") or data.get("auditBy")
    if isinstance(signature, dict):
        signature = signature.get("name") or signature.get("text") or signature.get("value")
    return signature.strip() if isinstance(signature, str) else ""


def serialize_ipqc_audit(audit: dict, include_data: bool = False) -> dict:
    data = {}
    metadata = {}
    if include_data:
        audit_data = IPQCAudit.from_dict(audit).to_dict(include_data=True)
        data = audit_data.get("data", {})
        metadata = build_ipqc_audit_metadata(data)

    state = normalize_workflow_state(audit)
    return {
        "_id": str(audit["_id"]),
        "id": str(audit["_id"]),
        "name": audit["name"],
        "timestamp": audit["timestamp"],
        "updated_timestamp": audit.get("updated_timestamp", audit["timestamp"]),
        "s3_key": audit["s3_key"],
        "lineNumber": audit.get("lineNumber", metadata.get("lineNumber", "")),
        "date": audit.get("date", metadata.get("date", "")),
        "shift": audit.get("shift", metadata.get("shift", "")),
        "productionOrderNo": audit.get("productionOrderNo", metadata.get("productionOrderNo", "")),
        "moduleType": audit.get("moduleType", metadata.get("moduleType", "")),
        "status": state,
        "workflowState": state,
        "createdBy": audit.get("createdBy", metadata.get("createdBy", "")),
        "createdByUserId": audit.get("createdByUserId"),
        "createdByEmployeeName": audit.get("createdByEmployeeName", audit.get("createdBy")),
        "createdByEmployeeId": audit.get("createdByEmployeeId"),
        "submittedAt": audit.get("submittedAt"),
        "submittedBy": audit.get("submittedBy"),
        "returnedAt": audit.get("returnedAt"),
        "returnedBy": audit.get("returnedBy"),
        "returnComments": audit.get("returnComments"),
        "isSigned": audit.get("isSigned", state == "submitted"),
        "signedAt": audit.get("signedAt"),
        **({"data": data} if include_data else {}),
    }


def build_search_query(search: Optional[str]) -> dict:
    if not search:
        return {}

    escaped_search = re.escape(search.strip())
    if not escaped_search:
        return {}

    return {
        "$or": [
            {"name": {"$regex": escaped_search, "$options": "i"}},
            {"lineNumber": {"$regex": escaped_search, "$options": "i"}},
            {"date": {"$regex": escaped_search, "$options": "i"}},
            {"shift": {"$regex": escaped_search, "$options": "i"}},
            {"productionOrderNo": {"$regex": escaped_search, "$options": "i"}},
            {"moduleType": {"$regex": escaped_search, "$options": "i"}},
            {"status": {"$regex": escaped_search, "$options": "i"}},
            {"workflowState": {"$regex": escaped_search, "$options": "i"}},
            {"createdBy": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeName": {"$regex": escaped_search, "$options": "i"}},
            {"createdByEmployeeId": {"$regex": escaped_search, "$options": "i"}},
        ]
    }


def build_access_query(user: dict) -> dict:
    if is_system_admin(user) or is_reviewer(user):
        return {}
    if is_operator(user):
        return {
            "$or": [
                {"createdByEmployeeId": user["employeeId"]},
                {"createdByUserId": user["id"]},
                {"createdBy": user["name"]},
            ]
        }
    return {"_id": {"$exists": False}}


def combine_queries(*queries: dict) -> dict:
    active_queries = [query for query in queries if query]
    if not active_queries:
        return {}
    if len(active_queries) == 1:
        return active_queries[0]
    return {"$and": active_queries}


def validate_audit_payload(audit_data: dict) -> None:
    required_fields = ["name", "timestamp", "data"]
    for field in required_fields:
        if field not in audit_data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    if not isinstance(audit_data.get("data"), dict):
        raise HTTPException(status_code=400, detail="Audit data must be an object")


def validate_draft_required_metadata(data: dict) -> None:
    required_fields = {
        "lineNumber": "Line",
        "date": "Date",
        "shift": "Shift",
        "productionOrderNo": "Production Order Number",
        "moduleType": "Module Type",
    }
    missing_fields = [
        label
        for field, label in required_fields.items()
        if not str(data.get(field) or "").strip()
    ]
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required checksheet fields: {', '.join(missing_fields)}",
        )


def ensure_unique_audit_name(name: str, exclude_id: ObjectId | None = None) -> None:
    query = {"name": name}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    if ipqc_audit_collection.find_one(query):
        raise HTTPException(status_code=409, detail="An audit with this name already exists")


def find_matching_draft_audit(data: dict, user: dict) -> dict | None:
    line_number = str(data.get("lineNumber") or "").strip()
    audit_date = str(data.get("date") or "").strip()
    shift = str(data.get("shift") or "").strip()
    if not (line_number and audit_date and shift):
        return None

    query = combine_queries(
        build_access_query(user),
        {
            "workflowState": "draft",
            "lineNumber": line_number,
            "date": audit_date,
            "shift": shift,
        },
    )
    return ipqc_audit_collection.find_one(query, sort=[("updated_timestamp", -1), ("timestamp", -1)])


def build_metadata_update(audit_data: dict, existing_audit: dict | None, user: dict, workflow_state: str | None = None) -> tuple[dict, dict]:
    now = utc_timestamp()
    normalized_data = normalize_ipqc_audit_data(audit_data["data"])
    audit_metadata = build_ipqc_audit_metadata(normalized_data)
    state = workflow_state or (normalize_workflow_state(existing_audit) if existing_audit else "draft")
    normalized_data["workflowState"] = state
    normalized_data["status"] = state
    prepared_signature = extract_audit_signature(normalized_data)
    previous_signed_at = existing_audit.get("signedAt") if existing_audit else None

    metadata = {
        "name": audit_data["name"],
        "timestamp": existing_audit["timestamp"] if existing_audit else audit_data["timestamp"],
        "updated_timestamp": audit_data.get("updated_timestamp", now),
        **audit_metadata,
        "status": state,
        "workflowState": state,
        "createdBy": existing_audit.get("createdBy") if existing_audit else user["name"],
        "createdByUserId": existing_audit.get("createdByUserId") if existing_audit else user["id"],
        "createdByEmployeeName": existing_audit.get("createdByEmployeeName") if existing_audit else user["name"],
        "createdByEmployeeId": existing_audit.get("createdByEmployeeId") if existing_audit else user["employeeId"],
        "isSigned": bool(prepared_signature) if state == "submitted" else False,
        "signedAt": previous_signed_at or (now if prepared_signature and state == "submitted" else None),
        "updatedAt": now,
    }
    return metadata, normalized_data


@ipqc_audit_router.get("/")
async def get_all_ipqc_audits(
    include_data: bool = Query(False, description="Include full audit data from S3"),
    summary: bool = Query(False, description="Return paginated summary data"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort: str = Query("newest-created"),
    workflow_state: Optional[str] = Query(None),
    exclude_workflow_state: Optional[str] = Query(None),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        workflow_query = {"workflowState": workflow_state} if workflow_state in WORKFLOW_STATES else {}
        exclude_workflow_query = {"workflowState": {"$ne": exclude_workflow_state}} if exclude_workflow_state in WORKFLOW_STATES else {}
        query = combine_queries(build_access_query(user), build_search_query(search), workflow_query, exclude_workflow_query)
        sort_field, sort_direction = SORT_OPTIONS.get(sort, SORT_OPTIONS["newest-created"])

        if summary:
            total = ipqc_audit_collection.count_documents(query)
            audits = list(
                ipqc_audit_collection
                .find(query)
                .sort(sort_field, sort_direction)
                .skip((page - 1) * page_size)
                .limit(page_size)
            )
            return {
                "items": [serialize_ipqc_audit(audit, include_data=False) for audit in audits],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

        audits = list(ipqc_audit_collection.find(query).sort(sort_field, sort_direction))
        return [
            serialize_ipqc_audit(
                audit,
                include_data=include_data and can_view_audit(audit, user),
            )
            for audit in audits
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audits: {str(e)}")


@ipqc_audit_router.get("/search/by-filters")
async def search_audits_by_filters(
    lineNumber: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    shift: Optional[str] = Query(None),
    workflow_state: Optional[str] = Query(None),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_ipqc_current_user(x_employee_id)
        filters = {}
        if lineNumber:
            filters["lineNumber"] = lineNumber
        if date:
            filters["date"] = date
        if shift:
            filters["shift"] = shift
        if workflow_state in WORKFLOW_STATES:
            filters["workflowState"] = workflow_state

        query = combine_queries(build_access_query(user), filters)
        audits = list(ipqc_audit_collection.find(query).sort([("updated_timestamp", -1), ("timestamp", -1)])) if filters else []
        return [
            serialize_ipqc_audit(audit, include_data=can_view_audit(audit, user))
            for audit in audits
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search audits: {str(e)}")


@ipqc_audit_router.get("/name/{audit_name}")
async def check_audit_name_exists(
    audit_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this audit ID from check"),
    excludeId: Optional[str] = Query(None, description="Legacy camelCase exclude ID"),
):
    try:
        query = {"name": audit_name}
        effective_exclude_id = exclude_id or excludeId
        if effective_exclude_id and ObjectId.is_valid(effective_exclude_id):
            query["_id"] = {"$ne": ObjectId(effective_exclude_id)}
        existing_audit = ipqc_audit_collection.find_one(query)
        return {"exists": existing_audit is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check audit name: {str(e)}")


@ipqc_audit_router.get("/{audit_id}")
async def get_ipqc_audit(audit_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not can_view_audit(audit, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this checksheet")

        return serialize_ipqc_audit(audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit: {str(e)}")


@ipqc_audit_router.post("/")
async def create_ipqc_audit(audit_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not is_operator(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create checksheets")

        validate_audit_payload(audit_data)
        audit_name = audit_data["name"].strip()
        metadata, normalized_data = build_metadata_update({**audit_data, "name": audit_name}, None, user, "draft")
        validate_draft_required_metadata(normalized_data)

        existing_draft = find_matching_draft_audit(normalized_data, user)
        if existing_draft:
            return serialize_ipqc_audit(existing_draft, include_data=True)

        ensure_unique_audit_name(audit_name)

        mongo_data = {
            "name": audit_name,
            "timestamp": audit_data["timestamp"],
            "updated_timestamp": metadata["updated_timestamp"],
            "s3_key": "",
            **metadata,
        }
        result = ipqc_audit_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        ipqc_audit = IPQCAudit.create_from_data(
            name=audit_name,
            timestamp=audit_data["timestamp"],
            mongo_id=mongo_id,
            data=normalized_data,
        )
        ipqc_audit_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": ipqc_audit.s3_key}},
        )

        created_audit = ipqc_audit_collection.find_one({"_id": result.inserted_id})
        return serialize_ipqc_audit(created_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create audit: {str(e)}")


@ipqc_audit_router.put("/{audit_id}")
async def update_ipqc_audit(audit_id: str, audit_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not can_edit_audit(existing_audit, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to modify this checksheet")

        validate_audit_payload({**audit_data, "timestamp": audit_data.get("timestamp", existing_audit["timestamp"])})
        updated_name = (audit_data.get("name") or existing_audit["name"]).strip()
        ensure_unique_audit_name(updated_name, audit_object_id)

        existing_ipqc_audit = IPQCAudit.from_dict(existing_audit)
        existing_data = existing_ipqc_audit.get_data()
        merged_data = {**existing_data, **audit_data.get("data", {})}
        metadata, normalized_data = build_metadata_update(
            {
                **audit_data,
                "name": updated_name,
                "timestamp": existing_audit["timestamp"],
                "data": merged_data,
            },
            existing_audit,
            user,
        )

        ipqc_audit = IPQCAudit(
            _id=str(existing_audit["_id"]),
            name=updated_name,
            timestamp=existing_audit["timestamp"],
            s3_key=existing_audit["s3_key"],
        )
        if not ipqc_audit.save_data(data=normalized_data):
            raise HTTPException(status_code=500, detail="Failed to save audit data to S3")

        ipqc_audit_collection.update_one({"_id": audit_object_id}, {"$set": metadata})
        updated_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(updated_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/submit")
async def submit_ipqc_audit(audit_id: str, audit_data: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if not (is_system_admin(user) or (is_operator(user) and is_audit_owner(existing_audit, user))):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit this checksheet")
        if normalize_workflow_state(existing_audit) not in {"draft", "returned"} and not is_system_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only draft or returned checksheets can be submitted")

        if audit_data:
            validate_audit_payload({**audit_data, "timestamp": audit_data.get("timestamp", existing_audit["timestamp"])})
            updated_name = (audit_data.get("name") or existing_audit["name"]).strip()
            ensure_unique_audit_name(updated_name, audit_object_id)
            existing_ipqc_audit = IPQCAudit.from_dict(existing_audit)
            existing_data = existing_ipqc_audit.get_data()
            merged_data = {**existing_data, **audit_data.get("data", {})}
            metadata, normalized_data = build_metadata_update(
                {
                    **audit_data,
                    "name": updated_name,
                    "timestamp": existing_audit["timestamp"],
                    "data": merged_data,
                },
                existing_audit,
                user,
                "submitted",
            )
            ipqc_audit = IPQCAudit(
                _id=str(existing_audit["_id"]),
                name=updated_name,
                timestamp=existing_audit["timestamp"],
                s3_key=existing_audit["s3_key"],
            )
            if not ipqc_audit.save_data(data=normalized_data):
                raise HTTPException(status_code=500, detail="Failed to save audit data to S3")
        else:
            ipqc_audit = IPQCAudit.from_dict(existing_audit)
            normalized_data = ipqc_audit.get_data()
            metadata, _ = build_metadata_update(
                {
                    "name": existing_audit["name"],
                    "timestamp": existing_audit["timestamp"],
                    "data": normalized_data,
                },
                existing_audit,
                user,
                "submitted",
            )

        if not extract_audit_signature(normalized_data):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prepared By signature is required before submission")

        now = utc_timestamp()
        update_data = {
            **metadata,
            "status": "submitted",
            "workflowState": "submitted",
            "isSigned": True,
            "signedAt": existing_audit.get("signedAt") or now,
            "submittedAt": now,
            "submittedBy": user["name"],
            "returnedAt": None,
            "returnedBy": None,
            "returnComments": None,
            "updated_timestamp": now,
            "updatedAt": now,
        }
        ipqc_audit_collection.update_one({"_id": audit_object_id}, {"$set": update_data})
        submitted_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(submitted_audit, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit audit: {str(e)}")


@ipqc_audit_router.post("/{audit_id}/return")
async def return_ipqc_audit(audit_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can return checksheets")
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if normalize_workflow_state(existing_audit) != "submitted" and not is_system_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted checksheets can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        ipqc_audit_collection.update_one(
            {"_id": audit_object_id},
            {
                "$set": {
                    "status": "returned",
                    "workflowState": "returned",
                    "returnedAt": now,
                    "returnedBy": user["name"],
                    "returnComments": return_comments,
                    "updated_timestamp": now,
                    "updatedAt": now,
                }
            },
        )
        returned_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        return serialize_ipqc_audit(returned_audit, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return audit: {str(e)}")


@ipqc_audit_router.delete("/{audit_id}")
async def delete_ipqc_audit(audit_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="Invalid audit ID")

        audit_object_id = ObjectId(audit_id)
        existing_audit = ipqc_audit_collection.find_one({"_id": audit_object_id})
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit not found")

        state = normalize_workflow_state(existing_audit)
        can_delete_submitted = state == "submitted" and (is_reviewer(user) or is_system_admin(user))
        can_delete_own_draft = state == "draft" and is_operator(user) and is_audit_owner(existing_audit, user)
        if not (can_delete_submitted or can_delete_own_draft or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this checksheet")

        ipqc_audit = IPQCAudit.from_dict(existing_audit)
        ipqc_audit.delete_data()
        result = ipqc_audit_collection.delete_one({"_id": audit_object_id})
        if result.deleted_count == 1:
            return {"message": "Audit deleted successfully from both MongoDB and S3"}
        raise HTTPException(status_code=500, detail="Failed to delete audit from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete audit: {str(e)}")
