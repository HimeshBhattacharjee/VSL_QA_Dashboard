import { useEffect, useRef, useState, Fragment } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import ReportPagination from '../components/ReportPagination';
import ReportListControls, { filterSortReports, ReportSortOption } from '../components/ReportListControls';

type AdhesionWorkflowState = 'draft' | 'submitted' | 'returned';

interface AdhesionTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean; };
    averages: { [key: string]: string; };
    workflowState?: AdhesionWorkflowState;
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

const getWorkflowState = (report?: Pick<AdhesionTestReport, 'workflowState'> | null): AdhesionWorkflowState =>
    report?.workflowState || 'submitted';

const formatWorkflowState = (state: AdhesionWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

export default function AdhesionTest() {
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports' | 'returned-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<AdhesionTestReport[]>([]);
    const [adhesionReportName, setAdhesionReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentWorkflowState, setCurrentWorkflowState] = useState<AdhesionWorkflowState>('draft');
    const [currentReportMeta, setCurrentReportMeta] = useState<AdhesionTestReport | null>(null);
    const [returnModalReportIndex, setReturnModalReportIndex] = useState<number | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const [mainReportPage, setMainReportPage] = useState(1);
    const [mainReportPageSize, setMainReportPageSize] = useState(10);
    const [returnedReportPage, setReturnedReportPage] = useState(1);
    const [returnedReportPageSize, setReturnedReportPageSize] = useState(10);
    const [mainReportSearch, setMainReportSearch] = useState('');
    const [mainReportSort, setMainReportSort] = useState<ReportSortOption>('newest-updated');
    const [returnedReportSearch, setReturnedReportSearch] = useState('');
    const [returnedReportSort, setReturnedReportSort] = useState<ReportSortOption>('newest-updated');
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
    const canCreateReport = isOperatorRole || isSystemAdminRole;
    const canEditCurrentReport = isSystemAdminRole
        || (isOperatorRole && (!currentReportId || ['draft', 'returned'].includes(currentWorkflowState)))
        || (isReviewerRole && currentReportId !== null && currentWorkflowState === 'submitted');
    const canSaveDraftCurrentReport = (isOperatorRole || isSystemAdminRole) && currentWorkflowState !== 'submitted';
    const canSubmitCurrentReport = (isOperatorRole || isSystemAdminRole)
        && currentWorkflowState !== 'submitted'
        && preparedBySignature.trim().length > 0;
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
            const response = await fetch(url);
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
    };

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        const storedEmployeeId = sessionStorage.getItem('employeeId');
        clearAdhesionDraftStorage();
        clearAdhesionPersistentDraft();

        setUserRole(storedUserRole);
        setUsername(storedUsername);
        setEmployeeId(storedEmployeeId);
        if (!['Operator', 'Admin', 'System Administrator'].includes(storedUserRole || '')) {
            setActiveTab('saved-reports');
        }
    }, []);

    useEffect(() => {
        currentReportIdRef.current = currentReportId;
    }, [currentReportId]);

    useEffect(() => {
        currentWorkflowStateRef.current = currentWorkflowState;
    }, [currentWorkflowState]);

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

    useEffect(() => {
        isRouteActiveRef.current = true;
        initializeForm();
        loadSavedReports();
        return () => {
            isRouteActiveRef.current = false;
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
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    // Handle data input changes - immediate update with ref for real-time calculation
    const handleDataChange = (key: string, value: string) => {
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

    const editSavedReport = async (index: number) => {
        try {
            setIsLoading(true);
            if (index < 0 || index >= savedReports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const reportMetadata = savedReports[index];
            const state = getWorkflowState(reportMetadata);

            if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) {
                showAlert('error', 'Draft and returned reports are locked until the operator submits them');
                return;
            }
            const fullReport = await apiService.getReportById(reportMetadata._id!);
            const selectedReport = cloneAdhesionReport(fullReport);
            const editSessionId = editSessionRef.current + 1;
            editSessionRef.current = editSessionId;

            // Start every edit from a clean in-memory session before loading the selected report clone.
            clearFormData();
            setActiveTab('edit-report');
            setTimeout(() => {
                if (!isRouteActiveRef.current || editSessionRef.current !== editSessionId) return;
                loadReportData(cloneAdhesionReport(selectedReport));
                setHasUnsavedChanges(getWorkflowState(selectedReport) !== 'submitted');
            }, 150);
            const selectedState = getWorkflowState(selectedReport);
            const willBeEditable = isSystemAdminRole
                || (isOperatorRole && ['draft', 'returned'].includes(selectedState))
                || (isReviewerRole && selectedState === 'submitted');
            showAlert('info', `${willBeEditable ? 'Opened' : 'Viewing'}: ${selectedReport.name}`);
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const loadReportData = (report: AdhesionTestReport) => {
        isHydratingRef.current = true;
        setCurrentReportId(report._id || null);
        currentReportIdRef.current = report._id || null;
        setCurrentWorkflowState(getWorkflowState(report));
        currentWorkflowStateRef.current = getWorkflowState(report);
        setCurrentReportMeta(report);
        setAdhesionReportName(report.name);

        // Load date
        if (report.formData.testDate !== undefined) {
            setTestDate(report.formData.testDate as string);
        }

        // Load shift
        if (report.formData.shift !== undefined) {
            setShift(report.formData.shift as string);
        }

        // Load laminator
        if (report.formData.laminator !== undefined) {
            setLaminator(report.formData.laminator as string);
        }

        // Load lamination position
        if (report.formData.laminationPosition !== undefined) {
            setLaminationPosition(report.formData.laminationPosition as string);
        }

        // Load lamination parameters
        if (report.formData.lamParams !== undefined) {
            const params = JSON.parse(report.formData.lamParams as string);
            setLamParams(params);
        }

        // Load editable text fields
        const editableInputs: { [key: string]: string } = {};
        for (let i = 0; i <= 33; i++) {
            const key = `adhesion_editable_${i}`;
            if (report.formData[key] !== undefined) {
                editableInputs[key] = report.formData[key] as string;
            }
        }
        setEditableValues(editableInputs);

        // Load data cells
        const dataInputs: { [key: string]: string } = {};
        for (let i = 0; i <= 19; i++) {
            const key = `adhesion_data_${i}`;
            if (report.formData[key] !== undefined) {
                const value = report.formData[key] as string;
                dataInputs[key] = value || '-';
            } else {
                dataInputs[key] = '-';
            }
        }
        syncDataValues(dataInputs);

        if (report.formData.preparedBySignature !== undefined) {
            setPreparedBySignature(report.formData.preparedBySignature as string);
        } else {
            setPreparedBySignature('');
        }

        if (report.formData.verifiedBySignature !== undefined) {
            setVerifiedBySignature(report.formData.verifiedBySignature as string);
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
            await loadSavedReports(false);
        } catch (error) {
            console.error('Error saving draft:', error);
            showAlert('error', getFriendlyReportError(error));
        } finally {
            setIsLoading(false);
        }
    };

    const loadSavedReports = async (showSpinner = true) => {
        try {
            if (showSpinner) setIsLoading(true);
            const reports = await apiService.getAllReports();
            setSavedReports(reports);
        } catch (error) {
            console.error('Error loading reports:', error);
            showAlert('error', 'Failed to load saved reports');
        } finally {
            if (showSpinner) setIsLoading(false);
        }
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
            setActiveTab(['Operator', 'Admin', 'System Administrator'].includes(nextUserRole || '') ? 'edit-report' : 'saved-reports');
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
        if (currentWorkflowState === 'submitted' && !adhesionReportName.trim()) {
            showAlert('error', 'Please enter a report name');
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
                showAlert('success', 'Report changes saved successfully');
                await loadSavedReports(false);
                return;
            }

            if (!preparedBySignature.trim()) {
                showAlert('error', 'Prepared By signature is required before submission');
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
            await loadSavedReports(false);
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

    const deleteSavedReport = async (index: number) => {
        try {
            if (index < 0 || index >= savedReports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const report = savedReports[index];
            const reportState = getWorkflowState(report);
            const canDeleteDraft = isOperatorRole && reportState === 'draft';
            const canDeleteSubmitted = (isReviewerRole || isSystemAdminRole) && reportState === 'submitted';
            if (!canDeleteDraft && !canDeleteSubmitted) {
                showAlert('error', 'You are not authorized to delete this report');
                return;
            }
            await apiService.deleteReport(report._id!);
            if (report._id === currentReportId) {
                clearFormData(true, true);
            }
            await loadSavedReports();
            showAlert('info', 'Report deleted successfully');
        } catch (error) {
            console.error('Error deleting report:', error);
            showAlert('error', 'Failed to delete report');
        }
    };

    const exportToExcel = async () => {
        try {
            if (!currentReportId || currentWorkflowState !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted reports');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');

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

            showAlert('info', 'Please wait! Exporting Excel will take some time...');

            const report = savedReports[index];
            if (getWorkflowState(report) !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted reports');
                return;
            }
            const response = await fetch(`${ADHESION_API_BASE_URL}/generate-adhesion-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: report._id }),
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
            await loadSavedReports(false);
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

    const canOpenListedReport = (report: AdhesionTestReport) =>
        isSystemAdminRole || isOperatorRole || (isReviewerRole && getWorkflowState(report) === 'submitted');

    const canDeleteListedReport = (report: AdhesionTestReport) =>
        ((isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted')
        || (isOperatorRole && getWorkflowState(report) === 'draft');

    const canReturnListedReport = (report: AdhesionTestReport) =>
        (isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted';

    const getOpenActionLabel = (report: AdhesionTestReport) => {
        const state = getWorkflowState(report);
        if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) return 'Locked';
        if (isOperatorRole && state === 'submitted') return 'View';
        return state === 'submitted' && isReviewerRole ? 'Open' : 'Edit';
    };

    const renderAdhesionReportsList = (reports: AdhesionTestReport[], title: string, listType: 'main' | 'returned' = 'main') => {
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
                        {reports.length === 0 ? 'No adhesion reports found.' : 'No matching adhesion reports found.'}
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
                        const canExport = state === 'submitted' && canOpenListedReport(report);
                        const canOpen = canOpenListedReport(report);

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
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-wrap gap-2 justify-start lg:w-auto lg:shrink-0 lg:justify-end">
                                        <button
                                            className={`flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium transition-all ${canExport ? 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-green-500 dark:hover:bg-green-600 cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
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

    return (
        <>
            <div className="mx-auto">
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
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
                                className="mt-3 w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                    heading="Adhesion Test"
                    criteria="Glass to Encapsulant ≥ 60N/cm & Backsheet to Encapsulant ≥ 40N/cm"
                />
                <div className="flex justify-center mb-2">
                    {canCreateReport && (
                        <div
                            className={`tab ${activeTab === 'edit-report' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={startFreshReport}
                        >
                            Create Report
                        </div>
                    )}
                    <div
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('saved-reports')}
                    >
                        {isOperatorRole ? 'Submitted/Draft Reports' : 'Submitted Reports'}
                    </div>
                    {isOperatorRole && returnedReports.length > 0 && (
                        <div
                            className={`tab relative ${activeTab === 'returned-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => setActiveTab('returned-reports')}
                        >
                            Returned Reports
                            <span className="absolute right-3 top-1.5 min-w-5 h-5 rounded-full bg-red-600 px-1.5 text-[11px] leading-5 text-white">
                                {returnedReports.length}
                            </span>
                        </div>
                    )}
                </div>

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
                                className="adhesion-report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-[rgba(48,30,107,0.3)] dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className={`save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 font-semibold transition-all duration-300 ease-in-out text-white text-sm ${currentWorkflowState !== 'submitted' && !canSubmitCurrentReport ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg'}`}
                                    onClick={saveReport}
                                    disabled={currentWorkflowState !== 'submitted' && !canSubmitCurrentReport}
                                >
                                    {currentWorkflowState === 'submitted' ? 'Save Changes' : currentWorkflowState === 'returned' ? 'Resubmit Report' : 'Submit Report'}
                                </button>
                            )}
                            {canExportCurrentReport && (
                                <button
                                    className="save-btn export-excel w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-green-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                    onClick={exportToExcel}
                                >
                                    Export as Excel
                                </button>
                            )}
                            {currentReportId && currentWorkflowState === 'submitted' && (isReviewerRole || isSystemAdminRole) && (
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
                                                <div className="allowable-limit p-2.5 bg-gray-50 dark:bg-gray-900 border-l-4 border-l-blue-500 dark:border-l-blue-400 text-left">
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
                        {renderAdhesionReportsList(reportsForMainList, isOperatorRole ? 'Submitted/Draft Reports' : 'Submitted Reports', 'main')}
                    </div>
                )}

                {activeTab === 'returned-reports' && isOperatorRole && returnedReports.length > 0 && (
                    <div className="tab-content active">
                        {renderAdhesionReportsList(returnedReports, 'Returned Reports', 'returned')}
                    </div>
                )}
            </div>
        </>
    );
}
