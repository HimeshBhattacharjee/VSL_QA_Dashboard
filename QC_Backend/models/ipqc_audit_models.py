import logging
from pymongo import ASCENDING, DESCENDING, MongoClient
from typing import Optional, Dict, Any, Iterable
from urllib.parse import unquote, urlparse
from constants import MONGODB_URI, MONGODB_DB_NAME
from mongo_indexes import ensure_index
from s3_service import S3Service

logger = logging.getLogger(__name__)

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
ipqc_audit_collection = db["ipqc_audits"]

def ensure_ipqc_audit_indexes() -> None:
    try:
        ensure_index(ipqc_audit_collection, [("timestamp", DESCENDING)], name="ipqc_timestamp_desc_idx")
        ensure_index(ipqc_audit_collection, [("updated_timestamp", DESCENDING)], name="ipqc_updated_timestamp_desc_idx")
        ensure_index(ipqc_audit_collection, [("name", ASCENDING)], name="ipqc_name_idx")
        ensure_index(
            ipqc_audit_collection,
            [("lineNumber", ASCENDING), ("date", ASCENDING), ("shift", ASCENDING)],
            name="ipqc_line_date_shift_idx"
        )
        ensure_index(ipqc_audit_collection, [("status", ASCENDING)], name="ipqc_status_idx")
        ensure_index(ipqc_audit_collection, [("createdBy", ASCENDING)], name="ipqc_created_by_idx")
        ensure_index(ipqc_audit_collection, [("workflowState", ASCENDING)], name="ipqc_workflow_state_idx")
        ensure_index(ipqc_audit_collection, [("createdByEmployeeId", ASCENDING)], name="ipqc_created_by_employee_id_idx")
        ensure_index(ipqc_audit_collection, [("date", DESCENDING)], name="ipqc_date_desc_idx")
        ensure_index(ipqc_audit_collection, [("completionPercentage", DESCENDING)], name="ipqc_completion_percentage_desc_idx")
        ensure_index(ipqc_audit_collection, [("lockTimestamp", DESCENDING)], name="ipqc_lock_timestamp_desc_idx")
    except Exception as exc:
        logger.warning("failed_to_ensure_ipqc_audit_indexes error=%s", exc, exc_info=True)

ensure_ipqc_audit_indexes()

DYNAMIC_LINE_PARAMETER_IDS = {
    "2-4", "2-5", "2-6",
    "3-7", "3-8", "3-9",
    "9-6", "9-7", "9-8",
    "10-4", "10-5", "10-6",
    "11-3", "11-4", "11-5",
    "12-1", "12-2", "16-1", "23-1", "27-1", "29-1",
}

SAMPLE_GROUP_KEYS = ("2h", "4h", "6h", "8h")
SIGNATURE_S3_PREFIX = "users/signatures/"
SIGNATURE_IMAGE_KEYS = ("auditByImage", "reviewedByImage")
GROUPED_SAMPLE_PARAMETER_IDS = {"12-1", "12-2", "16-1", "23-1", "27-1", "29-1"}
SAMPLE_GROUP_DEFINITIONS = (
    {"groupKey": "2h", "groupLabel": "2 Hours", "order": 1, "sampleNumbers": (1, 2, 3, 4, 5)},
    {"groupKey": "4h", "groupLabel": "4 Hours", "order": 2, "sampleNumbers": (6, 7, 8, 9, 10)},
    {"groupKey": "6h", "groupLabel": "6 Hours", "order": 3, "sampleNumbers": (11, 12, 13, 14, 15)},
    {"groupKey": "8h", "groupLabel": "8 Hours", "order": 4, "sampleNumbers": (16, 17, 18, 19, 20)},
)
AUTO_BUSSING_SPLIT_FIELD_MAP = {
    "Width": "Width Top & Bottom",
    "Thickness": "Thickness Top & Bottom",
    "Expiry Date": "Expiry Date Top & Bottom",
}

