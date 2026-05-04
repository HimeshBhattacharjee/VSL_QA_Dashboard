import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import {
    CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Trash2, Save, X,
    BarChart3, Percent, Target, TrendingUp, Clock, Sun, Sunset, Moon,
    Circle, CircleDot, CircleOff
} from 'lucide-react';

type LineGroup = 'Line-I' | 'Line-II';
type Shift = 'A' | 'B' | 'C';

const LINE_GROUPS: LineGroup[] = ['Line-I', 'Line-II'];
const SHIFTS: Shift[] = ['A', 'B', 'C'];
const DEFAULT_LINE_GROUP: LineGroup = 'Line-I';

const getEntryKey = (date: string, lineGroup: LineGroup, shift: Shift) => `${date}_${lineGroup}_${shift}`;
const getDisplayLineNumbers = (lineGroup: LineGroup) => lineGroup === 'Line-I' ? ['1', '2'] : ['3', '4'];
const getLineGroupLabel = (lineGroup: LineGroup) => `FAB-II ${lineGroup}`;
const normalizeLineGroup = (lineGroup?: string): LineGroup => lineGroup === 'Line-II' ? 'Line-II' : 'Line-I';
interface LineEntry {
    line?: string;
    sealantSupplier: string;
    sealantExpDate: string;
    sampleTakingTime: string;
    sampleTestingTime: string;
    result: string;
    remarks?: string;
}

interface DailyEntry {
    date: string;
    testingDate: string;
    shift: Shift;
    lineGroup: LineGroup;
    checkedBy: string;
    po: string;
    lines: {
        '1': LineEntry;
        '2': LineEntry;
    };
    [key: string]: any;
}

interface DateEntries {
    [date: string]: Partial<Record<LineGroup, Partial<Record<Shift, DailyEntry>>>>;
}

interface ShiftLineStats {
    '1': number;
    '2': number;
}

interface ShiftStats {
    filled: number;
    pass: number;
    fail: number;
    lines: ShiftLineStats;
}

interface MonthlyStats {
    totalDays: number;
    totalPossibleEntries: number;
    filledEntries: number;
    completionRate: number;
    passCount: number;
    failCount: number;
    shiftStats: {
        A: ShiftStats;
        B: ShiftStats;
        C: ShiftStats;
    };
}

interface SignatureData {
    preparedBy: string;
    approvedBy: string;
}

interface MonthSignatureData {
    [key: string]: SignatureData;
}

const defaultShiftStats: ShiftStats = {
    filled: 0,
    pass: 0,
    fail: 0,
    lines: { '1': 0, '2': 0 }
};

const defaultMonthlyStats: MonthlyStats = {
    totalDays: 0,
    totalPossibleEntries: 0,
    filledEntries: 0,
    completionRate: 0,
    passCount: 0,
    failCount: 0,
    shiftStats: {
        A: { ...defaultShiftStats },
        B: { ...defaultShiftStats },
        C: { ...defaultShiftStats }
    }
};

const defaultSignature: SignatureData = {
    preparedBy: '',
    approvedBy: ''
};

const SSH_PASS_THRESHOLD = 39;

const shiftRequiredFields: Array<{
    key: keyof Pick<DailyEntry, 'po' | 'checkedBy'>;
    label: string;
}> = [
    { key: 'po', label: 'PO Number' },
    { key: 'checkedBy', label: 'Checked By' }
];

const lineRequiredFields: Array<{
    key: keyof Pick<LineEntry, 'sealantSupplier' | 'sealantExpDate' | 'sampleTakingTime' | 'sampleTestingTime' | 'result'>;
    label: string;
}> = [
    { key: 'sealantSupplier', label: 'Sealant Supplier' },
    { key: 'sealantExpDate', label: 'Sealant Expiry Date' },
    { key: 'sampleTakingTime', label: 'Sample Taking Time' },
    { key: 'sampleTestingTime', label: 'Sample Testing Time' },
    { key: 'result', label: 'Result (Shore A)' }
];

const normalizeFieldValue = (value?: string | number) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const parseSSHResultValue = (value?: string | number): number | null => {
    const normalized = normalizeFieldValue(value);
    if (!normalized) return null;

    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
};

const hasSSHResultValue = (value?: string | number) => normalizeFieldValue(value) !== '';

const isSSHResultPass = (value?: string | number) => {
    const normalized = normalizeFieldValue(value).toLowerCase();
    if (normalized === 'pass') return true;

    const parsed = parseSSHResultValue(value);
    return parsed !== null && parsed >= SSH_PASS_THRESHOLD;
};

const isSSHResultFail = (value?: string | number) => {
    const normalized = normalizeFieldValue(value).toLowerCase();
    if (normalized === 'fail') return true;

    const parsed = parseSSHResultValue(value);
    return parsed !== null && parsed < SSH_PASS_THRESHOLD;
};

const getResultInputClass = (value?: string | number) => {
    const parsed = parseSSHResultValue(value);

    if (parsed !== null && parsed >= SSH_PASS_THRESHOLD) {
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
    }

    if (parsed !== null && parsed < SSH_PASS_THRESHOLD) {
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
    }

    return 'dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
};

const getResultInputValue = (value?: string | number) => {
    const parsed = parseSSHResultValue(value);
    return parsed !== null ? normalizeFieldValue(value) : '';
};

