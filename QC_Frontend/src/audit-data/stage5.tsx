import { useEffect, useMemo, useRef } from 'react';
import { StageData, ObservationRenderProps, ObservationValue } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';
import { useLine } from '../context/LineContext';
import { useAlert } from '../context/AlertContext';
import {
    AuditPeelDataset,
    buildPeelStrengthSideValues,
    createOffPeelStrengthSideValues,
    getAuditPeelUnitData,
    hasSavedPeelStrengthValues,
    isPeelStrengthOffUnit,
    normalizePeelStrengthUnit,
    PEEL_STRENGTH_SIDE_CONFIGS,
    PEEL_STRENGTH_UNIT_OPTIONS,
    peelStrengthFieldKeys,
    PeelStrengthSideKey,
    PeelStrengthStringerValue,
    PeelStrengthUnitKey,
    PeelStrengthValue,
    withTrailingPeelStrengthOffValues
} from './peelStrengthAuditMapping';

type PeelStrengthSelection = {
    stringerKey: string;
    unit: string;
    unitKey: PeelStrengthUnitKey;
    sideKey: PeelStrengthSideKey;
    label: string;
};

type FieldDefinition = {
    key: string;
    label: string;
};

const peelAuditDatasetCache = new Map<string, Promise<AuditPeelDataset | null>>();

const asObservationValue = (value: PeelStrengthValue): ObservationValue =>
    value as unknown as ObservationValue;

const isLineI = (lineNumber: string) => lineNumber === 'I';

const LINE_II_MACHINE_TEMP_FIELDS: FieldDefinition[] = [
    { key: 'fluxTemp', label: 'Flux Temp' },
    { key: 'preHeat1', label: '#1 Pre Heat' },
    { key: 'preHeat2', label: '#2 Pre Heat' },
    { key: 'solderPlate', label: 'Solder Plate' },
    { key: 'holdingPlate', label: 'Holding Plate' },
    { key: 'coolingPlate', label: '#1 Cooling Plate' },
    { key: 'drying2', label: '#2 Drying Plate' },
    { key: 'drying3', label: '#3 Drying Plate' },
    { key: 'drying4', label: '#4 Drying Plate' },
    { key: 'drying5', label: '#5 Drying Plate' },
    { key: 'drying6', label: '#6 Drying Plate' }
];

const LINE_I_MACHINE_TEMP_FIELDS: FieldDefinition[] = [
    { key: 'Flux Temp', label: 'Flux Temp' },
    { key: 'Preheat base-1', label: 'Preheat base-1' },
    { key: 'Preheat base-2', label: 'Preheat base-2' },
    { key: 'Solder base-1', label: 'Solder base-1' },
    { key: 'Solder base-2', label: 'Solder base-2' },
    { key: 'Holding base-1', label: 'Holding base-1' },
    { key: 'Combined Plates', label: 'Combined Plates' },
    { key: 'Holding base-2', label: 'Holding base-2' },
    { key: 'Holding base-3', label: 'Holding base-3' },
    { key: 'Drying base-1', label: 'Drying base-1' },
    { key: 'Drying base-2', label: 'Drying base-2' },
    { key: 'Drying base-3', label: 'Drying base-3' },
    { key: 'Drying base-4', label: 'Drying base-4' },
    { key: 'Drying base-5', label: 'Drying base-5' }
];

const LINE_II_LIGHT_SPECIAL_FIELDS: FieldDefinition[] = [
    { key: 'solderTime', label: 'Solder Time (ms)' }
];

const LINE_I_LIGHT_SPECIAL_FIELDS: FieldDefinition[] = [
    { key: 'Solder Time ms', label: 'Solder Time ms' },
    { key: 'Solder Temp ˚C', label: 'Solder Temp ˚C' }
];

const LINE_II_LIGHT_MEASUREMENT_FIELDS: FieldDefinition[] = Array.from({ length: 21 }, (_, i) => ({
    key: `light${i + 1}`,
    label: `#${i + 1}`
}));

const LINE_I_LIGHT_MEASUREMENT_FIELDS: FieldDefinition[] = Array.from({ length: 20 }, (_, i) => ({
    key: `#${i + 1}`,
    label: `#${i + 1}`
}));

const getMachineTempFields = (lineNumber: string) =>
    isLineI(lineNumber) ? LINE_I_MACHINE_TEMP_FIELDS : LINE_II_MACHINE_TEMP_FIELDS;

const getLightSpecialFields = (lineNumber: string) =>
    isLineI(lineNumber) ? LINE_I_LIGHT_SPECIAL_FIELDS : LINE_II_LIGHT_SPECIAL_FIELDS;

