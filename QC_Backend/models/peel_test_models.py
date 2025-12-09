from pymongo import MongoClient
from typing import Optional, List, Dict, Any
from constants import MONGODB_URI

client = MongoClient(MONGODB_URI)
db = client["report_management"]
peel_test_collection = db["peel_test_reports"]

class PeelTestReport:
    def __init__(self, name: str, timestamp: str, form_data: Dict[str, Any], row_data: List[Any], averages: Dict[str, str], _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.form_data = form_data
        self.row_data = row_data
        self.averages = averages

    def to_dict(self):
        return {
            "name": self.name,
            "timestamp": self.timestamp,
            "form_data": self.form_data,
            "row_data": self.row_data,
            "averages": self.averages
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]):
        return PeelTestReport(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            form_data=data["form_data"],
            row_data=data.get("row_data", []),
            averages=data.get("averages", {})
        )