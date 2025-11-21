from pymongo import MongoClient
from datetime import datetime
from typing import Optional, List, Dict, Any
import os

client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
db = client["report_management"]
gel_test_collection = db["gel_test_reports"]

class GelTestReport:
    def __init__(self, name: str, timestamp: str, form_data: Dict[str, Any], averages: Dict[str, str], _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.form_data = form_data
        self.averages = averages

    def to_dict(self):
        return {
            "name": self.name,
            "timestamp": self.timestamp,
            "form_data": self.form_data,
            "averages": self.averages
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]):
        return GelTestReport(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            form_data=data["form_data"],
            averages=data["averages"]
        )