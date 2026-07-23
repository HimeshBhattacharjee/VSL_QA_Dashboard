from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal


# Authoritative process recipe: (5 +/- 1):1. Boundaries are inclusive.
POTTING_RATIO_LOWER_LIMIT = Decimal("4")
POTTING_RATIO_UPPER_LIMIT = Decimal("6")
POTTING_RATIO_DENOMINATOR = Decimal("1")

PottingRatioStatus = Literal["OK", "Not OK", ""]


@dataclass(frozen=True)
class PottingRatioEvaluation:
    status: PottingRatioStatus
    valid: bool
    message: str = ""


def evaluate_potting_ratio(value) -> PottingRatioEvaluation:
    """Evaluate a stored A:B ratio where B is displayed as the fixed ':1' unit."""
    if value is None or str(value).strip() == "":
        return PottingRatioEvaluation("", False, "Ratio is pending until Part A and Part B are complete.")

    text = str(value).strip()
    if text.endswith(":1"):
        text = text[:-2].strip()
    try:
        ratio = Decimal(text)
    except (InvalidOperation, ValueError):
        return PottingRatioEvaluation("", False, "Ratio must be a valid number in A:1 format.")

    if not ratio.is_finite():
        return PottingRatioEvaluation("", False, "Ratio must be a finite number in A:1 format.")

    status: PottingRatioStatus = (
        "OK" if POTTING_RATIO_LOWER_LIMIT <= ratio <= POTTING_RATIO_UPPER_LIMIT else "Not OK"
    )
    return PottingRatioEvaluation(status, True)


def apply_potting_ratio_remarks(lines: dict) -> dict:
    """Overwrite client remarks with the authoritative calculated result."""
    for line in (lines or {}).values():
        if not isinstance(line, dict) or str(line.get("status", "ON")).upper() == "OFF":
            continue
        line["remarks"] = evaluate_potting_ratio(line.get("ratio")).status
    return lines


def potting_ratio_criterion() -> dict:
    return {
        "lowerLimit": float(POTTING_RATIO_LOWER_LIMIT),
        "upperLimit": float(POTTING_RATIO_UPPER_LIMIT),
        "denominator": float(POTTING_RATIO_DENOMINATOR),
        "inclusive": True,
        "display": "Part A and B ratio is 5:1 +/- 1 (Range: 4:1 to 6:1)",
    }
