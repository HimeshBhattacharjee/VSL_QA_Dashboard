import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import FabLineSelectionModal from '../components/FabLineSelectionModal';
import { Check, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Download, Edit3, Eye, Plus, RotateCcw, Search, Trash2, Save, X, BarChart3, Percent, Target, TrendingUp, FileSpreadsheet } from 'lucide-react';
import ReportPagination from '../components/ReportPagination';
import {
    buildWorkflowConfirmOptions,
    isResolvedCreator,
    OPERATOR_SIGNATURE_REQUIRED_MESSAGE,
    resolveCreatorName,
} from '../utilities/workflowUtils';
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

type WorkflowState = 'draft' | 'submitted' | 'approved' | 'returned';
type MainView = 'dashboard' | 'entry-register';
type DashboardPeriod = 'daily' | 'weekly' | 'monthly';
type EntryAccessMode = 'edit' | 'view';
type EntrySortOption =
    | 'newest-created'
    | 'oldest-created'
    | 'newest-updated'
    | 'oldest-updated'
    | 'status'
    | 'created-by'
    | 'date-newest'
    | 'date-oldest';

interface DailyEntry {
    _id?: string;
    id?: string;
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
    signatures?: SignatureData;
    preparedBySignature?: string;
    reviewedBySignature?: string;
    approvedBySignature?: string;
    status?: WorkflowState;
    workflowState?: WorkflowState;
    displayStatus?: WorkflowState;
    createdBy?: string | null;
    createdByUserId?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
    createdByLabel?: string;
    createdAt?: string | null;
    submittedAt?: string | null;
    submittedBy?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    returnedAt?: string | null;
    returnedBy?: string | null;
    returnComments?: string | null;
    isSigned?: boolean;
    signedAt?: string | null;
    updatedAt?: string | null;
    lockedBy?: string | null;
    lockedByUserId?: string | null;
    lockedByEmployeeId?: string | null;
    lockTimestamp?: string | null;
    isLocked?: boolean;
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

interface EntryListFilters {
    dateFrom: string;
    dateTo: string;
    status: '' | WorkflowState;
}

interface DashboardGroupSummary {
    key: string;
    date?: string;
    dayName?: string;
    displayDate?: string;
    totalEntries: number;
    draft: number;
    submitted: number;
    returned: number;
    approved: number;
}

interface DashboardResponse {
    view: DashboardPeriod;
    dateFrom: string;
    dateTo: string;
    summary: {
        totalEntries: number;
        draft: number;
        submitted: number;
        returned: number;
        approved: number;
    };
    groups: DashboardGroupSummary[];
    items: DailyEntry[];
    total: number;
    truncated: boolean;
}

interface BulkOperationStatus {
    action: string;
    completed: number;
    total: number;
}

interface BulkOperationResult {
    requested?: number;
    approved?: number;
    deleted?: number;
    downloaded?: number;
    processed?: number;
    skipped?: Record<string, number>;
    skippedCount?: number;
    failed?: Array<{ entryId?: string; reportId?: string; reason?: string }>;
    failedCount?: number;
}

const FINALIZED_WORKFLOW_STATES = new Set<WorkflowState>(['submitted', 'approved']);
const EDITABLE_OPERATOR_WORKFLOW_STATES = new Set<WorkflowState>(['draft', 'returned']);
const APPROVED_DELETE_TOOLTIP = 'Approved reports are permanently retained and cannot be deleted.';

const getTodayDate = () => new Date().toISOString().split('T')[0];
const normalizeDate = (dateStr?: string) => dateStr ? dateStr.split('T')[0] : '';
const getEntryId = (entry?: DailyEntry | null) => entry?._id || entry?.id || '';
const getWorkflowState = (entry?: Pick<DailyEntry, 'workflowState' | 'status'> | null): WorkflowState =>
    entry?.workflowState || entry?.status || 'submitted';
const formatWorkflowState = (state: WorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);
const sumObjectValues = (values: Record<string, number>) =>
    Object.values(values).reduce((total, count) => total + count, 0);

const normalizeEntry = (entry: DailyEntry): DailyEntry => {
    const date = normalizeDate(entry.date || entry.testingDate || getTodayDate());
    const signatures = entry.signatures || {
        preparedBy: entry.preparedBySignature || '',
        reviewedBy: entry.reviewedBySignature || '',
        approvedBy: entry.approvedBySignature || '',
    };

    return {
        ...entry,
        date,
        testingDate: normalizeDate(entry.testingDate || date),
        status: getWorkflowState(entry),
        workflowState: getWorkflowState(entry),
        displayStatus: entry.displayStatus || getWorkflowState(entry),
        po: entry.po || '',
        moduleType: entry.moduleType || '',
        moduleSerial: entry.moduleSerial || '',
        jbSupplier: entry.jbSupplier || '',
        sealantSupplier: entry.sealantSupplier || '',
        backsheetSupplier: entry.backsheetSupplier || '',
        result: entry.result || '',
        testDoneBy: entry.testDoneBy || '',
        remarks: entry.remarks || '',
        signatures: {
            preparedBy: signatures.preparedBy || '',
            reviewedBy: signatures.reviewedBy || '',
            approvedBy: signatures.approvedBy || '',
        },
    };
};

const formatDateLabel = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
};