const getLightMeasurementFields = (lineNumber: string) =>
    isLineI(lineNumber) ? LINE_I_LIGHT_MEASUREMENT_FIELDS : LINE_II_LIGHT_MEASUREMENT_FIELDS;

const createEmptyFieldValues = (fields: FieldDefinition[]) =>
    fields.reduce<Record<string, string>>((values, field) => {
        values[field.key] = "";
        return values;
    }, {});

const getAuditPeelDataset = async (date: string, shift: string) => {
    const cacheKey = `${date}|${shift}`;
    const cachedDataset = peelAuditDatasetCache.get(cacheKey);
    if (cachedDataset) return cachedDataset;

    const request = fetch(
        `${import.meta.env.VITE_API_URL}/peel/audit/date/${encodeURIComponent(date)}/shift/${encodeURIComponent(shift)}`
    )
        .then(async response => {
            if (!response.ok) throw new Error(`Peel audit data request failed: ${response.status}`);
            const payload = await response.json();
            return payload?.status === 'success' ? payload as AuditPeelDataset : null;
        })
        .catch(error => {
            peelAuditDatasetCache.delete(cacheKey);
            throw error;
        });

    peelAuditDatasetCache.set(cacheKey, request);
    return request;
};

const arePeelStrengthSidesEqual = (left?: Record<string, unknown>, right?: Record<string, unknown>) =>
    peelStrengthFieldKeys.every(key => String(left?.[key] ?? '') === String(right?.[key] ?? ''));

const normalizeExistingPeelStrengthData = (data: PeelStrengthValue, stringerNumbers: number[]) => {
    let changed = false;
    const normalizedData: PeelStrengthValue = { ...data };

    stringerNumbers.forEach(stringerNumber => {
        const stringerKey = `Stringer-${stringerNumber}`;
        const currentStringer = data[stringerKey] || {};
        let nextStringer: PeelStrengthStringerValue = currentStringer;

        PEEL_STRENGTH_SIDE_CONFIGS.forEach(({ unitKey, sideKey }) => {
            const unit = normalizePeelStrengthUnit(currentStringer[unitKey]);
            const currentSideValues = currentStringer[sideKey];
            let nextSideValues: Record<string, string> | null = null;

            if (isPeelStrengthOffUnit(unit)) {
                nextSideValues = createOffPeelStrengthSideValues();
            } else if (unit && hasSavedPeelStrengthValues(currentSideValues)) {
                nextSideValues = withTrailingPeelStrengthOffValues(currentSideValues);
            }

            if (nextSideValues && !arePeelStrengthSidesEqual(currentSideValues, nextSideValues)) {
                nextStringer = {
                    ...nextStringer,
                    [sideKey]: nextSideValues,
                };
                changed = true;
            }
        });

        if (nextStringer !== currentStringer) {
            normalizedData[stringerKey] = nextStringer;
        }
    });

    return { data: normalizedData, changed };
};

const getPeelStrengthSelectionsNeedingFetch = (data: PeelStrengthValue, stringerNumbers: number[]) => {
    const selections: PeelStrengthSelection[] = [];

    stringerNumbers.forEach(stringerNumber => {
        const stringerKey = `Stringer-${stringerNumber}`;
        const stringerValue = data[stringerKey] || {};

        PEEL_STRENGTH_SIDE_CONFIGS.forEach(({ label, unitKey, sideKey }) => {
            const unit = normalizePeelStrengthUnit(stringerValue[unitKey]);
            if (!unit || isPeelStrengthOffUnit(unit)) return;
            if (hasSavedPeelStrengthValues(stringerValue[sideKey])) return;

            selections.push({
                stringerKey,
                unit,
                unitKey,
                sideKey,
                label: `${stringerKey} Unit-${unit} ${label}`,
            });
        });
    });

    return selections;
};

const getPeelStrengthInputBackground = (value: string) => {
    const isOff = value.toUpperCase() === 'OFF';
    if (isOff) return 'bg-yellow-100';
    if (!value) return 'bg-white';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'bg-white';
    return numValue < 1.0 ? 'bg-red-100' : 'bg-white';
};

const PeelStrengthInput = (props: ObservationRenderProps & { disabled?: boolean }) => (
    <input
        type="text"
        value={props.value as string}
        onChange={(e) => !props.disabled && props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
        disabled={props.disabled}
        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getPeelStrengthInputBackground(props.value as string)} ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
    />
);

