from pymongo import MongoClient
from typing import Optional, List, Dict, Any
from constants import MONGODB_URI
from s3_service import S3Service

client = MongoClient(MONGODB_URI)
db = client["report_management"]
peel_test_collection = db["peel_test_reports"]

class PeelTestReport:
    def __init__(self, name: str, timestamp: str, s3_key: str, _id: Optional[str] = None):
        """
        Initialize PeelTestReport with S3 storage

        Args:
            name: Report name
            timestamp: Report timestamp
            s3_key: S3 object key where report data is stored
            _id: MongoDB document ID
        """
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.s3_key = s3_key
        self.s3_service = S3Service()

    def get_data(self) -> Dict[str, Any]:
        """Retrieve report data from S3"""
        try:
            data = self.s3_service.download_json(self.s3_key)
            return {
                "form_data": data.get("form_data", {}),
                "row_data": data.get("row_data", []),
                "averages": data.get("averages", {})
            }
        except Exception as e:
            print(f"Error retrieving peel test data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return {"form_data": {}, "row_data": [], "averages": {}}

    def save_data(self, form_data: Dict[str, Any], row_data: List[Any], averages: Dict[str, Any]) -> bool:
        """Save report data to S3"""
        try:
            data = {
                "form_data": form_data,
                "row_data": row_data,
                "averages": averages
            }
            # Overwrite existing S3 object using the fixed s3_key
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, data)
        except Exception as e:
            print(f"Error saving peel test data to S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def delete_data(self) -> bool:
        """Delete report data from S3"""
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            print(f"Error deleting peel test data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        """
        Convert to dictionary

        Args:
            include_data: Whether to include the actual data from S3
        """
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "s3_key": self.s3_key
        }

        if include_data:
            data = self.get_data()
            result["form_data"] = data["form_data"]
            result["row_data"] = data["row_data"]
            result["averages"] = data["averages"]

        return result

    @staticmethod
    def create_from_data(name: str, timestamp: str, mongo_id: str, form_data: Dict[str, Any], row_data: List[Any], averages: Dict[str, Any]) -> 'PeelTestReport':
        """Create a new report and save data to S3 using fixed S3 key based on MongoDB _id"""
        # Create S3 service
        s3_service = S3Service()

        # Generate FIXED S3 key using MongoDB _id
        s3_key = s3_service.generate_fixed_s3_key('peel', mongo_id)

        # Create report instance first
        report = PeelTestReport(
            name=name,
            timestamp=timestamp,
            s3_key=s3_key
        )

        # Upload data to S3 using the fixed key
        data = {
            "form_data": form_data,
            "row_data": row_data,
            "averages": averages
        }
        success = s3_service.uploadOrOverwriteJson(s3_key, data)

        if not success:
            raise Exception("Failed to upload peel test data to S3")

        return report

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'PeelTestReport':
        return PeelTestReport(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            s3_key=data["s3_key"]
        )