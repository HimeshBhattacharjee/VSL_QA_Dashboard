import copy
import logging
import re
from datetime import datetime, time, timedelta
from typing import Any, Dict, Iterable, List, Optional

from openpyxl.utils.datetime import from_excel
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import OperationFailure, PyMongoError

from constants import MONGODB_DB_NAME, MONGODB_URI
from mongo_indexes import ensure_index


logger = logging.getLogger("calibration_data")

CALIBRATION_DATA_COLLECTION_NAME = "calibration_data"
CALIBRATION_TRACKING_COLLECTION_NAME = "calibration_extractor_tracking"

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
calibration_data_collection: Collection = db[CALIBRATION_DATA_COLLECTION_NAME]
calibration_tracking_collection: Collection = db[CALIBRATION_TRACKING_COLLECTION_NAME]

TIME_SLOTS = ("2hrs", "4hrs", "6hrs", "8hrs")
CALIBRATION_AUDIT_PARAM_ID = "24-7"
CALIBRATION_AUDIT_FIELDS = {
    "calibrationTime": "time",
    "moduleId": "module_no",
    "pmax": "pmax",
    "voc": "voc",
    "isc": "isc",
    "moduleTemp": "module_temp",
    "roomTemp": "room_temp",
}
LINE_NUMBERS_BY_AUDIT_LINE = {
    "I": (1, 2),
    "II": (3, 4),
}
LINE_OPTIONS_BY_AUDIT_LINE = {
    "I": ("Line-1", "Line-2"),
    "II": ("Line-3", "Line-4"),
}


def utc_now() -> datetime:
    return datetime.utcnow()


def ensure_calibration_indexes() -> None:
    try:
        ensure_index(
            calibration_data_collection,
            [("date", ASCENDING), ("shift", ASCENDING), ("line_number", ASCENDING)],
            unique=True,
            name="unique_calibration_date_shift_line",
        )
        ensure_index(
            calibration_data_collection,
            [("line_number", ASCENDING), ("date", ASCENDING), ("shift", ASCENDING)],
            name="calibration_line_date_shift_idx",
        )
        ensure_index(calibration_data_collection, [("source_file", ASCENDING)], name="calibration_source_file_idx")
        ensure_index(
            calibration_tracking_collection,
            [("file_path", ASCENDING)],
            unique=True,
            name="unique_calibration_file_path",
        )
        ensure_index(
            calibration_tracking_collection,
            [("last_modified", ASCENDING)],
            name="calibration_tracking_last_modified_idx",
        )
        ensure_index(
            calibration_tracking_collection,
            [("last_processed_at", ASCENDING)],
            name="calibration_tracking_processed_idx",
        )
    except (OperationFailure, PyMongoError) as exc:
        logger.warning("failed_to_ensure_calibration_indexes error=%s", exc)


def normalize_shift(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    raw = re.sub(r"\s+", "", raw)
    match = re.search(r"SHIFT-?([ABC])$", raw)
    if match:
        return match.group(1)
    return raw if raw in {"A", "B", "C"} else ""


def normalize_audit_line(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if raw in {"I", "LINE-I", "LINE I", "FAB-II LINE-I", "FAB II LINE I"}:
        return "I"
    if raw in {"II", "LINE-II", "LINE II", "FAB-II LINE-II", "FAB II LINE II"}:
        return "II"
    if re.search(r"\bLINE\s*[- ]?\s*II\b", raw):
        return "II"
    if re.search(r"\bLINE\s*[- ]?\s*I\b", raw):
        return "I"
    return raw


def parse_date_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (int, float)) and value > 0:
        try:
            return from_excel(value).strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            pass

    raw = str(value).strip()
    if not raw:
        return None
    raw = raw.split("T")[0].strip()
    for date_format in (
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d.%m.%y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%d-%b-%Y",
        "%d %b %Y",
        "%d-%B-%Y",
        "%d %B %Y",
    ):
        try:
            return datetime.strptime(raw, date_format).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def normalize_time_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%H:%M:%S")
    if isinstance(value, time):
        return value.strftime("%H:%M:%S")
    if isinstance(value, timedelta):
        seconds = int(value.total_seconds()) % (24 * 60 * 60)
        return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"
    if isinstance(value, (int, float)):
        if 0 <= float(value) < 1:
            seconds = int(round(float(value) * 24 * 60 * 60)) % (24 * 60 * 60)
            return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"
        try:
            return from_excel(value).strftime("%H:%M:%S")
        except (TypeError, ValueError):
            return None

    raw = str(value).strip()
    if not raw:
        return None
    for time_format in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p"):
        try:
            return datetime.strptime(raw, time_format).strftime("%H:%M:%S")
        except ValueError:
            continue
    return raw


def normalize_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)

    raw = str(value).strip()
    if not raw or raw.upper() in {"NA", "N/A", "-", "--", "OFF"}:
        return None
    raw = raw.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _time_sort_key(record: Dict[str, Any]) -> tuple[int, str, int]:
    normalized_time = normalize_time_value(record.get("time")) or ""
    return (0 if normalized_time else 1, normalized_time, int(record.get("row_number") or 0))


