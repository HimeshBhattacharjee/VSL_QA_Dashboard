from pymongo import MongoClient
from datetime import datetime
from typing import Optional, List, Dict, Any
import os

client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
db = client["report_management"]
ipqc_audit_collection = db["ipqc_audits"]

class IPQCAudit:
    def __init__(self, name: str, timestamp: str, data: Dict[str, Any], _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.data = data

    def to_dict(self):
        return {
            "name": self.name,
            "timestamp": self.timestamp,
            "data": self.data
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]):
        return IPQCAudit(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            data=data["data"]
        )