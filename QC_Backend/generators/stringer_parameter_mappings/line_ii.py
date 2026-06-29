class LineIIStringerParameterMapper:
    line = "II"
    template_filename = "Blank Stringer Parameter Report Line-II.xlsx"
    machine_numbers = tuple(range(7, 13))
    audit_columns = (
        {"key": "fluxTemp", "label": "Flux Temp", "excel": "I"},
        {"key": "preHeat1", "label": "#1 Pre heat base plate", "excel": "J"},
        {"key": "preHeat2", "label": "#2 Pre heat base plate", "excel": "K"},
        {"key": "solderPlate", "label": "Solder base plate", "excel": "L"},
        {"key": "holdingPlate", "label": "Holding base plate", "excel": "M"},
        {"key": "coolingPlate", "label": "#1 Cooling base plate", "excel": "N"},
        {"key": "drying2", "label": "#2 Drying plate", "excel": "O"},
        {"key": "drying3", "label": "#3 Drying plate", "excel": "P"},
        {"key": "drying4", "label": "#4 Drying plate", "excel": "Q"},
        {"key": "drying5", "label": "#5 Drying plate", "excel": "R"},
        {"key": "drying6", "label": "#6 Drying plate", "excel": "S"},
        *tuple(
            {"key": f"light{i}", "label": f"Light #{i}", "excel": column}
            for i, column in enumerate(
                ("T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG"),
                start=1,
            )
        ),
        {"key": "solderTime", "label": "Solder time", "excel": "AH"},
    )

    @classmethod
    def extract_unit_values(cls, machine_temperature, light_intensity, unit_key):
        temperature = machine_temperature.get(unit_key) if isinstance(machine_temperature, dict) else {}
        light = light_intensity.get(unit_key) if isinstance(light_intensity, dict) else {}
        temperature = temperature if isinstance(temperature, dict) else {}
        light = light if isinstance(light, dict) else {}

        values = {
            "fluxTemp": temperature.get("fluxTemp", ""),
            "preHeat1": temperature.get("preHeat1", ""),
            "preHeat2": temperature.get("preHeat2", ""),
            "solderPlate": temperature.get("solderPlate", ""),
            "holdingPlate": temperature.get("holdingPlate", ""),
            "coolingPlate": temperature.get("coolingPlate", ""),
            "drying2": temperature.get("drying2", ""),
            "drying3": temperature.get("drying3", ""),
            "drying4": temperature.get("drying4", ""),
            "drying5": temperature.get("drying5", ""),
            "drying6": temperature.get("drying6", temperature.get("drying1", "")),
            "solderTime": light.get("solderTime", ""),
        }
        for index in range(1, 15):
            values[f"light{index}"] = light.get(f"light{index}", "")
        return values
