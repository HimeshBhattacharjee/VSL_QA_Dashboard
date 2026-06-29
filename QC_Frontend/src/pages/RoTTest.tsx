import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import FabLineSelectionModal from '../components/FabLineSelectionModal';
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Trash2, Save, X, BarChart3, Percent, Target, TrendingUp } from 'lucide-react';
import {
    DEFAULT_LINE_GROUP,
    LINE_GROUPS,
    buildLineWiseMonthlyStats,
    getLineEntryKey,
    getLineGroupLabel,
    getMonthLineSignatures,
    migrateMonthLineSignatures,
    normalizeDateString,
    normalizeLineGroup,
    setMonthLineSignatures,
    type LineGroup,
    type MonthLineSignatureData,
    type MonthlyStats
} from '../utilities/lineWiseTestUtils';

interface DailyEntry {
    date: string;
    testingDate: string;
    lineGroup?: LineGroup;
    po: string;
    moduleType: string;
    moduleSerial: string;
    jbSupplier: string;
    sealantSupplier: string;
    backsheetSupplier: string;
    result: 'Pass' | 'Fail' | '';
    testDoneBy: string;
    remarks?: string;
    [key: string]: unknown;
}

interface SignatureData {
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
}

const defaultSignature: SignatureData = {
    preparedBy: '',
    reviewedBy: '',
    approvedBy: ''
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
] as const;

const entryRequiredFields: Array<{
    key: keyof Pick<DailyEntry, 'po' | 'moduleType' | 'moduleSerial' | 'jbSupplier' | 'sealantSupplier' | 'backsheetSupplier' | 'result' | 'testDoneBy'>;
    label: string;
}> = [
    { key: 'po', label: 'P.O. Number' },
    { key: 'moduleType', label: 'Module Type' },
    { key: 'moduleSerial', label: 'Module Serial No.' },
    { key: 'jbSupplier', label: 'JB Supplier' },
    { key: 'sealantSupplier', label: 'Sealant Supplier' },
    { key: 'backsheetSupplier', label: 'Rear Glass/ Backsheet Supplier' },
    { key: 'result', label: 'Result' },
    { key: 'testDoneBy', label: 'Test Done By' }
];

const normalizeFieldValue = (value?: string) => value?.trim() ?? '';

const getRequiredEntryDetails = (entry: DailyEntry) =>
    entryRequiredFields.map(({ key, label }) => ({
        label,
        value: normalizeFieldValue(entry[key] as string | undefined)
    }));

const getEntryValidationMessage = (entry: DailyEntry): string | null => {
    const requiredDetails = getRequiredEntryDetails(entry);
    const filledDetails = requiredDetails.filter(({ value }) => value !== '');

    if (filledDetails.length === 0) {
        return 'Please fill the entry details before saving.';
    }

    if (filledDetails.length !== requiredDetails.length) {
        const firstMissingDetail = requiredDetails.find(({ value }) => value === '');
        return `Please complete all entry fields before saving. Missing: ${firstMissingDetail?.label}.`;
    }

    return null;
};

const getResultSelectClass = (result: DailyEntry['result']) => {
    if (result === 'Pass') {
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
    }

    if (result === 'Fail') {
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
    }

    return 'dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
};

