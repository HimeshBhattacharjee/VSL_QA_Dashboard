type ShiftEntry = {
    shift?: string;
    submittedBy?: string;
    createdByEmployeeName?: string;
    createdBy?: string;
    signatures?: { preparedBy?: string };
};

const SHIFTS = ['A', 'B', 'C'] as const;

const snapshotName = (entry: ShiftEntry): string =>
    [entry.submittedBy, entry.signatures?.preparedBy, entry.createdByEmployeeName, entry.createdBy]
        .find(value => typeof value === 'string' && value.trim())?.trim() || '';

const formatShiftPreparedBy = (entries: ShiftEntry[], blank = '-'): string => {
    const names = new Map(SHIFTS.map(shift => [shift, [] as string[]]));
    const seen = new Map(SHIFTS.map(shift => [shift, new Set<string>()]));
    entries.forEach(entry => {
        const shift = entry.shift?.toUpperCase() as typeof SHIFTS[number];
        if (!names.has(shift)) return;
        const name = snapshotName(entry);
        const key = name.toLocaleLowerCase();
        if (name && !seen.get(shift)!.has(key)) {
            seen.get(shift)!.add(key);
            names.get(shift)!.push(name);
        }
    });
    return SHIFTS.map(shift => `${shift}: ${names.get(shift)!.join(', ') || blank}`).join('; ');
};

export default function ShiftPreparedBy({ entries }: { entries: ShiftEntry[] }) {
    return (
        <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
            <span className="font-semibold">Prepared By: </span>{formatShiftPreparedBy(entries)}
        </div>
    );
}
