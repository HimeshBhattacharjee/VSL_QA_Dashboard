import { useEffect, useMemo, useRef, useState } from 'react';
import { ObservationRenderProps, ObservationValue } from '../types/audit';

type LookupStatus = {
    loading: boolean;
    message: string;
};

type LookupData = {
    found: boolean;
    measurements?: string[];
};

type LookupSelection = {
    sectionKey: string;
    line: string;
    position: string;
    side: string;
    lookupKey: string;
};

const AUDIT_FIELD_COUNT = 40;
const SOURCE_BLOCK_SIZE = 16;
const AUDIT_BLOCK_SIZE = 20;
const LINE_OPTIONS = ['1', '2'];
const POSITION_OPTIONS = ['1', '2', '3'];
const SIDE_OPTIONS = [
    { value: 'Top', label: 'Top' },
    { value: 'Middle', label: 'Middle' },
    { value: 'Bottom', label: 'Bottom' },
    { value: 'OFF', label: 'OFF' },
];

const lookupCache = new Map<string, Promise<LookupData>>();

const normalizeRecordValue = (value: unknown, lineOptions: string[]) => {
    const initialValue = Object.fromEntries(
        lineOptions.flatMap(line => [
            [`${line}-Line`, ''],
            [`${line}-Position`, ''],
            [`${line}-Side`, ''],
            ...Array.from({ length: AUDIT_FIELD_COUNT }, (_, index) => [`${line}-Pos${index + 1}`, '']),
        ])
    ) as Record<string, string>;

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return initialValue;
    }

    Object.entries(value).forEach(([key, item]) => {
        if (typeof item === 'string' || typeof item === 'number') {
            initialValue[key] = String(item);
        }
    });
    return initialValue;
};

const normalizeOptionNumber = (value: string) => value.trim().replace(/^Line-/, '');

const getSectionNumber = (sectionKey: string) => sectionKey.split('-')[1] || sectionKey;

const fetchLookupData = (selection: LookupSelection, auditDate: string, auditShift: string) => {
    const requestKey = `${auditDate}|${auditShift}|${selection.lookupKey}`;
    const cached = lookupCache.get(requestKey);
    if (cached) return cached;

    const params = new URLSearchParams({
        date: auditDate,
        shift: auditShift,
        line: selection.line,
        position: selection.position,
        side: selection.side,
    });
    const request = fetch(`${import.meta.env.VITE_API_URL}/bus-ribbon-pull-strength-reports/lookup?${params}`)
        .then(async response => {
            if (!response.ok) throw new Error(`Pull Strength lookup failed: ${response.status}`);
            const payload = await response.json();
            return payload?.data as LookupData;
        })
        .catch(error => {
            lookupCache.delete(requestKey);
            throw error;
        });

    lookupCache.set(requestKey, request);
    return request;
};