export default function RoTTest() {
    const [_, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const months = useMemo(() => [...MONTH_NAMES], []);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedLineGroup, setSelectedLineGroup] = useState<LineGroup>(DEFAULT_LINE_GROUP);
    const [showLineSelector, setShowLineSelector] = useState(false);
    const [showExportLineSelector, setShowExportLineSelector] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
        totalDays: 0,
        filledDays: 0,
        completionRate: 0,
        passCount: 0,
        failCount: 0
    });
    
    const [allMonthSignatures, setAllMonthSignatures] = useState<MonthLineSignatureData<SignatureData>>(() => {
        const saved = localStorage.getItem('rotAllMonthSignatures');
        return migrateMonthLineSignatures(saved, defaultSignature, months);
    });

    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const ROT_API_BASE_URL = import.meta.env.VITE_API_URL + '/rot-test-reports';
    
    const normalizeDate = useCallback(normalizeDateString, []);

    const currentMonthSignatures = useMemo(() => {
        return getMonthLineSignatures(
            allMonthSignatures,
            currentDate.getFullYear(),
            months[currentDate.getMonth()],
            selectedLineGroup,
            defaultSignature
        );
    }, [allMonthSignatures, currentDate, months, selectedLineGroup]);

    useEffect(() => {
        localStorage.setItem('rotAllMonthSignatures', JSON.stringify(allMonthSignatures));
    }, [allMonthSignatures]);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i), [currentDate]);

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            console.log(`Loading data for ${year}-${month}`);

            const entriesUrl = `${ROT_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const entriesResponse = await fetch(entriesUrl);
            const entriesJson = await entriesResponse.json();

            console.log('Entries response:', entriesJson);
            let entriesArr: DailyEntry[] = [];
            if (entriesJson.data && Array.isArray(entriesJson.data)) {
                entriesArr = entriesJson.data;
            } else if (Array.isArray(entriesJson)) {
                entriesArr = entriesJson;
            }

            console.log(`Found ${entriesArr.length} entries for ${year}-${month}`);

            // Convert entries array to Map
            const entriesMap = new Map<string, DailyEntry>();
            entriesArr.forEach((entry: DailyEntry) => {
                const normalizedDate = normalizeDate(entry.date);
                const lineGroup = normalizeLineGroup(entry.lineGroup);
                entriesMap.set(getLineEntryKey(normalizedDate, lineGroup), {
                    ...entry,
                    date: normalizedDate,
                    testingDate: normalizeDate(entry.testingDate || normalizedDate),
                    lineGroup
                });
            });

            setMonthlyEntries(entriesMap);

            const newStats = buildLineWiseMonthlyStats(
                entriesMap.values(),
                new Date(year, month, 0).getDate(),
                entry => entry.result === 'Pass',
                entry => entry.result === 'Fail'
            );

            console.log('Setting stats:', newStats);
            setMonthlyStats(newStats);

            // If there was a previously selected date, try to load its entry
            if (selectedDate) {
                const entry = entriesMap.get(getLineEntryKey(selectedDate, selectedLineGroup));
                if (entry) {
                    setCurrentEntry(entry);
                    setIsEditing(true);
                }
            }

        } catch (error) {
            console.error('Error loading monthly data:', error);
            // Set empty data on error
            setMonthlyEntries(new Map());
            setMonthlyStats({
                totalDays: new Date(year, month, 0).getDate() * LINE_GROUPS.length,
                filledDays: 0,
                completionRate: 0,
                passCount: 0,
                failCount: 0
            });
        } finally {
            setIsLoading(false);
        }
    }, [ROT_API_BASE_URL, selectedDate, selectedLineGroup, normalizeDate]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        loadMonthlyData(year, month);
    }, [currentDate, loadMonthlyData]);

    // Handle month navigation
    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setCurrentEntry(null);
        setShowLineSelector(false);
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setCurrentEntry(null);
        setShowLineSelector(false);
    }, []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setCurrentEntry(null);
        setShowLineSelector(false);
    }, []);

    const handleYearChange = useCallback((year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setCurrentEntry(null);
        setShowLineSelector(false);
    }, []);

    // Handle date selection
    const handleDateSelect = useCallback((date: string) => {
        const normalized = normalizeDate(date);
        setSelectedDate(normalized);
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setCurrentEntry(null);
        setShowLineSelector(true);
    }, [normalizeDate]);

    const createEmptyEntry = useCallback((date: string, lineGroup: LineGroup): DailyEntry => ({
        date,
        testingDate: date,
        lineGroup,
        po: '',
        moduleType: '',
        moduleSerial: '',
        jbSupplier: '',
        sealantSupplier: '',
        backsheetSupplier: '',
        result: '',
        testDoneBy: username || '',
        remarks: ''
    }), [username]);

    const handleLineSelect = useCallback((lineGroup: LineGroup) => {
        if (!selectedDate) return;

        setSelectedLineGroup(lineGroup);
        setShowLineSelector(false);

        const entry = monthlyEntries.get(getLineEntryKey(selectedDate, lineGroup));

        if (entry) {
            console.log('Loading existing entry:', entry);
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            console.log('Creating new entry for date:', selectedDate, 'line:', lineGroup);
            setCurrentEntry(createEmptyEntry(selectedDate, lineGroup));
            setIsEditing(false);
        }
    }, [selectedDate, monthlyEntries, createEmptyEntry]);

    const handleCloseLineSelector = useCallback(() => {
        setShowLineSelector(false);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
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

    // Handle form input change
    const handleInputChange = useCallback((field: keyof DailyEntry, value: string) => {
        if (!currentEntry) return;
        setCurrentEntry({
            ...currentEntry,
            [field]: value
        });
        setHasUnsavedChanges(true);
    }, [currentEntry]);

    const handleSaveEntry = useCallback(async () => {
        if (!currentEntry || !currentEntry.testingDate) {
            showAlert('error', 'Please enter a valid date');
            return;
        }

        const validationMessage = getEntryValidationMessage(currentEntry);
        if (validationMessage) {
            showAlert('error', validationMessage);
            return;
        }

        setIsLoading(true);
        try {
            const entryToSave: DailyEntry = {
                ...currentEntry,
                lineGroup: selectedLineGroup,
                date: normalizeDate(currentEntry.date),
                testingDate: normalizeDate(currentEntry.testingDate)
            };

            console.log('Saving entry:', entryToSave);

            const response = await fetch(`${ROT_API_BASE_URL}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entryToSave),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            const result = await response.json();
            console.log('Save response:', result);

            // Update local state with the saved entry
            const saved = (result.data && result.data.entry ? result.data.entry : entryToSave) as DailyEntry;
            const normalized = normalizeDate(saved.date);
            const savedLineGroup = normalizeLineGroup(saved.lineGroup);
            const normalizedSavedEntry = {
                ...saved,
                date: normalized,
                testingDate: normalizeDate(saved.testingDate || normalized),
                lineGroup: savedLineGroup
            };
            const updatedEntries = new Map(monthlyEntries);
            updatedEntries.set(getLineEntryKey(normalized, savedLineGroup), normalizedSavedEntry);
            setMonthlyEntries(updatedEntries);
            setCurrentEntry(normalizedSavedEntry);
            setSelectedLineGroup(savedLineGroup);
            setIsEditing(true);

            setMonthlyStats(buildLineWiseMonthlyStats(
                updatedEntries.values(),
                new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(),
                entry => entry.result === 'Pass',
                entry => entry.result === 'Fail'
            ));

            setHasUnsavedChanges(false);
            showAlert('success', result.message || 'Entry saved successfully');

        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    }, [currentEntry, selectedLineGroup, monthlyEntries, ROT_API_BASE_URL, showAlert, normalizeDate, currentDate]);

    const handleDeleteEntry = useCallback(() => {
        if (!currentEntry) return;
        const lineGroup = normalizeLineGroup(currentEntry.lineGroup || selectedLineGroup);

        showConfirm({
            title: 'Delete Entry',
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} - ${getLineGroupLabel(lineGroup)}?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const dateKey = normalizeDate(currentEntry.date);
                    const response = await fetch(`${ROT_API_BASE_URL}/entries/${dateKey}/${lineGroup}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete entry');
                    }

                    await response.json();

                    // Update local state
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(getLineEntryKey(dateKey, lineGroup));
                    setMonthlyEntries(updatedEntries);

                    setMonthlyStats(buildLineWiseMonthlyStats(
                        updatedEntries.values(),
                        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(),
                        entry => entry.result === 'Pass',
                        entry => entry.result === 'Fail'
                    ));

                    setCurrentEntry(null);
                    setSelectedDate('');
                    setSelectedLineGroup(DEFAULT_LINE_GROUP);
                    showAlert('info', 'Entry deleted successfully');
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    }, [currentEntry, selectedLineGroup, monthlyEntries, ROT_API_BASE_URL, showAlert, showConfirm, normalizeDate, currentDate]);

    // Export monthly Excel report
    const handleExportMonthlyExcel = useCallback(async (exportLineGroup: LineGroup) => {
        const monthName = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        const firstThreeLetters = monthName.substring(0, 3);
        const reportName = `Robustness_of_Termination_Test_${firstThreeLetters}_${year}`;

        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');

            // Fetch full monthly JSON from backend, then extract per-day data for Excel
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1; // backend expects 1-12

            const monthlyResp = await fetch(`${ROT_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResp.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResp.json();
            const entriesByDate = new Map<string, DailyEntry>();
            (Array.isArray(monthlyJson?.data) ? monthlyJson.data : [])
                .filter((entry: DailyEntry) => normalizeLineGroup(entry.lineGroup) === exportLineGroup)
                .forEach((entry: DailyEntry) => {
                    const normalizedDate = normalizeDate(entry.date);
                    entriesByDate.set(normalizedDate, {
                        ...entry,
                        date: normalizedDate,
                        testingDate: normalizeDate(entry.testingDate || entry.date),
                        lineGroup: exportLineGroup
                    });
                });
            const entriesArray = Array.from(entriesByDate.values());

            const exportSignatures = getMonthLineSignatures(
                allMonthSignatures,
                year,
                monthName,
                exportLineGroup,
                defaultSignature
            );

            // Get signatures from current month state
            const formData = {
                preparedBySignature: exportSignatures.preparedBy,
                reviewedBySignature: exportSignatures.reviewedBy,
                approvedBySignature: exportSignatures.approvedBy
            };

            const rotReportData = {
                report_name: reportName,
                entries: entriesArray,
                form_data: formData,
                year,
                month
            };

            const response = await fetch(`${ROT_API_BASE_URL}/generate-rot-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rotReportData),
            });

            if (!response.ok) {
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
            showAlert('error', 'Failed to generate Excel report');
        } finally {
            setIsLoading(false);
        }
    }, [currentDate, months, ROT_API_BASE_URL, showAlert, normalizeDate, allMonthSignatures]);

    // Reset form
    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setShowLineSelector(false);
        setHasUnsavedChanges(false);
    }, []);

    // Generate calendar days for current month
    const renderCalendarDays = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        const todayStr = new Date().toISOString().split('T')[0];

        console.log(`Rendering calendar for ${year}-${month + 1} with ${monthlyEntries.size} entries`);

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dateEntries = LINE_GROUPS
                .map(lineGroup => monthlyEntries.get(getLineEntryKey(dateStr, lineGroup)))
                .filter((entry): entry is DailyEntry => Boolean(entry));
            const entry = dateEntries[0];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
            let statusIcon = null;

            if (dateEntries.length > 0) {
                if (dateEntries.some(dateEntry => dateEntry.result === 'Fail')) {
                    statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                    statusIcon = <AlertCircle className="w-4 h-4 text-red-500" />;
                } else if (dateEntries.some(dateEntry => dateEntry.result === 'Pass')) {
                    statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                    statusIcon = <CheckCircle className="w-4 h-4 text-green-500" />;
                }
            }

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`
                        relative p-3 rounded-lg border-2 transition-all
                        ${isSelected ? 'ring-2 ring-brand-primary border-brand-primary' : statusClass}
                        ${isToday ? 'font-bold' : ''}
                        hover:shadow-md hover:-translate-y-0.5
                        ${dateEntries.length === 0 ? 'hover:border-brand-primary/40' : ''}
                    `}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm dark:text-white">{i}</span>
                        {statusIcon}
                    </div>
                    {entry && (
                        <div className="mt-1 text-xs text-left truncate max-w-full font-medium dark:text-white">
                            {dateEntries.length > 1 ? `${dateEntries.length} lines` : getLineGroupLabel(normalizeLineGroup(entry.lineGroup))}
                        </div>
                    )}
                </button>
            );
        }

        return days;
    }, [currentDate, monthlyEntries, selectedDate, handleDateSelect]);

    // Signature handlers
    const handleAddSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        const signatureYear = currentDate.getFullYear();
        const signatureMonth = months[currentDate.getMonth()];
        const currentSignatures = getMonthLineSignatures(
            allMonthSignatures,
            signatureYear,
            signatureMonth,
            selectedLineGroup,
            defaultSignature
        );

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = currentSignatures.reviewedBy;
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

        // Updated to allow both Supervisors and Managers to review and approve
        if (section === 'reviewed' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can review');
            return;
        }

        if (section === 'approved' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can approve');
            return;
        }

        const signatureKey = `${section}By` as keyof SignatureData;
        const updatedSignatures = {
            ...currentSignatures,
            [signatureKey]: username
        };

        setAllMonthSignatures(prev => setMonthLineSignatures(
            prev,
            signatureYear,
            signatureMonth,
            selectedLineGroup,
            updatedSignatures
        ));

        setHasUnsavedChanges(true);
        showAlert('success', `Signature added to ${section} section for ${signatureMonth} ${signatureYear} - ${getLineGroupLabel(selectedLineGroup)}`);
    }, [username, userRole, allMonthSignatures, currentDate, months, selectedLineGroup, showAlert]);

    const handleRemoveSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        const signatureYear = currentDate.getFullYear();
        const signatureMonth = months[currentDate.getMonth()];
        const currentSignatures = getMonthLineSignatures(
            allMonthSignatures,
            signatureYear,
            signatureMonth,
            selectedLineGroup,
            defaultSignature
        );

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = currentSignatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }

        const signatureKey = `${section}By` as keyof SignatureData;
        const updatedSignatures = {
            ...currentSignatures,
            [signatureKey]: ''
        };

        setAllMonthSignatures(prev => setMonthLineSignatures(
            prev,
            signatureYear,
            signatureMonth,
            selectedLineGroup,
            updatedSignatures
        ));

        setHasUnsavedChanges(true);
        showAlert('info', `Signature removed from ${section} section for ${signatureMonth} ${signatureYear} - ${getLineGroupLabel(selectedLineGroup)}`);
    }, [username, allMonthSignatures, currentDate, months, selectedLineGroup, showAlert]);

    const canAddSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) return false;

        const currentSignatures = getMonthLineSignatures(
            allMonthSignatures,
            currentDate.getFullYear(),
            months[currentDate.getMonth()],
            selectedLineGroup,
            defaultSignature
        );

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = currentSignatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        if (currentSignature.trim()) return false;

        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'reviewed':
                // Allow both Supervisor and Manager to review
                return ['Supervisor', 'Manager'].includes(userRole || '');
            case 'approved':
                // Allow both Supervisor and Manager to approve
                return ['Supervisor', 'Manager'].includes(userRole || '');
            default:
                return false;
        }
    }, [username, userRole, allMonthSignatures, currentDate, months, selectedLineGroup]);

    const canRemoveSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) return false;

        const currentSignatures = getMonthLineSignatures(
            allMonthSignatures,
            currentDate.getFullYear(),
            months[currentDate.getMonth()],
            selectedLineGroup,
            defaultSignature
        );

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = currentSignatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = currentSignatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = currentSignatures.approvedBy;
                break;
        }

        return currentSignature.includes(username);
    }, [username, allMonthSignatures, currentDate, months, selectedLineGroup]);

    return (
        <>
            <div className="mx-auto">
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary mx-auto"></div>
                            <p className="mt-3 text-gray-700 dark:text-gray-300">Loading...</p>
                        </div>
                    </div>
                )}
                <FabLineSelectionModal
                    isOpen={showExportLineSelector}
                    title="Export Data"
                    question="Export data for:"
                    selectedLineGroup={selectedLineGroup}
                    onLineSelect={(lineGroup) => {
                        setShowExportLineSelector(false);
                        void handleExportMonthlyExcel(lineGroup);
                    }}
                    onClose={() => setShowExportLineSelector(false)}
                />
                <FabLineSelectionModal
                    isOpen={showLineSelector && Boolean(selectedDate)}
                    title="Select FAB Line"
                    question="Which FAB line do you want to fill details for?"
                    selectedLineGroup={selectedLineGroup}
                    onLineSelect={handleLineSelect}
                    onClose={handleCloseLineSelector}
                />
                <TestHeading
                    heading="Robustness of Terminations Test"
                    criteria="Get a weight of 5 kgs (40 N) in case of IEC and 15 kgs (156 N) in case of UL for all types of module. Tie the cables of the JB with the weight and hang it for 1 minute in 5 different directions."
                />
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
                                                className="p-2 pr-4 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary appearance-none cursor-pointer"
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
                                                className="p-2 pr-4 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary appearance-none cursor-pointer"
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
                                            className="px-4 py-2 bg-brand-primary-soft dark:bg-brand-primary/10 text-brand-primary dark:text-brand-primary-light rounded-lg text-sm font-medium hover:bg-brand-primary-muted dark:hover:bg-brand-primary/15 transition-colors"
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
                                </div>
                            </div>
                            {currentEntry && (
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold dark:text-white">
                                            {isEditing ? 'Edit Entry' : 'New Entry'} - {new Date(currentEntry.testingDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })} - {getLineGroupLabel(normalizeLineGroup(currentEntry.lineGroup))}
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

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    P.O. Number
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.po}
                                                    onChange={(e) => handleInputChange('po', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                    placeholder="Enter PO number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Module Type
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.moduleType}
                                                    onChange={(e) => handleInputChange('moduleType', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                    placeholder="Enter module type"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Module Serial No.
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.moduleSerial}
                                                    onChange={(e) => handleInputChange('moduleSerial', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                    placeholder="Enter serial number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    JB Supplier
                                                </label>
                                                <select
                                                    value={currentEntry.jbSupplier}
                                                    onChange={(e) => handleInputChange('jbSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="Suzhou UKT New Energy Technology Co. Ltd">Suzhou UKT New Energy Technology Co. Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sealant Supplier
                                                </label>
                                                <select
                                                    value={currentEntry.sealantSupplier}
                                                    onChange={(e) => handleInputChange('sealantSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
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
                                                    Rear Glass/ Backsheet Supplier
                                                </label>
                                                <select
                                                    value={currentEntry.backsheetSupplier}
                                                    onChange={(e) => handleInputChange('backsheetSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="Xinyi Solar">Xinyi Solar</option>
                                                    <option value="CSG Holding Co., Ltd.">CSG Holding Co., Ltd.</option>
                                                    <option value="Gurjat Borosil">Gurjat Borosil</option>
                                                    <option value="Kibing Group">Kibing Group</option>
                                                    <option value="Flat Glass Group Co., Ltd">Flat Glass Group Co., Ltd</option>
                                                    <option value="Henan Ancai Hi-Tech Co., Ltd">Henan Ancai Hi-Tech Co., Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Result
                                                </label>
                                                <select
                                                    value={currentEntry.result}
                                                    onChange={(e) => handleInputChange('result', e.target.value as 'Pass' | 'Fail')}
                                                    className={`w-full p-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-brand-primary ${getResultSelectClass(currentEntry.result)}`}
                                                >
                                                    <option value="">Select result</option>
                                                    <option value="Pass" className="bg-green-100 text-green-700">Pass</option>
                                                    <option value="Fail" className="bg-red-100 text-red-700">Fail</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Test Done By
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.testDoneBy}
                                                    onChange={(e) => handleInputChange('testDoneBy', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                    placeholder="Enter tester name"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Remarks
                                                </label>
                                                <textarea
                                                    value={currentEntry.remarks || ''}
                                                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                                                    rows={2}
                                                    className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                    placeholder="Add any remarks"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={handleReset}
                                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEntry}
                                                className="flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                {isEditing ? 'Update Entry' : 'Save Entry'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="lg:col-span-5 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <Percent className="w-5 h-5 text-brand-primary" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Completion</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.completionRate}%
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.filledDays} / {monthlyStats.totalDays} line entries
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <Target className="w-5 h-5 text-green-500" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Pass Rate</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.filledDays > 0
                                            ? Math.round((monthlyStats.passCount / monthlyStats.filledDays) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.passCount} passed
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <BarChart3 className="w-4 h-4 text-brand-primary" />
                                    {months[currentDate.getMonth()]} {currentDate.getFullYear()} Summary
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Total Line Entries</span>
                                        <span className="font-semibold dark:text-white">{monthlyStats.totalDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Filled Line Entries</span>
                                        <span className="font-semibold text-green-600">{monthlyStats.filledDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Missing Line Entries</span>
                                        <span className="font-semibold text-red-500">{monthlyStats.totalDays - monthlyStats.filledDays}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <TrendingUp className="w-4 h-4 text-brand-primary" />
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
                                                style={{ width: `${monthlyStats.filledDays > 0 ? (monthlyStats.passCount / monthlyStats.filledDays) * 100 : 0}%` }}
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
                                                style={{ width: `${monthlyStats.filledDays > 0 ? (monthlyStats.failCount / monthlyStats.filledDays) * 100 : 0}%` }}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <p className="text-sm font-bold text-gray-800 dark:text-white mb-2">PREPARED BY:</p>
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
                            <p className="text-sm font-bold text-gray-800 dark:text-white mb-2">REVIEWED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-md font-semibold">{currentMonthSignatures.reviewedBy}</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 mt-3">
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canAddSignature('reviewed')
                                        ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleAddSignature('reviewed')}
                                    disabled={!canAddSignature('reviewed')}
                                >
                                    Add Signature
                                </button>
                                <button
                                    className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${canRemoveSignature('reviewed')
                                        ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800'
                                        : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        }`}
                                    onClick={() => handleRemoveSignature('reviewed')}
                                    disabled={!canRemoveSignature('reviewed')}
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
