import { type ClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    BarChart3,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleOff,
    Clock,
    Download,
    Edit3,
    Eye,
    FileSpreadsheet,
    Moon,
    RotateCcw,
    Save,
    Search,
    Sun,
    Sunset,
    Trash2,
    X,
} from 'lucide-react';
import ReportPagination from '../components/ReportPagination';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import {
    buildWorkflowConfirmOptions,
    isResolvedCreator,
    OPERATOR_SIGNATURE_REQUIRED_MESSAGE,
    resolveCreatorName,
} from '../utilities/workflowUtils';

type Shift = 'A' | 'B' | 'C';
type FabOption = 'FAB-II Line-I' | 'FAB-II Line-II';
type LineLabel = 'Line - 1' | 'Line - 2' | 'Line - 3' | 'Line - 4';
type ReadingField = 'plusVe1' | 'plusVe2' | 'middle1' | 'middle2' | 'minusVe1' | 'minusVe2';
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
    | 'shift'
    | 'line'
    | 'date-newest'
    | 'date-oldest';

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
    id?: string;
    date: string;
    testingDate: string;
    shift: Shift;
    fab: FabOption;
    lines: Partial<Record<LineLabel, LineData>>;
    signatures?: Signatures;
    status?: WorkflowState;
    workflowState?: WorkflowState;
    displayStatus?: WorkflowState;
    productionOrder?: string;
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
    permissions?: {
        canView?: boolean;
        canEdit?: boolean;
        canSubmit?: boolean;
        canApprove?: boolean;
        canReturn?: boolean;
        canDelete?: boolean;
        canExport?: boolean;
    };
    [key: string]: any;
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

