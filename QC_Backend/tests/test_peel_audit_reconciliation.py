from copy import deepcopy
from datetime import datetime, timedelta

from services.peel_audit_reconciliation_service import build_source_side, reconcile_payload


def audit_side(state="pending_source_data", values=None, *, line="I", stringer=1, unit="A"):
    return {
        "date": "2026-07-21",
        "shift": "C",
        "lineNumber": line,
        "stages": [{
            "id": 5,
            "parameters": [{
                "id": "5-11-peel-strength",
                "observations": [{
                    "timeSlot": "",
                    "value": {
                        f"Stringer-{stringer}": {
                            "frontUnit": unit,
                            "frontSide": values or {},
                            "backUnit": "OFF",
                            "backSide": {str(index): "OFF" for index in range(1, 21)},
                            "peelSync": {
                                "frontSide": {"state": state},
                                "backSide": {"state": "intentional_off"},
                            },
                        }
                    },
                }],
            }],
        }],
    }


def source(*, source_id="source-1", stringer=1, unit="A", positions=range(1, 17), value=1.2, updated=None):
    record = {
        "_id": source_id,
        "date": "2026-07-21",
        "shift": "C",
        "Stringer": stringer,
        "Unit": unit,
        "updated_at": updated or datetime(2026, 7, 21, 12),
    }
    for position in positions:
        for ribbon in range(1, 8):
            record[f"Front_{position}_{ribbon}"] = value
    return record


def front(data):
    return data["stages"][0]["parameters"][0]["observations"][0]["value"]["Stringer-1"]


def test_late_arrival_syncs_line_i_draft_or_submitted_payload_and_is_idempotent():
    data = audit_side()
    events = reconcile_payload(data, [source()], now=datetime(2026, 7, 21, 13))
    assert len(events) == 1
    assert front(data)["peelSync"]["frontSide"]["state"] == "synced"
    assert front(data)["frontSide"]["1"] == "1.20"
    assert front(data)["frontSide"]["17"] == "OFF"
    assert reconcile_payload(data, [source()], now=datetime(2026, 7, 21, 14)) == []


def test_no_data_keeps_pending_and_does_not_write_values():
    data = audit_side()
    assert reconcile_payload(data, []) == []
    assert front(data)["frontSide"] == {}
    assert front(data)["peelSync"]["frontSide"]["state"] == "pending_source_data"


def test_partial_data_populates_available_positions_and_remains_pending():
    data = audit_side()
    events = reconcile_payload(data, [source(positions=range(1, 9))])
    assert len(events) == 1
    assert front(data)["frontSide"]["8"] == "1.20"
    assert "9" not in front(data)["frontSide"]
    assert front(data)["peelSync"]["frontSide"]["state"] == "pending_source_data"


def test_newest_duplicate_source_wins_and_source_ids_are_traceable():
    old = source(source_id="old", value=1.1)
    new = source(source_id="new", value=1.9, updated=old["updated_at"] + timedelta(minutes=1))
    values, ids = build_source_side([old, new], "Front")
    assert values["1"] == "1.90"
    assert ids == ["new"]


def test_intentional_off_manual_override_and_synced_are_never_overwritten():
    for state in ("intentional_off", "manual_override", "synced"):
        original = {str(index): "9.9" for index in range(1, 21)}
        data = audit_side(state=state, values=original)
        before = deepcopy(front(data))
        assert reconcile_payload(data, [source()]) == []
        assert front(data) == before


def test_matching_requires_stringer_and_unit_for_both_fab_lines():
    line_i = audit_side(stringer=1, line="I")
    assert reconcile_payload(line_i, [source(stringer=7)]) == []
    line_ii = audit_side(stringer=7, line="II")
    assert len(reconcile_payload(line_ii, [source(stringer=7)]) ) == 1


def test_source_update_can_refresh_only_previous_auto_values_while_pending():
    data = audit_side()
    reconcile_payload(data, [source(positions=range(1, 3), value=1.1)])
    reconcile_payload(data, [source(positions=range(1, 17), value=1.8, updated=datetime(2026, 7, 21, 14))])
    assert front(data)["frontSide"]["1"] == "1.80"
    assert front(data)["peelSync"]["frontSide"]["state"] == "synced"


def test_legacy_off_backfill_requires_explicit_migration_flag():
    values = {str(index): "OFF" for index in range(1, 21)}
    data = audit_side(values=values)
    front(data)["peelSync"].pop("frontSide")
    assert reconcile_payload(data, [source()], migrate_legacy=False) == []
    assert len(reconcile_payload(data, [source()], migrate_legacy=True)) == 1
