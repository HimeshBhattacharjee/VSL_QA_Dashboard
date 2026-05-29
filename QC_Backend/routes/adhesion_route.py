from fastapi import APIRouter, Header, HTTPException, Query, status
from models.adhesion_test_models import adhesion_test_collection, AdhesionTestReport
from users.user_db import users_collection
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional

adhesion_router = APIRouter(prefix="/api/adhesion-test-reports", tags=["Adhesion Test Reports"])

WORKFLOW_STATES = {"draft", "submitted", "returned"}
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
DRAFT_TTL_DAYS = 7


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_workflow_state(report: dict) -> str:
    state = report.get("workflowState")
    return state if state in WORKFLOW_STATES else "submitted"


def parse_report_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def get_adhesion_current_user(employee_id: str | None) -> dict:
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


def is_report_owner(report: dict, user: dict) -> bool:
    return (
        report.get("createdByEmployeeId") == user.get("employeeId")
        or report.get("createdByUserId") == user.get("id")
        or (
            not report.get("createdByEmployeeId")
            and report.get("createdByEmployeeName") == user.get("name")
        )
    )


def can_view_report(report: dict, user: dict) -> bool:
    if is_system_admin(user):
        return True
    if is_operator(user):
        return is_report_owner(report, user)
    return is_reviewer(user) and normalize_workflow_state(report) == "submitted"


def can_edit_report(report: dict, user: dict) -> bool:
    state = normalize_workflow_state(report)
    if is_system_admin(user):
        return True
    if is_operator(user):
        return is_report_owner(report, user) and state in {"draft", "returned"}
    return is_reviewer(user) and state == "submitted"


