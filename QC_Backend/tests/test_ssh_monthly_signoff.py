import copy
import unittest

from openpyxl import Workbook

from generators.SSHReportGenerator import fill_ssh_signatures
from services.ssh_signoff_service import (
    append_signoff_event,
    invalidate_approval_events,
    resolve_monthly_signoff,
)


def event(event_id, kind, name, when, **extra):
    status = extra.pop("status", "valid")
    return {"eventId": event_id, "kind": kind, "name": name, "signature": f"sig-{name}",
            "status": status, "occurredAt": when, **extra}


def entry(entry_id, date, line="Line-I", state="approved", history=None):
    return {"_id": entry_id, "date": date, "lineGroup": line, "workflowState": state,
            "signoffHistory": history or []}


class SSHMonthlySignoffTests(unittest.TestCase):
    def test_exact_month_and_line_scope_and_timezone_instants(self):
        rows = [
            entry("1", "2026-05-31", history=[event("a", "checked", "May", "2026-05-31T23:59:59+05:30")]),
            entry("2", "2026-06-01", history=[event("b", "checked", "June Early", "2026-05-31T20:00:00Z")]),
            entry("3", "2026-06-30", history=[event("c", "checked", "June Latest", "2026-07-01T00:01:00+05:30")]),
            entry("4", "2026-06-30", line="Line-II", history=[event("z", "checked", "Wrong Line", "2026-07-01T00:02:00Z")]),
            entry("5", "2026-07-01", history=[event("y", "checked", "July", "2026-07-01T00:03:00Z")]),
        ]
        self.assertEqual(resolve_monthly_signoff(rows, 2026, 6, "Line-I")["preparedBy"], "June Latest")

    def test_latest_people_equal_timestamp_uses_stable_event_id(self):
        when = "2026-06-10T10:00:00Z"
        rows = [entry("1", "2026-06-10", history=[
            event("0001", "checked", "Checker A", when), event("0002", "checked", "Checker B", when),
            event("0003", "approved", "Approver A", when), event("0004", "approved", "Approver B", when),
        ])]
        result = resolve_monthly_signoff(rows, 2026, 6, "Line-I")
        self.assertEqual((result["preparedBy"], result["approvedBy"]), ("Checker B", "Approver B"))

    def test_revoked_rejected_deleted_and_returned_events_are_excluded(self):
        approved = event("approved-1", "approved", "Old Approver", "2026-06-02T00:00:00Z")
        returned = entry("1", "2026-06-02", state="returned", history=[approved])
        returned["signoffHistory"] = invalidate_approval_events(returned, "2026-06-03T00:00:00Z", "returned")
        invalid = entry("2", "2026-06-04", history=[
            event("x", "checked", "Rejected", "2026-06-04T00:00:00Z", status="rejected"),
            event("y", "approved", "Deleted", "2026-06-05T00:00:00Z", status="deleted"),
        ])
        self.assertEqual(resolve_monthly_signoff([returned, invalid], 2026, 6, "Line-I")["approvedBy"], "")

    def test_new_events_recalculate_without_mutating_audit_history(self):
        first = event("1", "checked", "First", "2026-06-01T00:00:00Z")
        row = entry("1", "2026-06-01", state="submitted", history=[first])
        original = copy.deepcopy(row["signoffHistory"])
        row["signoffHistory"] = append_signoff_event(row, event("2", "checked", "Second", "2026-06-02T00:00:00Z"))
        self.assertEqual(row["signoffHistory"][:1], original)
        self.assertEqual(resolve_monthly_signoff([row], 2026, 6, "Line-I")["preparedBy"], "Second")

    def test_no_events_is_pending_blank_and_excel_matches_resolver(self):
        self.assertEqual(resolve_monthly_signoff([], 2026, 6, "Line-I")["preparedBy"], "")
        rows = [entry("1", "2026-06-01", history=[
            event("1", "checked", "Latest Checker", "2026-06-02T00:00:00Z"),
            event("2", "approved", "Latest Approver", "2026-06-03T00:00:00Z"),
        ])]
        resolved = resolve_monthly_signoff(rows, 2026, 6, "Line-I")
        workbook = Workbook()
        fill_ssh_signatures(workbook.active, resolved)
        self.assertEqual(workbook.active["E193"].value, resolved["preparedBy"])
        self.assertEqual(workbook.active["K193"].value, resolved["approvedBy"])

    def test_legacy_snapshot_records_are_supported_without_live_profile_lookup(self):
        legacy = {"_id": "legacy", "date": "2026-06-01", "lineGroup": "Line-I", "workflowState": "approved",
                  "checkedBy": "Historical Checker", "approvedBy": "Historical Approver",
                  "submittedAt": "2026-06-01T01:00:00Z", "approvedAt": "2026-06-01T02:00:00Z"}
        resolved = resolve_monthly_signoff([legacy], 2026, 6, "Line-I")
        self.assertEqual((resolved["preparedBy"], resolved["approvedBy"]),
                         ("Historical Checker", "Historical Approver"))


if __name__ == "__main__":
    unittest.main()