function EnterpriseRoTTest() {
    const [activeTab, setActiveTab] = useState<MainView>('dashboard');
    const [dashboardView, setDashboardView] = useState<DashboardPeriod>('daily');
    const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
    const [isDashboardLoading, setIsDashboardLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState('');
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry[]>>(new Map());
    const [currentAccessMode, setCurrentAccessMode] = useState<EntryAccessMode>('edit');
    const [readOnlyReason, setReadOnlyReason] = useState('');
    const [dateEntrySelector, setDateEntrySelector] = useState<{ date: string; entries: DailyEntry[] } | null>(null);
    const [returnModalEntry, setReturnModalEntry] = useState<DailyEntry | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const [entryRegister, setEntryRegister] = useState<DailyEntry[]>([]);
    const [entryRegisterTotal, setEntryRegisterTotal] = useState(0);
    const [isEntryRegisterLoading, setIsEntryRegisterLoading] = useState(false);
    const [entryRegisterPage, setEntryRegisterPage] = useState(1);
    const [entryRegisterPageSize, setEntryRegisterPageSize] = useState(20);
    const [entryRegisterSearchInput, setEntryRegisterSearchInput] = useState('');
    const [entryRegisterSearch, setEntryRegisterSearch] = useState('');
    const [entryRegisterSort, setEntryRegisterSort] = useState<EntrySortOption>('date-newest');
    const [entryRegisterFilters, setEntryRegisterFilters] = useState<EntryListFilters>({
        dateFrom: '',
        dateTo: '',
        status: '',
    });
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [selectedEntryRecords, setSelectedEntryRecords] = useState<Record<string, DailyEntry>>({});
    const [bulkOperationStatus, setBulkOperationStatus] = useState<BulkOperationStatus | null>(null);
    const lastSelectedEntryIdRef = useRef<string | null>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/rot-test-reports`;
    const months = useMemo(() => [...MONTH_NAMES], []);
    const years = useMemo(() => Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index), [currentDate]);
    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const isReviewerLikeRole = isReviewerRole || isSystemAdminRole;
    const currentWorkflowState = getWorkflowState(currentEntry);
    const isCurrentEntryOwner = Boolean(currentEntry) && (
        (!getEntryId(currentEntry) && isOperatorRole)
        || isResolvedCreator(currentEntry, { employeeId, username })
    );
    const canCreateEntry = isOperatorRole;
    const canEditCurrentEntry = currentAccessMode === 'edit' && Boolean(currentEntry) && (
        (isOperatorRole && (!getEntryId(currentEntry) || (isCurrentEntryOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))))
        || (isReviewerLikeRole && Boolean(getEntryId(currentEntry)) && currentWorkflowState === 'submitted')
    );
    const canSaveCurrentEntry = canEditCurrentEntry && (
        (isOperatorRole && (!getEntryId(currentEntry) || isCurrentEntryOwner) && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))
        || (isReviewerLikeRole && Boolean(getEntryId(currentEntry)) && currentWorkflowState === 'submitted')
    );
    const canSubmitCurrentEntry = Boolean(currentEntry) && isOperatorRole
        && (!getEntryId(currentEntry) || isCurrentEntryOwner)
        && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState);
    const canApproveCurrentEntry = Boolean(getEntryId(currentEntry)) && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canReturnCurrentEntry = Boolean(getEntryId(currentEntry)) && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canDeleteCurrentEntry = Boolean(getEntryId(currentEntry)) && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canExportCurrentEntry = Boolean(getEntryId(currentEntry)) && FINALIZED_WORKFLOW_STATES.has(currentWorkflowState) && (isOperatorRole || isReviewerLikeRole);

    const authHeaders = useCallback((includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    }), [employeeId, username, userRole]);

    useEffect(() => {
        setUserRole(sessionStorage.getItem('userRole'));
        setUsername(sessionStorage.getItem('username'));
        setEmployeeId(sessionStorage.getItem('employeeId'));
    }, []);

    const isEntryOwner = useCallback((entry: DailyEntry) =>
        isResolvedCreator(entry, { employeeId, username }), [employeeId, username]);

    const getEntryPermissions = useCallback((entry: DailyEntry) => {
        const state = getWorkflowState(entry);
        const isOwner = isEntryOwner(entry);
        return {
            canView: isOperatorRole || isReviewerLikeRole,
            canEdit: (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state))
                || (isReviewerLikeRole && state === 'submitted'),
            canSubmit: isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state),
            canExport: FINALIZED_WORKFLOW_STATES.has(state) && (isOperatorRole || isReviewerLikeRole),
            canApprove: isReviewerLikeRole && state === 'submitted',
            canReturn: isReviewerLikeRole && state === 'submitted',
            canDelete: isReviewerLikeRole && state === 'submitted',
        };
    }, [isEntryOwner, isOperatorRole, isReviewerLikeRole]);

    const getReadOnlyReason = useCallback((entry: DailyEntry) => {
        const state = getWorkflowState(entry);
        if (state === 'draft') return 'Draft entries are locked to the creating operator until submission.';
        if (state === 'returned') return 'Returned entries are locked to the original operator until resubmission.';
        if (state === 'approved') return 'Approved entries are read-only.';
        return 'This entry is read-only for your role.';
    }, []);

    const getStateBadgeClass = (state: WorkflowState) => {
        if (state === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
        if (state === 'submitted') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
        if (state === 'returned') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    };

    const getDateStatusClass = (entries: DailyEntry[]) => {
        const states = entries.map(entry => getWorkflowState(entry));
        if (states.includes('returned')) return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20';
        if (states.includes('submitted')) return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
        if (states.length > 0 && states.every(state => state === 'approved')) return 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20';
        if (states.includes('draft')) return 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
        return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
    };

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`, {
                headers: authHeaders(),
            });
            const json = await response.json();
            const entries = (Array.isArray(json?.data) ? json.data : []).map((entry: DailyEntry) => normalizeEntry(entry));
            const grouped = new Map<string, DailyEntry[]>();
            entries.forEach((entry: DailyEntry) => {
                const date = normalizeDate(entry.date);
                grouped.set(date, [...(grouped.get(date) || []), entry]);
            });
            setMonthlyEntries(grouped);
        } catch (error) {
            console.error('Error loading Robustness monthly data:', error);
            setMonthlyEntries(new Map());
        }
    }, [API_BASE_URL, authHeaders]);

    const loadDashboard = useCallback(async () => {
        try {
            setIsDashboardLoading(true);
            const response = await fetch(`${API_BASE_URL}/dashboard?view=${dashboardView}`, {
                headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch dashboard');
            setDashboardData(await response.json());
        } catch (error) {
            console.error('Error loading Robustness dashboard:', error);
            setDashboardData(null);
        } finally {
            setIsDashboardLoading(false);
        }
    }, [API_BASE_URL, authHeaders, dashboardView]);

    const loadEntryRegister = useCallback(async () => {
        try {
            setIsEntryRegisterLoading(true);
            const query = new URLSearchParams({
                page: String(entryRegisterPage),
                page_size: String(entryRegisterPageSize),
                sort: entryRegisterSort,
            });
            if (entryRegisterSearch.trim()) query.append('search', entryRegisterSearch.trim());
            if (entryRegisterFilters.dateFrom) query.append('date_from', entryRegisterFilters.dateFrom);
            if (entryRegisterFilters.dateTo) query.append('date_to', entryRegisterFilters.dateTo);
            if (entryRegisterFilters.status) query.append('status', entryRegisterFilters.status);
            const response = await fetch(`${API_BASE_URL}/entries/register?${query.toString()}`, {
                headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch entry register');
            const json = await response.json();
            setEntryRegister((json.items || []).map((entry: DailyEntry) => normalizeEntry(entry)));
            setEntryRegisterTotal(json.total || 0);
        } catch (error) {
            console.error('Error loading Robustness entry register:', error);
            setEntryRegister([]);
            setEntryRegisterTotal(0);
        } finally {
            setIsEntryRegisterLoading(false);
        }
    }, [API_BASE_URL, authHeaders, entryRegisterFilters, entryRegisterPage, entryRegisterPageSize, entryRegisterSearch, entryRegisterSort]);

    const refreshWorkflowViews = useCallback(async () => {
        await Promise.all([
            loadDashboard(),
            loadEntryRegister(),
            loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1),
        ]);
    }, [currentDate, loadDashboard, loadEntryRegister, loadMonthlyData]);

    useEffect(() => {
        loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
    }, [currentDate, loadMonthlyData]);

    useEffect(() => {
        if (activeTab === 'dashboard') loadDashboard();
    }, [activeTab, loadDashboard]);

    useEffect(() => {
        if (activeTab === 'entry-register') loadEntryRegister();
    }, [activeTab, loadEntryRegister]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setEntryRegisterSearch(entryRegisterSearchInput.trim());
            setEntryRegisterPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [entryRegisterSearchInput]);

    const clearEntrySelection = useCallback(() => {
        setSelectedEntryIds(new Set());
        setSelectedEntryRecords({});
        lastSelectedEntryIdRef.current = null;
    }, []);

    useEffect(() => {
        clearEntrySelection();
    }, [activeTab, entryRegisterFilters, entryRegisterSearch, clearEntrySelection]);

    useEffect(() => {
        if (selectedEntryIds.size === 0) return;
        setSelectedEntryRecords(prev => {
            const next = { ...prev };
            entryRegister.forEach(entry => {
                const entryId = getEntryId(entry);
                if (entryId && selectedEntryIds.has(entryId)) next[entryId] = entry;
            });
            return next;
        });
    }, [entryRegister, selectedEntryIds]);

    const createEmptyEntry = useCallback((date: string): DailyEntry => ({
        date,
        testingDate: date,
        po: '',
        moduleType: '',
        moduleSerial: '',
        jbSupplier: '',
        sealantSupplier: '',
        backsheetSupplier: '',
        result: '',
        testDoneBy: username || '',
        remarks: '',
        status: 'draft',
        workflowState: 'draft',
        displayStatus: 'draft',
        signatures: { preparedBy: '', reviewedBy: '', approvedBy: '' },
    }), [username]);

    const openNewEntryForDate = useCallback((date: string) => {
        if (!canCreateEntry) {
            showAlert('info', 'Only operators can create draft entries.');
            return;
        }
        const entryDate = new Date(`${date}T00:00:00`);
        setCurrentDate(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1));
        setSelectedDate(date);
        setCurrentEntry(createEmptyEntry(date));
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
        setIsEditing(false);
        setDateEntrySelector(null);
        setDashboardView('daily');
        setActiveTab('dashboard');
    }, [canCreateEntry, createEmptyEntry, showAlert]);

    const openEntryFromRegister = useCallback(async (entryMetadata: DailyEntry, requestedMode: EntryAccessMode = 'edit') => {
        const entryId = getEntryId(entryMetadata);
        if (!entryId) {
            showAlert('error', 'Entry ID not found');
            return;
        }
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/entries/by-id/${entryId}`, {
                headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch entry');
            const selectedEntry = normalizeEntry(await response.json());
            const permissions = getEntryPermissions(selectedEntry);
            const accessMode: EntryAccessMode = requestedMode === 'edit' && permissions.canEdit ? 'edit' : 'view';
            const entryDate = new Date(`${selectedEntry.date}T00:00:00`);
            setCurrentDate(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1));
            setSelectedDate(selectedEntry.date);
            setCurrentEntry(selectedEntry);
            setCurrentAccessMode(accessMode);
            setReadOnlyReason(accessMode === 'view' ? getReadOnlyReason(selectedEntry) : '');
            setIsEditing(true);
            setDateEntrySelector(null);
            setDashboardView('daily');
            setActiveTab('dashboard');
        } catch (error) {
            console.error('Error opening Robustness entry:', error);
            showAlert('error', 'Failed to open entry');
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, authHeaders, getEntryPermissions, getReadOnlyReason, showAlert]);

    const handleDateSelect = useCallback((date: string) => {
        const entries = monthlyEntries.get(date) || [];
        setSelectedDate(date);
        if (entries.length === 0) {
            openNewEntryForDate(date);
            return;
        }
        if (entries.length === 1) {
            void openEntryFromRegister(entries[0], 'edit');
            return;
        }
        setDateEntrySelector({ date, entries });
    }, [monthlyEntries, openEntryFromRegister, openNewEntryForDate]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setCurrentEntry(null);
        setDateEntrySelector(null);
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setCurrentEntry(null);
        setDateEntrySelector(null);
    };

    const handleMonthChange = (monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setCurrentEntry(null);
        setDateEntrySelector(null);
    };

    const handleYearChange = (year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
        setCurrentEntry(null);
        setDateEntrySelector(null);
    };

    const handleTodayEntry = () => {
        const today = getTodayDate();
        const todayDate = new Date(`${today}T00:00:00`);
        if (todayDate.getMonth() !== currentDate.getMonth() || todayDate.getFullYear() !== currentDate.getFullYear()) {
            setCurrentDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
        }
        handleDateSelect(today);
    };

    const resetSelection = () => {
        setCurrentEntry(null);
        setSelectedDate('');
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
        setDateEntrySelector(null);
    };

    const handleInputChange = (field: keyof DailyEntry, value: string) => {
        if (!currentEntry || !canEditCurrentEntry) return;
        setCurrentEntry(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const validateEntry = () => {
        if (!currentEntry) return false;
        const validationMessage = getEntryValidationMessage(currentEntry);
        if (validationMessage) {
            showAlert('error', validationMessage);
            return false;
        }
        return true;
    };

    const updateCurrentEntryInMonth = (entry: DailyEntry) => {
        setMonthlyEntries(prev => {
            const next = new Map(prev);
            const entriesForDate = [...(next.get(entry.date) || [])];
            const entryId = getEntryId(entry);
            const existingIndex = entriesForDate.findIndex(item => getEntryId(item) === entryId);
            if (existingIndex >= 0) entriesForDate[existingIndex] = entry;
            else entriesForDate.push(entry);
            next.set(entry.date, entriesForDate);
            return next;
        });
    };

    const handleSaveEntry = async () => {
        if (!currentEntry) {
            showAlert('error', 'Please select a date');
            return;
        }
        if (!canSaveCurrentEntry) {
            showAlert('error', 'You are not authorized to save this entry');
            return;
        }
        if (!validateEntry()) return;
        try {
            setIsLoading(true);
            const payload = {
                ...currentEntry,
                date: normalizeDate(currentEntry.date),
                testingDate: normalizeDate(currentEntry.testingDate || currentEntry.date),
            };
            const response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save entry');
            }
            const result = await response.json();
            const saved = normalizeEntry(result.data.entry as DailyEntry);
            setCurrentEntry(saved);
            setIsEditing(true);
            updateCurrentEntryInMonth(saved);
            const permissions = getEntryPermissions(saved);
            setCurrentAccessMode(permissions.canEdit ? 'edit' : 'view');
            setReadOnlyReason(permissions.canEdit ? '' : getReadOnlyReason(saved));
            await refreshWorkflowViews();
            showAlert('success', result.message || 'Entry saved successfully');
        } catch (error) {
            console.error('Error saving Robustness entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitEntry = async () => {
        if (!currentEntry || !canSubmitCurrentEntry) {
            showAlert('error', 'You are not authorized to submit this entry');
            return;
        }
        if (!validateEntry()) return;
        try {
            setIsLoading(true);
            let entryToSubmit = currentEntry;
            let entryId = getEntryId(entryToSubmit);
            if (!entryId) {
                const saveResponse = await fetch(`${API_BASE_URL}/entries`, {
                    method: 'POST',
                    headers: authHeaders(true),
                    body: JSON.stringify(entryToSubmit),
                });
                if (!saveResponse.ok) {
                    const errorData = await saveResponse.json();
                    throw new Error(errorData.detail || 'Failed to save entry before submission');
                }
                const saveResult = await saveResponse.json();
                entryToSubmit = normalizeEntry(saveResult.data.entry as DailyEntry);
                entryId = getEntryId(entryToSubmit);
            }
            if (!entryId) throw new Error('Unable to submit entry without a saved draft ID');
            const submitResponse = await fetch(`${API_BASE_URL}/entries/${entryId}/submit`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(entryToSubmit),
            });
            if (!submitResponse.ok) {
                const errorData = await submitResponse.json();
                throw new Error(errorData.detail || OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
            }
            const submitted = normalizeEntry(await submitResponse.json());
            setCurrentEntry(submitted);
            setCurrentAccessMode('view');
            setReadOnlyReason(getReadOnlyReason(submitted));
            setIsEditing(true);
            updateCurrentEntryInMonth(submitted);
            await refreshWorkflowViews();
            showAlert('success', currentWorkflowState === 'returned' ? 'Entry resubmitted successfully' : 'Entry submitted successfully');
        } catch (error) {
            console.error('Error submitting Robustness entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to submit entry');
        } finally {
            setIsLoading(false);
        }
    };

    const approveEntry = async (entry: DailyEntry | null) => {
        if (!entry || !getEntryPermissions(entry).canApprove) {
            showAlert('error', 'You are not authorized to approve this entry');
            return;
        }
        const entryId = getEntryId(entry);
        if (!entryId) return;
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/entries/${entryId}/approve`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to approve entry');
            }
            const approved = normalizeEntry(await response.json());
            if (getEntryId(currentEntry) === entryId) {
                setCurrentEntry(approved);
                setCurrentAccessMode('view');
                setReadOnlyReason(getReadOnlyReason(approved));
            }
            updateCurrentEntryInMonth(approved);
            await refreshWorkflowViews();
            showAlert('success', 'Entry approved');
        } catch (error) {
            console.error('Error approving Robustness entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to approve entry');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmApproveEntry = (entry: DailyEntry | null) => {
        if (!entry || !getEntryPermissions(entry).canApprove) {
            showAlert('error', 'You are not authorized to approve this entry');
            return;
        }
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            noun: 'entry',
            onConfirm: () => approveEntry(entry),
        }));
    };

    const openReturnModal = (entry: DailyEntry) => {
        setReturnModalEntry(entry);
        setReturnComment('');
        setReturnCommentError('');
    };

    const closeReturnModal = () => {
        setReturnModalEntry(null);
        setReturnComment('');
        setReturnCommentError('');
    };

    const submitReturnForCorrection = async () => {
        if (!returnModalEntry) return;
        const comment = returnComment.trim();
        if (!comment) {
            setReturnCommentError('Return comments are required');
            return;
        }
        if (!getEntryPermissions(returnModalEntry).canReturn) {
            showAlert('error', 'You are not authorized to return this entry');
            return;
        }
        const entryId = getEntryId(returnModalEntry);
        if (!entryId) return;
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/entries/${entryId}/return`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ returnComments: comment }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to return entry');
            }
            const returned = normalizeEntry(await response.json());
            if (getEntryId(currentEntry) === entryId) {
                setCurrentEntry(returned);
                setCurrentAccessMode('view');
                setReadOnlyReason(getReadOnlyReason(returned));
            }
            updateCurrentEntryInMonth(returned);
            closeReturnModal();
            await refreshWorkflowViews();
            showAlert('success', 'Entry returned for correction');
        } catch (error) {
            console.error('Error returning Robustness entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to return entry');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteRegisterEntry = async (entry: DailyEntry) => {
        const entryId = getEntryId(entry);
        if (!entryId || !getEntryPermissions(entry).canDelete) {
            showAlert('error', 'You are not authorized to delete this entry');
            return;
        }
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/entries/by-id/${entryId}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete entry');
            }
            if (getEntryId(currentEntry) === entryId) resetSelection();
            await refreshWorkflowViews();
            clearEntrySelection();
            showAlert('info', 'Entry deleted successfully');
        } catch (error) {
            console.error('Error deleting Robustness entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to delete entry');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDeleteRegisterEntry = (entry: DailyEntry) => {
        if (!getEntryPermissions(entry).canDelete) {
            showAlert('error', 'You are not authorized to delete this entry');
            return;
        }
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'entry',
            onConfirm: () => deleteRegisterEntry(entry),
        }));
    };

    const handleDeleteEntry = () => {
        if (!currentEntry) return;
        confirmDeleteRegisterEntry(currentEntry);
    };

    const buildExportFormData = (entries: DailyEntry[]) => {
        const formData: Record<string, string> = {};
        entries.forEach(entry => {
            const signatures = entry.signatures || defaultSignature;
            if (!formData.preparedBySignature && signatures.preparedBy) formData.preparedBySignature = signatures.preparedBy;
            if (!formData.reviewedBySignature && signatures.reviewedBy) formData.reviewedBySignature = signatures.reviewedBy;
            if (!formData.approvedBySignature && signatures.approvedBy) formData.approvedBySignature = signatures.approvedBy;
        });
        return formData;
    };

    const downloadEntriesExcel = async (entries: DailyEntry[], fileBaseName: string) => {
        const exportableEntries = entries.filter(entry => getEntryPermissions(entry).canExport);
        if (exportableEntries.length === 0) {
            throw new Error('No submitted or approved entries are available for Excel export');
        }
        const response = await fetch(`${API_BASE_URL}/export/excel`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({
                entries: exportableEntries,
                form_data: buildExportFormData(exportableEntries),
                report_name: fileBaseName,
                name: fileBaseName,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate Excel report');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${fileBaseName}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(anchor);
    };

    const exportMonthlyExcelFor = async (year: number, month: number) => {
        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');
            const response = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`, {
                headers: authHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch monthly entries');
            const json = await response.json();
            const entries = (Array.isArray(json?.data) ? json.data : [])
                .map((entry: DailyEntry) => normalizeEntry(entry))
                .filter((entry: DailyEntry) => FINALIZED_WORKFLOW_STATES.has(getWorkflowState(entry)));
            const fileName = `Robustness_of_Termination_Test_${months[month - 1].substring(0, 3)}_${year}`;
            await downloadEntriesExcel(entries, fileName);
            showAlert('success', 'Excel report generated successfully');
        } catch (error) {
            console.error('Error generating Robustness Excel:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to generate Excel report');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDownloadEntries = (entries: DailyEntry[], fileBaseName: string) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'entry',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    await downloadEntriesExcel(entries, fileBaseName);
                    showAlert('success', 'Excel report generated successfully');
                } catch (error) {
                    console.error('Error downloading Robustness entries:', error);
                    showAlert('error', error instanceof Error ? error.message : 'Failed to generate Excel report');
                } finally {
                    setIsLoading(false);
                }
            },
        }));
    };

    const confirmExportMonthlyExcel = (year: number, month: number) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'entry',
            onConfirm: () => exportMonthlyExcelFor(year, month),
        }));
    };

    const setEntrySelection = (entry: DailyEntry, selected: boolean) => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        setSelectedEntryIds(prev => {
            const next = new Set(prev);
            if (selected) next.add(entryId);
            else next.delete(entryId);
            return next;
        });
        setSelectedEntryRecords(prev => {
            const next = { ...prev };
            if (selected) next[entryId] = entry;
            else delete next[entryId];
            return next;
        });
    };

    const setVisibleEntrySelection = (visibleEntries: DailyEntry[], selected: boolean) => {
        visibleEntries.forEach(entry => setEntrySelection(entry, selected));
    };

    const toggleEntrySelection = (
        entry: DailyEntry,
        visibleEntries: DailyEntry[],
        selected: boolean,
        shiftKey: boolean
    ) => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        if (shiftKey && lastSelectedEntryIdRef.current) {
            const visibleIds = visibleEntries.map(getEntryId);
            const lastIndex = visibleIds.indexOf(lastSelectedEntryIdRef.current);
            const currentIndex = visibleIds.indexOf(entryId);
            if (lastIndex >= 0 && currentIndex >= 0) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                setVisibleEntrySelection(visibleEntries.slice(start, end + 1), selected);
                lastSelectedEntryIdRef.current = entryId;
                return;
            }
        }
        setEntrySelection(entry, selected);
        lastSelectedEntryIdRef.current = entryId;
    };

    const getSelectedEntries = () =>
        Object.values(selectedEntryRecords).filter(entry => selectedEntryIds.has(getEntryId(entry)));

    const getBulkFailureCount = (result: BulkOperationResult) =>
        result.failedCount ?? result.failed?.length ?? 0;

    const formatBulkOperationSummary = (
        title: string,
        successLabel: string,
        successCount: number,
        result: BulkOperationResult,
        eligibilityNote?: string
    ) => {
        const lines = [title, `${successCount} ${successLabel}`];
        const skippedCount = result.skippedCount ?? sumObjectValues(result.skipped || {});
        if (eligibilityNote && skippedCount > 0) {
            lines.push(`${eligibilityNote} ${skippedCount} selected ${skippedCount === 1 ? 'entry was' : 'entries were'} skipped.`);
        }
        Object.entries(result.skipped || {}).forEach(([reason, count]) => {
            lines.push(reason === 'Already Approved' ? `${count} ${reason}` : `${count} ${reason} Skipped`);
        });
        const failedCount = getBulkFailureCount(result);
        if (failedCount > 0) lines.push(`${failedCount} Failed. See console for details.`);
        return lines.join(' | ');
    };

    const runBulkApproveEntries = async () => {
        const entryIds = getSelectedEntries().map(getEntryId).filter(Boolean);
        if (entryIds.length === 0) return;
        try {
            setBulkOperationStatus({ action: 'Approving...', completed: 0, total: entryIds.length });
            const response = await fetch(`${API_BASE_URL}/bulk/approve`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ entryIds }),
            });
            if (!response.ok) throw new Error('Bulk approval failed');
            const result: BulkOperationResult = await response.json();
            setBulkOperationStatus({ action: 'Approving...', completed: entryIds.length, total: entryIds.length });
            if (getBulkFailureCount(result) > 0) console.warn('Bulk approval failures', result.failed);
            await refreshWorkflowViews();
            clearEntrySelection();
            const approved = result.approved ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Approval Completed', 'Approved', approved, result, 'Only Submitted entries can be approved.')
            );
        } catch (error) {
            console.error('Error bulk approving Robustness entries:', error);
            showAlert('error', 'Bulk approval failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDeleteEntries = async () => {
        const entryIds = getSelectedEntries().filter(entry => getEntryPermissions(entry).canDelete).map(getEntryId).filter(Boolean);
        if (entryIds.length === 0) return;
        try {
            setBulkOperationStatus({ action: 'Deleting...', completed: 0, total: entryIds.length });
            const response = await fetch(`${API_BASE_URL}/bulk/delete`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ entryIds }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Bulk delete failed');
            }
            const result: BulkOperationResult = await response.json();
            setBulkOperationStatus({ action: 'Deleting...', completed: entryIds.length, total: entryIds.length });
            if (getBulkFailureCount(result) > 0) console.warn('Bulk delete failures', result.failed);
            await refreshWorkflowViews();
            clearEntrySelection();
            const deleted = result.deleted ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Delete Completed', 'Deleted', deleted, result)
            );
        } catch (error) {
            console.error('Error bulk deleting Robustness entries:', error);
            showAlert('error', error instanceof Error ? error.message : 'Bulk delete failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDownloadEntries = async () => {
        const selectedEntries = getSelectedEntries();
        const result: BulkOperationResult = { requested: selectedEntries.length, downloaded: 0, skipped: {}, failed: [] };
        const exportableEntries = selectedEntries.filter(entry => {
            if (getEntryPermissions(entry).canExport) return true;
            const reason = formatWorkflowState(getWorkflowState(entry));
            result.skipped![reason] = (result.skipped![reason] || 0) + 1;
            return false;
        });
        if (exportableEntries.length === 0) {
            showAlert('error', 'No submitted or approved entries are selected for download.');
            return;
        }
        try {
            setBulkOperationStatus({ action: 'Generating Excel...', completed: 0, total: 1 });
            await downloadEntriesExcel(exportableEntries, `Robustness_of_Termination_Test_Selected_${getTodayDate()}`);
            result.downloaded = 1;
            result.skippedCount = sumObjectValues(result.skipped || {});
            setBulkOperationStatus({ action: 'Generating Excel...', completed: 1, total: 1 });
            await refreshWorkflowViews();
            clearEntrySelection();
            showAlert('success', formatBulkOperationSummary('Bulk Download Completed', 'Downloaded', result.downloaded, result));
        } catch (error) {
            console.error('Error bulk downloading Robustness entries:', error);
            showAlert('error', error instanceof Error ? error.message : 'Bulk download failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const confirmBulkApproveEntries = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            count: selectedEntryIds.size,
            noun: 'entry',
            onConfirm: runBulkApproveEntries,
        }));
    };

    const confirmBulkDeleteEntries = () => {
        const selectedCount = getSelectedEntries().filter(entry => getEntryPermissions(entry).canDelete).length;
        if (selectedCount === 0) return;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            count: selectedCount,
            noun: 'entry',
            onConfirm: runBulkDeleteEntries,
        }));
    };

    const confirmBulkDownloadEntries = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            count: selectedEntryIds.size,
            noun: 'entry',
            onConfirm: runBulkDownloadEntries,
        }));
    };

    const renderDashboardCards = () => {
        const summary = dashboardData?.summary || {
            totalEntries: 0,
            draft: 0,
            submitted: 0,
            returned: 0,
            approved: 0,
        };
        return (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    [dashboardView === 'daily' ? "Today's Entries" : 'Total Entries', summary.totalEntries],
                    ['Draft', summary.draft],
                    ['Submitted', summary.submitted],
                    ['Returned', summary.returned],
                    ['Approved', summary.approved],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderDashboardControls = () => (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                    {(['daily', 'weekly', 'monthly'] as DashboardPeriod[]).map(period => (
                        <button
                            key={period}
                            type="button"
                            onClick={() => setDashboardView(period)}
                            className={`h-9 rounded px-4 text-sm font-semibold capitalize transition-colors ${dashboardView === period
                                    ? 'bg-brand-primary text-white'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                }`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={loadDashboard}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                    <RotateCcw className="h-4 w-4" />
                    Refresh
                </button>
            </div>
            {renderDashboardCards()}
        </div>
    );

    const renderDashboardTable = () => (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            {isDashboardLoading ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</div>
            ) : (
                <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                            <th className="px-3 py-2 font-semibold">Day</th>
                            <th className="px-3 py-2 font-semibold">Total Entries</th>
                            <th className="px-3 py-2 font-semibold">Draft</th>
                            <th className="px-3 py-2 font-semibold">Submitted</th>
                            <th className="px-3 py-2 font-semibold">Approved</th>
                            <th className="px-3 py-2 font-semibold">Returned</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {(dashboardData?.groups || []).map(group => (
                            <tr key={group.key} className="text-gray-800 dark:text-gray-100">
                                <td className="px-3 py-2 font-medium">
                                    <div>{group.dayName || group.key}</div>
                                    <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{group.displayDate || group.date}</div>
                                </td>
                                <td className="px-3 py-2">{group.totalEntries}</td>
                                <td className="px-3 py-2">{group.draft}</td>
                                <td className="px-3 py-2">{group.submitted}</td>
                                <td className="px-3 py-2">{group.approved}</td>
                                <td className="px-3 py-2">{group.returned}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );

    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = getTodayDate();
        const days = [];
        for (let index = 0; index < firstDay; index += 1) {
            days.push(<div key={`empty-${index}`} className="p-2" />);
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entries = monthlyEntries.get(dateStr) || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const statusClass = entries.length > 0 ? getDateStatusClass(entries) : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
            days.push(
                <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDateSelect(dateStr)}
                    className={`relative rounded-lg border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-brand-primary ring-2 ring-brand-primary' : statusClass
                        } ${isToday ? 'font-bold' : ''}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm dark:text-white">{day}</span>
                        {entries.some(entry => getWorkflowState(entry) === 'approved') && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        {entries.some(entry => getWorkflowState(entry) === 'returned') && <AlertCircle className="h-4 w-4 text-amber-500" />}
                    </div>
                    {entries.length > 0 && (
                        <div className="mt-1 truncate text-xs font-medium dark:text-white">
                            {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
                        </div>
                    )}
                </button>
            );
        }
        return days;
    };

    const renderSignatureSection = () => {
        const signatures = currentEntry?.signatures || defaultSignature;
        return (
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 dark:border-gray-700 md:grid-cols-3">
                {[
                    ['PREPARED BY', signatures.preparedBy],
                    ['REVIEWED BY', signatures.reviewedBy],
                    ['APPROVED BY', signatures.approvedBy],
                ].map(([label, value]) => (
                    <div key={label} className="text-center">
                        <p className="mb-2 text-xs font-bold text-gray-800 dark:text-white">{label}:</p>
                        <div className="flex min-h-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800">
                            <span className="text-sm font-semibold text-gray-800 dark:text-white">{value || '-'}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderEntryForm = () => {
        if (!currentEntry) return null;
        return (
            <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold dark:text-white">
                                {canEditCurrentEntry ? (isEditing ? 'Edit Entry' : 'New Entry') : 'View Entry'} - {formatDateLabel(currentEntry.testingDate)}
                            </h3>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(currentWorkflowState)}`}>
                                {formatWorkflowState(currentWorkflowState)}
                            </span>
                        </div>
                        {readOnlyReason && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{readOnlyReason}</p>}
                        {currentEntry.returnComments && currentWorkflowState === 'returned' && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Return comments: {currentEntry.returnComments}</p>
                        )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        {canExportCurrentEntry && (
                            <button type="button" onClick={() => confirmDownloadEntries([currentEntry], `Robustness_of_Termination_Test_${currentEntry.date}`)} className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20" title="Download Excel">
                                <Download className="h-4 w-4" />
                            </button>
                        )}
                        {canApproveCurrentEntry && (
                            <button type="button" onClick={() => confirmApproveEntry(currentEntry)} className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20" title="Approve">
                                <Check className="h-4 w-4" />
                            </button>
                        )}
                        {canReturnCurrentEntry && (
                            <button type="button" onClick={() => openReturnModal(currentEntry)} className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20" title="Return">
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        )}
                        {canDeleteCurrentEntry && (
                            <button type="button" onClick={handleDeleteEntry} className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        {!canDeleteCurrentEntry && currentWorkflowState === 'approved' && (
                            <button type="button" disabled className="rounded-lg p-2 text-gray-400 opacity-60 dark:text-gray-500" title={APPROVED_DELETE_TOOLTIP}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        <button type="button" onClick={resetSelection} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" title="Close">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">P.O. Number</label>
                        <input type="text" value={currentEntry.po} onChange={(event) => handleInputChange('po', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="Enter PO number" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Module Type</label>
                        <input type="text" value={currentEntry.moduleType} onChange={(event) => handleInputChange('moduleType', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="Enter module type" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Module Serial No.</label>
                        <input type="text" value={currentEntry.moduleSerial} onChange={(event) => handleInputChange('moduleSerial', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="Enter serial number" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">JB Supplier</label>
                        <select value={currentEntry.jbSupplier} onChange={(event) => handleInputChange('jbSupplier', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            <option value="">Select</option>
                            <option value="Suzhou UKT New Energy Technology Co. Ltd">Suzhou UKT New Energy Technology Co. Ltd</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Sealant Supplier</label>
                        <select value={currentEntry.sealantSupplier} onChange={(event) => handleInputChange('sealantSupplier', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            <option value="">Select</option>
                            <option value="Huitan">Huitan</option>
                            <option value="Tonsan (HB fuller)">Tonsan (HB fuller)</option>
                            <option value="Adarsha Speciality">Adarsha Speciality</option>
                            <option value="Fasto">Fasto</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Rear Glass/ Backsheet Supplier</label>
                        <select value={currentEntry.backsheetSupplier} onChange={(event) => handleInputChange('backsheetSupplier', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
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
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Result</label>
                        <select value={currentEntry.result} onChange={(event) => handleInputChange('result', event.target.value as 'Pass' | 'Fail' | '')} disabled={!canEditCurrentEntry} className={`w-full rounded-lg border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 ${getResultSelectClass(currentEntry.result)}`}>
                            <option value="">Select result</option>
                            <option value="Pass" className="bg-green-100 text-green-700">Pass</option>
                            <option value="Fail" className="bg-red-100 text-red-700">Fail</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Test Done By</label>
                        <input type="text" value={currentEntry.testDoneBy} onChange={(event) => handleInputChange('testDoneBy', event.target.value)} disabled={!canEditCurrentEntry} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="Enter tester name" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Remarks</label>
                        <textarea value={currentEntry.remarks || ''} onChange={(event) => handleInputChange('remarks', event.target.value)} disabled={!canEditCurrentEntry} rows={2} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="Add any remarks" />
                    </div>
                </div>

                {renderSignatureSection()}

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <button type="button" onClick={resetSelection} className="rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                        Cancel
                    </button>
                    {canSaveCurrentEntry && (
                        <button type="button" onClick={handleSaveEntry} className="flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-2 text-white transition-colors hover:bg-brand-primary-hover">
                            <Save className="h-4 w-4" />
                            {currentWorkflowState === 'submitted' ? 'Save Changes' : 'Save Draft'}
                        </button>
                    )}
                    {canSubmitCurrentEntry && (
                        <button type="button" onClick={handleSubmitEntry} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-white transition-colors hover:bg-emerald-700">
                            <Check className="h-4 w-4" />
                            {currentWorkflowState === 'returned' ? 'Resubmit' : 'Submit'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderEntrySelector = () => {
        if (!dateEntrySelector) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{formatDateLabel(dateEntrySelector.date)}</h3>
                        <button type="button" onClick={() => setDateEntrySelector(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {dateEntrySelector.entries.map((entry, index) => {
                            const state = getWorkflowState(entry);
                            return (
                                <button
                                    key={getEntryId(entry) || `${entry.date}-${index}`}
                                    type="button"
                                    onClick={() => openEntryFromRegister(entry, 'edit')}
                                    className="flex w-full items-center justify-between rounded-md border border-gray-200 p-3 text-left hover:border-brand-primary hover:bg-brand-primary/5 dark:border-gray-700 dark:hover:bg-brand-primary/10"
                                >
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Entry {index + 1}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{entry.po || 'No production order'} | {resolveCreatorName(entry)}</div>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(state)}`}>
                                        {formatWorkflowState(state)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {canCreateEntry && (
                        <button
                            type="button"
                            onClick={() => openNewEntryForDate(dateEntrySelector.date)}
                            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand-primary px-3 text-sm font-semibold text-white hover:bg-brand-primary-hover"
                        >
                            <Plus className="h-4 w-4" />
                            New Entry
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderEntryRegister = () => {
        const updateFilters = (patch: Partial<EntryListFilters>) => {
            setEntryRegisterFilters(prev => ({ ...prev, ...patch }));
            setEntryRegisterPage(1);
            clearEntrySelection();
        };
        const resetFilters = () => {
            setEntryRegisterFilters({ dateFrom: '', dateTo: '', status: '' });
            setEntryRegisterSearchInput('');
            setEntryRegisterSearch('');
            setEntryRegisterPage(1);
            clearEntrySelection();
        };
        const visibleSelectableEntries = entryRegister.filter(entry => Boolean(getEntryId(entry)));
        const visibleSelectedCount = visibleSelectableEntries.filter(entry => selectedEntryIds.has(getEntryId(entry))).length;
        const allVisibleSelected = visibleSelectableEntries.length > 0 && visibleSelectedCount === visibleSelectableEntries.length;
        const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleSelectableEntries.length;
        const selectedEntriesForBulk = getSelectedEntries();
        const canBulkApprove = selectedEntriesForBulk.some(entry => getEntryPermissions(entry).canApprove);
        const canBulkDelete = selectedEntriesForBulk.some(entry => getEntryPermissions(entry).canDelete);
        const canBulkDownload = selectedEntriesForBulk.some(entry => getEntryPermissions(entry).canExport);

        return (
            <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Entry Register</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{entryRegisterTotal} entries</span>
                </div>
                <div className="mb-2 grid gap-2 md:grid-cols-4 xl:grid-cols-6">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input value={entryRegisterSearchInput} onChange={(event) => setEntryRegisterSearchInput(event.target.value)} placeholder="Search production order, creator, date, status" className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <input type="date" value={entryRegisterFilters.dateFrom} onChange={(event) => updateFilters({ dateFrom: event.target.value, dateTo: event.target.value })} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" title="Date from" />
                    <input type="date" value={entryRegisterFilters.dateTo} onChange={(event) => updateFilters({ dateTo: event.target.value })} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" title="Date to" />
                    <select value={entryRegisterFilters.status} onChange={(event) => updateFilters({ status: event.target.value as EntryListFilters['status'] })} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" aria-label="Status filter">
                        <option value="">Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="returned">Returned</option>
                        <option value="approved">Approved</option>
                    </select>
                    <select value={entryRegisterSort} onChange={(event) => { setEntryRegisterSort(event.target.value as EntrySortOption); setEntryRegisterPage(1); }} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" aria-label="Sort entries">
                        <option value="date-newest">Newest Date</option>
                        <option value="date-oldest">Oldest Date</option>
                        <option value="newest-updated">Recently Updated</option>
                        <option value="oldest-updated">Least Recently Updated</option>
                        <option value="status">Status</option>
                        <option value="created-by">Created By</option>
                    </select>
                    <button type="button" onClick={resetFilters} className="h-9 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                        Clear Filters
                    </button>
                </div>

                {selectedEntryIds.size > 0 && (
                    <div className="mb-3 rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3 dark:border-brand-primary/40 dark:bg-brand-primary/10">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {selectedEntryIds.size} {selectedEntryIds.size === 1 ? 'entry' : 'entries'} selected
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canBulkApprove && <button type="button" onClick={confirmBulkApproveEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"><Check className="h-3.5 w-3.5" />Approve</button>}
                                {canBulkDownload && <button type="button" onClick={confirmBulkDownloadEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-3 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-900/20"><Download className="h-3.5 w-3.5" />Download</button>}
                                {canBulkDelete && <button type="button" onClick={confirmBulkDeleteEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" />Delete</button>}
                                <button type="button" onClick={clearEntrySelection} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><X className="h-3.5 w-3.5" />Clear Selection</button>
                            </div>
                        </div>
                        {bulkOperationStatus && (
                            <div className="mt-3 flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-200">
                                <span>{bulkOperationStatus.action}</span>
                                <span>{bulkOperationStatus.completed} / {bulkOperationStatus.total} completed</span>
                            </div>
                        )}
                    </div>
                )}

                {isEntryRegisterLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading entries...</div>
                ) : entryRegister.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{entryRegisterTotal === 0 ? 'No entries found.' : 'No matching entries found.'}</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-0 text-center text-xs">
                                <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                    <tr>
                                        <th className="w-10 border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                            <input type="checkbox" aria-label="Select all visible entries" checked={allVisibleSelected} disabled={visibleSelectableEntries.length === 0} ref={(element) => { if (element) element.indeterminate = someVisibleSelected; }} onChange={(event) => setVisibleEntrySelection(visibleSelectableEntries, event.currentTarget.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                                        </th>
                                        {['Date', 'Production Order', 'Created By', 'Status', 'Actions'].map(column => (
                                            <th key={column} className="border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">{column}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {entryRegister.map((entry, index) => {
                                        const entryId = getEntryId(entry);
                                        const state = getWorkflowState(entry);
                                        const permissions = getEntryPermissions(entry);
                                        const isSelected = entryId ? selectedEntryIds.has(entryId) : false;
                                        return (
                                            <tr key={entryId || `${entry.date}-${index}`} className={`${isSelected ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-white dark:bg-gray-900'} text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/70`}>
                                                <td className="whitespace-nowrap px-3 py-2 text-center">
                                                    <input type="checkbox" aria-label={`Select entry ${entry.date}`} checked={isSelected} disabled={!entryId} onChange={(event) => toggleEntrySelection(entry, visibleSelectableEntries, event.currentTarget.checked, event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{entry.date || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left font-medium">{entry.po || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{resolveCreatorName(entry)}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(state)}`}>{formatWorkflowState(state)}</span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <button type="button" onClick={() => openEntryFromRegister(entry, 'view')} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" title="View"><Eye className="h-3.5 w-3.5" /></button>
                                                        {permissions.canEdit && <button type="button" onClick={() => openEntryFromRegister(entry, 'edit')} className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>}
                                                        {permissions.canExport && <button type="button" onClick={() => confirmDownloadEntries([entry], `Robustness_of_Termination_Test_${entry.date}`)} className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20" title="Download Excel"><Download className="h-3.5 w-3.5" /></button>}
                                                        {permissions.canApprove && <button type="button" onClick={() => confirmApproveEntry(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20" title="Approve"><Check className="h-3.5 w-3.5" /></button>}
                                                        {permissions.canReturn && <button type="button" onClick={() => openReturnModal(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-600 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20" title="Return"><RotateCcw className="h-3.5 w-3.5" /></button>}
                                                        {permissions.canDelete && <button type="button" onClick={() => confirmDeleteRegisterEntry(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4">
                            <ReportPagination totalItems={entryRegisterTotal} page={entryRegisterPage} pageSize={entryRegisterPageSize} itemLabel="entries" onPageChange={setEntryRegisterPage} onPageSizeChange={(nextPageSize) => { setEntryRegisterPageSize(nextPageSize); setEntryRegisterPage(1); }} />
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto">
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-brand-primary" />
                        <p className="mt-3 text-gray-700 dark:text-gray-300">Loading...</p>
                    </div>
                </div>
            )}
            {renderEntrySelector()}
            {returnModalEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Return Entry</h3>
                            <button type="button" onClick={closeReturnModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
                        </div>
                        <textarea value={returnComment} onChange={(event) => { setReturnComment(event.target.value); setReturnCommentError(''); }} rows={4} className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" placeholder="Enter return comments" />
                        {returnCommentError && <p className="mt-2 text-xs text-red-600">{returnCommentError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={closeReturnModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
                            <button type="button" onClick={submitReturnForCorrection} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">Return</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Robustness of Termination Test</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get a weight of 5 kgs (40 N) in case of IEC and 15 kgs (156 N) in case of UL for all types of module. Tie the cables of the JB with the weight and hang it for 1 minute in 5 different directions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('dashboard')}
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${activeTab === 'dashboard'
                                ? 'bg-brand-primary text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Dashboard
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('entry-register')}
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${activeTab === 'entry-register'
                                ? 'bg-brand-primary text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                    >
                        <Search className="h-4 w-4" />
                        Entry Register
                    </button>
                </div>
            </div>

            {activeTab === 'dashboard' && (
                <div className="mb-4 space-y-4">
                    {renderDashboardControls()}
                    {dashboardView !== 'daily' && renderDashboardTable()}
                </div>
            )}

            {activeTab === 'entry-register' && renderEntryRegister()}

            {activeTab === 'dashboard' && dashboardView === 'daily' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-6 lg:col-span-7">
                        <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
                            <div className="mb-6 flex flex-col items-center justify-between gap-4 xl:flex-row">
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={handlePrevMonth} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="h-5 w-5 dark:text-white" /></button>
                                    <div className="flex gap-2">
                                        <select value={currentDate.getMonth()} onChange={(event) => handleMonthChange(Number(event.target.value))} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                            {months.map((month, index) => <option key={month} value={index}>{month}</option>)}
                                        </select>
                                        <select value={currentDate.getFullYear()} onChange={(event) => handleYearChange(Number(event.target.value))} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                            {years.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                    </div>
                                    <button type="button" onClick={handleNextMonth} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="h-5 w-5 dark:text-white" /></button>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleTodayEntry} className="rounded-lg bg-brand-primary-soft px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary-muted dark:bg-brand-primary/10 dark:text-brand-primary-light">
                                        Today
                                    </button>
                                    {canCreateEntry && (
                                        <button type="button" onClick={() => openNewEntryForDate(selectedDate || getTodayDate())} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-hover">
                                            <Plus className="h-4 w-4" />
                                            New Entry
                                        </button>
                                    )}
                                    {(isOperatorRole || isReviewerLikeRole) && (
                                        <button type="button" onClick={() => confirmExportMonthlyExcel(currentDate.getFullYear(), currentDate.getMonth() + 1)} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700" title="Download Monthly Excel">
                                            <Download className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mb-2 grid grid-cols-7 gap-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{day}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-2">{renderCalendarDays()}</div>
                        </div>
                    </div>
                    <div className="space-y-6 lg:col-span-5">
                        {renderEntryForm() || (
                            <div className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-lg dark:bg-gray-900 dark:text-gray-400">
                                Select a date to open or create an entry.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RoTTest() {
    return <EnterpriseRoTTest />;
}

export function LegacyRoTTest() {
    const [, setHasUnsavedChanges] = useState(false);
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

            const entriesUrl = `${ROT_API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const entriesResponse = await fetch(entriesUrl);
            const entriesJson = await entriesResponse.json();

            let entriesArr: DailyEntry[] = [];
            if (entriesJson.data && Array.isArray(entriesJson.data)) {
                entriesArr = entriesJson.data;
            } else if (Array.isArray(entriesJson)) {
                entriesArr = entriesJson;
            }


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
            setCurrentEntry(entry);
            setIsEditing(true);
        } else {
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
