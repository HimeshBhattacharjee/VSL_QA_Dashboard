from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ASCENDING, MongoClient

from constants import MONGODB_DB_NAME, MONGODB_URI


def normalize_fab(fab: str | None) -> str:
    return "FAB-II Line-II" if fab == "FAB-II Line-II" else "FAB-II Line-I"


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
jb_contact_block_entries_collection = db["jb_contact_block_maintenance_daily_entries"]

jb_contact_block_entries_collection.create_index(
    [("date", ASCENDING), ("fab", ASCENDING)],
    unique=True,
)
jb_contact_block_entries_collection.create_index([("year", ASCENDING), ("month", ASCENDING)])


class JBContactBlockMaintenanceDailyEntry:
    @staticmethod
    def create(entry_data: Dict[str, Any]) -> Optional[str]:
        raw_date = entry_data.get("date")
        if not raw_date:
            raise ValueError("Missing date in entry_data")

        date_key = str(raw_date).split("T")[0]
        try:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
        except Exception:
            date_obj = datetime.fromisoformat(date_key)

        entry_data["date"] = date_obj.strftime("%Y-%m-%d")
        entry_data["testingDate"] = (
            str(entry_data.get("testingDate")).split("T")[0]
            if entry_data.get("testingDate")
            else entry_data["date"]
        )
        entry_data["fab"] = normalize_fab(entry_data.get("fab"))
        entry_data["year"] = date_obj.year
        entry_data["month"] = date_obj.month
        entry_data["updated_at"] = datetime.now().isoformat()
        if "created_at" not in entry_data:
            entry_data["created_at"] = datetime.now().isoformat()
        if "_id" in entry_data:
            del entry_data["_id"]

        result = jb_contact_block_entries_collection.update_one(
            {"date": entry_data["date"], "fab": entry_data["fab"]},
            {"$set": entry_data},
            upsert=True,
        )
        if result.upserted_id:
            return str(result.upserted_id)

        existing = jb_contact_block_entries_collection.find_one(
            {"date": entry_data["date"], "fab": entry_data["fab"]}
        )
        return str(existing["_id"]) if existing and "_id" in existing else None

    @staticmethod
    def get_by_date_fab(date: str, fab: str) -> Optional[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        return jb_contact_block_entries_collection.find_one(
            {"date": date_key, "fab": normalize_fab(fab)}
        )

    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        cursor = jb_contact_block_entries_collection.find({"date": date_key}).sort("fab", ASCENDING)
        return list(cursor)

    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        cursor = jb_contact_block_entries_collection.find({"year": year, "month": month}).sort(
            [("date", ASCENDING), ("fab", ASCENDING)]
        )
        return list(cursor)

    @staticmethod
    def delete_by_date_fab(date: str, fab: str) -> bool:
        result = jb_contact_block_entries_collection.delete_one(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab)}
        )
        return result.deleted_count > 0

    @staticmethod
    def update_date_signatures(date: str, signatures: Dict[str, str]) -> bool:
        result = jb_contact_block_entries_collection.update_many(
            {"date": str(date).split("T")[0]},
            {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}},
        )
        return result.modified_count > 0

    @staticmethod
    def get_date_signatures(date: str) -> Dict[str, str]:
        entry = jb_contact_block_entries_collection.find_one({"date": str(date).split("T")[0]})
        if entry and entry.get("signatures"):
            return entry["signatures"]
        return {"preparedBy": "", "verifiedBy": ""}
