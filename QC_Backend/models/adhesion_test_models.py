import logging
from pymongo import ASCENDING, DESCENDING, MongoClient
from typing import Optional, Dict, Any
from constants import MONGODB_URI, MONGODB_DB_NAME
from mongo_indexes import ensure_index
from s3_service import S3Service

logger = logging.getLogger(__name__)

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
adhesion_test_collection = db["adhesion_test_reports"]

def ensure_adhesion_test_indexes() -> None:
    try:
        ensure_index(adhesion_test_collection, [("updatedAt", DESCENDING)], name="adhesion_updated_at_desc_idx")
        ensure_index(adhesion_test_collection, [("timestamp", DESCENDING)], name="adhesion_timestamp_desc_idx")
        ensure_index(adhesion_test_collection, [("name", ASCENDING)], name="adhesion_name_idx")
        ensure_index(adhesion_test_collection, [("workflowState", ASCENDING)], name="adhesion_workflow_state_idx")
        ensure_index(adhesion_test_collection, [("status", ASCENDING)], name="adhesion_status_idx")
        ensure_index(adhesion_test_collection, [("date", DESCENDING)], name="adhesion_date_desc_idx")
        ensure_index(adhesion_test_collection, [("shift", ASCENDING)], name="adhesion_shift_idx")
        ensure_index(adhesion_test_collection, [("lineNumber", ASCENDING)], name="adhesion_line_number_idx")
        ensure_index(adhesion_test_collection, [("productionOrderNo", ASCENDING)], name="adhesion_production_order_idx")
        ensure_index(adhesion_test_collection, [("createdByEmployeeId", ASCENDING)], name="adhesion_created_by_employee_id_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_adhesion_test_indexes error=%s", exc, exc_info=True)

ensure_adhesion_test_indexes()

class AdhesionTestReport:
    def __init__(
        self,
        name: str,
        timestamp: str,
        s3_key: str,
        _id: Optional[str] = None,
        workflow_state: str = "submitted",
        created_by_user_id: Optional[str] = None,
        created_by_employee_name: Optional[str] = None,
        created_by_employee_id: Optional[str] = None,
        submitted_at: Optional[str] = None,
        submitted_by: Optional[str] = None,
        approved_at: Optional[str] = None,
        approved_by: Optional[str] = None,
        returned_at: Optional[str] = None,
        returned_by: Optional[str] = None,
        return_comments: Optional[str] = None,
        is_signed: bool = True,
        signed_at: Optional[str] = None,
        updated_at: Optional[str] = None
    ):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.s3_key = s3_key
        self.workflow_state = workflow_state
        self.created_by_user_id = created_by_user_id
        self.created_by_employee_name = created_by_employee_name
        self.created_by_employee_id = created_by_employee_id
        self.submitted_at = submitted_at
        self.submitted_by = submitted_by
        self.approved_at = approved_at
        self.approved_by = approved_by
        self.returned_at = returned_at
        self.returned_by = returned_by
        self.return_comments = return_comments
        self.is_signed = is_signed
        self.signed_at = signed_at
        self.updated_at = updated_at
        self.s3_service = S3Service()

    def get_data(self) -> Dict[str, Any]:
        try:
            data = self.s3_service.download_json(self.s3_key)
            return {
                "form_data": data.get("form_data", {}),
                "averages": data.get("averages", {})
            }
        except Exception as e:
            logger.exception("adhesion_test_s3_download_failed key=%s", self.s3_key)
            return {"form_data": {}, "averages": {}}

    def save_data(self, form_data: Dict[str, Any], averages: Dict[str, str]) -> bool:
        try:
            data = {
                "form_data": form_data,
                "averages": averages
            }
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, data)
        except Exception as e:
            logger.exception("adhesion_test_s3_upload_failed key=%s", self.s3_key)
            return False

    def delete_data(self) -> bool:
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            logger.exception("adhesion_test_s3_delete_failed key=%s", self.s3_key)
            return False

    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "s3_key": self.s3_key,
            "status": self.workflow_state,
            "workflowState": self.workflow_state,
            "createdByUserId": self.created_by_user_id,
            "createdByEmployeeName": self.created_by_employee_name,
            "createdByEmployeeId": self.created_by_employee_id,
            "submittedAt": self.submitted_at,
            "submittedBy": self.submitted_by,
            "approvedAt": self.approved_at,
            "approvedBy": self.approved_by,
            "returnedAt": self.returned_at,
            "returnedBy": self.returned_by,
            "returnComments": self.return_comments,
            "isSigned": self.is_signed,
            "signedAt": self.signed_at,
            "updatedAt": self.updated_at
        }
        if include_data:
            data = self.get_data()
            result["form_data"] = data["form_data"]
            result["averages"] = data["averages"]
        return result

    @staticmethod
    def create_from_data(name: str, timestamp: str, mongo_id: str, form_data: Dict[str, Any], averages: Dict[str, str]) -> 'AdhesionTestReport':
        s3_service = S3Service()
        s3_key = s3_service.generate_fixed_s3_key('adhesion', mongo_id)
        report = AdhesionTestReport(name=name, timestamp=timestamp, s3_key=s3_key)
        data = { "form_data": form_data, "averages": averages }
        success = s3_service.uploadOrOverwriteJson(s3_key, data)
        if not success:
            raise Exception("Failed to upload adhesion test data to S3")
        return report

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AdhesionTestReport':
        return AdhesionTestReport(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            s3_key=data["s3_key"],
            # Legacy reports did not store workflow metadata; treat them as submitted.
            workflow_state=data.get("workflowState", "submitted"),
            created_by_user_id=data.get("createdByUserId"),
            created_by_employee_name=data.get("createdByEmployeeName"),
            created_by_employee_id=data.get("createdByEmployeeId"),
            submitted_at=data.get("submittedAt"),
            submitted_by=data.get("submittedBy"),
            approved_at=data.get("approvedAt"),
            approved_by=data.get("approvedBy"),
            returned_at=data.get("returnedAt"),
            returned_by=data.get("returnedBy"),
            return_comments=data.get("returnComments"),
            is_signed=data.get("isSigned", data.get("workflowState", "submitted") == "submitted"),
            signed_at=data.get("signedAt"),
            updated_at=data.get("updatedAt")
        )
