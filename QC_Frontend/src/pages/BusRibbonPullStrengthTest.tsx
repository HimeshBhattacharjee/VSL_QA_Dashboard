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
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';

type Shift = 'A' | 'B' | 'C';
type LineOption = 'FAB-II Line-I' | 'FAB-II Line-II';
type BussingKey = 'autoBussing1' | 'autoBussing2' | 'autoBussing3' | 'autoBussing4' | 'autoBussing5';

interface ShiftDetails {
    poNumber: string;
    intcRibbonStatus: string;
    busRibbonStatus: string;
}

interface BussingData {
    position: string;
    strengths: string[];
}

interface BussingAverages {
    average1: string;
    average2: string;
}

interface Signatures {
    preparedBy: string;
    reviewedBy: string;
}

interface DailyEntry {
    _id?: string;
    date: string;
    testingDate: string;
    shift: Shift;
    line: LineOption;
    shiftDetails: ShiftDetails;
    bussingData: Record<BussingKey, BussingData>;
    averages?: Partial<Record<BussingKey, BussingAverages>>;
    signatures?: Signatures;
    [key: string]: any;
}

interface DateEntries {
    [date: string]: Partial<Record<LineOption, Partial<Record<Shift, DailyEntry>>>>;
}

interface MonthlyStats {
    totalDays: number;
    totalPossibleEntries: number;
    filledEntries: number;
    completionRate: number;
    shiftStats: Record<Shift, { filled: number }>;
}

const LINE_OPTIONS: LineOption[] = ['FAB-II Line-I', 'FAB-II Line-II'];
const SHIFT_OPTIONS: Shift[] = ['A', 'B', 'C'];
const POSITION_OPTIONS = [
    '1-TOP',
    '1-MIDDLE',
    '1-BOTTOM',
    '2-TOP',
    '2-MIDDLE',
    '2-BOTTOM',
    '3-TOP',
    '3-MIDDLE',
    '3-BOTTOM',
];
const BUSSING_LABELS: Record<BussingKey, string> = {
    autoBussing1: 'Auto Bussing 1',
    autoBussing2: 'Auto Bussing 2',
    autoBussing3: 'Auto Bussing 3',
    autoBussing4: 'Auto Bussing 4',
    autoBussing5: 'Auto Bussing 5',
};
const LINE_BUSSING_KEYS: Record<LineOption, BussingKey[]> = {
    'FAB-II Line-I': ['autoBussing1', 'autoBussing2', 'autoBussing3'],
    'FAB-II Line-II': ['autoBussing4', 'autoBussing5'],
};
const BUSSING_KEYS = Object.keys(BUSSING_LABELS) as BussingKey[];
const DEFAULT_LINE: LineOption = 'FAB-II Line-I';
const STRENGTH_MIN_LIMIT = 1.5;
const getDisplayedStrengthNumber = (index: number) => (index % 16) + 1;

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

const getEntryKey = (date: string, line: LineOption, shift: Shift) => `${date}_${line}_${shift}`;
const getTodayDate = () => new Date().toISOString().split('T')[0];
const normalizeDate = (dateStr: string) => dateStr ? dateStr.split('T')[0] : '';
const normalizeLine = (line?: string): LineOption => line === 'FAB-II Line-II' ? 'FAB-II Line-II' : 'FAB-II Line-I';
const isNumericInputText = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);
const parseCompletedNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.') return null;
    const numericValue = Number(trimmed);
    return Number.isNaN(numericValue) ? null : numericValue;
};
const isStrengthBelowLimit = (value: string) => {
    const numericValue = parseCompletedNumber(value);
    return numericValue !== null && numericValue < STRENGTH_MIN_LIMIT;
};
const hasStrengthValueSeparator = (value: string) => /[\s,;]/.test(value);
const parsePastedStrengthValues = (value: string) => value
    .replace(/\u00a0/g, ' ')
    .trim()
    .split(/[\s,;]+/)
    .map(token => token.trim())
    .filter(token => token !== '' && isNumericInputText(token) && parseCompletedNumber(token) !== null);

