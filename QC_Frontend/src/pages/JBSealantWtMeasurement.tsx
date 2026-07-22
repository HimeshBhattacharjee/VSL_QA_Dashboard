import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import ReportPagination from '../components/ReportPagination';
import LineStatusControl, { OffLinePlaceholder } from '../components/LineStatusControl';
import { changeLineStatus, getLineStatus, hasLineMeasurements } from '../utilities/lineStatus';
import {
    buildWorkflowConfirmOptions,
    isResolvedCreator,
    OPERATOR_SIGNATURE_REQUIRED_MESSAGE,
    resolveCreatorName,
} from '../utilities/workflowUtils';
import {
    CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Trash2, Save, X,
    BarChart3, Target, TrendingUp, Clock, Sun, Sunset, Moon,
    Circle, CircleDot, CircleOff, Check, Download, Edit3, Eye,
    FileSpreadsheet, RotateCcw, Search
} from 'lucide-react';

interface JBPositionData {
    jbWeight: string;
    jbWeightWithSealant: string;
    netSealantWeight: string;
}

type LineGroup = 'Line-I' | 'Line-II';
type Shift = 'A' | 'B' | 'C';
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

const LINE_GROUPS: LineGroup[] = ['Line-I', 'Line-II'];
const SHIFTS: Shift[] = ['A', 'B', 'C'];
const DEFAULT_LINE_GROUP: LineGroup = 'Line-I';

const getEntryKey = (date: string, lineGroup: LineGroup, shift: Shift) => `${date}_${lineGroup}_${shift}`;
const getDisplayLineNumbers = (lineGroup: LineGroup) => lineGroup === 'Line-I' ? ['1', '2'] : ['3', '4'];
const getLineGroupLabel = (lineGroup: LineGroup) => `FAB-II ${lineGroup}`;
const normalizeLineGroup = (lineGroup?: string): LineGroup => lineGroup === 'Line-II' ? 'Line-II' : 'Line-I';
const getTodayDate = () => new Date().toISOString().split('T')[0];
const getWorkflowState = (entry?: Pick<DailyEntry, 'workflowState' | 'status'> | null): WorkflowState =>
    entry?.workflowState || entry?.status || 'submitted';
const formatWorkflowState = (state: WorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);
const getEntryProductionOrder = (entry: DailyEntry) =>
    entry.productionOrder || [entry.lines?.['1']?.po, entry.lines?.['2']?.po].filter(Boolean).join(' / ');