const PeelStrengthUnitSelector = (props: ObservationRenderProps) => {
    const value = props.value as string;
    const getBackgroundColor = (unitValue: string) => {
        if (unitValue === 'OFF') return 'bg-yellow-100';
        return 'bg-white';
    };

    return (
        <select
            value={value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(value)}`}
        >
            <option value="">Select</option>
            {PEEL_STRENGTH_UNIT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    );
};

const PeelStrengthSection = (props: ObservationRenderProps & { lineNumber: string }) => {
    const { showAlert } = useAlert();
    const peelStrengthData = (props.value || {}) as PeelStrengthValue;
    const { lineNumber } = props;
    const warningKeysRef = useRef<Set<string>>(new Set());
    const pendingFetchKeyRef = useRef('');
    const lineConfig = useMemo(() => (
        LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I']
    ), [lineNumber]);

    const stringerNumbers = useMemo(
        () => lineConfig && 'stringers' in lineConfig ? lineConfig.stringers : [],
        [lineConfig]
    );

    useEffect(() => {
        if (!stringerNumbers.length) return;

        const normalized = normalizeExistingPeelStrengthData(peelStrengthData, stringerNumbers);
        if (normalized.changed) {
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, asObservationValue(normalized.data));
            return;
        }

        const selectionsNeedingFetch = getPeelStrengthSelectionsNeedingFetch(peelStrengthData, stringerNumbers);
        if (!selectionsNeedingFetch.length) {
            pendingFetchKeyRef.current = '';
            return;
        }

        const auditDate = props.auditDate?.trim();
        const auditShift = props.auditShift?.trim();
        if (!auditDate || !auditShift) {
            const warningKey = 'missing-date-shift';
            if (!warningKeysRef.current.has(warningKey)) {
                warningKeysRef.current.add(warningKey);
                showAlert('warning', 'Select audit date and shift before fetching Peel Strength data');
            }
            return;
        }

        const fetchKey = `${auditDate}|${auditShift}|${selectionsNeedingFetch.map(selection => `${selection.stringerKey}:${selection.sideKey}:${selection.unit}`).join(',')}`;
        if (pendingFetchKeyRef.current === fetchKey) return;

        let cancelled = false;
        pendingFetchKeyRef.current = fetchKey;

        getAuditPeelDataset(auditDate, auditShift)
            .then(dataset => {
                if (cancelled) return;

                const updatedData: PeelStrengthValue = { ...peelStrengthData };
                const missingLabels: string[] = [];

                selectionsNeedingFetch.forEach(selection => {
                    const unitData = getAuditPeelUnitData(dataset, selection.stringerKey, selection.unit);
                    const fetchedSideValues = unitData?.[selection.sideKey];
                    const hasAnyFetchedValues = Boolean(fetchedSideValues && Object.keys(fetchedSideValues).length > 0);
                    const hasCompleteFetchedValues = hasSavedPeelStrengthValues(fetchedSideValues);

                    updatedData[selection.stringerKey] = {
                        ...(updatedData[selection.stringerKey] || {}),
                        [selection.unitKey]: selection.unit,
                        [selection.sideKey]: hasAnyFetchedValues
                            ? buildPeelStrengthSideValues(fetchedSideValues)
                            : createOffPeelStrengthSideValues(),
                    };

                    if (!hasCompleteFetchedValues) {
                        missingLabels.push(selection.label);
                    }
                });

                props.onUpdate(props.stageId, props.paramId, props.timeSlot, asObservationValue(updatedData));

                if (missingLabels.length) {
                    const warningKey = `${fetchKey}:missing`;
                    if (!warningKeysRef.current.has(warningKey)) {
                        warningKeysRef.current.add(warningKey);
                        showAlert(
                            'warning',
                            `Peel Strength data not found for ${auditDate} Shift ${auditShift}. Filled OFF for ${missingLabels.slice(0, 3).join(', ')}${missingLabels.length > 3 ? '...' : ''}`
                        );
                    }
                }
                pendingFetchKeyRef.current = '';
            })
            .catch(error => {
                if (cancelled) return;
                console.error('Error fetching audit peel strength data:', error);

                const updatedData: PeelStrengthValue = { ...peelStrengthData };
                selectionsNeedingFetch.forEach(selection => {
                    updatedData[selection.stringerKey] = {
                        ...(updatedData[selection.stringerKey] || {}),
                        [selection.unitKey]: selection.unit,
                        [selection.sideKey]: createOffPeelStrengthSideValues(),
                    };
                });
                props.onUpdate(props.stageId, props.paramId, props.timeSlot, asObservationValue(updatedData));

                const warningKey = `${fetchKey}:error`;
                if (!warningKeysRef.current.has(warningKey)) {
                    warningKeysRef.current.add(warningKey);
                    showAlert('warning', 'Unable to fetch Peel Strength data. Filled OFF for missing fields');
                }
                pendingFetchKeyRef.current = '';
            });

        return () => {
            cancelled = true;
            if (pendingFetchKeyRef.current === fetchKey) {
                pendingFetchKeyRef.current = '';
            }
        };
    }, [peelStrengthData, props.auditDate, props.auditShift, stringerNumbers, showAlert]);

    if (!lineConfig || !('stringers' in lineConfig)) {
        return <div>Error: Line configuration not found</div>;
    }

    const handleUnitChange = (
        stringerNumber: number,
        unitKey: PeelStrengthUnitKey,
        sideKey: PeelStrengthSideKey,
        newValue: string
    ) => {
        const stringerKey = `Stringer-${stringerNumber}`;
        const normalizedUnit = normalizePeelStrengthUnit(newValue);
        const updatedData = {
            ...peelStrengthData,
            [stringerKey]: {
                ...(peelStrengthData[stringerKey] || {}),
                [unitKey]: normalizedUnit,
                [sideKey]: isPeelStrengthOffUnit(normalizedUnit)
                    ? createOffPeelStrengthSideValues()
                    : {},
            },
        };
        props.onUpdate(props.stageId, props.paramId, props.timeSlot, asObservationValue(updatedData));
    };

    return (
        <div className="grid grid-cols-3 gap-2">
            {lineConfig.stringers.map((stringerNumber) => {
                const stringerKey = `Stringer-${stringerNumber}`;
                const stringerData = peelStrengthData[stringerKey] || {};

                return (
                    <div key={stringerNumber} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <h4 className="font-semibold text-center mb-4 text-sm">Stringer {stringerNumber}</h4>

                        <div className="space-y-4">
                            {PEEL_STRENGTH_SIDE_CONFIGS.map(({ label, titleClassName, unitKey, sideKey }) => {
                                const selectedUnit = stringerData[unitKey] || '';
                                const isOffUnit = isPeelStrengthOffUnit(selectedUnit);

                                return (
                                    <div key={sideKey} className="border border-gray-200 rounded-lg p-2 bg-white">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className={`text-sm font-semibold ${titleClassName}`}>{label}</h5>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-600">Unit:</span>
                                                <PeelStrengthUnitSelector
                                                    {...props}
                                                    value={selectedUnit}
                                                    onUpdate={(_stageId, _paramId, _timeSlot, selectedValue) => {
                                                        handleUnitChange(stringerNumber, unitKey, sideKey, selectedValue as string);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {!isOffUnit && (
                                            <div className="grid grid-cols-5 gap-1">
                                                {peelStrengthFieldKeys.map((position) => (
                                                    <div key={`${sideKey}-${position}`} className="flex flex-col items-center">
                                                        <label className="text-xs text-gray-600 mb-1">{position}</label>
                                                        <PeelStrengthInput
                                                            {...props}
                                                            value={stringerData[sideKey]?.[position] || ''}
                                                            disabled={isOffUnit}
                                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                                const updatedData = {
                                                                    ...peelStrengthData,
                                                                    [stringerKey]: {
                                                                        ...(peelStrengthData[stringerKey] || {}),
                                                                        [sideKey]: {
                                                                            ...(peelStrengthData[stringerKey]?.[sideKey] || {}),
                                                                            [position]: newValue as string
                                                                        }
                                                                    }
                                                                };
                                                                props.onUpdate(stageId, paramId, timeSlot, asObservationValue(updatedData));
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const StringerSectionWithLine = (props: ObservationRenderProps) => {
    const { lineNumber } = useLine();
    if (props.paramId === '5-11-peel-strength') return <PeelStrengthSection {...props} lineNumber={lineNumber} />;
    return TabbingStringingObservations.renderCombinedStringerSectionWithLine({ ...props, lineNumber });
};

const TabbingStringingObservations = {
    renderInputText: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        const isNA = (value: string) => value.toUpperCase() === 'N/A';

        const getBackgroundColor = (value: string) => {
            if (isOff(value) || isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderINTCSupplier: (props: ObservationRenderProps) => {
        const isNA = (value: string) => value === 'N/A';

        const getBackgroundColor = (value: string) => {
            if (isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="Juren">Juren</option>
                    <option value="Sunby">Sunby</option>
                    <option value="YourBest">YourBest</option>
                    <option value="N/A">N/A</option>
                </select>
            </div>
        );
    },

    renderFluxSupplier: (props: ObservationRenderProps) => {
        const isNA = (value: string) => value === 'N/A';

        const getBackgroundColor = (value: string) => {
            if (isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="Reality chemical">Reality chemical</option>
                    <option value="Arbital Solutions Pvt Ltd.">Arbital Solutions Pvt Ltd.</option>
                    <option value="Kester">Kester</option>
                    <option value="HuiHui">HuiHui</option>
                    <option value="Khanna Traders & Engg.">Khanna Traders & Engg.</option>
                    <option value="N/A">N/A</option>
                </select>
            </div>
        );
    },

    renderSelector: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Checked Not OK') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string || 'Checked OK'}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="Checked OK">Checked OK</option>
                <option value="Checked Not OK">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderInputNumber: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId === '5-8-tds') return (numValue < 0 || numValue > 5) ? 'bg-red-100' : 'bg-white';
            return 'bg-white';
        };

        return (
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
            />
        );
    },

    renderExpiryDate: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value) {
                const inputDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                inputDate.setHours(0, 0, 0, 0);
                if (inputDate < today) return 'bg-red-100';
            }
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="date"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderStringerSection: (props: ObservationRenderProps) => {
        const stringerData = props.value as Record<string, string>;

        const getBackgroundColorForValue = (value: string, _key: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId.includes('laser-power')) return (numValue < 30 || numValue > 70) ? 'bg-red-100' : 'bg-white';
            if (props.paramId.includes('groove-length')) return (numValue < 2 || numValue > 8) ? 'bg-red-100' : 'bg-white';
            if (props.paramId.includes('cell-width')) return 'bg-white';
            return 'bg-white';
        };

        return (
            <div className={"border rounded-lg p-2"}>
                <h4 className="font-semibold text-center mb-2 text-sm">{props.timeSlot}</h4>
                <div className="grid grid-cols-2 gap-1">
                    {Object.entries(stringerData).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                            {props.paramId.includes('laser-power') && (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, key)}`}
                                />
                            )}
                            {props.paramId.includes('cell-appearance') && (
                                <TabbingStringingObservations.renderSelector
                                    {...props}
                                    value={value}
                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                        const updatedData = { ...stringerData, [key]: newValue as string };
                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                    }}
                                />
                            )}
                            {props.paramId.includes('cell-width') && (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, key)}`}
                                />
                            )}
                            {props.paramId.includes('groove-length') && (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, key)}`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderCombinedStringerSectionWithLine: (props: ObservationRenderProps & { lineNumber: string }) => {
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I']; // Default to Line I

        const createDefaultStringerData = () => {
            const defaultData: Record<string, Record<string, string>> = {};
            if (lineConfig && 'stringers' in lineConfig) {
                lineConfig.stringers.forEach(stringerNumber => {
                    if (props.paramId.includes('cell-width')) {
                        defaultData[`Stringer-${stringerNumber}`] = {
                            "Upper-A-L": "", "Upper-A-R": "", "Lower-A-L": "", "Lower-A-R": "",
                            "Upper-B-L": "", "Upper-B-R": "", "Lower-B-L": "", "Lower-B-R": ""
                        };
                    } else if (props.paramId.includes('groove-length')) {
                        defaultData[`Stringer-${stringerNumber}`] = {
                            "Unit A - Upper Half": "",
                            "Unit A - Lower Half": "",
                            "Unit B - Upper Half": "",
                            "Unit B - Lower Half": ""
                        };
                    } else {
                        defaultData[`Stringer-${stringerNumber}`] = { "Unit A": "", "Unit B": "" };
                    }
                });
            }
            return defaultData;
        };

        const savedStringerData = typeof props.value === 'object' && props.value !== null
            ? props.value as Record<string, Record<string, string>>
            : {};
        const allStringerData = Object.entries(createDefaultStringerData()).reduce<Record<string, Record<string, string>>>((merged, [stringerKey, defaultValues]) => {
            merged[stringerKey] = { ...defaultValues, ...(savedStringerData[stringerKey] || {}) };
            return merged;
        }, {});

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (paramId.includes('laser-power')) return (numValue < 30 || numValue > 70) ? 'bg-red-100' : 'bg-white';
            if (paramId.includes('groove-length')) return (numValue < 2 || numValue > 8) ? 'bg-red-100' : 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3 bg-brand-primary-soft">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('laser-power') && (
                                                <span className="text-xs text-gray-500 mt-1">%</span>
                                            )}
                                            {props.paramId.includes('cell-appearance') && (
                                                <TabbingStringingObservations.renderSelector
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-width') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {(props.paramId.includes('groove-length') || props.paramId.includes('cell-width')) && (
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3 bg-green-50">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('laser-power') && (
                                                <span className="text-xs text-gray-500 mt-1">%</span>
                                            )}
                                            {props.paramId.includes('cell-appearance') && (
                                                <TabbingStringingObservations.renderSelector
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-width') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {(props.paramId.includes('groove-length') || props.paramId.includes('cell-width')) && (
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    // Keep the original renderCombinedStringerSection for backward compatibility
    renderCombinedStringerSection: (props: ObservationRenderProps) => {
        return <StringerSectionWithLine {...props} />;
    },

    renderMachineTempSection: (props: ObservationRenderProps & { lineNumber: string }) => {
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
        const tempFields = getMachineTempFields(lineNumber);
        const defaultUnitValues = createEmptyFieldValues(tempFields);
        const savedStringerData = typeof props.value === 'object' && props.value !== null
            ? props.value as Record<string, any>
            : {};
        const allStringerData: Record<string, any> = { ...savedStringerData };

        const getBackgroundColorForValue = (value: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        lineConfig.stringers.forEach(stringerNumber => {
            const stringerKey = `Stringer-${stringerNumber}`;
            const savedStringer = savedStringerData[stringerKey] || {};
            allStringerData[stringerKey] = {
                ...savedStringer,
                unitA: { ...defaultUnitValues, ...(savedStringer.unitA || {}) },
                unitB: { ...defaultUnitValues, ...(savedStringer.unitB || {}) }
            };
        });

        const renderStringerUnit = (stringerNumber: number, unit: 'unitA' | 'unitB', unitLabel: string) => (
            <div className="border border-gray-200 rounded p-2 bg-gray-50">
                <h6 className="font-semibold text-center mb-2 text-sm bg-brand-primary-muted py-1 rounded">{unitLabel}</h6>
                <div className="grid grid-cols-2 gap-1">
                    {tempFields.map((field) => (
                        <div key={field.key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">{field.label}</label>
                            <input
                                type="text"
                                value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || ''}
                                onChange={(e) => {
                                    const updatedData = {
                                        ...allStringerData,
                                        [`Stringer-${stringerNumber}`]: {
                                            ...allStringerData[`Stringer-${stringerNumber}`],
                                            [unit]: {
                                                ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                                [field.key]: e.target.value
                                            }
                                        }
                                    };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                }}
                                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || '')}`}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderLightIntensityTimeSection: (props: ObservationRenderProps & { lineNumber: string }) => {
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
        const specialFields = getLightSpecialFields(lineNumber);
        const lightFields = getLightMeasurementFields(lineNumber);
        const defaultUnitValues = createEmptyFieldValues([...specialFields, ...lightFields]);
        const savedStringerData = typeof props.value === 'object' && props.value !== null
            ? props.value as Record<string, any>
            : {};
        const allStringerData: Record<string, any> = { ...savedStringerData };

        const getBackgroundColorForValue = (value: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        lineConfig.stringers.forEach(stringerNumber => {
            const stringerKey = `Stringer-${stringerNumber}`;
            const savedStringer = savedStringerData[stringerKey] || {};
            allStringerData[stringerKey] = {
                ...savedStringer,
                unitA: { ...defaultUnitValues, ...(savedStringer.unitA || {}) },
                unitB: { ...defaultUnitValues, ...(savedStringer.unitB || {}) }
            };
        });

        const renderStringerUnit = (stringerNumber: number, unit: 'unitA' | 'unitB', unitLabel: string) => (
            <div className="border border-gray-200 rounded p-2 bg-gray-50">
                <h6 className="font-semibold text-center mb-2 text-sm bg-brand-primary-muted py-1 rounded">{unitLabel}</h6>

                <div className={`mb-3 grid gap-2 ${specialFields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {specialFields.map((field) => (
                        <div key={field.key} className="p-2 border border-gray-300 rounded bg-white">
                            <label className="text-xs text-gray-600 mb-1 block text-center">{field.label}</label>
                            <input
                                type="text"
                                value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || ''}
                                onChange={(e) => {
                                    const updatedData = {
                                        ...allStringerData,
                                        [`Stringer-${stringerNumber}`]: {
                                            ...allStringerData[`Stringer-${stringerNumber}`],
                                            [unit]: {
                                                ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                                [field.key]: e.target.value
                                            }
                                        }
                                    };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                }}
                                className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || '')}`}
                            />
                        </div>
                    ))}
                </div>

                {/* Light Intensity Grid */}
                <div className="grid grid-cols-5 gap-1">
                    {lightFields.map((field) => (
                        <div key={field.key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1 text-center">{field.label}</label>
                            <input
                                type="text"
                                value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || ''}
                                onChange={(e) => {
                                    const updatedData = {
                                        ...allStringerData,
                                        [`Stringer-${stringerNumber}`]: {
                                            ...allStringerData[`Stringer-${stringerNumber}`],
                                            [unit]: {
                                                ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                                [field.key]: e.target.value
                                            }
                                        }
                                    };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                }}
                                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || '')}`}
                            />
                            <span className="text-xs text-gray-500 mt-1 text-center">%</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderUnitSelector: (props: ObservationRenderProps) => <PeelStrengthUnitSelector {...props} />,

    renderPeelStrengthInput: (props: ObservationRenderProps & { disabled?: boolean }) => <PeelStrengthInput {...props} />,

    renderPeelStrengthSection: (props: ObservationRenderProps & { lineNumber: string }) => (
        <PeelStrengthSection {...props} />
    ),

    renderSingleInputPerStringer: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, string>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';

            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';

            if (paramId.includes('ribbon-flatten')) {
                // Ribbon flatten must be ≥ 56% of ribbon diameter
                // Assuming ribbon diameter is 0.139, so 56% would be 0.139 * 0.56 = 0.07784
                return numValue >= 0.07784 ? 'bg-white' : 'bg-red-100';
            }
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-6 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <input
                                    type="text"
                                    value={allStringerData[`Stringer-${stringerNumber}`] || ''}
                                    onChange={(e) => {
                                        const updatedData = {
                                            ...allStringerData,
                                            [`Stringer-${stringerNumber}`]: e.target.value
                                        };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`] || '', props.paramId)}`}
                                />
                                {props.paramId.includes('ribbon-flatten') && (
                                    <span className="text-xs text-gray-500 mt-1 text-center">mm</span>
                                )}
                            </div>
                        ))}
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <input
                                    type="text"
                                    value={allStringerData[`Stringer-${stringerNumber}`] || ''}
                                    onChange={(e) => {
                                        const updatedData = {
                                            ...allStringerData,
                                            [`Stringer-${stringerNumber}`]: e.target.value
                                        };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`] || '', props.paramId)}`}
                                />
                                {props.paramId.includes('ribbon-flatten') && (
                                    <span className="text-xs text-gray-500 mt-1 text-center">mm</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderDoubleTimeSlotPerStringer: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, { '4 hours': string; '8 hours': string }>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';

            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';

            if (paramId.includes('string-length')) {
                // String length ± 0.1mm validation would need reference value
                return 'bg-white';
            }
            if (paramId.includes('cell-to-cell-gap')) {
                // 0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12
                // For now, using broader range that covers both
                return (numValue >= 0.3 && numValue <= 1.8) ? 'bg-white' : 'bg-red-100';
            }
            if (paramId.includes('el-inspection')) {
                if (value === 'Checked Not OK') return 'bg-red-100';
                if (value === 'OFF') return 'bg-yellow-100';
                return 'bg-white';
            }
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-6 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="mb-2">
                                    <label className="text-xs text-gray-600 mb-1 block text-center">4 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mb-2 text-center block">mm</span>
                                )}
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block text-center">8 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mt-1 text-center block">mm</span>
                                )}
                            </div>
                        ))}
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="mb-2">
                                    <label className="text-xs text-gray-600 mb-1 block text-center">4 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mb-2 text-center block">mm</span>
                                )}
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block text-center">8 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-brand-primary shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>

                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mt-1 text-center block">mm</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
};

const createGrooveLengthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const allStringersData: Record<string, Record<string, string>> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = {
                "Unit A - Upper Half": "",
                "Unit A - Lower Half": "",
                "Unit B - Upper Half": "",
                "Unit B - Lower Half": ""
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = {
                "Unit A - Upper Half": "",
                "Unit A - Lower Half": "",
                "Unit B - Upper Half": "",
                "Unit B - Lower Half": ""
            };
        }
    }

    return allStringersData;
};

const createCombinedStringerParameters = (lineNumber: string = 'I', defaultValue: string = '') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const allStringersData: Record<string, Record<string, string>> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = { "Unit A": defaultValue, "Unit B": defaultValue };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = { "Unit A": defaultValue, "Unit B": defaultValue };
        }
    }

    return allStringersData;
};

const createCombinedCellWidthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const allStringersData: Record<string, Record<string, string>> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = {
                "Upper-A-L": "", "Upper-A-R": "", "Lower-A-L": "", "Lower-A-R": "",
                "Upper-B-L": "", "Upper-B-R": "", "Lower-B-L": "", "Lower-B-R": ""
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = {
                "Upper-A-L": "", "Upper-A-R": "", "Lower-A-L": "", "Lower-A-R": "",
                "Upper-B-L": "", "Upper-B-R": "", "Lower-B-L": "", "Lower-B-R": ""
            };
        }
    }

    return allStringersData;
};

const createMachineTempParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber] || LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    const unitDefaults = createEmptyFieldValues(getMachineTempFields(lineNumber));

    const tempData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            tempData[`Stringer-${stringerNumber}`] = {
                unitA: { ...unitDefaults },
                unitB: { ...unitDefaults }
            };
        });
    }
    return tempData;
};

// For 5-10: Light Intensity & Soldering Time (22 inputs per unit)
const createLightIntensityTimeParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber] || LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    const unitDefaults = createEmptyFieldValues([
        ...getLightSpecialFields(lineNumber),
        ...getLightMeasurementFields(lineNumber)
    ]);

    const lightData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            lightData[`Stringer-${stringerNumber}`] = {
                unitA: { ...unitDefaults },
                unitB: { ...unitDefaults }
            };
        });
    }
    return lightData;
};

const createPeelStrengthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const peelStrengthData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            peelStrengthData[`Stringer-${stringerNumber}`] = {
                frontUnit: '',
                backUnit: '',
                frontSide: {},
                backSide: {}
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            peelStrengthData[`Stringer-${i}`] = {
                frontUnit: '',
                backUnit: '',
                frontSide: {},
                backSide: {}
            };
        }
    }

    return peelStrengthData;
};

// Parameter creation functions for the new structure
const createSingleInputPerStringerParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const stringerData: Record<string, string> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            stringerData[`Stringer-${stringerNumber}`] = "";
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            stringerData[`Stringer-${i}`] = "";
        }
    }

    return stringerData;
};

