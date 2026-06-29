import calendar
from copy import deepcopy
from datetime import date
from typing import Any, Dict, Iterable

from generators.stringer_parameter_mappings import get_stringer_parameter_mapper
from models.ipqc_audit_models import IPQCAudit, ipqc_audit_collection
from models.stringer_parameter_report_models import (
    StringerParameterReport,
    serialize_stringer_parameter_report,
)


REPORT_SHIFTS = ("A", "B", "C")
MANUAL_FIELDS = ("moduleType", "cellType", "cellWp")


def normalize_report_line(line: str) -> str:
    normalized = str(line or "").strip().upper().replace("FAB-II ", "").replace("LINE-", "")
    return "II" if normalized == "II" else "I"


def make_row_key(date_key: str, shift: str, machine: int) -> str:
    return f"{date_key}|{shift}|{machine}"


def _normalize_manual_fields(value: Any) -> Dict[str, str]:
    source = value if isinstance(value, dict) else {}
    return {
        field: str(source.get(field) or "")
        for field in MANUAL_FIELDS
    }


def _audit_state(audit: Dict[str, Any]) -> str:
    state = audit.get("workflowState") or audit.get("status")
    return state if state in {"draft", "submitted", "returned"} else "submitted"


def _audit_sort_value(audit: Dict[str, Any]) -> str:
    return str(audit.get("updated_timestamp") or audit.get("updatedAt") or audit.get("timestamp") or "")


def _get_month_audits(year: int, month: int, line: str) -> Dict[str, Dict[str, Any]]:
    month_prefix = f"{year:04d}-{month:02d}"
    audits = ipqc_audit_collection.find(
        {
            "lineNumber": line,
            "date": {"$regex": f"^{month_prefix}"},
        }
    )
    latest_by_slot: Dict[str, Dict[str, Any]] = {}
    for audit in audits:
        if _audit_state(audit) != "submitted":
            continue
        audit_date = str(audit.get("date") or "").split("T")[0]
        shift = str(audit.get("shift") or "").strip().upper()
        if shift not in REPORT_SHIFTS or not audit_date:
            continue
        slot_key = f"{audit_date}|{shift}"
        previous = latest_by_slot.get(slot_key)
        if previous is None or _audit_sort_value(audit) >= _audit_sort_value(previous):
            latest_by_slot[slot_key] = audit
    return latest_by_slot


def _get_stage_parameter_values(audit_data: Dict[str, Any]) -> Dict[str, Any]:
    for stage in audit_data.get("stages", []) or []:
        if stage.get("id") != 5:
            continue
        values = {}
        for parameter in stage.get("parameters", []) or []:
            observations = parameter.get("observations") or []
            values[parameter.get("id")] = observations[0].get("value") if observations else {}
        return values
    return {}


def _extract_machine_values(mapper, parameter_values: Dict[str, Any], machine: int) -> Dict[str, Dict[str, str]]:
    machine_key = f"Stringer-{machine}"
    machine_temperature = parameter_values.get("5-9-machine-temp-setup") or {}
    light_intensity = parameter_values.get("5-10-light-intensity-time") or {}
    machine_temperature = machine_temperature.get(machine_key) if isinstance(machine_temperature, dict) else {}
    light_intensity = light_intensity.get(machine_key) if isinstance(light_intensity, dict) else {}

    return {
        "unitA": mapper.extract_unit_values(machine_temperature or {}, light_intensity or {}, "unitA"),
        "unitB": mapper.extract_unit_values(machine_temperature or {}, light_intensity or {}, "unitB"),
    }


def _empty_audit_values(mapper) -> Dict[str, Dict[str, str]]:
    empty_unit = {column["key"]: "" for column in mapper.audit_columns}
    return {"unitA": dict(empty_unit), "unitB": dict(empty_unit)}


def _build_audit_source(audit: Dict[str, Any]) -> Dict[str, str]:
    return {
        "auditId": str(audit.get("_id") or ""),
        "updatedTimestamp": _audit_sort_value(audit),
        "name": str(audit.get("name") or ""),
    }


