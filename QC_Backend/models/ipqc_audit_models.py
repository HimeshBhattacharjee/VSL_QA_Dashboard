from pymongo import MongoClient
from typing import Optional, Dict, Any
from constants import MONGODB_URI

client = MongoClient(MONGODB_URI)
db = client["report_management"]
ipqc_audit_collection = db["ipqc_audits"]

class IPQCAudit:
    def __init__(self, name: str, timestamp: str, data: Dict[str, Any], _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.data = data

    def to_dict(self):
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "data": self.data
        }
        if self._id:
            result["_id"] = self._id
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]):
        return IPQCAudit(
            _id=str(data.get("_id")) if data.get("_id") else None,
            name=data["name"],
            timestamp=data["timestamp"],
            data=data["data"]
        )