const createEmptyBussingData = (): BussingData => ({
    position: '',
    strengths: Array(32).fill(''),
});

const createEmptyBussingMap = (): Record<BussingKey, BussingData> => ({
    autoBussing1: createEmptyBussingData(),
    autoBussing2: createEmptyBussingData(),
    autoBussing3: createEmptyBussingData(),
    autoBussing4: createEmptyBussingData(),
    autoBussing5: createEmptyBussingData(),
});

const createEmptyEntry = (date: string, line: LineOption, shift: Shift): DailyEntry => ({
    date,
    testingDate: date,
    shift,
    line,
    shiftDetails: {
        poNumber: '',
        intcRibbonStatus: '',
        busRibbonStatus: '',
    },
    bussingData: createEmptyBussingMap(),
    averages: {},
    signatures: {
        preparedBy: '',
        reviewedBy: '',
    },
});

const normalizeEntry = (entry: DailyEntry): DailyEntry => {
    const date = normalizeDate(entry.date || entry.testingDate || getTodayDate());
    const line = normalizeLine(entry.line);
    const shift = SHIFT_OPTIONS.includes(entry.shift) ? entry.shift : 'A';
    const emptyEntry = createEmptyEntry(date, line, shift);

    return {
        ...emptyEntry,
        ...entry,
        date,
        testingDate: normalizeDate(entry.testingDate || date),
        line,
        shift,
        shiftDetails: {
            ...emptyEntry.shiftDetails,
            ...(entry.shiftDetails || {}),
        },
        bussingData: BUSSING_KEYS.reduce((acc, key) => {
            const existing = entry.bussingData?.[key];
            acc[key] = {
                position: existing?.position || '',
                strengths: Array.from({ length: 32 }, (_, index) => existing?.strengths?.[index] || ''),
            };
            return acc;
        }, {} as Record<BussingKey, BussingData>),
        signatures: {
            preparedBy: entry.signatures?.preparedBy || '',
            reviewedBy: entry.signatures?.reviewedBy || '',
        },
    };
};

const calculateAverage = (values: string[]) => {
    const numericValues = values
        .map(parseCompletedNumber)
        .filter((value): value is number => value !== null);
    if (numericValues.length === 0) return '';
    return (numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2);
};

const calculateAverages = (entry: DailyEntry | null) => {
    if (!entry) return {};
    return LINE_BUSSING_KEYS[entry.line].reduce((acc, key) => {
        const strengths = entry.bussingData[key]?.strengths || [];
        acc[key] = {
            average1: calculateAverage(strengths.slice(0, 16)),
            average2: calculateAverage(strengths.slice(16, 32)),
        };
        return acc;
    }, {} as Partial<Record<BussingKey, BussingAverages>>);
};

const hasAnyStrengthData = (entry?: DailyEntry) => {
    if (!entry) return false;
    return LINE_BUSSING_KEYS[entry.line].some(machineKey =>
        entry.bussingData[machineKey]?.strengths?.some(value => value.trim() !== ''),
    );
};

