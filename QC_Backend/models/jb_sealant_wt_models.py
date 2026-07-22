from bson import ObjectId
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from typing import Optional, Dict, Any, List
from datetime import datetime
from constants import MONGODB_URI, MONGODB_DB_NAME
from mongo_indexes import drop_index_if_exists, ensure_index
from line_status import normalize_lines

logger = logging.getLogger(__name__)

def _normalize_line_group(line_group):
    return 'Line-II' if line_group == 'Line-II' else 'Line-I'

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
jb_sealant_entries_collection = db["jb_sealant_daily_entries"]
try:
    drop_index_if_exists(jb_sealant_entries_collection, "date_1_shift_1")
    ensure_index(
        jb_sealant_entries_collection,
        [("date", ASCENDING), ("lineGroup", ASCENDING), ("shift", ASCENDING)],
        unique=True,
        name="jb_sealant_date_line_group_shift_unique_idx",
    )
    ensure_index(jb_sealant_entries_collection, [("year", ASCENDING), ("month", ASCENDING)], name="jb_sealant_year_month_idx")
except Exception as exc:
    logger.warning("failed_to_prepare_jb_sealant_base_indexes error=%s", exc, exc_info=True)

def ensure_jb_sealant_indexes() -> None:
    try:
        ensure_index(jb_sealant_entries_collection, [("updatedAt", DESCENDING)], name="jb_sealant_updated_at_desc_idx")
        ensure_index(jb_sealant_entries_collection, [("createdAt", DESCENDING)], name="jb_sealant_created_at_desc_idx")
        ensure_index(jb_sealant_entries_collection, [("workflowState", ASCENDING)], name="jb_sealant_workflow_state_idx")
        ensure_index(jb_sealant_entries_collection, [("status", ASCENDING)], name="jb_sealant_status_idx")
        ensure_index(jb_sealant_entries_collection, [("date", DESCENDING)], name="jb_sealant_date_desc_idx")
        ensure_index(jb_sealant_entries_collection, [("shift", ASCENDING)], name="jb_sealant_shift_idx")
        ensure_index(jb_sealant_entries_collection, [("lineGroup", ASCENDING)], name="jb_sealant_line_group_idx")
        ensure_index(jb_sealant_entries_collection, [("lines.1.po", ASCENDING)], name="jb_sealant_line_1_po_idx")
        ensure_index(jb_sealant_entries_collection, [("lines.2.po", ASCENDING)], name="jb_sealant_line_2_po_idx")
        ensure_index(jb_sealant_entries_collection, [("createdByEmployeeId", ASCENDING)], name="jb_sealant_created_by_employee_id_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_jb_sealant_indexes error=%s", exc, exc_info=True)


ensure_jb_sealant_indexes()

class _InMemoryCursor:
    def __init__(self, items):
        self._items = items

    def sort(self, key, direction=1):
        reverse = direction == -1
        try:
            return sorted(self._items, key=lambda x: x.get(key), reverse=reverse)
        except Exception:
            return self._items

