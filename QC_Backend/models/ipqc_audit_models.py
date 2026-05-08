from pymongo import MongoClient
from typing import Optional, Dict, Any
from constants import MONGODB_URI, MONGODB_DB_NAME
from s3_service import S3Service

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
ipqc_audit_collection = db["ipqc_audits"]

DYNAMIC_LINE_PARAMETER_IDS = {
    "2-4", "2-5", "2-6",
    "3-7", "3-8", "3-9",
    "9-6", "9-7", "9-8",
    "10-4", "10-5", "10-6",
    "11-3", "11-4", "11-5",
    "12-1", "12-2", "16-1", "23-1", "27-1", "29-1",
}

SAMPLE_GROUP_KEYS = ("2h", "4h", "6h", "8h")
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
                if isinstance(time_slot, str) and time_slot.startswith("Line-") and "lineMapping" not in observation:
                    selected_line = observation.get("selectedLine", time_slot.replace("Line-", ""))
                    observation["lineMapping"] = {group_key: selected_line for group_key in SAMPLE_GROUP_KEYS}
    return data

def normalize_ipqc_audit_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill IPQC-only field additions without changing historical payloads."""
    normalize_dynamic_line_selections(data)
    line_number = data.get("lineNumber", "II")
    for stage in data.get("stages", []):
        stage_id = stage.get("id")
        for parameter in stage.get("parameters", []):
            param_id = parameter.get("id")
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