const getLineRequiredDetails = (line: LineEntry, lineNumber: '1' | '2') =>
    lineRequiredFields.map(({ key, label }) => ({
        label: `Line ${lineNumber} - ${label}`,
        value: normalizeFieldValue(line[key])
    }));

const getEntryValidationMessage = (entry: DailyEntry): string | null => {
    const hasPo = normalizeFieldValue(entry.po) !== '';
    const hasAnyLineInput =
        getLineRequiredDetails(entry.lines['1'], '1').some(({ value }) => value !== '') ||
        getLineRequiredDetails(entry.lines['2'], '2').some(({ value }) => value !== '');

    if (!hasPo && !hasAnyLineInput) {
        return 'Please fill the entry details before saving.';
    }

    if (!hasPo && hasAnyLineInput) {
        return 'Please enter the PO number for this shift before saving.';
    }

    const requiredDetails = [
        ...shiftRequiredFields.map(({ key, label }) => ({
            label,
            value: normalizeFieldValue(entry[key])
        })),
        ...getLineRequiredDetails(entry.lines['1'], '1'),
        ...getLineRequiredDetails(entry.lines['2'], '2')
    ];

    const firstMissingDetail = requiredDetails.find(({ value }) => value === '');
    if (firstMissingDetail) {
        return `Please complete all entry fields before saving. Missing: ${firstMissingDetail.label}.`;
    }

    const invalidResult = [
        { label: 'Line 1 - Result (Shore A)', value: entry.lines['1'].result },
        { label: 'Line 2 - Result (Shore A)', value: entry.lines['2'].result }
    ].find(({ value }) => normalizeFieldValue(value) !== '' && parseSSHResultValue(value) === null);

    if (invalidResult) {
        return `Please enter a valid numeric value for ${invalidResult.label}.`;
    }

    return null;
};

