from datetime import datetime
import logging
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, MongoClient

from constants import MONGODB_DB_NAME, MONGODB_URI
from mongo_indexes import drop_index_if_exists, ensure_index
from report_context import apply_report_context, normalize_fab_line

logger = logging.getLogger(__name__)


def normalize_fab(fab: str | None) -> str:
    return normalize_fab_line(fab)


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
jb_contact_block_entries_collection = db["jb_contact_block_maintenance_daily_entries"]


def ensure_jb_contact_block_indexes() -> None:
    try:
        for index_name in ("date_1_fab_1", "jb_contact_block_daily_context_idx"):
            drop_index_if_exists(jb_contact_block_entries_collection, index_name)

        ensure_index(jb_contact_block_entries_collection, [("date", ASCENDING)], name="jb_contact_block_date_idx")
        ensure_index(jb_contact_block_entries_collection, [("date", DESCENDING)], name="jb_contact_block_date_desc_idx")
        ensure_index(
            jb_contact_block_entries_collection,
            [("reportDate", ASCENDING), ("fabLine", ASCENDING)],
            name="jb_contact_block_report_context_unique",
            unique=True,
            partialFilterExpression={"reportDate": {"$type": "string"}, "fabLine": {"$in": ["FAB-II Line-I", "FAB-II Line-II"]}},
        )
        ensure_index(jb_contact_block_entries_collection, [("year", ASCENDING), ("month", ASCENDING)], name="jb_contact_block_year_month_idx")
        ensure_index(jb_contact_block_entries_collection, [("updatedAt", DESCENDING)], name="jb_contact_block_updated_at_desc_idx")
        ensure_index(jb_contact_block_entries_collection, [("createdAt", DESCENDING)], name="jb_contact_block_created_at_desc_idx")
        ensure_index(jb_contact_block_entries_collection, [("workflowState", ASCENDING)], name="jb_contact_block_workflow_state_idx")
        ensure_index(jb_contact_block_entries_collection, [("status", ASCENDING)], name="jb_contact_block_status_idx")
        ensure_index(jb_contact_block_entries_collection, [("poSummary", ASCENDING)], name="jb_contact_block_po_summary_idx")
        ensure_index(jb_contact_block_entries_collection, [("createdByEmployeeId", ASCENDING)], name="jb_contact_block_created_by_employee_id_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_jb_contact_block_indexes error=%s", exc, exc_info=True)


ensure_jb_contact_block_indexes()


class JBContactBlockMaintenanceDailyEntry:
    @staticmethod
    def _normalize_dates(entry_data: Dict[str, Any]) -> Dict[str, Any]:
        raw_date = entry_data.get("date")
        if not raw_date:
            raise ValueError("Missing date in entry_data")

        date_key = str(raw_date).split("T")[0]
        try:
            date_obj = datetime.strptime(date_key, "%Y-%m-%d")
        except Exception:
            date_obj = datetime.fromisoformat(date_key)

        normalized = apply_report_context(entry_data)
        normalized["date"] = date_obj.strftime("%Y-%m-%d")
        normalized["testingDate"] = (
            str(normalized.get("testingDate")).split("T")[0]
            if normalized.get("testingDate")
            else normalized["date"]
        )
        normalized["year"] = date_obj.year
        normalized["month"] = date_obj.month
        normalized["updated_at"] = datetime.now().isoformat()
        if "created_at" not in normalized:
            normalized["created_at"] = datetime.now().isoformat()
        return normalized

    @staticmethod
    def create(entry_data: Dict[str, Any]) -> str:
        normalized = JBContactBlockMaintenanceDailyEntry._normalize_dates(entry_data)
        normalized.pop("_id", None)
        result = jb_contact_block_entries_collection.insert_one(normalized)
        return str(result.inserted_id)

    @staticmethod
    def get_by_id(entry_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(entry_id):
            return None
        return jb_contact_block_entries_collection.find_one({"_id": ObjectId(entry_id)})

    @staticmethod
    def update_by_id(entry_id: str, update_data: Dict[str, Any], unset_data: Dict[str, str] | None = None) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        normalized = JBContactBlockMaintenanceDailyEntry._normalize_dates(update_data)
        normalized.pop("_id", None)
        if unset_data:
            for field in unset_data:
                normalized.pop(field, None)
        update_statement: Dict[str, Any] = {"$set": normalized}
        if unset_data:
            update_statement["$unset"] = unset_data
        result = jb_contact_block_entries_collection.update_one(
            {"_id": ObjectId(entry_id)},
            update_statement,
        )
        return result.matched_count == 1

    @staticmethod
    def delete_by_id(entry_id: str) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        result = jb_contact_block_entries_collection.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0

    @staticmethod
    def get_by_date_fab(date: str, fab: str) -> Optional[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        return jb_contact_block_entries_collection.find_one(
            {"date": date_key, "fab": normalize_fab(fab)}
        )

    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        date_key = str(date).split("T")[0]
        cursor = jb_contact_block_entries_collection.find({"date": date_key}).sort(
            [("createdAt", ASCENDING), ("created_at", ASCENDING)]
        )
        return list(cursor)

    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        cursor = jb_contact_block_entries_collection.find({"year": year, "month": month}).sort(
            [("date", ASCENDING), ("createdAt", ASCENDING), ("created_at", ASCENDING)]
        )
        return list(cursor)

    @staticmethod
    def delete_by_date_fab(date: str, fab: str) -> bool:
        result = jb_contact_block_entries_collection.delete_one(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab)}
        )
        return result.deleted_count > 0

    @staticmethod
    def update_daily_context_signatures(date: str, fab: str, signatures: Dict[str, str]) -> bool:
        result = jb_contact_block_entries_collection.update_many(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab)},
            {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}},
        )
        return result.modified_count > 0

    @staticmethod
    def get_daily_context_signatures(date: str, fab: str) -> Dict[str, str]:
        entry = jb_contact_block_entries_collection.find_one(
            {"date": str(date).split("T")[0], "fab": normalize_fab(fab)}
        )
        if entry and entry.get("signatures"):
            signatures = entry["signatures"]
            return {
                "preparedBy": signatures.get("preparedBy", ""),
                "verifiedBy": signatures.get("verifiedBy") or signatures.get("reviewedBy") or signatures.get("approvedBy", ""),
            }
        return {"preparedBy": "", "verifiedBy": ""}
