from pymongo import MongoClient
from typing import Optional, Dict, Any
from constants import MONGODB_URI, MONGODB_DB_NAME
from s3_service import S3Service

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
ipqc_audit_collection = db["ipqc_audits"]

DYNAMIC_LINE_PARAMETER_IDS = {
    "2-4", "2-5", "2-6",
    "3-7", "3-8", "3-9",
    "9-6", "9-7", "9-8",
    "10-4", "10-5", "10-6",
    "11-3", "11-4", "11-5",
}

def normalize_dynamic_line_selections(data: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill selectedLine for older audits while preserving existing payload shape."""
    for stage in data.get("stages", []):
        for parameter in stage.get("parameters", []):
            if parameter.get("id") not in DYNAMIC_LINE_PARAMETER_IDS:
                continue
            for observation in parameter.get("observations", []):
                time_slot = observation.get("timeSlot", "")
                if "selectedLine" not in observation and isinstance(time_slot, str) and time_slot.startswith("Line-"):
                    observation["selectedLine"] = time_slot.replace("Line-", "")
    return data

class IPQCAudit:
    def __init__(self, name: str, timestamp: str, s3_key: str, _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.s3_key = s3_key
        self.s3_service = S3Service()

    def get_data(self) -> Dict[str, Any]:
        try:
            return normalize_dynamic_line_selections(self.s3_service.download_json(self.s3_key))
        except Exception as e:
            print(f"Error retrieving IPQC audit data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return {}

    def save_data(self, data: Dict[str, Any]) -> bool:
        try:
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, normalize_dynamic_line_selections(data))
        except Exception as e:
            print(f"Error saving IPQC audit data to S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def delete_data(self) -> bool:
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            print(f"Error deleting IPQC audit data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "s3_key": self.s3_key
        }
        if include_data:
            result["data"] = self.get_data()
        return result

    @staticmethod
    def create_from_data(name: str, timestamp: str, mongo_id: str, data: Dict[str, Any]) -> 'IPQCAudit':
        s3_service = S3Service()
        s3_key = s3_service.generate_fixed_s3_key('ipqc-audit', mongo_id)
        audit = IPQCAudit(name=name, timestamp=timestamp, s3_key=s3_key)
        success = s3_service.uploadOrOverwriteJson(s3_key, normalize_dynamic_line_selections(data))
        if not success:
            raise Exception("Failed to upload IPQC audit data to S3")
        return audit

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'IPQCAudit':
        return IPQCAudit(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            s3_key=data["s3_key"]
        )
