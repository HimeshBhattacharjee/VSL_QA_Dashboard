export type LineStatus = 'ON' | 'OFF';
export interface StatusLine { status?: LineStatus }

export const getLineStatus = (line?: StatusLine | null): LineStatus => line?.status === 'OFF' ? 'OFF' : 'ON';

const hasMeaningfulValue = (value: unknown, key = ''): boolean => {
    if (key === 'status' || key === 'line') return false;
    if (Array.isArray(value)) return value.some(item => hasMeaningfulValue(item));
    if (value && typeof value === 'object') return Object.entries(value).some(([childKey, child]) => hasMeaningfulValue(child, childKey));
    return value !== '' && value !== null && value !== undefined;
};

export const hasLineMeasurements = (line?: object | null) => hasMeaningfulValue(line);

const clearValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clearValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === 'line' ? child : clearValue(child)]));
    return '';
};

export const changeLineStatus = <T extends StatusLine>(line: T, status: LineStatus): T =>
    status === 'OFF' ? ({ status: 'OFF' } as T) : ({ ...(clearValue(line) as T), status: 'ON' });
