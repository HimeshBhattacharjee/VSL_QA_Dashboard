import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import TestHeading from '../components/TestHeading';
import FabLineSelectionModal from '../components/FabLineSelectionModal';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

type FabOption = 'FAB-II Line-I' | 'FAB-II Line-II';
type LineLabel = 'Line - 1' | 'Line - 2' | 'Line - 3' | 'Line - 4';
type NumericField = 'sortValuePositive' | 'sortValueNegative' | 'springTension';
type TextField = 'po' | 'jbNo' | 'checkedBy';

interface JBContactBlockRow {
    po: string;
    jbNo: string;
    sortValuePositive: string;
    sortValueNegative: string;
    springTension: string;
    remarks: string;
    checkedBy: string;
}

interface Signatures {
    preparedBy: string;
    verifiedBy: string;
}

interface DailyEntry {
    _id?: string;
    date: string;
    testingDate: string;
    fab: FabOption;
    lines: Partial<Record<LineLabel, JBContactBlockRow[]>>;
    signatures?: Signatures;
    [key: string]: unknown;
}

interface DateEntries {
    [date: string]: Partial<Record<FabOption, DailyEntry>>;
}

interface MonthlyStats {
    totalDays: number;
    totalPossibleEntries: number;
    filledEntries: number;
    completionRate: number;
    fabStats: Record<FabOption, number>;
}

const FAB_OPTIONS: FabOption[] = ['FAB-II Line-I', 'FAB-II Line-II'];
const FAB_LINE_MAP: Record<FabOption, LineLabel[]> = {
    'FAB-II Line-I': ['Line - 1', 'Line - 2'],
    'FAB-II Line-II': ['Line - 3', 'Line - 4'],
};
const DEFAULT_FAB: FabOption = 'FAB-II Line-I';
const NUMERIC_FIELDS: NumericField[] = ['sortValuePositive', 'sortValueNegative', 'springTension'];

const defaultMonthlyStats: MonthlyStats = {
    totalDays: 0,
    totalPossibleEntries: 0,
    filledEntries: 0,
    completionRate: 0,
    fabStats: {
        'FAB-II Line-I': 0,
        'FAB-II Line-II': 0,
    },
};

const getEntryKey = (date: string, fab: FabOption) => `${date}_${fab}`;
const getTodayDate = () => new Date().toISOString().split('T')[0];
const normalizeDate = (dateStr: string) => dateStr ? dateStr.split('T')[0] : '';
const normalizeFab = (fab?: string): FabOption => fab === 'FAB-II Line-II' ? 'FAB-II Line-II' : 'FAB-II Line-I';
const isNumericInputText = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);

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

const valueToInputText = (value: unknown) => value === null || value === undefined ? '' : String(value);

const createEmptyRow = (checkedBy = ''): JBContactBlockRow => ({
    po: '',
    jbNo: '',
    sortValuePositive: '',
    sortValueNegative: '',
    springTension: '',
    remarks: '',
    checkedBy,
});

const calculateRemarks = (row: JBContactBlockRow) => {
    const springTension = parseCompletedNumber(row.springTension);
    const sortValuePositive = parseCompletedNumber(row.sortValuePositive);
    const sortValueNegative = parseCompletedNumber(row.sortValueNegative);

    if (springTension === null || sortValuePositive === null || sortValueNegative === null) {
        return '';
    }

    return springTension >= 75 && sortValuePositive < 20 && sortValueNegative < 20 ? 'OK' : 'NOT OK';
};

const withCalculatedRemarks = (row: JBContactBlockRow): JBContactBlockRow => ({
    ...row,
    remarks: calculateRemarks(row),
});

const normalizeRow = (row?: Partial<JBContactBlockRow>): JBContactBlockRow => withCalculatedRemarks({
    ...createEmptyRow(),
    ...(row || {}),
    sortValuePositive: valueToInputText(row?.sortValuePositive),
    sortValueNegative: valueToInputText(row?.sortValueNegative),
    springTension: valueToInputText(row?.springTension),
});

