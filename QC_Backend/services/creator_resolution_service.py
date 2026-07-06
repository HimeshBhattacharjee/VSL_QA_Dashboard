from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping


LEGACY_ENTRY_LABEL = "Legacy Entry"
OPERATOR_SIGNATURE_REQUIRED_MESSAGE = "Operator signature is required before submitting this report."

CREATOR_NAME_FIELDS = (
    "createdBy",
    "createdByEmployeeName",
    "created_by",
    "created_by_employee_name",
    "createdByEmployeeId",
    "created_by_employee_id",
)

CREATOR_SIGNATURE_FIELDS = (
    "preparedBy",
    "preparedBySignature",
    "preparedSignature",
    "auditBy",
    "auditSignature",
    "operatorSignature",
    "operator",
    "operatorName",
    "testedBy",
    "testedBySignature",
    "checkedBy",
    "checkedBySignature",
    "createdBySignature",
)

APPROVAL_SIGNATURE_FIELDS = (
    "verifiedBySignature",
    "reviewedBySignature",
    "approvedBySignature",
)

IGNORED_SIGNATURE_TOKENS = (
    "approved",
    "reviewed",
    "verified",
    "returned",
)


@dataclass(frozen=True)
class CreatorResolution:
    name: str
    user_id: str | None = None
    employee_id: str | None = None
    source: str = "legacy"

    @property
    def is_legacy(self) -> bool:
        return self.source == "legacy"


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value).strip()
    return ""


def is_legacy_label(value: str) -> bool:
    return normalize_text(value).lower() in {"legacy entry", "legacy report"}


def is_valid_signature_text(value: str) -> bool:
    text = normalize_text(value)
    if not text:
        return False
    if is_legacy_label(text):
        return False
    lowered = text.lower()
    if lowered.startswith(("http://", "https://", "data:image", "users/signatures/")):
        return False
    if "/users/signatures/" in lowered:
        return False
    return len(text) <= 160


def extract_signed_employee(value: Any) -> str:
    if isinstance(value, Mapping):
        for key in ("name", "employeeName", "employee_name", "text", "value", "signedBy", "signed_by"):
            candidate = extract_signed_employee(value.get(key))
            if candidate:
                return candidate
        return ""

    text = normalize_text(value)
    return text if is_valid_signature_text(text) else ""


def resolve_stored_creator(record: Mapping[str, Any] | None) -> CreatorResolution | None:
    if not isinstance(record, Mapping):
        return None

    for field in CREATOR_NAME_FIELDS:
        value = normalize_text(record.get(field))
        if value and not is_legacy_label(value):
            return CreatorResolution(
                name=value,
                user_id=normalize_text(record.get("createdByUserId")) or None,
                employee_id=normalize_text(record.get("createdByEmployeeId")) or None,
                source=field,
            )
    return None


def iter_signature_sources(record: Mapping[str, Any] | None, payloads: Iterable[Mapping[str, Any] | None] = ()) -> Iterable[Mapping[str, Any]]:
    if isinstance(record, Mapping):
        yield record
        for key in ("formData", "form_data", "data"):
            nested = record.get(key)
            if isinstance(nested, Mapping):
                yield nested

    for payload in payloads:
        if not isinstance(payload, Mapping):
            continue
        yield payload
        for key in ("formData", "form_data", "data"):
            nested = payload.get(key)
            if isinstance(nested, Mapping):
                yield nested


def resolve_creator_signature(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> CreatorResolution | None:
    for source in iter_signature_sources(record, payloads):
        for field in CREATOR_SIGNATURE_FIELDS:
            candidate = extract_signed_employee(source.get(field))
            if candidate:
                return CreatorResolution(name=candidate, source=f"signature.{field}")

        signatures = source.get("signatures")
        if isinstance(signatures, Mapping):
            for field in CREATOR_SIGNATURE_FIELDS:
                candidate = extract_signed_employee(signatures.get(field))
                if candidate:
                    return CreatorResolution(name=candidate, source=f"signatures.{field}")

            for key, value in signatures.items():
                lowered_key = str(key).lower()
                if any(token in lowered_key for token in IGNORED_SIGNATURE_TOKENS):
                    continue
                if "signature" not in lowered_key and "by" not in lowered_key:
                    continue
                candidate = extract_signed_employee(value)
                if candidate:
                    return CreatorResolution(name=candidate, source=f"signatures.{key}")

    return None


def resolve_creator(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> CreatorResolution:
    stored_creator = resolve_stored_creator(record)
    if stored_creator:
        return stored_creator

    signature_creator = resolve_creator_signature(record, payloads)
    if signature_creator:
        return signature_creator

    return CreatorResolution(name=LEGACY_ENTRY_LABEL)


def get_created_by_label(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> str:
    return resolve_creator(record, payloads).name


def is_creator_match(
    record: Mapping[str, Any] | None,
    user: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> bool:
    if not isinstance(record, Mapping) or not isinstance(user, Mapping):
        return False

    creator = resolve_creator(record, payloads)
    employee_id = normalize_text(user.get("employeeId"))
    user_id = normalize_text(user.get("id"))
    user_name = normalize_text(user.get("name"))

    if creator.employee_id and employee_id and creator.employee_id == employee_id:
        return True
    if creator.user_id and user_id and creator.user_id == user_id:
        return True
    return bool(creator.name and user_name and creator.name == user_name)


def build_lock_owner_metadata(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
    fallback_name: str = "Operator",
) -> dict[str, str | None]:
    creator = resolve_creator(record, payloads)
    return {
        "lockedBy": fallback_name if creator.is_legacy else creator.name or fallback_name,
        "lockedByUserId": creator.user_id,
        "lockedByEmployeeId": creator.employee_id,
    }


def has_operator_signature(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> bool:
    return resolve_creator_signature(record, payloads) is not None


def require_operator_signature(
    record: Mapping[str, Any] | None,
    payloads: Iterable[Mapping[str, Any] | None] = (),
) -> None:
    from fastapi import HTTPException, status

    if not has_operator_signature(record, payloads):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=OPERATOR_SIGNATURE_REQUIRED_MESSAGE,
        )


def apply_approval_signature_to_form_data(form_data: dict[str, Any], approver_name: str) -> None:
    for field in APPROVAL_SIGNATURE_FIELDS:
        if field in form_data:
            form_data[field] = approver_name
            return
    form_data["verifiedBySignature"] = approver_name


def apply_approval_signature_to_signatures(
    data: dict[str, Any],
    approver_name: str,
    *,
    text_field: str = "reviewedBy",
    image_field: str | None = None,
    signature_image: str | None = None,
) -> None:
    signatures = data.get("signatures")
    if not isinstance(signatures, dict):
        signatures = {}
    signatures[text_field] = approver_name
    if image_field is not None:
        signatures[image_field] = signature_image or signatures.get(image_field, "")
    data["signatures"] = signatures
