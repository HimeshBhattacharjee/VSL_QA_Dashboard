import argparse
import logging
import re
from datetime import datetime
from typing import Dict, Optional, Tuple

from pymongo.errors import PyMongoError

from models.peel_data_models import (
    LEGACY_COLLECTION_PATTERN,
    ensure_peel_indexes,
    normalize_peel_record,
    safe_insert_migrated_record,
    db,
)


logger = logging.getLogger("migrate_peel_collections")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

COLLECTION_MONTH_PATTERN = re.compile(r"^peel_([a-z]{3})_(\d{4})$", re.IGNORECASE)


def _month_year_from_collection(collection_name: str) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    match = COLLECTION_MONTH_PATTERN.match(collection_name)
    if not match:
        return None, None, None

    month_raw = match.group(1).title()
    try:
        month = datetime.strptime(month_raw, "%b").strftime("%b").upper()
    except ValueError:
        return None, None, None

    year = int(match.group(2))
    return month, year, f"{month} - {year}"


def migrate_peel_collections(*, dry_run: bool = False, preserve_ids: bool = True) -> Dict[str, int]:
    ensure_peel_indexes()
    summary = {
        "collections_scanned": 0,
        "records_seen": 0,
        "records_migrated": 0,
        "duplicates_skipped": 0,
        "errors": 0,
    }

    collection_names = [
        name
        for name in db.list_collection_names()
        if LEGACY_COLLECTION_PATTERN.match(name) and name.lower() != "peel_data"
    ]

    for collection_name in sorted(collection_names):
        month, year, month_name = _month_year_from_collection(collection_name)
        if not month or not year:
            continue

        summary["collections_scanned"] += 1
        source_collection = db[collection_name]
        logger.info("migration_collection_started collection=%s", collection_name)

        for source_doc in source_collection.find({}):
            summary["records_seen"] += 1
            try:
                record = dict(source_doc)
                if not preserve_ids:
                    record.pop("_id", None)

                record.setdefault("year", year)
                record.setdefault("month", month)
                record.setdefault("month_name", month_name)
                record.setdefault("file_name", "")
                record.setdefault("source_path", f"legacy:{collection_name}")

                normalized = normalize_peel_record(record)
                if dry_run:
                    summary["records_migrated"] += 1
                    continue

                status = safe_insert_migrated_record(normalized)
                if status == "migrated":
                    summary["records_migrated"] += 1
                elif status == "duplicate":
                    summary["duplicates_skipped"] += 1
            except Exception as exc:
                summary["errors"] += 1
                logger.exception(
                    "migration_record_failed collection=%s id=%s error=%s",
                    collection_name,
                    source_doc.get("_id"),
                    exc,
                )

        logger.info("migration_collection_completed collection=%s", collection_name)

    logger.info("migration_completed summary=%s", summary)
    return summary


def main() -> Dict[str, int]:
    parser = argparse.ArgumentParser(description="Migrate historical monthly peel collections into peel_data")
    parser.add_argument("--dry-run", action="store_true", help="Scan and normalize records without writing to MongoDB")
    parser.add_argument("--no-preserve-ids", action="store_true", help="Do not carry source _id values into peel_data")
    args = parser.parse_args()

    summary = migrate_peel_collections(dry_run=args.dry_run, preserve_ids=not args.no_preserve_ids)
    print(f"Collections scanned: {summary['collections_scanned']}")
    print(f"Records seen: {summary['records_seen']}")
    print(f"Records migrated: {summary['records_migrated']}")
    print(f"Duplicates skipped: {summary['duplicates_skipped']}")
    print(f"Errors: {summary['errors']}")
    return summary


if __name__ == "__main__":
    try:
        main()
    except PyMongoError as exc:
        logger.exception("migration_failed error=%s", exc)
        raise
