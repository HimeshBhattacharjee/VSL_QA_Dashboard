import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import {
    CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Trash2, Save, X,
    BarChart3, Percent, Target, TrendingUp, Clock, Sun, Sunset, Moon,
    Circle, CircleDot, CircleOff, Check
} from 'lucide-react';

interface LineEntry {
    line?: string;
    po: string;
    jbSupplier: string;
    sealantSupplier: string;
    sealantExpiry: string;
    jbWeight: string;
    jbWeightWithSealant: string;
    netSealantWeight: string;
    totalModuleWeight: string;
    remarks?: string;
}

interface Signatures {
    preparedBy: string;
    verifiedBy: string;
}

interface DailyEntry {
    date: string;
    testingDate: string;
    shift: 'A' | 'B' | 'C';
    lines: {
        '1': LineEntry;
        '2': LineEntry;
    };
    signatures?: Signatures;
    [key: string]: any;
}

interface DateEntries {
    [date: string]: {
        A?: DailyEntry;
        B?: DailyEntry;
        C?: DailyEntry;
    };
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

export default function JBSealantWeightMeasurement() {
    const navigate = useNavigate();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<'A' | 'B' | 'C' | null>(null);
    const [dateSignatures, setDateSignatures] = useState<{ [date: string]: Signatures }>({});
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);

    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = import.meta.env.VITE_API_URL + '/jb-sealant-weight-reports';

