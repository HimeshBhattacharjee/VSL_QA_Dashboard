from .line_i import LineIStringerParameterMapper
from .line_ii import LineIIStringerParameterMapper


STRINGER_PARAMETER_MAPPERS = {
    "I": LineIStringerParameterMapper,
    "II": LineIIStringerParameterMapper,
}

COMMON_EXCEL_COLUMNS = {
    "date": "A",
    "shift": "B",
    "poNumber": "C",
    "moduleType": "D",
    "cellType": "E",
    "cellWp": "F",
    "machine": "G",
    "unit": "H",
}


def get_stringer_parameter_mapper(line: str):
    normalized_line = "II" if str(line).strip().upper().replace("LINE-", "") == "II" else "I"
    return STRINGER_PARAMETER_MAPPERS[normalized_line]
