from pymongo import ASCENDING, DESCENDING, MongoClient
from typing import Optional, Dict, Any
from constants import MONGODB_URI, MONGODB_DB_NAME
from s3_service import S3Service

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
gel_test_collection = db["gel_test_reports"]

def ensure_gel_test_indexes() -> None:
    try:
        gel_test_collection.create_index([("updatedAt", DESCENDING)], name="gel_updated_at_desc_idx")
        gel_test_collection.create_index([("timestamp", DESCENDING)], name="gel_timestamp_desc_idx")
        gel_test_collection.create_index([("name", ASCENDING)], name="gel_name_idx")
        gel_test_collection.create_index([("workflowState", ASCENDING)], name="gel_workflow_state_idx")
        gel_test_collection.create_index([("createdByEmployeeId", ASCENDING)], name="gel_created_by_employee_id_idx")
    except Exception as exc:
        print(f"Warning: failed to ensure gel test indexes: {exc}")

ensure_gel_test_indexes()

class GelTestReport:
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
        returned_at: Optional[str] = None,
        returned_by: Optional[str] = None,
        return_comments: Optional[str] = None,
        is_signed: bool = True,
        signed_at: Optional[str] = None,
        updated_at: Optional[str] = None,
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
            print(f"Error retrieving gel test data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return {"form_data": {}, "averages": {}}

    def save_data(self, form_data: Dict[str, Any], averages: Dict[str, str]) -> bool:
        try:
            data = {
                "form_data": form_data,
                "averages": averages
            }
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, data)
        except Exception as e:
            print(f"Error saving gel test data to S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def delete_data(self) -> bool:
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            print(f"Error deleting gel test data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "s3_key": self.s3_key,
            "workflowState": self.workflow_state,
            "createdByUserId": self.created_by_user_id,
            "createdByEmployeeName": self.created_by_employee_name,
            "createdByEmployeeId": self.created_by_employee_id,
            "submittedAt": self.submitted_at,
            "submittedBy": self.submitted_by,
            "returnedAt": self.returned_at,
            "returnedBy": self.returned_by,
            "returnComments": self.return_comments,
            "isSigned": self.is_signed,
            "signedAt": self.signed_at,
            "updatedAt": self.updated_at,
        }

        if include_data:
            data = self.get_data()
            result["form_data"] = data["form_data"]
            result["averages"] = data["averages"]

        return result

    @staticmethod
    def create_from_data(name: str, timestamp: str, mongo_id: str, form_data: Dict[str, Any], averages: Dict[str, str]) -> 'GelTestReport':
        s3_service = S3Service()
        s3_key = s3_service.generate_fixed_s3_key('gel', mongo_id)
        report = GelTestReport(name=name, timestamp=timestamp, s3_key=s3_key)
        data = { "form_data": form_data, "averages": averages }
        success = s3_service.uploadOrOverwriteJson(s3_key, data)
        if not success:
            raise Exception("Failed to upload gel test data to S3")
        return report

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'GelTestReport':
        return GelTestReport(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            s3_key=data["s3_key"],
            workflow_state=data.get("workflowState", "submitted"),
            created_by_user_id=data.get("createdByUserId"),
            created_by_employee_name=data.get("createdByEmployeeName"),
            created_by_employee_id=data.get("createdByEmployeeId"),
            submitted_at=data.get("submittedAt"),
            submitted_by=data.get("submittedBy"),
            returned_at=data.get("returnedAt"),
            returned_by=data.get("returnedBy"),
            return_comments=data.get("returnComments"),
            is_signed=data.get("isSigned", data.get("workflowState", "submitted") == "submitted"),
            signed_at=data.get("signedAt"),
            updated_at=data.get("updatedAt"),
        )
