from pymongo import ASCENDING, DESCENDING, MongoClient
from typing import Optional, Dict, Any
from urllib.parse import unquote, urlparse
from constants import MONGODB_URI, MONGODB_DB_NAME
from s3_service import S3Service

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
ipqc_audit_collection = db["ipqc_audits"]

def ensure_ipqc_audit_indexes() -> None:
    try:
        ipqc_audit_collection.create_index([("timestamp", DESCENDING)], name="ipqc_timestamp_desc_idx")
        ipqc_audit_collection.create_index([("updated_timestamp", DESCENDING)], name="ipqc_updated_timestamp_desc_idx")
        ipqc_audit_collection.create_index([("name", ASCENDING)], name="ipqc_name_idx")
        ipqc_audit_collection.create_index(
            [("lineNumber", ASCENDING), ("date", ASCENDING), ("shift", ASCENDING)],
            name="ipqc_line_date_shift_idx"
        )
        ipqc_audit_collection.create_index([("status", ASCENDING)], name="ipqc_status_idx")
        ipqc_audit_collection.create_index([("createdBy", ASCENDING)], name="ipqc_created_by_idx")
        ipqc_audit_collection.create_index([("workflowState", ASCENDING)], name="ipqc_workflow_state_idx")
        ipqc_audit_collection.create_index([("createdByEmployeeId", ASCENDING)], name="ipqc_created_by_employee_id_idx")
    except Exception as exc:
        print(f"Warning: failed to ensure IPQC audit indexes: {exc}")

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

SAFETY_MODULE_FIELDS = ("moduleId4Hours", "moduleId8Hours")
LINE_OPTIONS_BY_STAGE = {
    7: {"I": ("Line-1", "Line-2", "Line-3"), "II": ("Line-4", "Line-5")},
    8: {"I": ("Line-1", "Line-2"), "II": ("Line-3", "Line-4")},
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
                observation["value"] = apply_default_observation_value(stage_id, param_id, observation.get("value"), line_number)
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
                    for field in SAFETY_MODULE_FIELDS:
                        value.setdefault(field, "")
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
            print(f"Error retrieving IPQC audit data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return {}

    def save_data(self, data: Dict[str, Any]) -> bool:
        try:
            return self.s3_service.uploadOrOverwriteJson(self.s3_key, normalize_ipqc_audit_data(data))
        except Exception as e:
            print(f"Error saving IPQC audit data to S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def delete_data(self) -> bool:
        try:
            self.s3_service.delete_json(self.s3_key)
            return True
        except Exception as e:
            print(f"Error deleting IPQC audit data from S3 (key: {self.s3_key}): {str(e)}")
            import traceback
            traceback.print_exc()
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