interface LineEntry {
    status?: 'ON' | 'OFF';
    line?: string;
    po: string;
    jbSupplier: string;
    sealantSupplier: string;
    sealantExpiry: string;
    positiveJB: JBPositionData;
    middleJB: JBPositionData;
    negativeJB: JBPositionData;
    totalModuleWeight: string;
    remarks?: string;
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
    lineGroup: LineGroup;
    lines: {
        '1': LineEntry;
        '2': LineEntry;
    };
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

type LineNumber = '1' | '2';
type JBPositionKey = 'positiveJB' | 'middleJB' | 'negativeJB';

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

const createEmptyJBPosition = (): JBPositionData => ({
    jbWeight: '',
    jbWeightWithSealant: '',
    netSealantWeight: ''
});

const JB_PASS_MIN = 4;
const JB_PASS_MAX = 10;
const JB_LINES_PER_SHIFT = 2;
const FINALIZED_WORKFLOW_STATES = new Set<WorkflowState>(['submitted', 'approved']);
const EDITABLE_OPERATOR_WORKFLOW_STATES = new Set<WorkflowState>(['draft', 'returned']);
const APPROVED_DELETE_TOOLTIP = 'Approved reports are permanently retained and cannot be deleted.';

const isNetSealantWeightOutOfRange = (value: string): boolean => {
    if (!value) return false;

    const weight = parseFloat(value);
    if (isNaN(weight)) return false;

    return weight < JB_PASS_MIN || weight > JB_PASS_MAX;
};

const lineRequiredFields: Array<{
    key: keyof Pick<LineEntry, 'jbSupplier' | 'sealantSupplier' | 'sealantExpiry'>;
    label: string;
}> = [
    { key: 'jbSupplier', label: 'JB Supplier' },
    { key: 'sealantSupplier', label: 'Sealant Supplier' },
    { key: 'sealantExpiry', label: 'Sealant Expiry Date' }
];

const jbPositionRequiredFields: Array<{
    key: keyof Omit<JBPositionData, 'netSealantWeight'>;
    label: string;
}> = [
    { key: 'jbWeight', label: 'JB Wt' },
    { key: 'jbWeightWithSealant', label: 'JB Wt with Sealant' }
];

const jbPositionLabels: Record<JBPositionKey, string> = {
    positiveJB: 'Positive JB',
    middleJB: 'Middle JB',
    negativeJB: 'Negative JB'
};

const normalizeFieldValue = (value?: string) => value?.trim() ?? '';

const getLineRequiredDetails = (line: LineEntry) => [
    ...lineRequiredFields.map(({ key, label }) => ({
        label,
        value: normalizeFieldValue(line[key])
    })),
    ...(['positiveJB', 'middleJB', 'negativeJB'] as const).flatMap((position) =>
        jbPositionRequiredFields.map(({ key, label }) => ({
            label: `${jbPositionLabels[position]} - ${label}`,
            value: normalizeFieldValue(line[position][key])
        }))
    )
];

const hasLineDetailInput = (line: LineEntry) =>
    getLineRequiredDetails(line).some(({ value }) => value !== '');

const getLineValidationMessage = (line: LineEntry, lineNumber: LineNumber): string | null => {
    const hasPo = normalizeFieldValue(line.po) !== '';
    const hasAnyLineInput = hasLineDetailInput(line);

    if (!hasPo && !hasAnyLineInput) {
        return null;
    }

    if (!hasPo) {
        return `Please enter the PO number for Line ${lineNumber} before saving.`;
    }

    const firstMissingDetail = getLineRequiredDetails(line).find(({ value }) => value === '');

    if (firstMissingDetail) {
        return `Please complete all mandatory details for Line ${lineNumber} before saving. Missing: ${firstMissingDetail.label}.`;
    }

    return null;
};

export default function JBSealantWeightMeasurement() {
    const [_, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<MainView>('dashboard');
    const [dashboardView, setDashboardView] = useState<DashboardPeriod>('daily');
    const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
    const [isDashboardLoading, setIsDashboardLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedLineGroup, setSelectedLineGroup] = useState<LineGroup>(DEFAULT_LINE_GROUP);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [dateSignatures, setDateSignatures] = useState<{ [contextKey: string]: Signatures }>({});
    const [showShiftSelector, setShowShiftSelector] = useState(false);
    const [shiftSelectorLineGroup, setShiftSelectorLineGroup] = useState<LineGroup | null>(null);
    const [showExportLineSelector, setShowExportLineSelector] = useState(false);
    const [selectedExportLineGroup, setSelectedExportLineGroup] = useState<LineGroup>(DEFAULT_LINE_GROUP);
    const [currentEntry, setCurrentEntry] = useState<DailyEntry | null>(null);
    const [currentAccessMode, setCurrentAccessMode] = useState<EntryAccessMode>('edit');
    const [readOnlyReason, setReadOnlyReason] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [dateEntries, setDateEntries] = useState<DateEntries>({});
    const [monthlyEntries, setMonthlyEntries] = useState<Map<string, DailyEntry>>(new Map());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>(defaultMonthlyStats);
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
    const [returnModalEntry, setReturnModalEntry] = useState<DailyEntry | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const lastSelectedEntryIdRef = useRef<string | null>(null);

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
    const canSubmitCurrentEntry = Boolean(currentEntry?._id) && isOperatorRole
        && isCurrentEntryOwner
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
            canDelete: (isReviewerLikeRole && state === 'submitted')
                || (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state)),
        };
    }, [employeeId, isOperatorRole, isReviewerLikeRole, username]);

    const getReadOnlyReason = useCallback((entry: DailyEntry) => {
        const state = getWorkflowState(entry);
        if (state === 'draft') return 'Draft entries are locked to the creating operator until submission.';
        if (state === 'returned') return 'Returned entries are locked to the original operator until resubmission.';
        if (state === 'approved') return 'Approved entries are read-only.';
        return 'This entry is read-only for your role.';
    }, []);

    const getCreatedByLabel = (entry: DailyEntry) => resolveCreatorName(entry);

    const getStateBadgeClass = (state: WorkflowState) => {
        if (state === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
        if (state === 'submitted') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
        if (state === 'returned') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    };

    const getStatusDotClass = (state?: WorkflowState) => {
        if (state === 'approved') return 'bg-emerald-500';
        if (state === 'submitted') return 'bg-blue-500';
        if (state === 'returned') return 'bg-amber-500';
        if (state === 'draft') return 'bg-gray-500';
        return 'bg-gray-300 dark:bg-gray-600';
    };

    const createEmptyLineEntry = useCallback((lineNum: '1' | '2' = '1'): LineEntry => ({
        status: 'ON',
        line: lineNum,
        po: '',
        jbSupplier: '',
        sealantSupplier: '',
        sealantExpiry: '',
        positiveJB: createEmptyJBPosition(),
        middleJB: createEmptyJBPosition(),
        negativeJB: createEmptyJBPosition(),
        totalModuleWeight: '',
        remarks: ''
    }), []);

    const createEmptyShiftEntry = useCallback((date: string, shift: Shift, lineGroup: LineGroup = selectedLineGroup): DailyEntry => ({
        date: date,
        testingDate: date,
        shift: shift,
        lineGroup: lineGroup,
        lines: {
            '1': createEmptyLineEntry('1'),
            '2': createEmptyLineEntry('2')
        },
        signatures: {
            preparedBy: '',
            verifiedBy: ''
        },
        status: 'draft',
        workflowState: 'draft'
    }), [createEmptyLineEntry]);

    const normalizeEntry = useCallback((entry: DailyEntry): DailyEntry => {
        const normalizedDate = normalizeDate(entry.date);
        const entryLineGroup = normalizeLineGroup(entry.lineGroup);
        const lines = {
            '1': {
                ...createEmptyLineEntry('1'),
                ...(entry.lines?.['1'] || {}),
                line: '1',
                positiveJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['1']?.positiveJB || {})
                },
                middleJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['1']?.middleJB || {})
                },
                negativeJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['1']?.negativeJB || {})
                }
            },
            '2': {
                ...createEmptyLineEntry('2'),
                ...(entry.lines?.['2'] || {}),
                line: '2',
                positiveJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['2']?.positiveJB || {})
                },
                middleJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['2']?.middleJB || {})
                },
                negativeJB: {
                    ...createEmptyJBPosition(),
                    ...(entry.lines?.['2']?.negativeJB || {})
                }
            }
        };

        return {
            ...entry,
            date: normalizedDate,
            testingDate: normalizeDate(entry.testingDate || normalizedDate),
            lineGroup: entryLineGroup,
            lines,
            signatures: entry.signatures || { preparedBy: '', verifiedBy: '' },
            status: getWorkflowState(entry),
            workflowState: getWorkflowState(entry),
            productionOrder: entry.productionOrder || [lines['1'].po, lines['2'].po].filter(Boolean).join(' / ')
        };
    }, [createEmptyLineEntry, normalizeDate]);

    const calculateNetSealantWeight = useCallback((jbWeight: string, jbWeightWithSealant: string): string => {
        if (!jbWeight || !jbWeightWithSealant) return '';
        const jb = parseFloat(jbWeight) || 0;
        const withSealant = parseFloat(jbWeightWithSealant) || 0;
        return (withSealant - jb).toFixed(2);
    }, []);

    const calculateTotalModuleWeight = useCallback((line: LineEntry): string => {
        const positiveNet = parseFloat(line.positiveJB.netSealantWeight) || 0;
        const middleNet = parseFloat(line.middleJB.netSealantWeight) || 0;
        const negativeNet = parseFloat(line.negativeJB.netSealantWeight) || 0;
        return (positiveNet + middleNet + negativeNet).toFixed(2);
    }, []);

    const handleJBPositionChange = useCallback((
        line: '1' | '2',
        position: 'positiveJB' | 'middleJB' | 'negativeJB',
        field: keyof JBPositionData,
        value: string
    ) => {
        if (!currentEntry) return;
        if (!canEditCurrentEntry || getLineStatus(currentEntry.lines[line]) === 'OFF') return;

        const updatedLines = { ...currentEntry.lines };
        const updatedPosition = { ...updatedLines[line][position] };
        
        updatedPosition[field] = value;
        
        // Auto-calculate net sealant weight when JB weight or JB weight with sealant changes
        if (field === 'jbWeight' || field === 'jbWeightWithSealant') {
            const jbWeight = field === 'jbWeight' ? value : updatedPosition.jbWeight;
            const jbWeightWithSealant = field === 'jbWeightWithSealant' ? value : updatedPosition.jbWeightWithSealant;
            updatedPosition.netSealantWeight = calculateNetSealantWeight(jbWeight, jbWeightWithSealant);
        }
        
        updatedLines[line][position] = updatedPosition;
        
        // Update total module weight for this line
        updatedLines[line].totalModuleWeight = calculateTotalModuleWeight(updatedLines[line]);
        
        setCurrentEntry({
            ...currentEntry,
            lines: updatedLines
        });
        setHasUnsavedChanges(true);
    }, [currentEntry, canEditCurrentEntry, calculateNetSealantWeight, calculateTotalModuleWeight]);

    const handleLineInputChange = useCallback((
        line: '1' | '2',
        field: keyof Omit<LineEntry, 'positiveJB' | 'middleJB' | 'negativeJB' | 'totalModuleWeight'>,
        value: string
    ) => {
        if (!currentEntry) return;
        if (!canEditCurrentEntry || getLineStatus(currentEntry.lines[line]) === 'OFF') return;

        const updatedLines = {
            ...currentEntry.lines,
            [line]: {
                ...currentEntry.lines[line],
                [field]: value
            }
        };

        setCurrentEntry({
            ...currentEntry,
            lines: updatedLines
        });
        setHasUnsavedChanges(true);
    }, [currentEntry, canEditCurrentEntry]);

    const handleLineStatusChange = useCallback((line: '1' | '2', nextStatus: 'ON' | 'OFF') => {
        if (!currentEntry || !canEditCurrentEntry) return;
        const apply = () => {
            setCurrentEntry(entry => entry ? ({ ...entry, lines: { ...entry.lines, [line]: changeLineStatus({ ...createEmptyLineEntry(line), ...entry.lines[line] }, nextStatus) } }) : entry);
            setHasUnsavedChanges(true);
        };
        if (nextStatus === 'OFF' && hasLineMeasurements(currentEntry.lines[line])) {
            showConfirm({ title: 'Turn line OFF?', message: 'Existing values for this line will be discarded.', type: 'warning', confirmText: 'Turn OFF', onConfirm: apply });
        } else apply();
    }, [currentEntry, canEditCurrentEntry, showConfirm, createEmptyLineEntry]);

    const loadMonthlyData = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        try {
            const entriesUrl = `${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`;
            const statsUrl = `${API_BASE_URL}/stats/monthly?year=${year}&month=${month}`;

            const [entriesResponse, statsResponse] = await Promise.all([
                fetch(entriesUrl, { headers: authHeaders() }),
                fetch(statsUrl)
            ]);

            const entriesJson = await entriesResponse.json();
            const statsJson = await statsResponse.json();

            let entriesArr: DailyEntry[] = [];
            if (entriesJson.data && Array.isArray(entriesJson.data)) {
                entriesArr = entriesJson.data.map(normalizeEntry);
            } else if (Array.isArray(entriesJson)) {
                entriesArr = entriesJson.map(normalizeEntry);
            }

            const entriesMap = new Map<string, DailyEntry>();
            const dateEntriesObj: DateEntries = {};
            const dateSigs: { [contextKey: string]: Signatures } = entriesJson.date_signatures || {};

            entriesArr.forEach((entry: DailyEntry) => {
                const normalizedDate = normalizeDate(entry.date);
                const entryLineGroup = normalizeLineGroup(entry.lineGroup);
                
                // Ensure all required fields exist for new structure
                if (!entry.lines) {
                    entry.lines = {
                        '1': createEmptyLineEntry('1'),
                        '2': createEmptyLineEntry('2')
                    };
                } else {
                    ['1', '2'].forEach(lineNum => {
                        const line = entry.lines[lineNum as '1' | '2'];
                        if (!line.positiveJB) line.positiveJB = createEmptyJBPosition();
                        if (!line.middleJB) line.middleJB = createEmptyJBPosition();
                        if (!line.negativeJB) line.negativeJB = createEmptyJBPosition();
                        if (!line.line) line.line = lineNum;
                    });
                }

                // Use date-level signatures
                entry.signatures = dateSigs[getEntryKey(normalizedDate, entryLineGroup, entry.shift)] || dateSigs[normalizedDate] || {
                    preparedBy: '',
                    verifiedBy: ''
                };

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
    }, [API_BASE_URL, authHeaders, normalizeDate, normalizeEntry, createEmptyLineEntry]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        loadMonthlyData(year, month);
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
            console.error('Error loading JB sealant dashboard:', error);
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
    }, [API_BASE_URL, authHeaders, entryRegisterFilters, entryRegisterPage, entryRegisterPageSize, entryRegisterSearch, entryRegisterSort, normalizeEntry, showAlert]);

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

    const handlePrevMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
    }, []);

    const handleNextMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
    }, []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
    }, []);

    const handleYearChange = useCallback((year: number) => {
        setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentEntry(null);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
    }, []);

    const handleDateSelect = useCallback((date: string) => {
        const normalized = normalizeDate(date);
        setSelectedDate(normalized);
        setShowShiftSelector(true);
        setShiftSelectorLineGroup(null);
        setCurrentEntry(null);
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
    }, [normalizeDate]);

    const handleShiftSelect = useCallback((lineGroup: LineGroup, shift: Shift) => {
        setSelectedLineGroup(lineGroup);
        setSelectedShift(shift);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);

        const entryKey = getEntryKey(selectedDate, lineGroup, shift);
        const entry = monthlyEntries.get(entryKey);

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
            setCurrentEntry(createEmptyShiftEntry(selectedDate, shift, lineGroup));
            setCurrentAccessMode('edit');
            setReadOnlyReason('');
            setIsEditing(false);
        }
    }, [selectedDate, monthlyEntries, normalizeEntry, getEntryPermissions, getReadOnlyReason, canCreateEntry, showAlert, createEmptyShiftEntry]);

    const handleCloseShiftSelector = useCallback(() => {
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
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

    const handleSaveEntry = useCallback(async () => {
        if (!currentEntry || !currentEntry.testingDate || !currentEntry.shift) {
            showAlert('error', 'Please enter a valid date and shift');
            return;
        }

        if (!canSaveCurrentEntry) {
            showAlert('error', 'This entry is read-only');
            return;
        }

        for (const lineNumber of ['1', '2'] as const) {
            const validationMessage = getLineValidationMessage(currentEntry.lines[lineNumber], lineNumber);
            if (validationMessage) {
                showAlert('error', validationMessage);
                return;
            }
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(currentEntry),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save entry');
            }

            const result = await response.json();
            if (result.data && result.data.entry) {
                const saved = normalizeEntry(result.data.entry as DailyEntry);
                const normalized = normalizeDate(saved.date);

                // Ensure all fields exist
                if (saved.lines) {
                    ['1', '2'].forEach(lineNum => {
                        const line = saved.lines[lineNum as '1' | '2'];
                        if (!line.positiveJB) line.positiveJB = createEmptyJBPosition();
                        if (!line.middleJB) line.middleJB = createEmptyJBPosition();
                        if (!line.negativeJB) line.negativeJB = createEmptyJBPosition();
                        if (!line.line) line.line = lineNum;
                    });
                }

                // Ensure signatures object exists
                if (!saved.signatures) {
                    saved.signatures = {
                        preparedBy: '',
                        verifiedBy: ''
                    };
                }

                const savedLineGroup = normalizeLineGroup(saved.lineGroup);
                saved.lineGroup = savedLineGroup;
                const entryKey = getEntryKey(normalized, savedLineGroup, saved.shift);

                const updatedEntries = new Map(monthlyEntries);
                updatedEntries.set(entryKey, { ...saved, date: normalized });
                setMonthlyEntries(updatedEntries);

                // Update dateEntries
                const updatedDateEntries = {
                    ...dateEntries,
                    [normalized]: {
                        ...dateEntries[normalized],
                        [savedLineGroup]: {
                            ...(dateEntries[normalized]?.[savedLineGroup] || {}),
                            [saved.shift]: { ...saved, date: normalized }
                        }
                    }
                };
                setDateEntries(updatedDateEntries);

                setCurrentEntry({ ...saved, date: normalized });
                const permissions = getEntryPermissions(saved);
                setReadOnlyReason(permissions.canEdit ? '' : getReadOnlyReason(saved));
                setIsEditing(true);
            }

            await refreshWorkflowViews();

            setHasUnsavedChanges(false);
            showAlert('success', result.message || 'Entry saved successfully');

        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save entry');
        } finally {
            setIsLoading(false);
        }
    }, [currentEntry, canSaveCurrentEntry, monthlyEntries, dateEntries, API_BASE_URL, authHeaders, showAlert, normalizeDate, normalizeEntry, getEntryPermissions, getReadOnlyReason, refreshWorkflowViews]);

    const handleDeleteEntry = useCallback(() => {
        if (!currentEntry || !currentEntry.shift) return;
        if (!canDeleteCurrentEntry) {
            showAlert('error', 'You are not authorized to delete this entry');
            return;
        }

        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'entry',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const dateKey = normalizeDate(currentEntry.date);
                    const shift = currentEntry.shift;
                    const lineGroup = normalizeLineGroup(currentEntry.lineGroup);
                    const entryId = getEntryId(currentEntry);

                    const response = await fetch(entryId ? `${API_BASE_URL}/entries/by-id/${entryId}` : `${API_BASE_URL}/entries/${dateKey}/${lineGroup}/${shift}`, {
                        method: 'DELETE',
                        headers: authHeaders(),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => null);
                        throw new Error(errorData?.detail || 'Failed to delete entry');
                    }

                    const entryKey = getEntryKey(dateKey, lineGroup, shift);
                    const updatedEntries = new Map(monthlyEntries);
                    updatedEntries.delete(entryKey);
                    setMonthlyEntries(updatedEntries);

                    setDateEntries(prev => {
                        const newDateEntries = { ...prev };
                        if (newDateEntries[dateKey]) {
                            delete newDateEntries[dateKey]?.[lineGroup]?.[shift];
                            if (Object.keys(newDateEntries[dateKey]).length === 0) {
                                delete newDateEntries[dateKey];
                            }
                        }
                        return newDateEntries;
                    });

                    setCurrentEntry(null);
                    setSelectedDate('');
                    setSelectedShift(null);
                    setReadOnlyReason('');
                    await refreshWorkflowViews();
                    showAlert('info', 'Entry deleted successfully');
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    showAlert('error', error instanceof Error ? error.message : 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            }
        }));
    }, [currentEntry, canDeleteCurrentEntry, monthlyEntries, API_BASE_URL, authHeaders, showAlert, showConfirm, normalizeDate, refreshWorkflowViews]);

    const handleSignatureUpdate = useCallback(async (type: 'prepared' | 'verified') => {
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

        // Get current date-level signatures
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.lineGroup || DEFAULT_LINE_GROUP, currentEntry.shift);
        const currentDateSigs = dateSignatures[signatureKey] || dateSignatures[currentEntry.date] || {
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
                [signatureKey]: updatedSignatures
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
                    headers: authHeaders(true),
                    body: JSON.stringify({
                        date: currentEntry.date,
                        lineGroup: currentEntry.lineGroup || DEFAULT_LINE_GROUP,
                        shift: currentEntry.shift,
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
                [signatureKey]: updatedSignatures
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
                    headers: authHeaders(true),
                    body: JSON.stringify({
                        date: currentEntry.date,
                        lineGroup: currentEntry.lineGroup || DEFAULT_LINE_GROUP,
                        shift: currentEntry.shift,
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
    }, [username, userRole, currentEntry, canEditCurrentEntry, dateSignatures, showAlert, API_BASE_URL, authHeaders]);

    const exportMonthlyExcelFor = useCallback(async (year: number, month: number, exportLineGroup: LineGroup = selectedExportLineGroup) => {
        const monthName = months[month - 1];
        const firstThreeLetters = monthName.substring(0, 3);
        const reportName = `JB_Sealant_Weight_${firstThreeLetters}_${year}`;

        setIsLoading(true);
        try {
            showAlert('info', 'Generating Excel report...');

            const monthlyResp = await fetch(`${API_BASE_URL}/entries/monthly?year=${year}&month=${month}`, {
                headers: authHeaders(),
            });
            if (!monthlyResp.ok) throw new Error('Failed to fetch monthly entries');
            const monthlyJson = await monthlyResp.json();

            let entriesArray = Array.isArray(monthlyJson?.data) ? monthlyJson.data : [];

            entriesArray = entriesArray.filter((entry: DailyEntry) => normalizeLineGroup(entry.lineGroup) === exportLineGroup);

            entriesArray = entriesArray.map((entry: DailyEntry) => {
                if (entry.lines) {
                    ['1', '2'].forEach(lineNum => {
                        const line = entry.lines[lineNum as '1' | '2'];
                        if (!line.positiveJB) line.positiveJB = createEmptyJBPosition();
                        if (!line.middleJB) line.middleJB = createEmptyJBPosition();
                        if (!line.negativeJB) line.negativeJB = createEmptyJBPosition();
                        if (!line.line) line.line = lineNum;
                    });
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
                lineGroup: exportLineGroup,
                year,
                month
            };

            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: authHeaders(true),
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
    }, [months, API_BASE_URL, authHeaders, showAlert, selectedExportLineGroup]);

    const confirmExportMonthlyExcel = useCallback((year: number, month: number, lineGroup: LineGroup) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'entry',
            onConfirm: () => exportMonthlyExcelFor(year, month, lineGroup),
        }));
    }, [exportMonthlyExcelFor, showConfirm]);

    const handleExportMonthlyExcel = useCallback((exportLineGroup: LineGroup = selectedExportLineGroup) => {
        confirmExportMonthlyExcel(currentDate.getFullYear(), currentDate.getMonth() + 1, exportLineGroup);
    }, [confirmExportMonthlyExcel, currentDate, selectedExportLineGroup]);

    const handleReset = useCallback(() => {
        setCurrentEntry(null);
        setSelectedDate('');
        setSelectedLineGroup(DEFAULT_LINE_GROUP);
        setSelectedShift(null);
        setShowShiftSelector(false);
        setShiftSelectorLineGroup(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
        setHasUnsavedChanges(false);
    }, []);

    const handleSubmitEntry = useCallback(async () => {
        if (!currentEntry) return;
        if (!canSubmitCurrentEntry) {
            showAlert('error', 'Only the creating operator can submit draft or returned entries');
            return;
        }
        const signatureKey = getEntryKey(currentEntry.date, currentEntry.lineGroup || DEFAULT_LINE_GROUP, currentEntry.shift);
        const signatures = dateSignatures[signatureKey] || currentEntry.signatures || { preparedBy: '', verifiedBy: '' };
        if (!signatures.preparedBy?.trim()) {
            showAlert('error', OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
            return;
        }

        setIsLoading(true);
        try {
            let entryToSubmit: DailyEntry = { ...currentEntry, signatures };
            let entryId = getEntryId(entryToSubmit);
            if (!entryId) {
                await handleSaveEntry();
                const saved = monthlyEntries.get(getEntryKey(entryToSubmit.date, entryToSubmit.lineGroup, entryToSubmit.shift));
                entryToSubmit = saved || entryToSubmit;
                entryId = getEntryId(entryToSubmit);
            }
            if (!entryId) throw new Error('Please save the entry before submitting');

            const response = await fetch(`${API_BASE_URL}/entries/${entryId}/submit`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(entryToSubmit),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || 'Failed to submit entry');
            }
            const submitted = normalizeEntry(await response.json());
            setCurrentEntry(submitted);
            setCurrentAccessMode('view');
            setReadOnlyReason(getReadOnlyReason(submitted));
            await refreshWorkflowViews();
            showAlert('success', 'Entry submitted successfully');
        } catch (error) {
            console.error('Error submitting entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to submit entry');
        } finally {
            setIsLoading(false);
        }
    }, [currentEntry, canSubmitCurrentEntry, dateSignatures, handleSaveEntry, monthlyEntries, API_BASE_URL, authHeaders, normalizeEntry, getReadOnlyReason, refreshWorkflowViews, showAlert]);

    const approveEntry = useCallback(async (entry: DailyEntry) => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/entries/${entryId}/approve`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || 'Failed to approve entry');
            }
            const approved = normalizeEntry(await response.json());
            if (getEntryId(currentEntry) === entryId) {
                setCurrentEntry(approved);
                setCurrentAccessMode('view');
                setReadOnlyReason(getReadOnlyReason(approved));
            }
            await refreshWorkflowViews();
            showAlert('success', 'Entry approved successfully');
        } catch (error) {
            console.error('Error approving entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to approve entry');
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, authHeaders, currentEntry, normalizeEntry, getReadOnlyReason, refreshWorkflowViews, showAlert]);

    const confirmApproveEntry = useCallback((entry: DailyEntry | null) => {
        if (!entry) return;
        if (!getEntryPermissions(entry).canApprove) {
            showAlert('error', 'Only submitted entries can be approved');
            return;
        }
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            noun: 'entry',
            onConfirm: () => approveEntry(entry),
        }));
    }, [approveEntry, getEntryPermissions, showAlert, showConfirm]);

    const openReturnModal = useCallback((entry: DailyEntry) => {
        if (!getEntryPermissions(entry).canReturn) {
            showAlert('error', 'Only submitted entries can be returned');
            return;
        }
        setReturnModalEntry(entry);
        setReturnComment(entry.returnComments || '');
        setReturnCommentError('');
    }, [getEntryPermissions, showAlert]);

    const closeReturnModal = useCallback(() => {
        setReturnModalEntry(null);
        setReturnComment('');
        setReturnCommentError('');
    }, []);

    const submitReturnForCorrection = useCallback(async () => {
        if (!returnModalEntry) return;
        const entryId = getEntryId(returnModalEntry);
        const comments = returnComment.trim();
        if (!comments) {
            setReturnCommentError('Return comments are required');
            return;
        }
        if (!entryId) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/entries/${entryId}/return`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ returnComments: comments }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || 'Failed to return entry');
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
    }, [returnModalEntry, returnComment, API_BASE_URL, authHeaders, currentEntry, normalizeEntry, getReadOnlyReason, closeReturnModal, refreshWorkflowViews, showAlert]);

    const openEntryFromRegister = useCallback(async (entry: DailyEntry, accessMode: EntryAccessMode) => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/entries/by-id/${entryId}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || 'Failed to open entry');
            }
            const selectedEntry = normalizeEntry(await response.json());
            const permissions = getEntryPermissions(selectedEntry);
            const nextAccessMode: EntryAccessMode = accessMode === 'edit' && permissions.canEdit ? 'edit' : 'view';
            setCurrentEntry(selectedEntry);
            setCurrentAccessMode(nextAccessMode);
            setReadOnlyReason(nextAccessMode === 'view' ? getReadOnlyReason(selectedEntry) : '');
            setSelectedDate(selectedEntry.date);
            setSelectedLineGroup(selectedEntry.lineGroup);
            setSelectedShift(selectedEntry.shift);
            setIsEditing(true);
            setDashboardView('daily');
            setActiveTab('dashboard');
            const entryDate = new Date(`${selectedEntry.date}T00:00:00`);
            setCurrentDate(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1));
            showAlert('info', `${nextAccessMode === 'view' ? 'Viewing' : 'Opened'} entry for ${selectedEntry.date}, ${getLineGroupLabel(selectedEntry.lineGroup)}, Shift ${selectedEntry.shift}`);
        } catch (error) {
            console.error('Error opening entry:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to open entry');
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, authHeaders, normalizeEntry, getEntryPermissions, getReadOnlyReason, showAlert]);

    const clearEntrySelection = useCallback(() => {
        setSelectedEntryIds(new Set());
        setSelectedEntryRecords({});
        lastSelectedEntryIdRef.current = null;
    }, []);

    const setVisibleEntrySelection = useCallback((entries: DailyEntry[], checked: boolean) => {
        setSelectedEntryIds(prev => {
            const next = new Set(prev);
            entries.forEach(entry => {
                const entryId = getEntryId(entry);
                if (!entryId) return;
                if (checked) next.add(entryId);
                else next.delete(entryId);
            });
            return next;
        });
        setSelectedEntryRecords(prev => {
            const next = { ...prev };
            entries.forEach(entry => {
                const entryId = getEntryId(entry);
                if (!entryId) return;
                if (checked) next[entryId] = entry;
                else delete next[entryId];
            });
            return next;
        });
    }, []);

    const toggleEntrySelection = useCallback((
        entry: DailyEntry,
        visibleEntries: DailyEntry[],
        checked: boolean,
        shiftKey: boolean
    ) => {
        const entryId = getEntryId(entry);
        if (!entryId) return;
        let targetEntries = [entry];
        if (shiftKey && lastSelectedEntryIdRef.current) {
            const currentIndex = visibleEntries.findIndex(item => getEntryId(item) === entryId);
            const lastIndex = visibleEntries.findIndex(item => getEntryId(item) === lastSelectedEntryIdRef.current);
            if (currentIndex >= 0 && lastIndex >= 0) {
                const [start, end] = [Math.min(currentIndex, lastIndex), Math.max(currentIndex, lastIndex)];
                targetEntries = visibleEntries.slice(start, end + 1);
            }
        }
        setVisibleEntrySelection(targetEntries, checked);
        lastSelectedEntryIdRef.current = entryId;
    }, [setVisibleEntrySelection]);

    const getSelectedEntries = useCallback(() =>
        Array.from(selectedEntryIds)
            .map(entryId => selectedEntryRecords[entryId] || entryRegister.find(entry => getEntryId(entry) === entryId))
            .filter((entry): entry is DailyEntry => Boolean(entry)),
    [entryRegister, selectedEntryIds, selectedEntryRecords]);

    const getBulkFailureCount = (result: BulkOperationResult) =>
        result.failedCount ?? result.failed?.length ?? 0;

    const formatBulkOperationSummary = (
        title: string,
        actionLabel: string,
        processedCount: number,
        result: BulkOperationResult,
        fallbackSkip = ''
    ) => {
        const lines = [`${title}: ${processedCount} ${actionLabel}`];
        Object.entries(result.skipped || {}).forEach(([reason, count]) => {
            lines.push(reason === 'Already Approved' ? `${count} ${reason}` : `${count} ${reason} Skipped`);
        });
        const failedCount = getBulkFailureCount(result);
        if (failedCount) lines.push(`${failedCount} Failed`);
        if (!processedCount && !failedCount && fallbackSkip) lines.push(fallbackSkip);
        return lines.join('. ');
    };

    const runBulkApproveEntries = useCallback(async () => {
        const entryIds = getSelectedEntries().map(getEntryId).filter(Boolean);
        if (!entryIds.length) return;
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
            const approved = result.approved || result.processed || 0;
            clearEntrySelection();
            await refreshWorkflowViews();
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
    }, [API_BASE_URL, authHeaders, clearEntrySelection, getSelectedEntries, refreshWorkflowViews, showAlert]);

    const runBulkDeleteEntries = useCallback(async () => {
        const entryIds = getSelectedEntries().map(getEntryId).filter(Boolean);
        if (!entryIds.length) return;
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
            const deleted = result.deleted || result.processed || 0;
            clearEntrySelection();
            await refreshWorkflowViews();
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
    }, [API_BASE_URL, authHeaders, clearEntrySelection, getSelectedEntries, refreshWorkflowViews, showAlert]);

    const runBulkDownloadEntries = useCallback(async () => {
        const selectedEntries = getSelectedEntries();
        const exportableEntries = selectedEntries.filter(entry => getEntryPermissions(entry).canExport);
        const result: BulkOperationResult = { requested: selectedEntries.length, downloaded: 0, skipped: {}, failed: [] };
        if (!exportableEntries.length) {
            result.skipped = { 'No Export Access': selectedEntries.length };
            showAlert('warning', formatBulkOperationSummary('Bulk Download Completed', 'Downloaded', 0, result));
            return;
        }

        const exportGroups = new Map<string, { year: number; month: number; lineGroup: LineGroup }>();
        exportableEntries.forEach(entry => {
            const entryDate = new Date(`${entry.date}T00:00:00`);
            const year = entryDate.getFullYear();
            const month = entryDate.getMonth() + 1;
            const lineGroup = normalizeLineGroup(entry.lineGroup);
            exportGroups.set(`${year}-${month}-${lineGroup}`, { year, month, lineGroup });
        });

        try {
            setBulkOperationStatus({ action: 'Generating Excel...', completed: 0, total: exportGroups.size });
            let completed = 0;
            for (const group of exportGroups.values()) {
                try {
                    await exportMonthlyExcelFor(group.year, group.month, group.lineGroup);
                    result.downloaded = (result.downloaded || 0) + 1;
                } catch (error) {
                    result.failed?.push({ reason: error instanceof Error ? error.message : 'Download failed' });
                } finally {
                    completed += 1;
                    setBulkOperationStatus({ action: 'Generating Excel...', completed, total: exportGroups.size });
                }
            }
            result.failedCount = getBulkFailureCount(result);
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
    }, [clearEntrySelection, exportMonthlyExcelFor, getEntryPermissions, getSelectedEntries, showAlert]);

    const confirmBulkApproveEntries = useCallback(() => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            count: selectedEntryIds.size,
            noun: 'entry',
            onConfirm: runBulkApproveEntries,
        }));
    }, [runBulkApproveEntries, selectedEntryIds.size, showConfirm]);

    const confirmBulkDeleteEntries = useCallback(() => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            count: selectedEntryIds.size,
            noun: 'entry',
            onConfirm: runBulkDeleteEntries,
        }));
    }, [runBulkDeleteEntries, selectedEntryIds.size, showConfirm]);

    const confirmBulkDownloadEntries = useCallback(() => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            count: selectedEntryIds.size,
            noun: 'entry',
            onConfirm: runBulkDownloadEntries,
        }));
    }, [runBulkDownloadEntries, selectedEntryIds.size, showConfirm]);

    const confirmDeleteRegisterEntry = useCallback((entry: DailyEntry) => {
        if (!getEntryPermissions(entry).canDelete) {
            showAlert('error', 'You are not authorized to delete this entry');
            return;
        }
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'entry',
            onConfirm: async () => {
                const entryId = getEntryId(entry);
                if (!entryId) return;
                setIsLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/entries/by-id/${entryId}`, {
                        method: 'DELETE',
                        headers: authHeaders(),
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => null);
                        throw new Error(errorData?.detail || 'Failed to delete entry');
                    }
                    clearEntrySelection();
                    await refreshWorkflowViews();
                    showAlert('info', 'Entry deleted successfully');
                } catch (error) {
                    console.error('Error deleting register entry:', error);
                    showAlert('error', error instanceof Error ? error.message : 'Failed to delete entry');
                } finally {
                    setIsLoading(false);
                }
            },
        }));
    }, [API_BASE_URL, authHeaders, clearEntrySelection, getEntryPermissions, refreshWorkflowViews, showAlert, showConfirm]);

    const getShiftIcon = useCallback((shift: 'A' | 'B' | 'C') => {
        switch (shift) {
            case 'A': return <Sun className="w-3 h-3 text-amber-500" />;
            case 'B': return <Sunset className="w-3 h-3 text-orange-500" />;
            case 'C': return <Moon className="w-3 h-3 text-indigo-500" />;
            default: return null;
        }
    }, []);

    const checkLineValidity = useCallback((line: LineEntry | undefined): { pass: boolean; fail: boolean; any: boolean } => {
        if (getLineStatus(line) === 'OFF') return { pass: false, fail: false, any: false };
        if (!line) return { pass: false, fail: false, any: false };
        
        const positions = [
            line.positiveJB,
            line.middleJB,
            line.negativeJB
        ];
        
        let pass = false;
        let fail = false;
        let any = false;
        
        positions.forEach(pos => {
            if (pos.netSealantWeight) {
                any = true;
                const weight = parseFloat(pos.netSealantWeight);
                if (weight >= JB_PASS_MIN && weight <= JB_PASS_MAX) {
                    pass = true;
                } else {
                    fail = true;
                }
            }
        });
        
        return { pass, fail, any };
    }, []);

    const getShiftResultIndicator = useCallback((entry: DailyEntry | undefined) => {
        if (!entry || !entry.lines) return <CircleOff className="w-3 h-3 text-gray-400" />;

        const line1Validity = checkLineValidity(entry.lines['1']);
        const line2Validity = checkLineValidity(entry.lines['2']);

        if ((line1Validity.pass || line2Validity.pass) && !line1Validity.fail && !line2Validity.fail) 
            return <CircleDot className="w-3 h-3 text-green-500" />;
        if (line1Validity.fail || line2Validity.fail) 
            return <Circle className="w-3 h-3 text-red-500" />;
        if (line1Validity.any || line2Validity.any) 
            return <Circle className="w-3 h-3 text-yellow-500" />;

        return <CircleOff className="w-3 h-3 text-gray-400" />;
    }, [checkLineValidity]);

    const renderCalendarDays = useCallback(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        const todayStr = getTodayDate();

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

            Object.values(dayEntries).flatMap(group => Object.values(group || {})).forEach((shiftEntry: any) => {
                if (shiftEntry?.lines && typeof shiftEntry === 'object' && 'shift' in shiftEntry) {
                    const line1Validity = checkLineValidity(shiftEntry.lines['1']);
                    const line2Validity = checkLineValidity(shiftEntry.lines['2']);
                    
                    if (line1Validity.pass || line2Validity.pass) hasPass = true;
                    if (line1Validity.fail || line2Validity.fail) hasFail = true;
                    if (line1Validity.any || line2Validity.any) hasAny = true;
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
                        ${isSelected ? 'ring-2 ring-brand-primary border-brand-primary' : statusClass}
                        ${isToday ? 'font-bold' : ''}
                        hover:shadow-md hover:-translate-y-0.5
                        ${!hasAny && !hasSignatures ? 'hover:border-brand-primary/40' : ''}
                    `}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm dark:text-white">{i}</span>
                    </div>

                    <div className="flex flex-col gap-1 mt-1">
                        {SHIFTS.map(shift => {
                            const entry = dateEntries[dateStr]?.[selectedLineGroup]?.[shift] as DailyEntry | undefined;
                            const statusState = entry ? getWorkflowState(entry) : undefined;
                            return (
                                <div key={shift} className="flex flex-col gap-0.5 text-xs">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="flex items-center gap-1">
                                            {getShiftIcon(shift)}
                                            {getShiftResultIndicator(entry)}
                                            <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(statusState)}`}></span>
                                        </span>
                                        {statusState && (
                                            <span className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                                                {statusState.slice(0, 1)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </button>
            );
        }
        return days;
    }, [currentDate, dateEntries, selectedDate, handleDateSelect, getShiftIcon, getShiftResultIndicator, getStatusDotClass, checkLineValidity]);

    const renderSignatureSection = useCallback(() => {
        if (!currentEntry) return null;

        const signatureKey = getEntryKey(currentEntry.date, currentEntry.lineGroup || DEFAULT_LINE_GROUP, currentEntry.shift);
        const currentDateSigs = dateSignatures[signatureKey] || dateSignatures[currentEntry.date] || {
            preparedBy: '',
            verifiedBy: ''
        };

        const canSignPrepared = canEditCurrentEntry && userRole === 'Operator' && !currentDateSigs.preparedBy;
        const canSignVerified = false;
        const canRemovePrepared = canEditCurrentEntry && currentDateSigs.preparedBy === username;
        const canRemoveVerified = false;

        return (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-semibold mb-3 dark:text-white">
                    Signatures for {new Date(currentEntry.date).toLocaleDateString()} - {getLineGroupLabel(currentEntry.lineGroup || DEFAULT_LINE_GROUP)} Shift {currentEntry.shift}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Prepared By
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={currentDateSigs.preparedBy || ''}
                                readOnly
                                className="md:w-full p-2 rounded-lg text-xs dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 cursor-default"
                                placeholder="Not signed"
                            />
                            {canSignPrepared && (
                                <button
                                    onClick={() => handleSignatureUpdate('prepared')}
                                    className="p-2 text-xs text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
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
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Verified By
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={currentDateSigs.verifiedBy || ''}
                                readOnly
                                className="md:w-full p-2 rounded-lg text-xs dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 cursor-default"
                                placeholder="Not signed"
                            />
                            {canSignVerified && (
                                <button
                                    onClick={() => handleSignatureUpdate('verified')}
                                    className="p-2 text-xs text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
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
    }, [currentEntry, dateSignatures, userRole, username, canEditCurrentEntry, handleSignatureUpdate]);

    const renderJBPositionFields = useCallback((line: '1' | '2', position: 'positiveJB' | 'middleJB' | 'negativeJB', title: string) => {
        if (!currentEntry) return null;
        
        const positionData = currentEntry.lines[line][position];
        const isNetWeightOutOfRange = isNetSealantWeightOutOfRange(positionData.netSealantWeight);
        
        return (
            <div className="border-l-4 border-brand-primary pl-4 mb-4">
                <h5 className="text-sm font-semibold mb-2 dark:text-white">{title}</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            JB Wt (gm)
                        </label>
                        <input
                            type="text"
                            value={positionData.jbWeight}
                            onChange={(e) => handleJBPositionChange(line, position, 'jbWeight', e.target.value)}
                            disabled={!canEditCurrentEntry}
                            className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                            placeholder="Enter JB weight"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            JB Wt with Sealant (gm)
                        </label>
                        <input
                            type="text"
                            value={positionData.jbWeightWithSealant}
                            onChange={(e) => handleJBPositionChange(line, position, 'jbWeightWithSealant', e.target.value)}
                            disabled={!canEditCurrentEntry}
                            className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                            placeholder="Enter JB weight with sealant"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Net Sealant Wt (gm)
                        </label>
                        <input
                            type="text"
                            value={positionData.netSealantWeight}
                            readOnly
                            className={`w-full p-2.5 rounded-lg text-xs border focus:outline-none cursor-default ${
                                isNetWeightOutOfRange
                                    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                                    : 'dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border-gray-200 dark:border-gray-700'
                            }`}
                            placeholder="Auto-calculated"
                        />
                    </div>
                </div>
            </div>
        );
    }, [currentEntry, canEditCurrentEntry, handleJBPositionChange]);

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
                        {SHIFTS.map(shift => <option key={shift} value={shift}>Shift {shift}</option>)}
                    </select>
                    <select
                        value={entryRegisterFilters.line}
                        onChange={(event) => updateFilters({ line: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Line filter"
                    >
                        <option value="">Line</option>
                        {LINE_GROUPS.map(line => <option key={line} value={line}>{getLineGroupLabel(line)}</option>)}
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
                                    <button type="button" onClick={confirmBulkApproveEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                                        <Check className="h-3.5 w-3.5" />
                                        Approve
                                    </button>
                                )}
                                {canBulkDownload && (
                                    <button type="button" onClick={confirmBulkDownloadEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-3 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-900/20">
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </button>
                                )}
                                {canBulkDelete && (
                                    <button type="button" onClick={confirmBulkDeleteEntries} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20">
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                )}
                                <button type="button" onClick={clearEntrySelection} disabled={Boolean(bulkOperationStatus)} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
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
                                            <tr key={entryId || `${entry.date}-${entry.lineGroup}-${entry.shift}-${index}`} className={`${isSelected ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-white dark:bg-gray-900'} text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/70`}>
                                                <td className="whitespace-nowrap px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select entry ${entry.date} ${entry.lineGroup} Shift ${entry.shift}`}
                                                        checked={isSelected}
                                                        disabled={!entryId}
                                                        onChange={(event) => toggleEntrySelection(entry, visibleSelectableEntries, event.currentTarget.checked, event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false)}
                                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{entry.date || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{getLineGroupLabel(normalizeLineGroup(entry.lineGroup))}</td>
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
                                                        <button type="button" onClick={() => openEntryFromRegister(entry, 'view')} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" title="View">
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {permissions.canEdit && (
                                                            <button type="button" onClick={() => openEntryFromRegister(entry, 'edit')} className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover" title="Edit">
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canExport && (
                                                            <button type="button" onClick={() => {
                                                                const entryDate = new Date(`${entry.date}T00:00:00`);
                                                                confirmExportMonthlyExcel(entryDate.getFullYear(), entryDate.getMonth() + 1, normalizeLineGroup(entry.lineGroup));
                                                            }} className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20" title="Download Monthly Excel">
                                                                <Download className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canApprove && (
                                                            <button type="button" onClick={() => confirmApproveEntry(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20" title="Approve">
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canReturn && (
                                                            <button type="button" onClick={() => openReturnModal(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-600 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20" title="Return">
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {permissions.canDelete && (
                                                            <button type="button" onClick={() => confirmDeleteRegisterEntry(entry)} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20" title="Delete">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!permissions.canDelete && isApproved && (
                                                            <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-400 opacity-60 dark:border-gray-700 dark:text-gray-500" title={APPROVED_DELETE_TOOLTIP}>
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
                {returnModalEntry && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
                        <div className="w-full max-w-md rounded-md bg-white p-4 shadow-xl dark:bg-gray-900">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return for Correction</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {returnModalEntry.date} | {getLineGroupLabel(returnModalEntry.lineGroup)} | Shift {returnModalEntry.shift}
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
                                className="w-full p-2.5 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
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
                                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
                                >
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">JB Sealant Weight Measurement</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Allowable Limit: 7 +/- 3 (Range: 4 to 10)</p>
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
                {/*
                    heading="JB Sealant Weight Measurement"
                    criteria="Allowable Limit: 7 ± 3 (Range: 4 to 10)"
                */}
                {showShiftSelector && selectedDate && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold dark:text-white">
                                    {shiftSelectorLineGroup ? 'Select Shift' : 'Select Line'} for {new Date(selectedDate).toLocaleDateString('en-US', {
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

                            {!shiftSelectorLineGroup ? (
                                <div className="space-y-3">
                                    {LINE_GROUPS.map(lineGroup => {
                                        const lineEntries = dateEntries[selectedDate]?.[lineGroup] || {};
                                        const filledCount = SHIFTS.filter(shift => !!lineEntries[shift]).length;
                                        return (
                                            <button
                                                key={lineGroup}
                                                onClick={() => {
                                                    setSelectedLineGroup(lineGroup);
                                                    setShiftSelectorLineGroup(lineGroup);
                                                }}
                                                className="flex w-full items-center justify-between rounded-lg border-2 border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-primary-soft dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10"
                                            >
                                                <span className="font-semibold text-gray-900 dark:text-white">{getLineGroupLabel(lineGroup)}</span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">{filledCount} / 3 shifts</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div>
                                    <button
                                        onClick={() => setShiftSelectorLineGroup(null)}
                                        className="mb-4 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-brand-primary hover:bg-brand-primary-soft dark:text-brand-primary-light dark:hover:bg-brand-primary/10"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        {getLineGroupLabel(shiftSelectorLineGroup)}
                                    </button>
                                    <div className="space-y-3">
                                {SHIFTS.map(shift => {
                                    const entry = dateEntries[selectedDate]?.[shiftSelectorLineGroup]?.[shift];
                                    const isFilled = !!entry;

                                    const line1Validity = entry?.lines['1'] ? checkLineValidity(entry.lines['1']) : { pass: false, fail: false, any: false };
                                    const line2Validity = entry?.lines['2'] ? checkLineValidity(entry.lines['2']) : { pass: false, fail: false, any: false };

                                    let statusClass = 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
                                    if (isFilled) {
                                        if ((line1Validity.pass || line2Validity.pass) && !line1Validity.fail && !line2Validity.fail) {
                                            statusClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                                        } else if (line1Validity.fail || line2Validity.fail) {
                                            statusClass = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                                        } else {
                                            statusClass = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
                                        }
                                    }

                                    return (
                                        <button
                                            key={shift}
                                            onClick={() => handleShiftSelect(shiftSelectorLineGroup, shift)}
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
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 dark:text-gray-500">
                                                        No entry yet
                                                    </div>
                                                )}
                                            </div>
                                            {isFilled && (
                                                <div className="flex-shrink-0">
                                                    {line1Validity.pass && line2Validity.pass && !line1Validity.fail && !line2Validity.fail &&
                                                        <CheckCircle className="w-5 h-5 text-green-500" />}
                                                    {(line1Validity.fail || line2Validity.fail) &&
                                                        <AlertCircle className="w-5 h-5 text-red-500" />}
                                                </div>
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

                {activeTab === 'dashboard' && dashboardView === 'daily' && (
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

                                        {(isOperatorRole || isReviewerLikeRole) && (
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
                                        )}
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
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Within Range (4-10)</span>
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
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-semibold dark:text-white">
                                                    {canEditCurrentEntry ? (isEditing ? 'Edit Entry' : 'New Entry') : 'View Entry'} - {new Date(currentEntry.testingDate).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })} ({getLineGroupLabel(currentEntry.lineGroup || DEFAULT_LINE_GROUP)}, Shift {currentEntry.shift})
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
                                                <button onClick={() => handleExportMonthlyExcel(currentEntry.lineGroup)} className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20" title="Download Monthly Excel">
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
                                            <button
                                                onClick={handleReset}
                                                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                title="Close"
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

                                        {/* Line 1 */}
                                        <div className="border-l-4 border-brand-primary pl-4">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-brand-primary-muted dark:bg-brand-primary/20 flex items-center justify-center text-brand-primary dark:text-brand-primary-light text-sm">1</span>
                                                Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[0]} Details
                                                <LineStatusControl status={getLineStatus(currentEntry.lines['1'])} disabled={!canEditCurrentEntry} onChange={status => handleLineStatusChange('1', status)} />
                                            </h4>
                                            {getLineStatus(currentEntry.lines['1']) === 'OFF' ? <OffLinePlaceholder /> : <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        PO Number
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].po}
                                                        onChange={(e) => handleLineInputChange('1', 'po', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="Enter PO number"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Supplier
                                                    </label>
                                                    <select
                                                        value={currentEntry.lines['1'].jbSupplier}
                                                        onChange={(e) => handleLineInputChange('1', 'jbSupplier', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
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
                                                        value={currentEntry.lines['1'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantSupplier', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
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
                                                        type="date"
                                                        value={currentEntry.lines['1'].sealantExpiry}
                                                        onChange={(e) => handleLineInputChange('1', 'sealantExpiry', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                            </div>
                                            {renderJBPositionFields('1', 'positiveJB', 'Positive JB')}
                                            {renderJBPositionFields('1', 'middleJB', 'Middle JB')}
                                            {renderJBPositionFields('1', 'negativeJB', 'Negative JB')}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Total JB Sealant Wt / Module (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['1'].totalModuleWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[0]})
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['1'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('1', 'remarks', e.target.value)}
                                                        rows={2}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="Add any remarks for Line 1"
                                                    />
                                                </div>
                                            </div>
                                            </>}
                                        </div>
                                        <div className="border-l-4 border-green-500 pl-4 mt-6">
                                            <h4 className="text-md font-semibold mb-3 dark:text-white flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 text-sm">2</span>
                                                Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[1]} Details
                                                <LineStatusControl status={getLineStatus(currentEntry.lines['2'])} disabled={!canEditCurrentEntry} onChange={status => handleLineStatusChange('2', status)} />
                                            </h4>
                                            {getLineStatus(currentEntry.lines['2']) === 'OFF' ? <OffLinePlaceholder /> : <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        PO Number
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].po}
                                                        onChange={(e) => handleLineInputChange('2', 'po', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="Enter PO number"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        JB Supplier
                                                    </label>
                                                    <select
                                                        value={currentEntry.lines['2'].jbSupplier}
                                                        onChange={(e) => handleLineInputChange('2', 'jbSupplier', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
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
                                                        value={currentEntry.lines['2'].sealantSupplier}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantSupplier', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
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
                                                        type="date"
                                                        value={currentEntry.lines['2'].sealantExpiry}
                                                        onChange={(e) => handleLineInputChange('2', 'sealantExpiry', e.target.value)}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="DD.MM.YYYY"
                                                    />
                                                </div>
                                            </div>
                                            {renderJBPositionFields('2', 'positiveJB', 'Positive JB')}
                                            {renderJBPositionFields('2', 'middleJB', 'Middle JB')}
                                            {renderJBPositionFields('2', 'negativeJB', 'Negative JB')}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Total Module Weight (gm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={currentEntry.lines['2'].totalModuleWeight}
                                                        readOnly
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 focus:outline-none cursor-default"
                                                        placeholder="Auto-calculated"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Remarks (Line {getDisplayLineNumbers(currentEntry.lineGroup || DEFAULT_LINE_GROUP)[1]})
                                                    </label>
                                                    <textarea
                                                        value={currentEntry.lines['2'].remarks || ''}
                                                        onChange={(e) => handleLineInputChange('2', 'remarks', e.target.value)}
                                                        rows={2}
                                                        disabled={!canEditCurrentEntry}
                                                        className="w-full p-2.5 rounded-lg text-xs dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-80"
                                                        placeholder="Add any remarks for Line 2"
                                                    />
                                                </div>
                                            </div>
                                            </>}
                                        </div>
                                        {renderSignatureSection()}
                                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={handleReset}
                                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                            >
                                                Close
                                            </button>
                                            {canSaveCurrentEntry && (
                                                <button
                                                    onClick={handleSaveEntry}
                                                    className="flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    {currentWorkflowState === 'submitted' ? 'Save Changes' : 'Save Draft'}
                                                </button>
                                            )}
                                            {canSubmitCurrentEntry && (
                                                <button
                                                    onClick={handleSubmitEntry}
                                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    {currentWorkflowState === 'returned' ? 'Resubmit' : 'Submit'}
                                                </button>
                                            )}
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
                                        <Clock className="w-5 h-5 text-brand-primary" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Monthly Entries</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {monthlyStats.filledEntries}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {monthlyStats.totalPossibleEntries - monthlyStats.filledEntries} missing
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
                                    <Clock className="w-4 h-4 text-brand-primary" />
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
                                                        {stats.filled} / {monthlyStats.totalDays * JB_LINES_PER_SHIFT} lines
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
                                                        className="bg-brand-primary h-2 rounded-full transition-all"
                                                        style={{ width: `${monthlyStats.totalDays > 0 ? (stats.filled / (monthlyStats.totalDays * JB_LINES_PER_SHIFT)) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
                                <h3 className="text-md font-semibold flex items-center gap-2 mb-4 dark:text-white">
                                    <BarChart3 className="w-4 h-4 text-brand-primary" />
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
                                    <TrendingUp className="w-4 h-4 text-brand-primary" />
                                    Weight Range Breakdown
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-green-600">Within Range (4-10)</span>
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
                )}
            </div>
        </>
    );
}
