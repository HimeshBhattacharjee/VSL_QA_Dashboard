from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional

from pymongo import ASCENDING, MongoClient

from constants import MONGODB_DB_NAME, MONGODB_URI
from mongo_indexes import ensure_index

logger = logging.getLogger(__name__)


client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
stringer_parameter_reports_collection = db["stringer_parameter_reports"]


def ensure_stringer_parameter_report_indexes() -> None:
    try:
        ensure_index(
            stringer_parameter_reports_collection,
            [("year", ASCENDING), ("month", ASCENDING), ("line", ASCENDING)],
            unique=True,
            name="stringer_parameter_report_month_line_idx",
        )
        ensure_index(
            stringer_parameter_reports_collection,
            [("updatedAt", ASCENDING)],
            name="stringer_parameter_report_updated_idx",
        )
    except Exception as exc:
        logger.warning("failed_to_ensure_stringer_parameter_report_indexes error=%s", exc, exc_info=True)


ensure_stringer_parameter_report_indexes()


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_stringer_parameter_report(document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if document is None:
        return None
    serialized = dict(document)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    return serialized


class StringerParameterReport:
    @staticmethod
    def get(year: int, month: int, line: str) -> Optional[Dict[str, Any]]:
        return stringer_parameter_reports_collection.find_one(
            {"year": year, "month": month, "line": line}
        )

    @staticmethod
    def upsert(
        year: int,
        month: int,
        line: str,
        rows: list,
        manual_fields: Dict[str, Dict[str, str]],
        audit_sources: Dict[str, Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        now = utc_timestamp()
        update_data = {
            "year": year,
            "month": month,
            "line": line,
            "rows": rows,
            "manualFields": manual_fields,
            "auditSources": audit_sources,
            "updatedAt": now,
            "syncedAt": now,
            **(metadata or {}),
        }
        stringer_parameter_reports_collection.update_one(
            {"year": year, "month": month, "line": line},
            {
                "$set": update_data,
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )
        return StringerParameterReport.get(year, month, line) or update_data

    @staticmethod
    def save_manual_fields(
        year: int,
        month: int,
        line: str,
        manual_fields: Dict[str, Dict[str, str]],
        updated_by: str,
    ) -> None:
        stringer_parameter_reports_collection.update_one(
            {"year": year, "month": month, "line": line},
            {
                "$set": {
                    "manualFields": manual_fields,
                    "manualUpdatedAt": utc_timestamp(),
                    "manualUpdatedBy": updated_by,
                }
            },
            upsert=True,
        )
