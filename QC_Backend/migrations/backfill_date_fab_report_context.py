"""Backfill canonical reportDate/fabLine keys for the three line reports.

Run before deploying the unique indexes:
    python -m migrations.backfill_date_fab_report_context --apply

The command is a dry run without ``--apply``. Records without an authoritative
FAB value are marked ``reportContextReviewRequired`` and are never guessed.
"""

import argparse
from collections import defaultdict
from datetime import datetime

from constants import MONGODB_DB_NAME, MONGODB_URI
from pymongo import MongoClient

from report_context import FAB_LINE_I, FAB_LINE_II, normalize_fab_line
from services.po_line_mapping_service import map_po_to_fab_line


COLLECTIONS = (
    "jb_contact_block_maintenance_daily_entries",
    "rot_daily_entries",
    "wet_leakage_daily_entries",
)


def infer_context(document: dict) -> tuple[str | None, str | None, str]:
    date_value = document.get("reportDate") or document.get("date") or document.get("testingDate")
    try:
        report_date = datetime.strptime(str(date_value or "").split("T")[0], "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return None, None, "missing-or-invalid-date"

    explicit = document.get("fabLine") or document.get("fab") or document.get("lineGroup")
    fab_line = normalize_fab_line(explicit, allow_legacy=True)
    if fab_line:
        return report_date, fab_line, "explicit-line-field"

    po_values = [document.get("po"), document.get("productionOrder")]
    po_summary = document.get("poSummary")
    if po_summary:
        po_values.extend(str(po_summary).replace("/", " ").split())
    po_mappings = [map_po_to_fab_line(value) for value in po_values]
    mapped = {mapping.line for mapping in po_mappings if mapping.is_mapped}
    if mapped == {FAB_LINE_I} or mapped == {FAB_LINE_II}:
        return report_date, mapped.pop(), "production-order-prefix"
    return report_date, None, "missing-or-ambiguous-line"


def plan_collection(documents: list[dict]) -> tuple[list[dict], list[dict]]:
    candidates: list[dict] = []
    reviews: list[dict] = []
    by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for document in documents:
        report_date, fab_line, source = infer_context(document)
        item = {"_id": document["_id"], "reportDate": report_date, "fabLine": fab_line, "source": source}
        if report_date and fab_line:
            by_key[(report_date, fab_line)].append(item)
        else:
            reviews.append(item)
    for items in by_key.values():
        if len(items) == 1:
            candidates.extend(items)
        else:
            for item in items:
                item["source"] = "duplicate-date-line"
                reviews.append(item)
    return candidates, reviews


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    database = MongoClient(MONGODB_URI)[MONGODB_DB_NAME]
    for collection_name in COLLECTIONS:
        collection = database[collection_name]
        candidates, reviews = plan_collection(list(collection.find({})))
        print(f"{collection_name}: map={len(candidates)} review={len(reviews)}")
        if not args.apply:
            continue
        for item in candidates:
            collection.update_one({"_id": item["_id"]}, {"$set": {"reportDate": item["reportDate"], "date": item["reportDate"], "fabLine": item["fabLine"], "fab": item["fabLine"], "lineGroup": "Line-II" if item["fabLine"] == FAB_LINE_II else "Line-I", "reportContextSource": item["source"]}, "$unset": {"reportContextReviewRequired": "", "reportContextReviewReason": ""}})
        for item in reviews:
            collection.update_one({"_id": item["_id"]}, {"$set": {"reportContextReviewRequired": True, "reportContextReviewReason": item["source"]}, "$unset": {"reportDate": "", "fabLine": ""}})


if __name__ == "__main__":
    main()
