from routes.frame_sealant_wt_route import normalize_entry_payload as normalize_frame
from routes.jb_sealant_wt_route import normalize_entry_payload as normalize_jb
from routes.peel_strength_bus_ribbon_jb_soldering_route import normalize_entry_payload as normalize_peel
from routes.potting_ratio_route import normalize_entry_payload as normalize_potting
from routes.ssh_route import normalize_entry_payload as normalize_ssh


BASE = {"date": "2026-07-21", "testingDate": "2026-07-21", "shift": "A"}
OFF_PAIR = {"1": {"status": "OFF", "po": "stale"}, "2": {"status": "OFF", "po": "stale"}}


def assert_off_pair(entry):
    assert entry["lines"]["1"] == {"status": "OFF"}
    assert entry["lines"]["2"] == {"status": "OFF"}


def test_frame_and_jb_skip_line_validation_and_strip_stale_values():
    assert_off_pair(normalize_frame({**BASE, "lineGroup": "Line-I", "lines": OFF_PAIR}))
    assert_off_pair(normalize_jb({**BASE, "lineGroup": "Line-I", "lines": OFF_PAIR}))


def test_potting_and_ssh_skip_off_line_requirements():
    assert_off_pair(normalize_potting({**BASE, "lineGroup": "Line-II", "lines": OFF_PAIR}))
    assert_off_pair(normalize_ssh({**BASE, "lineGroup": "Line-II", "po": "PO", "checkedBy": "Operator", "lines": OFF_PAIR}))


def test_peel_uses_only_the_selected_fab_pair():
    result = normalize_peel({**BASE, "fab": "FAB-II Line-II", "lines": {"Line - 3": {"status": "OFF", "average": 0}, "Line - 4": {"status": "OFF"}, "Line - 1": {"po": "wrong pair"}}})
    assert set(result["lines"]) == {"Line - 3", "Line - 4"}
    assert result["lines"]["Line - 3"] == {"status": "OFF"}
