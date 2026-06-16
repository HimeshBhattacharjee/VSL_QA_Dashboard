from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ASCENDING, MongoClient

from constants import MONGODB_URI, MONGODB_DB_NAME


def normalize_line(line: str | None) -> str:
    return "FAB-II Line-II" if line == "FAB-II Line-II" else "FAB-II Line-I"


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
bus_ribbon_pull_strength_entries_collection = db["bus_ribbon_pull_strength_daily_entries"]

bus_ribbon_pull_strength_entries_collection.create_index(
    [("date", ASCENDING), ("line", ASCENDING), ("shift", ASCENDING)],
    unique=True,
)
bus_ribbon_pull_strength_entries_collection.create_index([("year", ASCENDING), ("month", ASCENDING)])


class BusRibbonPullStrengthDailyEntry:
    @staticmethod
    def create(entry_data: Dict[str, Any]) -> Optional[str]:
        raw_date = entry_data.get("date")
        if not raw_date:
            raise ValueError("Missing date in entry_data")
        shift = entry_data.get("shift")
        if not shift:
            raise ValueError("Missing shift in entry_data")

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
        entry_data["line"] = normalize_line(entry_data.get("line"))
        entry_data["year"] = date_obj.year
        entry_data["month"] = date_obj.month
        entry_data["updated_at"] = datetime.now().isoformat()
        if "created_at" not in entry_data:
            entry_data["created_at"] = datetime.now().isoformat()
        if "_id" in entry_data:
            del entry_data["_id"]

        result = bus_ribbon_pull_strength_entries_collection.update_one(
            {"date": entry_data["date"], "line": entry_data["line"], "shift": shift},
            {"$set": entry_data},
            upsert=True,
        )
        if result.upserted_id:
            return str(result.upserted_id)

        existing = bus_ribbon_pull_strength_entries_collection.find_one(
            {"date": entry_data["date"], "line": entry_data["line"], "shift": shift}
        )
        return str(existing["_id"]) if existing and "_id" in existing else None

    @staticmethod
    def get_by_date_line_shift(date: str, line: str, shift: str) -> Optional[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        return bus_ribbon_pull_strength_entries_collection.find_one(
            {"date": date_key, "line": normalize_line(line), "shift": shift}
        )

    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        cursor = bus_ribbon_pull_strength_entries_collection.find({"date": date_key}).sort("shift", ASCENDING)
        return list(cursor)

    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        cursor = bus_ribbon_pull_strength_entries_collection.find(
            {"year": year, "month": month}
        ).sort([("date", ASCENDING), ("shift", ASCENDING)])
        return list(cursor)

    @staticmethod
    def delete_by_date_line_shift(date: str, line: str, shift: str) -> bool:
        result = bus_ribbon_pull_strength_entries_collection.delete_one(
            {"date": str(date).split("T")[0], "line": normalize_line(line), "shift": shift}
        )
        return result.deleted_count > 0

    @staticmethod
    def update_context_signatures(date: str, line: str, shift: str, signatures: Dict[str, str]) -> bool:
        result = bus_ribbon_pull_strength_entries_collection.update_many(
            {"date": str(date).split("T")[0], "line": normalize_line(line), "shift": shift},
            {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}},
        )
        return result.modified_count > 0

    @staticmethod
    def get_context_signatures(date: str, line: str, shift: str) -> Dict[str, str]:
        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date, line, shift)
        if entry and entry.get("signatures"):
            return entry["signatures"]
        return {"preparedBy": "", "reviewedBy": ""}
