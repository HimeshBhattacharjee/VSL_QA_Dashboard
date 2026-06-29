from copy import deepcopy

from .LineIAuditMapping import FIELD_CONFIG as LINE_I_FIELD_CONFIG
from .LineIAuditMapping import TEMPLATE_FILENAME as LINE_I_TEMPLATE_FILENAME
from .LineIAuditMapping import get_observation_mapping as get_line_i_observation_mapping
from .LineIIAuditMapping import FIELD_CONFIG as LINE_II_FIELD_CONFIG
from .LineIIAuditMapping import TEMPLATE_FILENAME as LINE_II_TEMPLATE_FILENAME
from .LineIIAuditMapping import get_observation_mapping as get_line_ii_observation_mapping


def get_audit_template_filename(line_number: str) -> str:
    return LINE_I_TEMPLATE_FILENAME if line_number == "I" else LINE_II_TEMPLATE_FILENAME


def get_audit_field_config(line_number: str) -> dict:
    return deepcopy(LINE_I_FIELD_CONFIG if line_number == "I" else LINE_II_FIELD_CONFIG)


def get_audit_observation_mapping(line_number: str) -> dict:
    return get_line_i_observation_mapping() if line_number == "I" else get_line_ii_observation_mapping()
