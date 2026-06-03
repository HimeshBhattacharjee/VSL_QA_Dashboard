import { ObservationRenderProps, ObservationValue, SampleGroupedValue } from '../types/audit';

export const SAMPLE_GROUPS = [
    { key: '2h', label: '2 Hours', order: 1, samples: [1, 2, 3, 4, 5] },
    { key: '4h', label: '4 Hours', order: 2, samples: [6, 7, 8, 9, 10] },
    { key: '6h', label: '6 Hours', order: 3, samples: [11, 12, 13, 14, 15] },
    { key: '8h', label: '8 Hours', order: 4, samples: [16, 17, 18, 19, 20] },
];

const getSampleLabel = (sampleNumber: number) => `Sample-${sampleNumber}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const isSampleGroupedValue = (value: unknown): value is SampleGroupedValue =>
    isRecord(value) && Array.isArray(value.sampleGroups);

const readLegacySampleValues = (value: ObservationValue): Record<string, string> => {
    if (isSampleGroupedValue(value)) {
        return value.sampleGroups.reduce<Record<string, string>>((sampleValues, group) => {
            if (!Array.isArray(group.samples)) return sampleValues;
            group.samples.forEach(sample => {
                const sampleLabel = sample.sampleLabel || getSampleLabel(sample.sampleNumber);
                sampleValues[sampleLabel] = sample.value ?? '';
            });
            return sampleValues;
        }, {});
    }

    if (!isRecord(value)) return {};

    return SAMPLE_GROUPS
        .flatMap(group => group.samples)
        .reduce<Record<string, string>>((sampleValues, sampleNumber) => {
            const sampleLabel = getSampleLabel(sampleNumber);
            const sampleValue = value[sampleLabel];
            sampleValues[sampleLabel] = sampleValue === undefined || sampleValue === null ? '' : String(sampleValue);
            return sampleValues;
        }, {});
};

const readCanonicalLineMapping = (value: ObservationValue): Record<string, string> => {
    if (!isSampleGroupedValue(value)) return {};

    return value.sampleGroups.reduce<Record<string, string>>((mapping, group) => {
        if (group.groupKey && group.selectedLine) {
            mapping[group.groupKey] = group.selectedLine;
        }
        return mapping;
    }, {});
};

export const normalizeSampleGroupedValue = (
    value: ObservationValue,
    parameterId: string,
    lineMapping: Record<string, string> = {},
    fallbackLine = ''
): SampleGroupedValue => {
    const legacySampleValues = readLegacySampleValues(value);
    const canonicalLineMapping = readCanonicalLineMapping(value);

    return {
        schemaVersion: 1,
        sampleGroups: SAMPLE_GROUPS.map(group => ({
            groupKey: group.key,
            groupLabel: group.label,
            order: group.order,
            selectedLine: canonicalLineMapping[group.key] || lineMapping[group.key] || fallbackLine,
            samples: group.samples.map(sampleNumber => {
                const sampleLabel = getSampleLabel(sampleNumber);
                return {
                    parameterId,
                    sampleGroup: group.key,
                    sampleNumber,
                    sampleLabel,
                    value: legacySampleValues[sampleLabel] || ''
                };
            })
        }))
    };
};

export const createTwentySampleValue = (
    parameterId = '',
    lineMapping: Record<string, string> = {}
) => normalizeSampleGroupedValue('', parameterId, lineMapping);

export const getSampleGroupedLineMapping = (
    value: ObservationValue,
    fallbackLineMapping: Record<string, string> = {},
    fallbackLine = ''
) => {
    const canonicalLineMapping = readCanonicalLineMapping(value);
    return SAMPLE_GROUPS.reduce<Record<string, string>>((mapping, group) => {
        mapping[group.key] = canonicalLineMapping[group.key] || fallbackLineMapping[group.key] || fallbackLine;
        return mapping;
    }, {});
};

export const getSampleGroupedSampleValue = (
    value: SampleGroupedValue,
    sampleNumber: number
) => {
    const sampleLabel = getSampleLabel(sampleNumber);
    for (const group of value.sampleGroups) {
        const sample = group.samples.find(item => item.sampleNumber === sampleNumber || item.sampleLabel === sampleLabel);
        if (sample) return sample.value || '';
    }
    return '';
};

export const updateSampleGroupedSampleValue = (
    value: ObservationValue,
    parameterId: string,
    sampleNumber: number,
    sampleValue: string,
    lineMapping: Record<string, string> = {},
    fallbackLine = ''
) => {
    const normalizedValue = normalizeSampleGroupedValue(value, parameterId, lineMapping, fallbackLine);
    return {
        ...normalizedValue,
        sampleGroups: normalizedValue.sampleGroups.map(group => ({
            ...group,
            samples: group.samples.map(sample =>
                sample.sampleNumber === sampleNumber
                    ? { ...sample, value: sampleValue }
                    : sample
            )
        }))
    };
};

export const updateSampleGroupedLineSelection = (
    value: ObservationValue,
    parameterId: string,
    groupKey: string,
    selectedLine: string,
    lineMapping: Record<string, string> = {},
    fallbackLine = ''
) => {
    const normalizedValue = normalizeSampleGroupedValue(value, parameterId, lineMapping, fallbackLine);
    return {
        ...normalizedValue,
        sampleGroups: normalizedValue.sampleGroups.map(group =>
            group.groupKey === groupKey
                ? { ...group, selectedLine }
                : group
        )
    };
};

export const renderGroupedSampleInputs = (
    props: ObservationRenderProps,
    getBackgroundColor: (value: string) => string
) => {
    const lineOptions = props.lineOptions || [];
    const fallbackLine = props.observationData.selectedLine || lineOptions[0] || '';
    const sampleValue = normalizeSampleGroupedValue(
        props.value,
        props.paramId,
        props.observationData.lineMapping || {},
        fallbackLine
    );
    const lineMapping = getSampleGroupedLineMapping(sampleValue, props.observationData.lineMapping || {}, fallbackLine);

    return (
        <div className="w-full min-w-0 rounded-lg bg-white shadow-sm border border-gray-300 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
                {SAMPLE_GROUPS.map(group => (
                    <div key={group.label} className="min-w-0 border-r last:border-r-0 border-gray-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 px-2 py-2">
                            <span>{group.label}</span>
                            <label className="flex min-w-0 items-center gap-1 font-normal text-gray-500">Line -
                                <select
                                    value={lineMapping[group.key] || fallbackLine}
                                    onChange={(e) => props.onLineMappingUpdate?.(props.stageId, props.paramId, props.timeSlot, group.key, e.target.value)}
                                    className="max-w-full px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {lineOptions.map(line => (
                                        <option key={line} value={line}>{line}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="grid grid-rows-5 gap-2 p-2">
                            {group.samples.map(sampleNumber => {
                                const sampleLabel = getSampleLabel(sampleNumber);
                                const currentSampleValue = getSampleGroupedSampleValue(sampleValue, sampleNumber);
                                return (
                                <div key={sampleLabel} className="flex flex-col items-center min-w-0">
                                    <span className="text-[11px] text-gray-500 mb-1 truncate w-full text-center">{sampleLabel}</span>
                                    <input
                                        type="text"
                                        value={currentSampleValue}
                                        onChange={(e) => {
                                            const updatedValue = updateSampleGroupedSampleValue(
                                                sampleValue,
                                                props.paramId,
                                                sampleNumber,
                                                e.target.value,
                                                lineMapping,
                                                fallbackLine
                                            );
                                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                        }}
                                        className={`w-full min-w-0 px-1 py-1 text-center border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(currentSampleValue)}`}
                                    />
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
