import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import ReportPagination from '../components/ReportPagination';
import { ReportSortOption } from '../components/ReportListControls';
import { Check, Download, Edit3, Eye, FileSpreadsheet, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { buildWorkflowConfirmOptions, isResolvedCreator, OPERATOR_SIGNATURE_REQUIRED_MESSAGE, resolveCreatorName } from '../utilities/workflowUtils';
import { getPoLineValidationMessage, mapPoToFabLine } from '../utilities/poLineMapping';

type AdhesionWorkflowState = 'draft' | 'submitted' | 'approved' | 'returned';
type AdhesionDisplayStatus = AdhesionWorkflowState;
type AdhesionMainView = 'dashboard' | 'edit-report' | 'saved-reports';
type AdhesionAccessMode = 'edit' | 'view';
type DashboardPeriod = 'daily' | 'weekly' | 'monthly';
type AdhesionSortOption = ReportSortOption | 'status' | 'created-by' | 'shift' | 'date-newest' | 'date-oldest';

interface AdhesionTestReport {
    _id?: string;
    id?: string;
    name: string;
    timestamp: string;
    formData?: { [key: string]: string | boolean; };
    averages?: { [key: string]: string; };
    status?: AdhesionWorkflowState;
    workflowState?: AdhesionWorkflowState;
    displayStatus?: AdhesionDisplayStatus;
    date?: string;
    shift?: string;
    lineNumber?: string;
    productionOrderNo?: string;
    createdBy?: string | null;
    createdByUserId?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
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
    s3_key?: string;
}

interface AdhesionListFilters {
    dateFrom: string;
    dateTo: string;
    shift: string;
    lineNumber: string;
    status: '' | AdhesionWorkflowState;
}

interface DashboardGroupSummary {
    key: string;
    date?: string;
    dayName?: string;
    displayDate?: string;
    totalReports: number;
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
        totalReports: number;
        draft: number;
        submitted: number;
        returned: number;
        approved: number;
    };
    groups: DashboardGroupSummary[];
    items: AdhesionTestReport[];
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
    failed?: Array<{ reportId?: string; reason?: string }>;
    failedCount?: number;
}

interface AdhesionAverages {
    frontMinAvg: string;
    frontMaxAvg: string;
    backMinAvg: string;
    backMaxAvg: string;
}

const FRONT_ADHESION_THRESHOLD = 60;
const BACK_ADHESION_THRESHOLD = 40;

const DEFAULT_ADHESION_AVERAGES: AdhesionAverages = {
    frontMinAvg: '0.00',
    frontMaxAvg: '0.00',
    backMinAvg: '0.00',
    backMaxAvg: '0.00',
};

const ADHESION_FORM_DATA_KEY = 'adhesionTestFormData';
const ADHESION_EDITING_REPORT_ID_KEY = 'adhesionTestEditingReportId';
const ADHESION_EDITING_REPORT_DATA_KEY = 'adhesionTestEditingReportData';
const ADHESION_LOCAL_DRAFT_KEY = 'adhesionTestPersistentDraft';
const ADHESION_LOCAL_DRAFT_ID_KEY = 'adhesionTestPersistentDraftId';
const ADHESION_SESSION_OWNER_KEY = 'adhesionTestSessionOwner';

const clearAdhesionDraftStorage = () => {
    sessionStorage.removeItem(ADHESION_FORM_DATA_KEY);
    sessionStorage.removeItem(ADHESION_EDITING_REPORT_ID_KEY);
    sessionStorage.removeItem(ADHESION_EDITING_REPORT_DATA_KEY);
    sessionStorage.removeItem(ADHESION_SESSION_OWNER_KEY);
};

const clearAdhesionPersistentDraft = () => {
    localStorage.removeItem(ADHESION_LOCAL_DRAFT_KEY);
    localStorage.removeItem(ADHESION_LOCAL_DRAFT_ID_KEY);
};

const cloneAdhesionReport = (report: AdhesionTestReport): AdhesionTestReport => (
    typeof structuredClone === 'function'
        ? structuredClone(report)
        : JSON.parse(JSON.stringify(report))
);

const calculateAdhesionAverage = (keys: string[], values: { [key: string]: string }): string => {
    let sum = 0;
    let count = 0;

    keys.forEach((key) => {
        const value = values[key];
        if (value && value !== '-') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                sum += numValue;
                count++;
            }
        }
    });

    return count > 0 ? (sum / count).toFixed(2) : '0.00';
};

const getAdhesionAverages = (values: { [key: string]: string }): AdhesionAverages => ({
    frontMinAvg: calculateAdhesionAverage(
        ['adhesion_data_0', 'adhesion_data_4', 'adhesion_data_8', 'adhesion_data_12', 'adhesion_data_16'],
        values
    ),
    frontMaxAvg: calculateAdhesionAverage(
        ['adhesion_data_1', 'adhesion_data_5', 'adhesion_data_9', 'adhesion_data_13', 'adhesion_data_17'],
        values
    ),
    backMinAvg: calculateAdhesionAverage(
        ['adhesion_data_2', 'adhesion_data_6', 'adhesion_data_10', 'adhesion_data_14', 'adhesion_data_18'],
        values
    ),
    backMaxAvg: calculateAdhesionAverage(
        ['adhesion_data_3', 'adhesion_data_7', 'adhesion_data_11', 'adhesion_data_15', 'adhesion_data_19'],
        values
    ),
});

const isBelowAdhesionThreshold = (value: string, threshold: number): boolean => {
    if (!value || value === '-') {
        return false;
    }

    const numericValue = parseFloat(value);
    return !isNaN(numericValue) && numericValue < threshold;
};

const getWorkflowState = (report?: Pick<AdhesionTestReport, 'workflowState' | 'status'> | null): AdhesionWorkflowState =>
    report?.workflowState || report?.status || 'submitted';