const createDoubleTimeSlotPerStringerParameters = (lineNumber: string = 'I', defaultValue: string = '') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const stringerData: Record<string, { '4 hours': string; '8 hours': string }> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            stringerData[`Stringer-${stringerNumber}`] = {
                '4 hours': defaultValue,
                '8 hours': defaultValue
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            stringerData[`Stringer-${i}`] = {
                '4 hours': defaultValue,
                '8 hours': defaultValue
            };
        }
    }

    return stringerData;
};

export const createTabbingStringingStage = (lineNumber: string = 'I'): StageData => ({
    id: 5,
    name: "Tabbing and Stringing",
    parameters: [
        {
            id: "5-1",
            parameters: "INTC Ribbon Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Dimension", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return TabbingStringingObservations.renderINTCSupplier(props);
                else if (props.timeSlot === "Expiry Date") return TabbingStringingObservations.renderExpiryDate(props);
                return TabbingStringingObservations.renderInputText(props);
            }
        },
        {
            id: "5-2",
            parameters: "Ribbon Spool Aesthetics",
            criteria: "Spool Gap, Damage or Coating Defect",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderSelector
        },
        {
            id: "5-3",
            parameters: "Flux Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return TabbingStringingObservations.renderFluxSupplier(props);
                else if (props.timeSlot === "Expiry Date") return TabbingStringingObservations.renderExpiryDate(props);
                return TabbingStringingObservations.renderInputText(props);
            }
        },
        {
            id: "5-4-laser-power",
            parameters: "Machine Laser Power",
            criteria: "As per laser power range 50% ± 20%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-5-cell-appearance",
            parameters: "Cell Appearance",
            criteria: "Free from chip, rough edge, cross cut, crack etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters(lineNumber, 'Checked OK') }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-6-cell-width",
            parameters: "Cell Width Measurements",
            criteria: "Specific tolerance between Left & Right side width ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedCellWidthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-7-groove-length",
            parameters: "Groove Laser Cutting Length",
            criteria: "Specific tolerance 5 ± 3mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createGrooveLengthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-8-tds",
            parameters: "Deionized Water TDS Value",
            criteria: "Specific tolerance 0 to 5 ppm",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "TDS Value", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputNumber
        },
        {
            id: "5-9-machine-temp-setup",
            parameters: "Stringer Machine setup As per recipe Pre Heat Table & Soldering Temp",
            criteria: "Machine temperature setup As per Reference Document VSL/PDN/SC/34",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createMachineTempParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderMachineTempSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-10-light-intensity-time",
            parameters: "Stringer Machine setup As per recipe Light Intensity & Total soldering time",
            criteria: "Machine temperature setup As per Reference Document VSL/PDN/SC/34",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createLightIntensityTimeParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderLightIntensityTimeSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-11-peel-strength",
            parameters: "Cell to Interconnect Ribbon Peel Strength",
            criteria: "Peel strength average ≥ 1.0 N/mm. Effective soldering should be ≥ 90% of its total numbers of the bus pads. Hard soldering: Silver peel off not allowed",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createPeelStrengthParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderPeelStrengthSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-12-ribbon-flatten",
            parameters: "Ribbon flatten",
            criteria: "Ribbon flatten must be ≤ 70% of ribbon diameter",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createSingleInputPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderSingleInputPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-13-string-length",
            parameters: "String length",
            criteria: "As per Engg. drawing ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-14-cell-to-cell-gap",
            parameters: "Cell to Cell Gap",
            criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-15-el-inspection",
            parameters: "EL inspection",
            criteria: "Refer doc no- VSL/QAD/SC/07",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber, 'Checked OK') }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        }
    ]
});

export const tabbingStringingStage = createTabbingStringingStage('I');
