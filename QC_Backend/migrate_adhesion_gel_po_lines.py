"""Idempotently backfill canonical PO-derived FAB lines for Adhesion and Gel reports."""
from models.adhesion_test_models import adhesion_test_collection, AdhesionTestReport
from models.gel_test_models import gel_test_collection, GelTestReport
from services.po_line_mapping_service import map_po_to_fab_line

def backfill_collection(collection, report_model=None, po_field: str = "productionOrderNo") -> dict[str, int]:
    counts = {"scanned": 0, "updated": 0, "unmapped": 0}
    for report in collection.find({}):
        counts["scanned"] += 1
        production_order = report.get("productionOrderNo")
        if not str(production_order or "").strip() and report_model and report.get("s3_key"):
            form_data = report_model.from_dict(report).get_data().get("form_data", {})
            production_order = form_data.get(po_field) or form_data.get("productionOrderNo")
        mapping = map_po_to_fab_line(production_order)
        if not mapping.is_mapped:
            counts["unmapped"] += 1
        if report.get("lineNumber") != mapping.line or report.get("productionOrderNo") != mapping.production_order:
            collection.update_one(
                {"_id": report["_id"]},
                {"$set": {"productionOrderNo": mapping.production_order, "lineNumber": mapping.line}},
            )
            counts["updated"] += 1
    return counts

if __name__ == "__main__":
    print("adhesion", backfill_collection(adhesion_test_collection, AdhesionTestReport, "adhesion_editable_1"))
    print("gel", backfill_collection(gel_test_collection, GelTestReport, "gel_editable_1"))
