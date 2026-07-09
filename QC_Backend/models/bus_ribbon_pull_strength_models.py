from datetime import datetime
import logging
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, MongoClient

from constants import MONGODB_URI, MONGODB_DB_NAME
from mongo_indexes import ensure_index

logger = logging.getLogger(__name__)


def normalize_line(line: str | None) -> str:
    return "FAB-II Line-II" if line == "FAB-II Line-II" else "FAB-II Line-I"


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
bus_ribbon_pull_strength_entries_collection = db["bus_ribbon_pull_strength_daily_entries"]

try:
    ensure_index(
        bus_ribbon_pull_strength_entries_collection,
        [("date", ASCENDING), ("line", ASCENDING), ("shift", ASCENDING)],
        unique=True,
        name="bus_ribbon_date_line_shift_unique_idx",
    )
    ensure_index(
        bus_ribbon_pull_strength_entries_collection,
        [("year", ASCENDING), ("month", ASCENDING)],
        name="bus_ribbon_year_month_idx",
    )
except Exception as exc:
    logger.warning("failed_to_prepare_bus_ribbon_base_indexes error=%s", exc, exc_info=True)


def ensure_bus_ribbon_pull_strength_indexes() -> None:
    try:
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("updatedAt", DESCENDING)], name="bus_ribbon_updated_at_desc_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("createdAt", DESCENDING)], name="bus_ribbon_created_at_desc_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("workflowState", ASCENDING)], name="bus_ribbon_workflow_state_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("status", ASCENDING)], name="bus_ribbon_status_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("date", DESCENDING)], name="bus_ribbon_date_desc_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("shift", ASCENDING)], name="bus_ribbon_shift_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("line", ASCENDING)], name="bus_ribbon_line_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("shiftDetails.poNumber", ASCENDING)], name="bus_ribbon_po_idx")
        ensure_index(bus_ribbon_pull_strength_entries_collection, [("createdByEmployeeId", ASCENDING)], name="bus_ribbon_created_by_employee_id_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_bus_ribbon_pull_strength_indexes error=%s", exc, exc_info=True)


ensure_bus_ribbon_pull_strength_indexes()


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
    def get_by_id(entry_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(entry_id):
            return None
        return bus_ribbon_pull_strength_entries_collection.find_one({"_id": ObjectId(entry_id)})

    @staticmethod
    def update_by_id(entry_id: str, update_data: Dict[str, Any], unset_data: Dict[str, str] | None = None) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        update_statement: Dict[str, Any] = {"$set": update_data}
        if unset_data:
            update_statement["$unset"] = unset_data
        result = bus_ribbon_pull_strength_entries_collection.update_one(
            {"_id": ObjectId(entry_id)},
            update_statement,
        )
        return result.matched_count == 1

    @staticmethod
    def delete_by_id(entry_id: str) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        result = bus_ribbon_pull_strength_entries_collection.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0

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
