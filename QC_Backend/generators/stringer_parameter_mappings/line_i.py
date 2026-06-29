class LineIStringerParameterMapper:
    line = "I"
    template_filename = "Blank Stringer Parameter Report Line-I.xlsx"
    machine_numbers = tuple(range(1, 7))
    audit_columns = (
        {"key": "preheatBasePlate", "label": "#1 Pre heat base plate", "excel": "I"},
        {"key": "solderBasePlate", "label": "Solder base plate", "excel": "J"},
        {"key": "holdingBase1", "label": "#1 Holding base plate", "excel": "K"},
        {"key": "combinedPlates", "label": "Combined Plates", "excel": "L"},
        {"key": "holdingBase2", "label": "#2 Holding base plate", "excel": "M"},
        {"key": "holdingBase3", "label": "#3 Holding base plate", "excel": "N"},
        {"key": "dryingBase13", "label": "#1 / #3 Drying plate", "excel": "O"},
        {"key": "dryingBase24", "label": "#2 / #4 Drying plate", "excel": "P"},
        {"key": "dryingBase5", "label": "#5 Drying plate", "excel": "Q"},
        *tuple(
            {"key": f"light{i}", "label": f"Light #{i}", "excel": column}
            for i, column in enumerate(
                ("R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC"),
                start=1,
            )
        ),
        {"key": "solderTemp", "label": "Solder temp.", "excel": "AD"},
        {"key": "solderTime", "label": "Solder time", "excel": "AE"},
        {"key": "remarks", "label": "Remarks", "excel": "AF"},
    )

    @staticmethod
    def _join_pair(first, second):
        values = [str(value).strip() for value in (first, second) if value not in (None, "")]
        return " / ".join(values)

    @classmethod
    def extract_unit_values(cls, machine_temperature, light_intensity, unit_key):
        temperature = machine_temperature.get(unit_key) if isinstance(machine_temperature, dict) else {}
        light = light_intensity.get(unit_key) if isinstance(light_intensity, dict) else {}
        temperature = temperature if isinstance(temperature, dict) else {}
        light = light if isinstance(light, dict) else {}
        solder_temperature = next(
            (
                value
                for key, value in light.items()
                if str(key).strip().lower().startswith("solder temp")
            ),
            "",
        )

        values = {
            "preheatBasePlate": cls._join_pair(
                temperature.get("Preheat base-1"),
                temperature.get("Preheat base-2"),
            ),
            "solderBasePlate": cls._join_pair(
                temperature.get("Solder base-1"),
                temperature.get("Solder base-2"),
            ),
            "holdingBase1": temperature.get("Holding base-1", ""),
            "combinedPlates": temperature.get("Combined Plates", ""),
            "holdingBase2": temperature.get("Holding base-2", ""),
            "holdingBase3": temperature.get("Holding base-3", ""),
            "dryingBase13": cls._join_pair(
                temperature.get("Drying base-1"),
                temperature.get("Drying base-3"),
            ),
            "dryingBase24": cls._join_pair(
                temperature.get("Drying base-2"),
                temperature.get("Drying base-4"),
            ),
            "dryingBase5": temperature.get("Drying base-5", ""),
            "solderTemp": solder_temperature,
            "solderTime": light.get("Solder Time ms", ""),
            "remarks": "",
        }
        for index in range(1, 13):
            values[f"light{index}"] = light.get(f"#{index}", "")
        return values
