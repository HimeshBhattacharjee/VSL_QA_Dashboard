import { type ClipboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleDot,
    CircleOff,
    Clock,
    Moon,
    Save,
    Sun,
    Sunset,
    Trash2,
    X,
} from 'lucide-react';
import TestHeading from '../components/TestHeading';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

type Shift = 'A' | 'B' | 'C';
type FabOption = 'FAB-II Line-I' | 'FAB-II Line-II';
type LineLabel = 'Line - 1' | 'Line - 2' | 'Line - 3' | 'Line - 4';
type ReadingField = 'plusVe1' | 'plusVe2' | 'middle1' | 'middle2' | 'minusVe1' | 'minusVe2';

interface LineData {
    po: string;
    jbStatus: string;
    busRibbonStatus: string;
    busRibbonDimension: string;
    plusVe1: string;
    plusVe2: string;
    middle1: string;
    middle2: string;
    minusVe1: string;
    minusVe2: string;
    average: string;
    remarks: string;
}

interface Signatures {
    preparedBy: string;
    verifiedBy: string;
}

interface DailyEntry {
    _id?: string;
    date: string;
    testingDate: string;
    shift: Shift;
    fab: FabOption;
    lines: Partial<Record<LineLabel, LineData>>;
    signatures?: Signatures;
    [key: string]: unknown;
}

interface DateEntries {
    [date: string]: Partial<Record<FabOption, Partial<Record<Shift, DailyEntry>>>>;
}

interface MonthlyStats {
    totalDays: number;
    totalPossibleEntries: number;
    filledEntries: number;
    completionRate: number;
    shiftStats: Record<Shift, { filled: number }>;
}

const FAB_OPTIONS: FabOption[] = ['FAB-II Line-I', 'FAB-II Line-II'];
const SHIFT_OPTIONS: Shift[] = ['A', 'B', 'C'];
const FAB_LINE_MAP: Record<FabOption, LineLabel[]> = {
    'FAB-II Line-I': ['Line - 1', 'Line - 2'],
    'FAB-II Line-II': ['Line - 3', 'Line - 4'],
};
const DEFAULT_FAB: FabOption = 'FAB-II Line-I';
const STATUS_OPTIONS = ['Juren', 'Sunby', 'YourBest'];
const MIN_AVERAGE_N = 25;
const READING_GROUPS: Array<{ title: string; fields: Array<{ field: ReadingField; label: string }> }> = [
    { title: '(+Ve)', fields: [{ field: 'plusVe1', label: '+Ve 1' }, { field: 'plusVe2', label: '+Ve 2' }] },
    { title: 'Middle', fields: [{ field: 'middle1', label: 'Middle 1' }, { field: 'middle2', label: 'Middle 2' }] },
    { title: '(-Ve)', fields: [{ field: 'minusVe1', label: '-Ve 1' }, { field: 'minusVe2', label: '-Ve 2' }] },
];
const READING_FIELDS = READING_GROUPS.flatMap(group => group.fields.map(item => item.field));

const defaultMonthlyStats: MonthlyStats = {
    totalDays: 0,
    totalPossibleEntries: 0,
    filledEntries: 0,
    completionRate: 0,
    shiftStats: {
        A: { filled: 0 },
        B: { filled: 0 },
        C: { filled: 0 },
    },
};

const getEntryKey = (date: string, fab: FabOption, shift: Shift) => `${date}_${fab}_${shift}`;
const getTodayDate = () => new Date().toISOString().split('T')[0];
const normalizeDate = (dateStr: string) => dateStr ? dateStr.split('T')[0] : '';
const normalizeFab = (fab?: string): FabOption => fab === 'FAB-II Line-II' ? 'FAB-II Line-II' : 'FAB-II Line-I';
const isNumericInputText = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);
const hasReadingValueSeparator = (value: string) => /[\s,;]/.test(value);

const parseCompletedNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === '.') return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeNumericOnlyForSave = (value: string | number | null | undefined): number | null | string => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === '.') return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return trimmed;
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) return trimmed;
    return Number.isInteger(numericValue) ? numericValue : numericValue;
};

