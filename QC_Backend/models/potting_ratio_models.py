from pymongo import MongoClient, ASCENDING
from typing import Optional, Dict, Any, List
from datetime import datetime
from constants import MONGODB_URI, MONGODB_DB_NAME

def _normalize_line_group(line_group):
    return 'Line-II' if line_group == 'Line-II' else 'Line-I'

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
potting_entries_collection = db["potting_daily_entries"]
try:
    potting_entries_collection.drop_index("date_1_shift_1")
except Exception:
    pass
potting_entries_collection.create_index([("date", ASCENDING), ("lineGroup", ASCENDING), ("shift", ASCENDING)], unique=True)
potting_entries_collection.create_index([("year", ASCENDING), ("month", ASCENDING)])

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
        date_key = filt.get("date")
        shift = filt.get("shift")
        line_group = _normalize_line_group(filt.get("lineGroup"))
        composite_key = f"{date_key}_{line_group}_{shift}" if date_key and shift else date_key
        doc = self._store.get(composite_key)
        if doc:
            set_doc = update.get("$set", {})
            doc.update(set_doc)
            self._store[composite_key] = doc
            class R: upserted_id = None
            return R()
        else:
            if upsert:
                set_doc = update.get("$set", {})
                set_doc["date"] = date_key
                set_doc["shift"] = shift
                set_doc["lineGroup"] = line_group
                self._store[composite_key] = set_doc
                class R: upserted_id = composite_key
                return R()
            class R: upserted_id = None
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
            # For date-level operations, we might need to aggregate
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
    print("Warning: MongoDB not configured; using in-memory potting_entries_collection for testing")
    potting_entries_collection = _InMemoryCollection()

class PottingDailyEntry:
    @staticmethod
    def create(entry_data: Dict[str, Any]) -> str:
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
            entry_data["created_at"] = datetime.now().isoformat()
            entry_data["updated_at"] = datetime.now().isoformat()
            
            # Remove _id if present
            if "_id" in entry_data:
                del entry_data["_id"]
            
            result = potting_entries_collection.update_one(
                {"date": entry_data["date"], "lineGroup": entry_data["lineGroup"], "shift": shift},
                {"$set": entry_data},
                upsert=True
            )
            
            if result.upserted_id:
                return str(result.upserted_id)
            existing = potting_entries_collection.find_one({"date": entry_data["date"], "lineGroup": entry_data["lineGroup"], "shift": shift})
            return str(existing["_id"]) if existing and "_id" in existing else None
        except Exception as e:
            print(f"Error in create: {str(e)}")
            raise
    
    @staticmethod
    def get_by_date_and_shift(date: str, shift: str, line_group: str = "Line-I") -> Optional[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            return potting_entries_collection.find_one({"date": date_key, "lineGroup": _normalize_line_group(line_group), "shift": shift})
        except Exception as e:
            print(f"Error in get_by_date_and_shift: {str(e)}")
            return None
    
    @staticmethod
    def get_all_for_date(date: str) -> List[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            cursor = potting_entries_collection.find({"date": date_key}).sort("shift", ASCENDING)
            return list(cursor)
        except Exception as e:
            print(f"Error in get_all_for_date: {str(e)}")
            return []
    
    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        try:
            cursor = potting_entries_collection.find(
                {"year": year, "month": month}
            ).sort([("date", ASCENDING), ("shift", ASCENDING)])
            return list(cursor)
        except Exception as e:
            print(f"Error in get_month_entries: {str(e)}")
            return []
    
    @staticmethod
    def delete_by_date_and_shift(date: str, shift: str, line_group: str = "Line-I") -> bool:
        try:
            result = potting_entries_collection.delete_one({"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error in delete_by_date_and_shift: {str(e)}")
            return False
    
    @staticmethod
    def update_context_signatures(date: str, line_group: str, shift: str, signatures: Dict[str, str]) -> bool:
        """Update signatures for one line group and shift on a specific date."""
        try:
            # Update all entries for this date with the same signatures
            result = potting_entries_collection.update_many(
                {"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift},
                {"$set": {"signatures": signatures, "updated_at": datetime.now().isoformat()}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error in update_date_signatures: {str(e)}")
            return False
    
    @staticmethod
    def get_context_signatures(date: str, line_group: str = "Line-I", shift: str = "A") -> Optional[Dict[str, str]]:
        """Get signatures for one line group and shift."""
        try:
            entries = potting_entries_collection.find({"date": date, "lineGroup": _normalize_line_group(line_group), "shift": shift})
            for entry in entries:
                if entry.get("signatures"):
                    return entry.get("signatures")
            return {"preparedBy": "", "verifiedBy": ""}
        except Exception as e:
            print(f"Error in get_date_signatures: {str(e)}")
            return {"preparedBy": "", "verifiedBy": ""}