export default function BusRibbonAuditPeelStrengthInput(props: ObservationRenderProps) {
    const lineOptions = props.lineOptions?.length ? props.lineOptions : ['Line-1', 'Line-2', 'Line-3'];
    const auditDate = props.auditDate?.trim() || '';
    const auditShift = props.auditShift?.trim() || '';
    const sampleValue = useMemo(
        () => normalizeRecordValue(props.value, lineOptions),
        [props.value, lineOptions]
    );
    const latestValueRef = useRef(sampleValue);
    const appliedLookupKeyRef = useRef<Record<string, string>>({});
    const [lookupStatus, setLookupStatus] = useState<Record<string, LookupStatus>>({});

    useEffect(() => {
        latestValueRef.current = sampleValue;
    }, [sampleValue]);

    const selections = useMemo(() => lineOptions.map(sectionKey => {
        const line = normalizeOptionNumber(sampleValue[`${sectionKey}-Line`] || '');
        const position = normalizeOptionNumber(sampleValue[`${sectionKey}-Position`] || '');
        const side = sampleValue[`${sectionKey}-Side`] || '';
        return {
            sectionKey,
            line,
            position,
            side,
            lookupKey: `${sectionKey}|${line}|${position}|${side}`,
        };
    }), [lineOptions, sampleValue]);

    const selectionSignature = useMemo(
        () => JSON.stringify({ auditDate, auditShift, selections }),
        [auditDate, auditShift, selections]
    );

    useEffect(() => {
        if (!auditDate || !auditShift) return;

        const pendingSelections = selections.filter(selection =>
            selection.line
            && selection.position
            && selection.side
            && selection.side !== 'OFF'
            && appliedLookupKeyRef.current[selection.sectionKey] !== selection.lookupKey
        );
        if (!pendingSelections.length) return;

        pendingSelections.forEach(selection => {
            appliedLookupKeyRef.current[selection.sectionKey] = selection.lookupKey;
        });

        setLookupStatus(previous => {
            const next = { ...previous };
            pendingSelections.forEach(selection => {
                next[selection.sectionKey] = { loading: true, message: 'Fetching Pull Strength Test data...' };
            });
            return next;
        });

        let cancelled = false;
        Promise.all(
            pendingSelections.map(selection =>
                fetchLookupData(selection, auditDate, auditShift)
                    .then(data => ({ selection, data, error: false }))
                    .catch(() => ({ selection, data: null, error: true }))
            )
        ).then(results => {
            if (cancelled) return;

            let shouldUpdate = false;
            const nextValue = { ...latestValueRef.current };
            const nextStatus: Record<string, LookupStatus> = {};

            results.forEach(({ selection, data, error }) => {
                appliedLookupKeyRef.current[selection.sectionKey] = selection.lookupKey;
                if (error) {
                    nextStatus[selection.sectionKey] = {
                        loading: false,
                        message: 'Unable to fetch Pull Strength Test data.',
                    };
                    return;
                }

                if (data?.found) {
                    const measurements = data.measurements || [];
                    for (let index = 1; index <= AUDIT_FIELD_COUNT; index += 1) {
                        const blockIndex = Math.floor((index - 1) / AUDIT_BLOCK_SIZE);
                        const blockPosition = ((index - 1) % AUDIT_BLOCK_SIZE) + 1;
                        const sourceIndex = (blockIndex * SOURCE_BLOCK_SIZE) + blockPosition - 1;
                        nextValue[`${selection.sectionKey}-Pos${index}`] = blockPosition <= SOURCE_BLOCK_SIZE
                            ? String(measurements[sourceIndex] || '')
                            : 'OFF';
                    }
                    nextStatus[selection.sectionKey] = {
                        loading: false,
                        message: 'Pull Strength Test data fetched.',
                    };
                    shouldUpdate = true;
                } else {
                    for (let index = 1; index <= AUDIT_FIELD_COUNT; index += 1) {
                        nextValue[`${selection.sectionKey}-Pos${index}`] = '';
                    }
                    nextStatus[selection.sectionKey] = {
                        loading: false,
                        message: 'No matching Pull Strength Test data found for the selected Date / Shift / Line / Position / Side.',
                    };
                    shouldUpdate = true;
                }
            });

            setLookupStatus(previous => ({ ...previous, ...nextStatus }));
            if (shouldUpdate) {
                props.onUpdate(props.stageId, props.paramId, props.timeSlot, nextValue as ObservationValue);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [auditDate, auditShift, props, selectionSignature, selections]);

    const updateField = (sectionKey: string, field: string, value: string) => {
        if (field === 'Line' || field === 'Position' || field === 'Side') {
            delete appliedLookupKeyRef.current[sectionKey];
            setLookupStatus(previous => {
                const next = { ...previous };
                delete next[sectionKey];
                return next;
            });
        }
        props.onUpdate(props.stageId, props.paramId, props.timeSlot, {
            ...sampleValue,
            [`${sectionKey}-${field}`]: value,
        } as ObservationValue);
    };

    const renderSelect = (
        value: string,
        onChange: (value: string) => void,
        options: { value: string; label: string }[]
    ) => (
        <select
            value={value}
            onChange={event => onChange(event.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    );

    return (
        <div className="flex flex-col gap-4">
            {lineOptions.map(sectionKey => {
                const status = lookupStatus[sectionKey];
                return (
                    <div key={sectionKey} className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
                        <div className="text-center mb-2">
                            <span className="text-sm font-semibold text-gray-700">Auto Bussing - {getSectionNumber(sectionKey)}</span>
                        </div>
                        <div className="flex gap-2 justify-between mb-2">
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Line</span>
                                {renderSelect(
                                    normalizeOptionNumber(sampleValue[`${sectionKey}-Line`] || ''),
                                    value => updateField(sectionKey, 'Line', value),
                                    LINE_OPTIONS.map(value => ({ value, label: value }))
                                )}
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Position</span>
                                {renderSelect(
                                    normalizeOptionNumber(sampleValue[`${sectionKey}-Position`] || ''),
                                    value => updateField(sectionKey, 'Position', value),
                                    POSITION_OPTIONS.map(value => ({ value, label: value }))
                                )}
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Side</span>
                                {renderSelect(
                                    sampleValue[`${sectionKey}-Side`] || '',
                                    value => updateField(sectionKey, 'Side', value),
                                    SIDE_OPTIONS
                                )}
                            </div>
                        </div>
                        {status?.message && (
                            <p className={`mb-2 text-center text-xs ${status.loading ? 'text-gray-500' : 'text-gray-600'}`}>
                                {status.message}
                            </p>
                        )}
                        <div className="grid grid-cols-10 gap-2">
                            {Array.from({ length: AUDIT_FIELD_COUNT }, (_, index) => ({
                                displayPosition: index < 20 ? index + 1 : index - 19,
                                storagePosition: index + 1,
                            })).map(({ displayPosition, storagePosition }) => (
                                <div key={storagePosition} className="flex flex-col items-center">
                                    <span className="text-xs text-gray-500 mb-1">Pos {displayPosition}</span>
                                    <input
                                        type="text"
                                        value={sampleValue[`${sectionKey}-Pos${storagePosition}`] || ''}
                                        onChange={event => updateField(sectionKey, `Pos${storagePosition}`, event.target.value)}
                                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-center bg-white w-full"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
