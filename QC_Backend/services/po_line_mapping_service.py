from dataclasses import dataclass
from typing import Any

FAB_LINE_I = "FAB-II Line-I"
FAB_LINE_II = "FAB-II Line-II"
UNMAPPED_FAB_LINE = "Unmapped"

@dataclass(frozen=True)
class POLineMapping:
    production_order: str
    line: str
    is_mapped: bool

def map_po_to_fab_line(value: Any) -> POLineMapping:
    production_order = "" if value is None else str(value).strip()
    if production_order.startswith("7"):
        return POLineMapping(production_order, FAB_LINE_I, True)
    if production_order.startswith("9"):
        return POLineMapping(production_order, FAB_LINE_II, True)
    return POLineMapping(production_order, UNMAPPED_FAB_LINE, False)

def require_mapped_po(value: Any) -> POLineMapping:
    mapping = map_po_to_fab_line(value)
    if not mapping.is_mapped:
        raise ValueError("Production Order must start with 7 (FAB-II Line-I) or 9 (FAB-II Line-II)")
    return mapping
