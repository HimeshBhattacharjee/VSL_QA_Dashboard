from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Query, status

from models.peel_test_models import PeelTestReport, peel_test_collection
from users.user_db import users_collection


peel_test_router = APIRouter(prefix="/api/peel/peel-test-reports", tags=["Peel Test Reports"])

WORKFLOW_STATES = {"draft", "submitted", "returned"}
REVIEWER_ROLES = {"Supervisor", "Manager"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
ALLOWED_SHIFTS = {"A", "B", "C"}
PEEL_LINES = {
    "FAB-II Line-I": range(1, 7),
    "FAB-II Line-II": range(7, 13),
}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_workflow_state(report: dict) -> str:
    state = report.get("workflowState")
    return state if state in WORKFLOW_STATES else "submitted"


def normalize_line(value: Any) -> str:
    raw = str(value or "").strip()
    if raw in PEEL_LINES:
        return raw

    compact = raw.lower().replace("_", " ").replace("-", " ")
    compact = " ".join(compact.split())
    if compact in {"fab ii line i", "line i", "line 1", "line one"}:
        return "FAB-II Line-I"
    if compact in {"fab ii line ii", "line ii", "line 2", "line two"}:
        return "FAB-II Line-II"
    return ""


def normalize_shift_value(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    compact = raw.upper().replace("SHIFT", "").replace("-", "").strip()
    return compact if compact in ALLOWED_SHIFTS else ""


def get_peel_current_user(employee_id: str | None) -> dict:
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


def require_peel_export_access(report: dict, user: dict) -> None:
    if normalize_workflow_state(report) != "submitted":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel can be generated only for submitted reports")
    if not can_view_report(report, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to export this report")


def extract_report_signature(form_data: dict) -> str:
    signature = form_data.get("preparedBySignature")
    return signature.strip() if isinstance(signature, str) else ""


def infer_line_from_form_data(form_data: dict) -> str:
    selected_line = normalize_line(form_data.get("selectedLine"))
    if selected_line:
        return selected_line

    stringers = []
    for key, value in form_data.items():
        if not str(key).startswith("row_") or not str(key).endswith("_cell_2"):
            continue
        try:
            stringers.append(int(str(value).strip()))
        except (TypeError, ValueError):
            continue

    if stringers and all(stringer in PEEL_LINES["FAB-II Line-I"] for stringer in stringers):
        return "FAB-II Line-I"
    if stringers and all(stringer in PEEL_LINES["FAB-II Line-II"] for stringer in stringers):
        return "FAB-II Line-II"
    return ""


def get_report_line(report: dict, form_data: Optional[dict] = None) -> str:
    line = normalize_line(report.get("line"))
    if line:
        return line
    if form_data:
        inferred_line = infer_line_from_form_data(form_data)
        if inferred_line:
            return inferred_line

    report_name = str(report.get("name") or "")
    if "Line_II" in report_name or "Line-II" in report_name:
        return "FAB-II Line-II"
    if "Line_I" in report_name or "Line-I" in report_name:
        return "FAB-II Line-I"
    return ""


def get_row_indexes(form_data: dict) -> List[int]:
    indexes = set()
    for key in form_data:
        parts = str(key).split("_")
        if len(parts) >= 4 and parts[0] == "row" and parts[1].isdigit() and parts[2] == "cell":
            indexes.add(int(parts[1]))
    return sorted(indexes)


def is_unknown_value(value: Any) -> bool:
    raw = str(value or "").strip()
    return not raw or raw.upper() == "UNKNOWN"


def row_has_report_data(form_data: dict, row_index: int) -> bool:
    for cell_index in range(0, 230):
        value = str(form_data.get(f"row_{row_index}_cell_{cell_index}") or "").strip()
        if value:
            return True
    return False


def validate_line_and_shift(form_data: dict, line: str) -> None:
    if line not in PEEL_LINES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid Peel report line is required")

    selected_shift = normalize_shift_value(form_data.get("selectedShift"))
    if not selected_shift:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift must be one of Shift-A, Shift-B, or Shift-C")

    for key, value in form_data.items():
        if str(key).startswith("row_") and str(key).endswith("_cell_1") and str(value or "").strip():
            if not normalize_shift_value(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift must be one of Shift-A, Shift-B, or Shift-C")

    allowed_stringers = set(PEEL_LINES[line])
    for row_index in get_row_indexes(form_data):
        raw_stringer = str(form_data.get(f"row_{row_index}_cell_2") or "").strip()
        if not raw_stringer:
            continue
        try:
            stringer = int(raw_stringer)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stringer must be numeric")
        if stringer not in allowed_stringers:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{line} can contain only stringers {min(allowed_stringers)}-{max(allowed_stringers)}")


def validate_submission_requirements(form_data: dict) -> None:
    if not extract_report_signature(form_data):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prepared By signature is required before submission")

    populated_rows = [row_index for row_index in get_row_indexes(form_data) if row_has_report_data(form_data, row_index)]
    if not populated_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one peel test row is required before submission")

    for row_index in populated_rows:
        po_value = form_data.get(f"row_{row_index}_cell_4")
        vendor_value = form_data.get(f"row_{row_index}_cell_5")
        if is_unknown_value(po_value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PO cannot be UNKNOWN before submission")
        if is_unknown_value(vendor_value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cell Vendor cannot be UNKNOWN before submission")


def serialize_peel_report(report: dict, include_data: bool = False) -> dict:
    peel_report = PeelTestReport.from_dict(report)
    report_data = peel_report.to_dict(include_data=include_data)
    form_data = report_data.get("form_data", {}) if include_data else None
    line = get_report_line(report, form_data)
    serialized = {
        "_id": str(report["_id"]),
        "name": report["name"],
        "timestamp": report["timestamp"],
        "s3_key": report["s3_key"],
        "line": line,
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
        serialized["rowData"] = report_data.get("row_data", [])
        serialized["averages"] = report_data.get("averages", {})

    return serialized


def validate_report_payload(report_data: dict) -> None:
    required_fields = ["timestamp", "formData"]
    for field in required_fields:
        if field not in report_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required field: {field}")
    if not isinstance(report_data.get("formData"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="formData must be an object")
    if "rowData" in report_data and not isinstance(report_data.get("rowData"), list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rowData must be an array")
    if "averages" in report_data and not isinstance(report_data.get("averages"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="averages must be an object")

    line = normalize_line(report_data.get("line") or report_data.get("formData", {}).get("selectedLine"))
    validate_line_and_shift(report_data["formData"], line)


def build_metadata_update(report_data: dict, existing_report: dict | None = None) -> dict:
    now = utc_timestamp()
    form_data = report_data.get("formData", {})
    line = normalize_line(report_data.get("line") or form_data.get("selectedLine"))
    previous_signed_at = existing_report.get("signedAt") if existing_report else None
    workflow_state = normalize_workflow_state(existing_report or {}) if existing_report else "draft"
    prepared_signature = extract_report_signature(form_data)
    is_signed = bool(prepared_signature)
    if workflow_state == "submitted" and existing_report and not prepared_signature:
        is_signed = existing_report.get("isSigned", True)

    return {
        "name": (report_data.get("name") or "").strip(),
        "timestamp": report_data.get("timestamp") or now,
        "line": line,
        "workflowState": workflow_state,
        "isSigned": is_signed,
        "signedAt": previous_signed_at or (now if prepared_signature else None),
        "updatedAt": now,
    }


def ensure_unique_report_name(name: str, exclude_id: ObjectId | None = None) -> None:
    query: Dict[str, Any] = {"name": name}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    if peel_test_collection.find_one(query):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A report with this name already exists")


@peel_test_router.get("/", response_model=List[dict])
async def get_all_peel_test_reports(
    include_data: bool = Query(False, description="Include full report data from S3"),
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = get_peel_current_user(x_employee_id)
        query = {} if (is_reviewer(user) or is_system_admin(user)) else {"createdByEmployeeId": user["employeeId"]}
        reports = list(peel_test_collection.find(query).sort("updatedAt", -1))
        converted_reports = []

        for report in reports:
            state = normalize_workflow_state(report)
            can_include_data = include_data and (
                is_system_admin(user)
                or (is_operator(user) and is_report_owner(report, user))
                or (is_reviewer(user) and state == "submitted")
            )
            converted_reports.append(serialize_peel_report(report, include_data=can_include_data))

        return converted_reports
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")


@peel_test_router.get("/name/{report_name}")
async def check_report_name_exists(
    report_name: str,
    exclude_id: Optional[str] = Query(None, description="Exclude this report ID from check"),
    excludeId: Optional[str] = Query(None, description="Backward-compatible camelCase exclude ID"),
):
    try:
        resolved_exclude_id = exclude_id or excludeId
        query: Dict[str, Any] = {"name": report_name}
        if resolved_exclude_id and ObjectId.is_valid(resolved_exclude_id):
            query["_id"] = {"$ne": ObjectId(resolved_exclude_id)}
        existing_report = peel_test_collection.find_one(query)
        return {"exists": existing_report is not None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check report name: {str(e)}")


@peel_test_router.get("/{report_id}")
async def get_peel_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_view_report(report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to open this report")

        return serialize_peel_report(report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")


@peel_test_router.post("/")
async def create_peel_test_report(report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_operator(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operators can create peel reports")

        validate_report_payload(report_data)
        now = utc_timestamp()
        line = normalize_line(report_data.get("line") or report_data["formData"].get("selectedLine"))
        draft_suffix = now[:19].replace(":", "-")
        report_name = (report_data.get("name") or f"Peel Draft - {line} - {user['name']} - {draft_suffix}").strip()
        ensure_unique_report_name(report_name)

        metadata = build_metadata_update({**report_data, "name": report_name})
        mongo_data = {
            **metadata,
            "createdByUserId": user["id"],
            "createdByEmployeeName": user["name"],
            "createdByEmployeeId": user["employeeId"],
            "s3_key": "",
        }
        result = peel_test_collection.insert_one(mongo_data)
        mongo_id = str(result.inserted_id)

        peel_report = PeelTestReport.create_from_data(
            name=report_name,
            timestamp=metadata["timestamp"],
            mongo_id=mongo_id,
            form_data=report_data["formData"],
            row_data=report_data.get("rowData", []),
            averages=report_data.get("averages", {}),
        )
        peel_test_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"s3_key": peel_report.s3_key}},
        )

        created_report = peel_test_collection.find_one({"_id": result.inserted_id})
        return serialize_peel_report(created_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@peel_test_router.put("/{report_id}")
async def update_peel_test_report(report_id: str, report_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if not can_edit_report(existing_report, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit this report in its current workflow state")

        validate_report_payload(report_data)
        report_name = (report_data.get("name") or existing_report["name"]).strip()
        ensure_unique_report_name(report_name, report_object_id)

        peel_report = PeelTestReport(
            _id=str(existing_report["_id"]),
            name=report_name,
            timestamp=report_data["timestamp"],
            s3_key=existing_report["s3_key"],
        )
        success = peel_report.save_data(
            form_data=report_data["formData"],
            row_data=report_data.get("rowData", []),
            averages=report_data.get("averages", {}),
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save report data to S3")

        update_data = build_metadata_update({**report_data, "name": report_name}, existing_report)
        peel_test_collection.update_one({"_id": report_object_id}, {"$set": update_data})

        updated_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(updated_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")


@peel_test_router.post("/{report_id}/submit")
async def submit_peel_test_report(report_id: str, report_data: dict | None = None, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
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
            form_data = report_data["formData"]
            validate_submission_requirements(form_data)
            peel_report = PeelTestReport(
                _id=str(existing_report["_id"]),
                name=report_name,
                timestamp=report_data["timestamp"],
                s3_key=existing_report["s3_key"],
            )
            success = peel_report.save_data(
                form_data=form_data,
                row_data=report_data.get("rowData", []),
                averages=report_data.get("averages", {}),
            )
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save report data to S3")
            metadata = build_metadata_update({**report_data, "name": report_name}, existing_report)
        else:
            peel_report = PeelTestReport.from_dict(existing_report)
            loaded_data = peel_report.get_data()
            form_data = loaded_data.get("form_data", {})
            validate_line_and_shift(form_data, get_report_line(existing_report, form_data))
            validate_submission_requirements(form_data)
            metadata = build_metadata_update(
                {
                    "name": existing_report["name"],
                    "timestamp": existing_report["timestamp"],
                    "line": get_report_line(existing_report, form_data),
                    "formData": form_data,
                },
                existing_report,
            )

        now = utc_timestamp()
        update_data = {
            **metadata,
            "workflowState": "submitted",
            "isSigned": True,
            "signedAt": existing_report.get("signedAt") or now,
            "submittedAt": now,
            "submittedBy": user["name"],
            "updatedAt": now,
        }
        peel_test_collection.update_one({"_id": report_object_id}, {"$set": update_data})

        submitted_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(submitted_report, include_data=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")


@peel_test_router.post("/{report_id}/return")
async def return_peel_test_report(report_id: str, request_data: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not (is_reviewer(user) or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors or managers can return peel reports")
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        report_object_id = ObjectId(report_id)
        existing_report = peel_test_collection.find_one({"_id": report_object_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        if normalize_workflow_state(existing_report) != "submitted" and not is_system_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only submitted reports can be returned")

        return_comments = (request_data.get("returnComments") or "").strip()
        if not return_comments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return comments are required")

        now = utc_timestamp()
        peel_test_collection.update_one(
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

        returned_report = peel_test_collection.find_one({"_id": report_object_id})
        return serialize_peel_report(returned_report, include_data=False)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to return report: {str(e)}")


@peel_test_router.delete("/{report_id}")
async def delete_peel_test_report(report_id: str, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=400, detail="Invalid report ID")

        existing_report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        report_state = normalize_workflow_state(existing_report)
        can_delete_submitted = report_state == "submitted" and (is_reviewer(user) or is_system_admin(user))
        can_delete_own_draft = report_state == "draft" and is_operator(user) and is_report_owner(existing_report, user)
        if not (can_delete_submitted or can_delete_own_draft or is_system_admin(user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete this report")

        peel_report = PeelTestReport.from_dict(existing_report)
        peel_report.delete_data()
        result = peel_test_collection.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 1:
            return {"message": "Report deleted successfully from both MongoDB and S3"}
        raise HTTPException(status_code=500, detail="Failed to delete report from MongoDB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")
