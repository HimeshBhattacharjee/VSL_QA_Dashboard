import hashlib
import logging
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, OperationFailure, PyMongoError

from constants import MONGODB_DB_NAME, MONGODB_URI
from mongo_indexes import ensure_index

logger = logging.getLogger(__name__)


PEEL_DATA_COLLECTION_NAME = "peel_data"
PEEL_FILE_METADATA_COLLECTION_NAME = "peel_file_metadata"
PEEL_PROCESSING_FILES_COLLECTION_NAME = "peel_processing_files"

UNKNOWN_VALUE = "UNKNOWN"

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
peel_data_collection: Collection = db[PEEL_DATA_COLLECTION_NAME]
peel_file_metadata_collection: Collection = db[PEEL_FILE_METADATA_COLLECTION_NAME]
peel_processing_files_collection: Collection = db[PEEL_PROCESSING_FILES_COLLECTION_NAME]

MEASUREMENT_KEY_PATTERN = re.compile(r"^(Front|Back)_(\d+)_(\d+)$", re.IGNORECASE)
LEGACY_COLLECTION_PATTERN = re.compile(r"^peel_[a-z]{3}_\d{4}$", re.IGNORECASE)


def utc_now() -> datetime:
    return datetime.utcnow()


def parse_date_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    raw = str(value).strip()
    if not raw:
        return None

    raw = raw.split("T")[0]
    for date_format in ("%Y-%m-%d", "%d.%m.%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, date_format).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def month_abbreviation_from_date(date_str: str) -> str:
    return datetime.strptime(date_str, "%Y-%m-%d").strftime("%b").upper()


def month_number_from_abbreviation(month: Any) -> Optional[int]:
    if month is None:
        return None
    raw = str(month).strip()
    if not raw:
        return None
    if raw.isdigit():
        value = int(raw)
        return value if 1 <= value <= 12 else None
    try:
        return datetime.strptime(raw[:3].title(), "%b").month
    except ValueError:
        return None


def normalize_shift(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    compact = re.sub(r"\s+", "", raw)
    match = re.search(r"SHIFT-?([A-Za-z]+)$", compact, re.IGNORECASE)
    if match:
        raw = match.group(1)

    normalized = raw.upper()
    return normalized if normalized in {"A", "B", "C"} else UNKNOWN_VALUE


def normalize_machine(record: Dict[str, Any]) -> str:
    machine = record.get("machine") or record.get("Machine")
    if machine:
        return str(machine).strip()

    stringer = record.get("stringer", record.get("Stringer"))
    unit = record.get("unit", record.get("Unit"))
    if stringer not in (None, "") and unit not in (None, ""):
        return f"STRINGER-{stringer} UNIT-{str(unit).upper()}"
    if stringer not in (None, ""):
        return f"STRINGER-{stringer}"
    return UNKNOWN_VALUE


def extract_stringer_unit(machine: Any) -> tuple[Optional[int], Optional[str]]:
    raw = str(machine or "")
    match = re.search(r"STRINGER\s*-?\s*(\d+).*?UNIT\s*-?\s*([A-Za-z])", raw, re.IGNORECASE)
    if match:
        return int(match.group(1)), match.group(2).upper()
    match = re.search(r"STRINGER\s*-?\s*(\d+)", raw, re.IGNORECASE)
    if match:
        return int(match.group(1)), None
    return None, None


def build_sample_results(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    existing = record.get("sample_results")
    if isinstance(existing, list):
        return existing

    sample_results: List[Dict[str, Any]] = []
    for key, value in record.items():
        match = MEASUREMENT_KEY_PATTERN.match(str(key))
        if not match:
            continue
        if value in (None, ""):
            continue
        side, position, ribbon = match.groups()
        sample_results.append(
            {
                "side": side.title(),
                "bus_pad_position": int(position),
                "ribbon": int(ribbon),
                "value": value,
            }
        )

    sample_results.sort(
        key=lambda item: (
            0 if item.get("side") == "Front" else 1,
            item.get("bus_pad_position", 0),
            item.get("ribbon", 0),
        )
    )
    return sample_results


def build_business_key(record: Dict[str, Any]) -> str:
    explicit_key = record.get("business_key")
    if explicit_key:
        return str(explicit_key)

    date = parse_date_string(record.get("date") or record.get("Date")) or ""
    shift = normalize_shift(record.get("shift") or record.get("Shift"))
    machine = normalize_machine(record)
    file_name = str(record.get("file_name") or "").strip()

    if not file_name:
        stringer = record.get("stringer", record.get("Stringer", ""))
        unit = record.get("unit", record.get("Unit", ""))
        file_name = f"legacy:{stringer}:{unit}"

    source = "|".join([date, shift, machine, file_name]).lower()
    return hashlib.sha1(source.encode("utf-8")).hexdigest()


def normalize_peel_record(record: Dict[str, Any], *, now: Optional[datetime] = None) -> Dict[str, Any]:
    normalized = dict(record)
    now = now or utc_now()

    date_str = parse_date_string(normalized.get("date") or normalized.get("Date"))
    if not date_str:
        raise ValueError("Peel record is missing a valid date")

    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(f"Invalid peel record date: {date_str}") from exc

    month = str(normalized.get("month") or month_abbreviation_from_date(date_str)).strip().upper()
    month = month[:3] if month else month_abbreviation_from_date(date_str)
    year = int(normalized.get("year") or date_obj.year)
    month_name = str(normalized.get("month_name") or f"{month} - {year}").strip()
    shift = normalize_shift(normalized.get("shift") or normalized.get("Shift"))
    machine = normalize_machine(normalized)
    stringer, unit = extract_stringer_unit(machine)

    try:
        if normalized.get("Stringer") not in (None, ""):
            stringer = int(normalized["Stringer"])
        elif normalized.get("stringer") not in (None, ""):
            stringer = int(normalized["stringer"])
    except (TypeError, ValueError):
        stringer = None

    if normalized.get("Unit") not in (None, ""):
        unit = str(normalized["Unit"]).upper()
    elif normalized.get("unit") not in (None, ""):
        unit = str(normalized["unit"]).upper()

    po_number = (
        normalized.get("po_number")
        or normalized.get("PO")
        or normalized.get("po")
        or UNKNOWN_VALUE
    )
    cell_vendor = (
        normalized.get("cell_vendor")
        or normalized.get("Cell_Vendor")
        or normalized.get("Cell Vendor")
        or UNKNOWN_VALUE
    )
    source_path = normalized.get("source_path") or normalized.get("source_paths") or ""
    if isinstance(source_path, list):
        source_path = ";".join(str(item) for item in source_path)

    normalized.update(
        {
            "year": year,
            "month": month,
            "month_name": month_name,
            "date": date_str,
            "shift": shift,
            "file_name": str(normalized.get("file_name") or "").strip(),
            "source_path": source_path,
            "machine": machine,
            "module_type": normalized.get("module_type") or normalized.get("Module_Type") or UNKNOWN_VALUE,
            "cell_vendor": str(cell_vendor).strip() or UNKNOWN_VALUE,
            "po_number": str(po_number).strip() or UNKNOWN_VALUE,
            "sample_results": build_sample_results(normalized),
            "updated_at": normalized.get("updated_at") or now,
            "last_extracted_at": normalized.get("last_extracted_at") or now,
            "Date": date_str,
            "Shift": shift,
            "PO": str(po_number).strip() or UNKNOWN_VALUE,
            "Cell_Vendor": str(cell_vendor).strip() or UNKNOWN_VALUE,
        }
    )

    if stringer is not None:
        normalized["Stringer"] = stringer
        normalized["stringer"] = stringer
    if unit is not None:
        normalized["Unit"] = unit
        normalized["unit"] = unit

    normalized["business_key"] = build_business_key(normalized)
    normalized.setdefault("created_at", now)
    return normalized


def ensure_peel_indexes() -> None:
    try:
        ensure_index(
            peel_data_collection,
            [("business_key", ASCENDING)],
            unique=True,
            sparse=True,
            name="unique_peel_business_key",
        )
        ensure_index(
            peel_data_collection,
            [
                ("year", ASCENDING),
                ("month", ASCENDING),
                ("date", ASCENDING),
                ("shift", ASCENDING),
                ("machine", ASCENDING),
            ],
            name="peel_filter_idx",
        )
        ensure_index(peel_data_collection, [("date", ASCENDING), ("shift", ASCENDING)], name="peel_date_shift_idx")
        ensure_index(peel_data_collection, [("module_type", ASCENDING)], name="peel_module_type_idx")
        ensure_index(peel_data_collection, [("source_path", ASCENDING)], name="peel_source_path_idx")
        ensure_index(
            peel_file_metadata_collection,
            [("file_path", ASCENDING)],
            unique=True,
            name="unique_peel_file_path",
        )
        ensure_index(peel_file_metadata_collection, [("last_modified", ASCENDING)], name="peel_file_last_modified_idx")
        ensure_index(
            peel_processing_files_collection,
            [("file_path", ASCENDING)],
            unique=True,
            name="unique_processing_file_path",
        )
        ensure_index(peel_processing_files_collection, [("started_at", ASCENDING)], name="peel_processing_started_idx")
    except (OperationFailure, PyMongoError) as exc:
        logger.warning("failed_to_ensure_peel_indexes error=%s", exc, exc_info=True)


def serialize_peel_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None

    serialized = dict(doc)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])

    for key in ("created_at", "updated_at", "last_extracted_at", "last_modified", "last_processed_at"):
        value = serialized.get(key)
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()

    return serialized


def serialize_peel_docs(docs: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [doc for doc in (serialize_peel_doc(item) for item in docs) if doc is not None]


def upsert_extracted_peel_record(record: Dict[str, Any]) -> Dict[str, Any]:
    ensure_peel_indexes()
    normalized = normalize_peel_record(record)
    business_key = normalized["business_key"]
    normalized.pop("_id", None)

    protected_fields = {"cell_vendor", "po_number", "Cell_Vendor", "PO"}
    set_doc = {key: value for key, value in normalized.items() if key not in protected_fields and key != "created_at"}
    set_on_insert = {key: normalized[key] for key in protected_fields if key in normalized}
    set_on_insert["created_at"] = normalized.get("created_at", utc_now())

    try:
        result = peel_data_collection.update_one(
            {"business_key": business_key},
            {"$set": set_doc, "$setOnInsert": set_on_insert},
            upsert=True,
        )
        stored = peel_data_collection.find_one({"business_key": business_key})
        response = {
            "inserted": bool(result.upserted_id),
            "updated": result.modified_count > 0 and not result.upserted_id,
            "record": stored,
        }
        if response["inserted"] or response["updated"]:
            _reconcile_saved_record(stored)
        return response
    except DuplicateKeyError:
        peel_data_collection.update_one({"business_key": business_key}, {"$set": set_doc})
        stored = peel_data_collection.find_one({"business_key": business_key})
        _reconcile_saved_record(stored)
        return {"inserted": False, "updated": True, "record": stored}


def _reconcile_saved_record(record: Optional[Dict[str, Any]]) -> None:
    """Best-effort ingestion event; the periodic job recovers missed deliveries."""
    if not record:
        return
    try:
        from services.peel_audit_reconciliation_service import reconciliation_enabled, reconcile_pending_audits
        if reconciliation_enabled():
            reconcile_pending_audits(source_record_id=str(record.get("_id")), limit=200)
    except Exception:
        logger.exception("peel_audit_event_reconciliation_failed source_id=%s", record.get("_id"))


def insert_manual_peel_record(record: Dict[str, Any]) -> Dict[str, Any]:
    ensure_peel_indexes()
    normalized = normalize_peel_record(record)
    normalized.pop("_id", None)
    result = peel_data_collection.insert_one(normalized)
    normalized["_id"] = result.inserted_id
    _reconcile_saved_record(normalized)
    return normalized


def update_manual_peel_record(record_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ensure_peel_indexes()
    if not ObjectId.is_valid(record_id):
        raise ValueError("Invalid peel record ID")

    existing = peel_data_collection.find_one({"_id": ObjectId(record_id)})
    if not existing:
        return None

    merged = dict(existing)
    merged.update(updates)
    merged.pop("_id", None)
    merged["created_at"] = existing.get("created_at", utc_now())
    merged["updated_at"] = utc_now()
    normalized = normalize_peel_record(merged, now=merged["updated_at"])

    peel_data_collection.update_one({"_id": ObjectId(record_id)}, {"$set": normalized})
    stored = peel_data_collection.find_one({"_id": ObjectId(record_id)})
    _reconcile_saved_record(stored)
    return stored


def safe_insert_migrated_record(record: Dict[str, Any]) -> str:
    ensure_peel_indexes()
    normalized = normalize_peel_record(record)

    if peel_data_collection.find_one({"business_key": normalized["business_key"]}):
        return "duplicate"

    try:
        peel_data_collection.insert_one(normalized)
        return "migrated"
    except DuplicateKeyError:
        return "duplicate"
    except PyMongoError:
        raise
