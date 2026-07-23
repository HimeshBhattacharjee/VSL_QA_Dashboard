from bson import ObjectId
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from typing import Optional, Dict, Any, List
from datetime import datetime
from constants import MONGODB_URI, MONGODB_DB_NAME
from mongo_indexes import drop_index_if_exists, ensure_index
from report_context import apply_report_context

logger = logging.getLogger(__name__)

def _normalize_line_group(line_group):
    return 'Line-II' if str(line_group or '').endswith('Line-II') or str(line_group or '') == 'Line-II' else 'Line-I'

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
wet_leakage_entries_collection = db["wet_leakage_daily_entries"]


def ensure_wet_leakage_indexes() -> None:
    try:
        for index_name in ("date_1", "date_1_lineGroup_1"):
            drop_index_if_exists(wet_leakage_entries_collection, index_name)

        ensure_index(wet_leakage_entries_collection, [("date", ASCENDING)], name="wet_leakage_date_idx")
        ensure_index(wet_leakage_entries_collection, [("date", DESCENDING)], name="wet_leakage_date_desc_idx")
        ensure_index(wet_leakage_entries_collection, [("reportDate", ASCENDING), ("fabLine", ASCENDING)], name="wet_leakage_report_context_unique", unique=True, partialFilterExpression={"reportDate": {"$type": "string"}, "fabLine": {"$in": ["FAB-II Line-I", "FAB-II Line-II"]}})
        ensure_index(wet_leakage_entries_collection, [("year", ASCENDING), ("month", ASCENDING)], name="wet_leakage_year_month_idx")
        ensure_index(wet_leakage_entries_collection, [("updatedAt", DESCENDING)], name="wet_leakage_updated_at_desc_idx")
        ensure_index(wet_leakage_entries_collection, [("createdAt", DESCENDING)], name="wet_leakage_created_at_desc_idx")
        ensure_index(wet_leakage_entries_collection, [("workflowState", ASCENDING)], name="wet_leakage_workflow_state_idx")
        ensure_index(wet_leakage_entries_collection, [("status", ASCENDING)], name="wet_leakage_status_idx")
        ensure_index(wet_leakage_entries_collection, [("po", ASCENDING)], name="wet_leakage_po_idx")
        ensure_index(wet_leakage_entries_collection, [("createdByEmployeeId", ASCENDING)], name="wet_leakage_created_by_employee_id_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_wet_leakage_indexes error=%s", exc, exc_info=True)


ensure_wet_leakage_indexes()

class _InMemoryCursor:
    def __init__(self, items):
        self._items = list(items)

    def __iter__(self):
        return iter(self._items)

    def sort(self, key, direction=1):
        if isinstance(key, list):
            sort_fields = list(reversed(key))
            for field, field_direction in sort_fields:
                self._items.sort(key=lambda item: _get_nested_value(item, field) or "", reverse=field_direction == -1)
            return self

        reverse = direction == -1
        try:
            self._items.sort(key=lambda item: _get_nested_value(item, key) or "", reverse=reverse)
        except Exception:
            pass
        return self

    def skip(self, count):
        self._items = self._items[count:]
        return self

    def limit(self, count):
        self._items = self._items[:count]
        return self


def _get_nested_value(doc, dotted_key):
    value = doc
    for part in str(dotted_key).split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _matches_condition(value, condition):
    import re

    if not isinstance(condition, dict):
        return value == condition

    for operator, expected in condition.items():
        if operator == "$gte" and not (value is not None and value >= expected):
            return False
        if operator == "$lte" and not (value is not None and value <= expected):
            return False
        if operator == "$ne" and value == expected:
            return False
        if operator == "$exists":
            exists = value is not None
            if bool(expected) != exists:
                return False
        if operator == "$regex":
            flags = re.IGNORECASE if condition.get("$options") == "i" else 0
            if re.search(expected, str(value or ""), flags) is None:
                return False
    return True


def _matches_filter(doc, filt):
    if not filt:
        return True
    for key, expected in filt.items():
        if key == "$and":
            if not all(_matches_filter(doc, item) for item in expected):
                return False
            continue
        if key == "$or":
            if not any(_matches_filter(doc, item) for item in expected):
                return False
            continue
        if not _matches_condition(_get_nested_value(doc, key), expected):
            return False
    return True


