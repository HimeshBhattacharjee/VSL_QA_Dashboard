from pathlib import Path

import pytest
from openpyxl import Workbook

from generators.PottingRatioReportGenerator import fill_potting_data_in_sheet
from routes.potting_ratio_route import normalize_entry_payload
from services.potting_ratio_evaluation import evaluate_potting_ratio


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [
        ("3.99", "Not OK"),
        ("4", "OK"),
        ("4.01", "OK"),
        ("5.25", "OK"),
        ("5.99", "OK"),
        ("6", "OK"),
        ("6.01", "Not OK"),
        ("0", "Not OK"),
        ("4:1", "OK"),
    ],
)
def test_ratio_boundaries_zero_decimals_and_display_format(ratio, expected):
    evaluation = evaluate_potting_ratio(ratio)
    assert evaluation.valid is True
    assert evaluation.status == expected


@pytest.mark.parametrize("ratio", [None, "", " ", "abc", "4:2", "NaN", "Infinity"])
def test_blank_and_malformed_ratios_are_neutral(ratio):
    evaluation = evaluate_potting_ratio(ratio)
    assert evaluation.valid is False
    assert evaluation.status == ""
    assert evaluation.message


def test_client_cannot_tamper_with_calculated_remark():
    payload = {
        "date": "2026-07-22",
        "testingDate": "2026-07-22",
        "shift": "A",
        "lineGroup": "Line-I",
        "lines": {
            "1": {"po": "PO-1", "ratio": "5", "remarks": "Not OK"},
            "2": {"po": "PO-2", "ratio": "7", "remarks": "OK"},
        },
    }
    normalized = normalize_entry_payload(payload)
    assert normalized["lines"]["1"]["remarks"] == "OK"
    assert normalized["lines"]["2"]["remarks"] == "Not OK"


@pytest.mark.parametrize(
    ("ratio", "remark", "fill"),
    [("5", "OK", "0092D050"), ("7", "Not OK", "00FF9999")],
)
def test_excel_styles_only_calculated_remark(ratio, remark, fill):
    worksheet = Workbook().active
    fill_potting_data_in_sheet(
        worksheet,
        [{"shift": "A", "lineGroup": "Line-I", "lines": {"1": {"ratio": ratio, "remarks": "tampered"}, "2": {}}}],
        "22.07.2026",
    )
    assert worksheet["I6"].value == f"{ratio}:1"
    assert worksheet["I6"].fill.fill_type is None
    assert worksheet["K6"].value == remark
    assert worksheet["K6"].fill.fill_type == "solid"
    assert worksheet["K6"].fill.fgColor.rgb == fill


def test_ui_ratio_is_neutral_and_remark_is_read_only_and_colored():
    source = (
        Path(__file__).parents[2]
        / "QC_Frontend"
        / "src"
        / "pages"
        / "PottingRatioShiftEntryWorkflow.tsx"
    ).read_text(encoding="utf-8")
    ratio_section = source[source.index("Ratio (A:B)"):source.index("Total Weight (gm)")]
    remarks_section = source[source.index("Remarks (Line"):source.index("placeholder={ratioCriterion")]
    assert "bg-red" not in ratio_section and "bg-green" not in ratio_section
    assert "readOnly" in remarks_section
    assert "bg-green" in remarks_section and "bg-red" in remarks_section
