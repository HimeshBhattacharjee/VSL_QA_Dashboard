export type LineGroup = 'Line-I' | 'Line-II';

export const LINE_GROUPS: LineGroup[] = ['Line-I', 'Line-II'];
export const DEFAULT_LINE_GROUP: LineGroup = 'Line-I';

export interface MonthlyStats {
    totalDays: number;
    filledDays: number;
    completionRate: number;
    passCount: number;
    failCount: number;
}

export type MonthLineSignatureData<TSignature extends object> = {
    [year: string]: {
        [month: string]: {
            [line: string]: TSignature;
        };
    };
};

export const getLineGroupLabel = (lineGroup: LineGroup) => `FAB-II ${lineGroup}`;

export const normalizeLineGroup = (lineGroup?: unknown): LineGroup => {
    const value = String(lineGroup ?? '');
    return value.includes('Line-II') ? 'Line-II' : 'Line-I';
};

export const getLineEntryKey = (date: string, lineGroup: LineGroup) => `${date}_${lineGroup}`;

export const normalizeDateString = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const getMonthName = (monthKey: string, months: readonly string[]) => {
    const numericMonth = Number(monthKey);
    if (Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
        return months[numericMonth - 1];
    }

    if (/^\d{2}$/.test(monthKey)) {
        const monthIndex = Number(monthKey) - 1;
        if (monthIndex >= 0 && monthIndex < months.length) {
            return months[monthIndex];
        }
    }

    return monthKey;
};

const createSignatureFromValue = <TSignature extends object>(
    value: unknown,
    defaultSignature: TSignature
): TSignature => {
    const signatureValue = isRecord(value) ? value : {};
    const signature = { ...defaultSignature };

    (Object.keys(defaultSignature) as Array<keyof TSignature>).forEach((key) => {
        const fieldValue = signatureValue[String(key)];
        signature[key] = (typeof fieldValue === 'string' ? fieldValue : '') as TSignature[keyof TSignature];
    });

    return signature;
};

const hasSignatureFields = <TSignature extends object>(
    value: unknown,
    defaultSignature: TSignature
) => isRecord(value) && Object.keys(defaultSignature).some((key) => typeof value[key] === 'string');

const assignSignature = <TSignature extends object>(
    store: MonthLineSignatureData<TSignature>,
    year: string,
    month: string,
    lineGroup: LineGroup,
    signature: TSignature
) => {
    const lineLabel = getLineGroupLabel(lineGroup);
    store[year] = {
        ...(store[year] || {}),
        [month]: {
            ...(store[year]?.[month] || {}),
            [lineLabel]: signature
        }
    };
};

export const migrateMonthLineSignatures = <TSignature extends object>(
    rawValue: string | null,
    defaultSignature: TSignature,
    months: readonly string[]
): MonthLineSignatureData<TSignature> => {
    if (!rawValue) return {};

    try {
        const parsed: unknown = JSON.parse(rawValue);
        if (!isRecord(parsed)) return {};

        const migrated: MonthLineSignatureData<TSignature> = {};

        Object.entries(parsed).forEach(([yearOrFlatKey, yearValue]) => {
            const flatMatch = yearOrFlatKey.match(/^(\d{4})-(\d{2})(?:_(.+))?$/);

            if (flatMatch && hasSignatureFields(yearValue, defaultSignature)) {
                const [, year, monthNumber, lineKey] = flatMatch;
                assignSignature(
                    migrated,
                    year,
                    getMonthName(monthNumber, months),
                    normalizeLineGroup(lineKey),
                    createSignatureFromValue(yearValue, defaultSignature)
                );
                return;
            }

            if (!/^\d{4}$/.test(yearOrFlatKey) || !isRecord(yearValue)) {
                return;
            }

            Object.entries(yearValue).forEach(([monthKey, monthValue]) => {
                if (!isRecord(monthValue)) return;

                Object.entries(monthValue).forEach(([lineKey, signatureValue]) => {
                    if (!hasSignatureFields(signatureValue, defaultSignature)) return;

                    assignSignature(
                        migrated,
                        yearOrFlatKey,
                        getMonthName(monthKey, months),
                        normalizeLineGroup(lineKey),
                        createSignatureFromValue(signatureValue, defaultSignature)
                    );
                });
            });
        });

        return migrated;
    } catch (error) {
        console.error('Failed to migrate line-wise signatures:', error);
        return {};
    }
};

export const getMonthLineSignatures = <TSignature extends object>(
    signatures: MonthLineSignatureData<TSignature>,
    year: number,
    monthName: string,
    lineGroup: LineGroup,
    defaultSignature: TSignature
): TSignature => (
    signatures[String(year)]?.[monthName]?.[getLineGroupLabel(lineGroup)] || { ...defaultSignature }
);

export const setMonthLineSignatures = <TSignature extends object>(
    signatures: MonthLineSignatureData<TSignature>,
    year: number,
    monthName: string,
    lineGroup: LineGroup,
    signature: TSignature
): MonthLineSignatureData<TSignature> => {
    const yearKey = String(year);
    const lineLabel = getLineGroupLabel(lineGroup);

    return {
        ...signatures,
        [yearKey]: {
            ...(signatures[yearKey] || {}),
            [monthName]: {
                ...(signatures[yearKey]?.[monthName] || {}),
                [lineLabel]: signature
            }
        }
    };
};

export const buildLineWiseMonthlyStats = <TEntry>(
    entries: Iterable<TEntry>,
    daysInMonth: number,
    isPass: (entry: TEntry) => boolean,
    isFail: (entry: TEntry) => boolean
): MonthlyStats => {
    const entriesArray = Array.from(entries);
    const totalLineEntries = daysInMonth * LINE_GROUPS.length;
    const passCount = entriesArray.filter(isPass).length;
    const failCount = entriesArray.filter(isFail).length;
    const filledDays = entriesArray.length;

    return {
        totalDays: totalLineEntries,
        filledDays,
        completionRate: totalLineEntries > 0 ? Math.round((filledDays / totalLineEntries) * 100) : 0,
        passCount,
        failCount
    };
};
