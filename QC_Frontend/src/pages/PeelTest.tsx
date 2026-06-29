import { useState, useEffect } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import ZoomableChart from '../components/ZoomableChart';
import TestHeading from '../components/TestHeading';
import ReportPagination from '../components/ReportPagination';
import ReportListControls, { filterSortReports, ReportSortOption } from '../components/ReportListControls';

type PeelWorkflowState = 'draft' | 'submitted' | 'returned';
type PeelLine = 'FAB-II Line-I' | 'FAB-II Line-II';

interface ReportData {
    _id?: string;
    name: string;
    timestamp: string;
    formData: Record<string, string>;
    rowData: any[];
    averages?: { [key: string]: string; };
    line?: PeelLine | string;
    workflowState?: PeelWorkflowState;
    createdByUserId?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
    submittedAt?: string | null;
    submittedBy?: string | null;
    returnedAt?: string | null;
    returnedBy?: string | null;
    returnComments?: string | null;
    isSigned?: boolean;
    signedAt?: string | null;
    updatedAt?: string | null;
    s3_key?: string;
}

type TabType = 'edit-report' | 'saved-reports' | 'returned-reports' | 'report-analysis';

type GraphData = {
    date: string;
    average_value: number;
    max_value: number;
    min_value: number;
};

type ExtractedPeelRecord = {
    _id: string;
    year?: number;
    month?: string;
    month_name?: string;
    date?: string;
    Date?: string;
    shift?: string;
    Shift?: string;
    machine?: string;
    module_type?: string;
    cell_vendor?: string;
    Cell_Vendor?: string;
    po_number?: string;
    PO?: string;
    file_name?: string;
    Stringer?: number;
    Unit?: string;
    sample_results?: Array<{
        side: string;
        bus_pad_position: number;
        ribbon: number;
        value: number | string;
    }>;
    [key: string]: any;
};

const PEEL_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/peel';
const PEEL_REPORT_ROW_COUNT = 12;
const PEEL_LINES: Array<{ value: PeelLine; label: string; stringers: number[] }> = [
    { value: 'FAB-II Line-I', label: 'FAB-II Line-I', stringers: [1, 2, 3, 4, 5, 6] },
    { value: 'FAB-II Line-II', label: 'FAB-II Line-II', stringers: [7, 8, 9, 10, 11, 12] },
];
const PEEL_SESSION_KEYS = [
    'editingPeelReportIndex',
    'editingPeelReportData',
    'editingPeelReportId',
    'peelTestFormData',
    'suppressPeelAutoRestore',
];

const getWorkflowState = (report?: Pick<ReportData, 'workflowState'> | null): PeelWorkflowState =>
    report?.workflowState || 'submitted';

const formatWorkflowState = (state: PeelWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

const normalizePeelLine = (value?: string | null): PeelLine | '' => {
    if (value === 'FAB-II Line-I' || value === 'FAB-II Line-II') return value;
    const compact = (value || '').toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (['fab ii line i', 'line i', 'line 1', 'line one'].includes(compact)) return 'FAB-II Line-I';
    if (['fab ii line ii', 'line ii', 'line 2', 'line two'].includes(compact)) return 'FAB-II Line-II';
    return '';
};

const getLineStringers = (line: string) =>
    PEEL_LINES.find(item => item.value === normalizePeelLine(line))?.stringers || [];

const sanitizeReportPart = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const isUnknownValue = (value?: string) => {
    const raw = (value || '').trim();
    return !raw || raw.toUpperCase() === 'UNKNOWN';
};

const clearPeelSessionStorage = () => {
    PEEL_SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));
};