const parsePastedReadingValues = (value: string) => value
    .replace(/\u00a0/g, ' ')
    .trim()
    .split(/[\s,;]+/)
    .map(token => token.trim())
    .filter(token => token !== '' && isNumericInputText(token) && parseCompletedNumber(token) !== null);

const createEmptyLineData = (): LineData => ({
    po: '',
    jbStatus: '',
    busRibbonStatus: '',
    busRibbonDimension: '',
    plusVe1: '',
    plusVe2: '',
    middle1: '',
    middle2: '',
    minusVe1: '',
    minusVe2: '',
    average: '',
    remarks: '',
});

const createEmptyLines = (fab: FabOption): Partial<Record<LineLabel, LineData>> => FAB_LINE_MAP[fab].reduce((acc, lineLabel) => {
    acc[lineLabel] = createEmptyLineData();
    return acc;
}, {} as Partial<Record<LineLabel, LineData>>);

const createEmptyEntry = (date: string, fab: FabOption, shift: Shift): DailyEntry => ({
    date,
    testingDate: date,
    shift,
    fab,
    lines: createEmptyLines(fab),
    signatures: {
        preparedBy: '',
        verifiedBy: '',
    },
});

const valueToInputText = (value: unknown) => value === null || value === undefined ? '' : String(value);

const calculateLineAverage = (line: LineData | undefined) => {
    if (!line) return '';
    const numericValues = READING_FIELDS
        .map(field => parseCompletedNumber(line[field]))
        .filter((value): value is number => value !== null);
    if (numericValues.length === 0) return '';
    return (numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2);
};

const calculateLineRemarks = (average: string) => {
    const numericAverage = parseCompletedNumber(average);
    if (numericAverage === null) return '';
    return numericAverage >= MIN_AVERAGE_N ? 'OK' : 'NOT OK';
};

const withCalculatedLineFields = (line: LineData): LineData => {
    const average = calculateLineAverage(line);
    return {
        ...line,
        average,
        remarks: calculateLineRemarks(average),
    };
};

const normalizeLineData = (line?: Partial<LineData>): LineData => withCalculatedLineFields({
    ...createEmptyLineData(),
    ...(line || {}),
    plusVe1: valueToInputText(line?.plusVe1),
    plusVe2: valueToInputText(line?.plusVe2),
    middle1: valueToInputText(line?.middle1),
    middle2: valueToInputText(line?.middle2),
    minusVe1: valueToInputText(line?.minusVe1),
    minusVe2: valueToInputText(line?.minusVe2),
});

const normalizeEntry = (entry: DailyEntry): DailyEntry => {
    const date = normalizeDate(entry.date || entry.testingDate || getTodayDate());
    const fab = normalizeFab(entry.fab);
    const shift = SHIFT_OPTIONS.includes(entry.shift) ? entry.shift : 'A';
    const emptyEntry = createEmptyEntry(date, fab, shift);

    return {
        ...emptyEntry,
        ...entry,
        date,
        testingDate: normalizeDate(entry.testingDate || date),
        fab,
        shift,
        lines: FAB_LINE_MAP[fab].reduce((acc, lineLabel) => {
            acc[lineLabel] = normalizeLineData(entry.lines?.[lineLabel]);
            return acc;
        }, {} as Partial<Record<LineLabel, LineData>>),
        signatures: {
            preparedBy: entry.signatures?.preparedBy || '',
            verifiedBy: entry.signatures?.verifiedBy || '',
        },
    };
};

const hasLineData = (line?: LineData) => {
    if (!line) return false;
    return Boolean(
        line.po.trim()
        || line.jbStatus.trim()
        || line.busRibbonStatus.trim()
        || line.busRibbonDimension.trim()
        || READING_FIELDS.some(field => line[field].trim() !== ''),
    );
};

const hasEntryData = (entry?: DailyEntry) => {
    if (!entry) return false;
    return FAB_LINE_MAP[entry.fab].some(lineLabel => hasLineData(entry.lines[lineLabel]));
};

