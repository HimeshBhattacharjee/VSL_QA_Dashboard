from pymongo import MongoClient, ASCENDING
from typing import Optional, Dict, Any, List
from datetime import datetime
from constants import MONGODB_URI, MONGODB_DB_NAME

def _normalize_line_group(line_group):
    return 'Line-II' if str(line_group or '').endswith('Line-II') or str(line_group or '') == 'Line-II' else 'Line-I'

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
wet_leakage_entries_collection = db["wet_leakage_daily_entries"]
try:
    wet_leakage_entries_collection.drop_index("date_1")
except Exception:
    pass
wet_leakage_entries_collection.create_index([("date", ASCENDING), ("lineGroup", ASCENDING)], unique=True)
wet_leakage_entries_collection.create_index([("year", ASCENDING), ("month", ASCENDING)])

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

    def update_one(self, filt, update, upsert=False):
        date_key = filt.get("date")
        line_group = _normalize_line_group(filt.get("lineGroup"))
        composite_key = f"{date_key}_{line_group}" if date_key and "lineGroup" in filt else date_key
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
                if date_key:
                    set_doc["date"] = date_key
                if "lineGroup" in filt:
                    set_doc["lineGroup"] = line_group
                self._store[composite_key] = set_doc
                class R: upserted_id = composite_key
                return R()
            class R: upserted_id = None
            return R()

    def find_one(self, filt):
        date_key = filt.get("date")
        if date_key and "lineGroup" in filt:
            line_group = _normalize_line_group(filt.get("lineGroup"))
            return self._store.get(f"{date_key}_{line_group}") or self._store.get(date_key)
        if date_key:
            for value in self._store.values():
                if value.get("date") == date_key:
                    return value
            return self._store.get(date_key)
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
                if v.get(k) != val:
                    match = False
                    break
            if match:
                results.append(v)
        return _InMemoryCursor(results)

    def delete_one(self, filt):
        date_key = filt.get("date")
        line_group = _normalize_line_group(filt.get("lineGroup"))
        composite_key = f"{date_key}_{line_group}" if date_key and "lineGroup" in filt else date_key
        if composite_key and composite_key in self._store:
            del self._store[composite_key]
            class R: deleted_count = 1
            return R()
        class R: deleted_count = 0
        return R()

try:
    if not MONGODB_URI or not MONGODB_DB_NAME:
        raise Exception("Missing MongoDB config")
except Exception:
    print("Warning: MongoDB not configured; using in-memory wet_leakage_entries_collection for testing")
    wet_leakage_entries_collection = _InMemoryCollection()

class WetLeakageDailyEntry:
    @staticmethod
    def create(entry_data: Dict[str, Any]) -> str:
        try:
            raw_date = entry_data.get("date")
            if not raw_date:
                raise ValueError("Missing date in entry_data")
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
            if "_id" in entry_data:
                del entry_data["_id"]
            result = wet_leakage_entries_collection.update_one(
                {"date": entry_data["date"], "lineGroup": entry_data["lineGroup"]},
                {"$set": entry_data},
                upsert=True
            )
            if result.upserted_id:
                return str(result.upserted_id)
            existing = wet_leakage_entries_collection.find_one({"date": entry_data["date"], "lineGroup": entry_data["lineGroup"]})
            return str(existing["_id"]) if existing else None
        except Exception as e:
            print(f"Error in create: {str(e)}")
            raise
    
    @staticmethod
    def get_by_date(date: str, line_group: str = "Line-I") -> Optional[Dict[str, Any]]:
        try:
            date_key = str(date).split('T')[0]
            return wet_leakage_entries_collection.find_one({"date": date_key, "lineGroup": _normalize_line_group(line_group)})
        except Exception as e:
            print(f"Error in get_by_date: {str(e)}")
            return None
    
    @staticmethod
    def get_month_entries(year: int, month: int) -> List[Dict[str, Any]]:
        try:
            cursor = wet_leakage_entries_collection.find(
                {"year": year, "month": month}
            ).sort("date", ASCENDING)
            return list(cursor)
        except Exception as e:
            print(f"Error in get_month_entries: {str(e)}")
            return []
    
    @staticmethod
    def delete_by_date(date: str, line_group: str = "Line-I") -> bool:
        try:
            result = wet_leakage_entries_collection.delete_one({"date": date, "lineGroup": _normalize_line_group(line_group)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error in delete_by_date: {str(e)}")
            return False
