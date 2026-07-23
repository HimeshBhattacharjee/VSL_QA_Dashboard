import asyncio
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from generators.JBContactBlockMaintenanceReportGenerator import fill_jb_contact_block_data_in_sheet
from models.jb_contact_block_maintenance_models import JBContactBlockMaintenanceDailyEntry
from routes import jb_contact_block_maintenance_route as route


class JBContactBlockSignoffTests(unittest.TestCase):
    def _entry(self, rows, fab="FAB-II Line-I", state="draft"):
        return {"date": "2026-07-22", "fab": fab, "workflowState": state, "lines": {"Line - 1": rows, "Line - 2": []}}

    def test_one_checker_is_derived_from_authenticated_identity(self):
        entry = self._entry([{"po": "PO1", "checkedBy": "Alice", "checkedByEmployeeId": "E1", "checkedBySignature": "users/signatures/E1.png"}])
        self.assertEqual(route.derive_prepared_by(entry), {"name": "Alice", "people": [{"name": "Alice", "employeeId": "E1", "userId": "", "signature": "users/signatures/E1.png"}]})

    def test_multiple_checkers_preserve_first_report_order_and_deduplicate(self):
        entry = self._entry([
            {"checkedBy": "Alice", "checkedByEmployeeId": "E1"},
            {"checkedBy": "Alice renamed", "checkedByEmployeeId": "e1"},
            {"checkedBy": "Bob", "checkedByEmployeeId": "E2"},
        ])
        self.assertEqual(route.derive_prepared_by(entry)["name"], "Alice, Bob")

    def test_free_text_checker_without_authenticated_id_cannot_be_preparer(self):
        self.assertEqual(route.derive_prepared_by(self._entry([{"checkedBy": "Forged"}]))["name"], "")

    def test_changed_check_replaces_payload_identity_and_retains_audit(self):
        old = self._entry([{"po": "OLD", "checkedBy": "Alice", "checkedByEmployeeId": "E1", "checkedAt": "old"}])
        new = self._entry([{"po": "NEW", "checkedBy": "Forged", "checkedByEmployeeId": "BAD"}])
        user = {"name": "Bob", "employeeId": "E2", "id": "U2", "signature": "sig2"}
        stamped = route.stamp_authenticated_checkers(new, old, user, "new")
        row = stamped["lines"]["Line - 1"][0]
        self.assertEqual((row["checkedBy"], row["checkedByEmployeeId"]), ("Bob", "E2"))
        self.assertEqual(row["checkerAudit"][0]["checkedByEmployeeId"], "E1")

    def test_cross_line_context_does_not_contribute_checkers(self):
        entry = self._entry([], fab="FAB-II Line-I")
        entry["lines"]["Line - 3"] = [{"checkedBy": "Wrong line", "checkedByEmployeeId": "E3"}]
        self.assertEqual(route.derive_prepared_by(entry)["name"], "")

    def test_new_record_contract_has_exactly_two_signatures(self):
        normalized = route.normalize_entry_payload({
            "date": "2026-07-22",
            "testingDate": "2026-07-22",
            "fab": "FAB-II Line-I",
            "lines": {},
            "signatures": {"preparedBy": "Operator A", "verifiedBy": "Supervisor B"},
        })
        self.assertEqual(normalized["signatures"], {
            "preparedBy": "Operator A",
            "verifiedBy": "Supervisor B",
        })

    def test_historical_reviewed_then_approved_fallback_is_preserved_for_display(self):
        reviewed = route.normalize_signatures({
            "signatures": {"preparedBy": "P", "reviewedBy": "R", "approvedBy": "A"}
        })
        approved_only = route.normalize_signatures({
            "preparedBySignature": "P", "approvedBySignature": "A"
        })
        self.assertEqual(reviewed, {"preparedBy": "P", "verifiedBy": "R"})
        self.assertEqual(approved_only, {"preparedBy": "P", "verifiedBy": "A"})

    @patch("models.jb_contact_block_maintenance_models.jb_contact_block_entries_collection")
    def test_daily_signatures_are_scoped_by_day_and_fab(self, collection):
        collection.update_many.return_value.modified_count = 1
        JBContactBlockMaintenanceDailyEntry.update_daily_context_signatures(
            "2026-07-22", "FAB-II Line-II", {"preparedBy": "P"}
        )
        query = collection.update_many.call_args.args[0]
        self.assertEqual(query, {"date": "2026-07-22", "fab": "FAB-II Line-II"})
        self.assertNotEqual(query["date"], "2026-07-23")

    def test_verification_permission_rejects_operator(self):
        entry = {"workflowState": "submitted", "createdByEmployeeId": "OP1"}
        operator = {"role": "Operator", "employeeId": "OP1"}
        supervisor = {"role": "Supervisor", "employeeId": "SUP1"}
        self.assertFalse(route.can_approve_entry(entry, operator))
        self.assertTrue(route.can_approve_entry(entry, supervisor))

    def test_verify_flow_writes_new_fields_without_overwriting_legacy_roles(self):
        old = {
            "_id": "507f1f77bcf86cd799439011",
            "date": "2026-07-22",
            "fab": "FAB-II Line-I",
            "workflowState": "submitted",
            "lines": {"Line - 1": [{"checkedBy": "P", "checkedByEmployeeId": "OP1"}], "Line - 2": []},
            "signatures": {"preparedBy": "P", "reviewedBy": "Historical R"},
            "reviewedBySignature": "Historical R",
        }
        saved = dict(old)
        saved.update({"workflowState": "approved", "signatures": {"preparedBy": "P", "verifiedBy": "Supervisor B"}})
        with (
            patch.object(route, "get_current_user", return_value={"name": "Supervisor B", "role": "Supervisor"}),
            patch.object(route.JBContactBlockMaintenanceDailyEntry, "get_by_id", side_effect=[old, saved]),
            patch.object(route.JBContactBlockMaintenanceDailyEntry, "update_by_id", return_value=True) as update,
        ):
            asyncio.run(route.verify_entry(old["_id"], "SUP1"))
        written = update.call_args.args[1]
        self.assertEqual(written["verifiedBySignature"], "Supervisor B")
        self.assertEqual(written["reviewedBySignature"], "Historical R")
        self.assertNotIn("approvedBySignature", written)

    def test_verification_is_blocked_without_authenticated_checker(self):
        old = self._entry([{"checkedBy": "free text only"}], state="submitted")
        old["_id"] = "507f1f77bcf86cd799439011"
        with (
            patch.object(route, "get_current_user", return_value={"name": "Supervisor", "role": "Supervisor"}),
            patch.object(route.JBContactBlockMaintenanceDailyEntry, "get_by_id", return_value=old),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(route.verify_entry(old["_id"], "SUP1"))
        self.assertEqual(raised.exception.status_code, 400)

    def test_verified_preparer_snapshot_is_not_recalculated(self):
        entry = self._entry([{"checkedBy": "New", "checkedByEmployeeId": "E2"}], state="approved")
        entry["signatures"] = {"preparedBy": "Signed Historical", "verifiedBy": "V"}
        self.assertEqual(route.apply_derived_preparer(entry)["signatures"]["preparedBy"], "Signed Historical")

    def test_excel_contains_only_prepared_and_verified_labels(self):
        worksheet = MagicMock()
        entry = {"lines": {}, "signatures": {"preparedBy": "P", "verifiedBy": "V"}}
        fill_jb_contact_block_data_in_sheet(worksheet, entry, "22.07.2026", "FAB-II Line-I")
        written = dict(call.args for call in worksheet.__setitem__.call_args_list)
        self.assertEqual(written["E56"], "PREPARED BY")
        self.assertEqual(written["J56"], "VERIFIED BY")
        all_values = list(written.values())
        self.assertNotIn("REVIEWED BY", all_values)
        self.assertNotIn("APPROVED BY", all_values)

    @patch("generators.JBContactBlockMaintenanceReportGenerator.insert_signature_image", return_value=True)
    def test_excel_renders_preparer_and_verifier_signature_references(self, insert_image):
        worksheet = MagicMock()
        entry = {
            "lines": {}, "signatures": {"preparedBy": "P", "verifiedBy": "V"},
            "preparedByDetails": [{"signature": "users/signatures/P.png"}],
            "verifiedByDetails": {"signature": "users/signatures/V.png"},
        }
        fill_jb_contact_block_data_in_sheet(worksheet, entry, "22.07.2026", "FAB-II Line-I")
        self.assertEqual(insert_image.call_args_list[0].args[2], "users/signatures/P.png")
        self.assertEqual(insert_image.call_args_list[1].args[2], "users/signatures/V.png")

    def test_legacy_signature_endpoint_cannot_bypass_verification_workflow(self):
        payload = {
            "date": "2026-07-22", "fab": "FAB-II Line-I",
            "signatures": {"verifiedBy": "forged"},
        }
        with (
            patch.object(route, "get_current_user", return_value={"name": "Operator", "role": "Operator"}),
            patch.object(route.JBContactBlockMaintenanceDailyEntry, "get_daily_context_signatures", return_value={"preparedBy": "P"}),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(route.update_signatures(payload, "OP1"))
        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