const getLinePayload = (line: LineData) => {
    const average = calculateLineAverage(line);
    return {
        po: line.po.trim(),
        jbStatus: line.jbStatus.trim(),
        busRibbonStatus: line.busRibbonStatus.trim(),
        busRibbonDimension: line.busRibbonDimension.trim(),
        plusVe1: normalizeNumericOnlyForSave(line.plusVe1),
        plusVe2: normalizeNumericOnlyForSave(line.plusVe2),
        middle1: normalizeNumericOnlyForSave(line.middle1),
        middle2: normalizeNumericOnlyForSave(line.middle2),
        minusVe1: normalizeNumericOnlyForSave(line.minusVe1),
        minusVe2: normalizeNumericOnlyForSave(line.minusVe2),
        average: normalizeNumericOnlyForSave(average),
        remarks: calculateLineRemarks(average),
    };
};

const buildEntryPayload = (entry: DailyEntry) => ({
    ...entry,
    lines: FAB_LINE_MAP[entry.fab].reduce((acc, lineLabel) => {
        acc[lineLabel] = getLinePayload(entry.lines[lineLabel] || createEmptyLineData());
        return acc;
    }, {} as Record<LineLabel, ReturnType<typeof getLinePayload>>),
});

export default function PeelStrengthBusRibbonJBSolderingTest() {
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedFab, setSelectedFab] = useState<FabOption>(DEFAULT_FAB);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [shiftSelectorFab, setShiftSelectorFab] = useState<FabOption | null>(null);
    const [showExportFabSelector, setShowExportFabSelector] = useState(false);
    const [selectedExportFab, setSelectedExportFab] = useState<FabOption>(DEFAULT_FAB);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [dateSignatures, setDateSignatures] = useState<Record<string, Signatures>>({});
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);
    const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/peel-strength-bus-ribbon-jb-soldering-reports`;
    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ], []);
    const years = useMemo(() => Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index), [currentDate]);

    useEffect(() => {
        setUserRole(sessionStorage.getItem('userRole'));
        setUsername(sessionStorage.getItem('username'));
    }, []);

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            const [entriesResponse, statsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`),
                fetch(`${API_BASE_URL}/stats/monthly?year=${year}&month=${month}`),
            ]);
            const entriesJson = await entriesResponse.json();
            const statsJson = await statsResponse.json();
            const entriesArr: DailyEntry[] = Array.isArray(entriesJson?.data) ? entriesJson.data.map(normalizeEntry) : [];
            const entriesMap = new Map<string, DailyEntry>();
            const nextDateEntries: DateEntries = {};
            const nextSignatures: Record<string, Signatures> = entriesJson?.date_signatures || {};

            entriesArr.forEach(entry => {
                const entryKey = getEntryKey(entry.date, entry.fab, entry.shift);
                const signature = nextSignatures[entryKey] || entry.signatures || { preparedBy: '', verifiedBy: '' };
                const entryWithSignature = { ...entry, signatures: signature };
                entriesMap.set(entryKey, entryWithSignature);
                nextDateEntries[entry.date] = {
                    ...(nextDateEntries[entry.date] || {}),
                    [entry.fab]: {
                        ...(nextDateEntries[entry.date]?.[entry.fab] || {}),
                        [entry.shift]: entryWithSignature,
                    },
                };
            });

            setMonthlyEntries(entriesMap);
            setDateEntries(nextDateEntries);
            setDateSignatures(nextSignatures);
            setMonthlyStats(statsJson?.data || defaultMonthlyStats);
        } catch (error) {
            console.error('Error loading monthly data:', error);
            showAlert('error', 'Failed to load monthly entries');
            setMonthlyStats(defaultMonthlyStats);
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, showAlert]);

    useEffect(() => {
        loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
    }, [currentDate, loadMonthlyData]);

    const resetSelection = useCallback(() => {
        setSelectedDate('');
        setSelectedFab(DEFAULT_FAB);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorFab(null);
        setReadingErrors({});
    }, []);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        resetSelection();
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        resetSelection();
    };

    const handleMonthChange = (monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        resetSelection();
    };

    const handleYearChange = (year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        resetSelection();
    };

    const handleDateSelect = (date: string) => {
        setSelectedDate(normalizeDate(date));
        setSelectedFab(DEFAULT_FAB);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShiftSelectorFab(null);
        setShowShiftSelector(true);
    };

    const handleTodayEntry = () => {
        const today = getTodayDate();
        const todayDate = new Date(today);
        if (todayDate.getMonth() === currentDate.getMonth() && todayDate.getFullYear() === currentDate.getFullYear()) {
            handleDateSelect(today);
        } else {
            setCurrentDate(new Date());
            resetSelection();
        }
    };

    const handleShiftSelect = (fab: FabOption, shift: Shift) => {
        setSelectedFab(fab);
        setSelectedShift(shift);
        setShowShiftSelector(false);
        setShiftSelectorFab(null);
        const entry = monthlyEntries.get(getEntryKey(selectedDate, fab, shift));
        if (entry) {
            setCurrentEntry(normalizeEntry(entry));
            setIsEditing(true);
        } else {
            setCurrentEntry(createEmptyEntry(selectedDate, fab, shift));
            setIsEditing(false);
        }
        setReadingErrors({});
    };

    const updateCurrentEntry = (updater: (entry: DailyEntry) => DailyEntry) => {
        setCurrentEntry(prev => prev ? updater(prev) : prev);
    };

    const handleLineFieldChange = (lineLabel: LineLabel, field: keyof Pick<LineData, 'po' | 'jbStatus' | 'busRibbonStatus' | 'busRibbonDimension'>, value: string) => {
        updateCurrentEntry(entry => {
            const currentLine = entry.lines[lineLabel] || createEmptyLineData();
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: withCalculatedLineFields({
                        ...currentLine,
                        [field]: value,
                    }),
                },
            };
        });
    };

    const applyReadingValues = (lineLabel: LineLabel, startIndex: number, values: string[]) => {
        const valuesToApply = values.slice(0, READING_FIELDS.length - startIndex);
        if (valuesToApply.length === 0) return;

        setReadingErrors(prev => {
            const next = { ...prev };
            valuesToApply.forEach((_, offset) => {
                delete next[`${lineLabel}-${READING_FIELDS[startIndex + offset]}`];
            });
            return next;
        });

        updateCurrentEntry(entry => {
            const currentLine = entry.lines[lineLabel] || createEmptyLineData();
            const nextLine = { ...currentLine };
            valuesToApply.forEach((value, offset) => {
                nextLine[READING_FIELDS[startIndex + offset]] = value;
            });
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: withCalculatedLineFields(nextLine),
                },
            };
        });
    };

    const handleReadingChange = (lineLabel: LineLabel, field: ReadingField, value: string) => {
        const fieldIndex = READING_FIELDS.indexOf(field);
        if (hasReadingValueSeparator(value)) {
            const pastedValues = parsePastedReadingValues(value);
            if (pastedValues.length > 0) {
                applyReadingValues(lineLabel, fieldIndex, pastedValues);
                return;
            }
        }

        const errorKey = `${lineLabel}-${field}`;
        if (!isNumericInputText(value)) {
            setReadingErrors(prev => ({ ...prev, [errorKey]: 'Enter a valid number' }));
            return;
        }
        setReadingErrors(prev => {
            if (!prev[errorKey]) return prev;
            const next = { ...prev };
            delete next[errorKey];
            return next;
        });
        updateCurrentEntry(entry => {
            const currentLine = entry.lines[lineLabel] || createEmptyLineData();
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: withCalculatedLineFields({
                        ...currentLine,
                        [field]: value,
                    }),
                },
            };
        });
    };

    const handleReadingPaste = (lineLabel: LineLabel, field: ReadingField, event: ClipboardEvent<HTMLInputElement>) => {
        const pastedText = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text');
        const pastedValues = parsePastedReadingValues(pastedText);
        if (pastedValues.length === 0) return;

        event.preventDefault();
        applyReadingValues(lineLabel, READING_FIELDS.indexOf(field), pastedValues);
    };

    const validateEntry = () => {
        if (!currentEntry) return false;
        for (const lineLabel of FAB_LINE_MAP[currentEntry.fab]) {
            const line = currentEntry.lines[lineLabel] || createEmptyLineData();
            for (const field of READING_FIELDS) {
                const value = line[field];
                if (value && parseCompletedNumber(value) === null) {
                    showAlert('error', `${lineLabel} ${field} must be a valid number`);
                    return false;
                }
            }
        }
        return true;
    };

    const refreshStats = async () => {
        const statsResponse = await fetch(`${API_BASE_URL}/stats/monthly?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
        const statsJson = await statsResponse.json();
        if (statsJson?.data) setMonthlyStats(statsJson.data);
    };

    const handleSaveEntry = async () => {
        if (!currentEntry) {
            showAlert('error', 'Please select a date, FAB line, and shift');
            return;
        }
        if (!validateEntry()) return;

        setIsLoading(true);
        try {
            const payload = buildEntryPayload(currentEntry);
            const response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save entry');
            }
            const result = await response.json();
            const saved = normalizeEntry(result.data.entry as DailyEntry);
            const entryKey = getEntryKey(saved.date, saved.fab, saved.shift);
            setMonthlyEntries(prev => new Map(prev).set(entryKey, saved));
            setDateEntries(prev => ({
                ...prev,
                [saved.date]: {
                    ...prev[saved.date],
                    [saved.fab]: {
                        ...(prev[saved.date]?.[saved.fab] || {}),
                        [saved.shift]: saved,
                    },
                },
            }));
            setCurrentEntry(saved);
            setIsEditing(true);
            await refreshStats();
            showAlert('success', result.message || 'Entry saved successfully');
        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEntry = () => {
        if (!currentEntry) return;
        showConfirm({
            title: 'Delete Entry',
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} (${currentEntry.fab}, Shift ${currentEntry.shift})?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/entries/${currentEntry.date}/${encodeURIComponent(currentEntry.fab)}/${currentEntry.shift}`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) throw new Error('Failed to delete entry');
                    const entryKey = getEntryKey(currentEntry.date, currentEntry.fab, currentEntry.shift);
                    setMonthlyEntries(prev => {
                        const next = new Map(prev);
                        next.delete(entryKey);
                        return next;
                    });
                    setDateEntries(prev => {
                        const next = { ...prev };
                        delete next[currentEntry.date]?.[currentEntry.fab]?.[currentEntry.shift];
                        return next;
                    });
                    setCurrentEntry(null);
                    setSelectedDate('');
                    setSelectedShift(null);
                    showAlert('info', 'Entry deleted successfully');
                    await loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            },
        });
    };

    const handleSignatureUpdate = async (type: 'prepared' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        if (!currentEntry) {
            showAlert('error', 'Please select an entry first');
            return;
        }

        const field = type === 'prepared' ? 'preparedBy' : 'verifiedBy';
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.fab, currentEntry.shift);
        const currentSignatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
        const nextSignatures = { ...currentSignatures };

        if (nextSignatures[field]) {
            if (nextSignatures[field] !== username) {
                showAlert('error', 'You can only remove your own signature');
                return;
            }
            nextSignatures[field] = '';
        } else {
            if (type === 'prepared' && userRole !== 'Operator') {
                showAlert('error', 'Only Operators can sign as Prepared By');
                return;
            }
            if (type === 'verified' && !['Manager', 'Supervisor'].includes(userRole || '')) {
                showAlert('error', 'Only Managers or Supervisors can sign as Verified By');
                return;
            }
            nextSignatures[field] = username;
        }

        setDateSignatures(prev => ({ ...prev, [signatureKey]: nextSignatures }));
        setCurrentEntry(prev => prev ? { ...prev, signatures: nextSignatures } : prev);
        try {
            const response = await fetch(`${API_BASE_URL}/signatures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: currentEntry.date,
                    fab: currentEntry.fab,
                    shift: currentEntry.shift,
                    signatures: nextSignatures,
                }),
            });
            if (!response.ok) throw new Error('Failed to update signature');
            showAlert('success', 'Signature updated successfully');
        } catch (error) {
            console.error('Error updating signature:', error);
            showAlert('error', 'Failed to update signature');
        }
    };

    const handleExportMonthlyExcel = async (fab: FabOption = selectedExportFab) => {
        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const monthlyResponse = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResponse.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResponse.json();
            const entries = (Array.isArray(monthlyJson?.data) ? monthlyJson.data : [])
                .map((entry: DailyEntry) => normalizeEntry(entry))
                .filter((entry: DailyEntry) => entry.fab === fab)
                .map(buildEntryPayload);
            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries, fab, year, month }),
            });
            if (!response.ok) throw new Error('Failed to generate Excel report');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Peel_Strength_Bus_Ribbon_JB_Soldering_${fab}_${months[currentDate.getMonth()]}_${year}.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(anchor);
            showAlert('success', 'Excel report generated successfully');
        } catch (error) {
            console.error('Error generating Excel:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to generate Excel report');
        } finally {
            setIsLoading(false);
        }
    };

    const getShiftIcon = (shift: Shift) => {
        if (shift === 'A') return <Sun className="h-3 w-3 text-amber-500" />;
        if (shift === 'B') return <Sunset className="h-3 w-3 text-orange-500" />;
        return <Moon className="h-3 w-3 text-indigo-500" />;
    };

    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = getTodayDate();
        const days = [];

        for (let index = 0; index < firstDay; index += 1) {
            days.push(<div key={`empty-${index}`} className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEntries = dateEntries[dateStr] || {};
            const isSelected = selectedDate === dateStr;
            const isToday = todayStr === dateStr;
            const hasAny = Object.values(dayEntries)
                .flatMap(group => Object.values(group || {}))
                .some(entry => hasEntryData(entry as DailyEntry) || entry?.signatures?.preparedBy || entry?.signatures?.verifiedBy);

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`relative min-h-[96px] rounded-lg border-2 p-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-brand-primary ring-2 ring-brand-primary' : hasAny ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'} ${isToday ? 'font-bold' : ''}`}
                >
                    <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm dark:text-white">{day}</span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                        {SHIFT_OPTIONS.map(shift => {
                            const entry = dateEntries[dateStr]?.[selectedFab]?.[shift];
                            return (
                                <div key={shift} className="flex items-center gap-1 text-xs">
                                    {getShiftIcon(shift)}
                                    {hasEntryData(entry) ? (
                                        <CircleDot className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <CircleOff className="h-3 w-3 text-gray-400" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </button>,
            );
        }
        return days;
    };

    const renderSignatureSection = () => {
        if (!currentEntry) return null;
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.fab, currentEntry.shift);
        const signatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
        const canSignPrepared = userRole === 'Operator' && !signatures.preparedBy;
        const canSignVerified = ['Manager', 'Supervisor'].includes(userRole || '') && !signatures.verifiedBy;
        const canRemovePrepared = signatures.preparedBy === username;
        const canRemoveVerified = signatures.verifiedBy === username;

        return (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 text-md font-semibold dark:text-white">
                    Signatures for {currentEntry.date} - {currentEntry.fab} Shift {currentEntry.shift}
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">Prepared By</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={signatures.preparedBy || ''}
                                readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="Not signed"
                            />
                            {(canSignPrepared || canRemovePrepared) && (
                                <button
                                    onClick={() => handleSignatureUpdate('prepared')}
                                    className={`rounded-lg p-2 text-white ${canRemovePrepared ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                                >
                                    {canRemovePrepared ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">Verified By</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={signatures.verifiedBy || ''}
                                readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="Not signed"
                            />
                            {(canSignVerified || canRemoveVerified) && (
                                <button
                                    onClick={() => handleSignatureUpdate('verified')}
                                    className={`rounded-lg p-2 text-white ${canRemoveVerified ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                                >
                                    {canRemoveVerified ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderReadingInput = (lineLabel: LineLabel, field: ReadingField, label: string) => {
        const line = currentEntry?.lines[lineLabel] || createEmptyLineData();
        const errorKey = `${lineLabel}-${field}`;
        const hasError = Boolean(readingErrors[errorKey]);
        const inputStateClass = hasError
            ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-300'
            : 'border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

        return (
            <div key={field} className="min-w-0">
                <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={line[field]}
                    onChange={(event) => handleReadingChange(lineLabel, field, event.target.value)}
                    onPaste={(event) => handleReadingPaste(lineLabel, field, event)}
                    className={`w-full rounded-md border px-2 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary ${inputStateClass}`}
                    placeholder="0"
                />
            </div>
        );
    };

    const renderLineSection = (lineLabel: LineLabel) => {
        if (!currentEntry) return null;
        const line = currentEntry.lines[lineLabel] || createEmptyLineData();
        const average = calculateLineAverage(line);
        const remarks = calculateLineRemarks(average);
        const remarksClass = remarks === 'OK'
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
            : remarks === 'NOT OK'
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                : 'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400';

        return (
            <section key={lineLabel} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-white">{lineLabel}</h4>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">PO</label>
                        <input
                            type="text"
                            value={line.po}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'po', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            placeholder="Enter PO"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">JB Status</label>
                        <select
                            value={line.jbStatus}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'jbStatus', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            <option value="">Select</option>
                            {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Bus Ribbon Status</label>
                        <select
                            value={line.busRibbonStatus}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'busRibbonStatus', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            <option value="">Select</option>
                            {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Bus Ribbon Dimension</label>
                        <input
                            type="text"
                            value={line.busRibbonDimension}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'busRibbonDimension', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            placeholder="Enter dimension"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {READING_GROUPS.map(group => (
                        <div key={group.title}>
                            <h5 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{group.title}</h5>
                            <div className="grid grid-cols-2 gap-2">
                                {group.fields.map(item => renderReadingInput(lineLabel, item.field, item.label))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Average</label>
                        <input
                            type="text"
                            value={average}
                            readOnly
                            className="w-full rounded-lg border border-gray-200 bg-gray-100 p-2.5 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            placeholder="-"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Remarks</label>
                        <input
                            type="text"
                            value={remarks}
                            readOnly
                            className={`w-full rounded-lg border p-2.5 text-xs font-semibold ${remarksClass}`}
                            placeholder="-"
                        />
                    </div>
                </div>
            </section>
        );
    };

    return (
        <div className="mx-auto">
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-brand-primary"></div>
                        <p className="mt-3 text-gray-700 dark:text-gray-300">Loading...</p>
                    </div>
                </div>
            )}

            {showExportFabSelector && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold dark:text-white">Select FAB Line</h3>
                            <button onClick={() => setShowExportFabSelector(false)} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <X className="h-5 w-5 dark:text-white" />
                            </button>
                        </div>
                        <select
                            value={selectedExportFab}
                            onChange={(event) => setSelectedExportFab(event.target.value as FabOption)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                            {FAB_OPTIONS.map(fab => <option key={fab} value={fab}>{fab}</option>)}
                        </select>
                        <div className="mt-5 flex justify-end gap-3">
                            <button onClick={() => setShowExportFabSelector(false)} className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowExportFabSelector(false);
                                    handleExportMonthlyExcel(selectedExportFab);
                                }}
                                className="rounded-lg bg-brand-primary px-4 py-2 text-white hover:bg-brand-primary-hover"
                            >
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showShiftSelector && selectedDate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold dark:text-white">
                                {shiftSelectorFab ? `Select Shift for ${selectedDate}` : `Select FAB Line for ${selectedDate}`}
                            </h3>
                            <button onClick={resetSelection} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <X className="h-5 w-5 dark:text-white" />
                            </button>
                        </div>

                        {!shiftSelectorFab ? (
                            <div className="space-y-3">
                                {FAB_OPTIONS.map(fab => {
                                    const fabEntries = dateEntries[selectedDate]?.[fab] || {};
                                    const filledCount = SHIFT_OPTIONS.filter(shift => !!fabEntries[shift]).length;
                                    return (
                                        <button
                                            key={fab}
                                            onClick={() => {
                                                setSelectedFab(fab);
                                                setShiftSelectorFab(fab);
                                            }}
                                            className="flex w-full items-center justify-between rounded-lg border-2 border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-primary-soft dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10"
                                        >
                                            <span className="font-semibold text-gray-900 dark:text-white">{fab}</span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">{filledCount} / 3 shifts</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                <button
                                    onClick={() => setShiftSelectorFab(null)}
                                    className="mb-4 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-brand-primary hover:bg-brand-primary-soft dark:text-brand-primary-light dark:hover:bg-brand-primary/10"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    {shiftSelectorFab}
                                </button>
                                <div className="space-y-3">
                                    {SHIFT_OPTIONS.map(shift => {
                                        const entry = dateEntries[selectedDate]?.[shiftSelectorFab]?.[shift];
                                        const firstPo = FAB_LINE_MAP[shiftSelectorFab]
                                            .map(lineLabel => entry?.lines?.[lineLabel]?.po)
                                            .find(Boolean);
                                        const isFilled = !!entry;
                                        return (
                                            <button
                                                key={shift}
                                                onClick={() => handleShiftSelect(shiftSelectorFab, shift)}
                                                className={`flex w-full items-center gap-3 rounded-lg border-2 p-4 transition-all ${isFilled ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`}
                                            >
                                                <div className="shrink-0">{getShiftIcon(shift)}</div>
                                                <div className="grow text-left">
                                                    <div className="font-semibold dark:text-white">Shift {shift}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {isFilled ? `PO: ${firstPo || '-'}` : 'No entry yet'}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <TestHeading
                heading="Peel Strength of Bus Ribbon to JB Soldering Test Report"
                criteria="Allowable Limit >= 25N"
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-7">
                    <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                        <div className="mb-6 flex flex-col items-center justify-between gap-4 xl:flex-row">
                            <div className="flex items-center gap-1">
                                <button onClick={handlePrevMonth} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <ChevronLeft className="h-5 w-5 dark:text-white" />
                                </button>
                                <div className="flex gap-2">
                                    <select
                                        value={currentDate.getMonth()}
                                        onChange={(event) => handleMonthChange(Number(event.target.value))}
                                        className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    >
                                        {months.map((month, index) => <option key={month} value={index}>{month}</option>)}
                                    </select>
                                    <select
                                        value={currentDate.getFullYear()}
                                        onChange={(event) => handleYearChange(Number(event.target.value))}
                                        className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    >
                                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleNextMonth} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <ChevronRight className="h-5 w-5 dark:text-white" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleTodayEntry}
                                    className="rounded-lg bg-brand-primary-soft px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary-muted dark:bg-brand-primary/10 dark:text-brand-primary-light"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setShowExportFabSelector(true)}
                                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700"
                                >
                                    <img
                                        src="/IMAGES/Excel.svg"
                                        alt="Excel"
                                        className="h-6 w-6 brightness-0 invert"
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="mb-2 grid grid-cols-7 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-2">{renderCalendarDays()}</div>
                    </div>

                    {currentEntry && selectedShift && (
                        <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold dark:text-white">
                                    {isEditing ? 'Edit Entry' : 'New Entry'} - {currentEntry.testingDate} ({currentEntry.fab}, Shift {currentEntry.shift})
                                </h3>
                                <div className="flex gap-2">
                                    {isEditing && (
                                        <button onClick={handleDeleteEntry} className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={resetSelection} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {FAB_LINE_MAP[currentEntry.fab].map(renderLineSection)}
                            </div>

                            {renderSignatureSection()}

                            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                                <button onClick={resetSelection} className="rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                                    Cancel
                                </button>
                                <button onClick={handleSaveEntry} className="flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-2 text-white transition-colors hover:bg-brand-primary-hover">
                                    <Save className="h-4 w-4" />
                                    {isEditing ? 'Update Entry' : 'Save Entry'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6 lg:col-span-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-900">
                            <div className="mb-2 flex items-center justify-between">
                                <BarChart3 className="h-5 w-5 text-brand-primary" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Completion</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">{monthlyStats.completionRate}%</div>
                            <div className="mt-1 text-xs text-gray-500">{monthlyStats.filledEntries} / {monthlyStats.totalPossibleEntries} entries</div>
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-900">
                            <div className="mb-2 flex items-center justify-between">
                                <Clock className="h-5 w-5 text-green-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Total Days</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">{monthlyStats.totalDays}</div>
                            <div className="mt-1 text-xs text-gray-500">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</div>
                        </div>
                    </div>
                    <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                        <h3 className="mb-4 flex items-center gap-2 text-md font-semibold dark:text-white">
                            <Clock className="h-4 w-4 text-brand-primary" />
                            Shift-wise Statistics
                        </h3>
                        <div className="space-y-4">
                            {SHIFT_OPTIONS.map(shift => {
                                const filled = monthlyStats.shiftStats?.[shift]?.filled || 0;
                                const total = monthlyStats.totalDays * 2;
                                return (
                                    <div key={shift} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getShiftIcon(shift)}
                                                <span className="font-medium dark:text-white">Shift {shift}</span>
                                            </div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{filled} / {total}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                            <div className="h-2 rounded-full bg-brand-primary transition-all" style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
