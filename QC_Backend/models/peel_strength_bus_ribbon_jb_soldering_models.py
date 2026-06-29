from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ASCENDING, MongoClient

from constants import MONGODB_DB_NAME, MONGODB_URI


def normalize_fab(fab: str | None) -> str:
    return "FAB-II Line-II" if fab == "FAB-II Line-II" else "FAB-II Line-I"


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
peel_strength_bus_ribbon_jb_entries_collection = db["peel_strength_bus_ribbon_jb_daily_entries"]

peel_strength_bus_ribbon_jb_entries_collection.create_index(
    [("date", ASCENDING), ("fab", ASCENDING), ("shift", ASCENDING)],
    unique=True,
)
peel_strength_bus_ribbon_jb_entries_collection.create_index([("year", ASCENDING), ("month", ASCENDING)])


class PeelStrengthBusRibbonJBDailyEntry:
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
        entry_data["fab"] = normalize_fab(entry_data.get("fab"))
        entry_data["year"] = date_obj.year
        entry_data["month"] = date_obj.month
        entry_data["updated_at"] = datetime.now().isoformat()
        if "created_at" not in entry_data:
            entry_data["created_at"] = datetime.now().isoformat()
        if "_id" in entry_data:
            del entry_data["_id"]

        result = peel_strength_bus_ribbon_jb_entries_collection.update_one(
            {"date": entry_data["date"], "fab": entry_data["fab"], "shift": shift},
            {"$set": entry_data},
            upsert=True,
        )
        if result.upserted_id:
            return str(result.upserted_id)

        existing = peel_strength_bus_ribbon_jb_entries_collection.find_one(
            {"date": entry_data["date"], "fab": entry_data["fab"], "shift": shift}
        )
        return str(existing["_id"]) if existing and "_id" in existing else None

    @staticmethod
    def get_by_date_fab_shift(date: str, fab: str, shift: str) -> Optional[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        return peel_strength_bus_ribbon_jb_entries_collection.find_one(
            {"date": date_key, "fab": normalize_fab(fab), "shift": shift}
        )

    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        cursor = peel_strength_bus_ribbon_jb_entries_collection.find({"date": date_key}).sort(
            [("fab", ASCENDING), ("shift", ASCENDING)]
        )
        return list(cursor)

    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        cursor = peel_strength_bus_ribbon_jb_entries_collection.find({"year": year, "month": month}).sort(
            [("date", ASCENDING), ("fab", ASCENDING), ("shift", ASCENDING)]
        )
        return list(cursor)

    @staticmethod
    def delete_by_date_fab_shift(date: str, fab: str, shift: str) -> bool:
        result = peel_strength_bus_ribbon_jb_entries_collection.delete_one(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab), "shift": shift}
        )
        return result.deleted_count > 0

    @staticmethod
    def update_context_signatures(date: str, fab: str, shift: str, signatures: Dict[str, str]) -> bool:
        result = peel_strength_bus_ribbon_jb_entries_collection.update_many(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab), "shift": shift},
            {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}},
        )
        return result.modified_count > 0

    @staticmethod
    def get_context_signatures(date: str, fab: str, shift: str) -> Dict[str, str]:
        entry = PeelStrengthBusRibbonJBDailyEntry.get_by_date_fab_shift(date, fab, shift)
        if entry and entry.get("signatures"):
            return entry["signatures"]
        return {"preparedBy": "", "verifiedBy": ""}
