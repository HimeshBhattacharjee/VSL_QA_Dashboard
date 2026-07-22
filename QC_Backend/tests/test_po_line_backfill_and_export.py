import unittest
from openpyxl import Workbook

from generators.AdhesionReportGenerator import fill_adhesion_basic_info
from generators.GelReportGenerator import fill_gel_basic_info
from migrate_adhesion_gel_po_lines import backfill_collection


class FakeCollection:
    def __init__(self, reports):
        self.reports = reports

    def find(self, *_args):
        return self.reports

    def update_one(self, query, update):
        report = next(item for item in self.reports if item["_id"] == query["_id"])
        report.update(update["$set"])


class BackfillAndExportTests(unittest.TestCase):
    def test_backfill_corrects_stale_and_marks_unsupported_records(self):
        reports = [
            {"_id": 1, "productionOrderNo": " 7001 ", "lineNumber": "II"},
            {"_id": 2, "productionOrderNo": "9001", "lineNumber": "FAB-II Line-II"},
            {"_id": 3, "productionOrderNo": "8001", "lineNumber": "I"},
        ]
        result = backfill_collection(FakeCollection(reports))
        self.assertEqual(result, {"scanned": 3, "updated": 2, "unmapped": 1})
        self.assertEqual(reports[0]["lineNumber"], "FAB-II Line-I")
        self.assertEqual(reports[0]["productionOrderNo"], "7001")
        self.assertEqual(reports[2]["lineNumber"], "Unmapped")

    def test_adhesion_export_writes_canonical_line_cell(self):
        sheet = Workbook().active
        fill_adhesion_basic_info(sheet, {"form_data": {"lineNumber": "FAB-II Line-I"}})
        self.assertEqual(sheet["C12"].value, "FAB-II Line-I")

    def test_gel_export_writes_canonical_line_cell(self):
        sheet = Workbook().active
        fill_gel_basic_info(sheet, {"form_data": {"lineNumber": "FAB-II Line-II"}})
        self.assertEqual(sheet["I9"].value, "FAB-II Line-II")


if __name__ == "__main__":
    unittest.main()