const formatWorkflowState = (state: AdhesionWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

const sumObjectValues = (values: Record<string, number>) =>
    Object.values(values).reduce((total, count) => total + count, 0);

const FINALIZED_WORKFLOW_STATES = new Set<AdhesionWorkflowState>(['submitted', 'approved']);
const EDITABLE_OPERATOR_WORKFLOW_STATES = new Set<AdhesionWorkflowState>(['draft', 'returned']);
const APPROVED_DELETE_TOOLTIP = 'Approved reports are permanently retained and cannot be deleted.';

export default function AdhesionTest() {
    const [activeTab, setActiveTab] = useState<AdhesionMainView>('dashboard');
    const [dashboardView, setDashboardView] = useState<DashboardPeriod>('daily');
    const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
    const [isDashboardLoading, setIsDashboardLoading] = useState(false);
    const [savedReports, setSavedReports] = useState<AdhesionTestReport[]>([]);
    const [savedReportsTotal, setSavedReportsTotal] = useState(0);
    const [isSavedReportsLoading, setIsSavedReportsLoading] = useState(false);
    const [adhesionReportName, setAdhesionReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentAccessMode, setCurrentAccessMode] = useState<AdhesionAccessMode>('edit');
    const [readOnlyReason, setReadOnlyReason] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentWorkflowState, setCurrentWorkflowState] = useState<AdhesionWorkflowState>('draft');
    const [currentReportMeta, setCurrentReportMeta] = useState<AdhesionTestReport | null>(null);
    const [returnModalReportIndex, setReturnModalReportIndex] = useState<number | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const [savedReportsPage, setSavedReportsPage] = useState(1);
    const [savedReportsPageSize, setSavedReportsPageSize] = useState(20);
    const [savedReportsSearchInput, setSavedReportsSearchInput] = useState('');
    const [savedReportsSearch, setSavedReportsSearch] = useState('');
    const [savedReportsSort, setSavedReportsSort] = useState<AdhesionSortOption>('newest-created');
    const [savedReportsFilters, setSavedReportsFilters] = useState<AdhesionListFilters>({
        dateFrom: '',
        dateTo: '',
        shift: '',
        lineNumber: '',
        status: '',
    });
    const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
    const [selectedReportRecords, setSelectedReportRecords] = useState<Record<string, AdhesionTestReport>>({});
    const [bulkOperationStatus, setBulkOperationStatus] = useState<BulkOperationStatus | null>(null);
    const lastSelectedReportIdRef = useRef<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const ADHESION_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/adhesion-test-reports';
    const [preparedBySignature, setPreparedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');

    // State variables for dropdowns
    const [testDate, setTestDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState<string>('');
    const [laminator, setLaminator] = useState<string>('');
    const [laminationPosition, setLaminationPosition] = useState<string>('');

    // State for lamination parameters
    const [lamParams, setLamParams] = useState({
        lam1: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' },
        lam2: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' },
        lam3: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' }
    });

    // State for all input values
    const [editableValues, setEditableValues] = useState<{ [key: string]: string }>({});
    const [dataValues, setDataValues] = useState<{ [key: string]: string }>({});
    const [averages, setAverages] = useState<AdhesionAverages>({ ...DEFAULT_ADHESION_AVERAGES });

    // Use ref to store the latest values for real-time calculation
    const dataValuesRef = useRef<{ [key: string]: string }>({});
    const isRouteActiveRef = useRef(true);
    const editSessionRef = useRef(0);
    const isHydratingRef = useRef(false);
    const currentReportIdRef = useRef<string | null>(null);
    const currentWorkflowStateRef = useRef<AdhesionWorkflowState>('draft');

    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const isReviewerLikeRole = isReviewerRole || isSystemAdminRole;
    const isCurrentReportOwner = isResolvedCreator(currentReportMeta, { employeeId, username });
    const canCreateReport = isOperatorRole;
    const canEditCurrentReport = currentAccessMode === 'edit' && (
        (isOperatorRole && (!currentReportId || (isCurrentReportOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))))
        || (isReviewerLikeRole && currentReportId !== null && currentWorkflowState === 'submitted')
    );
    const canSaveDraftCurrentReport = currentAccessMode === 'edit'
        && isOperatorRole
        && (!currentReportId || isCurrentReportOwner)
        && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState);
    const canSubmitCurrentReport = isOperatorRole
        && currentAccessMode === 'edit'
        && (!currentReportId || isCurrentReportOwner)
        && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState)
        && preparedBySignature.trim().length > 0;
    const canExportCurrentReport = currentReportId !== null
        && FINALIZED_WORKFLOW_STATES.has(currentWorkflowState)
        && (isOperatorRole || isReviewerLikeRole);
    const canApproveCurrentReport = currentReportId !== null && isReviewerLikeRole && currentWorkflowState === 'submitted';
    const canReturnCurrentReport = currentReportId !== null && isReviewerLikeRole && currentWorkflowState === 'submitted';

    const authHeaders = (includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    });

    const getFriendlyReportError = (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('409') || message.toLowerCase().includes('already exists')) {
            return 'Report name already exists. Please choose another name.';
        }
        return 'Failed to save report';
    };

    const apiService = {
        getAllReports: async (): Promise<AdhesionTestReport[]> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportSummaries: async (params: {
            page: number;
            pageSize: number;
            search?: string;
            sort?: AdhesionSortOption;
            filters?: AdhesionListFilters;
        }): Promise<{ items: AdhesionTestReport[]; total: number; page: number; page_size: number }> => {
            const query = new URLSearchParams({
                summary: 'true',
                page: String(params.page),
                page_size: String(params.pageSize),
                sort: params.sort || 'newest-created',
            });
            if (params.search?.trim()) query.append('search', params.search.trim());
            if (params.filters?.dateFrom) query.append('date_from', params.filters.dateFrom);
            if (params.filters?.dateTo) query.append('date_to', params.filters.dateTo);
            if (params.filters?.shift) query.append('shift', params.filters.shift);
            if (params.filters?.lineNumber) query.append('lineNumber', params.filters.lineNumber);
            if (params.filters?.status) query.append('status', params.filters.status);

            const response = await fetch(`${ADHESION_API_BASE_URL}/?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report summaries: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getDashboard: async (view: DashboardPeriod): Promise<DashboardResponse> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/dashboard?view=${view}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch dashboard: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<AdhesionTestReport, '_id'>): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/`, {
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
        updateReport: async (id: string, report: Omit<AdhesionTestReport, '_id'>): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`, {
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
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${ADHESION_API_BASE_URL}/name/${encodeURIComponent(name)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
            const response = await fetch(url, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
        submitReport: async (id: string, report: Omit<AdhesionTestReport, '_id'>): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}/submit`, {
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
        returnReport: async (id: string, returnComments: string): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}/return`, {
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
        approveReport: async (id: string): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}/approve`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to approve report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        bulkApproveReports: async (reportIds: string[]): Promise<BulkOperationResult> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/bulk/approve`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ reportIds }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to bulk approve reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        bulkDeleteReports: async (reportIds: string[]): Promise<BulkOperationResult> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/bulk/delete`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ reportIds }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to bulk delete reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
    };

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        const storedEmployeeId = sessionStorage.getItem('employeeId');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
        setEmployeeId(storedEmployeeId);
    }, []);

    useEffect(() => {
        currentReportIdRef.current = currentReportId;
    }, [currentReportId]);

    useEffect(() => {
        currentWorkflowStateRef.current = currentWorkflowState;
    }, [currentWorkflowState]);

    useEffect(() => {
        isRouteActiveRef.current = true;
        clearAdhesionDraftStorage();
        clearAdhesionPersistentDraft();
        initializeForm();
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            isRouteActiveRef.current = false;
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearAdhesionDraftStorage();
            clearAdhesionPersistentDraft();
        };
    }, []);

    const initializeForm = () => {
        initializeDataCellsWithHyphens();
    };

    const syncDataValues = (nextDataValues: { [key: string]: string }) => {
        setDataValues(nextDataValues);
        dataValuesRef.current = nextDataValues;
        setAverages(getAdhesionAverages(nextDataValues));
    };

    const initializeDataCellsWithHyphens = () => {
        const initialData: { [key: string]: string } = {};
        for (let i = 0; i <= 19; i++) {
            initialData[`adhesion_data_${i}`] = '-';
        }
        syncDataValues(initialData);
    };

    const calculateAverages = () => {
        setAverages(getAdhesionAverages(dataValuesRef.current));
    };

    // Calculate process time for a specific laminator
    const calculateProcessTime = (pumpingTime: string, pressingTime: string, ventingTime: string): string => {
        const pump = parseFloat(pumpingTime) || 0;
        const press = parseFloat(pressingTime) || 0;
        const vent = parseFloat(ventingTime) || 0;
        const total = pump + press + vent;
        return total.toString();
    };

    // Handle lamination parameter changes
    const handleLamParamChange = (lam: 'lam1' | 'lam2' | 'lam3', field: 'pumpingTime' | 'pressingTime' | 'ventingTime', value: string) => {
        if (!canEditCurrentReport) return;
        setLamParams(prev => {
            const updated = { ...prev };
            updated[lam][field] = value;
            updated[lam].processTime = calculateProcessTime(
                updated[lam].pumpingTime,
                updated[lam].pressingTime,
                updated[lam].ventingTime
            );
            return updated;
        });
        setHasUnsavedChanges(true);
    };

    // Handle editable input changes
    const handleEditableChange = (key: string, value: string) => {
        if (!canEditCurrentReport) return;
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    // Handle data input changes - immediate update with ref for real-time calculation
    const handleDataChange = (key: string, value: string) => {
        if (!canEditCurrentReport) return;
        // Allow empty string, hyphen, or numbers
        if (value === '' || value === '-' || !isNaN(parseFloat(value))) {
            const newValues = { ...dataValuesRef.current, [key]: value };
            syncDataValues(newValues);
            setHasUnsavedChanges(true);
        } else {
            showAlert('error', 'Please enter a valid number');
        }
    };

    // Handle focus on data input - clear hyphen
    const handleDataFocus = (key: string) => {
        if (dataValues[key] === '-') {
            const newValues = { ...dataValuesRef.current, [key]: '' };
            syncDataValues(newValues);
        }
    };

    // Handle blur on data input - set hyphen if empty
    const handleDataBlur = (key: string, value: string) => {
        if (value === '' || value === null || value === undefined) {
            const newValues = { ...dataValuesRef.current, [key]: '-' };
            syncDataValues(newValues);
        }
    };

    useEffect(() => {
        if (adhesionReportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
    }, [adhesionReportName]);

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

    const getReportId = (report?: AdhesionTestReport | null) => report?._id || report?.id || '';

    const getListedReportPermissions = (report: AdhesionTestReport) => {
        const state = getWorkflowState(report);
        const isOwner = isResolvedCreator(report, { employeeId, username });

        return {
            canView: isOperatorRole || isReviewerRole || isSystemAdminRole,
            canEdit: (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state))
                || (isReviewerLikeRole && state === 'submitted'),
            canSubmit: isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state),
            canExport: FINALIZED_WORKFLOW_STATES.has(state) && (isOperatorRole || isReviewerLikeRole),
            canApprove: isReviewerLikeRole && state === 'submitted',
            canReturn: isReviewerLikeRole && state === 'submitted',
            canDelete: state !== 'approved' && (
                isSystemAdminRole
                || (isReviewerRole && state === 'submitted')
                || (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state))
            ),
        };
    };

    const canOpenListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canView;

    const canEditListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canEdit;

    const canExportListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canExport;

    const canDeleteListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canDelete;

    const canReturnListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canReturn;

    const canApproveListedReport = (report: AdhesionTestReport) =>
        getListedReportPermissions(report).canApprove;

    const getReadOnlyReason = (report: AdhesionTestReport) => {
        const state = getWorkflowState(report);
        if (state === 'draft') return 'Draft reports are locked to the creating operator until submission.';
        if (state === 'returned') return 'Returned reports are locked to the creating operator until resubmission.';
        if (state === 'approved') return 'Approved reports are read-only.';
        return 'This report is read-only for your role.';
    };

    const openReportFromList = async (reportMetadata: AdhesionTestReport | undefined, requestedMode: AdhesionAccessMode = 'edit') => {
        try {
            setIsLoading(true);
            if (!reportMetadata) {
                showAlert('error', 'Report not found');
                return;
            }
            if (!canOpenListedReport(reportMetadata)) {
                showAlert('error', 'You are not authorized to open this report');
                return;
            }
            if (!reportMetadata._id) {
                showAlert('error', 'Report ID not found');
                return;
            }
            const fullReport = await apiService.getReportById(reportMetadata._id!);
            const selectedReport = cloneAdhesionReport(fullReport);
            const canEditSelectedReport = canEditListedReport(selectedReport);
            const accessMode: AdhesionAccessMode = requestedMode === 'edit' && canEditSelectedReport ? 'edit' : 'view';
            const editSessionId = editSessionRef.current + 1;
            editSessionRef.current = editSessionId;

            // Start every edit from a clean in-memory session before loading the selected report clone.
            clearFormData();
            sessionStorage.setItem(ADHESION_EDITING_REPORT_DATA_KEY, JSON.stringify(selectedReport));
            sessionStorage.setItem(ADHESION_EDITING_REPORT_ID_KEY, selectedReport._id!);
            setCurrentReportId(selectedReport._id || null);
            currentReportIdRef.current = selectedReport._id || null;
            setCurrentWorkflowState(getWorkflowState(selectedReport));
            currentWorkflowStateRef.current = getWorkflowState(selectedReport);
            setCurrentReportMeta(selectedReport);
            setCurrentAccessMode(accessMode);
            setReadOnlyReason(accessMode === 'view' ? getReadOnlyReason(selectedReport) : '');
            setActiveTab('edit-report');
            setTimeout(() => {
                if (!isRouteActiveRef.current || editSessionRef.current !== editSessionId) return;
                loadReportData(cloneAdhesionReport(selectedReport));
                setHasUnsavedChanges(accessMode === 'edit' && EDITABLE_OPERATOR_WORKFLOW_STATES.has(getWorkflowState(selectedReport)));
            }, 150);
            showAlert('info', `${accessMode === 'view' ? 'Viewing' : 'Opened'}: ${selectedReport.name}`);
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const loadReportData = (report: AdhesionTestReport) => {
        isHydratingRef.current = true;
        const formData = report.formData || {};
        setCurrentReportId(report._id || null);
        currentReportIdRef.current = report._id || null;
        setCurrentWorkflowState(getWorkflowState(report));
        currentWorkflowStateRef.current = getWorkflowState(report);
        setCurrentReportMeta(report);
        setAdhesionReportName(report.name);

        // Load date
        if (formData.testDate !== undefined) {
            setTestDate(formData.testDate as string);
        }

        // Load shift
        if (formData.shift !== undefined) {
            setShift(formData.shift as string);
        }

        // Load laminator
        if (formData.laminator !== undefined) {
            setLaminator(formData.laminator as string);
        }

        // Load lamination position
        if (formData.laminationPosition !== undefined) {
            setLaminationPosition(formData.laminationPosition as string);
        }

        // Load lamination parameters
        if (formData.lamParams !== undefined) {
            const params = JSON.parse(formData.lamParams as string);
            setLamParams(params);
        }

        // Load editable text fields
        const editableInputs: { [key: string]: string } = {};
        for (let i = 0; i <= 33; i++) {
            const key = `adhesion_editable_${i}`;
            if (formData[key] !== undefined) {
                editableInputs[key] = formData[key] as string;
            }
        }
        setEditableValues(editableInputs);

        // Load data cells
        const dataInputs: { [key: string]: string } = {};
        for (let i = 0; i <= 19; i++) {
            const key = `adhesion_data_${i}`;
            if (formData[key] !== undefined) {
                const value = formData[key] as string;
                dataInputs[key] = value || '-';
            } else {
                dataInputs[key] = '-';
            }
        }
        syncDataValues(dataInputs);

        if (formData.preparedBySignature !== undefined) {
            setPreparedBySignature(formData.preparedBySignature as string);
        } else {
            setPreparedBySignature('');
        }

        if (formData.verifiedBySignature !== undefined) {
            setVerifiedBySignature(formData.verifiedBySignature as string);
        } else {
            setVerifiedBySignature('');
        }

        calculateAverages();

        setTimeout(() => {
            isHydratingRef.current = false;
        }, 200);
    };

    const buildCurrentFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        Object.keys(editableValues).forEach(key => {
            formData[key] = editableValues[key];
        });

        Object.keys(dataValuesRef.current).forEach(key => {
            formData[key] = dataValuesRef.current[key] || '-';
        });

        formData.preparedBySignature = preparedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = adhesionReportName;
        formData.testDate = testDate;
        formData.shift = shift;
        formData.laminator = laminator;
        formData.laminationPosition = laminationPosition;
        formData.lamParams = JSON.stringify(lamParams);
        formData.productionOrderNo = editableValues.adhesion_editable_1 || '';
        formData.lineNumber = mapPoToFabLine(editableValues.adhesion_editable_1);

        return formData;
    };

    const buildReportPayload = (): Omit<AdhesionTestReport, '_id'> => {
        const currentAverages = getAdhesionAverages(dataValuesRef.current);
        return {
            name: adhesionReportName.trim(),
            timestamp: currentReportMeta?.timestamp || new Date().toISOString(),
            formData: buildCurrentFormData(),
            averages: { ...currentAverages },
            workflowState: currentWorkflowState,
        };
    };

    const startFreshReport = () => {
        editSessionRef.current += 1;
        // Create Report must be isolated from any previously opened draft/returned/submitted report.
        clearFormData(true, true);
        clearAdhesionDraftStorage();
        setCurrentWorkflowState('draft');
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
        setActiveTab('edit-report');
    };

    const clearFormData = (clearEditingState = true, clearPersistentDraft = false) => {
        isHydratingRef.current = true;
        setEditableValues({});
        
        const initialDataInputs: { [key: string]: string } = {};
        for (let i = 0; i <= 19; i++) {
            initialDataInputs[`adhesion_data_${i}`] = '-';
        }
        syncDataValues(initialDataInputs);

        setPreparedBySignature('');
        setVerifiedBySignature('');
        setTestDate(new Date().toISOString().split('T')[0]);
        setShift('');
        setLaminator('');
        setLaminationPosition('');
        setLamParams({
            lam1: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' },
            lam2: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' },
            lam3: { pumpingTime: '', pressingTime: '', ventingTime: '', processTime: '' }
        });

        if (clearEditingState) {
            setAdhesionReportName('');
            setCurrentReportId(null);
            currentReportIdRef.current = null;
            setCurrentWorkflowState('draft');
            currentWorkflowStateRef.current = 'draft';
            setCurrentReportMeta(null);
            setCurrentAccessMode('edit');
            setReadOnlyReason('');
            sessionStorage.removeItem(ADHESION_EDITING_REPORT_ID_KEY);
            sessionStorage.removeItem(ADHESION_EDITING_REPORT_DATA_KEY);
        }

        setAverages({ ...DEFAULT_ADHESION_AVERAGES });

        if (clearEditingState) {
            sessionStorage.removeItem(ADHESION_FORM_DATA_KEY);
        }
        if (clearPersistentDraft) {
            clearAdhesionPersistentDraft();
        }

        setHasUnsavedChanges(false);

        window.setTimeout(() => {
            isHydratingRef.current = false;
        }, 0);
    };

    const saveDraftReport = async () => {
        if (!canSaveDraftCurrentReport || !canEditCurrentReport) {
            showAlert('error', 'You are not authorized to save this report');
            return;
        }
        if (!adhesionReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }
        const poError = getPoLineValidationMessage(editableValues.adhesion_editable_1);
        if (poError) {
            showAlert('error', poError);
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
                const nameExists = await apiService.checkReportNameExists(adhesionReportName);
                if (nameExists) {
                    showAlert('error', 'Report name already exists. Open it from the saved reports list.');
                    return;
                }
                const createdReport = await apiService.createReport(reportData);
                setCurrentReportId(createdReport._id || null);
                currentReportIdRef.current = createdReport._id || null;
                setCurrentReportMeta(createdReport);
                setCurrentWorkflowState(getWorkflowState(createdReport));
                showAlert('success', 'Draft saved successfully');
            }
            setHasUnsavedChanges(false);
            clearAdhesionDraftStorage();
            clearAdhesionPersistentDraft();
            await refreshAdhesionWorkflow();
        } catch (error) {
            console.error('Error saving draft:', error);
            showAlert('error', getFriendlyReportError(error));
        } finally {
            setIsLoading(false);
        }
    };

    const loadSavedReports = useCallback(async (_showSpinner = true) => {
        try {
            setIsSavedReportsLoading(true);
            const response = await apiService.getReportSummaries({
                page: savedReportsPage,
                pageSize: savedReportsPageSize,
                search: savedReportsSearch,
                sort: savedReportsSort,
                filters: savedReportsFilters,
            });
            setSavedReports(response.items || []);
            setSavedReportsTotal(response.total || 0);
        } catch (error) {
            console.error('Error loading reports:', error);
            showAlert('error', 'Failed to load saved reports');
        } finally {
            setIsSavedReportsLoading(false);
        }
    }, [savedReportsPage, savedReportsPageSize, savedReportsSearch, savedReportsSort, savedReportsFilters]);

    const loadDashboard = useCallback(async () => {
        try {
            setIsDashboardLoading(true);
            const response = await apiService.getDashboard(dashboardView);
            setDashboardData(response);
        } catch (error) {
            console.error('Error loading adhesion dashboard:', error);
            showAlert('error', 'Failed to load dashboard');
        } finally {
            setIsDashboardLoading(false);
        }
    }, [dashboardView]);

    useEffect(() => {
        if (activeTab !== 'saved-reports') return;
        loadSavedReports();
    }, [activeTab, loadSavedReports]);

    useEffect(() => {
        if (activeTab !== 'dashboard') return;
        loadDashboard();
    }, [activeTab, loadDashboard]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setSavedReportsSearch(savedReportsSearchInput);
            setSavedReportsPage(1);
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [savedReportsSearchInput]);

    const refreshAdhesionWorkflow = async () => {
        await loadSavedReports();
        await loadDashboard();
    };

    useEffect(() => {
        const syncAuthScopedState = () => {
            const nextEmployeeId = sessionStorage.getItem('employeeId');
            const nextUsername = sessionStorage.getItem('username');
            const nextUserRole = sessionStorage.getItem('userRole');
            if (employeeId === null && userRole === null) return;
            const identityChanged = nextEmployeeId !== employeeId || nextUserRole !== userRole;

            if (!identityChanged) return;

            clearFormData(true, true);
            clearAdhesionDraftStorage();
            clearAdhesionPersistentDraft();
            setSavedReports([]);
            setEmployeeId(nextEmployeeId);
            setUsername(nextUsername);
            setUserRole(nextUserRole);
            setActiveTab('dashboard');
            if (nextEmployeeId) {
                loadSavedReports(false);
            }
        };

        window.addEventListener('focus', syncAuthScopedState);
        window.addEventListener('pageshow', syncAuthScopedState);
        const authSyncInterval = window.setInterval(syncAuthScopedState, 1000);
        return () => {
            window.removeEventListener('focus', syncAuthScopedState);
            window.removeEventListener('pageshow', syncAuthScopedState);
            window.clearInterval(authSyncInterval);
        };
    }, [employeeId, userRole]);

    const saveReport = async () => {
        if (!canEditCurrentReport) {
            showAlert('error', 'You are not authorized to modify this report');
            return;
        }
        if (!adhesionReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }
        const poError = getPoLineValidationMessage(editableValues.adhesion_editable_1);
        if (poError) {
            showAlert('error', poError);
            return;
        }

        try {
            setIsLoading(true);
            const reportData = buildReportPayload();

            if (currentWorkflowState === 'submitted') {
                if (!currentReportId) {
                    showAlert('error', 'Submitted report ID is missing');
                    return;
                }
                const updatedReport = await apiService.updateReport(currentReportId, reportData);
                setCurrentReportMeta(updatedReport);
                setHasUnsavedChanges(false);
                showAlert('success', 'Report changes saved successfully');
                await refreshAdhesionWorkflow();
                return;
            }

            if (!preparedBySignature.trim()) {
                showAlert('error', OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
                return;
            }

            let reportId = currentReportId;
            if (!reportId) {
                const draftReport = await apiService.createReport(reportData);
                reportId = draftReport._id || null;
                setCurrentReportId(reportId);
                currentReportIdRef.current = reportId;
            } else {
                await apiService.updateReport(reportId, reportData);
            }

            if (!reportId) {
                showAlert('error', 'Unable to submit report without a saved draft ID');
                return;
            }

            const submittedReport = await apiService.submitReport(reportId, reportData);
            setCurrentWorkflowState('submitted');
            currentWorkflowStateRef.current = 'submitted';
            setCurrentReportMeta(submittedReport);
            clearAdhesionDraftStorage();
            clearAdhesionPersistentDraft();
            setHasUnsavedChanges(false);
            await refreshAdhesionWorkflow();
            clearFormData(true, true);
            setActiveTab('saved-reports');
            showAlert('success', currentWorkflowState === 'returned' ? 'Report resubmitted successfully' : 'Report submitted successfully');
        } catch (error) {
            console.error('Error saving report:', error);
            showAlert('error', getFriendlyReportError(error));
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSavedReport = async (report: AdhesionTestReport | undefined) => {
        try {
            if (!report) {
                showAlert('error', 'Report not found');
                return;
            }
            if (!canDeleteListedReport(report)) {
                showAlert('error', 'You are not authorized to delete this report');
                return;
            }
            await apiService.deleteReport(getReportId(report));
            if (report._id === currentReportId) {
                clearFormData(true, true);
            }
            await refreshAdhesionWorkflow();
            clearReportSelection();
            showAlert('info', 'Report deleted successfully');
        } catch (error) {
            console.error('Error deleting report:', error);
            showAlert('error', 'Failed to delete report');
        }
    };

    const exportToExcel = async () => {
        try {
            if (!currentReportId || !canExportCurrentReport) {
                showAlert('error', 'Report can be generated only for submitted or approved reports');
                return;
            }
            showAlert('info', 'Please wait! Exporting report will take some time...');

            const response = await fetch(`${ADHESION_API_BASE_URL}/generate-adhesion-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: currentReportId }),
            });

            if (!response.ok) throw new Error('Failed to generate report');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${adhesionReportName.trim() || 'Adhesion_Test_Report'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Report exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export report');
        }
    };

    const exportSavedReportToExcel = async (report: AdhesionTestReport | undefined) => {
        try {
            if (!report) {
                showAlert('error', 'Report not found');
                return;
            }
            if (!canExportListedReport(report)) {
                showAlert('error', 'Excel can be generated only for submitted or approved reports');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const response = await fetch(`${ADHESION_API_BASE_URL}/generate-adhesion-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: getReportId(report) }),
            });

            if (!response.ok) throw new Error('Failed to generate report');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report.name}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('success', 'Report exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export report');
        }
    };

    const confirmExportToExcel = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'report',
            onConfirm: exportToExcel,
        }));
    };

    const confirmExportSavedReportToExcel = (report: AdhesionTestReport) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'report',
            onConfirm: () => exportSavedReportToExcel(report),
        }));
    };

    const openReturnModal = (index: number) => {
        if (index < 0 || index >= savedReports.length) {
            showAlert('error', 'Report not found');
            return;
        }

        const report = savedReports[index];
        if (!canReturnListedReport(report)) {
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
            await refreshAdhesionWorkflow();
            clearReportSelection();
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

    useEffect(() => {
        if (adhesionReportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
    }, [adhesionReportName]);

    const editableFieldKeys = [
        'adhesion_editable_0',  // Type of Test
        'adhesion_editable_1',  // P.O.
        'adhesion_editable_2',  // Room Temp
        'adhesion_editable_3',  // RH %
        'adhesion_editable_4',  // Set Temp Lam-1
        'adhesion_editable_5',  // Set Temp Lam-2
        'adhesion_editable_6',  // Set Temp Lam-3
        'adhesion_editable_7',  // Pumping time Lam-1 (handled separately)
        'adhesion_editable_8',  // Pumping time Lam-2 (handled separately)
        'adhesion_editable_9',  // Pumping time Lam-3 (handled separately)
        'adhesion_editable_10', // Pressing time Lam-1 (handled separately)
        'adhesion_editable_11', // Pressing time Lam-2 (handled separately)
        'adhesion_editable_12', // Pressing time Lam-3 (handled separately)
        'adhesion_editable_13', // Venting time Lam-1 (handled separately)
        'adhesion_editable_14', // Venting time Lam-2 (handled separately)
        'adhesion_editable_15', // Venting time Lam-3 (handled separately)
        'adhesion_editable_16', // Process time Lam-1 (auto-calculated)
        'adhesion_editable_17', // Process time Lam-2 (auto-calculated)
        'adhesion_editable_18', // Process time Lam-3 (auto-calculated)
        'adhesion_editable_19', // Front Encapsulant Supplier
        'adhesion_editable_20', // Front Encapsulant Type
        'adhesion_editable_21', // Back Encapsulant Supplier
        'adhesion_editable_22', // Back Encapsulant Type
        'adhesion_editable_23', // Back Sheet Supplier
        'adhesion_editable_24', // Glass Supplier
        'adhesion_editable_25', // Glass Size
    ];

    const getOpenActionLabel = (report: AdhesionTestReport) => {
        const state = getWorkflowState(report);
        const isOwner = isResolvedCreator(report, { employeeId, username });
        if (isOperatorRole && (!isOwner || FINALIZED_WORKFLOW_STATES.has(state))) return 'View';
        return canEditListedReport(report) ? (isOperatorRole ? 'Continue' : 'Edit') : 'View';
    };

    const getDisplayStatus = (report: AdhesionTestReport): AdhesionDisplayStatus =>
        report.displayStatus || getWorkflowState(report);

    const getStateBadgeClass = (state: AdhesionDisplayStatus) => {
        if (state === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
        if (state === 'submitted') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200';
        if (state === 'returned') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    };

    const getCreatedByLabel = (report: AdhesionTestReport) => resolveCreatorName(report);

    const getLineLabel = (lineNumber?: string | null) => {
        return lineNumber || 'Unmapped';
    };

    const clearReportSelection = useCallback(() => {
        setSelectedReportIds(new Set());
        setSelectedReportRecords({});
        lastSelectedReportIdRef.current = null;
    }, []);

    const setReportSelection = (report: AdhesionTestReport, selected: boolean) => {
        const reportId = getReportId(report);
        if (!reportId) return;

        setSelectedReportIds(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(reportId);
            } else {
                next.delete(reportId);
            }
            return next;
        });

        setSelectedReportRecords(prev => {
            const next = { ...prev };
            if (selected) {
                next[reportId] = report;
            } else {
                delete next[reportId];
            }
            return next;
        });
    };

    const setVisibleReportSelection = (visibleReports: AdhesionTestReport[], selected: boolean) => {
        setSelectedReportIds(prev => {
            const next = new Set(prev);
            visibleReports.forEach(report => {
                const reportId = getReportId(report);
                if (!reportId) return;
                if (selected) {
                    next.add(reportId);
                } else {
                    next.delete(reportId);
                }
            });
            return next;
        });

        setSelectedReportRecords(prev => {
            const next = { ...prev };
            visibleReports.forEach(report => {
                const reportId = getReportId(report);
                if (!reportId) return;
                if (selected) {
                    next[reportId] = report;
                } else {
                    delete next[reportId];
                }
            });
            return next;
        });
    };

    const toggleReportSelection = (
        report: AdhesionTestReport,
        visibleReports: AdhesionTestReport[],
        selected: boolean,
        shiftKey: boolean
    ) => {
        const reportId = getReportId(report);
        if (!reportId) return;

        if (shiftKey && lastSelectedReportIdRef.current) {
            const visibleIds = visibleReports.map(getReportId);
            const lastIndex = visibleIds.indexOf(lastSelectedReportIdRef.current);
            const currentIndex = visibleIds.indexOf(reportId);
            if (lastIndex >= 0 && currentIndex >= 0) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                setVisibleReportSelection(visibleReports.slice(start, end + 1), selected);
                lastSelectedReportIdRef.current = reportId;
                return;
            }
        }

        setReportSelection(report, selected);
        lastSelectedReportIdRef.current = reportId;
    };

    const getSelectedReports = () =>
        Object.values(selectedReportRecords).filter(report => selectedReportIds.has(getReportId(report)));

    const getBulkFailureCount = (result: BulkOperationResult) =>
        result.failedCount ?? result.failed?.length ?? 0;

    const getBulkStatusLabel = (report: AdhesionTestReport) =>
        formatWorkflowState(getWorkflowState(report));

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
            lines.push(`${eligibilityNote} ${skippedCount} selected ${skippedCount === 1 ? 'report was' : 'reports were'} skipped.`);
        }
        Object.entries(result.skipped || {}).forEach(([reason, count]) => {
            lines.push(reason === 'Already Approved' ? `${count} ${reason}` : `${count} ${reason} Skipped`);
        });
        const failedCount = getBulkFailureCount(result);
        if (failedCount > 0) {
            lines.push(`${failedCount} Failed. See console for details.`);
        }
        return lines.join(' | ');
    };

    const approveReport = async (report: AdhesionTestReport | undefined) => {
        if (!report) {
            showAlert('error', 'Report not found');
            return;
        }
        if (!canApproveListedReport(report)) {
            showAlert('error', 'You are not authorized to approve this report');
            return;
        }

        try {
            setIsLoading(true);
            const approved = await apiService.approveReport(getReportId(report));
            if (currentReportId === getReportId(report)) {
                setCurrentWorkflowState('approved');
                currentWorkflowStateRef.current = 'approved';
                setCurrentReportMeta(prev => prev ? { ...prev, ...approved, workflowState: 'approved', status: 'approved' } : prev);
                setCurrentAccessMode('view');
                setReadOnlyReason('Approved reports are read-only.');
            }
            await refreshAdhesionWorkflow();
            showAlert('success', 'Report approved');
        } catch (error) {
            console.error('Error approving report:', error);
            showAlert('error', 'Failed to approve report');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmApproveReport = (report: AdhesionTestReport | undefined) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            noun: 'report',
            onConfirm: () => approveReport(report),
        }));
    };

    const confirmDeleteSavedReport = (report: AdhesionTestReport) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'report',
            onConfirm: () => deleteSavedReport(report),
        }));
    };

    const runBulkApproveReports = async () => {
        const selectedReports = getSelectedReports();
        const reportIds = selectedReports.map(getReportId).filter(Boolean);
        if (reportIds.length === 0) return;

        try {
            setBulkOperationStatus({ action: 'Approving...', completed: 0, total: reportIds.length });
            const result = await apiService.bulkApproveReports(reportIds);
            setBulkOperationStatus({ action: 'Approving...', completed: reportIds.length, total: reportIds.length });
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk approval failures', result.failed);
            }
            await refreshAdhesionWorkflow();
            clearReportSelection();
            const approved = result.approved ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary(
                    'Bulk Approval Completed',
                    'Approved',
                    approved,
                    result,
                    'Only Submitted reports can be approved.'
                )
            );
        } catch (error) {
            console.error('Error bulk approving reports:', error);
            showAlert('error', 'Bulk approval failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDeleteReports = async () => {
        const selectedReports = getSelectedReports();
        const deletableReports = selectedReports.filter(canDeleteListedReport);
        const reportIds = deletableReports.map(getReportId).filter(Boolean);
        if (reportIds.length === 0) return;

        try {
            setBulkOperationStatus({ action: 'Deleting...', completed: 0, total: reportIds.length });
            const result = await apiService.bulkDeleteReports(reportIds);
            setBulkOperationStatus({ action: 'Deleting...', completed: reportIds.length, total: reportIds.length });
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk delete failures', result.failed);
            }
            await refreshAdhesionWorkflow();
            clearReportSelection();
            const deleted = result.deleted ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Delete Completed', 'Deleted', deleted, result)
            );
        } catch (error) {
            console.error('Error bulk deleting reports:', error);
            showAlert('error', 'Bulk delete failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const runBulkDownloadReports = async () => {
        const selectedReports = getSelectedReports();
        if (selectedReports.length === 0) return;

        const result: BulkOperationResult = { requested: selectedReports.length, downloaded: 0, skipped: {}, failed: [] };
        try {
            setBulkOperationStatus({ action: 'Generating report...', completed: 0, total: selectedReports.length });
            for (let index = 0; index < selectedReports.length; index += 1) {
                const report = selectedReports[index];
                const reportId = getReportId(report);
                if (!canExportListedReport(report)) {
                    const reason = getBulkStatusLabel(report);
                    result.skipped![reason] = (result.skipped![reason] || 0) + 1;
                } else {
                    try {
                        await exportSavedReportToExcel(report);
                        result.downloaded = (result.downloaded || 0) + 1;
                    } catch (error) {
                        result.failed!.push({
                            reportId,
                            reason: error instanceof Error ? error.message : 'Download failed',
                        });
                    }
                }
                setBulkOperationStatus({ action: 'Generating report...', completed: index + 1, total: selectedReports.length });
                await new Promise(resolve => window.setTimeout(resolve, 0));
            }
            result.skippedCount = sumObjectValues(result.skipped || {});
            result.failedCount = getBulkFailureCount(result);
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk download failures', result.failed);
            }
            clearReportSelection();
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Download Completed', 'Downloaded', result.downloaded || 0, result)
            );
        } catch (error) {
            console.error('Error bulk downloading reports:', error);
            showAlert('error', 'Bulk download failed. Please try again.');
        } finally {
            setBulkOperationStatus(null);
        }
    };

    const confirmBulkApproveReports = () => {
        const selectedCount = selectedReportIds.size;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkApproveReports,
        }));
    };

    const confirmBulkDeleteReports = () => {
        const selectedCount = getSelectedReports().filter(canDeleteListedReport).length;
        if (selectedCount === 0) return;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkDeleteReports,
        }));
    };

    const confirmBulkDownloadReports = () => {
        const selectedCount = selectedReportIds.size;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkDownloadReports,
        }));
    };

    useEffect(() => {
        clearReportSelection();
    }, [activeTab, savedReportsFilters, savedReportsSearchInput, clearReportSelection]);

    useEffect(() => {
        if (selectedReportIds.size === 0) return;
        setSelectedReportRecords(prev => {
            let hasChanges = false;
            const next = { ...prev };
            savedReports.forEach(report => {
                const reportId = getReportId(report);
                if (reportId && selectedReportIds.has(reportId)) {
                    next[reportId] = report;
                    hasChanges = true;
                }
            });
            return hasChanges ? next : prev;
        });
    }, [savedReports, selectedReportIds]);

    const renderAdhesionReportsList = () => {
        const updateFilters = (patch: Partial<AdhesionListFilters>) => {
            setSavedReportsFilters(prev => ({ ...prev, ...patch }));
            setSavedReportsPage(1);
            clearReportSelection();
        };

        const resetFilters = () => {
            setSavedReportsFilters({
                dateFrom: '',
                dateTo: '',
                shift: '',
                lineNumber: '',
                status: '',
            });
            setSavedReportsSearchInput('');
            setSavedReportsPage(1);
            clearReportSelection();
        };

        const visibleSelectableReports = savedReports.filter(report => Boolean(getReportId(report)));
        const visibleSelectedCount = visibleSelectableReports.filter(report =>
            selectedReportIds.has(getReportId(report))
        ).length;
        const allVisibleSelected = visibleSelectableReports.length > 0
            && visibleSelectedCount === visibleSelectableReports.length;
        const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleSelectableReports.length;
        const selectedReportsForBulk = getSelectedReports();
        const selectedCount = selectedReportIds.size;
        const selectedCountLabel = `${selectedCount} ${selectedCount === 1 ? 'report' : 'reports'} selected`;
        const canBulkApprove = selectedReportsForBulk.some(canApproveListedReport);
        const canBulkDelete = selectedReportsForBulk.some(canDeleteListedReport);
        const canBulkDownload = selectedReportsForBulk.some(canExportListedReport);

        return (
            <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adhesion Reports</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{savedReportsTotal} reports</span>
                </div>

                <div className="mb-2 grid gap-2 md:grid-cols-5 xl:grid-cols-8">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            value={savedReportsSearchInput}
                            onChange={(event) => {
                                setSavedReportsSearchInput(event.target.value);
                                setSavedReportsPage(1);
                                clearReportSelection();
                            }}
                            placeholder="Search report name, production order, creator, shift, date, line, status"
                            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </label>
                    <input
                        type="date"
                        value={savedReportsFilters.dateFrom}
                        onChange={(event) => updateFilters({ dateFrom: event.target.value, dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date from"
                    />
                    <input
                        type="date"
                        value={savedReportsFilters.dateTo}
                        onChange={(event) => updateFilters({ dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date to"
                    />
                    <select
                        value={savedReportsFilters.shift}
                        onChange={(event) => updateFilters({ shift: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Shift filter"
                    >
                        <option value="">Shift</option>
                        <option value="A">Shift A</option>
                        <option value="B">Shift B</option>
                        <option value="C">Shift C</option>
                        <option value="G">Shift G</option>
                    </select>
                    <select
                        value={savedReportsFilters.lineNumber}
                        onChange={(event) => updateFilters({ lineNumber: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Line filter"
                    >
                        <option value="">Line</option>
                        <option value="FAB-II Line-I">FAB-II Line-I</option>
                        <option value="FAB-II Line-II">FAB-II Line-II</option>
                        <option value="Unmapped">Unmapped</option>
                    </select>
                    <select
                        value={savedReportsFilters.status}
                        onChange={(event) => updateFilters({ status: event.target.value as AdhesionListFilters['status'] })}
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
                        value={savedReportsSort}
                        onChange={(event) => {
                            setSavedReportsSort(event.target.value as AdhesionSortOption);
                            setSavedReportsPage(1);
                        }}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Sort reports"
                    >
                        <option value="newest-created">Newest</option>
                        <option value="oldest-created">Oldest</option>
                        <option value="newest-updated">Updated</option>
                        <option value="status">Status</option>
                        <option value="created-by">Created By</option>
                        <option value="shift">Shift</option>
                        <option value="date-newest">Date</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="h-9 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        Clear Filters
                    </button>
                </div>

                {selectedCount > 0 && (
                    <div className="mb-3 rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3 dark:border-brand-primary/40 dark:bg-brand-primary/10">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedCountLabel}</div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canBulkApprove && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkApproveReports}
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
                                        onClick={confirmBulkDownloadReports}
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
                                        onClick={confirmBulkDeleteReports}
                                        disabled={Boolean(bulkOperationStatus)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={clearReportSelection}
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

                {isSavedReportsLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading reports...</div>
                ) : savedReports.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {savedReportsTotal === 0 ? 'No adhesion reports found.' : 'No matching adhesion reports found.'}
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
                                                aria-label="Select all visible adhesion reports"
                                                checked={allVisibleSelected}
                                                disabled={visibleSelectableReports.length === 0}
                                                ref={(element) => {
                                                    if (element) element.indeterminate = someVisibleSelected;
                                                }}
                                                onChange={(event) => setVisibleReportSelection(visibleSelectableReports, event.currentTarget.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                            />
                                        </th>
                                        {['Shift', 'Line', 'Production Order', 'Report Name', 'Date', 'Created By', 'Status', 'Actions'].map(column => (
                                            <th key={column} className="border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {savedReports.map((report, index) => {
                                        const displayStatus = getDisplayStatus(report);
                                        const canOpen = canOpenListedReport(report);
                                        const canEdit = canEditListedReport(report);
                                        const canExport = canExportListedReport(report);
                                        const canApprove = canApproveListedReport(report);
                                        const canReturn = canReturnListedReport(report);
                                        const canDelete = canDeleteListedReport(report);
                                        const isApproved = getWorkflowState(report) === 'approved';
                                        const reportId = getReportId(report);
                                        const isSelected = reportId ? selectedReportIds.has(reportId) : false;

                                        return (
                                            <tr
                                                key={reportId || `${report.name}-${index}`}
                                                className={`${isSelected ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-white dark:bg-gray-900'} text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/70`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select adhesion report ${report.productionOrderNo || report.name || reportId}`}
                                                        checked={isSelected}
                                                        disabled={!reportId}
                                                        onChange={(event) => toggleReportSelection(
                                                            report,
                                                            visibleSelectableReports,
                                                            event.currentTarget.checked,
                                                            event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false
                                                        )}
                                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{report.shift || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{getLineLabel(report.lineNumber)}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left font-medium">{report.productionOrderNo || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left font-medium">{report.name || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{report.date || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{getCreatedByLabel(report)}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(displayStatus)}`}>
                                                        {formatWorkflowState(displayStatus)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => canOpen && openReportFromList(report, 'view')}
                                                            disabled={!canOpen}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            title="View"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openReportFromList(report, 'edit')}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover"
                                                                title={getOpenActionLabel(report)}
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canExport && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmExportSavedReportToExcel(report)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                                                title="Download"
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canApprove && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmApproveReport(report)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                                                title="Approve"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canReturn && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openReturnModal(index)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-600 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                                                title="Return"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDeleteSavedReport(report)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!canDelete && isApproved && (
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
                            totalItems={savedReportsTotal}
                            page={savedReportsPage}
                            pageSize={savedReportsPageSize}
                            onPageChange={setSavedReportsPage}
                            onPageSizeChange={(nextPageSize) => {
                                setSavedReportsPageSize(nextPageSize);
                                setSavedReportsPage(1);
                            }}
                            itemLabel="reports"
                        />
                    </>
                )}
            </div>
        );
    };

    const renderDashboardReportCard = (report: AdhesionTestReport) => {
        const status = getDisplayStatus(report);

        return (
            <div key={getReportId(report) || report.name} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift {report.shift || '-'}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {report.date || '-'} | {getLineLabel(report.lineNumber)}
                        </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(status)}`}>
                        {formatWorkflowState(status)}
                    </span>
                </div>
                <div className="grid gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <div className="truncate">Report: {report.name || '-'}</div>
                    <div className="truncate">PO: {report.productionOrderNo || '-'}</div>
                    <div className="truncate">Created by: {getCreatedByLabel(report)}</div>
                </div>
            </div>
        );
    };

    const renderDashboard = () => {
        const summary = dashboardData?.summary || {
            totalReports: 0,
            draft: 0,
            submitted: 0,
            returned: 0,
            approved: 0,
        };
        const reportsByShift = (dashboardData?.items || []).reduce<Record<string, AdhesionTestReport[]>>((groups, report) => {
            const key = report.shift || 'Unassigned';
            groups[key] = groups[key] || [];
            groups[key].push(report);
            return groups;
        }, {});
        const shiftKeys = ['A', 'B', 'C', 'G', ...Object.keys(reportsByShift).filter(shift => !['A', 'B', 'C', 'G'].includes(shift))];

        return (
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

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                        [dashboardView === 'daily' ? "Today's Reports" : dashboardView === 'weekly' ? 'Last 7 Days Reports' : 'Monthly Reports', summary.totalReports],
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

                {isDashboardLoading ? (
                    <div className="rounded-md border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                        Loading dashboard...
                    </div>
                ) : dashboardView === 'daily' ? (
                    <div className="space-y-3">
                        {shiftKeys.map(shift => {
                            const items = reportsByShift[shift] || [];
                            return (
                                <section key={shift} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift {shift}</h3>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{items.length} reports</span>
                                    </div>
                                    {items.length === 0 ? (
                                        <div className="py-4 text-sm text-gray-500 dark:text-gray-400">No reports for this shift.</div>
                                    ) : (
                                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                            {items.map(renderDashboardReportCard)}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Day</th>
                                    <th className="px-3 py-2 text-left font-semibold">Total Reports</th>
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
                                            {group.dayName ? (
                                                <div>
                                                    <div>{group.dayName}</div>
                                                    <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{group.displayDate || group.date}</div>
                                                </div>
                                            ) : group.key}
                                        </td>
                                        <td className="px-3 py-2 text-left">{group.totalReports}</td>
                                        <td className="px-3 py-2 text-left">{group.draft}</td>
                                        <td className="px-3 py-2 text-left">{group.submitted}</td>
                                        <td className="px-3 py-2 text-left">{group.approved}</td>
                                        <td className="px-3 py-2 text-left">{group.returned}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="mx-auto">
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
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
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Adhesion Test</h1>
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
                        {canCreateReport && (
                            <button
                                type="button"
                                onClick={startFreshReport}
                                className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                    activeTab === 'edit-report'
                                        ? 'bg-brand-primary text-white'
                                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                }`}
                            >
                                <Plus className="h-4 w-4" />
                                Create
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab('saved-reports')}
                            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                activeTab === 'saved-reports'
                                    ? 'bg-brand-primary text-white'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                        >
                            <Search className="h-4 w-4" />
                            Report List
                        </button>
                    </div>
                </div>

                {activeTab === 'dashboard' && (
                    <div className="tab-content active">
                        {renderDashboard()}
                    </div>
                )}

                {activeTab === 'edit-report' && (
                    <div className="tab-content active">
                        {currentWorkflowState === 'returned' && currentReportMeta?.returnComments && (
                            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                                <strong>Returned for correction:</strong> {currentReportMeta.returnComments}
                                <div className="mt-1 text-xs">
                                    Returned by {currentReportMeta.returnedBy || '-'} on {formatTimestamp(currentReportMeta.returnedAt)}
                                </div>
                            </div>
                        )}
                        <div className="save-actions flex flex-col sm:flex-row justify-center items-center gap-3.5">
                            <input
                                type="text"
                                value={adhesionReportName}
                                onChange={(e) => setAdhesionReportName(e.target.value)}
                                className="adhesion-report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-brand-primary/30 dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                placeholder="Enter report name"
                                disabled={!canEditCurrentReport}
                            />
                            {canSaveDraftCurrentReport && canEditCurrentReport && (
                                <button
                                    className="save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-slate-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                    onClick={saveDraftReport}
                                >
                                    Save Draft
                                </button>
                            )}
                            {canEditCurrentReport && (
                                <button
                                    className={`save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 font-semibold transition-all duration-300 ease-in-out text-white text-sm ${currentWorkflowState !== 'submitted' && !canSubmitCurrentReport ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary cursor-pointer hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg'}`}
                                    onClick={saveReport}
                                    disabled={currentWorkflowState !== 'submitted' && !canSubmitCurrentReport}
                                >
                                    {currentWorkflowState === 'submitted' ? 'Save Changes' : currentWorkflowState === 'returned' ? 'Resubmit Report' : 'Submit Report'}
                                </button>
                            )}
                            {canExportCurrentReport && (
                                <button
                                    className="save-btn export-excel w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-green-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                    onClick={confirmExportToExcel}
                                >
                                    Download
                                </button>
                            )}
                            {canApproveCurrentReport && (
                                <button
                                    className="save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-emerald-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                    onClick={() => confirmApproveReport(currentReportMeta || undefined)}
                                >
                                    Approve Report
                                </button>
                            )}
                            {canReturnCurrentReport && (
                                <button
                                    className="save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-amber-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                    onClick={() => {
                                        const index = savedReports.findIndex(report => report._id === currentReportId);
                                        if (index >= 0) openReturnModal(index);
                                    }}
                                >
                                    Return for Correction
                                </button>
                            )}
                        </div>
                        <div className="test-report-container overflow-hidden bg-white dark:bg-gray-900 p-1 mt-2 rounded-md shadow-lg custom-scrollbar">
                            {currentAccessMode === 'view' && readOnlyReason && (
                                <div className="mb-3 rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                    {readOnlyReason}
                                </div>
                            )}
                            <fieldset disabled={!canEditCurrentReport} className={!canEditCurrentReport ? 'w-full min-w-0 opacity-90' : 'w-full min-w-0'}>
                                <div className="w-full overflow-x-auto rounded-md border border-gray-300 custom-scrollbar dark:border-gray-700">
                                <table ref={tableRef} className="w-full border-collapse min-w-[1000px]">
                                    <tbody>
                                        <tr>
                                            <td rowSpan={3} className="p-2 bg-gray-100 dark:bg-gray-700">
                                                <img src="../LOGOS/VSL_Logo (1).png" alt="VSL Logo" className="mx-auto w-48 h-16" />
                                            </td>
                                            <td colSpan={7} rowSpan={2} className="section-title text-xl sm:text-2xl md:text-3xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                VIKRAM SOLAR LIMITED
                                            </td>
                                            <td colSpan={6} rowSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Doc. No.: VSL/QAD/FM/68
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Issue Date: 20.06.2019
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={7} className="section-title text-lg sm:text-xl md:text-2xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                ADHESION TEST REPORT
                                            </td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Rev. No./ Date: 04/ 17.10.2025
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={8}>
                                                <div className="allowable-limit p-2.5 bg-gray-50 dark:bg-gray-900 border-l-4 border-l-brand-primary dark:border-l-brand-primary-light text-left">
                                                    <strong className="text-gray-800 dark:text-white">Allowable Limit:</strong>
                                                    <span className="text-gray-700 dark:text-gray-300"> (Glass to Encapsulant ≥ 60N/cm & Backsheet to Encapsulant ≥ 40N/cm)</span>
                                                </div>
                                            </td>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Type of Test:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[0]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[0], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Type of Test"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Date:</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="date"
                                                    value={testDate}
                                                    onChange={(e) => {
                                                        setTestDate(e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Shift:</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={shift}
                                                    onChange={(e) => {
                                                        setShift(e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Shift</option>
                                                    <option value="A">A</option>
                                                    <option value="B">B</option>
                                                    <option value="C">C</option>
                                                    <option value="G">G</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">P.O.:</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[1]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[1], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="P.O."
                                                />
                                                <p className={`mt-1 text-xs ${getPoLineValidationMessage(editableValues[editableFieldKeys[1]]) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    FAB Line (derived): {mapPoToFabLine(editableValues[editableFieldKeys[1]])}
                                                </p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Room Temp (°C):</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[2]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[2], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Room Temp"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">RH %:</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[3]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[3], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="RH %"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Laminator:</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={laminator}
                                                    onChange={(e) => {
                                                        setLaminator(e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Laminator</option>
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                                        <Fragment key={num}>
                                                            <option value={`${num} (Lower)`}>{num} (Lower)</option>
                                                            <option value={`${num} (Upper)`}>{num} (Upper)</option>
                                                        </Fragment>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lamination Position:</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={laminationPosition}
                                                    onChange={(e) => {
                                                        setLaminationPosition(e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Position</option>
                                                    <option value="A">A</option>
                                                    <option value="B">B</option>
                                                    <option value="C">C</option>
                                                    <option value="D">D</option>
                                                    <option value="E">E</option>
                                                    <option value="F">F</option>
                                                    <option value="G">G</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">LAMINATION PARAMETER</td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Chamber :</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 1</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 2</td>
                                            <td colSpan={5} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 3</td>
                                        </tr>

                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Set Temp. (°C) :</td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[4]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[4], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Set Temp Lam-1"
                                                />
                                            </td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[5]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[5], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Set Temp Lam-2"
                                                />
                                            </td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[6]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[6], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Set Temp Lam-3"
                                                />
                                            </td>
                                        </tr>

                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pumping time (Sec) :</td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam1.pumpingTime}
                                                    onChange={(e) => handleLamParamChange('lam1', 'pumpingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping time"
                                                />
                                            </td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam2.pumpingTime}
                                                    onChange={(e) => handleLamParamChange('lam2', 'pumpingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping time"
                                                />
                                            </td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam3.pumpingTime}
                                                    onChange={(e) => handleLamParamChange('lam3', 'pumpingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping time"
                                                />
                                            </td>
                                        </tr>

                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pressing /Cooling time (Sec) :</td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam1.pressingTime}
                                                    onChange={(e) => handleLamParamChange('lam1', 'pressingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling time"
                                                />
                                            </td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam2.pressingTime}
                                                    onChange={(e) => handleLamParamChange('lam2', 'pressingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling time"
                                                />
                                            </td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam3.pressingTime}
                                                    onChange={(e) => handleLamParamChange('lam3', 'pressingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling time"
                                                />
                                            </td>
                                        </tr>

                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Venting time (Sec) :</td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam1.ventingTime}
                                                    onChange={(e) => handleLamParamChange('lam1', 'ventingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting time"
                                                />
                                            </td>
                                            <td colSpan={4}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam2.ventingTime}
                                                    onChange={(e) => handleLamParamChange('lam2', 'ventingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting time"
                                                />
                                            </td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={lamParams.lam3.ventingTime}
                                                    onChange={(e) => handleLamParamChange('lam3', 'ventingTime', e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting time"
                                                />
                                            </td>
                                        </tr>

                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Process time (Sec) :</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-50 dark:bg-gray-800 dark:text-white font-bold">
                                                {lamParams.lam1.processTime || '-'}
                                            </td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-50 dark:bg-gray-800 dark:text-white font-bold">
                                                {lamParams.lam2.processTime || '-'}
                                            </td>
                                            <td colSpan={5} className="p-2 text-center bg-gray-50 dark:bg-gray-800 dark:text-white font-bold">
                                                {lamParams.lam3.processTime || '-'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">RAW MATERIAL DETAILS</td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Encapsulant Supplier :</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={editableValues[editableFieldKeys[19]] || ''}
                                                    onChange={(e) => {
                                                        handleEditableChange(editableFieldKeys[19], e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Front Encapsulant Supplier</option>
                                                    <option value="Hangzhou First PV Material Co., Ltd">Hangzhou First PV Material Co., Ltd</option>
                                                    <option value="Vietnam Advance Film Material Company Ltd">Vietnam Advance Film Material Company Ltd</option>
                                                    <option value="First Material Science (Thailand) Co., Ltd">First Material Science (Thailand) Co., Ltd</option>
                                                    <option value="Cybrid Technologies Pvt. Ltd">Cybrid Technologies Pvt. Ltd</option>
                                                    <option value="Cymax PTE. Ltd">Cymax PTE. Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Encapsulant Type :</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[20]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[20], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Front Encapsulant Type"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Encapsulant Supplier :</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={editableValues[editableFieldKeys[21]] || ''}
                                                    onChange={(e) => {
                                                        handleEditableChange(editableFieldKeys[21], e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Back Encapsulant Supplier</option>
                                                    <option value="Hangzhou First PV Material Co., Ltd">Hangzhou First PV Material Co., Ltd</option>
                                                    <option value="Vietnam Advance Film Material Company Ltd">Vietnam Advance Film Material Company Ltd</option>
                                                    <option value="First Material Science (Thailand) Co., Ltd">First Material Science (Thailand) Co., Ltd</option>
                                                    <option value="Cybrid Technologies Pvt. Ltd">Cybrid Technologies Pvt. Ltd</option>
                                                    <option value="Cymax PTE. Ltd">Cymax PTE. Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Encapsulant Type :</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[22]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[22], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Back Encapsulant Type"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Sheet Supplier :</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={editableValues[editableFieldKeys[23]] || ''}
                                                    onChange={(e) => {
                                                        handleEditableChange(editableFieldKeys[23], e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Back Sheet Supplier</option>
                                                    <option value="Hangzhou First PV Material Co., Ltd">Hangzhou First PV Material Co., Ltd</option>
                                                    <option value="Vietnam Advance Film Material Company Ltd">Vietnam Advance Film Material Company Ltd</option>
                                                    <option value="First Material Science (Thailand) Co., Ltd">First Material Science (Thailand) Co., Ltd</option>
                                                    <option value="Cybrid Technologies Pvt. Ltd">Cybrid Technologies Pvt. Ltd</option>
                                                    <option value="Cymax PTE. Ltd">Cymax PTE. Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Supplier :</td>
                                            <td colSpan={13}>
                                                <select
                                                    value={editableValues[editableFieldKeys[24]] || ''}
                                                    onChange={(e) => {
                                                        handleEditableChange(editableFieldKeys[24], e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                >
                                                    <option value="">Select Glass Supplier</option>
                                                    <option value="Xinyi Solar">Xinyi Solar</option>
                                                    <option value="CSG Holding Co., Ltd.">CSG Holding Co., Ltd.</option>
                                                    <option value="Gurjat Borosil">Gurjat Borosil</option>
                                                    <option value="Kibing Group">Kibing Group</option>
                                                    <option value="Flat Glass Group Co., Ltd">Flat Glass Group Co., Ltd</option>
                                                    <option value="Henan Ancai Hi-Tech Co., Ltd">Henan Ancai Hi-Tech Co., Ltd</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Size (mm) :</td>
                                            <td colSpan={13}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[25]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[25], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Glass Size (mm)"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">ADHESION STRENGTH</td>
                                        </tr>
                                        <tr>
                                            <td rowSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Position</td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Glass to Encapsulant (N/cm)</td>
                                            <td colSpan={7} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Backsheet/ Back Glass to Encapsulant (N/cm)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Min</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Max</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Min</td>
                                            <td colSpan={4} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Max</td>
                                        </tr>
                                        {[0, 1, 2, 3, 4].map(pos => {
                                            const frontMinKey = `adhesion_data_${pos * 4}`;
                                            const frontMaxKey = `adhesion_data_${pos * 4 + 1}`;
                                            const backMinKey = `adhesion_data_${pos * 4 + 2}`;
                                            const backMaxKey = `adhesion_data_${pos * 4 + 3}`;
                                            const frontMinValue = dataValues[frontMinKey];
                                            const frontMaxValue = dataValues[frontMaxKey];
                                            const backMinValue = dataValues[backMinKey];
                                            const backMaxValue = dataValues[backMaxKey];
                                            const frontMinFail = isBelowAdhesionThreshold(frontMinValue, FRONT_ADHESION_THRESHOLD);
                                            const frontMaxFail = isBelowAdhesionThreshold(frontMaxValue, FRONT_ADHESION_THRESHOLD);
                                            const backMinFail = isBelowAdhesionThreshold(backMinValue, BACK_ADHESION_THRESHOLD);
                                            const backMaxFail = isBelowAdhesionThreshold(backMaxValue, BACK_ADHESION_THRESHOLD);
                                            
                                            return (
                                                <tr key={pos}>
                                                    <td className="p-2 text-center bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-bold">{pos + 1}</td>
                                                    <td colSpan={3}>
                                                        <input
                                                            type="text"
                                                            value={frontMinValue}
                                                            onChange={(e) => handleDataChange(frontMinKey, e.target.value)}
                                                            onFocus={() => handleDataFocus(frontMinKey)}
                                                            onBlur={(e) => handleDataBlur(frontMinKey, e.target.value)}
                                                            className={`front-min-cell w-full p-2 border rounded text-center ${frontMinFail
                                                                ? 'border-red-500 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
                                                                }`}
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td colSpan={3}>
                                                        <input
                                                            type="text"
                                                            value={frontMaxValue}
                                                            onChange={(e) => handleDataChange(frontMaxKey, e.target.value)}
                                                            onFocus={() => handleDataFocus(frontMaxKey)}
                                                            onBlur={(e) => handleDataBlur(frontMaxKey, e.target.value)}
                                                            className={`front-max-cell w-full p-2 border rounded text-center ${frontMaxFail
                                                                ? 'border-red-500 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
                                                                }`}
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td colSpan={3}>
                                                        <input
                                                            type="text"
                                                            value={backMinValue}
                                                            onChange={(e) => handleDataChange(backMinKey, e.target.value)}
                                                            onFocus={() => handleDataFocus(backMinKey)}
                                                            onBlur={(e) => handleDataBlur(backMinKey, e.target.value)}
                                                            className={`back-min-cell w-full p-2 border rounded text-center ${backMinFail
                                                                ? 'border-red-500 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
                                                                }`}
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td colSpan={4}>
                                                        <input
                                                            type="text"
                                                            value={backMaxValue}
                                                            onChange={(e) => handleDataChange(backMaxKey, e.target.value)}
                                                            onFocus={() => handleDataFocus(backMaxKey)}
                                                            onBlur={(e) => handleDataBlur(backMaxKey, e.target.value)}
                                                            className={`back-max-cell w-full p-2 border rounded text-center ${backMaxFail
                                                                ? 'border-red-500 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
                                                                }`}
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">AVERAGE</td>
                                            <td colSpan={3} className="front-min-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">{averages.frontMinAvg}</td>
                                            <td colSpan={3} className="front-max-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">{averages.frontMaxAvg}</td>
                                            <td colSpan={3} className="back-min-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">{averages.backMinAvg}</td>
                                            <td colSpan={4} className="back-max-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">{averages.backMaxAvg}</td>
                                        </tr>
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
                            </fieldset>
                        </div>
                    </div>
                )}

                {activeTab === 'saved-reports' && (
                    <div className="tab-content active">
                        {renderAdhesionReportsList()}
                    </div>
                )}
            </div>
        </>
    );
}