SAFETY_MODULE_FIELDS = (
    "lineA_4hr_moduleId",
    "lineA_8hr_moduleId",
    "lineB_4hr_moduleId",
    "lineB_8hr_moduleId",
)
LEGACY_SAFETY_MODULE_FIELDS = {
    "4hr": "moduleId4Hours",
    "8hr": "moduleId8Hours",
}
AUTO_TAPING_LEGACY_LINE_BY_INTERNAL = {
    "line1_auto_taping_1": "Line-1",
    "line1_auto_taping_2": "Line-2",
    "line1_auto_taping_3": "Line-3",
    "line2_auto_taping_3": "Line-3",
    "line2_auto_taping_4": "Line-4",
}
AUTO_TAPING_FIELDS = ("4hrs", "8hrs", "Supplier", "Type", "Quantity")
LINE_OPTIONS_BY_STAGE = {
    7: {"I": ("Line-1", "Line-2", "Line-3"), "II": ("Line-4", "Line-5")},
    8: {
        "I": ("line1_auto_taping_1", "line1_auto_taping_2", "line1_auto_taping_3"),
        "II": ("line2_auto_taping_3", "line2_auto_taping_4"),
    },
    15: {"I": ("Auto trimming - 1", "Auto trimming - 2"), "II": ("Auto trimming - 3", "Auto trimming - 4")},
    17: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    18: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    19: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    20: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    21: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    22: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    24: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
    26: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
}
SIMPLE_DEFAULTS = {
    "1-3": "Checked OK",
    "2-3": "Checked OK",
    "3-4": "New Box Open",
    "4-2": "New Box Open",
    "4-3": "Stacked two box of cells",
    "4-4": "Checked OK",
    "5-2": "Checked OK",
    "6-1": "Checked OK",
    "13-1": "Checked OK",
    "13-2": "Checked OK",
    "13-4": "Checked OK",
    "25-1": "Checked OK",
    "25-2": "Checked OK",
    "25-3": "Checked OK",
    "28-1": "Checked OK",
    "29-2": "Checked OK",
    "30-1": "Checked OK",
    "30-2": "Checked OK",
}
SAMPLE_KEY_DEFAULTS = {
    "2-2": "Checked OK",
    "3-6": "Checked OK",
    "9-5": "Checked OK",
    "11-2": "Checked OK",
}
LINE_KEY_DEFAULTS = {
    "7-5": "Checked OK",
    "8-1": "Checked OK",
    "8-2": "Outside RFID",
    "8-3": "Checked OK",
    "8-4": "Checked OK",
    "8-5": "Checked OK",
    "15-1": "Checked OK",
    "15-2": "Checked OK",
    "17-3": "Both side of length",
    "20-2": "Checked OK",
    "20-4": "Checked OK",
    "21-5": "Checked OK",
    "22-1": "Checked OK",
    "22-2": "Checked OK",
    "24-2": "Checked OK",
    "24-3": "Checked OK",
    "24-8": "Checked OK",
    "24-9": "Checked OK",
    "26-1": "Pass",
    "26-2": "Pass",
    "26-3": "Pass",
}
LINE_SAMPLE_TIME_DEFAULTS = {
    "17-4": "Checked OK",
    "18-4": "Checked OK",
}
TIME_SLOT_DEFAULTS = {
    "31-2": "Checked OK",
    "31-3": "Checked OK",
    "31-4": "Checked OK",
    "31-5": "Checked OK",
    "31-6": "Checked OK",
    "31-7": "Checked OK",
    "31-8": "Vertically",
    "31-10": "Checked OK",
    "31-11": "Checked OK",
    "31-12": "Checked OK",
    "31-13": "Checked OK",
}
TIME_KEYS = ("4hrs", "8hrs")
TIME_KEYS_BY_PARAM = {
    "20-2": ("2hrs", "4hrs", "6hrs", "8hrs"),
    "20-4": ("2hrs", "4hrs", "6hrs", "8hrs"),
    "21-5": ("2hrs", "4hrs", "6hrs", "8hrs"),
    "22-1": ("2hrs", "4hrs", "6hrs", "8hrs"),
}
STRINGER_UNIT_KEYS = ("unitA", "unitB")
LINE_I_MACHINE_TEMP_FIELDS = (
    "Flux Temp",
    "Preheat base-1",
    "Preheat base-2",
    "Solder base-1",
    "Solder base-2",
    "Holding base-1",
    "Combined Plates",
    "Holding base-2",
    "Holding base-3",
    "Drying base-1",
    "Drying base-2",
    "Drying base-3",
    "Drying base-4",
    "Drying base-5",
)
LINE_I_LIGHT_INTENSITY_FIELDS = (
    "Solder Time ms",
    "Solder Temp ˚C",
    "#1",
    "#2",
    "#3",
    "#4",
    "#5",
    "#6",
    "#7",
    "#8",
    "#9",
    "#10",
    "#11",
    "#12",
    "#13",
    "#14",
    "#15",
    "#16",
    "#17",
    "#18",
    "#19",
    "#20",
)
LINE_I_STRINGER_SETUP_FIELDS_BY_PARAM = {
    "5-9-machine-temp-setup": LINE_I_MACHINE_TEMP_FIELDS,
    "5-10-light-intensity-time": LINE_I_LIGHT_INTENSITY_FIELDS,
}
LINE_I_AUTO_BUSSING_SOLDERING_TIME_FIELDS = tuple(
    f"{position}_tca_{tca_number}"
    for tca_number in range(1, 7)
    for position in ("front", "middle", "back")
)
LEGACY_LINE_I_AUTO_BUSSING_SOLDERING_TIME_FALLBACKS = {
    "front_tca_1": "Front TCA 1 L",
    "middle_tca_1": "Middle TCA 1 L",
    "back_tca_1": "Back TCA 1 L",
    "front_tca_2": "Front TCA 1 R",
    "middle_tca_2": "Middle TCA 1 R",
    "back_tca_2": "Back TCA 1 R",
}
AUTO_BUSSING_PATCH_SAMPLE_KEYS = ("sample_1", "sample_2")
AUTO_BUSSING_PATCH_MEASUREMENT_FIELDS = ("length", "height", "width")
IPQC_TOTAL_STAGE_COUNT = 31
COMPLETION_METADATA_KEYS = {
    "schemaVersion",
    "parameterId",
    "sampleGroup",
    "sampleNumber",
    "sampleLabel",
    "groupKey",
    "groupLabel",
    "order",
    "selectedLine",
}
DEFAULT_COMPLETED_PARAMETER_IDS = {
    "2-2",
    "3-6",
    "5-2",
    "7-5",
    "8-1",
    "8-2",
    "8-3",
    "8-4",
    "8-5",
    "9-5",
    "10-4",
    "10-5",
    "10-6",
    "11-2",
    "15-1",
    "15-2",
    "17-3",
    "17-4",
    "18-4",
    "19-1",
    "20-2",
    "20-4",
    "21-5",
    "22-1",
    "22-2",
    "24-2",
    "24-3",
    "24-8",
    "24-9",
    "25-1",
    "25-2",
    "25-3",
    "26-2",
    "26-3",
    "28-1",
    "29-2",
    "30-1",
    "30-2",
    "31-2",
    "31-3",
    "31-4",
    "31-5",
    "31-6",
    "31-7",
    "31-8",
    "31-10",
    "31-11",
    "31-12",
    "31-13",
}
AUDIT_COMPLETION_METADATA = {
    **{parameter_id: {"treat_empty_as_complete": True} for parameter_id in DEFAULT_COMPLETED_PARAMETER_IDS},
    "18-1": {"system_key_suffixes": ("-type",)},
    "20-3": {"system_key_suffixes": ("-Ratio",)},
    "26-1": {"system_key_suffixes": ("-4hrs", "-8hrs")},
}