def build_month_structure(
    year: int,
    month: int,
    line: str,
    existing_report: Dict[str, Any] | None = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    normalized_line = normalize_report_line(line)
    mapper = get_stringer_parameter_mapper(normalized_line)
    days_in_month = calendar.monthrange(year, month)[1]
    existing_report = existing_report or {}
    manual_fields = {
        key: _normalize_manual_fields(value)
        for key, value in (existing_report.get("manualFields") or {}).items()
    }
    existing_rows = {
        row.get("rowKey"): row
        for row in (existing_report.get("rows") or [])
        if isinstance(row, dict) and row.get("rowKey")
    }
    existing_sources = existing_report.get("auditSources") or {}
    audits_by_slot = _get_month_audits(year, month, normalized_line)
    audit_sources = {
        slot_key: _build_audit_source(audit)
        for slot_key, audit in audits_by_slot.items()
    }
    audit_payload_cache: Dict[str, Dict[str, Any]] = {}
    rows = []

    for day_number in range(1, days_in_month + 1):
        date_key = date(year, month, day_number).isoformat()
        for shift in REPORT_SHIFTS:
            slot_key = f"{date_key}|{shift}"
            audit = audits_by_slot.get(slot_key)
            source = audit_sources.get(slot_key)
            source_unchanged = source == existing_sources.get(slot_key)
            parameter_values = None

            for machine in mapper.machine_numbers:
                row_key = make_row_key(date_key, shift, machine)
                previous_row = existing_rows.get(row_key) or {}
                manual = manual_fields.setdefault(
                    row_key,
                    _normalize_manual_fields(previous_row),
                )

                if audit is None:
                    po_number = ""
                    audit_values = _empty_audit_values(mapper)
                    row_source = None
                elif source_unchanged and not force_refresh and previous_row.get("auditSource") == source:
                    po_number = str(previous_row.get("poNumber") or "")
                    audit_values = deepcopy(previous_row.get("auditValues") or _empty_audit_values(mapper))
                    row_source = source
                else:
                    audit_id = str(audit["_id"])
                    if audit_id not in audit_payload_cache:
                        audit_data = IPQCAudit.from_dict(audit).get_data()
                        audit_payload_cache[audit_id] = {
                            "parameters": _get_stage_parameter_values(audit_data),
                            "poNumber": str(
                                audit.get("productionOrderNo")
                                or audit_data.get("productionOrderNo")
                                or ""
                            ),
                        }
                    parameter_values = audit_payload_cache[audit_id]["parameters"]
                    po_number = audit_payload_cache[audit_id]["poNumber"]
                    audit_values = _extract_machine_values(mapper, parameter_values, machine)
                    row_source = source

                rows.append({
                    "rowKey": row_key,
                    "date": date_key,
                    "shift": shift,
                    "line": normalized_line,
                    "poNumber": po_number,
                    "machine": machine,
                    **manual,
                    "auditValues": audit_values,
                    "auditSource": row_source,
                })

    return {
        "year": year,
        "month": month,
        "line": normalized_line,
        "rows": rows,
        "manualFields": manual_fields,
        "auditSources": audit_sources,
        "auditColumns": [dict(column) for column in mapper.audit_columns],
        "shifts": list(REPORT_SHIFTS),
        "machineNumbers": list(mapper.machine_numbers),
        "daysInMonth": days_in_month,
        "auditSourceCount": len(audit_sources),
    }


def synchronize_month_report(year: int, month: int, line: str, force_refresh: bool = False) -> Dict[str, Any]:
    normalized_line = normalize_report_line(line)
    existing_report = StringerParameterReport.get(year, month, normalized_line)
    synchronized = build_month_structure(
        year,
        month,
        normalized_line,
        existing_report=existing_report,
        force_refresh=force_refresh,
    )
    stored = StringerParameterReport.upsert(
        year=year,
        month=month,
        line=normalized_line,
        rows=synchronized["rows"],
        manual_fields=synchronized["manualFields"],
        audit_sources=synchronized["auditSources"],
        metadata={
            "daysInMonth": synchronized["daysInMonth"],
            "auditSourceCount": synchronized["auditSourceCount"],
        },
    )
    serialized = serialize_stringer_parameter_report(stored) or {}
    serialized.update({
        "auditColumns": synchronized["auditColumns"],
        "shifts": synchronized["shifts"],
        "machineNumbers": synchronized["machineNumbers"],
    })
    return serialized


def update_manual_fields(
    year: int,
    month: int,
    line: str,
    changes: Iterable[Dict[str, Any]],
    updated_by: str,
) -> Dict[str, Any]:
    normalized_line = normalize_report_line(line)
    existing_report = StringerParameterReport.get(year, month, normalized_line) or {}
    manual_fields = {
        key: _normalize_manual_fields(value)
        for key, value in (existing_report.get("manualFields") or {}).items()
    }

    for change in changes:
        row_key = str(change.get("rowKey") or "")
        if not row_key:
            continue
        current = manual_fields.setdefault(row_key, _normalize_manual_fields({}))
        for field in MANUAL_FIELDS:
            if field in change:
                current[field] = str(change.get(field) or "")

    StringerParameterReport.save_manual_fields(
        year,
        month,
        normalized_line,
        manual_fields,
        updated_by,
    )
    return synchronize_month_report(year, month, normalized_line)