class _InMemoryCollection:
    def __init__(self):
        self._store = {}

    def create_index(self, *args, **kwargs):
        return None

    def drop_index(self, *args, **kwargs):
        return None

    def update_one(self, filt, update, upsert=False):
        if "_id" in filt:
            for key, value in list(self._store.items()):
                if str(value.get("_id")) == str(filt["_id"]):
                    value.update(update.get("$set", {}))
                    for unset_key in update.get("$unset", {}):
                        value.pop(unset_key, None)
                    self._store[key] = value
                    class R:
                        matched_count = 1
                        upserted_id = None
                    return R()
            class R:
                matched_count = 0
                upserted_id = None
            return R()

        date_key = filt.get("date")
        shift = filt.get("shift")
        line_group = _normalize_line_group(filt.get("lineGroup"))
        composite_key = f"{date_key}_{line_group}_{shift}" if date_key and shift else date_key
        doc = self._store.get(composite_key)
        if doc:
            set_doc = update.get("$set", {})
            doc.update(set_doc)
            self._store[composite_key] = doc
            class R:
                matched_count = 1
                upserted_id = None
            return R()
        else:
            if upsert:
                set_doc = update.get("$set", {})
                set_doc["date"] = date_key
                set_doc["shift"] = shift
                set_doc["lineGroup"] = line_group
                set_doc["_id"] = set_doc.get("_id") or composite_key
                self._store[composite_key] = set_doc
                class R:
                    matched_count = 0
                    upserted_id = composite_key
                return R()
            class R:
                matched_count = 0
                upserted_id = None
            return R()

    def find_one(self, filt):
        date_key = filt.get("date")
        shift = filt.get("shift")
        if date_key and shift:
            line_group = _normalize_line_group(filt.get("lineGroup"))
            composite_key = f"{date_key}_{line_group}_{shift}"
            doc = self._store.get(composite_key)
            if doc is None and "lineGroup" not in filt:
                doc = self._store.get(f"{date_key}_Line-I_{shift}") or self._store.get(f"{date_key}_{shift}")
            return doc
        if date_key and not shift:
            results = []
            for key, value in self._store.items():
                if value.get("date") == date_key:
                    results.append(value)
            return results if results else None
        for v in self._store.values():
            match = True
            for k, val in filt.items():
                if v.get(k) != val:
                    match = False
                    break
            if match:
                return v
        return None

    def find(self, filt=None):
        filt = filt or {}
        results = []
        for v in self._store.values():
            match = True
            for k, val in filt.items():
                if k == "date" and val:
                    if v.get("date") != val:
                        match = False
                        break
                elif k == "shift" and val:
                    if v.get("shift") != val:
                        match = False
                        break
                elif v.get(k) != val:
                    match = False
                    break
            if match:
                results.append(v)
        return _InMemoryCursor(results)

    def delete_one(self, filt):
        if "_id" in filt:
            for key, value in list(self._store.items()):
                if str(value.get("_id")) == str(filt["_id"]):
                    del self._store[key]
                    class R: deleted_count = 1
                    return R()

        date_key = filt.get("date")
        shift = filt.get("shift")
        if date_key and shift:
            line_group = _normalize_line_group(filt.get("lineGroup"))
            composite_key = f"{date_key}_{line_group}_{shift}"
            if composite_key in self._store:
                del self._store[composite_key]
                class R: deleted_count = 1
                return R()
        class R: deleted_count = 0
        return R()

    def update_many(self, filt, update):
        count = 0
        for key, value in list(self._store.items()):
            match = True
            for field, expected in (filt or {}).items():
                if field == "lineGroup":
                    expected = _normalize_line_group(expected)
                if value.get(field) != expected:
                    match = False
                    break
            if not match:
                continue
            set_doc = update.get("$set", {})
            value.update(set_doc)
            self._store[key] = value
            count += 1
        class R: modified_count = count
        return R()

try:
    if not MONGODB_URI or not MONGODB_DB_NAME:
        raise Exception("Missing MongoDB config")
except Exception:
    logger.warning("mongodb_not_configured_using_in_memory_jb_sealant_entries_collection")
    jb_sealant_entries_collection = _InMemoryCollection()

