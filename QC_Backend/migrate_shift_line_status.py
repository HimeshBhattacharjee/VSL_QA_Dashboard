"""Idempotent backfill for per-line status on shift-based quality reports.

Run from QC_Backend with: python migrate_shift_line_status.py
"""

from models.frame_sealant_wt_models import frame_sealant_entries_collection
from models.jb_sealant_wt_models import jb_sealant_entries_collection
from models.peel_strength_bus_ribbon_jb_soldering_models import peel_strength_bus_ribbon_jb_entries_collection
from models.potting_ratio_models import potting_entries_collection
from models.ssh_test_models import ssh_entries_collection


COLLECTIONS = (
    frame_sealant_entries_collection,
    jb_sealant_entries_collection,
    peel_strength_bus_ribbon_jb_entries_collection,
    potting_entries_collection,
    ssh_entries_collection,
)


def backfill_collection(collection) -> int:
    changed = 0
    for document in collection.find({}):
        lines = document.get("lines") or {}
        updates = {
            f"lines.{key}.status": "ON"
            for key, value in lines.items()
            if isinstance(value, dict) and "status" not in value
        }
        if updates:
            collection.update_one({"_id": document["_id"]}, {"$set": updates})
            changed += 1
    return changed


if __name__ == "__main__":
    total = sum(backfill_collection(collection) for collection in COLLECTIONS)
    print(f"Backfilled line status in {total} documents")