export default function SSHTest() {
    const navigate = useNavigate();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedLineGroup, setSelectedLineGroup] = useState<LineGroup>(DEFAULT_LINE_GROUP);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [showExportLineSelector, setShowExportLineSelector] = useState(false);
    const [selectedExportLineGroup, setSelectedExportLineGroup] = useState<LineGroup>(DEFAULT_LINE_GROUP);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);

    const [allMonthSignatures, setAllMonthSignatures] = useState<MonthSignatureData>(() => {
        const saved = localStorage.getItem('sshAllMonthSignatures');
        return saved ? JSON.parse(saved) : {};
    });

    const getCurrentMonthKey = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}_${selectedLineGroup}`;
    }, [currentDate, selectedLineGroup]);

    const currentMonthSignatures = useMemo(() => {
        const monthKey = getCurrentMonthKey();
        return allMonthSignatures[monthKey] || { ...defaultSignature };
    }, [allMonthSignatures, getCurrentMonthKey]);

    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const SSH_API_BASE_URL = import.meta.env.VITE_API_URL + '/ssh-test-reports';

    const normalizeDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
    }, []);

    useEffect(() => {
        localStorage.setItem('sshAllMonthSignatures', JSON.stringify(allMonthSignatures));
    }, [allMonthSignatures]);

    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ], []);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i), [currentDate]);

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    const createEmptyLineEntry = useCallback((lineNum: '1' | '2' = '1'): LineEntry => ({
        line: lineNum,
        sealantSupplier: '',
        sealantExpDate: '',
        sampleTakingTime: '',
        sampleTestingTime: '',
        result: '',
        remarks: ''
    }), []);

    const createEmptyShiftEntry = useCallback((date: string, shift: Shift, checkedBy: string, lineGroup: LineGroup = selectedLineGroup): DailyEntry => ({
        date: date,
        testingDate: date,
        shift: shift,
        lineGroup: lineGroup,
        checkedBy: checkedBy,
        po: '',
        lines: {
            '1': createEmptyLineEntry('1'),
            '2': createEmptyLineEntry('2')
        }
    }), [createEmptyLineEntry, selectedLineGroup]);

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            console.log(`Loading data for ${year}-${month}`);

            const entriesUrl = `${SSH_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const statsUrl = `${SSH_API_BASE_URL}/stats/monthly?year=${year}&month=${month}`;
            const [entriesResponse, statsResponse] = await Promise.all([
                fetch(entriesUrl),
                fetch(statsUrl)
            ]);
            const entriesJson = await entriesResponse.json();
            const statsJson = await statsResponse.json();

            console.log('Entries response:', entriesJson);
            console.log('Stats response:', statsJson);

            let entriesArr: DailyEntry[] = [];
            if (entriesJson.data && Array.isArray(entriesJson.data)) {
                entriesArr = entriesJson.data;
            } else if (Array.isArray(entriesJson)) {
                entriesArr = entriesJson;
            }

            console.log(`Found ${entriesArr.length} entries for ${year}-${month}`);

            const entriesMap = new Map<string, DailyEntry>();
            const dateEntriesObj: DateEntries = {};

            entriesArr.forEach((entry: DailyEntry) => {
                const normalizedDate = normalizeDate(entry.date);
                const entryLineGroup = normalizeLineGroup(entry.lineGroup);
                if (!entry.lines) {
                    entry.lines = {
                        '1': createEmptyLineEntry('1'),
                        '2': createEmptyLineEntry('2')
                    };
                } else {
                    if (entry.lines['1'] && !entry.lines['1'].line) {
                        entry.lines['1'].line = '1';
                    }
                    if (entry.lines['2'] && !entry.lines['2'].line) {
                        entry.lines['2'].line = '2';
                    }
                }

                const entryWithNormalizedDate = {
                    ...entry,
                    date: normalizedDate,
                    testingDate: normalizedDate,
                    lineGroup: entryLineGroup
                };

                entriesMap.set(getEntryKey(normalizedDate, entryLineGroup, entry.shift), entryWithNormalizedDate);
                if (!dateEntriesObj[normalizedDate]) {
                    dateEntriesObj[normalizedDate] = {};
                }
                dateEntriesObj[normalizedDate][entryLineGroup] = {
                    ...(dateEntriesObj[normalizedDate][entryLineGroup] || {}),
                    [entry.shift]: entryWithNormalizedDate
                };
            });

            setMonthlyEntries(entriesMap);
            setDateEntries(dateEntriesObj);
            let statsData = statsJson.data || statsJson;
            const shiftStats = statsData.shiftStats || {
                A: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } },
                B: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } },
                C: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } }
            };
            ['A', 'B', 'C'].forEach(shift => {
                if (!shiftStats[shift].lines) {
                    shiftStats[shift].lines = { '1': 0, '2': 0 };
                }
            });

            const newStats = {
                totalDays: statsData.totalDays || new Date(year, month - 1, 0).getDate(),
                totalPossibleEntries: statsData.totalPossibleEntries || new Date(year, month - 1, 0).getDate() * 3 * 2,
                filledEntries: statsData.filledEntries || 0,
                completionRate: statsData.completionRate || 0,
                passCount: statsData.passCount || 0,
                failCount: statsData.failCount || 0,
                shiftStats: shiftStats
            };

            console.log('Setting stats:', newStats);
            setMonthlyStats(newStats);

        } catch (error) {
            console.error('Error loading monthly data:', error);
            setMonthlyEntries(new Map());
            setDateEntries({});
            const daysInMonth = new Date(year, month - 1, 0).getDate();
            setMonthlyStats({
                totalDays: daysInMonth,
                totalPossibleEntries: daysInMonth * 3 * 2,
                filledEntries: 0,
                completionRate: 0,
                passCount: 0,
                failCount: 0,
                shiftStats: {
                    A: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } },
                    B: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } },
                    C: { filled: 0, pass: 0, fail: 0, lines: { '1': 0, '2': 0 } }
                }
            });
        } finally {
            setIsLoading(false);
        }
    }, [SSH_API_BASE_URL, normalizeDate, createEmptyLineEntry]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        loadMonthlyData(year, month);
    }, [currentDate, loadMonthlyData]);

    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleYearChange = useCallback((year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    // Handle date selection - show shift selector
    const handleDateSelect = useCallback((date: string) => {
        const normalized = normalizeDate(date);
        setSelectedDate(normalized);
        setShowShiftSelector(true);
        setCurrentEntry(null);
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
    }, [normalizeDate]);

    // Handle shift selection
    const handleShiftSelect = useCallback((lineGroup: LineGroup, shift: Shift) => {
        setSelectedLineGroup(lineGroup);
        setSelectedShift(shift);
        setShowShiftSelector(false);

        // Check if entry exists for this date and shift
        const entryKey = getEntryKey(selectedDate, lineGroup, shift);
        const entry = monthlyEntries.get(entryKey);

        if (entry) {
            console.log('Loading existing entry:', entry);
            // Ensure entry has lines structure with line numbers
            if (!entry.lines) {
                entry.lines = {
                    '1': createEmptyLineEntry('1'),
                    '2': createEmptyLineEntry('2')
                };
            } else {
                // Add line numbers for Excel export if missing
                if (entry.lines['1'] && !entry.lines['1'].line) {
                    entry.lines['1'].line = '1';
                }
                if (entry.lines['2'] && !entry.lines['2'].line) {
                    entry.lines['2'].line = '2';
                }
            }
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            console.log('Creating new entry for date:', selectedDate, 'shift:', shift);
            // Create new blank entry with two lines
            setCurrentEntry(createEmptyShiftEntry(selectedDate, shift, username || '', lineGroup));
            setIsEditing(false);
        }
    }, [selectedDate, monthlyEntries, username, createEmptyShiftEntry, createEmptyLineEntry]);

    // Close shift selector
    const handleCloseShiftSelector = useCallback(() => {
        setShowShiftSelector(false);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
    }, []);

    const handleTodayEntry = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date(today);

        // Check if today is in current month view
        if (todayDate.getMonth() === currentDate.getMonth() &&
            todayDate.getFullYear() === currentDate.getFullYear()) {
            handleDateSelect(today);
        } else {
            // Navigate to current month first
            setCurrentDate(new Date());
        }
    }, [currentDate, handleDateSelect]);

    // Handle form input change for shift-level fields
    const handleInputChange = useCallback((field: keyof DailyEntry, value: string) => {
        if (!currentEntry) return;
        setCurrentEntry({
            ...currentEntry,
            [field]: value
        });
        setHasUnsavedChanges(true);
    }, [currentEntry]);

    // Handle line-specific input changes
    const handleLineInputChange = useCallback((
        line: '1' | '2',
        field: keyof LineEntry,
        value: string
    ) => {
        if (!currentEntry) return;

        setCurrentEntry({
            ...currentEntry,
            lines: {
                ...currentEntry.lines,
                [line]: {
                    ...currentEntry.lines[line],
                    [field]: value
                }
            }
        });
        setHasUnsavedChanges(true);
    }, [currentEntry]);

    const handleSaveEntry = useCallback(async () => {
        if (!currentEntry || !currentEntry.testingDate || !currentEntry.shift) {
            showAlert('error', 'Please enter a valid date and shift');
            return;
        }

        const validationMessage = getEntryValidationMessage(currentEntry);
        if (validationMessage) {
            showAlert('error', validationMessage);
            return;
        }
        setIsLoading(true);
        try {
            console.log('Saving entry:', currentEntry);

            const response = await fetch(`${SSH_API_BASE_URL}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentEntry),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            const result = await response.json();
            console.log('Save response:', result);

            // Update local state with the saved entry
            if (result.data && result.data.entry) {
                const saved = result.data.entry as DailyEntry;
                const normalized = normalizeDate(saved.date);

                // Ensure saved entry has line numbers
                if (saved.lines) {
                    if (saved.lines['1'] && !saved.lines['1'].line) {
                        saved.lines['1'].line = '1';
                    }
                    if (saved.lines['2'] && !saved.lines['2'].line) {
                        saved.lines['2'].line = '2';
                    }
                }

                const savedLineGroup = normalizeLineGroup(saved.lineGroup);
                saved.lineGroup = savedLineGroup;
                const entryKey = getEntryKey(normalized, savedLineGroup, saved.shift);

                // Update maps
                const updatedEntries = new Map(monthlyEntries);
                updatedEntries.set(entryKey, { ...saved, date: normalized });
                setMonthlyEntries(updatedEntries);

                // Update date entries grouping
                setDateEntries(prev => ({
                    ...prev,
                    [normalized]: {
                        ...prev[normalized],
                        [savedLineGroup]: {
                            ...(dateEntries[normalized]?.[savedLineGroup] || {}),
                            [saved.shift]: { ...saved, date: normalized }
                        }
                    }
                }));

                setCurrentEntry({ ...saved, date: normalized });
                setIsEditing(true);
            }

            // Update stats
            if (result.data && result.data.stats) {
                console.log('Updating stats:', result.data.stats);
                // Ensure stats have lines property
                const stats = result.data.stats;
                if (stats.shiftStats) {
                    ['A', 'B', 'C'].forEach(shift => {
                        if (!stats.shiftStats[shift].lines) {
                            stats.shiftStats[shift].lines = { '1': 0, '2': 0 };
                        }
                    });
                }
                setMonthlyStats(stats);
            }

            setHasUnsavedChanges(false);
            showAlert('success', result.message || 'Entry saved successfully');

        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    }, [currentEntry, monthlyEntries, SSH_API_BASE_URL, showAlert, normalizeDate]);

    const handleDeleteEntry = useCallback(() => {
        if (!currentEntry || !currentEntry.shift) return;

        showConfirm({
            title: 'Delete Entry',
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} (Shift ${currentEntry.shift})? This will delete both lines.`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const dateKey = normalizeDate(currentEntry.date);
                    const shift = currentEntry.shift;
                    const lineGroup = normalizeLineGroup(currentEntry.lineGroup);

                    const response = await fetch(`${SSH_API_BASE_URL}/entries/${dateKey}/${lineGroup}/${shift}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete entry');
                    }

                    const result = await response.json();

                    // Update local state
                    const entryKey = getEntryKey(dateKey, lineGroup, shift);
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(entryKey);
                    setMonthlyEntries(updatedEntries);

                    // Update date entries grouping
                    setDateEntries(prev => {
                        const newDateEntries = { ...prev };
                        if (newDateEntries[dateKey]) {
                            delete newDateEntries[dateKey]?.[lineGroup]?.[shift];
                            // If no shifts left for this date, remove the date entry
                            if (Object.keys(newDateEntries[dateKey]).length === 0) {
                                delete newDateEntries[dateKey];
                            }
                        }
                        return newDateEntries;
                    });

                    // Update stats
                    if (result.data && result.data.stats) {
                        const stats = result.data.stats;
                        if (stats.shiftStats) {
                            ['A', 'B', 'C'].forEach(s => {
                                if (!stats.shiftStats[s].lines) {
                                    stats.shiftStats[s].lines = { '1': 0, '2': 0 };
                                }
                            });
                        }
                        setMonthlyStats(stats);
                    }

                    setCurrentEntry(null);
                    setSelectedDate('');
                    setSelectedShift(null);
                    showAlert('info', 'Entry deleted successfully');
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    }, [currentEntry, monthlyEntries, SSH_API_BASE_URL, showAlert, showConfirm, normalizeDate]);

    // Export monthly Excel report
    const handleExportMonthlyExcel = useCallback(async (exportLineGroup: LineGroup = selectedExportLineGroup) => {
        const monthName = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        const firstThreeLetters = monthName.substring(0, 3);
        const reportName = `Sealant_Shore_Hardness_Test_${firstThreeLetters}_${year}`;

        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const monthlyResp = await fetch(`${SSH_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResp.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResp.json();

            // Get entries array and ensure line numbers are present
            let entriesArray = Array.isArray(monthlyJson?.data) ? monthlyJson.data : [];

            entriesArray = entriesArray.filter((entry: DailyEntry) => normalizeLineGroup(entry.lineGroup) === exportLineGroup);

            const exportLineNumbers = getDisplayLineNumbers(exportLineGroup);

            // Excel needs display line numbers: Line-I exports 1/2 and Line-II exports 3/4.
            entriesArray = entriesArray.map((entry: DailyEntry) => {
                if (!entry.lines) {
                    return entry;
                }

                return {
                    ...entry,
                    lines: {
                        ...entry.lines,
                        '1': entry.lines['1']
                            ? { ...entry.lines['1'], line: exportLineNumbers[0] }
                            : entry.lines['1'],
                        '2': entry.lines['2']
                            ? { ...entry.lines['2'], line: exportLineNumbers[1] }
                            : entry.lines['2']
                    }
                };
            });

            const exportMonthKey = `${year}-${String(month).padStart(2, '0')}_${exportLineGroup}`;
            const exportMonthSignatures = allMonthSignatures[exportMonthKey] || { ...defaultSignature };
            const formData = {
                preparedBySignature: exportMonthSignatures.preparedBy,
                approvedBySignature: exportMonthSignatures.approvedBy
            };

            const sshReportData = {
                report_name: reportName,
                entries: entriesArray,
                lineGroup: exportLineGroup,
                form_data: formData,
                year,
                month
            };

            console.log('Sending to Excel generator:', sshReportData);

            const response = await fetch(`${SSH_API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sshReportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Excel generation error:', errorText);
                throw new Error('Failed to generate Excel report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Excel report generated successfully');
        } catch (error) {
            console.error('Error generating Excel:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to generate Excel report');
        } finally {
            setIsLoading(false);
        }
    }, [currentDate, months, SSH_API_BASE_URL, showAlert, allMonthSignatures, selectedExportLineGroup]);

    // Reset form
    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setShowShiftSelector(false);
        setHasUnsavedChanges(false);
    }, []);

    // Handle back to home with unsaved changes check
    const handleBackToHome = useCallback(() => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave?',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: () => {
                    navigate('/home');
                }
            });
        } else {
            navigate('/home');
        }
    }, [hasUnsavedChanges, navigate, showConfirm]);

    // Get shift icon based on shift
    const getShiftIcon = useCallback((shift: 'A' | 'B' | 'C') => {
        switch (shift) {
            case 'A': return <Sun className="w-3 h-3 text-amber-500" />;
            case 'B': return <Sunset className="w-3 h-3 text-orange-500" />;
            case 'C': return <Moon className="w-3 h-3 text-indigo-500" />;
            default: return null;
        }
    }, []);

    // Get result indicator for shift showing combined status
    const getShiftResultIndicator = useCallback((entry: DailyEntry | undefined) => {
        if (!entry || !entry.lines) return <CircleOff className="w-3 h-3 text-gray-400" />;

        const line1Pass = isSSHResultPass(entry.lines['1']?.result);
        const line2Pass = isSSHResultPass(entry.lines['2']?.result);
        const line1Fail = isSSHResultFail(entry.lines['1']?.result);
        const line2Fail = isSSHResultFail(entry.lines['2']?.result);

        if (line1Pass && line2Pass) return <CircleDot className="w-3 h-3 text-green-500" />;
        if (line1Fail || line2Fail) return <Circle className="w-3 h-3 text-red-500" />;
        if (hasSSHResultValue(entry.lines['1']?.result) || hasSSHResultValue(entry.lines['2']?.result)) return <Circle className="w-3 h-3 text-yellow-500" />;

        return <CircleOff className="w-3 h-3 text-gray-400" />;
    }, []);

    // Generate calendar days for current month
    const renderCalendarDays = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        const todayStr = new Date().toISOString().split('T')[0];

        console.log(`Rendering calendar for ${year}-${month + 1}`);

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEntries = dateEntries[dateStr] || {};
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            // Determine overall day status
            let hasPass = false;
            let hasFail = false;
            let hasAny = false;

            Object.values(dayEntries).flatMap(group => Object.values(group || {})).forEach((shiftEntry: DailyEntry) => {
                if (shiftEntry?.lines) {
                    if (isSSHResultPass(shiftEntry.lines['1']?.result) || isSSHResultPass(shiftEntry.lines['2']?.result)) hasPass = true;
                    if (isSSHResultFail(shiftEntry.lines['1']?.result) || isSSHResultFail(shiftEntry.lines['2']?.result)) hasFail = true;
                    if (hasSSHResultValue(shiftEntry.lines['1']?.result) || hasSSHResultValue(shiftEntry.lines['2']?.result)) hasAny = true;
                }
            });

            let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

            if (hasPass && !hasFail) {
                statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
            } else if (hasFail) {
                statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
            } else if (hasAny) {
                statusClass = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
            }

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`
                        relative p-2 rounded-lg border-2 transition-all min-h-[100px]
                        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : statusClass}
                        ${isToday ? 'font-bold' : ''}
                        hover:shadow-md hover:-translate-y-0.5
                        ${!hasAny ? 'hover:border-blue-300' : ''}
                    `}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm dark:text-white">{i}</span>
                    </div>

                    {/* Shift indicators with line details */}
                    <div className="flex flex-col gap-1 mt-1">
                        {SHIFTS.map(shift => {
                            const entry = dateEntries[dateStr]?.[selectedLineGroup]?.[shift];
                            return (
                                <div key={shift} className="flex flex-col gap-0.5 text-xs">
                                    <div className="flex items-center gap-1">
                                        {getShiftIcon(shift)}
                                        {getShiftResultIndicator(entry)}
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </button>
            );
        }
        return days;
    }, [currentDate, dateEntries, selectedDate, handleDateSelect, getShiftIcon, getShiftResultIndicator]);

    const handleAddSignature = useCallback((section: 'prepared' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        const monthKey = getCurrentMonthKey();
        const currentSignatures = allMonthSignatures[monthKey] || { ...defaultSignature };

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section for this month`);
            return;
        }

        if (section === 'prepared' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can sign');
            return;
        }

        if (section === 'approved' && !['Manager', 'Supervisor'].includes(userRole || '')) {
            showAlert('error', 'Only Managers or Supervisors can approve');
            return;
        }

        // Update signatures for current month
        setAllMonthSignatures(prev => ({
            ...prev,
            [monthKey]: {
                ...(prev[monthKey] || defaultSignature),
                [`${section}By`]: username
            }
        }));

        setHasUnsavedChanges(true);
        showAlert('success', `Signature added to ${section} section for ${monthKey}`);
    }, [username, userRole, allMonthSignatures, getCurrentMonthKey, showAlert]);

    const handleRemoveSignature = useCallback((section: 'prepared' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        const monthKey = getCurrentMonthKey();
        const currentSignatures = allMonthSignatures[monthKey] || { ...defaultSignature };

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }

        // Update signatures for current month
        setAllMonthSignatures(prev => ({
            ...prev,
            [monthKey]: {
                ...(prev[monthKey] || defaultSignature),
                [`${section}By`]: ''
            }
        }));

        setHasUnsavedChanges(true);
        showAlert('info', `Signature removed from ${section} section for ${monthKey}`);
    }, [username, allMonthSignatures, getCurrentMonthKey, showAlert]);

    const canAddSignature = useCallback((section: 'prepared' | 'approved') => {
        if (!username) return false;

        const monthKey = getCurrentMonthKey();
        const currentSignatures = allMonthSignatures[monthKey] || { ...defaultSignature };

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        if (currentSignature.trim()) return false;

        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'approved':
                // Allow both Manager and Supervisor to approve
                return ['Manager', 'Supervisor'].includes(userRole || '');
            default:
                return false;
        }
    }, [username, userRole, allMonthSignatures, getCurrentMonthKey]);

    const canRemoveSignature = useCallback((section: 'prepared' | 'approved') => {
        if (!username) return false;

        const monthKey = getCurrentMonthKey();
        const currentSignatures = allMonthSignatures[monthKey] || { ...defaultSignature };

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        return currentSignature.includes(username);
    }, [username, allMonthSignatures, getCurrentMonthKey]);

    return (
        <>
            <div className="mx-auto">
                <div className="text-center mb-2">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 dark:bg-gray-800/20 text-black dark:text-white border-2 border-blue-500 px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-blue-300 hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-3 text-gray-700 dark:text-gray-300">Loading...</p>
                        </div>
                    </div>
                )}
                {showExportLineSelector && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold dark:text-white">Select Line Group</h3>
                                <button
                                    onClick={() => setShowExportLineSelector(false)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 dark:text-white" />
                                </button>
                            </div>
                            <select
                                value={selectedExportLineGroup}
                                onChange={(e) => setSelectedExportLineGroup(e.target.value as LineGroup)}
                                className="w-full p-2.5 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {LINE_GROUPS.map(lineGroup => (
                                    <option key={lineGroup} value={lineGroup}>{getLineGroupLabel(lineGroup)}</option>
                                ))}
                            </select>
                            <div className="flex justify-end gap-3 mt-5">
                                <button
                                    onClick={() => setShowExportLineSelector(false)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowExportLineSelector(false);
                                        handleExportMonthlyExcel(selectedExportLineGroup);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <TestHeading
                    heading="Sealant Shore Hardness Test"
                    criteria="≥ 39 Shore A"
                />
                {showShiftSelector && selectedDate && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold dark:text-white">
                                    Select Shift for {new Date(selectedDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </h3>
                                <button
                                    onClick={handleCloseShiftSelector}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 dark:text-white" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {LINE_GROUPS.map(lineGroup => (
                                    <button
                                        key={lineGroup}
                                        onClick={() => setSelectedLineGroup(lineGroup)}
                                        className={`p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${selectedLineGroup === lineGroup
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white'}`}
                                    >
                                        {getLineGroupLabel(lineGroup)}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {SHIFTS.map(shift => {
                                    const entry = dateEntries[selectedDate]?.[selectedLineGroup]?.[shift];
                                    const isFilled = !!entry;
                                    const line1Pass = isSSHResultPass(entry?.lines['1']?.result);
                                    const line2Pass = isSSHResultPass(entry?.lines['2']?.result);
                                    const line1Fail = isSSHResultFail(entry?.lines['1']?.result);
                                    const line2Fail = isSSHResultFail(entry?.lines['2']?.result);

                                    return (
                                        <button
                                            key={shift}
                                            onClick={() => handleShiftSelect(selectedLineGroup, shift)}
                                            className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3
                                                ${isFilled
                                                    ? line1Pass && line2Pass
                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                                        : line1Fail || line2Fail
                                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                                                            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className="flex-shrink-0">
                                                {shift === 'A' && <Sun className="w-6 h-6 text-amber-500" />}
                                                {shift === 'B' && <Sunset className="w-6 h-6 text-orange-500" />}
                                                {shift === 'C' && <Moon className="w-6 h-6 text-indigo-500" />}
                                            </div>
                                            <div className="flex-grow text-left">
                                                <div className="font-semibold dark:text-white">Shift {shift}</div>
                                                {isFilled ? (
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                        <div>PO: {entry?.po}</div>
                                                        <div>Line 1: {entry?.lines['1']?.result}</div>
                                                        <div>Line 2: {entry?.lines['2']?.result}</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 dark:text-gray-500">
                                                        No entry yet
                                                    </div>
                                                )}
                                            </div>
                                            {isFilled && (
                                                <div className="flex-shrink-0">
                                                    {line1Pass && line2Pass &&
                                                        <CheckCircle className="w-5 h-5 text-green-500" />}
                                                    {(line1Fail || line2Fail) &&
                                                        <AlertCircle className="w-5 h-5 text-red-500" />}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7 space-y-6">
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-6">
                                    <div className="flex gap-1 items-center">
                                        <button
                                            onClick={handlePrevMonth}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5 dark:text-white" />
                                        </button>

                                        <div className="flex gap-2">
                                            <select
                                                value={currentDate.getMonth()}
                                                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                                                className="p-2 pr-4 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                            >
                                                {months.map((month, index) => (
                                                    <option key={month} value={index}>
                                                        {month}
                                                    </option>
                                                ))}
                                            </select>

                                            <select
                                                value={currentDate.getFullYear()}
                                                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                                                className="p-2 pr-4 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                            >
                                                {years.map(year => (
                                                    <option key={year} value={year}>
                                                        {year}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            onClick={handleNextMonth}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5 dark:text-white" />
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleTodayEntry}
                                            className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                        >
                                            Today
                                        </button>

                                        <button
                                            onClick={() => setShowExportLineSelector(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
                                            title={`Export ${months[currentDate.getMonth()]} ${currentDate.getFullYear()} as Excel`}
                                        >
                                            <img
                                                src="/IMAGES/Excel.svg"
                                                alt="Excel"
                                                className="w-6 h-6 filter brightness-0 invert dark:brightness-0 dark:invert"
                                            />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-2 mb-2">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {renderCalendarDays()}
                                </div>
                                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-200 border border-green-500"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Pass</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-200 border border-red-500"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Fail</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-gray-200 border border-gray-500"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">No Entry</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <Sun className="w-3 h-3 text-amber-500" />
                                            <span className="text-xs text-gray-600 dark:text-gray-400">A</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Sunset className="w-3 h-3 text-orange-500" />
                                            <span className="text-xs text-gray-600 dark:text-gray-400">B</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Moon className="w-3 h-3 text-indigo-500" />
                                            <span className="text-xs text-gray-600 dark:text-gray-400">C</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {currentEntry && selectedShift && (
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold dark:text-white">
                                            {isEditing ? 'Edit Entry' : 'New Entry'} - {new Date(currentEntry.testingDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })} (Shift {currentEntry.shift})
                                        </h3>
                                        <div className="flex gap-2">
                                            {isEditing && (
                                                <button
                                                    onClick={handleDeleteEntry}
                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={handleReset}
                                                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                title="Cancel"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                {currentEntry.shift === 'A' && <Sun className="w-5 h-5 text-amber-500" />}
                                                {currentEntry.shift === 'B' && <Sunset className="w-5 h-5 text-orange-500" />}
                                                {currentEntry.shift === 'C' && <Moon className="w-5 h-5 text-indigo-500" />}
                                                <span className="font-medium dark:text-white">Shift {currentEntry.shift}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 items-start ml-auto">
                                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Checked By
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.checkedBy}
                                                    onChange={(e) => handleInputChange('checkedBy', e.target.value)}
                                                    className="w-full p-2 rounded-lg text-sm dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter checker name"
                                                />
                                            </div>
                                        </div>
                                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                PO Number
                                            </label>
                                            <input
                                                type="text"
                                                value={currentEntry.po}
                                                onChange={(e) => handleInputChange('po', e.target.value)}
                                                className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Enter PO number for both lines"
                                            />
                                        </div>
                                        <div className="border-l-4 border-blue-500 pl-4">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm">1</span>
                                                Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[0]} Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Supplier
                                                    </label>
                                                    <select
                                                        value={currentEntry.lines['1'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantSupplier', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select</option>
                                                        <option value="Huitan">Huitan</option>
                                                        <option value="Tonsan (HB fuller)">Tonsan (HB fuller)</option>
                                                        <option value="Adarsha Speciality">Adarsha Speciality</option>
                                                        <option value="Fasto">Fasto</option>
                                                        <option value="N/A">N/A</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Expiry Date
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].sealantExpDate}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantExpDate', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sample Taking Time
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].sampleTakingTime}
                                                        onChange={(e) => handleLineInputChange('1', 'sampleTakingTime', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="HH:MM"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sample Testing Time
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].sampleTestingTime}
                                                        onChange={(e) => handleLineInputChange('1', 'sampleTestingTime', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="HH:MM"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Result (Shore A)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={getResultInputValue(currentEntry.lines['1'].result)}
                                                        onChange={(e) => handleLineInputChange('1', 'result', e.target.value)}
                                                        className={`w-full p-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${getResultInputClass(currentEntry.lines['1'].result)}`}
                                                        placeholder="Enter Shore A value"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 lg:col-span-3">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[0]})
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['1'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('1', 'remarks', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Add any remarks for Line 1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-l-4 border-green-500 pl-4 mt-6">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 text-sm">2</span>
                                                Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[1]} Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Supplier
                                                    </label>
                                                    <select
                                                        value={currentEntry.lines['2'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantSupplier', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select</option>
                                                        <option value="Huitan">Huitan</option>
                                                        <option value="Tonsan (HB fuller)">Tonsan (HB fuller)</option>
                                                        <option value="Adarsha Speciality">Adarsha Speciality</option>
                                                        <option value="Fasto">Fasto</option>
                                                        <option value="N/A">N/A</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Expiry Date
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].sealantExpDate}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantExpDate', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sample Taking Time
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].sampleTakingTime}
                                                        onChange={(e) => handleLineInputChange('2', 'sampleTakingTime', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="HH:MM"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sample Testing Time
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].sampleTestingTime}
                                                        onChange={(e) => handleLineInputChange('2', 'sampleTestingTime', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="HH:MM"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Result (Shore A)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={getResultInputValue(currentEntry.lines['2'].result)}
                                                        onChange={(e) => handleLineInputChange('2', 'result', e.target.value)}
                                                        className={`w-full p-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${getResultInputClass(currentEntry.lines['2'].result)}`}
                                                        placeholder="Enter Shore A value"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 lg:col-span-3">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[1]})
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['2'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('2', 'remarks', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Add any remarks for Line 2"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={handleReset}
                                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEntry}
                                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                {isEditing ? 'Update Entry' : 'Save Entry'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Panel - Statistics */}
                        <div className="lg:col-span-5 space-y-6">
                            {/* Quick Stats Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <Percent className="w-5 h-5 text-blue-500" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Completion</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.completionRate}%
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.filledEntries} / {monthlyStats.totalPossibleEntries} entries
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <Target className="w-5 h-5 text-green-500" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Pass Rate</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.filledEntries > 0
                                            ? Math.round((monthlyStats.passCount / monthlyStats.filledEntries) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.passCount} passed
                                    </div>
                                </div>
                            </div>

                            {/* Shift Statistics */}
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    Shift-wise Statistics
                                </h3>
                                <div className="space-y-4">
                                    {SHIFTS.map(shift => {
                                        const stats = monthlyStats.shiftStats?.[shift] || {
                                            filled: 0,
                                            pass: 0,
                                            fail: 0,
                                            lines: { '1': 0, '2': 0 }
                                        };

                                        // Ensure lines property exists
                                        const lines = stats.lines || { '1': 0, '2': 0 };

                                        const shiftIcon = shift === 'A' ? <Sun className="w-4 h-4 text-amber-500" /> :
                                            shift === 'B' ? <Sunset className="w-4 h-4 text-orange-500" /> :
                                                <Moon className="w-4 h-4 text-indigo-500" />;

                                        return (
                                            <div key={shift} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {shiftIcon}
                                                        <span className="font-medium dark:text-white">Shift {shift}</span>
                                                    </div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {stats.filled} / {monthlyStats.totalDays * 2} lines
                                                    </span>
                                                </div>
                                                <div className="flex gap-4 text-xs">
                                                    <span className="text-green-600">Pass: {stats.pass}</span>
                                                    <span className="text-red-600">Fail: {stats.fail}</span>
                                                </div>
                                                <div className="flex gap-2 text-[10px] text-gray-500">
                                                    <span>Line 1: {lines['1']}</span>
                                                    <span>Line 2: {lines['2']}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${monthlyStats.totalDays > 0 ? (stats.filled / (monthlyStats.totalDays * 2)) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <BarChart3 className="w-4 h-4 text-blue-500" />
                                    {months[currentDate.getMonth()]} {currentDate.getFullYear()} Summary
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Total Days</span>
                                        <span className="font-semibold dark:text-white">{monthlyStats.totalDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Total Possible Entries (Lines)</span>
                                        <span className="font-semibold dark:text-white">{monthlyStats.totalPossibleEntries}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Filled Entries</span>
                                        <span className="font-semibold text-green-600">{monthlyStats.filledEntries}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Missing Entries</span>
                                        <span className="font-semibold text-red-500">{monthlyStats.totalPossibleEntries - monthlyStats.filledEntries}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    Results Breakdown
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-green-600">Pass</span>
                                            <span className="font-medium text-green-600">{monthlyStats.passCount}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                style={{ width: `${monthlyStats.filledEntries > 0 ? (monthlyStats.passCount / monthlyStats.filledEntries) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-red-600">Fail</span>
                                            <span className="font-medium text-red-600">{monthlyStats.failCount}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-red-500 h-2 rounded-full transition-all"
                                                style={{ width: `${monthlyStats.filledEntries > 0 ? (monthlyStats.failCount / monthlyStats.filledEntries) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 mt-6">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                        Signatures for {months[currentDate.getMonth()]} {currentDate.getFullYear()} - {getLineGroupLabel(selectedLineGroup)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="text-center">
                            <p className=" text-sm font-bold text-gray-800 dark:text-white mb-2">PREPARED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-md font-semibold">{currentMonthSignatures.preparedBy}</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 mt-3">
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canAddSignature('prepared')
                                        ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleAddSignature('prepared')}
                                    disabled={!canAddSignature('prepared')}
                                >
                                    Add Signature
                                </button>
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canRemoveSignature('prepared')
                                        ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleRemoveSignature('prepared')}
                                    disabled={!canRemoveSignature('prepared')}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-gray-800 dark:text-white mb-2">APPROVED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-md font-semibold">{currentMonthSignatures.approvedBy}</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 mt-3">
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canAddSignature('approved')
                                        ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleAddSignature('approved')}
                                    disabled={!canAddSignature('approved')}
                                >
                                    Add Signature
                                </button>
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canRemoveSignature('approved')
                                        ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleRemoveSignature('approved')}
                                    disabled={!canRemoveSignature('approved')}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