def is_empty_value(value: Any) -> bool:
    return value is None or value == ""

def get_line_options(stage_id: int, line_number: str):
    return LINE_OPTIONS_BY_STAGE.get(stage_id, {}).get(line_number, ())

def normalize_line_value(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    return text.replace("Line-", "")

def normalize_signature_image_reference(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    source = value.strip()
    if not source:
        return ""

    if source.startswith(SIGNATURE_S3_PREFIX):
        return source

    if source.startswith(("http://", "https://")):
        parsed = urlparse(source)
        path_key = unquote(parsed.path.lstrip("/"))
        marker_index = path_key.find(SIGNATURE_S3_PREFIX)
        if marker_index >= 0:
            return path_key[marker_index:]

    return source

def normalize_signature_images(data: Dict[str, Any]) -> Dict[str, Any]:
    signatures = data.get("signatures")
    if isinstance(signatures, dict):
        for image_key in SIGNATURE_IMAGE_KEYS:
            if image_key in signatures:
                signatures[image_key] = normalize_signature_image_reference(signatures.get(image_key))

    for image_key in SIGNATURE_IMAGE_KEYS:
        if image_key in data:
            data[image_key] = normalize_signature_image_reference(data.get(image_key))

    nested_data = data.get("data")
    if isinstance(nested_data, dict):
        normalize_signature_images(nested_data)

    return data

def build_ipqc_audit_metadata(data: Dict[str, Any]) -> Dict[str, Any]:
    signatures = data.get("signatures") if isinstance(data.get("signatures"), dict) else {}
    created_by = data.get("createdBy") or data.get("created_by") or signatures.get("auditBy", "")

    return {
        "lineNumber": data.get("lineNumber", ""),
        "date": data.get("date", ""),
        "shift": data.get("shift", ""),
        "productionOrderNo": data.get("productionOrderNo", ""),
        "moduleType": data.get("moduleType", ""),
        "status": data.get("status", "draft"),
        "createdBy": created_by,
    }

def create_empty_completion_counts() -> Dict[str, int]:
    return {
        "userFilled": 0,
        "userTotal": 0,
        "systemFilled": 0,
        "systemTotal": 0,
    }

def add_completion_counts(left: Dict[str, int], right: Dict[str, int]) -> Dict[str, int]:
    return {
        "userFilled": left["userFilled"] + right["userFilled"],
        "userTotal": left["userTotal"] + right["userTotal"],
        "systemFilled": left["systemFilled"] + right["systemFilled"],
        "systemTotal": left["systemTotal"] + right["systemTotal"],
    }

def is_empty_completion_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value != value
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False

def has_filled_completion_value(value: Any) -> bool:
    return not is_empty_completion_value(value)

def get_parameter_system_defaults(parameter_id: str) -> set[str]:
    defaults = set()
    for mapping in (
        SIMPLE_DEFAULTS,
        SAMPLE_KEY_DEFAULTS,
        LINE_KEY_DEFAULTS,
        LINE_SAMPLE_TIME_DEFAULTS,
        TIME_SLOT_DEFAULTS,
    ):
        default_value = mapping.get(parameter_id)
        if isinstance(default_value, str) and default_value:
            defaults.add(default_value)
    return defaults

def is_parameter_default_completion_value(parameter_id: str, value: Any) -> bool:
    return isinstance(value, str) and value in get_parameter_system_defaults(parameter_id)

def is_completion_system_path(path: list[str], metadata: Dict[str, Any] | None) -> bool:
    if not metadata:
        return False

    leaf_key = path[-1] if path else ""
    system_key_names = metadata.get("system_key_names") or ()
    system_key_suffixes = metadata.get("system_key_suffixes") or ()
    return bool(
        metadata.get("treat_empty_as_complete")
        or leaf_key in system_key_names
        or any(leaf_key.endswith(suffix) for suffix in system_key_suffixes)
    )

def get_completion_field_counts(
    parameter_id: str,
    value: Any,
    metadata: Dict[str, Any] | None,
    path: list[str],
) -> Dict[str, int]:
    is_system_field = (
        is_completion_system_path(path, metadata)
        or is_parameter_default_completion_value(parameter_id, value)
    )
    is_filled = has_filled_completion_value(value) or is_system_field

    if is_system_field:
        return {
            "userFilled": 0,
            "userTotal": 0,
            "systemFilled": 1 if is_filled else 0,
            "systemTotal": 1,
        }

    return {
        "userFilled": 1 if is_filled else 0,
        "userTotal": 1,
        "systemFilled": 0,
        "systemTotal": 0,
    }

def get_section_off_completion_counts(
    parameter_id: str,
    section_value: Dict[str, Any],
    recipe_key: str,
    metadata: Dict[str, Any] | None,
    path: list[str],
) -> Dict[str, int]:
    return get_observation_completion_counts(
        parameter_id,
        section_value.get(recipe_key),
        metadata,
        [*path, recipe_key],
    )

def get_observation_completion_counts(
    parameter_id: str,
    value: Any,
    metadata: Dict[str, Any] | None = None,
    path: list[str] | None = None,
) -> Dict[str, int]:
    current_path = path or []

    if isinstance(value, str):
        return get_completion_field_counts(parameter_id, value, metadata, current_path)

    if isinstance(value, list):
        if not value:
            return get_completion_field_counts(parameter_id, value, metadata, current_path)

        counts = create_empty_completion_counts()
        for index, item in enumerate(value):
            counts = add_completion_counts(
                counts,
                get_observation_completion_counts(parameter_id, item, metadata, [*current_path, str(index)]),
            )
        return counts

    if isinstance(value, dict):
        entries = [key for key in value.keys() if key not in COMPLETION_METADATA_KEYS]
        if not entries:
            return get_completion_field_counts(parameter_id, value, metadata, current_path)

        counts = create_empty_completion_counts()
        for key in entries:
            nested_value = value.get(key)
            if (
                key == "upper"
                and isinstance(nested_value, dict)
                and str(nested_value.get("selectedRecipeUpper", "")).upper() == "OFF"
            ):
                nested_counts = get_section_off_completion_counts(
                    parameter_id,
                    nested_value,
                    "selectedRecipeUpper",
                    metadata,
                    [*current_path, key],
                )
            elif (
                key == "lower"
                and isinstance(nested_value, dict)
                and str(nested_value.get("selectedRecipeLower", "")).upper() == "OFF"
            ):
                nested_counts = get_section_off_completion_counts(
                    parameter_id,
                    nested_value,
                    "selectedRecipeLower",
                    metadata,
                    [*current_path, key],
                )
            else:
                nested_counts = get_observation_completion_counts(
                    parameter_id,
                    nested_value,
                    metadata,
                    [*current_path, key],
                )
            counts = add_completion_counts(counts, nested_counts)
        return counts

    return get_completion_field_counts(parameter_id, value, metadata, current_path)

def get_stage_completion_status(stage: Dict[str, Any]) -> str:
    counts = create_empty_completion_counts()
    for parameter in stage.get("parameters", []):
        if not isinstance(parameter, dict):
            continue
        parameter_id = str(parameter.get("id", ""))
        metadata = AUDIT_COMPLETION_METADATA.get(parameter_id)
        for observation in parameter.get("observations", []):
            if not isinstance(observation, dict):
                continue
            counts = add_completion_counts(
                counts,
                get_observation_completion_counts(parameter_id, observation.get("value"), metadata),
            )

    if counts["userTotal"] == 0:
        return "completed" if counts["systemTotal"] > 0 and counts["systemFilled"] == counts["systemTotal"] else "not_started"

    if counts["userFilled"] == 0:
        return "not_started"
    if counts["userFilled"] == counts["userTotal"] and counts["systemFilled"] == counts["systemTotal"]:
        return "completed"
    return "in_progress"

def calculate_ipqc_completion(data: Dict[str, Any]) -> Dict[str, int]:
    stages = data.get("stages") if isinstance(data.get("stages"), list) else []
    total_stages = len(stages) or IPQC_TOTAL_STAGE_COUNT
    completed_stages = sum(1 for stage in stages if isinstance(stage, dict) and get_stage_completion_status(stage) == "completed")
    completion_percentage = round((completed_stages / total_stages) * 100) if total_stages else 0

    return {
        "completedStages": completed_stages,
        "totalStages": total_stages,
        "completionPercentage": completion_percentage,
    }

def get_default_sample_group_line_mapping(line_number: str) -> Dict[str, str]:
    first_line, second_line = ("1", "2") if line_number == "I" else ("3", "4")
    return {"2h": first_line, "4h": first_line, "6h": second_line, "8h": second_line}

def is_sample_grouped_value(value: Any) -> bool:
    return isinstance(value, dict) and isinstance(value.get("sampleGroups"), list)

def get_sample_label(sample_number: int) -> str:
    return f"Sample-{sample_number}"

def read_sample_values(value: Any) -> Dict[str, str]:
    if is_sample_grouped_value(value):
        sample_values: Dict[str, str] = {}
        for group in value.get("sampleGroups", []):
            if not isinstance(group, dict):
                continue
            for sample in group.get("samples", []):
                if not isinstance(sample, dict):
                    continue
                sample_number = sample.get("sampleNumber")
                sample_label = sample.get("sampleLabel") or (get_sample_label(sample_number) if isinstance(sample_number, int) else "")
                if sample_label:
                    sample_values[sample_label] = "" if sample.get("value") is None else str(sample.get("value"))
        return sample_values

    if not isinstance(value, dict):
        return {}

    sample_values: Dict[str, str] = {}
    for group in SAMPLE_GROUP_DEFINITIONS:
        for sample_number in group["sampleNumbers"]:
            sample_label = get_sample_label(sample_number)
            sample_value = value.get(sample_label, "")
            sample_values[sample_label] = "" if sample_value is None else str(sample_value)
    return sample_values

def read_sample_group_line_mapping(value: Any) -> Dict[str, str]:
    if not is_sample_grouped_value(value):
        return {}

    line_mapping: Dict[str, str] = {}
    for group in value.get("sampleGroups", []):
        if not isinstance(group, dict):
            continue
        group_key = group.get("groupKey")
        selected_line = normalize_line_value(group.get("selectedLine"))
        if group_key in SAMPLE_GROUP_KEYS and selected_line:
            line_mapping[group_key] = selected_line
    return line_mapping

def normalize_sample_group_line_mapping(value: Any, observation: Dict[str, Any], line_number: str) -> Dict[str, str]:
    default_mapping = get_default_sample_group_line_mapping(line_number)
    canonical_mapping = read_sample_group_line_mapping(value)
    raw_mapping = observation.get("lineMapping") if isinstance(observation.get("lineMapping"), dict) else {}
    selected_line = normalize_line_value(observation.get("selectedLine") or observation.get("timeSlot"))

    if not is_sample_grouped_value(value):
        normalized_raw = {
            group_key: normalize_line_value(raw_mapping.get(group_key))
            for group_key in SAMPLE_GROUP_KEYS
            if raw_mapping.get(group_key)
        }
        if not normalized_raw or (selected_line and len(set(normalized_raw.values())) == 1 and next(iter(normalized_raw.values())) == selected_line):
            return default_mapping

    return {
        group_key: canonical_mapping.get(group_key)
        or normalize_line_value(raw_mapping.get(group_key))
        or default_mapping[group_key]
        for group_key in SAMPLE_GROUP_KEYS
    }

def create_sample_grouped_value(param_id: str, value: Any, line_mapping: Dict[str, str]) -> Dict[str, Any]:
    sample_values = read_sample_values(value)
    return {
        "schemaVersion": 1,
        "sampleGroups": [
            {
                "groupKey": group["groupKey"],
                "groupLabel": group["groupLabel"],
                "order": group["order"],
                "selectedLine": line_mapping.get(group["groupKey"], ""),
                "samples": [
                    {
                        "parameterId": param_id,
                        "sampleGroup": group["groupKey"],
                        "sampleNumber": sample_number,
                        "sampleLabel": get_sample_label(sample_number),
                        "value": sample_values.get(get_sample_label(sample_number), ""),
                    }
                    for sample_number in group["sampleNumbers"]
                ],
            }
            for group in SAMPLE_GROUP_DEFINITIONS
        ],
    }

def normalize_sample_grouped_observation(param_id: str, observation: Dict[str, Any], line_number: str) -> None:
    value = observation.get("value")
    line_mapping = normalize_sample_group_line_mapping(value, observation, line_number)
    observation["value"] = create_sample_grouped_value(param_id, value, line_mapping)
    observation["lineMapping"] = line_mapping
    observation["selectedLine"] = line_mapping.get("2h", observation.get("selectedLine", ""))

def collapse_sample_grouped_observations(param_id: str, observations: Any) -> Any:
    if not isinstance(observations, list) or len(observations) <= 1:
        return observations

    base_observation = dict(observations[0])
    line_mapping = base_observation.get("lineMapping") if isinstance(base_observation.get("lineMapping"), dict) else {}
    sample_values = read_sample_values(base_observation.get("value"))

    for observation in observations[1:]:
        for sample_label, sample_value in read_sample_values(observation.get("value") if isinstance(observation, dict) else {}).items():
            if sample_value and is_empty_value(sample_values.get(sample_label)):
                sample_values[sample_label] = sample_value

    base_observation["value"] = create_sample_grouped_value(param_id, sample_values, line_mapping)
    base_observation["lineMapping"] = line_mapping
    base_observation["selectedLine"] = line_mapping.get("2h", base_observation.get("selectedLine", ""))
    return [base_observation]

def apply_default_observation_value(stage_id: int, param_id: str, value: Any, line_number: str) -> Any:
    """Persist frontend-visible selector defaults only when the payload is empty."""
    if param_id in SIMPLE_DEFAULTS and is_empty_value(value):
        return SIMPLE_DEFAULTS[param_id]

    if param_id in SAMPLE_KEY_DEFAULTS:
        normalized_value = {} if not isinstance(value, dict) else dict(value)
        for sample_key in ("Sample-1", "Sample-2", "Sample-3", "Sample-4", "Sample-5", "Sample-6"):
            if is_empty_value(normalized_value.get(sample_key)):
                normalized_value[sample_key] = SAMPLE_KEY_DEFAULTS[param_id]
        return normalized_value

    if param_id in TIME_SLOT_DEFAULTS and is_empty_value(value):
        return TIME_SLOT_DEFAULTS[param_id]

    lines = get_line_options(stage_id, line_number)
    if param_id in LINE_SAMPLE_TIME_DEFAULTS:
        if not lines:
            return value
        normalized_value = {} if not isinstance(value, dict) else dict(value)
        for line in lines:
            for sample_key in ("Sample-1", "Sample-2", "Sample-3", "Sample-4", "Sample-5", "Sample-6"):
                for time_key in TIME_KEYS:
                    key = f"{line}-{sample_key}-{time_key}"
                    if is_empty_value(normalized_value.get(key)):
                        normalized_value[key] = LINE_SAMPLE_TIME_DEFAULTS[param_id]
        return normalized_value

    if param_id not in LINE_KEY_DEFAULTS:
        return value

    default_value = LINE_KEY_DEFAULTS[param_id]
    normalized_value = {} if not isinstance(value, dict) else dict(value)
    if not lines:
        return value

    if param_id in {"7-5", "15-2", "22-2", "24-2", "24-3", "24-8", "24-9"}:
        for line in lines:
            if is_empty_value(normalized_value.get(line)):
                normalized_value[line] = default_value
    else:
        for line in lines:
            for time_key in TIME_KEYS_BY_PARAM.get(param_id, TIME_KEYS):
                key = f"{line}-{time_key}"
                if is_empty_value(normalized_value.get(key)):
                    normalized_value[key] = default_value
    return normalized_value

def normalize_safety_module_ids(value: Dict[str, Any]) -> None:
    for field in SAFETY_MODULE_FIELDS:
        if field in value and value.get(field) is not None:
            continue
        legacy_key = LEGACY_SAFETY_MODULE_FIELDS["4hr" if "_4hr_" in field else "8hr"]
        value[field] = value.get(legacy_key, "") or ""

def prune_empty_keys(value: Dict[str, Any], keys: Iterable[str]) -> None:
    for key in keys:
        if is_empty_value(value.get(key)):
            value.pop(key, None)

def normalize_line_ii_machine_temp_value(value: Any, line_number: str) -> Any:
    if line_number == "I" or not isinstance(value, dict):
        return value

    normalized_value = dict(value)
    for stringer_key, stringer_value in list(normalized_value.items()):
        if not isinstance(stringer_value, dict):
            continue
        normalized_stringer = dict(stringer_value)
        for unit_key in STRINGER_UNIT_KEYS:
            unit_value = normalized_stringer.get(unit_key)
            if not isinstance(unit_value, dict):
                continue
            normalized_unit = dict(unit_value)
            # Legacy Line-II payloads stored this hidden field; it is not a required UI input.
            prune_empty_keys(normalized_unit, ("drying1",))
            normalized_stringer[unit_key] = normalized_unit
        normalized_value[stringer_key] = normalized_stringer
    return normalized_value

def normalize_auto_framing_dimension_value(value: Any, line_number: str) -> Any:
    if not isinstance(value, dict):
        return value

    normalized_value = dict(value)
    hidden_legacy_keys = (
        f"{line}-{dimension}"
        for line in get_line_options(17, line_number)
        for dimension in ("Length", "Width")
    )
    prune_empty_keys(normalized_value, hidden_legacy_keys)
    return normalized_value

def normalize_sun_simulator_contact_block_value(value: Any, line_number: str) -> Any:
    if not isinstance(value, dict):
        return value

    normalized_value = dict(value)
    hidden_legacy_keys = (
        f"{line}-{field}"
        for line in get_line_options(24, line_number)
        for field in ("contact-block", "positive", "negative")
    )
    prune_empty_keys(normalized_value, hidden_legacy_keys)
    return normalized_value

def normalize_line_i_stringer_setup_value(param_id: str, value: Any) -> Any:
    fields = LINE_I_STRINGER_SETUP_FIELDS_BY_PARAM.get(param_id)
    if not fields or not isinstance(value, dict):
        return value

    normalized_value = dict(value)
    for stringer_key, stringer_value in list(normalized_value.items()):
        if not isinstance(stringer_value, dict):
            continue

        normalized_stringer = dict(stringer_value)
        for unit_key in STRINGER_UNIT_KEYS:
            unit_value = normalized_stringer.get(unit_key)
            normalized_unit = dict(unit_value) if isinstance(unit_value, dict) else {}
            for field_name in fields:
                normalized_unit.setdefault(field_name, "")
            normalized_stringer[unit_key] = normalized_unit
        normalized_value[stringer_key] = normalized_stringer

    return normalized_value

def normalize_line_i_auto_bussing_soldering_time_value(value: Any, line_number: str) -> Any:
    line_options = get_line_options(7, line_number)
    if not line_options:
        return value

    source = dict(value) if isinstance(value, dict) else {}
    normalized_value = dict(source)
    for line in line_options:
        current_line_value = source.get(line)
        current_line_data = dict(current_line_value) if isinstance(current_line_value, dict) else {}
        normalized_line_data: Dict[str, str] = {}
        for field_name in LINE_I_AUTO_BUSSING_SOLDERING_TIME_FIELDS:
            legacy_field_name = LEGACY_LINE_I_AUTO_BUSSING_SOLDERING_TIME_FALLBACKS.get(field_name)
            legacy_value = source.get(f"{line}-{legacy_field_name}") if legacy_field_name else ""
            normalized_line_data[field_name] = current_line_data.get(field_name) or (legacy_value if isinstance(legacy_value, str) else "") or ""
        normalized_value[line] = normalized_line_data
    return normalized_value

def normalize_auto_bussing_patch_value(value: Any, line_number: str) -> Any:
    line_options = get_line_options(7, line_number)
    if not line_options:
        return value

    source = dict(value) if isinstance(value, dict) else {}
    normalized_value = dict(source)
    for line in line_options:
        current_line = source.get(line)
        current_line_data = dict(current_line) if isinstance(current_line, dict) else {}
        normalized_line_data = dict(current_line_data)
        for sample_key in AUTO_BUSSING_PATCH_SAMPLE_KEYS:
            current_sample = current_line_data.get(sample_key)
            normalized_sample = dict(current_sample) if isinstance(current_sample, dict) else {}
            for field_name in AUTO_BUSSING_PATCH_MEASUREMENT_FIELDS:
                normalized_sample.setdefault(field_name, "")
            normalized_line_data[sample_key] = normalized_sample
        normalized_value[line] = normalized_line_data
    return normalized_value

def normalize_auto_taping_value(value: Any, line_number: str) -> Any:
    line_options = get_line_options(8, line_number)
    if not line_options:
        return value

    source = dict(value) if isinstance(value, dict) else {}
    normalized_value = dict(source)
    for internal_line in line_options:
        legacy_line = AUTO_TAPING_LEGACY_LINE_BY_INTERNAL.get(internal_line, internal_line)
        for field_name in AUTO_TAPING_FIELDS:
            internal_key = f"{internal_line}-{field_name}"
            legacy_key = f"{legacy_line}-{field_name}"
            internal_value = normalized_value.get(internal_key)
            legacy_value = normalized_value.get(legacy_key)

            if not is_empty_value(legacy_value):
                normalized_value[internal_key] = legacy_value
                normalized_value[legacy_key] = legacy_value
            elif not is_empty_value(internal_value):
                normalized_value[legacy_key] = internal_value

    return normalized_value

def normalize_dynamic_line_selections(data: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill selectedLine and per-time lineMapping for older audits while preserving payload shape."""
    for stage in data.get("stages", []):
        for parameter in stage.get("parameters", []):
            if parameter.get("id") not in DYNAMIC_LINE_PARAMETER_IDS:
                continue
            for observation in parameter.get("observations", []):
                time_slot = observation.get("timeSlot", "")
                if "selectedLine" not in observation and isinstance(time_slot, str) and time_slot.startswith("Line-"):
                    observation["selectedLine"] = time_slot.replace("Line-", "")
                if parameter.get("id") in GROUPED_SAMPLE_PARAMETER_IDS:
                    continue
                if isinstance(time_slot, str) and time_slot.startswith("Line-") and "lineMapping" not in observation:
                    selected_line = observation.get("selectedLine", time_slot.replace("Line-", ""))
                    observation["lineMapping"] = {group_key: selected_line for group_key in SAMPLE_GROUP_KEYS}
    return data

def normalize_ipqc_audit_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill IPQC-only field additions without changing historical payloads."""
    normalize_signature_images(data)
    normalize_dynamic_line_selections(data)
    line_number = data.get("lineNumber", "II")
    for stage in data.get("stages", []):
        stage_id = stage.get("id")
        for parameter in stage.get("parameters", []):
            param_id = parameter.get("id")
            if param_id in GROUPED_SAMPLE_PARAMETER_IDS:
                for observation in parameter.get("observations", []):
                    observation["value"] = apply_default_observation_value(stage_id, param_id, observation.get("value"), line_number)
                    normalize_sample_grouped_observation(param_id, observation, line_number)
                parameter["observations"] = collapse_sample_grouped_observations(param_id, parameter.get("observations", []))
                continue

            for observation in parameter.get("observations", []):
                value = observation.get("value")
                if stage_id == 8:
                    value = normalize_auto_taping_value(value, line_number)
                observation["value"] = apply_default_observation_value(stage_id, param_id, value, line_number)
                if stage_id == 8:
                    observation["value"] = normalize_auto_taping_value(observation.get("value"), line_number)
                if line_number == "I" and param_id == "7-2":
                    observation["value"] = normalize_line_i_auto_bussing_soldering_time_value(observation.get("value"), line_number)
                if param_id == "7-10":
                    observation["value"] = normalize_auto_bussing_patch_value(observation.get("value"), line_number)
                if param_id == "5-9-machine-temp-setup":
                    observation["value"] = normalize_line_ii_machine_temp_value(observation.get("value"), line_number)
                if line_number == "I" and param_id in LINE_I_STRINGER_SETUP_FIELDS_BY_PARAM:
                    observation["value"] = normalize_line_i_stringer_setup_value(param_id, observation.get("value"))
                if param_id == "17-7":
                    observation["value"] = normalize_auto_framing_dimension_value(observation.get("value"), line_number)
                if param_id == "24-10":
                    observation["value"] = normalize_sun_simulator_contact_block_value(observation.get("value"), line_number)
                value = observation.get("value")
                if not isinstance(value, dict):
                    continue
                if param_id == "7-1":
                    for key, old_value in list(value.items()):
                        for old_label, new_label in AUTO_BUSSING_SPLIT_FIELD_MAP.items():
                            suffix = f"-{old_label}"
                            if key.endswith(suffix):
                                value.setdefault(f"{key[:-len(suffix)]}-{new_label}", old_value)
                elif param_id == "26-1":
                    normalize_safety_module_ids(value)
                    prune_empty_keys(value, LEGACY_SAFETY_MODULE_FIELDS.values())
    return data

class IPQCAudit:
    def __init__(self, name: str, timestamp: str, s3_key: str, _id: Optional[str] = None):
        self._id = _id
        self.name = name
        self.timestamp = timestamp
        self.s3_key = s3_key
        self.s3_service = S3Service()

    def get_data(self) -> Dict[str, Any]:
        try:
            return normalize_ipqc_audit_data(self.s3_service.download_json(self.s3_key))
        except Exception as e:
            logger.exception("ipqc_audit_s3_download_failed key=%s", self.s3_key)
            return {}

    def save_data(self, data: Dict[str, Any]) -> bool:
        try:
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, normalize_ipqc_audit_data(data))
        except Exception as e:
            logger.exception("ipqc_audit_s3_upload_failed key=%s", self.s3_key)
            return False

    def delete_data(self) -> bool:
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            logger.exception("ipqc_audit_s3_delete_failed key=%s", self.s3_key)
            return False

    def to_dict(self, include_data: bool = False) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "timestamp": self.timestamp,
            "s3_key": self.s3_key
        }
        if include_data:
            result["data"] = self.get_data()
        return result

    @staticmethod
    def create_from_data(name: str, timestamp: str, mongo_id: str, data: Dict[str, Any]) -> 'IPQCAudit':
        s3_service = S3Service()
        s3_key = s3_service.generate_fixed_s3_key('ipqc-audit', mongo_id)
        audit = IPQCAudit(name=name, timestamp=timestamp, s3_key=s3_key)
        success = s3_service.uploadOrOverwriteJson(s3_key, normalize_ipqc_audit_data(data))
        if not success:
            raise Exception("Failed to upload IPQC audit data to S3")
        return audit

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'IPQCAudit':
        return IPQCAudit(
            _id=str(data.get("_id")),
            name=data["name"],
            timestamp=data["timestamp"],
            s3_key=data["s3_key"]
        )
