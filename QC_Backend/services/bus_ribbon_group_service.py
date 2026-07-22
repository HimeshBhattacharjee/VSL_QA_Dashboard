from typing import Any


STRENGTH_COUNT = 32
OFF_VALUE = "OFF"


def is_bussing_group_off(machine: dict[str, Any] | None) -> bool:
    """Return the explicit state, with legacy position=OFF records supported on read."""
    machine = machine or {}
    if "isOff" in machine:
        return machine.get("isOff") is True
    return str(machine.get("position") or "").strip().upper() == OFF_VALUE


def empty_strengths() -> list[str]:
    return [""] * STRENGTH_COUNT


def has_active_measurements(machine: dict[str, Any] | None) -> bool:
    return any(value not in (None, "") for value in ((machine or {}).get("strengths") or []))

