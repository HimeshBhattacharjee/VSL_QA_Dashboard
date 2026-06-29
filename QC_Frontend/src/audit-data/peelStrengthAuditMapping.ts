export const PEEL_STRENGTH_OFF_VALUE = 'OFF';
export const PEEL_STRENGTH_FIELD_COUNT = 20;
export const PEEL_STRENGTH_FETCHED_FIELD_COUNT = 16;

export const PEEL_STRENGTH_UNIT_OPTIONS = [
    { value: 'A', label: 'Unit-A' },
    { value: 'B', label: 'Unit-B' },
    { value: PEEL_STRENGTH_OFF_VALUE, label: PEEL_STRENGTH_OFF_VALUE },
] as const;

export const PEEL_STRENGTH_SIDE_CONFIGS = [
    {
        label: 'Front Side',
        titleClassName: 'text-brand-primary',
        unitKey: 'frontUnit',
        sideKey: 'frontSide',
    },
    {
        label: 'Back Side',
        titleClassName: 'text-green-600',
        unitKey: 'backUnit',
        sideKey: 'backSide',
    },
] as const;

export type PeelStrengthUnitKey = typeof PEEL_STRENGTH_SIDE_CONFIGS[number]['unitKey'];
export type PeelStrengthSideKey = typeof PEEL_STRENGTH_SIDE_CONFIGS[number]['sideKey'];

export type PeelStrengthStringerValue = {
    frontUnit?: string;
    backUnit?: string;
    frontSide?: Record<string, string>;
    backSide?: Record<string, string>;
};

export type PeelStrengthValue = Record<string, PeelStrengthStringerValue>;

export type AuditPeelUnitData = Partial<Record<PeelStrengthSideKey, Record<string, string>>>;

export type AuditPeelDataset = {
    status: string;
    date: string;
    shift: string;
    count: number;
    record_count?: number;
    data: Record<string, Record<string, AuditPeelUnitData>>;
};

export const peelStrengthFieldKeys = Array.from(
    { length: PEEL_STRENGTH_FIELD_COUNT },
    (_, index) => String(index + 1)
);

export const peelStrengthFetchedFieldKeys = peelStrengthFieldKeys.slice(0, PEEL_STRENGTH_FETCHED_FIELD_COUNT);
export const peelStrengthOffOnlyFieldKeys = peelStrengthFieldKeys.slice(PEEL_STRENGTH_FETCHED_FIELD_COUNT);

export const normalizePeelStrengthUnit = (value: unknown) => {
    const rawValue = String(value || '').trim().toUpperCase();
    if (!rawValue) return '';
    return rawValue.replace(/^UNIT\s*-?\s*/, '');
};

export const isPeelStrengthOffUnit = (value: unknown) =>
    normalizePeelStrengthUnit(value) === PEEL_STRENGTH_OFF_VALUE;

export const createOffPeelStrengthSideValues = () =>
    peelStrengthFieldKeys.reduce<Record<string, string>>((values, key) => {
        values[key] = PEEL_STRENGTH_OFF_VALUE;
        return values;
    }, {});

export const buildPeelStrengthSideValues = (source?: Record<string, unknown>) =>
    peelStrengthFieldKeys.reduce<Record<string, string>>((values, key, index) => {
        if (index < PEEL_STRENGTH_FETCHED_FIELD_COUNT) {
            const sourceValue = source?.[key];
            values[key] = sourceValue === undefined || sourceValue === null || sourceValue === ''
                ? PEEL_STRENGTH_OFF_VALUE
                : String(sourceValue);
            return values;
        }

        values[key] = PEEL_STRENGTH_OFF_VALUE;
        return values;
    }, {});

export const hasSavedPeelStrengthValues = (sideValues?: Record<string, unknown>) =>
    Boolean(sideValues) && peelStrengthFetchedFieldKeys.every(key => {
        const value = sideValues?.[key];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });

export const withTrailingPeelStrengthOffValues = (sideValues?: Record<string, unknown>) => {
    const normalizedValues = { ...(sideValues || {}) } as Record<string, string>;
    peelStrengthOffOnlyFieldKeys.forEach(key => {
        normalizedValues[key] = PEEL_STRENGTH_OFF_VALUE;
    });
    return normalizedValues;
};

export const getAuditPeelUnitData = (
    dataset: AuditPeelDataset | null,
    stringerKey: string,
    unit: string
) => dataset?.data?.[stringerKey]?.[normalizePeelStrengthUnit(unit)];
