import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Trash2, Save, X, BarChart3, Percent, Target, TrendingUp } from 'lucide-react';

interface DailyEntry {
    date: string;
    testingDate: string;
    po: string;
    moduleType: string;
    moduleNo: string;
    cellSupplier: string;
    encapsulantSupplier: string;
    rearGlassSupplier: string;
    jbSupplier: string;
    adhesiveSealantSupplier: string;
    pottingSealantSupplier: string;
    waterTemp: string;
    waterResistivity: string;
    IR: string;
    result: 'Pass' | 'Fail' | '';
    testDoneBy: string;
    remarks?: string;
    [key: string]: string | boolean | undefined;
}

interface MonthlyStats {
    totalDays: number;
    filledDays: number;
    completionRate: number;
    passCount: number;
    failCount: number;
}

interface SignatureData {
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
}

export default function WetLeakageTest() {
    const navigate = useNavigate();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    // Date management
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Data states
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
        totalDays: 0,
        filledDays: 0,
        completionRate: 0,
        passCount: 0,
        failCount: 0
    });

    // Signature states - load from localStorage
    const [signatures, setSignatures] = useState<SignatureData>(() => {
        const saved = localStorage.getItem('wetLeakageSignatures');
        return saved ? JSON.parse(saved) : {
            preparedBy: '',
            reviewedBy: '',
            approvedBy: ''
        };
    });

    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const WET_LEAKAGE_API_BASE_URL = import.meta.env.VITE_API_URL + '/wet-leakage-test-reports';

    // Helper to normalize dates to YYYY-MM-DD format
    const normalizeDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
    }, []);

    // Save signatures to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('wetLeakageSignatures', JSON.stringify(signatures));
    }, [signatures]);

    // Months and years for navigation
    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ], []);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i), [currentDate]);

    // Load user info from sessionStorage
    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    // Load monthly data function
    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            console.log(`Loading data for ${year}-${month}`);

            const entriesUrl = `${WET_LEAKAGE_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const statsUrl = `${WET_LEAKAGE_API_BASE_URL}/stats/monthly?year=${year}&month=${month}`;

            // Make both API calls in parallel
            const [entriesResponse, statsResponse] = await Promise.all([
                fetch(entriesUrl),
                fetch(statsUrl)
            ]);

            // Parse responses
            const entriesJson = await entriesResponse.json();
            const statsJson = await statsResponse.json();

            console.log('Entries response:', entriesJson);
            console.log('Stats response:', statsJson);

            // Extract entries data
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
                entriesMap.set(normalizedDate, {
                    ...entry,
                    date: normalizedDate
                });
            });

            setMonthlyEntries(entriesMap);

            // Extract stats data
            let statsData = statsJson.data || statsJson;
            const newStats = {
                totalDays: statsData.totalDays || new Date(year, month - 1, 0).getDate(),
                filledDays: statsData.filledDays || 0,
                completionRate: statsData.completionRate || 0,
                passCount: statsData.passCount || 0,
                failCount: statsData.failCount || 0
            };

            console.log('Setting stats:', newStats);
            setMonthlyStats(newStats);

            // If there was a previously selected date, try to load its entry
            if (selectedDate) {
                const entry = entriesMap.get(selectedDate);
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
                totalDays: new Date(year, month - 1, 0).getDate(),
                filledDays: 0,
                completionRate: 0,
                passCount: 0,
                failCount: 0
            });
        } finally {
            setIsLoading(false);
        }
    }, [WET_LEAKAGE_API_BASE_URL, selectedDate, normalizeDate]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        loadMonthlyData(year, month);
    }, [currentDate, loadMonthlyData]);

    // Handle month navigation
    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setCurrentEntry(null);
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setCurrentEntry(null);
    }, []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setCurrentEntry(null);
    }, []);

    const handleYearChange = useCallback((year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
        setCurrentEntry(null);
    }, []);

    // Handle date selection
    const handleDateSelect = useCallback((date: string) => {
        const normalized = normalizeDate(date);
        setSelectedDate(normalized);

        // Get entry from already loaded monthly data
        const entry = monthlyEntries.get(normalized);

        if (entry) {
            console.log('Loading existing entry:', entry);
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            console.log('Creating new entry for date:', normalized);
            // Create new blank entry for this date
            setCurrentEntry({
                date: normalized,
                testingDate: normalized,
                po: '',
                moduleType: '',
                moduleNo: '',
                cellSupplier: '',
                encapsulantSupplier: '',
                rearGlassSupplier: '',
                jbSupplier: '',
                adhesiveSealantSupplier: '',
                pottingSealantSupplier: '',
                waterTemp: '',
                waterResistivity: '',
                IR: '',
                result: '',
                testDoneBy: username || '',
                remarks: ''
            });
            setIsEditing(false);
        }
    }, [monthlyEntries, username, normalizeDate]);

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

        // Validate required fields
        if (!currentEntry.moduleType || !currentEntry.result) {
            showAlert('error', 'Module Type and Result are required');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Saving entry:', currentEntry);

            const response = await fetch(`${WET_LEAKAGE_API_BASE_URL}/entries`, {
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
                const updatedEntries = new Map(monthlyEntries);
                updatedEntries.set(normalized, { ...saved, date: normalized });
                setMonthlyEntries(updatedEntries);
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
    }, [currentEntry, monthlyEntries, WET_LEAKAGE_API_BASE_URL, showAlert, normalizeDate]);

    const handleDeleteEntry = useCallback(() => {
        if (!currentEntry) return;

        showConfirm({
            title: 'Delete Entry',
            message: `Are you sure you want to delete the entry for ${currentEntry.testingDate}?`,
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const dateKey = normalizeDate(currentEntry.date);
                    const response = await fetch(`${WET_LEAKAGE_API_BASE_URL}/entries/${dateKey}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete entry');
                    }

                    const result = await response.json();

                    // Update local state
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(dateKey);
                    setMonthlyEntries(updatedEntries);

                    // Update stats
                    if (result.data && result.data.stats) {
                        setMonthlyStats(result.data.stats);
                    }

                    setCurrentEntry(null);
                    setSelectedDate('');
                    showAlert('info', 'Entry deleted successfully');
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            }
        });
    }, [currentEntry, monthlyEntries, WET_LEAKAGE_API_BASE_URL, showAlert, showConfirm, normalizeDate]);

    // Export monthly Excel report
    const handleExportMonthlyExcel = useCallback(async () => {
        const monthName = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        const firstThreeLetters = monthName.substring(0, 3);
        const reportName = `Wet_Leakage_Test_${firstThreeLetters}_${year}`;

        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');

            // Fetch full monthly JSON from backend
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const monthlyResp = await fetch(`${WET_LEAKAGE_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResp.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResp.json();
            const entriesArray = Array.isArray(monthlyJson?.data) ? monthlyJson.data : [];

            // Get signatures from state
            const formData = {
                preparedBySignature: signatures.preparedBy,
                reviewedBySignature: signatures.reviewedBy,
                approvedBySignature: signatures.approvedBy
            };

            const wetLeakageReportData = {
                report_name: reportName,
                entries: entriesArray,
                form_data: formData,
                year,
                month
            };

            const response = await fetch(`${WET_LEAKAGE_API_BASE_URL}/generate-wet-leakage-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wetLeakageReportData),
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
    }, [currentDate, months, WET_LEAKAGE_API_BASE_URL, showAlert, signatures]);

    // Reset form
    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
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
            const entry = monthlyEntries.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
            let statusIcon = null;

            if (entry) {
                if (entry.result === 'Pass') {
                    statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                    statusIcon = <CheckCircle className="w-4 h-4 text-green-500" />;
                } else if (entry.result === 'Fail') {
                    statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                    statusIcon = <AlertCircle className="w-4 h-4 text-red-500" />;
                }
            }

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`
                        relative p-3 rounded-lg border-2 transition-all
                        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : statusClass}
                        ${isToday ? 'font-bold' : ''}
                        hover:shadow-md hover:-translate-y-0.5
                        ${!entry ? 'hover:border-blue-300' : ''}
                    `}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm dark:text-white">{i}</span>
                        {statusIcon}
                    </div>
                    {entry && (
                        <div className="mt-1 text-xs text-left truncate max-w-full font-medium dark:text-white">
                            {entry.moduleType}
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
                <TestHeading
                    heading="Wet Leakage Test"
                    criteria="Recipe: Apply 1500 V for 120 seconds; Passing Criteria: IR > 40MΩ /m2"
                />
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left Panel - Daily Input */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Calendar Section */}
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                {/* Month/Year Navigation */}
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

                                {/* Calendar Grid */}
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

                                {/* Legend */}
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

                            {/* Entry Form */}
                            {currentEntry && (
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold dark:text-white">
                                            {isEditing ? 'Edit Entry' : 'New Entry'} - {new Date(currentEntry.testingDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
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
                                                    Module Type <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.moduleType}
                                                    onChange={(e) => handleInputChange('moduleType', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter module type"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Module No.
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.moduleNo}
                                                    onChange={(e) => handleInputChange('moduleNo', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter module number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Cell Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.cellSupplier}
                                                    onChange={(e) => handleInputChange('cellSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter cell supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Sealant Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.encapsulantSupplier}
                                                    onChange={(e) => handleInputChange('encapsulantSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter encapsulant supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Backsheet / Rear Glass Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.rearGlassSupplier}
                                                    onChange={(e) => handleInputChange('rearGlassSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter rear glass supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    JB Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.jbSupplier || ''}
                                                    onChange={(e) => handleInputChange('jbSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter JB supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Adhesive Sealant Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.adhesiveSealantSupplier || ''}
                                                    onChange={(e) => handleInputChange('adhesiveSealantSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter adhesive sealant supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Potting Sealant Supplier
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.pottingSealantSupplier || ''}
                                                    onChange={(e) => handleInputChange('pottingSealantSupplier', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter potting sealant supplier"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Water Temperature (°C)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.waterTemp || ''}
                                                    onChange={(e) => handleInputChange('waterTemp', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter water temperature in °C"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Water Resistivity (Ω-cm)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.waterResistivity || ''}
                                                    onChange={(e) => handleInputChange('waterResistivity', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter water resistivity in Ω-cm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    IR (MΩ)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.IR || ''}
                                                    onChange={(e) => handleInputChange('IR', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter IR in MΩ"
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
                                                    Test Done By
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentEntry.testDoneBy}
                                                    onChange={(e) => handleInputChange('testDoneBy', e.target.value)}
                                                    className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter tester name"
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
                                        {monthlyStats.filledDays} / {monthlyStats.totalDays} days
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
                                        <span className="text-gray-600 dark:text-gray-400">Filled Days</span>
                                        <span className="font-semibold text-green-600">{monthlyStats.filledDays}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-600 dark:text-gray-400">Missing Days</span>
                                        <span className="font-semibold text-red-500">{monthlyStats.totalDays - monthlyStats.filledDays}</span>
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
                                                style={{ width: `${monthlyStats.filledDays > 0 ? (monthlyStats.passCount / monthlyStats.filledDays) * 100 : 0}%` }}
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
                                                style={{ width: `${monthlyStats.filledDays > 0 ? (monthlyStats.failCount / monthlyStats.filledDays) * 100 : 0}%` }}
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