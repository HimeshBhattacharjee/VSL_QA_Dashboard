"""Backfill JB checker identities only when a legacy name uniquely matches a user.

Approved reports are intentionally untouched. Ambiguous or missing users are marked
for correction; the migration never guesses an employee identity.
"""

from datetime import datetime, timezone

from models.jb_contact_block_maintenance_models import jb_contact_block_entries_collection
from users.user_db import users_collection


def normalized_name(value):
    return " ".join(str(value or "").split()).casefold()


def run():
    users_by_name = {}
    for user in users_collection.find({"status": "Active"}, {"name": 1, "employeeId": 1, "signature": 1}):
        users_by_name.setdefault(normalized_name(user.get("name")), []).append(user)

    changed = flagged = skipped_approved = 0
    for entry in jb_contact_block_entries_collection.find({}):
        if (entry.get("workflowState") or entry.get("status")) == "approved":
            skipped_approved += 1
            continue
        unresolved = []
        lines = entry.get("lines") or {}
        for rows in lines.values():
            for row in rows if isinstance(rows, list) else []:
                if not isinstance(row, dict) or row.get("checkedByEmployeeId") or not row.get("checkedBy"):
                    continue
                matches = users_by_name.get(normalized_name(row["checkedBy"]), [])
                if len(matches) != 1:
                    unresolved.append(row["checkedBy"])
                    continue
                user = matches[0]
                row.update({
                    "checkedBy": user["name"],
                    "checkedByEmployeeId": user["employeeId"],
                    "checkedByUserId": str(user["_id"]),
                    "checkedBySignature": user.get("signature") or "",
                    "checkedAt": entry.get("updatedAt") or entry.get("updated_at") or entry.get("createdAt"),
                    "checkerAudit": row.get("checkerAudit") or [],
                })
        status = "needs_authenticated_resave" if unresolved else "resolved"
        result = jb_contact_block_entries_collection.update_one(
            {"_id": entry["_id"], "$nor": [{"workflowState": "approved"}, {"status": "approved"}]},
            {"$set": {"lines": lines, "preparedByBackfillStatus": status, "preparedByUnresolvedCheckerNames": sorted(set(unresolved)), "preparedByBackfilledAt": datetime.now(timezone.utc).isoformat()}},
        )
        changed += result.modified_count
        flagged += bool(unresolved)
    print({"changed": changed, "flagged": flagged, "skippedApproved": skipped_approved})


if __name__ == "__main__":
    run()
