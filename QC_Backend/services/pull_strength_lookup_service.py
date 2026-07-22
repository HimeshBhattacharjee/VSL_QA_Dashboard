from typing import Any, Dict

from models.bus_ribbon_pull_strength_models import BusRibbonPullStrengthDailyEntry
from services.bus_ribbon_group_service import is_bussing_group_off


BUSSING_KEY_BY_LINE = {
    1: "autoBussing1",
    2: "autoBussing2",
    3: "autoBussing3",
    4: "autoBussing4",
    5: "autoBussing5",
}
REPORT_LINE_BY_BUSSING_LINE = {
    1: "FAB-II Line-I",
    2: "FAB-II Line-I",
    3: "FAB-II Line-I",
    4: "FAB-II Line-II",
    5: "FAB-II Line-II",
}
VALID_SIDES = {"TOP", "MIDDLE", "BOTTOM"}


def normalize_lookup_number(value: Any, field_name: str, minimum: int, maximum: int) -> int:
    try:
        number = int(str(value or "").strip().replace("Line-", ""))
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}")
    if number < minimum or number > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}")
    return number


def normalize_side(value: Any) -> str:
    side = str(value or "").strip().upper()
    if side not in VALID_SIDES:
        raise ValueError("Side must be Top, Middle, or Bottom")
    return side


def normalize_position_value(position: Any, side: Any) -> str:
    position_number = normalize_lookup_number(position, "Position", 1, 3)
    return f"{position_number}-{normalize_side(side)}"


def normalize_stored_position(value: Any) -> str:
    return str(value or "").strip().upper().replace(" ", "")


def empty_lookup_result(
    *,
    date: str,
    shift: str,
    line: int,
    position: int,
    side: str,
    report_line: str,
    bussing_key: str,
) -> Dict[str, Any]:
    return {
        "found": False,
        "date": date,
        "shift": shift,
        "line": line,
        "position": position,
        "side": side.title(),
        "reportLine": report_line,
        "bussingKey": bussing_key,
        "measurements": [],
        "averages": {},
    }


class PullStrengthLookupService:
    @staticmethod
    def lookup(date: Any, shift: Any, line: Any, position: Any, side: Any) -> Dict[str, Any]:
        date_key = str(date or "").split("T")[0].strip()
        shift_key = str(shift or "").strip().upper()
        if not date_key:
            raise ValueError("Date is required")
        if shift_key not in {"A", "B", "C"}:
            raise ValueError("Shift must be A, B, or C")

        line_number = normalize_lookup_number(line, "Line", 1, 5)
        position_number = normalize_lookup_number(position, "Position", 1, 3)
        side_key = normalize_side(side)
        report_line = REPORT_LINE_BY_BUSSING_LINE[line_number]
        bussing_key = BUSSING_KEY_BY_LINE[line_number]
        target_position = f"{position_number}-{side_key}"

        base_result = empty_lookup_result(
            date=date_key,
            shift=shift_key,
            line=line_number,
            position=position_number,
            side=side_key,
            report_line=report_line,
            bussing_key=bussing_key,
        )

        entry = BusRibbonPullStrengthDailyEntry.get_by_date_line_shift(date_key, report_line, shift_key)
        if not entry:
            return base_result

        machine = (entry.get("bussingData") or {}).get(bussing_key) or {}
        if is_bussing_group_off(machine):
            return base_result
        if normalize_stored_position(machine.get("position")) != target_position:
            return base_result

        strengths = ["" if value is None else str(value) for value in (machine.get("strengths") or [])[:32]]
        strengths.extend([""] * (32 - len(strengths)))
        if not any(value.strip() for value in strengths):
            return base_result

        return {
            **base_result,
            "found": True,
            "measurements": strengths,
            "averages": (entry.get("averages") or {}).get(bussing_key) or {},
            "source": {
                "entryId": str(entry.get("_id") or ""),
                "updatedAt": entry.get("updated_at") or entry.get("updatedAt") or "",
            },
        }