def require_adhesion_export_access(report: dict, user: dict) -> None:
    if normalize_workflow_state(report) != "submitted":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel can be generated only for submitted reports")
    if not can_view_report(report, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to export this report")


def extract_report_signature(form_data: dict) -> str:
    signature = form_data.get("preparedBySignature")
    return signature.strip() if isinstance(signature, str) else ""


def serialize_adhesion_report(report: dict, include_data: bool = False) -> dict:
    adhesion_report = AdhesionTestReport.from_dict(report)
    report_data = adhesion_report.to_dict(include_data=include_data)
    serialized = {
        "_id": str(report["_id"]),
        "name": report["name"],
        "timestamp": report["timestamp"],
        "s3_key": report["s3_key"],
        "workflowState": normalize_workflow_state(report),
        "createdByUserId": report.get("createdByUserId"),
        "createdByEmployeeName": report.get("createdByEmployeeName"),
        "createdByEmployeeId": report.get("createdByEmployeeId"),
        "submittedAt": report.get("submittedAt"),
        "submittedBy": report.get("submittedBy"),
        "returnedAt": report.get("returnedAt"),
        "returnedBy": report.get("returnedBy"),
        "returnComments": report.get("returnComments"),
        "isSigned": report.get("isSigned", normalize_workflow_state(report) == "submitted"),
        "signedAt": report.get("signedAt"),
        "updatedAt": report.get("updatedAt"),
    }

    if include_data:
        serialized["formData"] = report_data.get("form_data", {})
        serialized["averages"] = report_data.get("averages", {})

    return serialized


def build_metadata_update(report_data: dict, user: dict, existing_report: dict | None = None) -> dict:
    now = utc_timestamp()
    form_data = report_data.get("formData", {})
    prepared_signature = extract_report_signature(form_data)
    previous_signed_at = existing_report.get("signedAt") if existing_report else None
    workflow_state = normalize_workflow_state(existing_report or {}) if existing_report else "draft"
    is_signed = bool(prepared_signature)
    if workflow_state == "submitted" and existing_report and not prepared_signature:
        is_signed = existing_report.get("isSigned", True)

    return {
        "name": (report_data.get("name") or "").strip(),
        "timestamp": report_data.get("timestamp") or now,
        "workflowState": workflow_state,
        "isSigned": is_signed,
        "signedAt": previous_signed_at or (now if prepared_signature else None),
        "updatedAt": now,
    }


def validate_report_payload(report_data: dict) -> None:
    required_fields = ["timestamp", "formData", "averages"]
    for field in required_fields:
        if field not in report_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required field: {field}")
    if not isinstance(report_data.get("formData"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="formData must be an object")
    if not isinstance(report_data.get("averages"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="averages must be an object")


def ensure_unique_report_name(name: str, exclude_id: ObjectId | None = None) -> None:
    query = {"name": name}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    if adhesion_test_collection.find_one(query):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A report with this name already exists")


def cleanup_expired_draft_reports() -> None:
    cutoff = datetime.now(timezone.utc).timestamp() - (DRAFT_TTL_DAYS * 24 * 60 * 60)
    expired_drafts = []
    for report in adhesion_test_collection.find({"workflowState": "draft"}):
        report_time = parse_report_datetime(report.get("updatedAt")) or parse_report_datetime(report.get("timestamp"))
        if report_time and report_time.timestamp() < cutoff:
            expired_drafts.append(report)

    for report in expired_drafts:
        try:
            AdhesionTestReport.from_dict(report).delete_data()
        finally:
            adhesion_test_collection.delete_one({"_id": report["_id"]})


@adhesion_router.get("/", response_model=List[dict])
async def get_all_adhesion_test_reports(
    include_data: bool = Query(False, description="Include full report data from S3"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_adhesion_current_user(x_employee_id)
        cleanup_expired_draft_reports()
        query = {} if (is_reviewer(user) or is_system_admin(user)) else {"createdByEmployeeId": user["employeeId"]}
        reports = list(adhesion_test_collection.find(query).sort("updatedAt", -1))
        converted_reports = []

        for report in reports:
            state = normalize_workflow_state(report)
            can_include_data = include_data and (is_system_admin(user) or (is_operator(user) and is_report_owner(report, user)) or (is_reviewer(user) and state == "submitted"))
            converted_reports.append(serialize_adhesion_report(report, include_data=can_include_data))

        return converted_reports
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")


@adhesion_router.get("/name/{report_name}")
async def check_report_name_exists(
    report_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this report ID from check"),
    excludeId: Optional[str] = Query(None, description="Backward-compatible camelCase exclude ID"),
):
    try:
        resolved_exclude_id = exclude_id or excludeId
        query = {"name": report_name}
        if resolved_exclude_id and ObjectId.is_valid(resolved_exclude_id):
            query["_id"] = {"$ne": ObjectId(resolved_exclude_id)}
        existing_report = adhesion_test_collection.find_one(query)
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")


@adhesion_router.get("/{report_id}")
async def get_adhesion_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_view_report(report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this report")

        return serialize_adhesion_report(report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")


@adhesion_router.post("/")
async def create_adhesion_test_report(report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not (is_operator(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create adhesion reports")

        validate_report_payload(report_data)
        now = utc_timestamp()
        draft_suffix = now[:19].replace(":", "-")
        report_name = (report_data.get("name") or f"Adhesion Draft - {user['name']} - {draft_suffix}").strip()
        ensure_unique_report_name(report_name)

        metadata = build_metadata_update({**report_data, "name": report_name}, user)
        mongo_data = {
            **metadata,
            "createdByUserId": user["id"],
            "createdByEmployeeName": user["name"],
            "createdByEmployeeId": user["employeeId"],
            "s3_key": "",
        }

        result = adhesion_test_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)
        adhesion_report = AdhesionTestReport.create_from_data(
            name=report_name,
            timestamp=metadata["timestamp"],
            mongo_id=mongo_id,
            form_data=report_data["formData"],
            averages=report_data["averages"],
        )
        adhesion_test_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": adhesion_report.s3_key}},
        )

        created_report = adhesion_test_collection.find_one({"_id": result.inserted_id})
        return serialize_adhesion_report(created_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@adhesion_router.put("/{report_id}")
async def update_adhesion_test_report(report_id: str, report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = adhesion_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_edit_report(existing_report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this report in its current workflow state")

        validate_report_payload(report_data)
        report_name = (report_data.get("name") or existing_report["name"]).strip()
        ensure_unique_report_name(report_name, report_object_id)

        adhesion_report = AdhesionTestReport(
            _id=str(existing_report["_id"]),
            name=report_name,
            timestamp=report_data["timestamp"],
            s3_key=existing_report["s3_key"],
        )
        success = adhesion_report.save_data(
            form_data=report_data["formData"],
            averages=report_data["averages"],
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save report data to S3")

        update_data = build_metadata_update({**report_data, "name": report_name}, user, existing_report)
        adhesion_test_collection.update_one({"_id": report_object_id}, {"$set": update_data})

        updated_report = adhesion_test_collection.find_one({"_id": report_object_id})
        return serialize_adhesion_report(updated_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")


@adhesion_router.post("/{report_id}/submit")
async def submit_adhesion_test_report(report_id: str, report_data: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = adhesion_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not (is_system_admin(user) or (is_operator(user) and is_report_owner(existing_report, user))):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creating operator can submit this report")
        if normalize_workflow_state(existing_report) not in {"draft", "returned"} and not is_system_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only draft or returned reports can be submitted")

        if report_data:
            validate_report_payload(report_data)
            report_name = (report_data.get("name") or existing_report["name"]).strip()
            ensure_unique_report_name(report_name, report_object_id)
            adhesion_report = AdhesionTestReport(
                _id=str(existing_report["_id"]),
                name=report_name,
                timestamp=report_data["timestamp"],
                s3_key=existing_report["s3_key"],
            )
            success = adhesion_report.save_data(
                form_data=report_data["formData"],
                averages=report_data["averages"],
            )
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save report data to S3")
            existing_report = {**existing_report, "name": report_name, "timestamp": report_data["timestamp"]}
            form_data = report_data["formData"]
        else:
            adhesion_report = AdhesionTestReport.from_dict(existing_report)
            form_data = adhesion_report.get_data().get("form_data", {})

        prepared_signature = extract_report_signature(form_data)
        if not prepared_signature:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prepared By signature is required before submission")

        now = utc_timestamp()
        update_data = {
            "name": existing_report["name"],
            "timestamp": existing_report["timestamp"],
            "workflowState": "submitted",
            "isSigned": True,
            "signedAt": existing_report.get("signedAt") or now,
            "submittedAt": now,
            "submittedBy": user["name"],
            "updatedAt": now,
        }
        adhesion_test_collection.update_one({"_id": report_object_id}, {"$set": update_data})

        submitted_report = adhesion_test_collection.find_one({"_id": report_object_id})
        return serialize_adhesion_report(submitted_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")


@adhesion_router.post("/{report_id}/return")
async def return_adhesion_test_report(report_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can return adhesion reports")
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = adhesion_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if normalize_workflow_state(existing_report) != "submitted" and not is_system_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted reports can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        adhesion_test_collection.update_one(
            {"_id": report_object_id},
            {
                "$set": {
                    "workflowState": "returned",
                    "returnedAt": now,
                    "returnedBy": user["name"],
                    "returnComments": return_comments,
                    "updatedAt": now,
                }
            },
        )

        returned_report = adhesion_test_collection.find_one({"_id": report_object_id})
        return serialize_adhesion_report(returned_report, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return report: {str(e)}")


@adhesion_router.delete("/{report_id}")
async def delete_adhesion_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        existing_report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        report_state = normalize_workflow_state(existing_report)
        can_delete_submitted = report_state == "submitted" and (is_reviewer(user) or is_system_admin(user))
        can_delete_own_draft = report_state == "draft" and is_operator(user) and is_report_owner(existing_report, user)
        if not (can_delete_submitted or can_delete_own_draft or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this report")

        adhesion_report = AdhesionTestReport.from_dict(existing_report)
        adhesion_report.delete_data()
        result = adhesion_test_collection.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully from both MongoDB and S3"}
        raise HTTPException(status_code=500, detail="Failed to delete report from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")