const createEmptyLines = (fab: FabOption, checkedBy = ''): Partial<Record<LineLabel, JBContactBlockRow[]>> => FAB_LINE_MAP[fab].reduce((acc, lineLabel) => {
    acc[lineLabel] = [createEmptyRow(checkedBy)];
    return acc;
}, {} as Partial<Record<LineLabel, JBContactBlockRow[]>>);

const createEmptyEntry = (date: string, fab: FabOption, signatures?: Signatures, checkedBy = ''): DailyEntry => ({
    date,
    testingDate: date,
    fab,
    lines: createEmptyLines(fab, checkedBy),
    signatures: signatures || {
        preparedBy: '',
        verifiedBy: '',
    },
});

const normalizeEntry = (entry: DailyEntry, dateSignature?: Signatures): DailyEntry => {
    const date = normalizeDate(entry.date || entry.testingDate || getTodayDate());
    const fab = normalizeFab(entry.fab);
    const emptyEntry = createEmptyEntry(date, fab);

    return {
        ...emptyEntry,
        ...entry,
        date,
        testingDate: normalizeDate(entry.testingDate || date),
        fab,
        lines: FAB_LINE_MAP[fab].reduce((acc, lineLabel) => {
            const rows = entry.lines?.[lineLabel];
            acc[lineLabel] = Array.isArray(rows) && rows.length > 0
                ? rows.map(normalizeRow)
                : [createEmptyRow()];
            return acc;
        }, {} as Partial<Record<LineLabel, JBContactBlockRow[]>>),
        signatures: {
            preparedBy: dateSignature?.preparedBy || entry.signatures?.preparedBy || '',
            verifiedBy: dateSignature?.verifiedBy || entry.signatures?.verifiedBy || '',
        },
    };
};

const hasRowData = (row?: JBContactBlockRow) => {
    if (!row) return false;
    return Boolean(
        row.po.trim()
        || row.jbNo.trim()
        || row.checkedBy.trim()
        || NUMERIC_FIELDS.some(field => row[field].trim() !== ''),
    );
};

const hasEntryData = (entry?: DailyEntry) => {
    if (!entry) return false;
    return FAB_LINE_MAP[entry.fab].some(lineLabel => (entry.lines[lineLabel] || []).some(hasRowData));
};

const getRowPayload = (row: JBContactBlockRow) => ({
    po: row.po.trim(),
    jbNo: row.jbNo.trim(),
    sortValuePositive: normalizeNumericOnlyForSave(row.sortValuePositive),
    sortValueNegative: normalizeNumericOnlyForSave(row.sortValueNegative),
    springTension: normalizeNumericOnlyForSave(row.springTension),
    remarks: calculateRemarks(row),
    checkedBy: row.checkedBy.trim(),
});

const buildEntryPayload = (entry: DailyEntry) => ({
    ...entry,
    lines: FAB_LINE_MAP[entry.fab].reduce((acc, lineLabel) => {
        acc[lineLabel] = (entry.lines[lineLabel] || [createEmptyRow()]).map(getRowPayload);
        return acc;
    }, {} as Record<LineLabel, ReturnType<typeof getRowPayload>[]>),
});

