"""Idempotent late-arriving Peel Strength reconciliation for IPQC audits."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Optional

from bson import ObjectId
from pymongo import ASCENDING, ReturnDocument

from models.ipqc_audit_models import (
    IPQCAudit,
    calculate_ipqc_completion,
    db,
    ipqc_audit_collection,
)
from models.peel_data_models import peel_data_collection
from mongo_indexes import ensure_index

logger = logging.getLogger(__name__)

SERVICE_ACTOR = "service:peel-audit-reconciler"
PARAMETER_ID = "5-11-peel-strength"
SYNC_STATES = {"intentional_off", "pending_source_data", "synced", "manual_override"}
SIDE_CONFIG = (("frontUnit", "frontSide", "Front"), ("backUnit", "backSide", "Back"))
AUDIT_FIELD_COUNT = 20
SOURCE_FIELD_COUNT = 16
RIBBON_COUNT = 7
LEASE_SECONDS = 120

peel_reconciliation_audit_collection = db["ipqc_peel_reconciliation_audit"]


def utc_now() -> datetime:
    return datetime.utcnow()


def ensure_reconciliation_indexes() -> None:
    ensure_index(
        peel_reconciliation_audit_collection,
        [("eventKey", ASCENDING)],
        unique=True,
        name="unique_ipqc_peel_reconciliation_event",
    )
    ensure_index(
        peel_reconciliation_audit_collection,
        [("auditId", ASCENDING), ("reconciledAt", ASCENDING)],
        name="ipqc_peel_reconciliation_audit_time",
    )
    ensure_index(
        ipqc_audit_collection,
        [("date", ASCENDING), ("shift", ASCENDING), ("workflowState", ASCENDING)],
        name="ipqc_peel_reconciliation_candidates",
    )


def _unit(value: Any) -> str:
    return str(value or "").strip().upper().replace("UNIT-", "").replace("UNIT ", "")


def _shift(value: Any) -> str:
    return str(value or "").strip().upper().replace("SHIFT", "").replace("-", "").strip()


def _date(value: Any) -> str:
    return str(value or "").split("T")[0].strip()


def _numeric(value: Any) -> Optional[float]:
    try:
        return None if value in (None, "") else float(value)
    except (TypeError, ValueError):
        return None


def _integer(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _position_values(record: Dict[str, Any], side: str, position: int) -> list[float]:
    values = []
    samples = record.get("sample_results")
    if isinstance(samples, list):
        for sample in samples:
            if not isinstance(sample, dict) or str(sample.get("side", "")).lower() != side.lower():
                continue
            try:
                if int(sample.get("bus_pad_position")) != position:
                    continue
            except (TypeError, ValueError):
                continue
            value = _numeric(sample.get("value"))
            if value is not None:
                values.append(value)
    if values:
        return values
    for ribbon in range(1, RIBBON_COUNT + 1):
        value = _numeric(record.get(f"{side}_{position}_{ribbon}"))
        if value is not None:
            values.append(value)
    return values


def build_source_side(records: Iterable[Dict[str, Any]], side: str) -> tuple[Dict[str, str], list[str]]:
    """Merge duplicates newest-first; each position comes from the newest real value."""
    values: Dict[str, str] = {}
    source_ids: list[str] = []
    ordered = sorted(records, key=lambda row: row.get("updated_at") or datetime.min, reverse=True)
    for record in ordered:
        record_used = False
        for position in range(1, SOURCE_FIELD_COUNT + 1):
            key = str(position)
            if key in values:
                continue
            measurements = _position_values(record, side, position)
            if measurements:
                values[key] = f"{sum(measurements) / len(measurements):.2f}"
                record_used = True
        if record_used:
            source_ids.append(str(record.get("_id", "")))
    return values, source_ids


def find_peel_observation(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for stage in data.get("stages", []):
        for parameter in stage.get("parameters", []):
            if parameter.get("id") == PARAMETER_ID:
                observations = parameter.get("observations") or []
                return observations[0] if observations and isinstance(observations[0], dict) else None
    return None


def _legacy_pending(side_values: Any) -> bool:
    if not isinstance(side_values, dict):
        return False
    return all(str(side_values.get(str(index), "")).strip().upper() == "OFF" for index in range(1, 21))


def reconcile_payload(
    data: Dict[str, Any],
    source_records: Iterable[Dict[str, Any]],
    *,
    source_record_id: str | None = None,
    migrate_legacy: bool = False,
    now: Optional[datetime] = None,
) -> list[Dict[str, Any]]:
    """Mutate only explicitly pending sides and return their audit events."""
    observation = find_peel_observation(data)
    if not observation or not isinstance(observation.get("value"), dict):
        return []
    now = now or utc_now()
    records = list(source_records)
    events: list[Dict[str, Any]] = []
    for stringer_key, stringer_data in observation["value"].items():
        if not isinstance(stringer_data, dict):
            continue
        try:
            stringer_number = int(str(stringer_key).split("-")[-1])
        except ValueError:
            continue
        sync_map = stringer_data.setdefault("peelSync", {})
        for unit_key, side_key, source_side in SIDE_CONFIG:
            unit = _unit(stringer_data.get(unit_key))
            if not unit or unit == "OFF":
                continue
            metadata = sync_map.get(side_key) if isinstance(sync_map.get(side_key), dict) else {}
            state = metadata.get("state")
            if not state and migrate_legacy and _legacy_pending(stringer_data.get(side_key)):
                state = "pending_source_data"
                stringer_data[side_key] = {}
            if state != "pending_source_data":
                continue
            matching = [
                record for record in records
                if _integer(record.get("Stringer", record.get("stringer"))) == stringer_number
                and _unit(record.get("Unit", record.get("unit"))) == unit
            ]
            source_values, source_ids = build_source_side(matching, source_side)
            if not source_values:
                sync_map[side_key] = {**metadata, "state": "pending_source_data"}
                continue
            old_values = dict(stringer_data.get(side_key) or {})
            previous_auto_values = metadata.get("sourceValues") if isinstance(metadata.get("sourceValues"), dict) else {}
            next_values = dict(old_values)
            for key, value in source_values.items():
                current = str(next_values.get(key, "")).strip()
                if not current or current.upper() == "OFF" or current == str(previous_auto_values.get(key, "")):
                    next_values[key] = value
            for index in range(SOURCE_FIELD_COUNT + 1, AUDIT_FIELD_COUNT + 1):
                next_values[str(index)] = "OFF"
            complete = all(str(next_values.get(str(index), "")).strip() not in {"", "OFF"} for index in range(1, SOURCE_FIELD_COUNT + 1))
            new_state = "synced" if complete else "pending_source_data"
            new_metadata = {
                "state": new_state,
                "sourceRecordIds": source_ids,
                "sourceValues": source_values,
                "reconciledAt": now.isoformat(),
                "actor": SERVICE_ACTOR,
            }
            semantic_metadata = {key: value for key, value in metadata.items() if key != "reconciledAt"}
            semantic_new_metadata = {key: value for key, value in new_metadata.items() if key != "reconciledAt"}
            if next_values == old_values and semantic_metadata == semantic_new_metadata:
                continue
            stringer_data[side_key] = next_values
            sync_map[side_key] = new_metadata
            events.append({
                "stringer": stringer_key,
                "unit": unit,
                "side": side_key,
                "oldState": state,
                "newState": new_state,
                "oldValues": old_values,
                "newValues": next_values,
                "sourceRecordIds": source_ids,
            })
    return events


def _source_records(date: str, shift: str, source_record_id: str | None = None) -> list[Dict[str, Any]]:
    query: Dict[str, Any] = {"date": date, "shift": {"$regex": f"^{shift}$", "$options": "i"}}
    if source_record_id and ObjectId.is_valid(source_record_id):
        # Include duplicates for the same authoritative date/shift so newest values can win.
        trigger = peel_data_collection.find_one({"_id": ObjectId(source_record_id)}, {"date": 1, "shift": 1})
        if not trigger or _date(trigger.get("date")) != date or _shift(trigger.get("shift")) != shift:
            return []
    return list(peel_data_collection.find(query))


def reconcile_audit(audit: Dict[str, Any], *, source_record_id: str | None = None, migrate_legacy: bool = False) -> Dict[str, int]:
    audit_id = audit["_id"]
    now = utc_now()
    lease_token = hashlib.sha256(f"{audit_id}:{now.isoformat()}".encode()).hexdigest()
    leased = ipqc_audit_collection.find_one_and_update(
        {
            "_id": audit_id,
            "$or": [
                {"peelReconciliationLease.expiresAt": {"$lt": now}},
                {"peelReconciliationLease": {"$exists": False}},
            ],
        },
        {"$set": {"peelReconciliationLease": {"token": lease_token, "expiresAt": now + timedelta(seconds=LEASE_SECONDS)}}},
        return_document=ReturnDocument.AFTER,
    )
    if not leased:
        return {"updated": 0, "busy": 1}
    try:
        report = IPQCAudit.from_dict(leased)
        data = report.get_data()
        date = _date(data.get("date") or leased.get("date"))
        shift = _shift(data.get("shift") or leased.get("shift"))
        records = _source_records(date, shift, source_record_id)
        events = reconcile_payload(data, records, source_record_id=source_record_id, migrate_legacy=migrate_legacy, now=now)
        if not events:
            return {"updated": 0, "busy": 0}
        fingerprint = hashlib.sha256(json.dumps(events, sort_keys=True, default=str).encode()).hexdigest()
        if peel_reconciliation_audit_collection.find_one({"eventKey": f"{audit_id}:{fingerprint}"}):
            return {"updated": 0, "busy": 0}
        if not report.save_data(data):
            raise RuntimeError(f"Unable to persist reconciled audit {audit_id}")
        completion = calculate_ipqc_completion(data)
        event_doc = {
            "eventKey": f"{audit_id}:{fingerprint}",
            "auditId": str(audit_id),
            "auditName": leased.get("name"),
            "workflowState": leased.get("workflowState", leased.get("status")),
            "actor": SERVICE_ACTOR,
            "reconciledAt": now,
            "changes": events,
        }
        peel_reconciliation_audit_collection.update_one({"eventKey": event_doc["eventKey"]}, {"$setOnInsert": event_doc}, upsert=True)
        ipqc_audit_collection.update_one(
            {"_id": audit_id, "peelReconciliationLease.token": lease_token},
            {"$set": {**completion, "peelLastReconciledAt": now, "peelLastReconciliationEvent": event_doc["eventKey"], "reportCacheInvalidatedAt": now}},
        )
        return {"updated": 1, "busy": 0}
    finally:
        ipqc_audit_collection.update_one({"_id": audit_id, "peelReconciliationLease.token": lease_token}, {"$unset": {"peelReconciliationLease": ""}})


def reconcile_pending_audits(*, source_record_id: str | None = None, migrate_legacy: bool = False, limit: int = 500) -> Dict[str, int]:
    ensure_reconciliation_indexes()
    query: Dict[str, Any] = {"workflowState": {"$in": ["draft", "submitted"]}}
    if source_record_id and ObjectId.is_valid(source_record_id):
        source = peel_data_collection.find_one({"_id": ObjectId(source_record_id)})
        if not source:
            return {"scanned": 0, "updated": 0, "busy": 0, "errors": 0}
        query.update({"date": _date(source.get("date")), "shift": _shift(source.get("shift"))})
    summary = {"scanned": 0, "updated": 0, "busy": 0, "errors": 0}
    for audit in ipqc_audit_collection.find(query).sort("updated_timestamp", ASCENDING).limit(limit):
        summary["scanned"] += 1
        try:
            result = reconcile_audit(audit, source_record_id=source_record_id, migrate_legacy=migrate_legacy)
            summary["updated"] += result["updated"]
            summary["busy"] += result["busy"]
        except Exception:
            summary["errors"] += 1
            logger.exception("peel_audit_reconciliation_failed audit_id=%s", audit.get("_id"))
    return summary


def reconciliation_enabled() -> bool:
    return os.getenv("PEEL_AUDIT_RECONCILIATION_ENABLED", "true").lower() not in {"0", "false", "no"}