export default function BusRibbonPullStrengthTest() {
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedLine, setSelectedLine] = useState<LineOption>(DEFAULT_LINE);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [shiftSelectorLine, setShiftSelectorLine] = useState<LineOption | null>(null);
    const [showExportLineSelector, setShowExportLineSelector] = useState(false);
    const [selectedExportLine, setSelectedExportLine] = useState<LineOption>(DEFAULT_LINE);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [dateSignatures, setDateSignatures] = useState<Record<string, Signatures>>({});
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);
    const [strengthErrors, setStrengthErrors] = useState<Record<string, string>>({});
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/bus-ribbon-pull-strength-reports`;
    const currentAverages = useMemo(() => calculateAverages(currentEntry), [currentEntry]);
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
                const entryKey = getEntryKey(entry.date, entry.line, entry.shift);
                const signature = nextSignatures[entryKey] || entry.signatures || { preparedBy: '', reviewedBy: '' };
                const entryWithSignature = { ...entry, signatures: signature };
                entriesMap.set(entryKey, entryWithSignature);
                nextDateEntries[entry.date] = {
                    ...(nextDateEntries[entry.date] || {}),
                    [entry.line]: {
                        ...(nextDateEntries[entry.date]?.[entry.line] || {}),
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
        setSelectedLine(DEFAULT_LINE);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorLine(null);
        setStrengthErrors({});
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
        setSelectedLine(DEFAULT_LINE);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShiftSelectorLine(null);
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

    const handleShiftSelect = (line: LineOption, shift: Shift) => {
        setSelectedLine(line);
        setSelectedShift(shift);
        setShowShiftSelector(false);
        setShiftSelectorLine(null);
        const entry = monthlyEntries.get(getEntryKey(selectedDate, line, shift));
        if (entry) {
            setCurrentEntry(normalizeEntry(entry));
            setIsEditing(true);
        } else {
            setCurrentEntry(createEmptyEntry(selectedDate, line, shift));
            setIsEditing(false);
        }
        setStrengthErrors({});
    };

    const updateCurrentEntry = (updater: (entry: DailyEntry) => DailyEntry) => {
        setCurrentEntry(prev => prev ? updater(prev) : prev);
    };

    const handleShiftDetailsChange = (field: keyof ShiftDetails, value: string) => {
        updateCurrentEntry(entry => ({
            ...entry,
            shiftDetails: {
                ...entry.shiftDetails,
                [field]: value,
            },
        }));
    };

    const handlePositionChange = (machineKey: BussingKey, value: string) => {
        updateCurrentEntry(entry => ({
            ...entry,
            bussingData: {
                ...entry.bussingData,
                [machineKey]: {
                    ...entry.bussingData[machineKey],
                    position: value,
                },
            },
        }));
    };

    const applyStrengthValues = (machineKey: BussingKey, startIndex: number, values: string[]) => {
        const availableFields = 32 - startIndex;
        const valuesToApply = values.slice(0, availableFields);
        if (valuesToApply.length === 0) return;

        setStrengthErrors(prev => {
            const next = { ...prev };
            valuesToApply.forEach((_, offset) => {
                delete next[`${machineKey}-${startIndex + offset}`];
            });
            return next;
        });

        updateCurrentEntry(entry => {
            const nextStrengths = [...entry.bussingData[machineKey].strengths];
            valuesToApply.forEach((value, offset) => {
                nextStrengths[startIndex + offset] = value;
            });
            return {
                ...entry,
                bussingData: {
                    ...entry.bussingData,
                    [machineKey]: {
                        ...entry.bussingData[machineKey],
                        strengths: nextStrengths,
                    },
                },
            };
        });
    };

    const handleStrengthChange = (machineKey: BussingKey, index: number, value: string) => {
        if (hasStrengthValueSeparator(value)) {
            const pastedValues = parsePastedStrengthValues(value);
            if (pastedValues.length > 0) {
                applyStrengthValues(machineKey, index, pastedValues);
                return;
            }
        }

        const errorKey = `${machineKey}-${index}`;
        if (!isNumericInputText(value)) {
            setStrengthErrors(prev => ({ ...prev, [errorKey]: 'Enter a valid number' }));
            return;
        }
        setStrengthErrors(prev => {
            if (!prev[errorKey]) return prev;
            const next = { ...prev };
            delete next[errorKey];
            return next;
        });
        updateCurrentEntry(entry => {
            const nextStrengths = [...entry.bussingData[machineKey].strengths];
            nextStrengths[index] = value;
            return {
                ...entry,
                bussingData: {
                    ...entry.bussingData,
                    [machineKey]: {
                        ...entry.bussingData[machineKey],
                        strengths: nextStrengths,
                    },
                },
            };
        });
    };

    const handleStrengthPaste = (machineKey: BussingKey, startIndex: number, event: ClipboardEvent<HTMLInputElement>) => {
        const pastedText = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text');
        const pastedValues = parsePastedStrengthValues(pastedText);
        if (pastedValues.length === 0) return;

        event.preventDefault();
        applyStrengthValues(machineKey, startIndex, pastedValues);
    };

    const validateEntry = () => {
        if (!currentEntry) return false;
        for (const machineKey of LINE_BUSSING_KEYS[currentEntry.line]) {
            const strengths = currentEntry.bussingData[machineKey].strengths;
            for (let index = 0; index < strengths.length; index += 1) {
                const value = strengths[index];
                if (value && parseCompletedNumber(value) === null) {
                    showAlert('error', `${BUSSING_LABELS[machineKey]} Strength ${getDisplayedStrengthNumber(index)} must be a valid number`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleSaveEntry = async () => {
        if (!currentEntry) {
            showAlert('error', 'Please select a date and shift');
            return;
        }
        if (!validateEntry()) return;

        setIsLoading(true);
        try {
            const payload = {
                ...currentEntry,
                averages: currentAverages,
            };
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
            const entryKey = getEntryKey(saved.date, saved.line, saved.shift);
            setMonthlyEntries(prev => new Map(prev).set(entryKey, saved));
            setDateEntries(prev => ({
                ...prev,
                [saved.date]: {
                    ...prev[saved.date],
                    [saved.line]: {
                        ...(prev[saved.date]?.[saved.line] || {}),
                        [saved.shift]: saved,
                    },
                },
            }));
            setCurrentEntry(saved);
            setIsEditing(true);
            const statsResponse = await fetch(`${API_BASE_URL}/stats/monthly?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
            const statsJson = await statsResponse.json();
            if (statsJson?.data) setMonthlyStats(statsJson.data);
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
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} (${currentEntry.line}, Shift ${currentEntry.shift})?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/entries/${currentEntry.date}/${encodeURIComponent(currentEntry.line)}/${currentEntry.shift}`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) throw new Error('Failed to delete entry');
                    const entryKey = getEntryKey(currentEntry.date, currentEntry.line, currentEntry.shift);
                    setMonthlyEntries(prev => {
                        const next = new Map(prev);
                        next.delete(entryKey);
                        return next;
                    });
                    setDateEntries(prev => {
                        const next = { ...prev };
                        delete next[currentEntry.date]?.[currentEntry.line]?.[currentEntry.shift];
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

    const handleSignatureUpdate = async (type: 'prepared' | 'reviewed') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        if (!currentEntry) {
            showAlert('error', 'Please select an entry first');
            return;
        }
        const field = type === 'prepared' ? 'preparedBy' : 'reviewedBy';
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.line, currentEntry.shift);
        const currentSignatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', reviewedBy: '' };
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
            if (type === 'reviewed' && !['Manager', 'Supervisor'].includes(userRole || '')) {
                showAlert('error', 'Only Managers or Supervisors can sign as Reviewed By');
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
                    line: currentEntry.line,
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

    const handleExportMonthlyExcel = async (line: LineOption = selectedExportLine) => {
        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const monthlyResponse = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResponse.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResponse.json();
            const entries = (Array.isArray(monthlyJson?.data) ? monthlyJson.data : []).filter((entry: DailyEntry) => normalizeLine(entry.line) === line);
            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries, line, year, month }),
            });
            if (!response.ok) throw new Error('Failed to generate Excel report');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Bus_Ribbon_INTC_Pull_Strength_${line}_${months[currentDate.getMonth()]}_${year}.xlsx`;
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
                .some(entry => hasAnyStrengthData(entry as DailyEntry) || entry?.signatures?.preparedBy || entry?.signatures?.reviewedBy);

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
                            const entry = dateEntries[dateStr]?.[selectedLine]?.[shift];
                            return (
                                <div key={shift} className="flex items-center gap-1 text-xs">
                                    {getShiftIcon(shift)}
                                    {hasAnyStrengthData(entry) ? (
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
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.line, currentEntry.shift);
        const signatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', reviewedBy: '' };
        const canSignPrepared = userRole === 'Operator' && !signatures.preparedBy;
        const canSignReviewed = ['Manager', 'Supervisor'].includes(userRole || '') && !signatures.reviewedBy;
        const canRemovePrepared = signatures.preparedBy === username;
        const canRemoveReviewed = signatures.reviewedBy === username;

        return (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 text-md font-semibold dark:text-white">
                    Signatures for {currentEntry.date} - {currentEntry.line} Shift {currentEntry.shift}
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
                        <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">Reviewed By</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={signatures.reviewedBy || ''}
                                readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="Not signed"
                            />
                            {(canSignReviewed || canRemoveReviewed) && (
                                <button
                                    onClick={() => handleSignatureUpdate('reviewed')}
                                    className={`rounded-lg p-2 text-white ${canRemoveReviewed ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                                >
                                    {canRemoveReviewed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStrengthGrid = (machineKey: BussingKey) => {
        if (!currentEntry) return null;
        return (
            <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-8 gap-2">
                    {currentEntry.bussingData[machineKey].strengths.map((value, index) => {
                        const errorKey = `${machineKey}-${index}`;
                        const hasError = Boolean(strengthErrors[errorKey]);
                        const isBelowLimit = isStrengthBelowLimit(value);
                        const inputStateClass = hasError
                            ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-300'
                            : isBelowLimit
                                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
                        return (
                            <div key={errorKey} className="min-w-0">
                                <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-400">{getDisplayedStrengthNumber(index)}</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={value}
                                    onChange={(event) => handleStrengthChange(machineKey, index, event.target.value)}
                                    onPaste={(event) => handleStrengthPaste(machineKey, index, event)}
                                    className={`w-full rounded-md border px-2 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary ${inputStateClass}`}
                                    placeholder="0"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderBussingSection = (machineKey: BussingKey) => {
        if (!currentEntry) return null;
        const averages = currentAverages[machineKey] || { average1: '', average2: '' };
        return (
            <section key={machineKey} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-white">{BUSSING_LABELS[machineKey]}</h4>
                    <div className="w-full lg:w-64">
                        <select
                            value={currentEntry.bussingData[machineKey].position}
                            onChange={(event) => handlePositionChange(machineKey, event.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        >
                            <option value="">Select position</option>
                            {POSITION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </div>
                </div>
                <h5 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Strength</h5>
                {renderStrengthGrid(machineKey)}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Average 1 (Fields 1-16)</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{averages.average1 || '-'}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Average 2 (Fields 1-16)</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{averages.average2 || '-'}</p>
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

            {showExportLineSelector && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold dark:text-white">Select Line</h3>
                            <button onClick={() => setShowExportLineSelector(false)} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <X className="h-5 w-5 dark:text-white" />
                            </button>
                        </div>
                        <select
                            value={selectedExportLine}
                            onChange={(event) => setSelectedExportLine(event.target.value as LineOption)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                            {LINE_OPTIONS.map(line => <option key={line} value={line}>{line}</option>)}
                        </select>
                        <div className="mt-5 flex justify-end gap-3">
                            <button onClick={() => setShowExportLineSelector(false)} className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowExportLineSelector(false);
                                    handleExportMonthlyExcel(selectedExportLine);
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
                                {shiftSelectorLine ? `Select Shift for ${selectedDate}` : `Select Line for ${selectedDate}`}
                            </h3>
                            <button onClick={resetSelection} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <X className="h-5 w-5 dark:text-white" />
                            </button>
                        </div>

                        {!shiftSelectorLine ? (
                            <div className="space-y-3">
                                {LINE_OPTIONS.map(line => {
                                    const lineEntries = dateEntries[selectedDate]?.[line] || {};
                                    const filledCount = SHIFT_OPTIONS.filter(shift => !!lineEntries[shift]).length;
                                    return (
                                        <button
                                            key={line}
                                            onClick={() => {
                                                setSelectedLine(line);
                                                setShiftSelectorLine(line);
                                            }}
                                            className="flex w-full items-center justify-between rounded-lg border-2 border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-primary-soft dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10"
                                        >
                                            <span className="font-semibold text-gray-900 dark:text-white">{line}</span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">{filledCount} / 3 shifts</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                <button
                                    onClick={() => setShiftSelectorLine(null)}
                                    className="mb-4 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-brand-primary hover:bg-brand-primary-soft dark:text-brand-primary-light dark:hover:bg-brand-primary/10"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    {shiftSelectorLine}
                                </button>
                                <div className="space-y-3">
                                    {SHIFT_OPTIONS.map(shift => {
                                        const entry = dateEntries[selectedDate]?.[shiftSelectorLine]?.[shift];
                                        const isFilled = !!entry;
                                        return (
                                            <button
                                                key={shift}
                                                onClick={() => handleShiftSelect(shiftSelectorLine, shift)}
                                                className={`flex w-full items-center gap-3 rounded-lg border-2 p-4 transition-all ${isFilled ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`}
                                            >
                                                <div className="shrink-0">{getShiftIcon(shift)}</div>
                                                <div className="grow text-left">
                                                    <div className="font-semibold dark:text-white">Shift {shift}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {isFilled ? `PO: ${entry?.shiftDetails.poNumber || '-'}` : 'No entry yet'}
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
                heading="Bus Ribbon to INTC Ribbon Pull Strength Test"
                criteria="Allowable Limit >= 1.5N"
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
                                    onClick={() => setShowExportLineSelector(true)}
                                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700"
                                >
                                        <img
                                            src="/IMAGES/Excel.svg"
                                            alt="Excel"
                                            className="w-6 h-6 filter brightness-0 invert dark:brightness-0 dark:invert"
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
                                    {isEditing ? 'Edit Entry' : 'New Entry'} - {currentEntry.testingDate} ({currentEntry.line}, Shift {currentEntry.shift})
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

                            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                                {/* <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Date</label>
                                    <input
                                        type="text"
                                        value={currentEntry.date}
                                        readOnly
                                        className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Shift</label>
                                    <input
                                        type="text"
                                        value={`Shift ${currentEntry.shift}`}
                                        readOnly
                                        className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Line</label>
                                    <input
                                        type="text"
                                        value={currentEntry.line}
                                        readOnly
                                        className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2.5 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                    />
                                </div> */}
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">PO Number</label>
                                    <input
                                        type="text"
                                        value={currentEntry.shiftDetails.poNumber}
                                        onChange={(event) => handleShiftDetailsChange('poNumber', event.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                        placeholder="Enter PO number"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">INTC Ribbon Status</label>
                                    <select
                                        value={currentEntry.shiftDetails.intcRibbonStatus}
                                        onChange={(event) => handleShiftDetailsChange('intcRibbonStatus', event.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                    >
                                        <option value="">Select</option>
                                        {['Juren', 'Sunby', 'YourBest'].map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Bus Ribbon Status</label>
                                    <select
                                        value={currentEntry.shiftDetails.busRibbonStatus}
                                        onChange={(event) => handleShiftDetailsChange('busRibbonStatus', event.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                    >
                                        <option value="">Select</option>
                                        {['Juren', 'Sunby', 'YourBest'].map(option => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {LINE_BUSSING_KEYS[currentEntry.line].map(renderBussingSection)}
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