def normalize_calibration_record(record: Dict[str, Any], *, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or utc_now()
    date = parse_date_value(record.get("date"))
    shift = normalize_shift(record.get("shift"))
    line_number = record.get("line_number")

    try:
        line_number = int(line_number)
    except (TypeError, ValueError) as exc:
        raise ValueError("Calibration record is missing a valid line_number") from exc

    if not date:
        raise ValueError("Calibration record is missing a valid date")
    if shift not in {"A", "B", "C"}:
        raise ValueError("Calibration record is missing a valid shift")
    if line_number not in {1, 2, 3, 4}:
        raise ValueError(f"Unsupported calibration line_number: {line_number}")

    status = str(record.get("status") or "ACTIVE").strip().upper()
    if status not in {"ACTIVE", "OFF"}:
        status = "ACTIVE"

    normalized: Dict[str, Any] = {
        "date": date,
        "shift": shift,
        "line_number": line_number,
        "status": status,
        "source_file": normalize_text(record.get("source_file")) or "",
        "source_sheet": normalize_text(record.get("source_sheet")) or "",
        "last_updated": now,
    }

    if status == "OFF":
        normalized.update(
            {
                "time": None,
                "module_no": None,
                "pmax": None,
                "voc": None,
                "isc": None,
                "vmp": None,
                "imp": None,
                "fill_factor": None,
                "module_temp": None,
                "room_temp": None,
            }
        )
    else:
        normalized.update(
            {
                "time": normalize_time_value(record.get("time")),
                "module_no": normalize_text(record.get("module_no")),
                "pmax": normalize_number(record.get("pmax")),
                "voc": normalize_number(record.get("voc")),
                "isc": normalize_number(record.get("isc")),
                "vmp": normalize_number(record.get("vmp")),
                "imp": normalize_number(record.get("imp")),
                "fill_factor": normalize_number(record.get("fill_factor")),
                "module_temp": normalize_number(record.get("module_temp")),
                "room_temp": normalize_number(record.get("room_temp")),
            }
        )

    if "row_number" in record:
        normalized["row_number"] = record.get("row_number")
    return normalized


def _compact_entry(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        key: record.get(key)
        for key in (
            "status",
            "time",
            "module_no",
            "pmax",
            "voc",
            "isc",
            "vmp",
            "imp",
            "fill_factor",
            "module_temp",
            "room_temp",
            "source_file",
            "source_sheet",
            "row_number",
        )
    }


def build_calibration_document(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not records:
        raise ValueError("No calibration records supplied")

    normalized_records = [normalize_calibration_record(record) for record in records]
    first = normalized_records[0]
    for record in normalized_records[1:]:
        if (
            record["date"] != first["date"]
            or record["shift"] != first["shift"]
            or record["line_number"] != first["line_number"]
        ):
            raise ValueError("Calibration records must share date, shift, and line_number")

    sorted_records = sorted(normalized_records, key=_time_sort_key)
    active_records = [record for record in sorted_records if record.get("status") == "ACTIVE"]
    primary = active_records[-1] if active_records else sorted_records[-1]
    document = dict(primary)
    document["records"] = [_compact_entry(record) for record in sorted_records]
    document["record_count"] = len(sorted_records)
    return document


def upsert_calibration_document(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    ensure_calibration_indexes()
    document = build_calibration_document(records)
    document.pop("_id", None)
    query = {
        "date": document["date"],
        "shift": document["shift"],
        "line_number": document["line_number"],
    }
    now = utc_now()
    document["last_updated"] = now

    result = calibration_data_collection.update_one(
        query,
        {"$set": document, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    stored = calibration_data_collection.find_one(query)
    logger.info(
        "calibration_mongo_upsert date=%s shift=%s line=%s inserted=%s modified=%s",
        query["date"],
        query["shift"],
        query["line_number"],
        bool(result.upserted_id),
        result.modified_count,
    )
    return {
        "inserted": bool(result.upserted_id),
        "updated": result.modified_count > 0 and not result.upserted_id,
        "record": stored,
    }


def serialize_calibration_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    serialized = dict(doc)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    for key in ("created_at", "last_updated", "last_modified", "last_processed_at"):
        value = serialized.get(key)
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
    return serialized


def _is_empty(value: Any) -> bool:
    return value is None or value == ""


def _line_numbers_for_audit(audit_line: Any) -> tuple[int, ...]:
    normalized = normalize_audit_line(audit_line)
    if normalized in LINE_NUMBERS_BY_AUDIT_LINE:
        return LINE_NUMBERS_BY_AUDIT_LINE[normalized]
    try:
        numeric_line = int(str(audit_line).strip())
        return (numeric_line,) if numeric_line in {1, 2, 3, 4} else ()
    except (TypeError, ValueError):
        return ()


def _line_labels_for_audit(audit_line: Any) -> tuple[str, ...]:
    normalized = normalize_audit_line(audit_line)
    if normalized in LINE_OPTIONS_BY_AUDIT_LINE:
        return LINE_OPTIONS_BY_AUDIT_LINE[normalized]
    return tuple(f"Line-{line_number}" for line_number in _line_numbers_for_audit(audit_line))


def get_calibration_docs_for_audit(date: Any, shift: Any, audit_line: Any) -> Dict[int, Dict[str, Any]]:
    date_str = parse_date_value(date)
    shift_str = normalize_shift(shift)
    line_numbers = _line_numbers_for_audit(audit_line)
    if not (date_str and shift_str and line_numbers):
        logger.info(
            "audit_calibration_data_not_found reason=missing_lookup date=%s shift=%s line=%s",
            date,
            shift,
            audit_line,
        )
        return {}

    try:
        ensure_calibration_indexes()
        docs = list(
            calibration_data_collection.find(
                {"date": date_str, "shift": shift_str, "line_number": {"$in": list(line_numbers)}}
            )
        )
    except PyMongoError as exc:
        logger.exception(
            "audit_calibration_lookup_failed date=%s shift=%s lines=%s error=%s",
            date_str,
            shift_str,
            line_numbers,
            exc,
        )
        return {}
    if not docs:
        logger.info("audit_calibration_data_not_found date=%s shift=%s lines=%s", date_str, shift_str, line_numbers)
        return {}

    logger.info(
        "audit_calibration_data_loaded date=%s shift=%s lines=%s count=%s",
        date_str,
        shift_str,
        line_numbers,
        len(docs),
    )
    return {int(doc["line_number"]): doc for doc in docs}


def _audit_records_from_doc(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    records = doc.get("records")
    if isinstance(records, list) and records:
        usable = [record for record in records if isinstance(record, dict)]
    else:
        usable = [doc]

    usable = sorted(usable, key=_time_sort_key)
    if len(usable) == 1:
        return usable * len(TIME_SLOTS)
    return usable[: len(TIME_SLOTS)]


def _display_value(record: Dict[str, Any], source_field: str) -> str:
    if record.get("status") == "OFF":
        return "OFF"

    value = record.get(source_field)
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


def apply_calibration_autofill_to_audit_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return data

    enriched = copy.deepcopy(data)
    audit_date = enriched.get("date")
    audit_shift = enriched.get("shift")
    audit_line = enriched.get("lineNumber")
    docs_by_line = get_calibration_docs_for_audit(audit_date, audit_shift, audit_line)
    if not docs_by_line:
        return enriched

    line_labels = _line_labels_for_audit(audit_line)
    if not line_labels:
        return enriched

    for stage in enriched.get("stages", []):
        if not isinstance(stage, dict) or stage.get("id") != 24:
            continue
        for parameter in stage.get("parameters", []):
            if not isinstance(parameter, dict) or parameter.get("id") != CALIBRATION_AUDIT_PARAM_ID:
                continue
            observations = parameter.get("observations")
            if not isinstance(observations, list) or not observations:
                continue
            observation = observations[0]
            value = observation.get("value")
            if not isinstance(value, dict):
                value = {}

            changed = False
            for line_label in line_labels:
                try:
                    physical_line = int(line_label.split("-")[-1])
                except (TypeError, ValueError):
                    continue
                doc = docs_by_line.get(physical_line)
                if not doc:
                    continue
                records = _audit_records_from_doc(doc)
                for index, record in enumerate(records):
                    time_slot = TIME_SLOTS[index]
                    for audit_field, source_field in CALIBRATION_AUDIT_FIELDS.items():
                        target_key = f"{line_label}-{time_slot}-{audit_field}"
                        if not _is_empty(value.get(target_key)):
                            continue
                        display_value = _display_value(record, source_field)
                        if source_field == "room_temp" and display_value == "":
                            continue
                        value[target_key] = display_value
                        changed = True

            if changed:
                observation["value"] = value
    return enriched


def mark_calibration_file_processed(
    *,
    file_path: str,
    etag: str,
    last_modified: datetime,
    file_size: int,
    status: str,
    records_extracted: int = 0,
    groups_upserted: int = 0,
    error: Optional[str] = None,
) -> None:
    now = utc_now()
    update_doc: Dict[str, Any] = {
        "file_path": file_path,
        "etag": str(etag or "").strip('"'),
        "last_modified": last_modified,
        "file_size": file_size,
        "last_processed_at": now,
        "status": status,
        "records_extracted": records_extracted,
        "groups_upserted": groups_upserted,
    }
    if error:
        update_doc["error"] = error[:1000]
    else:
        update_doc["error"] = None

    try:
        calibration_tracking_collection.update_one(
            {"file_path": file_path},
            {"$set": update_doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    except PyMongoError as exc:
        logger.exception("calibration_tracking_update_failed file=%s error=%s", file_path, exc)


def load_calibration_file_tracking(file_paths: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    paths = list(file_paths)
    if not paths:
        return {}
    existing: Dict[str, Dict[str, Any]] = {}
    try:
        cursor = calibration_tracking_collection.find({"file_path": {"$in": paths}})
        for item in cursor:
            existing[item["file_path"]] = item
    except PyMongoError as exc:
        logger.exception("calibration_tracking_load_failed error=%s", exc)
    return existing


ensure_calibration_indexes()
