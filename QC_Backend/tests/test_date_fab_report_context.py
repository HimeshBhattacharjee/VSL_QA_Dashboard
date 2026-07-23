import asyncio
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from migrations.backfill_date_fab_report_context import infer_context, plan_collection
from report_context import FAB_LINE_I, FAB_LINE_II, apply_report_context, report_key
from routes import rot_route, wet_leakage_route


ROT_PAYLOAD = {
    "date": "2026-07-22", "lineGroup": "Line-I", "po": "7001",
    "moduleType": "M", "moduleSerial": "S", "jbSupplier": "JB",
    "sealantSupplier": "SE", "backsheetSupplier": "BS", "result": "Pass",
    "testDoneBy": "Operator",
}

WET_PAYLOAD = {
    "date": "2026-07-22", "lineGroup": "Line-II", "po": "9001",
    "moduleType": "M", "moduleNo": "S", "cellSupplier": "C",
    "encapsulantSupplier": "E", "rearGlassSupplier": "R", "jbSupplier": "J",
    "adhesiveSealantSupplier": "A", "pottingSealantSupplier": "P",
    "waterTemp": "25", "waterResistivity": "100", "IR": "41",
    "testDoneBy": "Operator",
}


class DateFabReportContextTests(unittest.TestCase):
    def test_both_explicit_fab_lines_have_distinct_canonical_keys(self):
        line_i = apply_report_context({"date": "2026-07-22", "fabLine": FAB_LINE_I})
        line_ii = apply_report_context({"date": "2026-07-22", "fabLine": FAB_LINE_II})
        self.assertNotEqual(report_key(line_i, "rot"), report_key(line_ii, "rot"))
        self.assertEqual(line_i["lineGroup"], "Line-I")
        self.assertEqual(line_ii["lineGroup"], "Line-II")

    def test_new_payload_requires_explicit_line(self):
        with self.assertRaises(HTTPException) as raised:
            rot_route.normalize_entry_payload({**ROT_PAYLOAD, "lineGroup": None})
        self.assertEqual(raised.exception.status_code, 400)

    def test_routes_normalize_to_canonical_context(self):
        rot = rot_route.normalize_entry_payload(ROT_PAYLOAD)
        wet = wet_leakage_route.normalize_entry_payload(WET_PAYLOAD)
        self.assertEqual((rot["reportDate"], rot["fabLine"]), ("2026-07-22", FAB_LINE_I))
        self.assertEqual((wet["reportDate"], wet["fabLine"]), ("2026-07-22", FAB_LINE_II))

    def test_concurrent_duplicate_is_user_friendly_conflict(self):
        user = {"id": "1", "name": "Operator", "employeeId": "OP1", "role": "Operator"}
        with (
            patch.object(rot_route, "get_current_user", return_value=user),
            patch.object(rot_route.RoTDailyEntry, "create", side_effect=DuplicateKeyError("duplicate")),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(rot_route.create_entry(dict(ROT_PAYLOAD), "OP1"))
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("date and FAB line", raised.exception.detail)

    def test_legacy_object_id_lookup_path_remains_supported(self):
        legacy_id = "507f1f77bcf86cd799439011"
        legacy = {"_id": legacy_id, **ROT_PAYLOAD, "workflowState": "submitted"}
        with (
            patch.object(rot_route, "get_current_user", return_value={"role": "Supervisor", "employeeId": "S1"}),
            patch.object(rot_route.RoTDailyEntry, "get_by_id", return_value=legacy),
            patch.object(rot_route, "can_view_entry", return_value=True),
        ):
            result = asyncio.run(rot_route.get_entry_by_id(legacy_id, "S1"))
        self.assertEqual(result["po"], "7001")

    def test_backfill_uses_explicit_line_then_authoritative_po_mapping(self):
        self.assertEqual(infer_context({"date": "2026-07-22", "lineGroup": "Line-II"})[1], FAB_LINE_II)
        self.assertEqual(infer_context({"date": "2026-07-22", "po": "700123"})[1], FAB_LINE_I)

    def test_ambiguous_and_duplicate_history_is_flagged_not_guessed(self):
        ambiguous = {"_id": "a", "date": "2026-07-22", "poSummary": "7001 / 9001"}
        duplicate_a = {"_id": "b", "date": "2026-07-23", "fab": FAB_LINE_I}
        duplicate_b = {"_id": "c", "date": "2026-07-23", "lineGroup": "Line-I"}
        mapped, review = plan_collection([ambiguous, duplicate_a, duplicate_b])
        self.assertEqual(mapped, [])
        self.assertEqual({item["source"] for item in review}, {"missing-or-ambiguous-line", "duplicate-date-line"})

    def test_export_writer_only_receives_selected_line_entries(self):
        worksheet = MagicMock()
        rot_route_entries = [{**ROT_PAYLOAD, "fabLine": FAB_LINE_I}]
        from generators.RoTReportGenerator import fill_rot_test_data
        fill_rot_test_data(worksheet, rot_route_entries)
        written = dict(call.args for call in worksheet.__setitem__.call_args_list)
        self.assertEqual(written["C7"], "7001")
        self.assertNotIn("9001", written.values())


if __name__ == "__main__":
    unittest.main()
