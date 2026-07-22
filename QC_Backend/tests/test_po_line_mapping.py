import unittest
from services.po_line_mapping_service import FAB_LINE_I, FAB_LINE_II, UNMAPPED_FAB_LINE, map_po_to_fab_line

class POLineMappingTests(unittest.TestCase):
    def test_supported_values(self):
        for value in (7, 712345, "7ABC", " 7123 "):
            self.assertEqual(map_po_to_fab_line(value).line, FAB_LINE_I)
        for value in (9, 912345, "9ABC", " 9123 "):
            self.assertEqual(map_po_to_fab_line(value).line, FAB_LINE_II)

    def test_unmapped_values_are_explicit(self):
        for value in (None, "", "   ", 8123, "ABC"):
            mapping = map_po_to_fab_line(value)
            self.assertFalse(mapping.is_mapped)
            self.assertEqual(mapping.line, UNMAPPED_FAB_LINE)

    def test_normalizes_to_trimmed_string(self):
        self.assertEqual(map_po_to_fab_line("  7001  ").production_order, "7001")
        self.assertEqual(map_po_to_fab_line(9001).production_order, "9001")

if __name__ == "__main__":
    unittest.main()
