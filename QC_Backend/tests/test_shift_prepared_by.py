import pytest
from fastapi import HTTPException
from openpyxl import Workbook

from generators.BusRibbonPullStrengthReportGenerator import fill_bus_ribbon_data_in_sheet
from generators.FrameSealantWtReportGenerator import fill_frame_data_in_sheet
from generators.JBSealantWeightReportGenerator import fill_jb_data_in_sheet
from generators.PeelStrengthBusRibbonJBSolderingReportGenerator import fill_peel_strength_data_in_sheet
from generators.PottingRatioReportGenerator import fill_potting_data_in_sheet
from services.shift_prepared_by_service import (
    aggregate_prepared_by,
    format_prepared_by,
    trusted_signature_update,
)


def entry(shift, name=None, **extra):
    value = {"shift": shift, "signatures": {"preparedBy": name or ""}}
    value.update(extra)
    return value


def test_all_shifts_are_ordered_with_missing_value():
    assert format_prepared_by([entry("C", "Cara"), entry("A", "Arun")]) == "A: Arun; B: -; C: Cara"


def test_multiple_names_are_stable_and_duplicates_removed():
    grouped = aggregate_prepared_by([
        entry("A", "Arun"), entry("A", "Beena"), entry("A", "arun"), entry("B", "Beena")
    ])
    assert grouped == {"A": ["Arun", "Beena"], "B": ["Beena"], "C": ["-"]}


def test_submission_snapshot_wins_and_preserves_historical_name():
    value = entry("A", "Current Profile Name", submittedBy="Historical Operator", createdByEmployeeName="Creator")
    assert format_prepared_by([value]) == "A: Historical Operator; B: -; C: -"


def test_spoofed_prepared_by_is_replaced_with_authenticated_operator():
    result = trusted_signature_update({"preparedBy": "Spoofed Name"}, {}, {"name": "Real Operator", "role": "Operator"})
    assert result["preparedBy"] == "Real Operator"


def test_non_operator_cannot_sign_prepared_by():
    with pytest.raises(HTTPException) as error:
        trusted_signature_update({"preparedBy": "Spoofed"}, {}, {"name": "Reviewer", "role": "Manager"})
    assert error.value.status_code == 403


@pytest.mark.parametrize(
    ("writer", "cell", "kwargs"),
    [
        (fill_bus_ribbon_data_in_sheet, "E25", {"date_label": "01.01.2026", "line": "FAB-II Line-I"}),
        (fill_frame_data_in_sheet, "E19", {"date": "01.01.2026"}),
        (fill_jb_data_in_sheet, "C23", {"date": "01.01.2026"}),
        (fill_peel_strength_data_in_sheet, "D12", {"date_label": "01.01.2026", "fab": "FAB-II Line-I"}),
        (fill_potting_data_in_sheet, "D12", {"date": "01.01.2026"}),
    ],
)
def test_every_shift_report_family_uses_identical_excel_prepared_by(writer, cell, kwargs):
    worksheet = Workbook().active
    entries = [entry("C", "Cara"), entry("A", "Arun")]
    writer(worksheet, entries, **kwargs)
    assert worksheet[cell].value == "A: Arun; B: -; C: Cara"
