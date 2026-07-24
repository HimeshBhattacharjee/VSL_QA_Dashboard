import argparse
import io
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
from botocore.exceptions import ClientError
from fuzzywuzzy import fuzz, process
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError

from constants import MONGODB_DB_NAME, MONGODB_URI
from models.peel_data_models import (
    PEEL_DATA_COLLECTION_NAME,
    ensure_peel_indexes,
    month_abbreviation_from_date,
    normalize_peel_record,
    normalize_shift,
    peel_file_metadata_collection,
    peel_extraction_status_collection,
    peel_data_collection,
    peel_processing_files_collection,
    serialize_peel_doc,
    upsert_extracted_peel_record,
    utc_now,
)
from paths import get_qc_data_key
from s3_service import S3Service
from extractors.peel_docx_metadata import extract_docx_metadata
from models.peel_test_models import peel_test_collection


LOGGER_NAME = "peel_extractor"
logger = logging.getLogger(LOGGER_NAME)
if not logger.handlers:
    logging.basicConfig(
        level=os.getenv("PEEL_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

EXCEL_EXTENSIONS = (".xlsx", ".xlsm", ".xls")
METADATA_DOCX_PATTERN = re.compile(r"^PO\s*&\s*Cell-(?P<number>[12])\.docx$", re.IGNORECASE)
PROCESSING_LOCK_TTL_HOURS = 6

YEAR_FOLDER_PATTERN = re.compile(r"^\d{4}$")
MONTH_YEAR_PATTERN = re.compile(r"^(?P<month>[A-Za-z]{3})\s*[-_ ]\s*(?P<year>\d{4})$")
DATE_PATTERNS = (
    ("%Y-%m-%d", re.compile(r"\b\d{4}-\d{2}-\d{2}\b")),
    ("%d.%m.%Y", re.compile(r"\b\d{2}\.\d{2}\.\d{4}\b")),
    ("%d-%m-%Y", re.compile(r"\b\d{2}-\d{2}-\d{4}\b")),
    ("%d/%m/%Y", re.compile(r"\b\d{2}/\d{2}/\d{4}\b")),
)
STRINGER_UNIT_PATTERNS = (
    re.compile(r"STRINGER\s*-?\s*(\d+)\s+UNIT\s*-?\s*([A-Za-z])", re.IGNORECASE),
    re.compile(r"STRINGER\s*-?\s*(\d+).*?UNIT\s*-?\s*([A-Za-z])", re.IGNORECASE),
)
SHIFT_PATTERN = re.compile(r"^(SHIFT\s*-?\s*[ABC]|[ABC])$", re.IGNORECASE)


@dataclass(frozen=True)
class S3ExcelFile:
    key: str
    file_name: str
    etag: str
    last_modified: datetime
    size: int
    metadata: Dict[str, Any]


@dataclass(frozen=True)
class S3MetadataFile:
    key: str
    file_name: str
    etag: str
    last_modified: datetime
    size: int
    document_number: int
    metadata: Dict[str, Any]


class FuzzyFolderMatcher:
    """Fuzzy matching for folder and file names."""

    def __init__(self, threshold: int = 80):
        self.threshold = threshold

    def find_best_match(self, target: str, choices: Iterable[str]) -> Optional[str]:
        choices = list(choices)
        if not choices:
            return None
        best_match, score = process.extractOne(target, choices, scorer=fuzz.token_sort_ratio)
        if score >= self.threshold:
            return best_match
        return None

    def find_files_fuzzy(self, files: Iterable[str], target_filename: str) -> Optional[str]:
        files = list(files)
        if not files:
            return None
        if target_filename in files:
            return target_filename

        best_match = self.find_best_match(target_filename, files)
        if best_match:
            logger.info("fuzzy_file_match target=%s match=%s", target_filename, best_match)
            return best_match

        for file_name in files:
            name_without_ext = file_name.split(".")[0]
            if fuzz.token_sort_ratio(target_filename, name_without_ext) >= self.threshold:
                return file_name

        return None


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _clean_etag(etag: Any) -> str:
    return str(etag or "").strip('"')


def _is_excel_key(key: str) -> bool:
    file_name = PurePosixPath(key).name
    if file_name.startswith("~$"):
        return False
    return key.lower().endswith(EXCEL_EXTENSIONS)


def _parse_month_year(part: str) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    match = MONTH_YEAR_PATTERN.match(part.strip())
    if not match:
        return None, None, None

    month_raw = match.group("month").title()
    try:
        month = datetime.strptime(month_raw, "%b").strftime("%b").upper()
    except ValueError:
        return None, None, None

    year = int(match.group("year"))
    return month, year, f"{month} - {year}"


def _parse_date_from_text(text: str) -> Optional[str]:
    for date_format, pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        try:
            return datetime.strptime(match.group(0), date_format).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_shift(part: str) -> Optional[str]:
    cleaned = str(part or "").strip()
    if not cleaned or not SHIFT_PATTERN.match(cleaned):
        return None
    return normalize_shift(cleaned)


def _extract_stringer_unit(text: str) -> Tuple[Optional[int], Optional[str]]:
    for pattern in STRINGER_UNIT_PATTERNS:
        match = pattern.search(text)
        if match:
            return int(match.group(1)), match.group(2).upper()
    return None, None


def _detect_side(file_name: str) -> Optional[str]:
    stem = PurePosixPath(file_name).stem.lower()
    if re.search(r"\bfront\b|^front|front$", stem):
        return "Front"
    if re.search(r"\bback\b|^back|back$", stem):
        return "Back"
    return None


def _sanitize_machine_candidate(value: str) -> str:
    candidate = re.sub(r"[_-]+", " ", value).strip()
    candidate = re.sub(r"\s+", " ", candidate)
    return candidate.upper() if candidate else ""


def parse_s3_metadata(key: str, prefix: str, last_modified: datetime) -> Dict[str, Any]:
    relative_path = key[len(prefix.rstrip("/")) :].lstrip("/")
    parts = [part for part in relative_path.split("/") if part]
    file_name = parts[-1] if parts else PurePosixPath(key).name
    folder_parts = parts[:-1]
    file_stem = PurePosixPath(file_name).stem

    metadata: Dict[str, Any] = {
        "file_name": file_name,
        "source_path": key,
        "relative_path": relative_path,
        "side": _detect_side(file_name),
        "module_type": "UNKNOWN",
    }

    year: Optional[int] = None
    month: Optional[str] = None
    month_name: Optional[str] = None

    for index, part in enumerate(folder_parts):
        if YEAR_FOLDER_PATTERN.match(part):
            year = int(part)
            if index + 1 < len(folder_parts):
                parsed_month, parsed_year, parsed_month_name = _parse_month_year(folder_parts[index + 1])
                if parsed_month:
                    month = parsed_month
                    year = parsed_year or year
                    month_name = parsed_month_name
                    break

    if not month:
        for part in folder_parts:
            parsed_month, parsed_year, parsed_month_name = _parse_month_year(part)
            if parsed_month:
                month = parsed_month
                year = parsed_year
                month_name = parsed_month_name
                break

    date_str = None
    for part in [*folder_parts, file_name]:
        date_str = _parse_date_from_text(part)
        if date_str:
            break

    if not date_str:
        date_str = _utc_naive(last_modified).strftime("%Y-%m-%d")
        logger.warning("date_missing_using_last_modified key=%s date=%s", key, date_str)

    if not month:
        month = month_abbreviation_from_date(date_str)
    if not year:
        year = datetime.strptime(date_str, "%Y-%m-%d").year
    if not month_name:
        month_name = f"{month} - {year}"

    shift = None
    for part in folder_parts:
        shift = _parse_shift(part)
        if shift:
            break

    stringer = None
    unit = None
    for part in [*folder_parts, file_name]:
        stringer, unit = _extract_stringer_unit(part)
        if stringer is not None:
            break

    machine = None
    if stringer is not None and unit:
        machine = f"STRINGER-{stringer} UNIT-{unit}"
    elif stringer is not None:
        machine = f"STRINGER-{stringer}"
    else:
        ignored = {str(year), month_name, month, shift, "SHIFT-A", "SHIFT-B", "SHIFT-C", ""}
        for candidate in reversed(folder_parts):
            if candidate in ignored or _parse_date_from_text(candidate) or _parse_shift(candidate):
                continue
            parsed_month, _, _ = _parse_month_year(candidate)
            if parsed_month:
                continue
            machine = _sanitize_machine_candidate(candidate)
            if machine:
                break
        if not machine and metadata["side"] is None:
            machine = _sanitize_machine_candidate(file_stem)
        if not machine:
            machine = "UNKNOWN"

    metadata.update(
        {
            "year": year,
            "month": month,
            "month_name": month_name,
            "date": date_str,
            "shift": shift or "UNKNOWN",
            "machine": machine,
        }
    )
    if stringer is not None:
        metadata["Stringer"] = stringer
        metadata["stringer"] = stringer
    if unit:
        metadata["Unit"] = unit
        metadata["unit"] = unit

    return metadata


def extract_data_from_excel(file_ref: str, sheet_type: str, s3_service: Optional[S3Service] = None) -> Dict[str, float]:
    """Extract peel test measurements from an Excel file stored locally or in S3."""
    try:
        if s3_service and isinstance(file_ref, str) and "/" in file_ref and not file_ref.startswith("/"):
            response = s3_service.s3_client.get_object(Bucket=s3_service.bucket_name, Key=file_ref)
            df = pd.read_excel(io.BytesIO(response["Body"].read()), sheet_name="Sheet1", header=None)
        else:
            df = pd.read_excel(file_ref, sheet_name="Sheet1", header=None)

        data_start_row = None
        for idx, row in df.iterrows():
            first_cell = row.iloc[0] if len(row) else None
            if str(first_cell).strip() == "No.":
                data_start_row = idx + 1
                break

        if data_start_row is None:
            logger.warning("missing_no_header file=%s sheet_type=%s", file_ref, sheet_type)
            return {}

        data_dict: Dict[str, float] = {}
        for idx in range(data_start_row, len(df)):
            row = df.iloc[idx]
            sample_id_raw = row.iloc[0] if len(row) else None
            if pd.isna(sample_id_raw):
                continue

            sample_id = str(sample_id_raw).strip()
            if not sample_id or "Gragh" in sample_id:
                continue

            if "_" not in sample_id:
                continue

            try:
                bus_pad_position = int(sample_id.split("_")[-1])
            except (TypeError, ValueError):
                logger.warning("invalid_sample_id file=%s row=%s sample_id=%s", file_ref, idx, sample_id)
                continue

            max_ribbon = min(7, len(row) - 1)
            for ribbon_idx in range(1, max_ribbon + 1):
                value = row.iloc[ribbon_idx]
                if pd.isna(value):
                    continue
                try:
                    data_dict[f"{sheet_type}_{bus_pad_position}_{ribbon_idx}"] = round(float(value), 2)
                except (TypeError, ValueError):
                    logger.warning(
                        "invalid_measurement file=%s row=%s ribbon=%s value=%s",
                        file_ref,
                        idx,
                        ribbon_idx,
                        value,
                    )

        return data_dict

    except Exception as exc:
        logger.exception("excel_read_failed file=%s sheet_type=%s error=%s", file_ref, sheet_type, exc)
        return {}


def list_s3_excel_files(
    s3_prefix: str,
    s3_service: Optional[S3Service] = None,
    metadata_files: Optional[List[S3MetadataFile]] = None,
) -> List[S3ExcelFile]:
    s3_service = s3_service or S3Service()
    normalized_prefix = s3_prefix.rstrip("/") + "/"
    files: List[S3ExcelFile] = []

    logger.info("extraction_started prefix=%s", normalized_prefix)
    paginator = s3_service.s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=s3_service.bucket_name, Prefix=normalized_prefix):
        for obj in page.get("Contents", []):
            key = obj.get("Key")
            if not key or key.endswith("/"):
                continue
            last_modified = _utc_naive(obj["LastModified"])
            docx_match = METADATA_DOCX_PATTERN.match(PurePosixPath(key).name)
            if docx_match and metadata_files is not None:
                metadata_files.append(S3MetadataFile(
                    key=key, file_name=PurePosixPath(key).name, etag=_clean_etag(obj.get("ETag")),
                    last_modified=last_modified, size=int(obj.get("Size", 0)),
                    document_number=int(docx_match.group("number")), metadata=parse_s3_metadata(key, normalized_prefix, last_modified),
                ))
                logger.info("metadata_docx_detected key=%s", key)
                continue
            if not _is_excel_key(key):
                continue
            metadata = parse_s3_metadata(key, normalized_prefix, last_modified)
            file_info = S3ExcelFile(
                key=key,
                file_name=PurePosixPath(key).name,
                etag=_clean_etag(obj.get("ETag")),
                last_modified=last_modified,
                size=int(obj.get("Size", 0)),
                metadata=metadata,
            )
            files.append(file_info)
            logger.info(
                "file_discovered key=%s date=%s shift=%s machine=%s etag=%s",
                key,
                metadata.get("date"),
                metadata.get("shift"),
                metadata.get("machine"),
                file_info.etag,
            )

    return files


def _chunks(items: List[str], size: int = 500) -> Iterable[List[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def load_file_metadata(files: List[S3ExcelFile]) -> Dict[str, Dict[str, Any]]:
    keys = [file.key for file in files]
    existing: Dict[str, Dict[str, Any]] = {}
    if not keys:
        return existing

    try:
        for chunk in _chunks(keys):
            cursor = peel_file_metadata_collection.find({"file_path": {"$in": chunk}})
            for item in cursor:
                existing[item["file_path"]] = item
    except PyMongoError as exc:
        logger.exception("metadata_load_failed error=%s", exc)

    return existing


def file_has_changed(file_info: S3ExcelFile, existing_metadata: Optional[Dict[str, Any]]) -> bool:
    if not existing_metadata:
        return True

    existing_etag = _clean_etag(existing_metadata.get("etag"))
    existing_modified = existing_metadata.get("last_modified")
    if isinstance(existing_modified, datetime):
        existing_modified = _utc_naive(existing_modified)

    return existing_etag != file_info.etag or existing_modified != file_info.last_modified


def _group_key(file_info: S3ExcelFile) -> str:
    metadata = file_info.metadata
    directory = str(PurePosixPath(file_info.key).parent)
    if metadata.get("side") in {"Front", "Back"}:
        source_name = directory
    else:
        source_name = file_info.file_name
    return "|".join(
        [
            str(metadata.get("date") or ""),
            str(metadata.get("shift") or ""),
            str(metadata.get("machine") or ""),
            source_name,
        ]
    ).lower()


def group_files_for_records(files: List[S3ExcelFile], existing_metadata: Dict[str, Dict[str, Any]], force: bool = False):
    grouped: Dict[str, List[S3ExcelFile]] = {}
    changed: Dict[str, bool] = {}

    for file_info in files:
        key = _group_key(file_info)
        grouped.setdefault(key, []).append(file_info)
        changed[key] = changed.get(key, False) or force or file_has_changed(file_info, existing_metadata.get(file_info.key))

    return {key: value for key, value in grouped.items() if changed.get(key)}


def _mark_processing(files: List[S3ExcelFile]) -> None:
    now = utc_now()
    for file_info in files:
        try:
            peel_processing_files_collection.update_one(
                {"file_path": file_info.key},
                {
                    "$set": {
                        "file_path": file_info.key,
                        "etag": file_info.etag,
                        "last_modified": file_info.last_modified,
                        "started_at": now,
                        "status": "processing",
                    },
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
        except PyMongoError as exc:
            logger.exception("processing_lock_failed file=%s error=%s", file_info.key, exc)


def _clear_processing(files: List[S3ExcelFile]) -> None:
    try:
        peel_processing_files_collection.delete_many({"file_path": {"$in": [file_info.key for file_info in files]}})
    except PyMongoError as exc:
        logger.exception("processing_lock_clear_failed error=%s", exc)


def _mark_file_processed(
    file_info: S3ExcelFile,
    *,
    status: str,
    business_key: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    now = utc_now()
    update_doc: Dict[str, Any] = {
        "file_path": file_info.key,
        "etag": file_info.etag,
        "last_modified": file_info.last_modified,
        "last_processed_at": now,
        "status": status,
        "file_size": file_info.size,
    }
    if business_key:
        update_doc["business_key"] = business_key
    if error:
        update_doc["error"] = error[:1000]
    else:
        update_doc.pop("error", None)

    try:
        peel_file_metadata_collection.update_one(
            {"file_path": file_info.key},
            {"$set": update_doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    except PyMongoError as exc:
        logger.exception("metadata_update_failed file=%s error=%s", file_info.key, exc)


def _base_record_from_files(files: List[S3ExcelFile]) -> Dict[str, Any]:
    primary = sorted(files, key=lambda item: item.file_name)[0]
    metadata = dict(primary.metadata)
    source_paths = sorted(file_info.key for file_info in files)
    file_names = sorted(file_info.file_name for file_info in files)

    record = {
        **metadata,
        "file_name": "|".join(file_names),
        "source_path": ";".join(source_paths),
        "source_paths": source_paths,
        "po_number": None,
        "cell_vendor": None,
        "wp": None,
        "PO": None,
        "Cell_Vendor": None,
        "Wp": None,
        "metadata_auto_extracted": True,
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "last_extracted_at": utc_now(),
    }
    return record


def process_file_group(
    files: List[S3ExcelFile],
    s3_service: S3Service,
    metadata_documents: Optional[Dict[int, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    _mark_processing(files)
    try:
        record = _base_record_from_files(files)
        documents = metadata_documents or {}
        try:
            document_number = 1 if int(record.get("Stringer", record.get("stringer"))) <= 6 else 2
        except (TypeError, ValueError):
            document_number = next(iter(documents), 1)
        extracted_metadata = documents.get(document_number) or {}
        record.update({
            "po_number": extracted_metadata.get("po_number"), "PO": extracted_metadata.get("po_number"),
            "cell_vendor": extracted_metadata.get("cell_vendor"), "Cell_Vendor": extracted_metadata.get("cell_vendor"),
            "wp": extracted_metadata.get("wp"), "Wp": extracted_metadata.get("wp"),
        })
        measurement_count = 0

        for file_info in sorted(files, key=lambda item: item.file_name):
            side = file_info.metadata.get("side") or "Front"
            extracted = extract_data_from_excel(file_info.key, side, s3_service)
            if not extracted:
                logger.warning("file_extracted_no_measurements key=%s side=%s", file_info.key, side)
            measurement_count += len(extracted)
            record.update(extracted)

        if measurement_count == 0:
            message = "No valid peel measurements found"
            for file_info in files:
                _mark_file_processed(file_info, status="error", error=message)
            logger.error("record_skipped reason=%s files=%s", message, [file_info.key for file_info in files])
            return {"inserted": 0, "updated": 0, "skipped": 1, "errors": 0}

        normalized = normalize_peel_record(record)
        result = upsert_extracted_peel_record(normalized)
        stored = result.get("record") or {}
        business_key = stored.get("business_key") or normalized["business_key"]

        for file_info in files:
            _mark_file_processed(file_info, status="processed", business_key=business_key)

        serialized = serialize_peel_doc(stored)
        if result.get("inserted"):
            logger.info("record_inserted business_key=%s id=%s", business_key, serialized.get("_id") if serialized else None)
            return {"inserted": 1, "updated": 0, "skipped": 0, "errors": 0}
        logger.info("record_updated business_key=%s id=%s", business_key, serialized.get("_id") if serialized else None)
        return {"inserted": 0, "updated": 1 if result.get("updated") else 0, "skipped": 0, "errors": 0}
    except Exception as exc:
        for file_info in files:
            _mark_file_processed(file_info, status="error", error=str(exc))
        logger.exception("record_processing_failed files=%s error=%s", [file_info.key for file_info in files], exc)
        return {"inserted": 0, "updated": 0, "skipped": 0, "errors": 1}
    finally:
        _clear_processing(files)


def parse_folder_structure(s3_prefix: str) -> List[Dict[str, Any]]:
    """Parse S3 recursively and return normalized records without writing to MongoDB."""
    s3_service = S3Service()
    files = list_s3_excel_files(s3_prefix, s3_service)
    grouped = group_files_for_records(files, {}, force=True)
    records: List[Dict[str, Any]] = []

    for group_files in grouped.values():
        record = _base_record_from_files(group_files)
        for file_info in sorted(group_files, key=lambda item: item.file_name):
            side = file_info.metadata.get("side") or "Front"
            record.update(extract_data_from_excel(file_info.key, side, s3_service))
        try:
            records.append(normalize_peel_record(record))
        except ValueError as exc:
            logger.error("record_normalization_failed files=%s error=%s", [file_info.key for file_info in group_files], exc)

    return records


def create_structured_dataframe(s3_prefix: str) -> pd.DataFrame:
    """Compatibility helper that returns extracted peel records as a DataFrame."""
    records = parse_folder_structure(s3_prefix)
    if not records:
        logger.info("no_data_found prefix=%s", s3_prefix)
        return pd.DataFrame()
    return pd.DataFrame(records)


def connect_to_mongodb(connection_string: str):
    try:
        client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        logger.info("mongodb_connected")
        return client
    except ConnectionFailure as exc:
        logger.exception("mongodb_connection_failed error=%s", exc)
        return None
    except Exception as exc:
        logger.exception("mongodb_connection_error error=%s", exc)
        return None


def store_in_mongodb(df: pd.DataFrame, mongo_client=None, db_name: Optional[str] = None) -> Dict[str, int]:
    """Store DataFrame data in the single peel_data collection."""
    if df.empty:
        logger.info("mongodb_store_skipped reason=empty_dataframe")
        return {"inserted": 0, "updated": 0, "errors": 0}

    ensure_peel_indexes()
    summary = {"inserted": 0, "updated": 0, "errors": 0}
    for record in df.to_dict("records"):
        try:
            result = upsert_extracted_peel_record(record)
            if result.get("inserted"):
                summary["inserted"] += 1
            elif result.get("updated"):
                summary["updated"] += 1
        except Exception as exc:
            summary["errors"] += 1
            logger.exception("mongodb_record_store_failed error=%s record=%s", exc, record)

    logger.info("mongodb_store_completed collection=%s summary=%s", PEEL_DATA_COLLECTION_NAME, summary)
    return summary


def list_mongodb_collections(mongo_client, db_name: Optional[str] = None):
    db_name = db_name or MONGODB_DB_NAME
    try:
        database = mongo_client[db_name]
        collections = database.list_collection_names()
        for collection_name in collections:
            logger.info("mongodb_collection name=%s count=%s", collection_name, database[collection_name].count_documents({}))
        return collections
    except Exception as exc:
        logger.exception("mongodb_collection_list_failed error=%s", exc)
        return []


def _shift_key(metadata: Dict[str, Any]) -> Tuple[str, str]:
    return str(metadata.get("date") or ""), str(metadata.get("shift") or "")


def load_shift_docx_metadata(
    files: List[S3MetadataFile], s3_service: S3Service
) -> Tuple[Dict[Tuple[str, str], Dict[int, Dict[str, Optional[str]]]], set[Tuple[str, str]]]:
    """Download only changed DOCX objects; cached parsed values handle unchanged files."""
    cached = load_file_metadata(files)  # Both file dataclasses expose the fields used by this helper.
    by_shift: Dict[Tuple[str, str], Dict[int, Dict[str, Optional[str]]]] = {}
    changed_shifts: set[Tuple[str, str]] = set()
    for file_info in files:
        shift_key = _shift_key(file_info.metadata)
        prior = cached.get(file_info.key)
        extracted = prior.get("extracted_values") if prior and not file_has_changed(file_info, prior) else None
        if extracted is None:
            changed_shifts.add(shift_key)
            try:
                response = s3_service.s3_client.get_object(Bucket=s3_service.bucket_name, Key=file_info.key)
                extracted = extract_docx_metadata(response["Body"].read())
                peel_file_metadata_collection.update_one(
                    {"file_path": file_info.key},
                    {"$set": {
                        "file_path": file_info.key, "etag": file_info.etag, "last_modified": file_info.last_modified,
                        "file_size": file_info.size, "status": "metadata_processed", "extracted_values": extracted,
                        "last_processed_at": utc_now(),
                    }, "$setOnInsert": {"created_at": utc_now()}},
                    upsert=True,
                )
                logger.info(
                    "metadata_extracted date=%s shift=%s key=%s po_extracted=%s vendor_extracted=%s wp_extracted=%s",
                    shift_key[0], shift_key[1], file_info.key, bool(extracted.get("po_number")),
                    bool(extracted.get("cell_vendor")), bool(extracted.get("wp")),
                )
            except Exception as exc:
                extracted = {"po_number": None, "cell_vendor": None, "wp": None}
                logger.exception("metadata_extraction_failed date=%s shift=%s key=%s error=%s", *shift_key, file_info.key, exc)
        by_shift.setdefault(shift_key, {})[file_info.document_number] = extracted
    return by_shift, changed_shifts


def _persist_shift_metadata(date: str, shift: str, documents: Dict[int, Dict[str, Any]]) -> bool:
    success = True
    for number, stringer_query in ((1, {"$gte": 1, "$lte": 6}), (2, {"$gte": 7, "$lte": 12})):
        values = documents.get(number)
        if values is None:
            continue
        update = {
            "po_number": values.get("po_number"), "PO": values.get("po_number"),
            "cell_vendor": values.get("cell_vendor"), "Cell_Vendor": values.get("cell_vendor"),
            "wp": values.get("wp"), "Wp": values.get("wp"),
            "metadata_auto_extracted": True, "updated_at": utc_now(),
        }
        try:
            result = peel_data_collection.update_many(
                {"date": date, "shift": shift, "$or": [{"Stringer": stringer_query}, {"stringer": stringer_query}]},
                {"$set": update},
            )
            logger.info("metadata_mongo_updated date=%s shift=%s document=%s records=%s", date, shift, number, result.modified_count)
        except PyMongoError as exc:
            success = False
            logger.exception("metadata_mongo_update_failed date=%s shift=%s document=%s error=%s", date, shift, number, exc)
    return success


def _metadata_complete(documents: Dict[int, Dict[str, Any]]) -> bool:
    return bool(documents) and all(
        values.get(field) not in (None, "")
        for values in documents.values()
        for field in ("po_number", "cell_vendor", "wp")
    )


def process_s3_prefix(s3_prefix: str, *, force: bool = False, s3_service: Optional[S3Service] = None) -> Dict[str, int]:
    ensure_peel_indexes()
    s3_service = s3_service or S3Service()
    summary = {"files_discovered": 0, "groups_changed": 0, "inserted": 0, "updated": 0, "skipped": 0, "errors": 0}

    try:
        docx_files: List[S3MetadataFile] = []
        files = list_s3_excel_files(s3_prefix, s3_service, docx_files)
        summary["files_discovered"] = len(files)
        existing_metadata = load_file_metadata(files)
        groups = group_files_for_records(files, existing_metadata, force=force)
        summary["groups_changed"] = len(groups)
        docx_by_shift, metadata_changed_shifts = load_shift_docx_metadata(docx_files, s3_service)
        affected_shifts = {_shift_key(group_files[0].metadata) for group_files in groups.values()} | metadata_changed_shifts
        # Recover a transient persistence/S3 failure even when source ETags did not change.
        affected_shifts.update(
            (str(item.get("date") or ""), str(item.get("shift") or ""))
            for item in peel_extraction_status_collection.find(
                {"extraction_started": True, "$or": [{"extraction_completed": False}, {"draft_generated": False}]},
                {"date": 1, "shift": 1},
            )
            if item.get("date") and item.get("shift")
        )
        shift_errors = {key: 0 for key in affected_shifts}
        for date, shift in affected_shifts:
            peel_extraction_status_collection.update_one(
                {"date": date, "shift": shift},
                {"$set": {
                    "date": date, "shift": shift, "s3_folder": next((str(PurePosixPath(item.key).parent) for item in files if _shift_key(item.metadata) == (date, shift)), ""),
                    "extraction_started": True, "extraction_completed": False, "draft_generated": False,
                    "extraction_started_at": utc_now(), "last_updated": utc_now(),
                }, "$setOnInsert": {"created_at": utc_now()}},
                upsert=True,
            )
            if not docx_by_shift.get((date, shift)):
                logger.warning("metadata_docx_missing date=%s shift=%s", date, shift)

        for group_files in groups.values():
            group_shift = _shift_key(group_files[0].metadata)
            result = process_file_group(group_files, s3_service, docx_by_shift.get(group_shift))
            shift_errors[_shift_key(group_files[0].metadata)] += result.get("errors", 0)
            for key in ("inserted", "updated", "skipped", "errors"):
                summary[key] += result.get(key, 0)

        from services.peel_draft_sync_service import synchronize_peel_drafts
        for date, shift in affected_shifts:
            documents = docx_by_shift.get((date, shift), {})
            metadata_stored = _persist_shift_metadata(date, shift, documents)
            extraction_completed = shift_errors[(date, shift)] == 0 and peel_data_collection.count_documents({"date": date, "shift": shift}) > 0
            draft_generated = False
            draft_error = None
            if extraction_completed:
                try:
                    draft_summary = synchronize_peel_drafts(date, shift)
                    draft_generated = (draft_summary["created"] + draft_summary["updated"] + draft_summary["submitted_skipped"] > 0) or bool(
                        peel_test_collection.find_one({"date": date, "shift": shift})
                    )
                except Exception as exc:
                    draft_error = str(exc)
                    summary["errors"] += 1
                    logger.exception("draft_generation_failed date=%s shift=%s error=%s", date, shift, exc)
            status_update = {
                "extraction_completed": extraction_completed,
                "metadata_extraction_completed": True,
                "metadata_values_complete": _metadata_complete(documents),
                "metadata_stored": metadata_stored,
                "draft_generated": draft_generated,
                "last_updated": utc_now(),
            }
            if extraction_completed:
                status_update["extraction_completed_at"] = utc_now()
            if draft_generated:
                status_update["draft_generated_at"] = utc_now()
                logger.info("cleanup_scheduled date=%s shift=%s eligible_after_days=7", date, shift)
            if draft_error:
                status_update["error"] = draft_error[:1000]
            status_operation: Dict[str, Any] = {"$set": status_update}
            if not draft_error:
                status_operation["$unset"] = {"error": ""}
            peel_extraction_status_collection.update_one({"date": date, "shift": shift}, status_operation)

        logger.info("extraction_completed prefix=%s summary=%s", s3_prefix, summary)
        return summary
    except ClientError as exc:
        summary["errors"] += 1
        logger.exception("s3_extraction_failed prefix=%s error=%s", s3_prefix, exc)
        return summary
    except Exception as exc:
        summary["errors"] += 1
        logger.exception("extraction_failed prefix=%s error=%s", s3_prefix, exc)
        return summary


def _active_processing_file_paths() -> set[str]:
    cutoff = utc_now() - timedelta(hours=PROCESSING_LOCK_TTL_HOURS)
    try:
        return {
            item["file_path"]
            for item in peel_processing_files_collection.find(
                {"status": "processing", "started_at": {"$gte": cutoff}},
                {"file_path": 1},
            )
        }
    except PyMongoError as exc:
        logger.exception("processing_file_lookup_failed error=%s", exc)
        return set()


def _processed_file_paths(file_paths: List[str]) -> set[str]:
    processed: set[str] = set()
    try:
        for chunk in _chunks(file_paths):
            cursor = peel_file_metadata_collection.find(
                {"file_path": {"$in": chunk}, "status": "processed"},
                {"file_path": 1},
            )
            processed.update(item["file_path"] for item in cursor)
    except PyMongoError as exc:
        logger.exception("processed_file_lookup_failed error=%s", exc)
    return processed


def cleanup_old_s3_files(
    s3_prefix: str,
    *,
    days: int = 7,
    dry_run: bool = False,
    s3_service: Optional[S3Service] = None,
) -> Dict[str, Any]:
    s3_service = s3_service or S3Service()
    normalized_prefix = s3_prefix.rstrip("/") + "/"
    cutoff = utc_now() - timedelta(days=days)
    deleted: List[str] = []
    skipped: List[str] = []
    errors: List[Dict[str, str]] = []
    deletion_candidates: List[Tuple[str, str, str]] = []

    logger.info("cleanup_started prefix=%s days=%s dry_run=%s", normalized_prefix, days, dry_run)
    try:
        paginator = s3_service.s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=s3_service.bucket_name, Prefix=normalized_prefix):
            for obj in page.get("Contents", []):
                key = obj.get("Key")
                if not key:
                    continue

                last_modified = _utc_naive(obj["LastModified"])
                if key.endswith("/"):
                    continue
                if not METADATA_DOCX_PATTERN.match(PurePosixPath(key).name):
                    skipped.append(key)
                    continue
                if last_modified >= cutoff:
                    skipped.append(key)
                    continue
                metadata = parse_s3_metadata(key, normalized_prefix, last_modified)
                deletion_candidates.append((key, str(metadata.get("date") or ""), str(metadata.get("shift") or "")))

        for key, date, shift in deletion_candidates:
            status_record = peel_extraction_status_collection.find_one({
                "date": date, "shift": shift,
                "extraction_completed": True, "metadata_values_complete": True,
                "metadata_stored": True, "draft_generated": True,
                "draft_generated_at": {"$lte": cutoff},
            })
            if not status_record:
                skipped.append(key)
                logger.warning("cleanup_skipped date=%s shift=%s key=%s reason=success_gate_or_age", date, shift, key)
                continue
            try:
                if not dry_run:
                    s3_service.s3_client.delete_object(Bucket=s3_service.bucket_name, Key=key)
                deleted.append(key)
                if not dry_run:
                    peel_file_metadata_collection.update_one({"file_path": key}, {"$set": {"status": "deleted", "deleted_at": utc_now()}})
                logger.info("cleanup_completed date=%s shift=%s key=%s dry_run=%s", date, shift, key, dry_run)
            except ClientError as exc:
                errors.append({"key": key, "error": str(exc)})
                logger.exception("cleanup_delete_failed key=%s error=%s", key, exc)

        summary = {"deleted": deleted, "deleted_count": len(deleted), "skipped_count": len(skipped), "errors": errors}
        logger.info("cleanup_completed prefix=%s summary=%s", normalized_prefix, summary)
        return summary
    except ClientError as exc:
        logger.exception("cleanup_failed prefix=%s error=%s", normalized_prefix, exc)
        return {"deleted": deleted, "deleted_count": len(deleted), "skipped_count": len(skipped), "errors": [{"error": str(exc)}]}


def main(force: bool = False) -> Dict[str, int]:
    s3_prefix = get_qc_data_key("Auto Peel Test Result")
    return process_s3_prefix(s3_prefix, force=force)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract Auto Peel Test data from S3 into MongoDB peel_data")
    parser.add_argument("--force", action="store_true", help="Reprocess all discovered Excel files")
    parser.add_argument("--cleanup", action="store_true", help="Run the S3 cleanup job instead of extraction")
    parser.add_argument("--dry-run", action="store_true", help="Preview cleanup deletions without deleting S3 objects")
    parser.add_argument("--cleanup-days", type=int, default=7, help="Delete ingestion files older than this many days")
    args = parser.parse_args()

    prefix = get_qc_data_key("Auto Peel Test Result")
    if args.cleanup:
        cleanup_old_s3_files(prefix, days=args.cleanup_days, dry_run=args.dry_run)
    else:
        main(force=args.force)
