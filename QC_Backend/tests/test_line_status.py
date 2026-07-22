from line_status import LINE_OFF, LINE_ON, excel_value, get_line_status, normalize_line, normalize_lines


def test_legacy_and_new_lines_default_on():
    assert get_line_status(None) == LINE_ON
    assert normalize_line({"po": "123"}) == {"po": "123", "status": LINE_ON}


def test_turning_off_discards_contradictory_measurements():
    assert normalize_line({"status": LINE_OFF, "po": "stale", "ratio": "5"}) == {"status": LINE_OFF}


def test_lines_transition_independently():
    lines = normalize_lines({"1": {"status": "OFF", "po": "stale"}, "2": {"po": "live"}}, ("1", "2"))
    assert lines["1"] == {"status": LINE_OFF}
    assert lines["2"] == {"po": "live", "status": LINE_ON}


def test_excel_value_is_off_only_for_off_line():
    assert excel_value({"status": LINE_OFF}, 4.2) == "OFF"
    assert excel_value({"status": LINE_ON}, 4.2) == 4.2