class _InMemoryCollection:
    def __init__(self):
        self._store = {}

    def drop_index(self, *args, **kwargs):
        return None

    def create_index(self, *args, **kwargs):
        return None

    def insert_one(self, doc):
        doc_copy = doc.copy()
        doc_copy["_id"] = ObjectId()
        self._store[str(doc_copy["_id"])] = doc_copy
        class R:
            inserted_id = doc_copy["_id"]
        return R()

    def update_one(self, filt, update, upsert=False):
        matched_key = None
        for key, doc in self._store.items():
            if _matches_filter(doc, filt):
                matched_key = key
                break
        if matched_key:
            doc = self._store[matched_key]
            set_doc = update.get("$set", {})
            doc.update(set_doc)
            for field in update.get("$unset", {}):
                doc.pop(field, None)
            self._store[matched_key] = doc
            class R:
                matched_count = 1
                modified_count = 1
                upserted_id = None
            return R()
        if upsert:
            set_doc = update.get("$set", {}).copy()
            for key, value in filt.items():
                if not key.startswith("$") and not isinstance(value, dict):
                    set_doc.setdefault(key, value)
            inserted = self.insert_one(set_doc)
            class R:
                matched_count = 0
                modified_count = 0
                upserted_id = inserted.inserted_id
            return R()
        class R:
            matched_count = 0
            modified_count = 0
            upserted_id = None
        return R()

    def find_one(self, filt):
        for value in self._store.values():
            if _matches_filter(value, filt):
                return value.copy()
        return None

    def find(self, filt=None, projection=None):
        filt = filt or {}
        results = [value.copy() for value in self._store.values() if _matches_filter(value, filt)]
        if projection:
            excluded = {key for key, include in projection.items() if include == 0}
            results = [{key: value for key, value in item.items() if key not in excluded} for item in results]
        return _InMemoryCursor(results)

    def count_documents(self, filt):
        return len([value for value in self._store.values() if _matches_filter(value, filt or {})])

    def delete_one(self, filt):
        for key, value in list(self._store.items()):
            if _matches_filter(value, filt):
                del self._store[key]
                class R:
                    deleted_count = 1
                return R()
        class R:
            deleted_count = 0
        return R()

    def aggregate(self, pipeline):
        items = list(self._store.values())
        for stage in pipeline:
            if "$match" in stage:
                items = [item for item in items if _matches_filter(item, stage["$match"])]
        summary = {
            "_id": None,
            "totalEntries": len(items),
            "draft": 0,
            "submitted": 0,
            "returned": 0,
            "approved": 0,
        }
        date_groups = {}
        daily_groups = {}
        for item in items:
            state = item.get("workflowState") or item.get("status") or "submitted"
            if state not in {"draft", "submitted", "approved", "returned"}:
                state = "submitted"
            summary[state] += 1
            for groups, key in ((date_groups, item.get("date") or ""), (daily_groups, item.get("date") or "")):
                group = groups.setdefault(key, {"_id": key, "totalEntries": 0, "draft": 0, "submitted": 0, "returned": 0, "approved": 0})
                group["totalEntries"] += 1
                group[state] += 1
        return [{
            "summary": [summary],
            "dateGroups": list(date_groups.values()),
            "shiftGroups": list(daily_groups.values()),
        }]

try:
    if not MONGODB_URI or not MONGODB_DB_NAME:
        raise Exception("Missing MongoDB config")
except Exception:
    logger.warning("mongodb_not_configured_using_in_memory_wet_leakage_entries_collection")
    wet_leakage_entries_collection = _InMemoryCollection()

class WetLeakageDailyEntry:
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
        try:
            normalized = WetLeakageDailyEntry._normalize_dates(entry_data)
            if "_id" in normalized:
                del normalized["_id"]
            result = wet_leakage_entries_collection.insert_one(normalized)
            return str(result.inserted_id)
        except Exception as e:
            logger.exception("wet_leakage_create_failed")
            raise

    @staticmethod
    def get_by_id(entry_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(entry_id):
            return None
        return wet_leakage_entries_collection.find_one({"_id": ObjectId(entry_id)})

    @staticmethod
    def update_by_id(entry_id: str, update_data: Dict[str, Any], unset_data: Dict[str, str] | None = None) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        normalized = WetLeakageDailyEntry._normalize_dates(update_data)
        normalized.pop("_id", None)
        if unset_data:
            for field in unset_data:
                normalized.pop(field, None)
        update_statement: Dict[str, Any] = {"$set": normalized}
        if unset_data:
            update_statement["$unset"] = unset_data
        result = wet_leakage_entries_collection.update_one(
            {"_id": ObjectId(entry_id)},
            update_statement,
        )
        return result.matched_count == 1

    @staticmethod
    def delete_by_id(entry_id: str) -> bool:
        if not ObjectId.is_valid(entry_id):
            return False
        result = wet_leakage_entries_collection.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0
    
    @staticmethod
    def get_by_date(date: str, line_group: str = "Line-I") -> Optional[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            return (
                wet_leakage_entries_collection.find_one({"date": date_key, "lineGroup": _normalize_line_group(line_group)})
                or wet_leakage_entries_collection.find_one({"date": date_key})
            )
        except Exception as e:
            logger.exception("wet_leakage_get_by_date_failed")
            return None

    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        try:
            date_key = str(date).split("T")[0]
            cursor = wet_leakage_entries_collection.find({"date": date_key}).sort([("createdAt", ASCENDING), ("created_at", ASCENDING)])
            return list(cursor)
        except Exception as e:
            logger.exception("wet_leakage_get_all_for_date_failed")
            return []
    
    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        try:
            cursor = wet_leakage_entries_collection.find(
                {"year": year, "month": month}
            ).sort([("date", ASCENDING), ("createdAt", ASCENDING), ("created_at", ASCENDING)])
            return list(cursor)
        except Exception as e:
            logger.exception("wet_leakage_get_month_entries_failed")
            return []
    
    @staticmethod
    def delete_by_date(date: str, line_group: str = "Line-I") -> bool:
        try:
            result = wet_leakage_entries_collection.delete_one({"date": str(date).split("T")[0], "lineGroup": _normalize_line_group(line_group)})
            if result.deleted_count == 0:
                result = wet_leakage_entries_collection.delete_one({"date": str(date).split("T")[0]})
            return result.deleted_count > 0
        except Exception as e:
            logger.exception("wet_leakage_delete_by_date_failed")
            return False