class JBSealantDailyEntry:
    @staticmethod
    def create(entry_data: Dict[str, Any]) -> str:
        entry_data["lines"] = normalize_lines(entry_data.get("lines"), ("1", "2"))
        try:
            raw_date = entry_data.get("date")
            if not raw_date:
                raise ValueError("Missing date in entry_data")
            shift = entry_data.get("shift")
            if not shift:
                raise ValueError("Missing shift in entry_data")
            
            date_key = str(raw_date).split('T')[0]
            try:
                date_obj = datetime.strptime(date_key, "%Y-%m-%d")
            except Exception:
                date_obj = datetime.fromisoformat(date_key)
            
            entry_data["date"] = date_obj.strftime("%Y-%m-%d")
            entry_data["lineGroup"] = _normalize_line_group(entry_data.get("lineGroup"))
            entry_data["testingDate"] = entry_data.get("testingDate") and str(entry_data.get("testingDate")).split('T')[0] or entry_data["date"]
            entry_data["year"] = date_obj.year
            entry_data["month"] = date_obj.month
            if "created_at" not in entry_data:
                entry_data["created_at"] = datetime.now().isoformat()
            entry_data["updated_at"] = datetime.now().isoformat()
            
            # Ensure JB position fields exist with proper structure
            if "lines" in entry_data:
                for line_num in ["1", "2"]:
                    if line_num in entry_data["lines"]:
                        line = entry_data["lines"][line_num]
                        # Ensure all JB position objects exist
                        if "positiveJB" not in line:
                            line["positiveJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
                        if "middleJB" not in line:
                            line["middleJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
                        if "negativeJB" not in line:
                            line["negativeJB"] = {"jbWeight": "", "jbWeightWithSealant": "", "netSealantWeight": ""}
                        
                        # Calculate total module weight if not present
                        if "totalModuleWeight" not in line or not line["totalModuleWeight"]:
                            try:
                                positive = float(line["positiveJB"].get("netSealantWeight", 0) or 0)
                                middle = float(line["middleJB"].get("netSealantWeight", 0) or 0)
                                negative = float(line["negativeJB"].get("netSealantWeight", 0) or 0)
                                line["totalModuleWeight"] = str(positive + middle + negative)
                            except (ValueError, TypeError):
                                line["totalModuleWeight"] = ""
            
            # Remove _id if present
            if "_id" in entry_data:
                del entry_data["_id"]
            
            result = jb_sealant_entries_collection.update_one(
                {"date": entry_data["date"], "lineGroup": entry_data["lineGroup"], "shift": shift},
                {"$set": entry_data},
                upsert=True
            )
            
            if result.upserted_id:
                return str(result.upserted_id)
            existing = jb_sealant_entries_collection.find_one({"date": entry_data["date"], "lineGroup": entry_data["lineGroup"], "shift": shift})
            return str(existing["_id"]) if existing and "_id" in existing else None
        except Exception as e:
            logger.exception("jb_sealant_create_failed")
            raise
    
    @staticmethod
    def get_by_date_and_shift(date: str, shift: str, line_group: str = "Line-I") -> Optional[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            return jb_sealant_entries_collection.find_one({"date": date_key, "lineGroup": _normalize_line_group(line_group), "shift": shift})
        except Exception as e:
            logger.exception("jb_sealant_get_by_date_and_shift_failed")
            return None

    @staticmethod
    def get_by_id(entry_id: str) -> Optional[Dict[str, Any]]:
        try:
            if not ObjectId.is_valid(entry_id):
                return None
            return jb_sealant_entries_collection.find_one({"_id": ObjectId(entry_id)})
        except Exception as e:
            logger.exception("jb_sealant_get_by_id_failed")
            return None

    @staticmethod
    def update_by_id(entry_id: str, update_data: Dict[str, Any], unset_data: Dict[str, str] | None = None) -> bool:
        try:
            if not ObjectId.is_valid(entry_id):
                return False
            update_statement: Dict[str, Any] = {"$set": update_data}
            if unset_data:
                update_statement["$unset"] = unset_data
            result = jb_sealant_entries_collection.update_one(
                {"_id": ObjectId(entry_id)},
                update_statement,
            )
            return result.matched_count == 1
        except Exception as e:
            logger.exception("jb_sealant_update_by_id_failed")
            return False

    @staticmethod
    def delete_by_id(entry_id: str) -> bool:
        try:
            if not ObjectId.is_valid(entry_id):
                return False
            result = jb_sealant_entries_collection.delete_one({"_id": ObjectId(entry_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.exception("jb_sealant_delete_by_id_failed")
            return False
    
    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            cursor = jb_sealant_entries_collection.find({"date": date_key}).sort("shift", ASCENDING)
            return list(cursor)
        except Exception as e:
            logger.exception("jb_sealant_get_all_for_date_failed")
            return []
    
    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        try:
            cursor = jb_sealant_entries_collection.find(
                {"year": year, "month": month}
            ).sort([("date", ASCENDING), ("shift", ASCENDING)])
            return list(cursor)
        except Exception as e:
            logger.exception("jb_sealant_get_month_entries_failed")
            return []
    
    @staticmethod
    def delete_by_date_and_shift(date: str, shift: str, line_group: str = "Line-I") -> bool:
        try:
            result = jb_sealant_entries_collection.delete_one({"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift})
            return result.deleted_count > 0
        except Exception as e:
            logger.exception("jb_sealant_delete_by_date_and_shift_failed")
            return False
    
    @staticmethod
    def update_context_signatures(date: str, line_group: str, shift: str, signatures: Dict[str, str]) -> bool:
        """Update signatures for one line group and shift on a specific date."""
        try:
            result = jb_sealant_entries_collection.update_many(
                {"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift},
                {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.exception("jb_sealant_update_context_signatures_failed")
            return False
    
    @staticmethod
    def get_context_signatures(date: str, line_group: str = "Line-I", shift: str = "A") -> Optional[Dict[str, str]]:
        """Get signatures for one line group and shift."""
        try:
            entries = jb_sealant_entries_collection.find({"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift})
            for entry in entries:
                if entry.get("signatures"):
                    return entry.get("signatures")
            return {"preparedBy": "", "verifiedBy": ""}
        except Exception as e:
            logger.exception("jb_sealant_get_context_signatures_failed")
            return {"preparedBy": "", "verifiedBy": ""}