interface EntryListFilters {
    dateFrom: string;
    dateTo: string;
    shift: string;
    line: string;
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

const FAB_OPTIONS: FabOption[] = ['FAB-II Line-I', 'FAB-II Line-II'];
const SHIFT_OPTIONS: Shift[] = ['A', 'B', 'C'];
const FAB_LINE_MAP: Record<FabOption, LineLabel[]> = {
    'FAB-II Line-I': ['Line - 1', 'Line - 2'],
    'FAB-II Line-II': ['Line - 3', 'Line - 4'],
};
const DEFAULT_FAB: FabOption = 'FAB-II Line-I';
const JB_STATUS_OPTIONS = ['UKTR', 'ZJRH', 'Dhash'];
const STATUS_OPTIONS = ['Juren', 'Sunby', 'YourBest'];
const MIN_AVERAGE_N = 25;
const FINALIZED_WORKFLOW_STATES = new Set<WorkflowState>(['submitted', 'approved']);
const EDITABLE_OPERATOR_WORKFLOW_STATES = new Set<WorkflowState>(['draft', 'returned']);
const APPROVED_DELETE_TOOLTIP = 'Approved reports are permanently retained and cannot be deleted.';
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
const getWorkflowState = (entry?: Pick<DailyEntry, 'workflowState' | 'status'> | null): WorkflowState =>
    entry?.workflowState || entry?.status || 'submitted';
const formatWorkflowState = (state: WorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);
const sumObjectValues = (values: Record<string, number>) =>
    Object.values(values).reduce((total, count) => total + count, 0);
const getEntryProductionOrder = (entry: DailyEntry) =>
    entry.productionOrder || FAB_LINE_MAP[entry.fab].map(lineLabel => entry.lines?.[lineLabel]?.po).filter(Boolean).join(' / ');
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
    status: 'draft',
    workflowState: 'draft',
    displayStatus: 'draft',
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
        status: getWorkflowState(entry),
        workflowState: getWorkflowState(entry),
        displayStatus: entry.displayStatus || getWorkflowState(entry),
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
    const [currentAccessMode, setCurrentAccessMode] = useState<EntryAccessMode>('edit');
    const [readOnlyReason, setReadOnlyReason] = useState('');
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
        shift: '',
        line: '',
        status: '',
    });
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [selectedEntryRecords, setSelectedEntryRecords] = useState<Record<string, DailyEntry>>({});
    const [bulkOperationStatus, setBulkOperationStatus] = useState<BulkOperationStatus | null>(null);
    const lastSelectedEntryIdRef = useRef<string | null>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/peel-strength-bus-ribbon-jb-soldering-reports`;
    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ], []);
    const years = useMemo(() => Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index), [currentDate]);
    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const isReviewerLikeRole = isReviewerRole || isSystemAdminRole;
    const currentWorkflowState = getWorkflowState(currentEntry);
    const isCurrentEntryOwner = Boolean(currentEntry) && (
        (!currentEntry?._id && isOperatorRole)
        || isResolvedCreator(currentEntry, { employeeId, username })
    );
    const canCreateEntry = isOperatorRole;
    const canEditCurrentEntry = currentAccessMode === 'edit' && Boolean(currentEntry) && (
        (isOperatorRole && (!currentEntry?._id || (isCurrentEntryOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))))
        || (isReviewerLikeRole && Boolean(currentEntry?._id) && currentWorkflowState === 'submitted')
    );
    const canSaveCurrentEntry = canEditCurrentEntry && (
        (isOperatorRole && (!currentEntry?._id || isCurrentEntryOwner) && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))
        || (isReviewerLikeRole && Boolean(currentEntry?._id) && currentWorkflowState === 'submitted')
    );
    const canSubmitCurrentEntry = Boolean(currentEntry) && isOperatorRole
        && (!currentEntry?._id || isCurrentEntryOwner)
        && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState);
    const canApproveCurrentEntry = Boolean(currentEntry?._id) && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canReturnCurrentEntry = Boolean(currentEntry?._id) && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canDeleteCurrentEntry = Boolean(currentEntry?._id) && (
        (isReviewerLikeRole && currentWorkflowState === 'submitted')
        || (isOperatorRole && isCurrentEntryOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))
    );
    const canExportCurrentEntry = Boolean(currentEntry?._id) && FINALIZED_WORKFLOW_STATES.has(currentWorkflowState) && (isOperatorRole || isReviewerLikeRole);
    const authHeaders = useCallback((includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    }), [employeeId, username, userRole]);

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        const storedEmployeeId = sessionStorage.getItem('employeeId');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
        setEmployeeId(storedEmployeeId);
    }, []);

    const getEntryId = (entry?: DailyEntry | null) => entry?._id || entry?.id || '';

    const isEntryOwner = (entry: DailyEntry) =>
        isResolvedCreator(entry, { employeeId, username });

    const getEntryPermissions = (entry: DailyEntry) => {
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
            canDelete: (isReviewerLikeRole && state === 'submitted')
                || (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state)),
        };
    };

    const getReadOnlyReason = (entry: DailyEntry) => {
        const state = getWorkflowState(entry);
        if (state === 'draft') return 'Draft entries are locked to the creating operator until submission.';
        if (state === 'returned') return 'Returned entries are locked to the original operator until resubmission.';
        if (state === 'approved') return 'Approved entries are read-only.';
        return 'This entry is read-only for your role.';
    };

    const getCreatedByLabel = (entry: DailyEntry) => resolveCreatorName(entry);

    const getStateBadgeClass = (state: WorkflowState) => {
        if (state === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
        if (state === 'submitted') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
        if (state === 'returned') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    };

    const getDateStatusClass = (entriesForDate: Array<DailyEntry | undefined>) => {
        const states = entriesForDate.filter(Boolean).map(entry => getWorkflowState(entry));
        if (states.includes('returned')) return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20';
        if (states.includes('submitted')) return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
        if (states.includes('draft')) return 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800';
        if (states.includes('approved')) return 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20';
        return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
    };

    const getStatusDotClass = (state?: WorkflowState) => {
        if (state === 'approved') return 'bg-emerald-500';
        if (state === 'submitted') return 'bg-blue-500';
        if (state === 'returned') return 'bg-amber-500';
        if (state === 'draft') return 'bg-gray-500';
        return 'bg-gray-300 dark:bg-gray-600';
    };

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            const [entriesResponse, statsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`, { headers: authHeaders() }),
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
    }, [API_BASE_URL, authHeaders, showAlert]);

    useEffect(() => {
        loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
    }, [currentDate, loadMonthlyData]);

    const loadDashboard = useCallback(async () => {
        try {
            setIsDashboardLoading(true);
            const response = await fetch(`${API_BASE_URL}/dashboard?view=${dashboardView}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch dashboard: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            setDashboardData(data);
        } catch (error) {
            console.error('Error loading entry dashboard:', error);
            showAlert('error', 'Failed to load dashboard');
        } finally {
            setIsDashboardLoading(false);
        }
    }, [API_BASE_URL, authHeaders, dashboardView, showAlert]);

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
            if (entryRegisterFilters.shift) query.append('shift', entryRegisterFilters.shift);
            if (entryRegisterFilters.line) query.append('line', entryRegisterFilters.line);
            if (entryRegisterFilters.status) query.append('status', entryRegisterFilters.status);

            const response = await fetch(`${API_BASE_URL}/entries/register?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch entry register: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            setEntryRegister(Array.isArray(data.items) ? data.items.map(normalizeEntry) : []);
            setEntryRegisterTotal(data.total || 0);
        } catch (error) {
            console.error('Error loading entry register:', error);
            showAlert('error', 'Failed to load entry register');
        } finally {
            setIsEntryRegisterLoading(false);
        }
    }, [API_BASE_URL, authHeaders, entryRegisterFilters, entryRegisterPage, entryRegisterPageSize, entryRegisterSearch, entryRegisterSort, showAlert]);

    useEffect(() => {
        if (activeTab !== 'dashboard') return;
        loadDashboard();
    }, [activeTab, loadDashboard]);

    useEffect(() => {
        if (activeTab !== 'entry-register') return;
        loadEntryRegister();
    }, [activeTab, loadEntryRegister]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setEntryRegisterSearch(entryRegisterSearchInput);
            setEntryRegisterPage(1);
        }, 350);
        return () => window.clearTimeout(timeout);
    }, [entryRegisterSearchInput]);

    const refreshWorkflowViews = useCallback(async () => {
        await loadMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
        await Promise.all([
            loadDashboard(),
            loadEntryRegister(),
        ]);
    }, [currentDate, loadDashboard, loadEntryRegister, loadMonthlyData]);

    const resetSelection = useCallback(() => {
        setSelectedDate('');
        setSelectedFab(DEFAULT_FAB);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorFab(null);
        setReadingErrors({});
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
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
            const normalized = normalizeEntry(entry);
            const permissions = getEntryPermissions(normalized);
            const accessMode: EntryAccessMode = permissions.canEdit ? 'edit' : 'view';
            setCurrentEntry(normalized);
            setCurrentAccessMode(accessMode);
            setReadOnlyReason(accessMode === 'view' ? getReadOnlyReason(normalized) : '');
            setIsEditing(true);
        } else {
            if (!canCreateEntry) {
                showAlert('info', 'No entry exists for this line and shift.');
                setCurrentEntry(null);
                setSelectedShift(null);
                return;
            }
            setCurrentEntry(createEmptyEntry(selectedDate, fab, shift));
            setCurrentAccessMode('edit');
            setReadOnlyReason('');
            setIsEditing(false);
        }
        setReadingErrors({});
    };

    const updateCurrentEntry = (updater: (entry: DailyEntry) => DailyEntry) => {
        setCurrentEntry(prev => prev ? updater(prev) : prev);
    };

    const handleLineFieldChange = (lineLabel: LineLabel, field: keyof Pick<LineData, 'po' | 'jbStatus' | 'busRibbonStatus' | 'busRibbonDimension'>, value: string) => {
        if (!canEditCurrentEntry) return;
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
        if (!canEditCurrentEntry) return;
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
        if (!canEditCurrentEntry) return;
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
        if (!canEditCurrentEntry) return;
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

    const handleSaveEntry = async () => {
        if (!currentEntry) {
            showAlert('error', 'Please select a date, FAB line, and shift');
            return;
        }
        if (!canSaveCurrentEntry) {
            showAlert('error', 'You are not authorized to save this entry');
            return;
        }
        if (!validateEntry()) return;

        setIsLoading(true);
        try {
            const payload = buildEntryPayload(currentEntry);
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
            const permissions = getEntryPermissions(saved);
            setCurrentAccessMode(permissions.canEdit ? 'edit' : 'view');
            setReadOnlyReason(permissions.canEdit ? '' : getReadOnlyReason(saved));
            await refreshWorkflowViews();
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
        if (!canDeleteCurrentEntry) {
            showAlert('error', 'You are not authorized to delete this entry');
            return;
        }
        const entryId = getEntryId(currentEntry);
        if (!entryId) {
            showAlert('error', 'Entry ID not found');
            return;
        }
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'report',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/entries/by-id/${entryId}`, {
                        method: 'DELETE',
                        headers: authHeaders(),
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
                    await refreshWorkflowViews();
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            },
        }));
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
        if (!canEditCurrentEntry) {
            showAlert('error', 'This entry is read-only');
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
                headers: authHeaders(true),
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

    const exportMonthlyExcelFor = async (year: number, month: number, fab: FabOption) => {
        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');
            const monthlyResponse = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`, {
                headers: authHeaders(),
            });
            if (!monthlyResponse.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResponse.json();
            const entries = (Array.isArray(monthlyJson?.data) ? monthlyJson.data : [])
                .map((entry: DailyEntry) => normalizeEntry(entry))
                .filter((entry: DailyEntry) => entry.fab === fab && FINALIZED_WORKFLOW_STATES.has(getWorkflowState(entry)))
                .map(buildEntryPayload);
            if (entries.length === 0) {
                throw new Error('No submitted or approved entries are available for this month and line');
            }
            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: authHeaders(true),
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

    const confirmExportMonthlyExcel = (year: number, month: number, fab: FabOption) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'report',
            onConfirm: () => exportMonthlyExcelFor(year, month, fab),
        }));
    };

    const handleExportMonthlyExcel = (fab: FabOption = selectedExportFab) => {
        confirmExportMonthlyExcel(currentDate.getFullYear(), currentDate.getMonth() + 1, fab);
    };

    const handleSubmitEntry = async () => {
        if (!currentEntry || !canSubmitCurrentEntry) {
            showAlert('error', 'You are not authorized to submit this entry');
            return;
        }
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.fab, currentEntry.shift);
        const signatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
        if (!signatures.preparedBy?.trim()) {
            showAlert('error', OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
            return;
        }
        if (!validateEntry()) return;

        try {
            setIsLoading(true);
            let entryToSubmit: DailyEntry = { ...currentEntry, signatures };
            let entryId = getEntryId(entryToSubmit);

            if (!entryId) {
                const saveResponse = await fetch(`${API_BASE_URL}/entries`, {
                    method: 'POST',
                    headers: authHeaders(true),
                    body: JSON.stringify(buildEntryPayload(entryToSubmit)),
                });
                if (!saveResponse.ok) {
                    const errorData = await saveResponse.json();
                    throw new Error(errorData.detail || 'Failed to save entry before submission');
                }
                const saveResult = await saveResponse.json();
                entryToSubmit = normalizeEntry(saveResult.data.entry as DailyEntry);
                entryId = getEntryId(entryToSubmit);
                setCurrentEntry(entryToSubmit);
                setIsEditing(true);
            }

            if (!entryId) throw new Error('Unable to submit entry without a saved draft ID');

            const submitResponse = await fetch(`${API_BASE_URL}/entries/${entryId}/submit`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(buildEntryPayload(entryToSubmit)),
            });
            if (!submitResponse.ok) {
                const errorData = await submitResponse.json();
                throw new Error(errorData.detail || 'Failed to submit entry');
            }
            const submitted = normalizeEntry(await submitResponse.json());
            setCurrentEntry(submitted);
            setCurrentAccessMode('view');
            setReadOnlyReason(getReadOnlyReason(submitted));
            setIsEditing(true);
            await refreshWorkflowViews();
            showAlert('success', currentWorkflowState === 'returned' ? 'Entry resubmitted successfully' : 'Entry submitted successfully');
        } catch (error) {
            console.error('Error submitting entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to submit entry');
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
            noun: 'report',
            onConfirm: () => approveEntry(entry),
        }));
    };

    const approveEntry = async (entry: DailyEntry | null) => {
        if (!entry || !getEntryPermissions(entry).canApprove) {
            showAlert('error', 'You are not authorized to approve this entry');
            return;
        }
        const entryId = getEntryId(entry);
        if (!entryId) {
            showAlert('error', 'Entry ID not found');
            return;
        }

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
            await refreshWorkflowViews();
            showAlert('success', 'Entry approved');
        } catch (error) {
            console.error('Error approving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to approve entry');
        } finally {
            setIsLoading(false);
        }
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
        if (!entryId) {
            showAlert('error', 'Entry ID not found');
            return;
        }

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
            closeReturnModal();
            await refreshWorkflowViews();
            showAlert('success', 'Entry returned for correction');
        } catch (error) {
            console.error('Error returning entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to return entry');
        } finally {
            setIsLoading(false);
        }
    };

    const openEntryFromRegister = async (entryMetadata: DailyEntry, requestedMode: EntryAccessMode = 'edit') => {
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
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch entry: ${response.status} ${errorText}`);
            }
            const selectedEntry = normalizeEntry(await response.json());
            const permissions = getEntryPermissions(selectedEntry);
            const accessMode: EntryAccessMode = requestedMode === 'edit' && permissions.canEdit ? 'edit' : 'view';
            const entryDate = new Date(selectedEntry.date);

            setCurrentDate(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1));
            setSelectedDate(selectedEntry.date);
            setSelectedFab(selectedEntry.fab);
            setSelectedShift(selectedEntry.shift);
            setCurrentEntry(selectedEntry);
            setCurrentAccessMode(accessMode);
            setReadOnlyReason(accessMode === 'view' ? getReadOnlyReason(selectedEntry) : '');
            setIsEditing(true);
            setDashboardView('daily');
            setActiveTab('dashboard');
            showAlert('info', `${accessMode === 'view' ? 'Viewing' : 'Opened'} entry for ${selectedEntry.date}, ${selectedEntry.fab}, Shift ${selectedEntry.shift}`);
        } catch (error) {
            console.error('Error opening entry:', error);
            showAlert('error', 'Failed to open entry');
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
            if (!response.ok) throw new Error('Failed to delete entry');
            if (getEntryId(currentEntry) === entryId) resetSelection();
            await refreshWorkflowViews();
            clearEntrySelection();
            showAlert('info', 'Entry deleted successfully');
        } catch (error) {
            console.error('Error deleting entry:', error);
            showAlert('error', 'Failed to delete entry');
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
            noun: 'report',
            onConfirm: () => deleteRegisterEntry(entry),
        }));
    };

    const clearEntrySelection = useCallback(() => {
        setSelectedEntryIds(new Set());
        setSelectedEntryRecords({});
        lastSelectedEntryIdRef.current = null;
    }, []);

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
        setSelectedEntryIds(prev => {
            const next = new Set(prev);
            visibleEntries.forEach(entry => {
                const entryId = getEntryId(entry);
                if (!entryId) return;
                if (selected) next.add(entryId);
                else next.delete(entryId);
            });
            return next;
        });
        setSelectedEntryRecords(prev => {
            const next = { ...prev };
            visibleEntries.forEach(entry => {
                const entryId = getEntryId(entry);
                if (!entryId) return;
                if (selected) next[entryId] = entry;
                else delete next[entryId];
            });
            return next;
        });
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
        const selectedEntries = getSelectedEntries();
        const entryIds = selectedEntries.map(getEntryId).filter(Boolean);
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
            console.error('Error bulk approving entries:', error);
            showAlert('error', 'Bulk approval failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDeleteEntries = async () => {
        const selectedEntries = getSelectedEntries().filter(entry => getEntryPermissions(entry).canDelete);
        const entryIds = selectedEntries.map(getEntryId).filter(Boolean);
        if (entryIds.length === 0) return;

        try {
            setBulkOperationStatus({ action: 'Deleting...', completed: 0, total: entryIds.length });
            const response = await fetch(`${API_BASE_URL}/bulk/delete`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ entryIds }),
            });
            if (!response.ok) throw new Error('Bulk delete failed');
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
            console.error('Error bulk deleting entries:', error);
            showAlert('error', 'Bulk delete failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDownloadEntries = async () => {
        const selectedEntries = getSelectedEntries();
        if (selectedEntries.length === 0) return;
        const result: BulkOperationResult = { requested: selectedEntries.length, downloaded: 0, skipped: {}, failed: [] };
        const exportGroups = new Map<string, { year: number; month: number; fab: FabOption }>();

        selectedEntries.forEach(entry => {
            if (!getEntryPermissions(entry).canExport) {
                const reason = formatWorkflowState(getWorkflowState(entry));
                result.skipped![reason] = (result.skipped![reason] || 0) + 1;
                return;
            }
            const entryDate = new Date(entry.date);
            const year = entryDate.getFullYear();
            const month = entryDate.getMonth() + 1;
            const fab = normalizeFab(entry.fab);
            exportGroups.set(`${year}-${month}-${fab}`, { year, month, fab });
        });

        try {
            setBulkOperationStatus({ action: 'Generating Excel...', completed: 0, total: exportGroups.size });
            let completed = 0;
            for (const group of exportGroups.values()) {
                try {
                    await exportMonthlyExcelFor(group.year, group.month, group.fab);
                    result.downloaded = (result.downloaded || 0) + 1;
                } catch (error) {
                    result.failed!.push({
                        reason: error instanceof Error ? error.message : 'Download failed',
                    });
                }
                completed += 1;
                setBulkOperationStatus({ action: 'Generating Excel...', completed, total: exportGroups.size });
                await new Promise(resolve => window.setTimeout(resolve, 0));
            }
            result.skippedCount = sumObjectValues(result.skipped || {});
            result.failedCount = getBulkFailureCount(result);
            if (getBulkFailureCount(result) > 0) console.warn('Bulk download failures', result.failed);
            clearEntrySelection();
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Download Completed', 'Downloaded', result.downloaded || 0, result)
            );
        } catch (error) {
            console.error('Error bulk downloading entries:', error);
            showAlert('error', 'Bulk download failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const confirmBulkApproveEntries = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            count: selectedEntryIds.size,
            noun: 'report',
            onConfirm: runBulkApproveEntries,
        }));
    };

    const confirmBulkDeleteEntries = () => {
        const selectedCount = getSelectedEntries().filter(entry => getEntryPermissions(entry).canDelete).length;
        if (selectedCount === 0) return;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkDeleteEntries,
        }));
    };

    const confirmBulkDownloadEntries = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            count: selectedEntryIds.size,
            noun: 'report',
            onConfirm: runBulkDownloadEntries,
        }));
    };

    useEffect(() => {
        clearEntrySelection();
    }, [activeTab, entryRegisterFilters, entryRegisterSearchInput, clearEntrySelection]);

    useEffect(() => {
        if (selectedEntryIds.size === 0) return;
        setSelectedEntryRecords(prev => {
            let hasChanges = false;
            const next = { ...prev };
            entryRegister.forEach(entry => {
                const entryId = getEntryId(entry);
                if (entryId && selectedEntryIds.has(entryId)) {
                    next[entryId] = entry;
                    hasChanges = true;
                }
            });
            return hasChanges ? next : prev;
        });
    }, [entryRegister, selectedEntryIds]);

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
            const entriesForDate = Object.values(dayEntries)
                .flatMap(group => Object.values(group || {}))
                .filter(Boolean) as DailyEntry[];
            const hasAny = entriesForDate
                .some(entry => hasEntryData(entry as DailyEntry) || entry?.signatures?.preparedBy || entry?.signatures?.verifiedBy);

            days.push(
                <button
                    key={dateStr}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`relative min-h-[96px] rounded-lg border-2 p-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-brand-primary ring-2 ring-brand-primary' : hasAny ? getDateStatusClass(entriesForDate) : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'} ${isToday ? 'font-bold' : ''}`}
                >
                    <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm dark:text-white">{day}</span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                        {SHIFT_OPTIONS.map(shift => {
                            const entry = dateEntries[dateStr]?.[selectedFab]?.[shift];
                            const entryState = entry ? getWorkflowState(entry) : undefined;
                            return (
                                <div key={shift} className="flex items-center gap-1 text-xs">
                                    {getShiftIcon(shift)}
                                    {hasEntryData(entry) ? (
                                        <span className={`h-3 w-3 rounded-full ${getStatusDotClass(entryState)}`} title={entryState ? formatWorkflowState(entryState) : undefined} />
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
        const canSignPrepared = canEditCurrentEntry && userRole === 'Operator' && !signatures.preparedBy;
        const canSignVerified = canEditCurrentEntry && ['Manager', 'Supervisor'].includes(userRole || '') && !signatures.verifiedBy;
        const canRemovePrepared = canEditCurrentEntry && signatures.preparedBy === username;
        const canRemoveVerified = canEditCurrentEntry && signatures.verifiedBy === username;

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
                    disabled={!canEditCurrentEntry}
                    className={`w-full rounded-md border px-2 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 ${inputStateClass}`}
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
                            disabled={!canEditCurrentEntry}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            placeholder="Enter PO"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">JB Status</label>
                        <select
                            value={line.jbStatus}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'jbStatus', event.target.value)}
                            disabled={!canEditCurrentEntry}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            <option value="">Select</option>
                            {JB_STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Bus Ribbon Status</label>
                        <select
                            value={line.busRibbonStatus}
                            onChange={(event) => handleLineFieldChange(lineLabel, 'busRibbonStatus', event.target.value)}
                            disabled={!canEditCurrentEntry}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                            disabled={!canEditCurrentEntry}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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

    const renderDashboardCards = () => {
        const summary = dashboardData?.summary || {
            totalEntries: 0,
            draft: 0,
            submitted: 0,
            returned: 0,
            approved: 0,
        };
        const totalLabel = dashboardView === 'daily'
            ? "Today's Entries"
            : dashboardView === 'weekly'
                ? 'Last 7 Days Entries'
                : 'Last 30 Days Entries';

        return (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    [totalLabel, summary.totalEntries],
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
                            className={`h-9 rounded px-4 text-sm font-semibold capitalize transition-colors ${
                                dashboardView === period
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
                            <th className="px-3 py-2 text-left font-semibold">Day</th>
                            <th className="px-3 py-2 text-left font-semibold">Total Entries</th>
                            <th className="px-3 py-2 text-left font-semibold">Draft</th>
                            <th className="px-3 py-2 text-left font-semibold">Submitted</th>
                            <th className="px-3 py-2 text-left font-semibold">Approved</th>
                            <th className="px-3 py-2 text-left font-semibold">Returned</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {(dashboardData?.groups || []).map(group => (
                            <tr key={group.key} className="text-gray-800 dark:text-gray-100">
                                <td className="px-3 py-2 text-left font-medium">
                                    <div>{group.dayName || group.key}</div>
                                    <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{group.displayDate || group.date}</div>
                                </td>
                                <td className="px-3 py-2 text-left">{group.totalEntries} Entries</td>
                                <td className="px-3 py-2 text-left">{group.draft} Draft</td>
                                <td className="px-3 py-2 text-left">{group.submitted} Submitted</td>
                                <td className="px-3 py-2 text-left">{group.approved} Approved</td>
                                <td className="px-3 py-2 text-left">{group.returned} Returned</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );

    const renderEntryRegister = () => {
        const updateFilters = (patch: Partial<EntryListFilters>) => {
            setEntryRegisterFilters(prev => ({ ...prev, ...patch }));
            setEntryRegisterPage(1);
            clearEntrySelection();
        };

        const resetFilters = () => {
            setEntryRegisterFilters({
                dateFrom: '',
                dateTo: '',
                shift: '',
                line: '',
                status: '',
            });
            setEntryRegisterSearchInput('');
            setEntryRegisterPage(1);
            clearEntrySelection();
        };

        const visibleSelectableEntries = entryRegister.filter(entry => Boolean(getEntryId(entry)));
        const visibleSelectedCount = visibleSelectableEntries.filter(entry =>
            selectedEntryIds.has(getEntryId(entry))
        ).length;
        const allVisibleSelected = visibleSelectableEntries.length > 0
            && visibleSelectedCount === visibleSelectableEntries.length;
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

                <div className="mb-2 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            value={entryRegisterSearchInput}
                            onChange={(event) => {
                                setEntryRegisterSearchInput(event.target.value);
                                setEntryRegisterPage(1);
                                clearEntrySelection();
                            }}
                            placeholder="Search production order, shift, line, date, creator, status"
                            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </label>
                    <input
                        type="date"
                        value={entryRegisterFilters.dateFrom}
                        onChange={(event) => updateFilters({ dateFrom: event.target.value, dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date from"
                    />
                    <input
                        type="date"
                        value={entryRegisterFilters.dateTo}
                        onChange={(event) => updateFilters({ dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date to"
                    />
                    <select
                        value={entryRegisterFilters.shift}
                        onChange={(event) => updateFilters({ shift: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Shift filter"
                    >
                        <option value="">Shift</option>
                        {SHIFT_OPTIONS.map(shift => <option key={shift} value={shift}>Shift {shift}</option>)}
                    </select>
                    <select
                        value={entryRegisterFilters.line}
                        onChange={(event) => updateFilters({ line: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Line filter"
                    >
                        <option value="">Line</option>
                        {FAB_OPTIONS.map(fab => <option key={fab} value={fab}>{fab}</option>)}
                    </select>
                    <select
                        value={entryRegisterFilters.status}
                        onChange={(event) => updateFilters({ status: event.target.value as EntryListFilters['status'] })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Status filter"
                    >
                        <option value="">Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="returned">Returned</option>
                        <option value="approved">Approved</option>
                    </select>
                    <select
                        value={entryRegisterSort}
                        onChange={(event) => {
                            setEntryRegisterSort(event.target.value as EntrySortOption);
                            setEntryRegisterPage(1);
                        }}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Sort entries"
                    >
                        <option value="date-newest">Newest Date</option>
                        <option value="date-oldest">Oldest Date</option>
                        <option value="newest-updated">Recently Updated</option>
                        <option value="status">Status</option>
                        <option value="created-by">Created By</option>
                        <option value="shift">Shift</option>
                        <option value="line">Line</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="h-9 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
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
                                {canBulkApprove && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkApproveEntries}
                                        disabled={Boolean(bulkOperationStatus)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Approve
                                    </button>
                                )}
                                {canBulkDownload && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkDownloadEntries}
                                        disabled={Boolean(bulkOperationStatus)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-3 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </button>
                                )}
                                {canBulkDelete && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkDeleteEntries}
                                        disabled={Boolean(bulkOperationStatus)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={clearEntrySelection}
                                    disabled={Boolean(bulkOperationStatus)}
                                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear Selection
                                </button>
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
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {entryRegisterTotal === 0 ? 'No entries found.' : 'No matching entries found.'}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-0 text-center text-xs">
                                <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                    <tr>
                                        <th className="w-10 border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                            <input
                                                type="checkbox"
                                                aria-label="Select all visible entries"
                                                checked={allVisibleSelected}
                                                disabled={visibleSelectableEntries.length === 0}
                                                ref={(element) => {
                                                    if (element) element.indeterminate = someVisibleSelected;
                                                }}
                                                onChange={(event) => setVisibleEntrySelection(visibleSelectableEntries, event.currentTarget.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                            />
                                        </th>
                                        {['Date', 'Line', 'Shift', 'Production Order', 'Created By', 'Status', 'Actions'].map(column => (
                                            <th key={column} className="border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {entryRegister.map((entry, index) => {
                                        const entryId = getEntryId(entry);
                                        const state = getWorkflowState(entry);
                                        const permissions = getEntryPermissions(entry);
                                        const isApproved = state === 'approved';
                                        const isSelected = entryId ? selectedEntryIds.has(entryId) : false;

                                        return (
                                            <tr
                                                key={entryId || `${entry.date}-${entry.fab}-${entry.shift}-${index}`}
                                                className={`${isSelected ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-white dark:bg-gray-900'} text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/70`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select entry ${entry.date} ${entry.fab} Shift ${entry.shift}`}
                                                        checked={isSelected}
                                                        disabled={!entryId}
                                                        onChange={(event) => toggleEntrySelection(
                                                            entry,
                                                            visibleSelectableEntries,
                                                            event.currentTarget.checked,
                                                            event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false
                                                        )}
                                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{entry.date || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{entry.fab || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">Shift {entry.shift || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left font-medium">{getEntryProductionOrder(entry) || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{getCreatedByLabel(entry)}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(state)}`}>
                                                        {formatWorkflowState(state)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEntryFromRegister(entry, 'view')}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            title="View"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {permissions.canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEntryFromRegister(entry, 'edit')}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover"
                                                                title="Edit"
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canExport && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const entryDate = new Date(entry.date);
                                                                    confirmExportMonthlyExcel(entryDate.getFullYear(), entryDate.getMonth() + 1, normalizeFab(entry.fab));
                                                                }}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                                                title="Download Monthly Excel"
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canApprove && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmApproveEntry(entry)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                                                title="Approve"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canReturn && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openReturnModal(entry)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-600 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                                                title="Return"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDeleteRegisterEntry(entry)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!permissions.canDelete && isApproved && (
                                                            <button
                                                                type="button"
                                                                disabled
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-400 opacity-60 dark:border-gray-700 dark:text-gray-500"
                                                                title={APPROVED_DELETE_TOOLTIP}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ReportPagination
                            totalItems={entryRegisterTotal}
                            page={entryRegisterPage}
                            pageSize={entryRegisterPageSize}
                            onPageChange={setEntryRegisterPage}
                            onPageSizeChange={(nextPageSize) => {
                                setEntryRegisterPageSize(nextPageSize);
                                setEntryRegisterPage(1);
                            }}
                            itemLabel="entries"
                        />
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
                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-brand-primary"></div>
                        <p className="mt-3 text-gray-700 dark:text-gray-300">Loading...</p>
                    </div>
                </div>
            )}

            {returnModalEntry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
                    <div className="w-full max-w-md rounded-md bg-white p-4 shadow-xl dark:bg-gray-900">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return for Correction</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {returnModalEntry.date} | {returnModalEntry.fab} | Shift {returnModalEntry.shift}
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
                                Return
                            </button>
                        </div>
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
                                        const entryState = entry ? getWorkflowState(entry) : undefined;
                                        return (
                                            <button
                                                key={shift}
                                                onClick={() => handleShiftSelect(shiftSelectorFab, shift)}
                                                className={`flex w-full items-center gap-3 rounded-lg border-2 p-4 transition-all ${isFilled ? getDateStatusClass([entry]) : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`}
                                            >
                                                <div className="shrink-0">{getShiftIcon(shift)}</div>
                                                <div className="grow text-left">
                                                    <div className="font-semibold dark:text-white">Shift {shift}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {isFilled ? `PO: ${firstPo || '-'}` : 'No entry yet'}
                                                    </div>
                                                </div>
                                                {entryState && (
                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(entryState)}`}>
                                                        {formatWorkflowState(entryState)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Peel Strength of Bus Ribbon to JB Soldering Test Report</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Allowable Limit &gt;= 25N</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('dashboard')}
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                            activeTab === 'dashboard'
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
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                            activeTab === 'entry-register'
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
                                {(isOperatorRole || isReviewerLikeRole) && (
                                    <button
                                        onClick={() => setShowExportFabSelector(true)}
                                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700"
                                        title="Download Monthly Excel"
                                    >
                                        <img
                                            src="/IMAGES/Excel.svg"
                                            alt="Excel"
                                            className="h-6 w-6 brightness-0 invert"
                                        />
                                    </button>
                                )}
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
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-semibold dark:text-white">
                                            {canEditCurrentEntry ? (isEditing ? 'Edit Entry' : 'New Entry') : 'View Entry'} - {currentEntry.testingDate} ({currentEntry.fab}, Shift {currentEntry.shift})
                                        </h3>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(currentWorkflowState)}`}>
                                            {formatWorkflowState(currentWorkflowState)}
                                        </span>
                                    </div>
                                    {readOnlyReason && (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{readOnlyReason}</p>
                                    )}
                                    {currentEntry.returnComments && currentWorkflowState === 'returned' && (
                                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Return comments: {currentEntry.returnComments}</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    {canExportCurrentEntry && (
                                        <button onClick={() => handleExportMonthlyExcel(currentEntry.fab)} className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20" title="Download Monthly Excel">
                                            <Download className="h-4 w-4" />
                                        </button>
                                    )}
                                    {canApproveCurrentEntry && (
                                        <button onClick={() => confirmApproveEntry(currentEntry)} className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20" title="Approve">
                                            <Check className="h-4 w-4" />
                                        </button>
                                    )}
                                    {canReturnCurrentEntry && (
                                        <button onClick={() => openReturnModal(currentEntry)} className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20" title="Return">
                                            <RotateCcw className="h-4 w-4" />
                                        </button>
                                    )}
                                    {canDeleteCurrentEntry && (
                                        <button onClick={handleDeleteEntry} className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!canDeleteCurrentEntry && currentWorkflowState === 'approved' && (
                                        <button type="button" disabled className="rounded-lg p-2 text-gray-400 opacity-60 dark:text-gray-500" title={APPROVED_DELETE_TOOLTIP}>
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
                                {canSaveCurrentEntry && (
                                    <button onClick={handleSaveEntry} className="flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-2 text-white transition-colors hover:bg-brand-primary-hover">
                                        <Save className="h-4 w-4" />
                                        {currentWorkflowState === 'submitted' ? 'Save Changes' : 'Save Draft'}
                                    </button>
                                )}
                                {canSubmitCurrentEntry && (
                                    <button onClick={handleSubmitEntry} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-white transition-colors hover:bg-emerald-700">
                                        <Check className="h-4 w-4" />
                                        {currentWorkflowState === 'returned' ? 'Resubmit' : 'Submit'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6 lg:col-span-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-900">
                            <div className="mb-2 flex items-center justify-between">
                                <BarChart3 className="h-5 w-5 text-brand-primary" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Monthly Entries</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">{monthlyStats.filledEntries}</div>
                            <div className="mt-1 text-xs text-gray-500">{monthlyStats.totalPossibleEntries} possible entries</div>
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
                            <div className="space-y-3">
                            {SHIFT_OPTIONS.map(shift => {
                                const filled = monthlyStats.shiftStats?.[shift]?.filled || 0;
                                const total = monthlyStats.totalDays * 2;
                                return (
                                    <div key={shift} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getShiftIcon(shift)}
                                                <span className="font-medium dark:text-white">Shift {shift}</span>
                                            </div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{filled} / {total}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}