export default function PeelTest() {
    const [activeTab, setActiveTab] = useState<TabType>('edit-report');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentEditingReport, setCurrentEditingReport] = useState<string | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentWorkflowState, setCurrentWorkflowState] = useState<PeelWorkflowState>('draft');
    const [currentReportMeta, setCurrentReportMeta] = useState<ReportData | null>(null);
    const [savedReports, setSavedReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [returnModalReportIndex, setReturnModalReportIndex] = useState<number | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedShift, setSelectedShift] = useState('');
    const [selectedLine, setSelectedLine] = useState<PeelLine | ''>('');
    const [showReportEditor, setShowReportEditor] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [tableData, setTableData] = useState<Record<string, string>>({});
    const [preparedBySignature, setPreparedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

    const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
    const [stringer, setStringer] = useState('1');
    const [cellFace, setCellFace] = useState('');
    const [showChart, setShowChart] = useState(false);
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const [mainReportPage, setMainReportPage] = useState(1);
    const [mainReportPageSize, setMainReportPageSize] = useState(10);
    const [returnedReportPage, setReturnedReportPage] = useState(1);
    const [returnedReportPageSize, setReturnedReportPageSize] = useState(10);
    const [mainReportSearch, setMainReportSearch] = useState('');
    const [mainReportSort, setMainReportSort] = useState<ReportSortOption>('newest-updated');
    const [returnedReportSearch, setReturnedReportSearch] = useState('');
    const [returnedReportSort, setReturnedReportSort] = useState<ReportSortOption>('newest-updated');

    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const canCreateReport = isOperatorRole || isSystemAdminRole;
    const canEditCurrentReport = isSystemAdminRole
        || (isOperatorRole && (!currentReportId || ['draft', 'returned'].includes(currentWorkflowState)))
        || (isReviewerRole && currentReportId !== null && currentWorkflowState === 'submitted');
    const canSaveDraftCurrentReport = (isOperatorRole || isSystemAdminRole) && currentWorkflowState !== 'submitted';
    const canSubmitCurrentReport = (isOperatorRole || isSystemAdminRole)
        && currentWorkflowState !== 'submitted'
        && Boolean(selectedLine && selectedShift)
        && preparedBySignature.trim().length > 0
        && hasValidSubmissionMetadata();
    const canExportCurrentReport = currentReportId !== null && currentWorkflowState === 'submitted';
    const returnedReports = savedReports.filter(report => getWorkflowState(report) === 'returned');
    const reportsForMainList = isOperatorRole
        ? savedReports.filter(report => getWorkflowState(report) !== 'returned')
        : savedReports;

    const authHeaders = (includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    });

    useEffect(() => {
        clearPeelSessionStorage();
        loadSavedReports();
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            resetEditReportState();
            clearPeelSessionStorage();
        };
    }, []);

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        const storedEmployeeId = sessionStorage.getItem('employeeId');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
        setEmployeeId(storedEmployeeId);
        if (!['Operator', 'Admin', 'System Administrator'].includes(storedUserRole || '')) {
            setActiveTab('saved-reports');
        }
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (activeTab === 'edit-report') return;
        resetEditReportState();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'returned-reports' && returnedReports.length === 0) {
            setActiveTab('saved-reports');
        }
    }, [activeTab, returnedReports.length]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(reportsForMainList.length / mainReportPageSize));
        setMainReportPage(page => Math.min(page, totalPages));
    }, [reportsForMainList.length, mainReportPageSize]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(returnedReports.length / returnedReportPageSize));
        setReturnedReportPage(page => Math.min(page, totalPages));
    }, [returnedReports.length, returnedReportPageSize]);

    const apiService = {
        getAllReports: async (): Promise<ReportData[]> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        updateReport: async (id: string, report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                method: 'PUT',
                headers: authHeaders(true),
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        deleteReport: async (id: string): Promise<void> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${PEEL_API_BASE_URL}/peel-test-reports/name/${encodeURIComponent(name)}${excludeId ? `?exclude_id=${excludeId}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
        submitReport: async (id: string, report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}/submit`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to submit report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        returnReport: async (id: string, returnComments: string): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}/return`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ returnComments }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to return report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
    };

    const extractReportContext = (report: ReportData) => {
        try {
            const line = normalizePeelLine(report.line || report.formData?.selectedLine);
            if (report.formData?.selectedDate || report.formData?.selectedShift) {
                return {
                    date: (report.formData?.selectedDate as string) || '',
                    shift: (report.formData?.selectedShift as string) || '',
                    line
                };
            }
            const dateKey = Object.keys(report.formData).find(k => /^row_\d+_cell_0$/.test(k));
            const shiftKey = Object.keys(report.formData).find(k => /^row_\d+_cell_1$/.test(k));
            const dateVal = dateKey ? (report.formData[dateKey] as string) : '';
            const shiftVal = shiftKey ? (report.formData[shiftKey] as string) : '';
            if (dateVal || shiftVal || line) return { date: dateVal || '', shift: shiftVal || '', line };
            const match = /Peel_Test_Report_(\d+)_([A-Za-z]+)_(\d+)_Shift_([A-Za-z]+)/.exec(report.name);
            if (match) {
                const day = match[1];
                const monthName = match[2];
                const year = match[3];
                const shift = match[4];
                const parsedDate = new Date(`${monthName} ${day}, ${year}`);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : '';
                return { date: isoDate, shift, line };
            }
            return { date: '', shift: '', line };
        } catch (e) {
            console.error('Failed to extract date/shift from report', e);
            return { date: '', shift: '', line: '' as PeelLine | '' };
        }
    };

    const handleAddSignature = (section: 'prepared' | 'verified') => {
        if (!canEditCurrentReport) {
            showAlert('error', 'This report is locked in its current workflow state');
            return;
        }
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section. Please remove it first.`);
            return;
        }
        if (section === 'prepared' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can add signature to Prepared By section');
            return;
        }
        if (section === 'verified' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can add signature to Verified By section');
            return;
        }
        const signatureText = `${username}`;
        switch (section) {
            case 'prepared':
                setPreparedBySignature(signatureText);
                break;
            case 'verified':
                setVerifiedBySignature(signatureText);
                break;
        }
        setHasUnsavedChanges(true);
        showAlert('success', `Signature added to ${section} section`);
    };

    const handleRemoveSignature = (section: 'prepared' | 'verified') => {
        if (!canEditCurrentReport) {
            showAlert('error', 'This report is locked in its current workflow state');
            return;
        }
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }
        switch (section) {
            case 'prepared':
                setPreparedBySignature('');
                break;
            case 'verified':
                setVerifiedBySignature('');
                break;
        }
        setHasUnsavedChanges(true);
        showAlert('info', `Signature removed from ${section} section`);
    };

    const canRemoveSignature = (section: 'prepared' | 'verified') => {
        if (!username || !canEditCurrentReport) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        return currentSignature.includes(username);
    };

    const canAddSignature = (section: 'prepared' | 'verified') => {
        if (!username || !canEditCurrentReport) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (currentSignature.trim()) return false;
        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'verified':
                return ['Supervisor', 'Manager'].includes(userRole || '');
            default:
                return false;
        }
    };

    const resetEditReportState = () => {
        setHasUnsavedChanges(false);
        setCurrentEditingReport(null);
        setCurrentReportId(null);
        setCurrentWorkflowState('draft');
        setCurrentReportMeta(null);
        setFormData({});
        setTableData({});
        setShowReportEditor(false);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSelectedShift('');
        setSelectedLine('');
        setPreparedBySignature('');
        setVerifiedBySignature('');
        clearPeelSessionStorage();
    };

    const getSavedReports = async (): Promise<ReportData[]> => {
        try {
            return await apiService.getAllReports();
        } catch (error) {
            console.error('Error fetching saved reports:', error);
            showAlert('error', 'Failed to load saved reports');
            return [];
        }
    };

    const loadSavedReports = async () => {
        try {
            const reports = await getSavedReports();
            setSavedReports(reports);
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    };

    const getPeelRecordDate = (record: ExtractedPeelRecord) => record.date || record.Date || '';
    const getPeelRecordShift = (record: ExtractedPeelRecord) => record.shift || record.Shift || '';
    const getPeelRecordPO = (record: ExtractedPeelRecord) => record.po_number || record.PO || '';
    const getPeelRecordVendor = (record: ExtractedPeelRecord) => record.cell_vendor || record.Cell_Vendor || '';

    function getPopulatedReportRows(source: Record<string, string> = tableData) {
        const rowIndexes = Array.from(
            new Set(
                Object.keys(source)
                    .map(key => /^row_(\d+)_cell_\d+$/.exec(key)?.[1])
                    .filter((value): value is string => Boolean(value))
                    .map(Number)
            )
        ).sort((a, b) => a - b);

        return rowIndexes.filter(rowIndex => {
            for (let cellIndex = 0; cellIndex < 230; cellIndex++) {
                if ((source[`row_${rowIndex}_cell_${cellIndex}`] || '').trim()) return true;
            }
            return false;
        });
    }

    function hasValidSubmissionMetadata() {
        const populatedRows = getPopulatedReportRows();
        if (populatedRows.length === 0) return false;
        return populatedRows.every(rowIndex =>
            !isUnknownValue(tableData[`row_${rowIndex}_cell_4`])
            && !isUnknownValue(tableData[`row_${rowIndex}_cell_5`])
        );
    }

    const getSubmissionBlocker = () => {
        if (!selectedLine) return 'FAB-II line is required before submission';
        if (!selectedShift) return 'Shift is required before submission';
        if (!preparedBySignature.trim()) return 'Prepared By signature is required before submission';
        const populatedRows = getPopulatedReportRows();
        if (populatedRows.length === 0) return 'At least one peel test row is required before submission';
        if (populatedRows.some(rowIndex => isUnknownValue(tableData[`row_${rowIndex}_cell_4`]))) return 'PO cannot be UNKNOWN before submission';
        if (populatedRows.some(rowIndex => isUnknownValue(tableData[`row_${rowIndex}_cell_5`]))) return 'Cell Vendor cannot be UNKNOWN before submission';
        return '';
    };

    const getPeelMeasurementValue = (record: ExtractedPeelRecord, side: 'Front' | 'Back', position: number, ribbon: number) => {
        const flatValue = record[`${side}_${position}_${ribbon}`];
        if (flatValue !== undefined && flatValue !== null) return flatValue;
        const sampleValue = record.sample_results?.find(item =>
            item.side?.toLowerCase() === side.toLowerCase()
            && item.bus_pad_position === position
            && item.ribbon === ribbon
        );
        return sampleValue?.value;
    };

    const generateReportName = (dateString: string, shift: string, line: PeelLine) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `Peel_Test_Report_${day}_${month}_${year}_Shift_${shift}_${sanitizeReportPart(line)}`;
    };

    const fetchPeelData = async (date: string, shift: string) => {
        try {
            const response = await fetch(`${PEEL_API_BASE_URL}/date/${date}/shift/${shift}`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.status === 'success' && data.data && data.data.length > 0 ? data.data : null;
        } catch (error) {
            console.error('Error fetching peel data:', error);
            return null;
        }
    };

    const loadOrCreateReport = async () => {
        if (!canCreateReport) {
            showAlert('error', 'Only operators can create peel reports');
            return;
        }
        if (!selectedDate) {
            showAlert('error', 'Please select a date');
            return;
        }
        if (!selectedShift) {
            showAlert('error', 'Please select a shift');
            return;
        }
        if (!selectedLine) {
            showAlert('error', 'Please select a FAB-II line');
            return;
        }
        const reportName = generateReportName(selectedDate, selectedShift, selectedLine);
        const savedReports = await getSavedReports();
        const existingLocalReport = savedReports.find(report => report.name === reportName);
        if (existingLocalReport) {
            try {
                const fullReport = await apiService.getReportById(existingLocalReport._id!);
                loadReportForEditing(fullReport);
                showAlert('success', 'Loaded locally saved report');
            } catch (error) {
                console.error('Error loading full report:', error);
                showAlert('error', 'Failed to load report details');
            }
        } else {
            try {
                const mongoData = await fetchPeelData(selectedDate, selectedShift);
                const allowedStringers = getLineStringers(selectedLine);
                const lineData = (mongoData || []).filter((record: ExtractedPeelRecord) =>
                    allowedStringers.includes(Number(record.Stringer ?? record.stringer))
                );
                if (lineData.length > 0) {
                    createReportFromMongoData(reportName, lineData);
                    showAlert('success', 'Report created from database data');
                } else {
                    createNewReport(reportName);
                    showAlert('info', 'No data found in database. Created blank report');
                }
            } catch (error) {
                createNewReport(reportName);
                showAlert('info', 'Created blank report');
            }
        }
        setShowReportEditor(true);
        setHasUnsavedChanges(true);
    };

    const loadReportForEditing = (report: ReportData) => {
        const reportState = getWorkflowState(report);
        const signatureFields: Record<string, string> = {};
        Object.keys(report.formData).forEach(key => {
            if (key === 'preparedBySignature' || key === 'verifiedBySignature') signatureFields[key] = report.formData[key];
        });
        setTableData(report.formData);
        setFormData(signatureFields);
        setPreparedBySignature((report.formData.preparedBySignature as string) || '');
        setVerifiedBySignature((report.formData.verifiedBySignature as string) || '');
        setCurrentEditingReport(report.name);
        setCurrentReportId(report._id || null);
        setCurrentWorkflowState(reportState);
        setCurrentReportMeta(report);
        const { date: reportDate, shift: reportShift, line: reportLine } = extractReportContext(report);
        if (reportDate) setSelectedDate(reportDate);
        if (reportShift) setSelectedShift(reportShift);
        if (reportLine) setSelectedLine(reportLine);
        setShowReportEditor(true);
        setHasUnsavedChanges(reportState !== 'submitted');
    };

    const createReportFromMongoData = (reportName: string, mongoData: any[]) => {
        clearPeelSessionStorage();
        const sortedData = [...mongoData].sort((a, b) =>
            Number(a.Stringer ?? a.stringer ?? 0) - Number(b.Stringer ?? b.stringer ?? 0)
            || String(a.Unit ?? a.unit ?? '').localeCompare(String(b.Unit ?? b.unit ?? ''))
        );
        const newFormData: Record<string, string> = {
            selectedDate,
            selectedShift,
            selectedLine,
        };
        sortedData.forEach((record, repIndex) => {
            if (repIndex >= PEEL_REPORT_ROW_COUNT) return;
            newFormData[`row_${repIndex}_cell_0`] = getPeelRecordDate(record) || '';
            newFormData[`row_${repIndex}_cell_1`] = getPeelRecordShift(record) || '';
            newFormData[`row_${repIndex}_cell_2`] = (record.Stringer ?? record.stringer)?.toString() || '';
            newFormData[`row_${repIndex}_cell_3`] = record.Unit || record.unit || '';
            newFormData[`row_${repIndex}_cell_4`] = getPeelRecordPO(record);
            newFormData[`row_${repIndex}_cell_5`] = getPeelRecordVendor(record) || record['Cell Vendor'] || '';
            for (let position = 1; position <= 16; position++) {
                for (let ribbon = 1; ribbon <= 7; ribbon++) {
                    const value = getPeelMeasurementValue(record, 'Front', position, ribbon);
                    if (value !== undefined) {
                        const cellIndex = 6 + (position - 1) * 7 + (ribbon - 1);
                        newFormData[`row_${repIndex}_cell_${cellIndex}`] = value?.toString() || '';
                    }
                }
            }
            for (let position = 1; position <= 16; position++) {
                for (let ribbon = 1; ribbon <= 7; ribbon++) {
                    const value = getPeelMeasurementValue(record, 'Back', position, ribbon);
                    if (value !== undefined) {
                        const cellIndex = 118 + (position - 1) * 7 + (ribbon - 1);
                        newFormData[`row_${repIndex}_cell_${cellIndex}`] = value?.toString() || '';
                    }
                }
            }
        });
        if (mongoData[0]) {
            if (mongoData[0].preparedBy) newFormData['preparedBy'] = mongoData[0].preparedBy;
            if (mongoData[0].verifiedBy) newFormData['verifiedBy'] = mongoData[0].verifiedBy;
        }
        setTableData(newFormData);
        const signatureFields: Record<string, string> = {};
        if (newFormData['preparedBy']) signatureFields['preparedBy'] = newFormData['preparedBy'];
        if (newFormData['verifiedBy']) signatureFields['verifiedBy'] = newFormData['verifiedBy'];
        setFormData(signatureFields);
        setCurrentEditingReport(reportName);
        setCurrentReportId(null);
        setCurrentWorkflowState('draft');
        setCurrentReportMeta(null);
        setHasUnsavedChanges(true);
    };

    const createNewReport = (reportName: string) => {
        clearPeelSessionStorage();
        setTableData({ selectedDate, selectedShift, selectedLine });
        setCurrentEditingReport(reportName);
        setCurrentReportId(null);
        setCurrentWorkflowState('draft');
        setCurrentReportMeta(null);
        setHasUnsavedChanges(true);
    };

    const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
        if (!canEditCurrentReport) return;
        const cellId = `row_${rowIndex}_cell_${cellIndex}`;
        setTableData(prev => ({...prev, [cellId]: value }));
        setHasUnsavedChanges(true);
    };

    const calculateAverage = (rowIndex: number, startCell: number, count: number): string => {
        let sum = 0;
        let validCount = 0;
        for (let i = 0; i < count; i++) {
            const cellId = `row_${rowIndex}_cell_${startCell + i}`;
            const value = tableData[cellId];
            if (value && !isNaN(parseFloat(value))) {
                sum += parseFloat(value);
                validCount++;
            }
        }
        return validCount > 0 ? (sum / validCount).toFixed(2) : '0.00';
    };

    const shouldHighlightCell = (value: string): boolean => {
        return value === '' || (parseFloat(value) < 1.0 && !isNaN(parseFloat(value)));
    };

    const editSavedReport = async (index: number) => {
        try {
            setIsLoading(true);
            if (index < 0 || index >= savedReports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const report = savedReports[index];
            const state = getWorkflowState(report);
            if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) {
                showAlert('error', 'Draft and returned reports are locked until the operator submits them');
                return;
            }
            if (!report._id) {
                showAlert('error', 'Report ID not found');
                return;
            }
            const fullReport = await apiService.getReportById(report._id);
            loadReportForEditing(fullReport);
            setActiveTab('edit-report');
            showAlert('info', `${state === 'submitted' && isOperatorRole ? 'Viewing' : 'Opened'}: ${fullReport.name}`);
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSavedReport = async (index: number) => {
        try {
            if (index < 0 || index >= savedReports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const report = savedReports[index];
            const state = getWorkflowState(report);
            const canDelete = isSystemAdminRole
                || (isOperatorRole && state === 'draft')
                || (isReviewerRole && state === 'submitted');
            if (!canDelete) {
                showAlert('error', 'You are not authorized to delete this report');
                return;
            }
            await apiService.deleteReport(report._id!);
            if (report._id === currentReportId) resetEditReportState();
            await loadSavedReports();
            showAlert('info', 'Report deleted successfully');
        } catch (error) {
            console.error('Error deleting report:', error);
            showAlert('error', 'Failed to delete report');
        }
    };

    const analyzeReport = async () => {
        if (!monthYear) {
            showAlert('error', 'Please select a month and year');
            return;
        }
        if (!stringer) {
            showAlert('error', 'Please select a stringer');
            return;
        }
        if (!cellFace) {
            showAlert('error', 'Please select cell face');
            return;
        }
        const [year, month] = monthYear.split('-');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[parseInt(month) - 1];
        setShowChart(true);
        try {
            const graphData = await fetchGraphData(monthName, parseInt(year), parseInt(stringer), cellFace);
            if (graphData && graphData.data && graphData.data.length > 0) {
                setGraphData(graphData.data);
                showAlert('success', 'Analysis completed successfully');
            } else {
                setGraphData([]);
                showAlert('warning', 'No data available for the selected criteria');
            }
        } catch (error) {
            console.error('Error analyzing report:', error);
            showAlert('error', 'Failed to fetch analysis data');
        }
    };

    const fetchGraphData = async (month: string, year: number, stringer: number, cellFace: string) => {
        try {
            const response = await fetch(
                `${PEEL_API_BASE_URL}/graph-data?month=${month}&year=${year}&stringer=${stringer}&cell_face=${cellFace}`
            );
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching graph data:', error);
            throw error;
        }
    };

    const getCellFaceDisplayName = (cellFace: string) => {
        switch (cellFace) {
            case 'front': return 'Front';
            case 'back': return 'Back';
            case 'both': return 'Front + Back';
            default: return cellFace;
        }
    };

    const buildAverages = () => {
        const averages: { [key: string]: string } = {};
        for (let rep = 0; rep < PEEL_REPORT_ROW_COUNT; rep++) {
            for (let position = 1; position <= 16; position++) {
                const startCell = 6 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`front_avg_${rep}_${position}`] = average;
            }
            for (let position = 1; position <= 16; position++) {
                const startCell = 118 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`back_avg_${rep}_${position}`] = average;
            }
        }
        return averages;
    };

    const buildReportPayload = (): Omit<ReportData, '_id'> => {
        const averages = buildAverages();
        return {
            name: currentEditingReport || '',
            timestamp: currentReportMeta?.timestamp || new Date().toISOString(),
            line: selectedLine,
            formData: {
                ...tableData,
                ...formData,
                ...averages,
                selectedDate,
                selectedShift,
                selectedLine,
                preparedBySignature,
                verifiedBySignature
            },
            rowData: [],
            averages,
            workflowState: currentWorkflowState
        };
    };

    const saveDraftReport = async () => {
        if (!canSaveDraftCurrentReport || !canEditCurrentReport) {
            showAlert('error', 'You are not authorized to save this report');
            return;
        }
        if (!currentEditingReport || !selectedLine || !selectedShift) {
            showAlert('error', 'Please select line, date, and shift before saving a draft');
            return;
        }
        try {
            setIsLoading(true);
            const reportData = buildReportPayload();
            if (currentReportId) {
                const updatedReport = await apiService.updateReport(currentReportId, reportData);
                setCurrentReportMeta(updatedReport);
                setCurrentWorkflowState(getWorkflowState(updatedReport));
                showAlert('success', 'Draft saved successfully');
            } else {
                const nameExists = await apiService.checkReportNameExists(currentEditingReport);
                if (nameExists) {
                    showAlert('error', 'Report name already exists. Open it from the saved reports list.');
                    return;
                }
                const createdReport = await apiService.createReport(reportData);
                setCurrentReportId(createdReport._id || null);
                setCurrentReportMeta(createdReport);
                setCurrentWorkflowState(getWorkflowState(createdReport));
                showAlert('success', 'Draft saved successfully');
            }
            setHasUnsavedChanges(false);
            await loadSavedReports();
        } catch (error) {
            console.error('Error saving draft:', error);
            showAlert('error', 'Failed to save draft');
        } finally {
            setIsLoading(false);
        }
    };

    const submitReport = async () => {
        if (!currentEditingReport) {
            showAlert('error', 'Please load or create a report first');
            return;
        }
        const blocker = getSubmissionBlocker();
        if (blocker) {
            showAlert('error', blocker);
            return;
        }
        try {
            setIsLoading(true);
            const reportData = buildReportPayload();
            let reportId = currentReportId;
            if (!reportId) {
                const createdReport = await apiService.createReport(reportData);
                reportId = createdReport._id || null;
                setCurrentReportId(reportId);
            } else {
                await apiService.updateReport(reportId, reportData);
            }
            if (!reportId) {
                showAlert('error', 'Unable to submit report without a saved draft ID');
                return;
            }
            const submittedReport = await apiService.submitReport(reportId, reportData);
            setCurrentWorkflowState('submitted');
            setCurrentReportMeta(submittedReport);
            setHasUnsavedChanges(false);
            await loadSavedReports();
            resetEditReportState();
            setActiveTab('saved-reports');
            showAlert('success', currentWorkflowState === 'returned' ? 'Report resubmitted successfully' : 'Report submitted successfully');
        } catch (error) {
            console.error('Error submitting report:', error);
            showAlert('error', 'Failed to submit report');
        } finally {
            setIsLoading(false);
        }
    };

    const saveSubmittedChanges = async () => {
        if (!currentReportId || !canEditCurrentReport || currentWorkflowState !== 'submitted') {
            showAlert('error', 'You are not authorized to modify this report');
            return;
        }
        try {
            setIsLoading(true);
            const updatedReport = await apiService.updateReport(currentReportId, buildReportPayload());
            setCurrentReportMeta(updatedReport);
            setHasUnsavedChanges(false);
            await loadSavedReports();
            showAlert('success', 'Report changes saved successfully');
        } catch (error) {
            console.error('Error saving report:', error);
            showAlert('error', 'Failed to save report');
        } finally {
            setIsLoading(false);
        }
    };

    const saveReport = async () => {
        if (currentWorkflowState === 'submitted') {
            await saveSubmittedChanges();
            return;
        }
        await submitReport();
    };

    const exportToExcel = async () => {
        try {
            if (!currentReportId || currentWorkflowState !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted reports');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const response = await fetch(`${PEEL_API_BASE_URL}/generate-peel-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: currentReportId }),
            });
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentEditingReport}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('success', 'Excel file exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export Excel file');
        }
    };

    const exportSavedReportToExcel = async (index: number) => {
        try {
            if (index < 0 || index >= savedReports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const report = savedReports[index];
            if (getWorkflowState(report) !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted reports');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const response = await fetch(`${PEEL_API_BASE_URL}/generate-peel-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: report._id }),
            });
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report.name}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Excel file exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export Excel file');
        }
    };

    const openReturnModal = (index: number) => {
        if (index < 0 || index >= savedReports.length) {
            showAlert('error', 'Report not found');
            return;
        }
        const report = savedReports[index];
        if (getWorkflowState(report) !== 'submitted') {
            showAlert('error', 'Only submitted reports can be returned');
            return;
        }
        setReturnModalReportIndex(index);
        setReturnComment('');
        setReturnCommentError('');
    };

    const closeReturnModal = () => {
        setReturnModalReportIndex(null);
        setReturnComment('');
        setReturnCommentError('');
    };

    const submitReturnForCorrection = async () => {
        if (returnModalReportIndex === null) return;
        const trimmedComments = returnComment.trim();
        if (!trimmedComments) {
            setReturnCommentError('Comment is required');
            return;
        }
        try {
            setIsLoading(true);
            const report = savedReports[returnModalReportIndex];
            await apiService.returnReport(report._id!, trimmedComments);
            if (currentReportId === report._id) {
                setCurrentWorkflowState('returned');
                setCurrentReportMeta(prev => prev ? {
                    ...prev,
                    workflowState: 'returned',
                    returnComments: trimmedComments,
                    returnedAt: new Date().toISOString(),
                    returnedBy: username,
                } : prev);
            }
            await loadSavedReports();
            closeReturnModal();
            showAlert('success', 'Report returned for correction');
            setActiveTab('saved-reports');
        } catch (error) {
            console.error('Error returning report:', error);
            showAlert('error', 'Failed to return report');
        } finally {
            setIsLoading(false);
        }
    };

    const canOpenListedReport = (report: ReportData) =>
        isSystemAdminRole || isOperatorRole || (isReviewerRole && getWorkflowState(report) === 'submitted');

    const canDeleteListedReport = (report: ReportData) =>
        isSystemAdminRole
        || ((isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted')
        || (isOperatorRole && getWorkflowState(report) === 'draft');

    const canReturnListedReport = (report: ReportData) =>
        (isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted';

    const getOpenActionLabel = (report: ReportData) => {
        const state = getWorkflowState(report);
        if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) return 'Locked';
        if (isOperatorRole && state === 'submitted') return 'View';
        return state === 'submitted' && isReviewerRole ? 'Open' : 'Edit';
    };

    const generateTableRows = () => {
        const rows = [];
        const repetitions = PEEL_REPORT_ROW_COUNT;
        for (let rep = 0; rep < repetitions; rep++) {
            rows.push(
                <tr key={`front-header-${rep}`}>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_0`] || ''}
                            onChange={(e) => handleCellChange(rep, 0, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_1`] || ''}
                            onChange={(e) => handleCellChange(rep, 1, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_2`] || ''}
                            onChange={(e) => handleCellChange(rep, 2, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_3`] || ''}
                            onChange={(e) => handleCellChange(rep, 3, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_4`] || ''}
                            onChange={(e) => handleCellChange(rep, 4, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_5`] || ''}
                            onChange={(e) => handleCellChange(rep, 5, e.target.value)}
                        />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Front</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">1</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">2</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">3</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">4</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">5</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">6</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">7</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Avg. Value (N/mm)</td>
                </tr>
            );

            // Front data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 6 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`front-data-${rep}-${i}`}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`front-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 dark:border-gray-700 p-1 ${isHighlighted ? 'bg-red-200 dark:bg-red-700' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white">
                            {average}
                        </td>
                    </tr>
                );
            }

            // Back section header
            rows.push(
                <tr key={`back-header-${rep}`}>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Back</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">1</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">2</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">3</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">4</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">5</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">6</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">7</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Avg. Value (N/mm)</td>
                </tr>
            );

            // Back data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 118 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`back-data-${rep}-${i}`}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`back-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 dark:border-gray-700 p-1 ${isHighlighted ? 'bg-red-200 dark:bg-red-700' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light text-center bg-transparent dark:text-white"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white">
                            {average}
                        </td>
                    </tr>
                );
            }
        }

        return rows;
    };

    const renderEditReportTab = () => (
        <>
            {currentWorkflowState === 'returned' && currentReportMeta?.returnComments && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                    <strong>Returned for correction:</strong> {currentReportMeta.returnComments}
                    <div className="mt-1 text-xs">
                        Returned by {currentReportMeta.returnedBy || '-'} on {formatTimestamp(currentReportMeta.returnedAt)}
                    </div>
                </div>
            )}
            {canCreateReport && !showReportEditor && (
            <div className="date-selector bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-row gap-2 items-center justify-center flex-wrap">
                    <label htmlFor="line-select" className="font-semibold text-gray-700 dark:text-gray-300">
                        Line:
                    </label>
                    <select
                        id="line-select"
                        value={selectedLine}
                        onChange={(e) => setSelectedLine(e.target.value as PeelLine | '')}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                        <option value="" className="dark:bg-gray-800">-- Select Line --</option>
                        {PEEL_LINES.map(line => (
                            <option key={line.value} value={line.value} className="dark:bg-gray-800">{line.label}</option>
                        ))}
                    </select>
                    <label htmlFor="date-select" className="font-semibold text-gray-700 dark:text-gray-300">
                        Date:
                    </label>
                    <input
                        type="date"
                        id="date-select"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                    <label htmlFor="shift-select" className="font-semibold text-gray-700 dark:text-gray-300">
                        Shift:
                    </label>
                    <select
                        id="shift-select"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                        <option value="" className="dark:bg-gray-800">-- Select Shift --</option>
                        <option value="A" className="dark:bg-gray-800">Shift-A</option>
                        <option value="B" className="dark:bg-gray-800">Shift-B</option>
                        <option value="C" className="dark:bg-gray-800">Shift-C</option>
                    </select>
                    <button
                        onClick={loadOrCreateReport}
                        className="bg-gradient-to-r from-brand-primary to-brand-primary-hover border-transparent text-white rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Load Report
                    </button>
                </div>
            </div>
            )}
            {!canCreateReport && !showReportEditor && (
                <div className="rounded-md border border-gray-200 bg-white p-4 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    Open a submitted report from the reports tab to review it.
                </div>
            )}
            {showReportEditor && currentEditingReport && (
                <div className="report-info py-1 rounded-lg">
                    <div className="save-actions flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
                        <p className="current-report-title text-red-600 dark:text-red-400 font-bold bg-white dark:bg-gray-800 rounded p-2 text-sm text-center w-full">
                            {canEditCurrentReport ? 'Current report' : 'Viewing'}: <span className="break-all">{currentEditingReport}</span>
                            {selectedLine && <span className="ml-2 text-gray-600 dark:text-gray-300">({selectedLine})</span>}
                            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">{formatWorkflowState(currentWorkflowState)}</span>
                        </p>
                        {canSaveDraftCurrentReport && canEditCurrentReport && (
                            <button
                                className="save-btn w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-gray-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                onClick={saveDraftReport}
                            >
                                Save Draft
                            </button>
                        )}
                        {canEditCurrentReport && (
                            <button
                                className={`save-btn w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 font-semibold transition-all duration-300 ease-in-out text-white text-sm ${currentWorkflowState !== 'submitted' && !canSubmitCurrentReport ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary cursor-pointer hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg'}`}
                                onClick={saveReport}
                                disabled={currentWorkflowState !== 'submitted' && !canSubmitCurrentReport}
                                title={currentWorkflowState !== 'submitted' && !canSubmitCurrentReport ? getSubmissionBlocker() : undefined}
                            >
                                {currentWorkflowState === 'submitted' ? 'Save Changes' : currentWorkflowState === 'returned' ? 'Resubmit Report' : 'Submit Report'}
                            </button>
                        )}
                        {canExportCurrentReport && (
                            <button
                                className="export-excel w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-green-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                onClick={exportToExcel}
                            >
                                Export as Excel
                            </button>
                        )}
                        {currentReportId && currentWorkflowState === 'submitted' && (isReviewerRole || isSystemAdminRole) && (
                            <button
                                className="save-btn w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-amber-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                onClick={() => {
                                    const index = savedReports.findIndex(report => report._id === currentReportId);
                                    if (index >= 0) openReturnModal(index);
                                }}
                            >
                                Return for Correction
                            </button>
                        )}
                    </div>
                </div>
            )}
            {showReportEditor && (
                <div className="report-editor bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <fieldset disabled={!canEditCurrentReport} className={!canEditCurrentReport ? 'opacity-90' : ''}>
                    <div className="test-report-container p-1">
                        <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
                            <table className="w-full border-collapse min-w-[1200px] text-xs sm:text-sm">
                                <thead>
                                    <tr>
                                        <td colSpan={2} rowSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2">
                                            <img src="/LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" className="mx-auto" />
                                        </td>
                                        <td colSpan={10} rowSpan={2} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-center text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                                            VIKRAM SOLAR LIMITED
                                        </td>
                                        <td colSpan={3} rowSpan={1} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Doc. No.: VSL/QAD/FM/104
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Issue Date: 04.09.2024
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={10} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-center text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-white">
                                            Solar Cell Peel Strength Test Report
                                        </td>
                                        <td colSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Rev. No./ Date: 01/ 25.09.2024
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={15} className="border border-gray-300 dark:border-gray-700 p-2 bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">
                                            <strong>Allowable Limit: Peel strength average ≥ 1.0 N/mm</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Date</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Shift</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Stringer</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Unit</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">PO</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Cell Vendor</th>
                                        <th colSpan={8} className="border border-gray-300 dark:border-gray-700 p-2 text-center text-gray-800 dark:text-white">
                                            Bus Pad Position Wise Ribbon Peel Strength
                                        </th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generateTableRows()}
                                </tbody>
                            </table>
                        </div>
                        <div className="footer flex flex-col lg:flex-row justify-between mt-6 border-gray-300 dark:border-gray-700 gap-4">
                            <div className="signature flex-1 text-center mb-4">
                                <p className="font-bold text-gray-800 dark:text-white mb-2">PREPARED BY:</p>
                                <div className="w-full min-h-24 border border-gray-300 dark:border-gray-700 rounded-md flex items-center justify-center">
                                    <div className="text-center relative signature-field p-4 w-full h-full flex items-center justify-center">
                                        <span className="text-gray-800 dark:text-white text-lg font-semibold">{preparedBySignature}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canAddSignature('prepared') ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleAddSignature('prepared')}
                                        disabled={!canAddSignature('prepared')}
                                    >
                                        Add my Signature
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canRemoveSignature('prepared') ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleRemoveSignature('prepared')}
                                        disabled={!canRemoveSignature('prepared')}
                                    >
                                        Remove my Signature
                                    </button>
                                </div>
                            </div>
                            <div className="signature flex-1 text-center mb-4">
                                <p className="font-bold text-gray-800 dark:text-white mb-2">VERIFIED BY:</p>
                                <div className="w-full min-h-24 border border-gray-300 dark:border-gray-700 rounded-md flex items-center justify-center">
                                    <div className="text-center relative signature-field p-4 w-full h-full flex items-center justify-center">
                                        <span className="text-gray-800 dark:text-white text-lg font-semibold">{verifiedBySignature}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canAddSignature('verified') ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleAddSignature('verified')}
                                        disabled={!canAddSignature('verified')}
                                    >
                                        Add my Signature
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canRemoveSignature('verified') ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleRemoveSignature('verified')}
                                        disabled={!canRemoveSignature('verified')}
                                    >
                                        Remove my Signature
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </fieldset>
                </div>
            )}
        </>
    );

    const renderPeelReportsList = (reports: ReportData[], title: string, listType: 'main' | 'returned' = 'main') => {
        const page = listType === 'returned' ? returnedReportPage : mainReportPage;
        const pageSize = listType === 'returned' ? returnedReportPageSize : mainReportPageSize;
        const setPage = listType === 'returned' ? setReturnedReportPage : setMainReportPage;
        const setPageSize = listType === 'returned' ? setReturnedReportPageSize : setMainReportPageSize;
        const searchTerm = listType === 'returned' ? returnedReportSearch : mainReportSearch;
        const sortOption = listType === 'returned' ? returnedReportSort : mainReportSort;
        const setSearchTerm = listType === 'returned' ? setReturnedReportSearch : setMainReportSearch;
        const setSortOption = listType === 'returned' ? setReturnedReportSort : setMainReportSort;
        const filteredReports = filterSortReports(reports, searchTerm, sortOption);
        const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const paginatedReports = filteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);

        return (
        <div className="saved-reports-container bg-white dark:bg-gray-900 p-3 md:p-5 rounded-md shadow-lg dark:shadow-gray-900/30">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center text-gray-800 dark:text-gray-100">
                {title}
            </h2>
            <ReportListControls
                searchTerm={searchTerm}
                sortOption={sortOption}
                totalCount={reports.length}
                filteredCount={filteredReports.length}
                onSearchTermChange={(value) => {
                    setSearchTerm(value);
                    setPage(1);
                }}
                onSortOptionChange={(value) => {
                    setSortOption(value);
                    setPage(1);
                }}
                searchPlaceholder="Search by report, creator, employee ID, or status..."
            />
            {filteredReports.length === 0 ? (
                <div className="text-center py-6 md:py-8">
                    <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
                        {reports.length === 0 ? 'No peel reports found.' : 'No matching peel reports found.'}
                    </p>
                </div>
            ) : (
                <>
                <div className="reports-list">
                    {paginatedReports.map((report, index) => {
                        const originalIndex = report._id
                            ? savedReports.findIndex(savedReport => savedReport._id === report._id)
                            : savedReports.indexOf(report);
                        const state = getWorkflowState(report);
                        const canOpen = canOpenListedReport(report);
                        const canExport = state === 'submitted' && canOpen;

                        return (
                            <div
                                key={report._id || `${report.name}-${index}`}
                                className="report-item overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4 mb-3 md:mb-4 shadow-sm bg-white dark:bg-gray-800"
                            >
                                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="min-w-0 text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 break-words">{report.name}</h3>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state === 'submitted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : state === 'returned' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                                                {formatWorkflowState(state)}
                                            </span>
                                            {report.line && (
                                                <span className="rounded-full bg-brand-primary-soft px-2 py-0.5 text-xs font-semibold text-brand-primary dark:bg-brand-primary/15 dark:text-brand-primary-light">
                                                    {report.line}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 grid gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                            <p>Created: {formatTimestamp(report.timestamp)}</p>
                                            <p>Created by: {report.createdByEmployeeName || report.createdByEmployeeId || 'Legacy report'}</p>
                                            <p>Updated: {formatTimestamp(report.updatedAt || report.timestamp)}</p>
                                            {report.submittedAt && <p>Submitted: {formatTimestamp(report.submittedAt)} by {report.submittedBy || '-'}</p>}
                                            {state === 'returned' && report.returnComments && (
                                                <p className="text-amber-700 dark:text-amber-300">Return comments: {report.returnComments}</p>
                                            )}
                                            {state === 'returned' && (
                                                <p>Returned: {formatTimestamp(report.returnedAt)} by {report.returnedBy || '-'}</p>
                                            )}
                                            {isReviewerRole && state !== 'submitted' && !isSystemAdminRole && (
                                                <p className="text-gray-500 dark:text-gray-400">Metadata only until submitted.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-wrap gap-2 justify-start lg:w-auto lg:shrink-0 lg:justify-end">
                                        <button
                                            className={`flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium transition-all ${canExport ? 'bg-brand-primary dark:bg-brand-primary text-white hover:bg-green-500 dark:hover:bg-green-600 cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                                            onClick={() => canExport && originalIndex >= 0 && exportSavedReportToExcel(originalIndex)}
                                            disabled={!canExport}
                                            title={canExport ? 'Export to Excel' : 'Excel is available only after submission'}
                                        >
                                            Excel
                                        </button>
                                        <button
                                            className={`flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium transition-all ${canOpen ? 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                                            onClick={() => canOpen && originalIndex >= 0 && editSavedReport(originalIndex)}
                                            disabled={!canOpen}
                                        >
                                            {getOpenActionLabel(report)}
                                        </button>
                                        {canReturnListedReport(report) && (
                                            <button
                                                className="flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium bg-amber-600 text-white transition-all hover:bg-amber-700 cursor-pointer"
                                                onClick={() => originalIndex >= 0 && openReturnModal(originalIndex)}
                                            >
                                                Return
                                            </button>
                                        )}
                                        {canDeleteListedReport(report) && (
                                            <button
                                                className="flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium bg-red-500 dark:bg-red-600 text-white transition-all hover:bg-red-600 dark:hover:bg-red-700 cursor-pointer"
                                                onClick={() => {
                                                    showConfirm({
                                                        title: 'Delete Report',
                                                        message: `Are you sure you want to delete "${report.name}"? This action cannot be undone.`,
                                                        type: 'warning',
                                                        confirmText: 'Delete',
                                                        onConfirm: () => originalIndex >= 0 && deleteSavedReport(originalIndex),
                                                    });
                                                }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <ReportPagination
                    totalItems={filteredReports.length}
                    page={safePage}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(nextPageSize) => {
                        setPageSize(nextPageSize);
                        setPage(1);
                    }}
                    itemLabel="reports"
                />
                </>
            )}
        </div>
        );
    };

    const renderSavedReportsTab = () => renderPeelReportsList(
        reportsForMainList,
        isOperatorRole ? 'Submitted/Draft Reports' : 'Submitted Reports',
        'main'
    );

    const renderReportAnalysisTab = () => (
        <div className="report-analysis-container bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
            <div className="flex flex-col md:flex-row gap-2 items-center justify-center flex-wrap rounded-md">
                <label htmlFor="monthYear" className="font-semibold text-gray-700 dark:text-gray-300">
                    Month & Year:
                </label>
                <input
                    type="month"
                    id="monthYear"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="cursor-pointer p-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <label htmlFor="stringer-select" className="font-semibold text-gray-700 dark:text-gray-300">
                    Stringer:
                </label>
                <input
                    type="number"
                    id="stringer-select"
                    value={stringer}
                    onChange={(e) => setStringer(e.target.value)}
                    min="1"
                    max="12"
                    className="cursor-pointer p-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white w-20"
                />
                <label htmlFor="face-select" className="font-semibold text-gray-700 dark:text-gray-300">
                    Cell Face:
                </label>
                <select
                    id="face-select"
                    value={cellFace}
                    onChange={(e) => setCellFace(e.target.value)}
                    className="cursor-pointer p-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-brand-primary dark:border-b-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-primary hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                    <option value="" className="dark:bg-gray-800">-- Select --</option>
                    <option value="front" className="dark:bg-gray-800">Front</option>
                    <option value="back" className="dark:bg-gray-800">Back</option>
                    <option value="both" className="dark:bg-gray-800">Front + Back</option>
                </select>
                <button
                    onClick={analyzeReport}
                    className="bg-gradient-to-r from-brand-primary to-brand-primary-hover border-transparent text-white rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    Analyze
                </button>
            </div>
            {showChart && graphData.length > 0 && (
                <div className="chart-container bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4 mt-4 shadow-sm">
                    <div className="min-h-[360px] h-[48vh] max-h-[620px] w-full [&_.h-80]:h-full">
                        <ZoomableChart
                            chartData={prepareChartData()}
                            options={prepareChartOptions()}
                            type="line"
                        />
                    </div>
                </div>
            )}
            {showChart && graphData.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No data available for the selected criteria. Please try different parameters.
                </div>
            )}
        </div>
    );

    const prepareChartData = () => {
        const labels = graphData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-GB');
        });

        const dataPoints = graphData.map(item => item.average_value);
        const maxValues = graphData.map(item => item.max_value);
        const minValues = graphData.map(item => item.min_value);

        return {
            labels,
            datasets: [
                {
                    label: `Average Peel Strength (N/mm)`,
                    data: dataPoints,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.14)',
                    borderWidth: 2.5,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.4
                },
                {
                    label: `Maximum Value (N/mm)`,
                    data: maxValues,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.12)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.4
                },
                {
                    label: `Minimum Value (N/mm)`,
                    data: minValues,
                    borderColor: '#ca8a04',
                    backgroundColor: 'rgba(202, 138, 4, 0.12)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.4
                },
                {
                    label: 'Minimum Requirement (1.0 N/mm)',
                    data: Array(labels.length).fill(1.0),
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        };
    };

    const prepareChartOptions = () => {
        const [year, month] = monthYear.split('-');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[parseInt(month) - 1];
        const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';
        const mutedColor = isDarkMode ? '#9ca3af' : '#4b5563';
        const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.22)' : 'rgba(107, 114, 128, 0.18)';
        const tooltipBg = isDarkMode ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.96)';
        const tooltipBorder = isDarkMode ? '#374151' : '#d1d5db';

        return {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 100,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: `Peel Strength Analysis - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}, Stringer ${stringer}, ${getCellFaceDisplayName(cellFace)}`,
                    font: {
                        size: 16,
                        weight: '600',
                    },
                    color: textColor,
                    padding: {
                        bottom: 18
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function (context: any) {
                            const datasetLabel = context.dataset.label || '';
                            const value = context.parsed.y;
                            if (datasetLabel.includes('Average')) {
                                return `Avg Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Maximum')) {
                                return `Max Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Minimum Value')) {
                                return `Min Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Requirement')) {
                                return `Min Requirement: ${value} N/mm`;
                            }
                            return `${datasetLabel}: ${value} N/mm`;
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 18
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day of Month',
                        color: mutedColor
                    },
                    grid: {
                        display: true,
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        maxRotation: 0,
                        autoSkipPadding: 18
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Peel Strength (N/mm)',
                        color: mutedColor
                    },
                    min: 0,
                    grid: {
                        display: true,
                        color: gridColor
                    },
                    ticks: {
                        callback: function (value: any) {
                            return value + ' N/mm';
                        },
                        color: textColor
                    }
                }
            },
            animation: {
                duration: 1000
            }
        };
    };

    return (
        <>
            <div className="mx-auto">
                {isLoading && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary"></div>
                            <p className="mt-2 text-gray-700 dark:text-gray-300">Loading...</p>
                        </div>
                    </div>
                )}
                {returnModalReportIndex !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                        <div className="w-full max-w-md rounded-md bg-white p-4 shadow-xl dark:bg-gray-900">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return for Correction</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {savedReports[returnModalReportIndex]?.name}
                            </p>
                            <textarea
                                value={returnComment}
                                onChange={(event) => {
                                    setReturnComment(event.target.value);
                                    if (returnCommentError) setReturnCommentError('');
                                }}
                                rows={4}
                                className="mt-3 w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                placeholder="Enter correction comments"
                            />
                            {returnCommentError && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{returnCommentError}</p>
                            )}
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    onClick={closeReturnModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                                    onClick={submitReturnForCorrection}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <TestHeading
                    heading="Solar Cell Peel Strength Test"
                    criteria="Peel strength average ≥ 1.0 N/mm"
                />
                <div className="flex justify-center mb-2">
                    {canCreateReport && (
                        <div
                            className={`tab ${activeTab === 'edit-report' ? 'active bg-white dark:bg-gray-900 text-brand-primary border-b-2 border-b-brand-primary translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => {
                                resetEditReportState();
                                setActiveTab('edit-report');
                            }}
                        >
                            Create Report
                        </div>
                    )}
                    <div
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white dark:bg-gray-900 text-brand-primary border-b-2 border-b-brand-primary translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('saved-reports')}
                    >
                        {isOperatorRole ? 'Submitted/Draft Reports' : 'Submitted Reports'}
                    </div>
                    {isOperatorRole && returnedReports.length > 0 && (
                        <div
                            className={`tab relative ${activeTab === 'returned-reports' ? 'active bg-white dark:bg-gray-900 text-brand-primary border-b-2 border-b-brand-primary translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => setActiveTab('returned-reports')}
                        >
                            Returned Reports
                            <span className="absolute right-3 top-1.5 min-w-5 h-5 rounded-full bg-red-600 px-1.5 text-[11px] leading-5 text-white">
                                {returnedReports.length}
                            </span>
                        </div>
                    )}
                    <div
                        className={`tab ${activeTab === 'report-analysis' ? 'active bg-white dark:bg-gray-900 text-brand-primary border-b-2 border-b-brand-primary translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('report-analysis')}
                    >
                        Report Analysis
                    </div>
                </div>
                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'edit-report' && renderEditReportTab()}
                    {activeTab === 'saved-reports' && renderSavedReportsTab()}
                    {activeTab === 'returned-reports' && isOperatorRole && renderPeelReportsList(returnedReports, 'Returned Reports', 'returned')}
                    {activeTab === 'report-analysis' && renderReportAnalysisTab()}
                </div>
            </div>
        </>
    );
}