export default function JBContactBlockMaintenanceReport() {
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState('');
    const [showFabSelector, setShowFabSelector] = useState(false);
    const [showExportFabSelector, setShowExportFabSelector] = useState(false);
    const [selectedExportFab, setSelectedExportFab] = useState<FabOption>(DEFAULT_FAB);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [dateSignatures, setDateSignatures] = useState<Record<string, Signatures>>({});
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);
    const [numericErrors, setNumericErrors] = useState<Record<string, string>>({});
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/jb-contact-block-maintenance-reports`;
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
            const nextSignatures: Record<string, Signatures> = entriesJson?.date_signatures || {};
            const entriesArr: DailyEntry[] = Array.isArray(entriesJson?.data)
                ? entriesJson.data.map((entry: DailyEntry) => normalizeEntry(entry, nextSignatures[normalizeDate(entry.date)]))
                : [];
            const entriesMap = new Map<string, DailyEntry>();
            const nextDateEntries: DateEntries = {};

            entriesArr.forEach(entry => {
                const entryKey = getEntryKey(entry.date, entry.fab);
                entriesMap.set(entryKey, entry);
                nextDateEntries[entry.date] = {
                    ...(nextDateEntries[entry.date] || {}),
                    [entry.fab]: entry,
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
        setCurrentEntry(null);
        setShowFabSelector(false);
        setNumericErrors({});
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
        setCurrentEntry(null);
        setShowFabSelector(true);
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

    const handleFabSelect = (fab: FabOption) => {
        setShowFabSelector(false);
        const entry = monthlyEntries.get(getEntryKey(selectedDate, fab));
        const signatures = dateSignatures[selectedDate] || { preparedBy: '', verifiedBy: '' };
        if (entry) {
            setCurrentEntry(normalizeEntry(entry, signatures));
            setIsEditing(true);
        } else {
            setCurrentEntry(createEmptyEntry(selectedDate, fab, signatures, username || ''));
            setIsEditing(false);
        }
        setNumericErrors({});
    };

    const updateCurrentEntry = (updater: (entry: DailyEntry) => DailyEntry) => {
        setCurrentEntry(prev => prev ? updater(prev) : prev);
    };

    const handleTextChange = (lineLabel: LineLabel, rowIndex: number, field: TextField, value: string) => {
        updateCurrentEntry(entry => {
            const rows = [...(entry.lines[lineLabel] || [createEmptyRow()])];
            rows[rowIndex] = withCalculatedRemarks({
                ...(rows[rowIndex] || createEmptyRow()),
                [field]: value,
            });
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: rows,
                },
            };
        });
    };

    const handleNumericChange = (lineLabel: LineLabel, rowIndex: number, field: NumericField, value: string) => {
        const errorKey = `${lineLabel}-${rowIndex}-${field}`;
        if (!isNumericInputText(value)) {
            setNumericErrors(prev => ({ ...prev, [errorKey]: 'Enter a valid number' }));
            return;
        }
        setNumericErrors(prev => {
            if (!prev[errorKey]) return prev;
            const next = { ...prev };
            delete next[errorKey];
            return next;
        });
        updateCurrentEntry(entry => {
            const rows = [...(entry.lines[lineLabel] || [createEmptyRow()])];
            rows[rowIndex] = withCalculatedRemarks({
                ...(rows[rowIndex] || createEmptyRow()),
                [field]: value,
            });
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: rows,
                },
            };
        });
    };

    const handleAddRow = (lineLabel: LineLabel) => {
        updateCurrentEntry(entry => {
            const rows = [...(entry.lines[lineLabel] || [])];
            const previousRow = rows.length > 0 ? rows[rows.length - 1] : createEmptyRow(username || '');
            const nextRow = {
                ...previousRow,
                checkedBy: previousRow.checkedBy || username || '',
            };
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: [...rows, nextRow],
                },
            };
        });
    };

    const handleDeleteRow = (lineLabel: LineLabel, rowIndex: number) => {
        updateCurrentEntry(entry => {
            const rows = [...(entry.lines[lineLabel] || [createEmptyRow()])];
            rows.splice(rowIndex, 1);
            return {
                ...entry,
                lines: {
                    ...entry.lines,
                    [lineLabel]: rows.length > 0 ? rows : [createEmptyRow(username || '')],
                },
            };
        });
    };

    const validateEntry = () => {
        if (!currentEntry) return false;
        for (const lineLabel of FAB_LINE_MAP[currentEntry.fab]) {
            const rows = currentEntry.lines[lineLabel] || [];
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
                for (const field of NUMERIC_FIELDS) {
                    const value = rows[rowIndex][field];
                    if (value && parseCompletedNumber(value) === null) {
                        showAlert('error', `${lineLabel} row ${rowIndex + 1} ${field} must be a valid number`);
                        return false;
                    }
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
            showAlert('error', 'Please select a date and FAB line');
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
            const saved = normalizeEntry(result.data.entry as DailyEntry, dateSignatures[currentEntry.date]);
            const entryKey = getEntryKey(saved.date, saved.fab);
            setMonthlyEntries(prev => new Map(prev).set(entryKey, saved));
            setDateEntries(prev => ({
                ...prev,
                [saved.date]: {
                    ...prev[saved.date],
                    [saved.fab]: saved,
                },
            }));
            if (saved.signatures) {
                setDateSignatures(prev => ({ ...prev, [saved.date]: saved.signatures as Signatures }));
            }
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
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} (${currentEntry.fab})?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/entries/${currentEntry.date}/${encodeURIComponent(currentEntry.fab)}`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) throw new Error('Failed to delete entry');
                    const entryKey = getEntryKey(currentEntry.date, currentEntry.fab);
                    setMonthlyEntries(prev => {
                        const next = new Map(prev);
                        next.delete(entryKey);
                        return next;
                    });
                    setDateEntries(prev => {
                        const next = { ...prev };
                        delete next[currentEntry.date]?.[currentEntry.fab];
                        return next;
                    });
                    setCurrentEntry(null);
                    setSelectedDate('');
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
        const currentSignatures = dateSignatures[currentEntry.date] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
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

        setDateSignatures(prev => ({ ...prev, [currentEntry.date]: nextSignatures }));
        setCurrentEntry(prev => prev ? { ...prev, signatures: nextSignatures } : prev);
        try {
            const response = await fetch(`${API_BASE_URL}/signatures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: currentEntry.date,
                    fab: currentEntry.fab,
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
            const signatures: Record<string, Signatures> = monthlyJson?.date_signatures || {};
            const entries = (Array.isArray(monthlyJson?.data) ? monthlyJson.data : [])
                .map((entry: DailyEntry) => normalizeEntry(entry, signatures[normalizeDate(entry.date)]))
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
            anchor.download = `JB_Contact_Block_Maintenance_${fab}_${months[currentDate.getMonth()]}_${year}.xlsx`;
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
            const hasAny = Object.values(dayEntries).some(entry => hasEntryData(entry) || entry?.signatures?.preparedBy || entry?.signatures?.verifiedBy);

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`relative rounded-lg border-2 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-brand-primary ring-2 ring-brand-primary' : hasAny ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'} ${isToday ? 'font-bold' : ''}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm dark:text-white">{day}</span>
                    </div>
                </button>,
            );
        }
        return days;
    };

    const renderSignatureSection = () => {
        if (!currentEntry) return null;
        const signatures = dateSignatures[currentEntry.date] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
        const canSignVerified = ['Manager', 'Supervisor'].includes(userRole || '') && !signatures.verifiedBy;
        const canRemoveVerified = signatures.verifiedBy === username;

        return (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 text-md font-semibold dark:text-white">
                    Signatures for {currentEntry.date}
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">Prepared By</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={signatures.preparedBy || 'Pending checked-by record'}
                                readOnly
                                className="w-full rounded-lg border border-gray-200 bg-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="Not signed"
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Auto-populated from authenticated Checked By records</p>
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

    const renderNumericInput = (lineLabel: LineLabel, row: JBContactBlockRow, rowIndex: number, field: NumericField, placeholder: string) => {
        const errorKey = `${lineLabel}-${rowIndex}-${field}`;
        const hasError = Boolean(numericErrors[errorKey]);
        const inputStateClass = hasError
            ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-300'
            : 'border-gray-300 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

        return (
            <input
                type="text"
                inputMode="decimal"
                value={row[field]}
                onChange={(event) => handleNumericChange(lineLabel, rowIndex, field, event.target.value)}
                className={`w-full min-w-[92px] rounded-md border px-2 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary ${inputStateClass}`}
                placeholder={placeholder}
            />
        );
    };

    const renderLineSection = (lineLabel: LineLabel) => {
        if (!currentEntry) return null;
        const rows = currentEntry.lines[lineLabel] || [createEmptyRow()];

        return (
            <section key={lineLabel} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-white">{lineLabel}</h4>
                    <button
                        onClick={() => handleAddRow(lineLabel)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary-soft px-3 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary-muted dark:bg-brand-primary/10 dark:text-brand-primary-light"
                    >
                        <Plus className="h-4 w-4" />
                        Add Row
                    </button>
                </div>

                <div className="overflow-x-auto pb-2">
                    <div className="min-w-[980px]">
                        <div className="grid grid-cols-[1.2fr_1fr_1.1fr_1.1fr_1.1fr_0.9fr_1fr_44px] gap-2 px-1 pb-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                            <div>PO</div>
                            <div>JB No.</div>
                            <div>Sort Value (+VE) (mΩ)</div>
                            <div>Sort Value (-VE) (mΩ)</div>
                            <div>Spring Tension (≥75N)</div>
                            <div>Remarks</div>
                            <div>Checked by</div>
                            <div></div>
                        </div>
                        <div className="space-y-2">
                            {rows.map((row, rowIndex) => {
                                const remarks = calculateRemarks(row);
                                const remarksClass = remarks === 'NOT OK'
                                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                                    : remarks === 'OK'
                                        ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                                        : 'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400';
                                return (
                                    <div key={`${lineLabel}-${rowIndex}`} className="grid grid-cols-[1.2fr_1fr_1.1fr_1.1fr_1.1fr_0.9fr_1fr_44px] gap-2">
                                        <input
                                            type="text"
                                            value={row.po}
                                            onChange={(event) => handleTextChange(lineLabel, rowIndex, 'po', event.target.value)}
                                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                            placeholder="PO"
                                        />
                                        <input
                                            type="text"
                                            value={row.jbNo}
                                            onChange={(event) => handleTextChange(lineLabel, rowIndex, 'jbNo', event.target.value)}
                                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                            placeholder="JB No."
                                        />
                                        {renderNumericInput(lineLabel, row, rowIndex, 'sortValuePositive', '0')}
                                        {renderNumericInput(lineLabel, row, rowIndex, 'sortValueNegative', '0')}
                                        {renderNumericInput(lineLabel, row, rowIndex, 'springTension', '75')}
                                        <input
                                            type="text"
                                            value={remarks}
                                            readOnly
                                            className={`w-full rounded-md border px-2 py-2 text-center text-xs font-semibold ${remarksClass}`}
                                            placeholder="-"
                                        />
                                        <input
                                            type="text"
                                            value={row.checkedBy || username || ''}
                                            readOnly
                                            disabled
                                            className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-2 text-xs text-gray-900 disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                            placeholder="Auto-populated"
                                        />
                                        <button
                                            onClick={() => handleDeleteRow(lineLabel, rowIndex)}
                                            className="flex h-9 w-9 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Delete row"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
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

            <FabLineSelectionModal
                isOpen={showFabSelector && Boolean(selectedDate)}
                title={`Select FAB Line for ${selectedDate}`}
                options={FAB_OPTIONS.map(fab => ({
                    value: fab,
                    label: fab,
                    description: FAB_LINE_MAP[fab].join(', '),
                    isFilled: hasEntryData(dateEntries[selectedDate]?.[fab]),
                }))}
                onSelect={(value) => handleFabSelect(value as FabOption)}
                onClose={resetSelection}
            />

            <TestHeading
                heading="JB Contact Block Maintenance Report"
                criteria="Resistance < 20mΩ, Spring Tension >= 75N"
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

                    {currentEntry && (
                        <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold dark:text-white">
                                    {isEditing ? 'Edit Entry' : 'New Entry'} - {currentEntry.testingDate} ({currentEntry.fab})
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
                            FAB-wise Statistics
                        </h3>
                        <div className="space-y-4">
                            {FAB_OPTIONS.map(fab => {
                                const filled = monthlyStats.fabStats?.[fab] || 0;
                                const total = monthlyStats.totalDays;
                                return (
                                    <div key={fab} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium dark:text-white">{fab}</span>
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
