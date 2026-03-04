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

interface DailyEntry {
    date: string;
    testingDate: string;
    shift: 'A' | 'B' | 'C';
    po: string;
    line: string;
    sealantSupplier: string;
    sealantExpDate: string;
    sampleTakingTime: string;
    sampleTestingTime: string;
    result: 'Pass' | 'Fail' | '';
    checkedBy: string;
    remarks?: string;
    [key: string]: string | boolean | undefined;
}

interface DateEntries {
    [date: string]: {
        A?: DailyEntry;
        B?: DailyEntry;
        C?: DailyEntry;
    };
}

interface MonthlyStats {
    totalDays: number;
    totalPossibleEntries: number;
    filledEntries: number;
    completionRate: number;
    passCount: number;
    failCount: number;
    shiftStats: {
        A: { filled: number; pass: number; fail: number };
        B: { filled: number; pass: number; fail: number };
        C: { filled: number; pass: number; fail: number };
    };
}

interface SignatureData {
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
}

export default function SSHTest() {
    const navigate = useNavigate();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<'A' | 'B' | 'C' | null>(null);
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
        totalDays: 0,
        totalPossibleEntries: 0,
        filledEntries: 0,
        completionRate: 0,
        passCount: 0,
        failCount: 0,
        shiftStats: {
            A: { filled: 0, pass: 0, fail: 0 },
            B: { filled: 0, pass: 0, fail: 0 },
            C: { filled: 0, pass: 0, fail: 0 }
        }
    });
    const [signatures, setSignatures] = useState<SignatureData>(() => {
        const saved = localStorage.getItem('sshSignatures');
        return saved ? JSON.parse(saved) : {
            preparedBy: '',
            reviewedBy: '',
            approvedBy: ''
        };
    });
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const SSH_API_BASE_URL = import.meta.env.VITE_API_URL + '/ssh-test-reports';

    const normalizeDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
    }, []);

    useEffect(() => {
        localStorage.setItem('sshSignatures', JSON.stringify(signatures));
    }, [signatures]);

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

            // Convert entries array to Map for easy lookup
            const entriesMap = new Map<string, DailyEntry>();
            const dateEntriesObj: DateEntries = {};

            entriesArr.forEach((entry: DailyEntry) => {
                const normalizedDate = normalizeDate(entry.date);
                const entryWithNormalizedDate = {
                    ...entry,
                    date: normalizedDate,
                    testingDate: normalizedDate
                };

                entriesMap.set(`${normalizedDate}_${entry.shift}`, entryWithNormalizedDate);

                // Group by date for shift-specific display
                if (!dateEntriesObj[normalizedDate]) {
                    dateEntriesObj[normalizedDate] = {};
                }
                dateEntriesObj[normalizedDate][entry.shift] = entryWithNormalizedDate;
            });

            setMonthlyEntries(entriesMap);
            setDateEntries(dateEntriesObj);

            // Extract stats data
            let statsData = statsJson.data || statsJson;
            const newStats = {
                totalDays: statsData.totalDays || new Date(year, month - 1, 0).getDate(),
                totalPossibleEntries: statsData.totalPossibleEntries || new Date(year, month - 1, 0).getDate() * 3,
                filledEntries: statsData.filledEntries || 0,
                completionRate: statsData.completionRate || 0,
                passCount: statsData.passCount || 0,
                failCount: statsData.failCount || 0,
                shiftStats: statsData.shiftStats || {
                    A: { filled: 0, pass: 0, fail: 0 },
                    B: { filled: 0, pass: 0, fail: 0 },
                    C: { filled: 0, pass: 0, fail: 0 }
                }
            };

            console.log('Setting stats:', newStats);
            setMonthlyStats(newStats);

        } catch (error) {
            console.error('Error loading monthly data:', error);
            // Set empty data on error
            setMonthlyEntries(new Map());
            setDateEntries({});
            const daysInMonth = new Date(year, month - 1, 0).getDate();
            setMonthlyStats({
                totalDays: daysInMonth,
                totalPossibleEntries: daysInMonth * 3,
                filledEntries: 0,
                completionRate: 0,
                passCount: 0,
                failCount: 0,
                shiftStats: {
                    A: { filled: 0, pass: 0, fail: 0 },
                    B: { filled: 0, pass: 0, fail: 0 },
                    C: { filled: 0, pass: 0, fail: 0 }
                }
            });
        } finally {
            setIsLoading(false);
        }
    }, [SSH_API_BASE_URL, normalizeDate]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        loadMonthlyData(year, month);
    }, [currentDate, loadMonthlyData]);

    // Handle month navigation
    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
    }, []);

    const handleYearChange = useCallback((year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
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
        setSelectedShift(null);
    }, [normalizeDate]);

    // Handle shift selection
    const handleShiftSelect = useCallback((shift: 'A' | 'B' | 'C') => {
        setSelectedShift(shift);
        setShowShiftSelector(false);

        // Check if entry exists for this date and shift
        const entryKey = `${selectedDate}_${shift}`;
        const entry = monthlyEntries.get(entryKey);

        if (entry) {
            console.log('Loading existing entry:', entry);
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            console.log('Creating new entry for date:', selectedDate, 'shift:', shift);
            // Create new blank entry for this date and shift
            setCurrentEntry({
                date: selectedDate,
                testingDate: selectedDate,
                shift: shift,
                po: '',
                line: '',
                sealantSupplier: '',
                sealantExpDate: '',
                sampleTakingTime: '',
                sampleTestingTime: '',
                result: '',
                checkedBy: username || '',
                remarks: ''
            });
            setIsEditing(false);
        }
    }, [selectedDate, monthlyEntries, username]);

    // Close shift selector
    const handleCloseShiftSelector = useCallback(() => {
        setShowShiftSelector(false);
        setSelectedDate('');
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
        if (!currentEntry || !currentEntry.testingDate || !currentEntry.shift) {
            showAlert('error', 'Please enter a valid date and shift');
            return;
        }

        // Validate required fields
        if (!currentEntry.moduleType || !currentEntry.result) {
            showAlert('error', 'Module Type and Result are required');
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
                const entryKey = `${normalized}_${saved.shift}`;

                // Update maps
                const updatedEntries = new Map(monthlyEntries);
                updatedEntries.set(entryKey, { ...saved, date: normalized });
                setMonthlyEntries(updatedEntries);

                // Update date entries grouping
                setDateEntries(prev => ({
                    ...prev,
                    [normalized]: {
                        ...prev[normalized],
                        [saved.shift]: { ...saved, date: normalized }
                    }
                }));

                setCurrentEntry({ ...saved, date: normalized });
                setIsEditing(true);
            }

            // Update stats
            if (result.data && result.data.stats) {
                console.log('Updating stats:', result.data.stats);
                setMonthlyStats(result.data.stats);
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
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate} (Shift ${currentEntry.shift})?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const dateKey = normalizeDate(currentEntry.date);
                    const shift = currentEntry.shift;

                    const response = await fetch(`${SSH_API_BASE_URL}/entries/${dateKey}/${shift}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete entry');
                    }

                    const result = await response.json();

                    // Update local state
                    const entryKey = `${dateKey}_${shift}`;
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(entryKey);
                    setMonthlyEntries(updatedEntries);

                    // Update date entries grouping
                    setDateEntries(prev => {
                        const newDateEntries = { ...prev };
                        if (newDateEntries[dateKey]) {
                            delete newDateEntries[dateKey][shift];
                            // If no shifts left for this date, remove the date entry
                            if (Object.keys(newDateEntries[dateKey]).length === 0) {
                                delete newDateEntries[dateKey];
                            }
                        }
                        return newDateEntries;
                    });

                    // Update stats
                    if (result.data && result.data.stats) {
                        setMonthlyStats(result.data.stats);
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
    const handleExportMonthlyExcel = useCallback(async () => {
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
            const entriesArray = Array.isArray(monthlyJson?.data) ? monthlyJson.data : [];

            const formData = {
                preparedBySignature: signatures.preparedBy,
                reviewedBySignature: signatures.reviewedBy,
                approvedBySignature: signatures.approvedBy
            };

            const sshReportData = {
                report_name: reportName,
                entries: entriesArray,
                form_data: formData,
                year,
                month
            };

            const response = await fetch(`${SSH_API_BASE_URL}/generate-ssh-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sshReportData),
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
    }, [currentDate, months, SSH_API_BASE_URL, showAlert, signatures]);

    // Reset form
    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
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

    // Get result indicator for shift
    const getShiftResultIndicator = useCallback((entry: DailyEntry | undefined) => {
        if (!entry) return <CircleOff className="w-3 h-3 text-gray-400" />;
        if (entry.result === 'Pass') return <CircleDot className="w-3 h-3 text-green-500" />;
        if (entry.result === 'Fail') return <Circle className="w-3 h-3 text-red-500" />;
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
            const hasPass = Object.values(dayEntries).some(e => e?.result === 'Pass');
            const hasFail = Object.values(dayEntries).some(e => e?.result === 'Fail');
            const hasAny = Object.keys(dayEntries).length > 0;

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
                        relative p-2 rounded-lg border-2 transition-all min-h-[80px]
                        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : statusClass}
                        ${isToday ? 'font-bold' : ''}
                        hover:shadow-md hover:-translate-y-0.5
                        ${!hasAny ? 'hover:border-blue-300' : ''}
                    `}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm dark:text-white">{i}</span>
                        {hasAny && (
                            <div className="flex gap-1">
                                {hasPass && <CheckCircle className="w-3 h-3 text-green-500" />}
                                {hasFail && <AlertCircle className="w-3 h-3 text-red-500" />}
                            </div>
                        )}
                    </div>

                    {/* Shift indicators */}
                    <div className="flex flex-col gap-1 mt-1">
                        {(['A', 'B', 'C'] as const).map(shift => {
                            const entry = dayEntries[shift];
                            return (
                                <div key={shift} className="flex items-center gap-1 text-xs">
                                    {getShiftIcon(shift)}
                                    {getShiftResultIndicator(entry)}
                                    {entry && (
                                        <span className="truncate max-w-[60px] text-[10px] dark:text-white">
                                            {entry.moduleType}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </button>
            );
        }

        return days;
    }, [currentDate, dateEntries, selectedDate, handleDateSelect, getShiftIcon, getShiftResultIndicator]);

    // Signature handlers (same as before)
    const handleAddSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = signatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = signatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = signatures.approvedBy;
                break;
        }

        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section`);
            return;
        }

        if (section === 'prepared' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can sign');
            return;
        }

        if (section === 'reviewed' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can review');
            return;
        }

        if (section === 'approved' && userRole !== 'Manager') {
            showAlert('error', 'Only Managers can approve');
            return;
        }

        setSignatures(prev => ({
            ...prev,
            [`${section}By`]: username
        }));

        setHasUnsavedChanges(true);
        showAlert('success', `Signature added to ${section} section`);
    }, [username, userRole, signatures, showAlert]);

    const handleRemoveSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = signatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = signatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = signatures.approvedBy;
                break;
        }

        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }

        setSignatures(prev => ({
            ...prev,
            [`${section}By`]: ''
        }));

        setHasUnsavedChanges(true);
        showAlert('info', `Signature removed from ${section} section`);
    }, [username, signatures, showAlert]);

    const canAddSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) return false;

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = signatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = signatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = signatures.approvedBy;
                break;
        }

        if (currentSignature.trim()) return false;

        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'reviewed':
                return ['Supervisor', 'Manager'].includes(userRole || '');
            case 'approved':
                return userRole === 'Manager';
            default:
                return false;
        }
    }, [username, userRole, signatures]);

    const canRemoveSignature = useCallback((section: 'prepared' | 'reviewed' | 'approved') => {
        if (!username) return false;

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = signatures.preparedBy;
                break;
            case 'reviewed':
                currentSignature = signatures.reviewedBy;
                break;
            case 'approved':
                currentSignature = signatures.approvedBy;
                break;
        }

        return currentSignature.includes(username);
    }, [username, signatures]);

    return (
        <>
            <div className="container mx-auto">
                <div className="text-center mb-6">
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
                <TestHeading
                    heading="Sealant Shore Hardness Test"
                    criteria="≥ 39 Shore A"
                />
                {showShiftSelector && selectedDate && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
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

                            <div className="space-y-3">
                                {(['A', 'B', 'C'] as const).map(shift => {
                                    const entry = dateEntries[selectedDate]?.[shift];
                                    const isFilled = !!entry;

                                    return (
                                        <button
                                            key={shift}
                                            onClick={() => handleShiftSelect(shift)}
                                            className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3
                                                ${isFilled
                                                    ? entry?.result === 'Pass'
                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                                        : entry?.result === 'Fail'
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
                                                        {entry.moduleType} - {entry.result}
                                                        {entry.testDoneBy && ` by ${entry.testDoneBy}`}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 dark:text-gray-500">
                                                        No entry yet
                                                    </div>
                                                )}
                                            </div>
                                            {isFilled && (
                                                <div className="flex-shrink-0">
                                                    {entry?.result === 'Pass' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                                    {entry?.result === 'Fail' && <AlertCircle className="w-5 h-5 text-red-500" />}
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
                                            onClick={handleExportMonthlyExcel}
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
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Shift
                                                </label>
                                                <div className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center gap-2">
                                                        {currentEntry.shift === 'A' && <Sun className="w-4 h-4 text-amber-500" />}
                                                        {currentEntry.shift === 'B' && <Sunset className="w-4 h-4 text-orange-500" />}
                                                        {currentEntry.shift === 'C' && <Moon className="w-4 h-4 text-indigo-500" />}
                                                        <span>Shift {currentEntry.shift}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    P.O. Number
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.po}
                                                    onChange={(e) => handleInputChange('po', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter PO number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Line <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.line}
                                                    onChange={(e) => handleInputChange('line', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter line"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sealant Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.sealantSupplier}
                                                    onChange={(e) => handleInputChange('sealantSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter sealant supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sealant Expiry Date
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.sealantExpDate}
                                                    onChange={(e) => handleInputChange('sealantExpDate', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter sealant expiry date"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sample Taking Time
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.sampleTakingTime}
                                                    onChange={(e) => handleInputChange('sampleTakingTime', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter sample taking time"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sample Testing Time
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.sampleTestingTime}
                                                    onChange={(e) => handleInputChange('sampleTestingTime', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter sample testing time"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Result <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={currentEntry.result}
                                                    onChange={(e) => handleInputChange('result', e.target.value as 'Pass' | 'Fail')}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    required
                                                >
                                                    <option value="">Select result</option>
                                                    <option value="Pass">Pass</option>
                                                    <option value="Fail">Fail</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Checked By
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.checkedBy}
                                                    onChange={(e) => handleInputChange('checkedBy', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter checker name"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Remarks
                                                </label>
                                                <textarea
                                                    value={currentEntry.remarks || ''}
                                                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                                                    rows={2}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    {(['A', 'B', 'C'] as const).map(shift => {
                                        const stats = monthlyStats.shiftStats[shift];
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
                                                        {stats.filled} / {monthlyStats.totalDays} days
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-green-600">Pass: {stats.pass}</span>
                                                    <span className="text-red-600">Fail: {stats.fail}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${(stats.filled / monthlyStats.totalDays) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Month Summary */}
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
                                        <span className="text-gray-600 dark:text-gray-400">Total Possible Entries</span>
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

                            {/* Results Breakdown */}
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    Results Breakdown
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-green-600">Pass</span>
                                            <span className="font-medium">{monthlyStats.passCount}</span>
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
                                            <span className="font-medium">{monthlyStats.failCount}</span>
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

                {/* Signature Section */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Prepared By */}
                        <div className="text-center">
                            <p className="font-bold text-gray-800 dark:text-white mb-2">PREPARED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-lg font-semibold">{signatures.preparedBy}</span>
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

                        {/* Reviewed By */}
                        <div className="text-center">
                            <p className="font-bold text-gray-800 dark:text-white mb-2">REVIEWED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-lg font-semibold">{signatures.reviewedBy}</span>
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

                        {/* Approved By */}
                        <div className="text-center">
                            <p className="font-bold text-gray-800 dark:text-white mb-2">APPROVED BY:</p>
                            <div className="w-full min-h-20 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                <span className="text-gray-800 dark:text-white text-lg font-semibold">{signatures.approvedBy}</span>
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
                    <div className="text-center text-sm text-red-500 dark:text-red-400 mt-4 font-medium">
                        (Controlled Copy)
                    </div>
                </div>
            </div>
        </>
    );
}