"""Backfill an unambiguous JB Verified By value without deleting legacy sign-offs.

Run from QC_Backend with:
    python -m migrations.backfill_jb_contact_block_verified_by
"""

from constants import MONGODB_DB_NAME, MONGODB_URI
from pymongo import MongoClient


def build_verified_by_backfill() -> list[dict]:
    return [
        {
            "$set": {
                "signatures.verifiedBy": {
                    "$switch": {
                        "branches": [
                            {"case": {"$ne": [{"$ifNull": ["$signatures.reviewedBy", ""]}, ""]}, "then": "$signatures.reviewedBy"},
                            {"case": {"$ne": [{"$ifNull": ["$reviewedBySignature", ""]}, ""]}, "then": "$reviewedBySignature"},
                            {"case": {"$ne": [{"$ifNull": ["$signatures.approvedBy", ""]}, ""]}, "then": "$signatures.approvedBy"},
                        ],
                        "default": "$approvedBySignature",
                    }
                }
            }
        }
    ]


def main() -> None:
    collection = MongoClient(MONGODB_URI)[MONGODB_DB_NAME]["jb_contact_block_maintenance_daily_entries"]
    query = {
        "$and": [
            {"$or": [{"signatures.verifiedBy": {"$exists": False}}, {"signatures.verifiedBy": ""}]},
            {
                "$or": [
                    {"signatures.reviewedBy": {"$nin": [None, ""]}},
                    {"reviewedBySignature": {"$nin": [None, ""]}},
                    {"signatures.approvedBy": {"$nin": [None, ""]}},
                    {"approvedBySignature": {"$nin": [None, ""]}},
                ]
            },
        ]
    }
    result = collection.update_many(query, build_verified_by_backfill())
    print(f"Matched {result.matched_count}; updated {result.modified_count} JB records")


if __name__ == "__main__":
    main()