    const normalizeDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
    }, []);

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
        po: '',
        jbSupplier: '',
        sealantSupplier: '',
        sealantExpiry: '',
        jbWeight: '',
        jbWeightWithSealant: '',
        netSealantWeight: '',
        totalModuleWeight: '',
        remarks: ''
    }), []);

    const createEmptyShiftEntry = useCallback((date: string, shift: 'A' | 'B' | 'C'): DailyEntry => ({
        date: date,
        testingDate: date,
        shift: shift,
        lines: {
            '1': createEmptyLineEntry('1'),
            '2': createEmptyLineEntry('2')
        },
        signatures: {
            preparedBy: '',
            verifiedBy: ''
        }
    }), [createEmptyLineEntry]);

    const calculateNetSealantWeight = useCallback((jbWeight: string, jbWeightWithSealant: string): string => {
        if (!jbWeight || !jbWeightWithSealant) return '';
        const jb = parseFloat(jbWeight) || 0;
        const withSealant = parseFloat(jbWeightWithSealant) || 0;
        return (withSealant - jb).toFixed(2);
    }, []);

    const calculateTotalModuleWeight = useCallback((line1Net: string, line2Net: string): string => {
        if (!line1Net && !line2Net) return '';
        const net1 = parseFloat(line1Net) || 0;
        const net2 = parseFloat(line2Net) || 0;
        return (net1 + net2).toFixed(2);
    }, []);

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            console.log(`Loading data for ${year}-${month}`);

            const entriesUrl = `${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const statsUrl = `${API_BASE_URL}/stats/monthly?year=${year}&month=${month}`;

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
            const dateSigs: { [date: string]: Signatures } = entriesJson.date_signatures || {};

            entriesArr.forEach((entry: DailyEntry) => {
                const normalizedDate = normalizeDate(entry.date);
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

                // Use date-level signatures
                entry.signatures = dateSigs[normalizedDate] || {
                    preparedBy: '',
                    verifiedBy: ''
                };

                const entryWithNormalizedDate = {
                    ...entry,
                    date: normalizedDate,
                    testingDate: normalizedDate
                };

                entriesMap.set(`${normalizedDate}_${entry.shift}`, entryWithNormalizedDate);
                if (!dateEntriesObj[normalizedDate]) {
                    dateEntriesObj[normalizedDate] = {};
                }
                dateEntriesObj[normalizedDate][entry.shift] = entryWithNormalizedDate;
            });

            setMonthlyEntries(entriesMap);
            setDateEntries(dateEntriesObj);
            setDateSignatures(dateSigs);

            // Handle stats response
            if (statsJson.data) {
                const statsData = statsJson.data;
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
            } else {
                // Default stats if no data
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
            }

        } catch (error) {
            console.error('Error loading monthly data:', error);
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
    }, [API_BASE_URL, normalizeDate, createEmptyLineEntry]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        loadMonthlyData(year, month);
    }, [currentDate, loadMonthlyData]);

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

    const handleDateSelect = useCallback((date: string) => {
        const normalized = normalizeDate(date);
        setSelectedDate(normalized);
        setShowShiftSelector(true);
        setCurrentEntry(null);
        setSelectedShift(null);
    }, [normalizeDate]);

    const handleShiftSelect = useCallback((shift: 'A' | 'B' | 'C') => {
        setSelectedShift(shift);
        setShowShiftSelector(false);

        const entryKey = `${selectedDate}_${shift}`;
        const entry = monthlyEntries.get(entryKey);

        if (entry) {
            console.log('Loading existing entry:', entry);
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
            if (!entry.signatures) {
                entry.signatures = {
                    preparedBy: '',
                    verifiedBy: ''
                };
            }
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
            console.log('Creating new entry for date:', selectedDate, 'shift:', shift);
            setCurrentEntry(createEmptyShiftEntry(selectedDate, shift));
            setIsEditing(false);
        }
    }, [selectedDate, monthlyEntries, createEmptyShiftEntry, createEmptyLineEntry]);

    const handleCloseShiftSelector = useCallback(() => {
        setShowShiftSelector(false);
        setSelectedDate('');
        setSelectedShift(null);
    }, []);

    const handleTodayEntry = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date(today);

        if (todayDate.getMonth() === currentDate.getMonth() &&
            todayDate.getFullYear() === currentDate.getFullYear()) {
            handleDateSelect(today);
        } else {
            setCurrentDate(new Date());
        }
    }, [currentDate, handleDateSelect]);

    const handleLineInputChange = useCallback((
        line: '1' | '2',
        field: keyof LineEntry,
        value: string
    ) => {
        if (!currentEntry) return;

        let updatedLines = {
            ...currentEntry.lines,
            [line]: {
                ...currentEntry.lines[line],
                [field]: value
            }
        };

        // Auto-calculate net sealant weight when JB weight or JB weight with sealant changes
        if (field === 'jbWeight' || field === 'jbWeightWithSealant') {
            const jbWeight = field === 'jbWeight' ? value : currentEntry.lines[line].jbWeight;
            const jbWeightWithSealant = field === 'jbWeightWithSealant' ? value : currentEntry.lines[line].jbWeightWithSealant;

            updatedLines[line].netSealantWeight = calculateNetSealantWeight(jbWeight, jbWeightWithSealant);
        }

        // Update total module weight for both lines when net weights change
        if (field === 'jbWeight' || field === 'jbWeightWithSealant') {
            const line1Net = line === '1' ? updatedLines['1'].netSealantWeight : currentEntry.lines['1'].netSealantWeight;
            const line2Net = line === '2' ? updatedLines['2'].netSealantWeight : currentEntry.lines['2'].netSealantWeight;

            const totalModuleWeight = calculateTotalModuleWeight(line1Net, line2Net);

            updatedLines['1'].totalModuleWeight = totalModuleWeight;
            updatedLines['2'].totalModuleWeight = totalModuleWeight;
        }

        setCurrentEntry({
            ...currentEntry,
            lines: updatedLines
        });
        setHasUnsavedChanges(true);
    }, [currentEntry, calculateNetSealantWeight, calculateTotalModuleWeight]);

    const handleSaveEntry = useCallback(async () => {
        if (!currentEntry || !currentEntry.testingDate || !currentEntry.shift) {
            showAlert('error', 'Please enter a valid date and shift');
            return;
        }

        // Validate PO for both lines
        if (!currentEntry.lines['1'].po) {
            showAlert('error', 'PO number is required for Line 1');
            return;
        }
        if (!currentEntry.lines['2'].po) {
            showAlert('error', 'PO number is required for Line 2');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Saving entry:', currentEntry);

            const response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentEntry),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save entry');
            }

            const result = await response.json();
            console.log('Save response:', result);

            if (result.data && result.data.entry) {
                const saved = result.data.entry as DailyEntry;
                const normalized = normalizeDate(saved.date);

                if (saved.lines) {
                    if (saved.lines['1'] && !saved.lines['1'].line) {
                        saved.lines['1'].line = '1';
                    }
                    if (saved.lines['2'] && !saved.lines['2'].line) {
                        saved.lines['2'].line = '2';
                    }
                }

                // Ensure signatures object exists
                if (!saved.signatures) {
                    saved.signatures = {
                        preparedBy: '',
                        verifiedBy: ''
                    };
                }

                const entryKey = `${normalized}_${saved.shift}`;

                const updatedEntries = new Map(monthlyEntries);
                updatedEntries.set(entryKey, { ...saved, date: normalized });
                setMonthlyEntries(updatedEntries);

                // Update dateEntries
                const updatedDateEntries = {
                    ...dateEntries,
                    [normalized]: {
                        ...dateEntries[normalized],
                        [saved.shift]: { ...saved, date: normalized }
                    }
                };
                setDateEntries(updatedDateEntries);

                setCurrentEntry({ ...saved, date: normalized });
                setIsEditing(true);
            }

            // Reload stats to get updated counts
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const statsResponse = await fetch(`${API_BASE_URL}/stats/monthly?year=${year}&month=${month}`);
            const statsJson = await statsResponse.json();

            if (statsJson.data) {
                setMonthlyStats(statsJson.data);
            }

            setHasUnsavedChanges(false);
            showAlert('success', result.message || 'Entry saved successfully');

        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    }, [currentEntry, monthlyEntries, dateEntries, API_BASE_URL, showAlert, normalizeDate, currentDate]);

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

                    const response = await fetch(`${API_BASE_URL}/entries/${dateKey}/${shift}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete entry');
                    }

                    const entryKey = `${dateKey}_${shift}`;
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(entryKey);
                    setMonthlyEntries(updatedEntries);

                    setDateEntries(prev => {
                        const newDateEntries = { ...prev };
                        if (newDateEntries[dateKey]) {
                            delete newDateEntries[dateKey][shift];
                            if (Object.keys(newDateEntries[dateKey]).length === 0) {
                                delete newDateEntries[dateKey];
                            }
                        }
                        return newDateEntries;
                    });

                    // Reload stats
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth() + 1;
                    const statsResponse = await fetch(`${API_BASE_URL}/stats/monthly?year=${year}&month=${month}`);
                    const statsJson = await statsResponse.json();

                    if (statsJson.data) {
                        setMonthlyStats(statsJson.data);
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
    }, [currentEntry, monthlyEntries, API_BASE_URL, showAlert, showConfirm, normalizeDate, currentDate]);

    const handleSignatureUpdate = useCallback(async (type: 'prepared' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        if (!currentEntry) {
            showAlert('error', 'Please select an entry first');
            return;
        }

        const field = type === 'prepared' ? 'preparedBy' : 'verifiedBy';

        // Get current date-level signatures
        const currentDateSigs = dateSignatures[currentEntry.date] || {
            preparedBy: '',
            verifiedBy: ''
        };

        // Check if already signed
        if (currentDateSigs[field]) {
            // Remove signature
            if (currentDateSigs[field] !== username) {
                showAlert('error', 'You can only remove your own signature');
                return;
            }

            const updatedSignatures = {
                ...currentDateSigs,
                [field]: ''
            };

            // Update all entries for this date in local state
            const updatedDateSigs = {
                ...dateSignatures,
                [currentEntry.date]: updatedSignatures
            };
            setDateSignatures(updatedDateSigs);

            // Update current entry's signatures
            setCurrentEntry({
                ...currentEntry,
                signatures: updatedSignatures
            });

            // Save to backend
            try {
                const response = await fetch(`${API_BASE_URL}/signatures`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: currentEntry.date,
                        signatures: updatedSignatures
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to update signature');
                }

                showAlert('info', `Signature removed from ${type}`);
            } catch (error) {
                console.error('Error updating signature:', error);
                showAlert('error', 'Failed to remove signature');
            }
        } else {
            // Add signature
            if (type === 'prepared' && userRole !== 'Operator') {
                showAlert('error', 'Only Operators can sign as Prepared By');
                return;
            }

            if (type === 'verified' && !['Manager', 'Supervisor'].includes(userRole || '')) {
                showAlert('error', 'Only Managers or Supervisors can sign as Verified By');
                return;
            }

            const updatedSignatures = {
                ...currentDateSigs,
                [field]: username
            };

            // Update all entries for this date in local state
            const updatedDateSigs = {
                ...dateSignatures,
                [currentEntry.date]: updatedSignatures
            };
            setDateSignatures(updatedDateSigs);

            // Update current entry's signatures
            setCurrentEntry({
                ...currentEntry,
                signatures: updatedSignatures
            });

            // Save to backend
            try {
                const response = await fetch(`${API_BASE_URL}/signatures`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: currentEntry.date,
                        signatures: updatedSignatures
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to update signature');
                }

                showAlert('success', `Signature added as ${type}`);
            } catch (error) {
                console.error('Error updating signature:', error);
                showAlert('error', 'Failed to add signature');
            }
        }
    }, [username, userRole, currentEntry, dateSignatures, showAlert, API_BASE_URL]);

    const handleExportMonthlyExcel = useCallback(async () => {
        const monthName = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        const firstThreeLetters = monthName.substring(0, 3);
        const reportName = `JB_Sealant_Weight_${firstThreeLetters}_${year}`;

        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const monthlyResp = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`);
            if (!monthlyResp.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResp.json();

            let entriesArray = Array.isArray(monthlyJson?.data) ? monthlyJson.data : [];

            entriesArray = entriesArray.map((entry: DailyEntry) => {
                if (entry.lines) {
                    if (entry.lines['1'] && !entry.lines['1'].line) {
                        entry.lines['1'].line = '1';
                    }
                    if (entry.lines['2'] && !entry.lines['2'].line) {
                        entry.lines['2'].line = '2';
                    }
                }
                if (!entry.signatures) {
                    entry.signatures = {
                        preparedBy: '',
                        verifiedBy: ''
                    };
                }
                return entry;
            });

            const jbReportData = {
                entries: entriesArray,
                year,
                month
            };

            console.log('Sending to Excel generator:', jbReportData);

            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jbReportData),
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
    }, [currentDate, months, API_BASE_URL, showAlert]);

    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
        setSelectedShift(null);
        setShowShiftSelector(false);
        setHasUnsavedChanges(false);
    }, []);

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

    const getShiftIcon = useCallback((shift: 'A' | 'B' | 'C') => {
        switch (shift) {
            case 'A': return <Sun className="w-3 h-3 text-amber-500" />;
            case 'B': return <Sunset className="w-3 h-3 text-orange-500" />;
            case 'C': return <Moon className="w-3 h-3 text-indigo-500" />;
            default: return null;
        }
    }, []);

    const getShiftResultIndicator = useCallback((entry: DailyEntry | undefined) => {
        if (!entry || !entry.lines) return <CircleOff className="w-3 h-3 text-gray-400" />;

        const line1NetWeight = entry.lines['1']?.netSealantWeight;
        const line2NetWeight = entry.lines['2']?.netSealantWeight;

        const isLine1Valid = line1NetWeight && parseFloat(line1NetWeight) >= 4 && parseFloat(line1NetWeight) <= 8;
        const isLine2Valid = line2NetWeight && parseFloat(line2NetWeight) >= 4 && parseFloat(line2NetWeight) <= 8;

        if (isLine1Valid && isLine2Valid) return <CircleDot className="w-3 h-3 text-green-500" />;
        if ((line1NetWeight && !isLine1Valid) || (line2NetWeight && !isLine2Valid)) return <Circle className="w-3 h-3 text-red-500" />;
        if (line1NetWeight || line2NetWeight) return <Circle className="w-3 h-3 text-yellow-500" />;

        return <CircleOff className="w-3 h-3 text-gray-400" />;
    }, []);

    const renderCalendarDays = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        const todayStr = new Date().toISOString().split('T')[0];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEntries = dateEntries[dateStr] || {};
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            let hasPass = false;
            let hasFail = false;
            let hasAny = false;
            let hasSignatures = false;

            Object.values(dayEntries).forEach((shiftEntry: any) => {
                if (shiftEntry?.lines && typeof shiftEntry === 'object' && 'shift' in shiftEntry) {
                    const line1NetWeight = shiftEntry.lines['1']?.netSealantWeight;
                    const line2NetWeight = shiftEntry.lines['2']?.netSealantWeight;

                    const isLine1Valid = line1NetWeight && parseFloat(line1NetWeight) >= 4 && parseFloat(line1NetWeight) <= 8;
                    const isLine2Valid = line2NetWeight && parseFloat(line2NetWeight) >= 4 && parseFloat(line2NetWeight) <= 8;

                    if (isLine1Valid || isLine2Valid) hasPass = true;
                    if ((line1NetWeight && !isLine1Valid) || (line2NetWeight && !isLine2Valid)) hasFail = true;
                    if (line1NetWeight || line2NetWeight) hasAny = true;
                }

                // Check for signatures
                if (shiftEntry?.signatures && (shiftEntry.signatures.preparedBy || shiftEntry.signatures.verifiedBy)) {
                    hasSignatures = true;
                }
            });

            let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

            if (hasPass && !hasFail) {
                statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
            } else if (hasFail) {
                statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
            } else if (hasAny || hasSignatures) {
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
                        ${!hasAny && !hasSignatures ? 'hover:border-blue-300' : ''}
                    `}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm dark:text-white">{i}</span>
                    </div>

                    <div className="flex flex-col gap-1 mt-1">
                        {(['A', 'B', 'C'] as const).map(shift => {
                            const entry = dayEntries[shift] as DailyEntry | undefined;
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

    const renderSignatureSection = useCallback(() => {
        if (!currentEntry) return null;

        const currentDateSigs = dateSignatures[currentEntry.date] || {
            preparedBy: '',
            verifiedBy: ''
        };

        const canSignPrepared = userRole === 'Operator' && !currentDateSigs.preparedBy;
        const canSignVerified = ['Manager', 'Supervisor'].includes(userRole || '') && !currentDateSigs.verifiedBy;
        const canRemovePrepared = currentDateSigs.preparedBy === username;
        const canRemoveVerified = currentDateSigs.verifiedBy === username;

        return (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-semibold mb-3 dark:text-white">
                    Daily Signatures for {new Date(currentEntry.date).toLocaleDateString()} (Applies to all shifts)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Prepared By
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={currentDateSigs.preparedBy || ''}
                                readOnly
                                className="md:w-full p-2 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 cursor-default"
                                placeholder="Not signed"
                            />
                            {canSignPrepared && (
                                <button
                                    onClick={() => handleSignatureUpdate('prepared')}
                                    className="p-2 text-sm text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                >
                                    <Check className='w-4 h-4' />
                                </button>
                            )}
                            {canRemovePrepared && (
                                <button
                                    onClick={() => handleSignatureUpdate('prepared')}
                                    className="p-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                >
                                    <X className='w-4 h-4' />
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Verified By
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={currentDateSigs.verifiedBy || ''}
                                readOnly
                                className="md:w-full p-2 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 cursor-default"
                                placeholder="Not signed"
                            />
                            {canSignVerified && (
                                <button
                                    onClick={() => handleSignatureUpdate('verified')}
                                    className="p-2 text-sm text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                >
                                    <Check className='w-4 h-4' />
                                </button>
                            )}
                            {canRemoveVerified && (
                                <button
                                    onClick={() => handleSignatureUpdate('verified')}
                                    className="px-2 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                >
                                    <X className='w-4 h-4' />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [currentEntry, dateSignatures, userRole, username, handleSignatureUpdate]);

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
                    heading="JB Sealant Weight Measurement"
                    criteria="Allowable Limit: 6 ± 2 (Range: 4 to 8)"
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

                                    const line1NetWeight = entry?.lines['1']?.netSealantWeight;
                                    const line2NetWeight = entry?.lines['2']?.netSealantWeight;
                                    const isLine1Valid = line1NetWeight && parseFloat(line1NetWeight) >= 4 && parseFloat(line1NetWeight) <= 8;
                                    const isLine2Valid = line2NetWeight && parseFloat(line2NetWeight) >= 4 && parseFloat(line2NetWeight) <= 8;

                                    let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
                                    if (isFilled) {
                                        if (isLine1Valid && isLine2Valid) {
                                            statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                                        } else if ((line1NetWeight && !isLine1Valid) || (line2NetWeight && !isLine2Valid)) {
                                            statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                                        } else {
                                            statusClass = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
                                        }
                                    }

                                    return (
                                        <button
                                            key={shift}
                                            onClick={() => handleShiftSelect(shift)}
                                            className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${statusClass}`}
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
                                                        <div>Line 1 PO: {entry?.lines['1']?.po}</div>
                                                        <div>Line 2 PO: {entry?.lines['2']?.po}</div>
                                                        <div>Line 1 Net Weight: {entry?.lines['1']?.netSealantWeight || 'N/A'}</div>
                                                        <div>Line 2 Net Weight: {entry?.lines['2']?.netSealantWeight || 'N/A'}</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 dark:text-gray-500">
                                                        No entry yet
                                                    </div>
                                                )}
                                            </div>
                                            {isFilled && (
                                                <div className="flex-shrink-0">
                                                    {isLine1Valid && isLine2Valid &&
                                                        <CheckCircle className="w-5 h-5 text-green-500" />}
                                                    {((line1NetWeight && !isLine1Valid) || (line2NetWeight && !isLine2Valid)) &&
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
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Within Range (4-8)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-200 border border-red-500"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Out of Range</span>
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
                                        </div>

                                        <div className="border-l-4 border-blue-500 pl-4">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm">1</span>
                                                Line 1 Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        PO Number <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].po}
                                                        onChange={(e) => handleLineInputChange('1', 'po', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter PO number"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Supplier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].jbSupplier}
                                                        onChange={(e) => handleLineInputChange('1', 'jbSupplier', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB supplier"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Supplier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantSupplier', e.target.value)}
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
                                                        value={currentEntry.lines['1'].sealantExpiry}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantExpiry', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Junction Box Position
                                                    </label>
                                                    <select
                                                        value={currentEntry.lines['1'].jbPosition}
                                                        onChange={(e) => handleLineInputChange('1', 'jbPosition', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Position</option>
                                                        <option value="Positive">+ve JB</option>
                                                        <option value="Middle">Middle JB</option>
                                                        <option value="Negative">-ve JB</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].jbWeight}
                                                        onChange={(e) => handleLineInputChange('1', 'jbWeight', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB weight"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Weight with Sealant (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].jbWeightWithSealant}
                                                        onChange={(e) => handleLineInputChange('1', 'jbWeightWithSealant', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB weight with sealant"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Net Sealant Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].netSealantWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Total Module Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].totalModuleWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 lg:col-span-3">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line 1)
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['1'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('1', 'remarks', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Add any remarks for Line 1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-l-4 border-green-500 pl-4 mt-6">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 text-sm">2</span>
                                                Line 2 Details
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        PO Number <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].po}
                                                        onChange={(e) => handleLineInputChange('2', 'po', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter PO number"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Supplier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].jbSupplier}
                                                        onChange={(e) => handleLineInputChange('2', 'jbSupplier', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB supplier"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sealant Supplier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantSupplier', e.target.value)}
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
                                                        value={currentEntry.lines['2'].sealantExpiry}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantExpiry', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].jbWeight}
                                                        onChange={(e) => handleLineInputChange('2', 'jbWeight', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB weight"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Weight with Sealant (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].jbWeightWithSealant}
                                                        onChange={(e) => handleLineInputChange('2', 'jbWeightWithSealant', e.target.value)}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter JB weight with sealant"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Net Sealant Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].netSealantWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Total Module Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].totalModuleWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 lg:col-span-3">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line 2)
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['2'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('2', 'remarks', e.target.value)}
                                                        rows={2}
                                                        className="w-full p-2.5 rounded-lg dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Add any remarks for Line 2"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {renderSignatureSection()}
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
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Within Range</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.filledEntries > 0
                                            ? Math.round((monthlyStats.passCount / monthlyStats.filledEntries) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.passCount} within range
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    Shift-wise Statistics
                                </h3>
                                <div className="space-y-4">
                                    {(['A', 'B', 'C'] as const).map(shift => {
                                        const stats = monthlyStats.shiftStats?.[shift] || {
                                            filled: 0,
                                            pass: 0,
                                            fail: 0,
                                            lines: { '1': 0, '2': 0 }
                                        };

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
                                                    <span className="text-green-600">Within Range: {stats.pass}</span>
                                                    <span className="text-red-600">Out of Range: {stats.fail}</span>
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
                                    Weight Range Breakdown
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-green-600">Within Range (4-8)</span>
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
                                            <span className="text-red-600">Out of Range</span>
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
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 mt-6">
                    <div className="text-center text-sm text-red-500 dark:text-red-400 font-medium">
                        (Controlled Copy)
                    </div>
                </div>
            </div>
        </>
    );
}