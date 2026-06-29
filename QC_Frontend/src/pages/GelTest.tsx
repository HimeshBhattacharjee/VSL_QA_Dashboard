import { useEffect, useRef, useState } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import TestHeading from '../components/TestHeading';
import ReportPagination from '../components/ReportPagination';
import ReportListControls, { filterSortReports, ReportSortOption } from '../components/ReportListControls';

type GelWorkflowState = 'draft' | 'submitted' | 'returned';

interface GelTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean; };
    averages: { [key: string]: string; };
    workflowState?: GelWorkflowState;
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

interface DateShiftTimeValue {
    date: string;
    shift: string;
    time: string;
}

interface MeasurementRow {
    label: string;
    dataKeys: string[];
    dateShiftTimeKey?: string;
    dateShiftTimeField?: 'date' | 'shift' | 'time';
    dateShiftTimeRowSpan?: number;
}

const GEL_FORM_DATA_KEY = 'gelTestFormData';
const GEL_EDITING_REPORT_ID_KEY = 'gelTestEditingReportId';
const GEL_EDITING_REPORT_DATA_KEY = 'gelTestEditingReportData';

const clearGelDraftStorage = () => {
    sessionStorage.removeItem(GEL_FORM_DATA_KEY);
    sessionStorage.removeItem(GEL_EDITING_REPORT_ID_KEY);
    sessionStorage.removeItem(GEL_EDITING_REPORT_DATA_KEY);
};

const cloneGelReport = (report: GelTestReport): GelTestReport => (
    typeof structuredClone === 'function'
        ? structuredClone(report)
        : JSON.parse(JSON.stringify(report))
);

const getWorkflowState = (report?: Pick<GelTestReport, 'workflowState'> | null): GelWorkflowState =>
    report?.workflowState || 'submitted';

const formatWorkflowState = (state: GelWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

export default function GelTest() {
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports' | 'returned-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<GelTestReport[]>([]);
    const [gelReportName, setGelReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentWorkflowState, setCurrentWorkflowState] = useState<GelWorkflowState>('draft');
    const [currentReportMeta, setCurrentReportMeta] = useState<GelTestReport | null>(null);
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
    const GEL_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/gel-test-reports';
    const [preparedBySignature, setPreparedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');
    const [editableValues, setEditableValues] = useState<{ [key: string]: string }>({});
    const [dataValues, setDataValues] = useState<{ [key: string]: string }>({});
    const [checkboxValues, setCheckboxValues] = useState<{ [key: string]: boolean }>({});
    const [averageValues, setAverageValues] = useState<string[]>(Array(7).fill('0'));
    const [meanValue, setMeanValue] = useState('0');
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

    const buildFieldKey = (index: number) => `gel_editable_${index}`;
    const totalFieldCount = 81;
    const encapsulantSupplierKey = buildFieldKey(80);
    const checkboxKeys = ['checkbox_0', 'checkbox_1', 'checkbox_2', 'checkbox_3', 'checkbox_4'] as const;
    const dateShiftTimeFieldKeys = ['gel_editable_42', 'gel_editable_53', 'gel_editable_69'] as const;
    const dateShiftTimeFieldKeySet = new Set<string>(dateShiftTimeFieldKeys);
    const measurementRows: MeasurementRow[] = [
        { dateShiftTimeKey: 'gel_editable_42', dateShiftTimeField: 'date', dateShiftTimeRowSpan: 2, label: 'A', dataKeys: [43, 44, 45, 46, 47].map(buildFieldKey) },
        { label: 'B', dataKeys: [48, 49, 50, 51, 52].map(buildFieldKey) },
        { dateShiftTimeKey: 'gel_editable_53', dateShiftTimeField: 'shift', dateShiftTimeRowSpan: 3, label: 'C', dataKeys: [54, 55, 56, 57, 58].map(buildFieldKey) },
        { label: 'D', dataKeys: [59, 60, 61, 62, 63].map(buildFieldKey) },
        { label: 'E', dataKeys: [64, 65, 66, 67, 68].map(buildFieldKey) },
        { dateShiftTimeKey: 'gel_editable_69', dateShiftTimeField: 'time', dateShiftTimeRowSpan: 2, label: 'F', dataKeys: [70, 71, 72, 73, 74].map(buildFieldKey) },
        { label: 'G', dataKeys: [75, 76, 77, 78, 79].map(buildFieldKey) },
    ];
    const dataFieldKeys = measurementRows.flatMap(row => row.dataKeys);
    const dataFieldKeySet = new Set(dataFieldKeys);
    const emptyDateShiftTimeValue: DateShiftTimeValue = { date: '', shift: '', time: '' };
    const createInitialDateShiftTimeValues = (): Record<string, DateShiftTimeValue> => ({
        gel_editable_42: { ...emptyDateShiftTimeValue },
        gel_editable_53: { ...emptyDateShiftTimeValue },
        gel_editable_69: { ...emptyDateShiftTimeValue },
    });
    const [dateShiftTimeValues, setDateShiftTimeValues] = useState<Record<string, DateShiftTimeValue>>(createInitialDateShiftTimeValues);
    const previousDataValuesRef = useRef<{ [key: string]: string }>({});
    const suppressAutoSaveRef = useRef(true);
    const isRouteActiveRef = useRef(true);
    const editSessionRef = useRef(0);
    const authHeaders = (includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    });

    const getDateShiftTimeFieldType = (key: string): 'date' | 'shift' | 'time' => {
        if (key === 'gel_editable_42') return 'date';
        if (key === 'gel_editable_53') return 'shift';
        return 'time';
    };
    const apiService = {
        getAllReports: async (): Promise<GelTestReport[]> => {
            const response = await fetch(`${GEL_API_BASE_URL}/`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/`, {
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
        updateReport: async (id: string, report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, {
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
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },
        submitReport: async (id: string, report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}/submit`, {
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
        returnReport: async (id: string, returnComments: string): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}/return`, {
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
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${GEL_API_BASE_URL}/name/${encodeURIComponent(name)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
    };

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
        isRouteActiveRef.current = true;
        clearGelDraftStorage();
        initializeForm();
        loadSavedReports();
        loadFormData();
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
            // Clear only Gel Content's unsaved draft/edit cache when leaving this route.
            clearGelDraftStorage();
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'returned-reports' && returnedReports.length === 0) {
            setActiveTab('saved-reports');
        }
    }, [activeTab, returnedReports.length]);

    const initializeForm = () => {
        setAverageValues(Array(7).fill('0'));
        setMeanValue('0');
    };

    const formatDateShiftTimeValue = (key: string, value: { date: string; shift: string; time: string }) =>
        value[getDateShiftTimeFieldType(key)] || '';

    const materialInfoLabelKeyPairs = [
        { frontLabelKey: buildFieldKey(13), backLabelKey: buildFieldKey(15) },
        { frontLabelKey: buildFieldKey(20), backLabelKey: buildFieldKey(22) },
        { frontLabelKey: buildFieldKey(27), backLabelKey: buildFieldKey(29) },
        { frontLabelKey: buildFieldKey(34), backLabelKey: buildFieldKey(36) },
    ];

    const parseDateShiftTimeValue = (formData: { [key: string]: string | boolean }, key: string) => {
        const storedDate = formData[`${key}_date`];
        const storedShift = formData[`${key}_shift`];
        const storedTime = formData[`${key}_time`];
        const fieldType = getDateShiftTimeFieldType(key);

        if (typeof storedDate === 'string' || typeof storedShift === 'string' || typeof storedTime === 'string') {
            return {
                date: typeof storedDate === 'string' ? storedDate : '',
                shift: typeof storedShift === 'string' ? storedShift : '',
                time: typeof storedTime === 'string' ? storedTime : '',
            };
        }

        const combinedValue = typeof formData[key] === 'string' ? formData[key] : '';
        if (!combinedValue) return { ...emptyDateShiftTimeValue };

        if (!combinedValue.includes('|')) {
            return {
                date: fieldType === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(combinedValue) ? combinedValue : '',
                shift: fieldType === 'shift' && ['A', 'B', 'C', 'G'].includes(combinedValue) ? combinedValue : '',
                time: fieldType === 'time' ? combinedValue : '',
            };
        }

        const parts = combinedValue.split('|').map(part => part.trim());
        const [date = '', shift = '', time = ''] = parts;

        return {
            date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
            shift: ['A', 'B', 'C', 'G'].includes(shift) ? shift : '',
            time: /^\d{4}-\d{2}-\d{2}$/.test(date) || ['A', 'B', 'C', 'G'].includes(shift)
                ? time
                : combinedValue,
        };
    };

    const buildFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        for (let index = 0; index < totalFieldCount; index++) {
            const key = buildFieldKey(index);

            if (dateShiftTimeFieldKeySet.has(key)) {
                const structuredValue = dateShiftTimeValues[key] || emptyDateShiftTimeValue;
                formData[key] = formatDateShiftTimeValue(key, structuredValue);
                formData[`${key}_date`] = structuredValue.date;
                formData[`${key}_shift`] = structuredValue.shift;
                formData[`${key}_time`] = structuredValue.time;
                continue;
            }

            if (dataFieldKeySet.has(key)) {
                formData[key] = dataValues[key] || '';
                continue;
            }

            formData[key] = editableValues[key] || '';
        }

        checkboxKeys.forEach(key => {
            formData[key] = checkboxValues[key] || false;
        });

        materialInfoLabelKeyPairs.forEach(({ frontLabelKey, backLabelKey }) => {
            formData[frontLabelKey] = 'Front';
            formData[backLabelKey] = 'Back';
        });

        formData.preparedBySignature = preparedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = gelReportName;

        return formData;
    };

    const buildAverages = () => {
        const averages: { [key: string]: string } = {};

        averageValues.forEach((value, index) => {
            averages[`average_${index}`] = value;
        });

        averages.mean = meanValue;
        return averages;
    };

    const buildReportPayload = (): Omit<GelTestReport, '_id'> => ({
        name: gelReportName.trim(),
        timestamp: currentReportMeta?.timestamp || new Date().toISOString(),
        formData: buildFormData(),
        averages: buildAverages(),
        workflowState: currentWorkflowState,
    });

    const applyStoredFormData = (formData: { [key: string]: string | boolean }, reportName?: string) => {
        suppressAutoSaveRef.current = true;

        const nextEditableValues: { [key: string]: string } = {};
        const nextDataValues: { [key: string]: string } = {};
        const nextCheckboxValues: { [key: string]: boolean } = {};
        const nextDateShiftTimeValues = createInitialDateShiftTimeValues();

        for (let index = 0; index < totalFieldCount; index++) {
            const key = buildFieldKey(index);

            if (dateShiftTimeFieldKeySet.has(key)) {
                nextDateShiftTimeValues[key] = parseDateShiftTimeValue(formData, key);
                continue;
            }

            if (dataFieldKeySet.has(key)) {
                nextDataValues[key] = typeof formData[key] === 'string' ? formData[key] as string : '';
                continue;
            }

            nextEditableValues[key] = typeof formData[key] === 'string' ? formData[key] as string : '';
        }

        checkboxKeys.forEach(key => {
            nextCheckboxValues[key] = Boolean(formData[key]);
        });

        previousDataValuesRef.current = { ...nextDataValues };
        setEditableValues(nextEditableValues);
        setDataValues(nextDataValues);
        setCheckboxValues(nextCheckboxValues);
        setDateShiftTimeValues(nextDateShiftTimeValues);
        setPreparedBySignature(typeof formData.preparedBySignature === 'string' ? formData.preparedBySignature : '');
        setVerifiedBySignature(typeof formData.verifiedBySignature === 'string' ? formData.verifiedBySignature : '');

        if (typeof reportName === 'string') {
            setGelReportName(reportName);
        } else if (typeof formData.reportName === 'string') {
            setGelReportName(formData.reportName);
        }
    };

    const saveFormData = () => {
        if (!isRouteActiveRef.current) return;

        sessionStorage.setItem(GEL_FORM_DATA_KEY, JSON.stringify(buildFormData()));
    };

    const isValidDataValue = (value: string): boolean => {
        return value === '' ||
            !isNaN(parseFloat(value)) ||
            (!isNaN(parseFloat(value.replace('%', ''))) && value.includes('%'));
    };

    const validateDataFields = () => {
        const invalidKey = dataFieldKeys.find(key => !isValidDataValue((dataValues[key] || '').trim()));

        if (invalidKey) {
            showAlert('error', 'Please enter a valid number (with or without % sign)');
            return false;
        }

        return true;
    };

    const parseNumericDataValue = (value: string) => {
        const numericValue = parseFloat(value.trim().replace(/%/g, ''));
        return Number.isNaN(numericValue) ? null : numericValue;
    };

    const shouldHighlightPlatenValue = (key: string) => {
        const numericValue = parseNumericDataValue(dataValues[key] || '');

        if (numericValue === null) {
            return false;
        }

        const isEvaOrEpeSelected = Boolean(checkboxValues[checkboxKeys[2]] || checkboxValues[checkboxKeys[3]]);
        const isPoeSelected = Boolean(checkboxValues[checkboxKeys[4]]);

        return (isEvaOrEpeSelected && (numericValue < 75 || numericValue > 95))
            || (isPoeSelected && numericValue < 60);
    };

    const normalizeDateValue = (value: string) => {
        const trimmedValue = value.trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
            return trimmedValue;
        }

        const legacyDateMatch = trimmedValue.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);

        if (legacyDateMatch) {
            const [, day, month, year] = legacyDateMatch;
            return `${year}-${month}-${day}`;
        }

        return '';
    };

    const getDateInputValue = (key: string) => {
        return normalizeDateValue(editableValues[key] || '');
    };

    const calculateAverages = (currentDataValues: { [key: string]: string }) => {
        const calculatedAverages = measurementRows.map(row => {
            let sum = 0;
            let count = 0;
            let hasPercentage = false;

            row.dataKeys.forEach(key => {
                const value = (currentDataValues[key] || '').trim();

                if (value) {
                    if (value.includes('%')) {
                        hasPercentage = true;
                        const numericValue = parseFloat(value.replace('%', ''));

                        if (!isNaN(numericValue)) {
                            sum += numericValue;
                            count++;
                        }
                    } else {
                        const numericValue = parseFloat(value);

                        if (!isNaN(numericValue)) {
                            sum += numericValue;
                            count++;
                        }
                    }
                }
            });

            let average = 0;
            if (count > 0) average = sum / count;

            let displayValue = average.toFixed(2);
            if (hasPercentage && count > 0) displayValue += '%';

            return { value: average, hasPercentage, count, displayValue };
        });

        setAverageValues(calculatedAverages.map(average => average.displayValue));

        const validAverages = calculatedAverages.filter(average => average.count > 0);
        if (validAverages.length > 0) {
            const mean = validAverages.reduce((sum, average) => sum + average.value, 0) / validAverages.length;
            let meanDisplay = mean.toFixed(2);

            if (validAverages.some(average => average.hasPercentage)) {
                meanDisplay += '%';
            }

            setMeanValue(meanDisplay);
            return;
        }

        setMeanValue('0');
    };

    const handleEditableChange = (key: string, value: string) => {
        if (!canEditCurrentReport) return;
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    const handleDateShiftTimeChange = (
        key: string,
        field: 'date' | 'shift' | 'time',
        value: string
    ) => {
        if (!canEditCurrentReport) return;
        setDateShiftTimeValues(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || emptyDateShiftTimeValue),
                [field]: value,
            },
        }));
        setHasUnsavedChanges(true);
    };

    const handleDataFocus = (key: string) => {
        previousDataValuesRef.current[key] = dataValues[key] || '';
    };

    const handleDataChange = (key: string, value: string) => {
        if (!canEditCurrentReport) return;
        setDataValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    const handleDataBlur = (key: string) => {
        const value = (dataValues[key] || '').trim();

        if (isValidDataValue(value)) {
            if (value !== dataValues[key]) {
                setDataValues(prev => ({ ...prev, [key]: value }));
            }
            return;
        }

        showAlert('error', 'Please enter a valid number (with or without % sign)');
        setDataValues(prev => ({
            ...prev,
            [key]: previousDataValuesRef.current[key] || '',
        }));
    };

    const handleCheckboxChange = (key: string, checked: boolean) => {
        if (!canEditCurrentReport) return;
        setCheckboxValues(prev => ({ ...prev, [key]: checked }));
        setHasUnsavedChanges(true);
    };

    useEffect(() => {
        calculateAverages(dataValues);
    }, [dataValues]);

    useEffect(() => {
        if (gelReportName.trim() && !hasUnsavedChanges) {
            setHasUnsavedChanges(true);
        }
    }, [gelReportName, hasUnsavedChanges]);

    useEffect(() => {
        if (suppressAutoSaveRef.current) {
            suppressAutoSaveRef.current = false;
            return;
        }

        saveFormData();
    }, [
        editableValues,
        dataValues,
        checkboxValues,
        dateShiftTimeValues,
        preparedBySignature,
        verifiedBySignature,
        gelReportName,
    ]);

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
        if (!canEditCurrentReport) return false;
        if (!username) return false;
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
        if (!canEditCurrentReport) return false;
        if (!username) return false;
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
            if (!reportMetadata._id) {
                showAlert('error', 'Report ID not found');
                return;
            }
            const fullReport = await apiService.getReportById(reportMetadata._id!);
            const selectedReport = cloneGelReport(fullReport);
            const editSessionId = editSessionRef.current + 1;
            editSessionRef.current = editSessionId;

            // Start every edit from a clean session before loading the selected report clone.
            clearFormData();
            sessionStorage.setItem(GEL_EDITING_REPORT_DATA_KEY, JSON.stringify(selectedReport));
            sessionStorage.setItem(GEL_EDITING_REPORT_ID_KEY, selectedReport._id!);
            setCurrentReportId(selectedReport._id || null);
            setCurrentWorkflowState(getWorkflowState(selectedReport));
            setCurrentReportMeta(selectedReport);
            setActiveTab('edit-report');
            setTimeout(() => {
                if (!isRouteActiveRef.current || editSessionRef.current !== editSessionId) return;
                loadReportData(cloneGelReport(selectedReport));
                setHasUnsavedChanges(getWorkflowState(selectedReport) !== 'submitted');
            }, 150);
            showAlert('info', `${state === 'submitted' && isOperatorRole ? 'Viewing' : 'Opened'}: ${selectedReport.name}`);
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const loadReportData = (report: GelTestReport) => {
        applyStoredFormData(report.formData, report.name);
    };

    useEffect(() => {
        if (activeTab === 'edit-report') {
            const editingReportData = sessionStorage.getItem(GEL_EDITING_REPORT_DATA_KEY);
            if (editingReportData) {
                const editSessionId = editSessionRef.current;
                clearFormData(false);
                setTimeout(() => {
                    if (!isRouteActiveRef.current || editSessionRef.current !== editSessionId) return;
                    const report = cloneGelReport(JSON.parse(editingReportData) as GelTestReport);
                    setCurrentReportId(report._id || null);
                    setCurrentWorkflowState(getWorkflowState(report));
                    setCurrentReportMeta(report);
                    loadReportData(report);
                    setHasUnsavedChanges(getWorkflowState(report) !== 'submitted');
                }, 100);
            } else {
                loadFormData();
            }
        }
    }, [activeTab]);

    const loadFormData = () => {
        const savedData = sessionStorage.getItem(GEL_FORM_DATA_KEY);
        if (savedData) {
            const formData = JSON.parse(savedData);
            applyStoredFormData(formData);
            setHasUnsavedChanges(true);
        }
    };

    const clearFormData = (clearEditingState = true) => {
        suppressAutoSaveRef.current = true;
        previousDataValuesRef.current = {};
        setEditableValues({});
        setDataValues({});
        setCheckboxValues({});
        setDateShiftTimeValues(createInitialDateShiftTimeValues());
        setPreparedBySignature('');
        setVerifiedBySignature('');

        if (clearEditingState) {
            setGelReportName('');
            setCurrentReportId(null);
            setCurrentWorkflowState('draft');
            setCurrentReportMeta(null);
            sessionStorage.removeItem(GEL_EDITING_REPORT_ID_KEY);
            sessionStorage.removeItem(GEL_EDITING_REPORT_DATA_KEY);
        }

        setAverageValues(Array(7).fill('0'));
        setMeanValue('0');

        if (clearEditingState) {
            sessionStorage.removeItem(GEL_FORM_DATA_KEY);
        }

        setHasUnsavedChanges(false);
    };

    const loadSavedReports = async () => {
        try {
            setIsLoading(true);
            const reports = await apiService.getAllReports();
            setSavedReports(reports);
        } catch (error) {
            console.error('Error loading reports:', error);
            showAlert('error', 'Failed to load saved reports');
        } finally {
            setIsLoading(false);
        }
    };

    const saveDraftReport = async () => {
        if (!canSaveDraftCurrentReport || !canEditCurrentReport) {
            showAlert('error', 'You are not authorized to save this report');
            return;
        }
        if (!gelReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }
        if (!validateDataFields()) return;

        try {
            setIsLoading(true);
            const reportData = buildReportPayload();
            if (currentReportId) {
                const updatedReport = await apiService.updateReport(currentReportId, reportData);
                setCurrentReportMeta(updatedReport);
                setCurrentWorkflowState(getWorkflowState(updatedReport));
                showAlert('success', 'Draft saved successfully');
            } else {
                const nameExists = await apiService.checkReportNameExists(gelReportName);
                if (nameExists) {
                    showAlert('error', 'Report name already exists. Open it from the saved reports list.');
                    return;
                }
                const createdReport = await apiService.createReport(reportData);
                setCurrentReportId(createdReport._id || null);
                setCurrentReportMeta(createdReport);
                setCurrentWorkflowState(getWorkflowState(createdReport));
                sessionStorage.setItem(GEL_EDITING_REPORT_ID_KEY, createdReport._id || '');
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
        if (!gelReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }
        if (!preparedBySignature.trim()) {
            showAlert('error', 'Prepared By signature is required before submission');
            return;
        }
        if (!validateDataFields()) return;

        try {
            setIsLoading(true);
            const reportData = buildReportPayload();
            let reportId = currentReportId;
            if (!reportId) {
                const nameExists = await apiService.checkReportNameExists(gelReportName);
                if (nameExists) {
                    showAlert('error', 'Report name already exists. Open it from the saved reports list.');
                    return;
                }
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
            clearGelDraftStorage();
            await loadSavedReports();
            clearFormData();
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
        if (!validateDataFields()) return;

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
            if (report._id === currentReportId) clearFormData();
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
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ report_id: currentReportId }),
            });
            if (!response.ok) throw new Error('Failed to generate report');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${gelReportName.trim() || 'Gel_Test_Report'}.xlsx`;
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
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
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

    const canOpenListedReport = (report: GelTestReport) =>
        isSystemAdminRole || isOperatorRole || (isReviewerRole && getWorkflowState(report) === 'submitted');

    const canDeleteListedReport = (report: GelTestReport) =>
        isSystemAdminRole
        || ((isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted')
        || (isOperatorRole && getWorkflowState(report) === 'draft');

    const canReturnListedReport = (report: GelTestReport) =>
        (isReviewerRole || isSystemAdminRole) && getWorkflowState(report) === 'submitted';

    const getOpenActionLabel = (report: GelTestReport) => {
        const state = getWorkflowState(report);
        if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) return 'Locked';
        if (isOperatorRole && state === 'submitted') return 'View';
        return state === 'submitted' && isReviewerRole ? 'Open' : 'Edit';
    };

    const renderGelReportsList = (reports: GelTestReport[], title: string, listType: 'main' | 'returned' = 'main') => {
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
                            {reports.length === 0 ? 'No gel reports found.' : 'No matching gel reports found.'}
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

    const inputBaseClassName = 'w-full min-w-0 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white';
    const inputClassName = `${inputBaseClassName} p-2`;
    const centeredInputClassName = `${inputClassName} text-center`;
    const highlightedDataInputClassName = `${centeredInputClassName} border-red-400 bg-red-300 text-red-600 dark:border-red-500 dark:bg-red-950 dark:text-red-200`;

    const renderTextInput = (key: string, placeholder = '') => (
        <input
            type="text"
            value={editableValues[key] || ''}
            onChange={(e) => handleEditableChange(key, e.target.value)}
            className={inputClassName}
            placeholder={placeholder}
        />
    );

    const renderSupplierSelect = (key: string) => (
        <select
            value={editableValues[key] || ''}
            onChange={(e) => handleEditableChange(key, e.target.value)}
            className={inputClassName}
        >
            <option value="">Select</option>
            <option value="Hangzhou First PV Material Co., Ltd">Hangzhou First PV Material Co., Ltd</option>
            <option value="Vietnam Advance Film Material Company Ltd">Vietnam Advance Film Material Company Ltd</option>
            <option value="First Material Science (Thailand) Co., Ltd">First Material Science (Thailand) Co., Ltd</option>
            <option value="Cybrid Technologies Pvt. Ltd">Cybrid Technologies Pvt. Ltd</option>
            <option value="Cymax PTE. Ltd">Cymax PTE. Ltd</option>
            <option value="N/A">N/A</option>
        </select>
    );

    const renderDateInput = (key: string) => (
        <input
            type="date"
            value={getDateInputValue(key)}
            onChange={(e) => handleEditableChange(key, e.target.value)}
            className={inputClassName}
        />
    );

    const materialInfoLabelClassName = 'bg-gray-50 dark:bg-gray-800/80 p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300';
    const dateShiftTimeFieldWrapperClassName = 'flex min-h-[96px] items-center justify-center';
    const dateShiftTimeFieldClassName = `${inputClassName} mx-auto max-w-[220px]`;

    const renderMaterialFrontBackFields = (
        frontKey: string,
        backKey: string,
        inputType: 'text' | 'date' = 'text'
    ) => (
        <td colSpan={5} className="p-2">
            <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                <table className="w-full table-fixed border-collapse">
                    <tbody>
                        <tr>
                            <td className={`${materialInfoLabelClassName} border-r border-gray-200 dark:border-gray-700`}>Front</td>
                            <td className="border-r border-gray-200 p-1.5 dark:border-gray-700">
                                {inputType === 'date' ? renderDateInput(frontKey) : renderTextInput(frontKey)}
                            </td>
                            <td className={`${materialInfoLabelClassName} border-r border-gray-200 dark:border-gray-700`}>Back</td>
                            <td className="p-1.5">
                                {inputType === 'date' ? renderDateInput(backKey) : renderTextInput(backKey)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </td>
    );

    const renderDataInput = (key: string) => (
        <input
            type="text"
            value={dataValues[key] || ''}
            onChange={(e) => handleDataChange(key, e.target.value)}
            onFocus={() => handleDataFocus(key)}
            onBlur={() => handleDataBlur(key)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                }
            }}
            className={shouldHighlightPlatenValue(key) ? highlightedDataInputClassName : centeredInputClassName}
            placeholder="-"
        />
    );

    const renderDateShiftTimeFields = (key: string, field: 'date' | 'shift' | 'time') => {
        const value = dateShiftTimeValues[key] || emptyDateShiftTimeValue;

        if (field === 'date') {
            return (
                <div className={dateShiftTimeFieldWrapperClassName}>
                    <input
                        type="date"
                        value={value.date}
                        onChange={(e) => handleDateShiftTimeChange(key, 'date', e.target.value)}
                        className={dateShiftTimeFieldClassName}
                    />
                </div>
            );
        }

        if (field === 'shift') {
            return (
                <div className={dateShiftTimeFieldWrapperClassName}>
                    <select
                        value={value.shift}
                        onChange={(e) => handleDateShiftTimeChange(key, 'shift', e.target.value)}
                        className={dateShiftTimeFieldClassName}
                    >
                        <option value="">Shift</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="G">G</option>
                    </select>
                </div>
            );
        }

        return (
            <div className={dateShiftTimeFieldWrapperClassName}>
                <input
                    type="text"
                    value={value.time}
                    onChange={(e) => handleDateShiftTimeChange(key, 'time', e.target.value)}
                    className={dateShiftTimeFieldClassName}
                    placeholder="Time"
                />
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
                <TestHeading
                    heading="Gel Content Test"
                    criteria="Gel Content should be 75 to 95% for EVA and EPE and ≥ 60% for POE"
                />
                <div className="flex justify-center mb-2">
                    {canCreateReport && (
                        <div
                            className={`tab ${activeTab === 'edit-report' ? 'active bg-white dark:bg-gray-900 text-brand-primary border-b-2 border-b-brand-primary translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => {
                                clearFormData();
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
                </div>
                {activeTab === 'edit-report' && (
                    <div className="tab-content active">
                        <div className="save-actions flex flex-col sm:flex-row justify-center items-center gap-3.5">
                            <input
                                type="text"
                                value={gelReportName}
                                onChange={(e) => setGelReportName(e.target.value)}
                                className="gel-report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-brand-primary/30 dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                placeholder="Enter report name"
                                disabled={!canEditCurrentReport}
                            />
                            {canSaveDraftCurrentReport && (
                                <button
                                    className="save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-gray-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
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
                                    title={currentWorkflowState !== 'submitted' && !canSubmitCurrentReport ? 'Prepared By signature is required before submission' : undefined}
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
                        <div className="test-report-container bg-white dark:bg-gray-900 p-1 mt-2 rounded-md shadow-lg custom-scrollbar">
                            {currentWorkflowState === 'returned' && currentReportMeta?.returnComments && (
                                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                                    <strong>Returned for correction:</strong> {currentReportMeta.returnComments}
                                    <div className="mt-1 text-xs">
                                        Returned by {currentReportMeta.returnedBy || '-'} on {formatTimestamp(currentReportMeta.returnedAt)}
                                    </div>
                                </div>
                            )}
                            <fieldset disabled={!canEditCurrentReport} className={!canEditCurrentReport ? 'w-full min-w-0 opacity-90' : 'w-full min-w-0'}>
                            <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
                                <table ref={tableRef} className="w-full table-fixed border-collapse min-w-[1000px] text-xs sm:text-sm">
                                    <tbody>
                                        <tr>
                                            <td colSpan={2} rowSpan={3} className="p-2 bg-gray-100 dark:bg-gray-700">
                                                <img src="../LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" className="mx-auto" />
                                            </td>
                                            <td colSpan={8} rowSpan={2} className="section-title text-xl sm:text-2xl md:text-3xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                VIKRAM SOLAR LIMITED
                                            </td>
                                            <td colSpan={7} rowSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Doc. No.: VSL/QAD/FM/90
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={7} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Issue Date: 11.01.2023
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={8} className="section-title text-lg sm:text-xl md:text-2xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                Gel Content Test Report
                                            </td>
                                            <td colSpan={7} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Rev. No./ Date: 03/ 25.02.2025
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} rowSpan={3}>
                                                <div className="allowable-limit p-2.5 bg-gray-50 dark:bg-gray-900 border-l-4 border-l-brand-primary dark:border-l-brand-primary-light text-left">
                                                    <strong className="px-2.5 text-gray-800 dark:text-white">Allowable Limit:</strong>
                                                    <div className="checkbox-container flex flex-col sm:flex-row gap-2 mt-2">
                                                        <div className="checkbox-item flex items-center mx-2">
                                                            <label htmlFor="gel-limit-eva-epe" className="text-sm text-gray-700 dark:text-gray-300">1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                                            <input
                                                                type="checkbox"
                                                                id="gel-limit-eva-epe"
                                                                checked={checkboxValues[checkboxKeys[0]] || false}
                                                                onChange={(e) => handleCheckboxChange(checkboxKeys[0], e.target.checked)}
                                                                className="ml-1 w-4 h-4 dark:accent-brand-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="checkbox-container flex flex-col sm:flex-row gap-2 mt-2">
                                                        <div className="checkbox-item flex items-center mx-1.5">
                                                            <label htmlFor="poe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">2. Gel Content should be: ≥ 60% for POE</label>
                                                            <input
                                                                type="checkbox"
                                                                id="gel-limit-poe"
                                                                checked={checkboxValues[checkboxKeys[1]] || false}
                                                                onChange={(e) => handleCheckboxChange(checkboxKeys[1], e.target.checked)}
                                                                className="ml-1 w-4 h-4 dark:accent-brand-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Inv. No./ Date:</td>
                                            <td colSpan={5}>{renderDateInput(buildFieldKey(0))}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">P.O. No.:</td>
                                            <td colSpan={5}>{renderTextInput(buildFieldKey(1), 'P.O. No.')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Type of Test:</td>
                                            <td colSpan={5}>{renderTextInput(buildFieldKey(2), 'Type of Test')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Laminator Parameter</td>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Laminator Details:</td>
                                            <td colSpan={5}>{renderTextInput(buildFieldKey(3), 'Laminator Details')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Process Name</td>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 1</td>
                                            <td colSpan={3} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 2</td>
                                            <td colSpan={3} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 3 (CP)</td>
                                            <td colSpan={7} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">MATERIAL INFORMATION (S)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pumping Time (Sec)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(4))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(5))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(6))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Encapsulant Types:</td>
                                            <td colSpan={5}>
                                                <div className="checkbox-container flex flex-col sm:flex-row justify-center items-center gap-2 p-2">
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="eva-checkbox" className="text-sm text-gray-700 dark:text-gray-300">EVA</label>
                                                        <input
                                                            type="checkbox"
                                                            id="gel-material-eva"
                                                            checked={checkboxValues[checkboxKeys[2]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[2], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-brand-primary"
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="epe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">EPE</label>
                                                        <input
                                                            type="checkbox"
                                                            id="gel-material-epe"
                                                            checked={checkboxValues[checkboxKeys[3]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[3], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-brand-primary"
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="poe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">POE</label>
                                                        <input
                                                            type="checkbox"
                                                            id="gel-material-poe"
                                                            checked={checkboxValues[checkboxKeys[4]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[4], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-brand-primary"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pressing/Cooling Time (Sec)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(7))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(8))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(9))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Encapsulant Supplier:</td>
                                            <td colSpan={5}>{renderSupplierSelect(encapsulantSupplierKey)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Venting Time (Sec)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(10))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(11))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(12))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Category:</td>
                                            {renderMaterialFrontBackFields(buildFieldKey(14), buildFieldKey(16))}
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Lower Heating (˚C)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(17))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(18))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(19))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Batch/Lot No.:</td>
                                            {renderMaterialFrontBackFields(buildFieldKey(21), buildFieldKey(23))}
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Upper Heating (˚C)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(24))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(25))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(26))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">MFG. Date:</td>
                                            {renderMaterialFrontBackFields(buildFieldKey(28), buildFieldKey(30), 'date')}
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Upper Pressure (Kpa)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(31))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(32))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(33))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Exp. Date:</td>
                                            {renderMaterialFrontBackFields(buildFieldKey(35), buildFieldKey(37), 'date')}
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Lower Pressure (Kpa)</td>
                                            <td colSpan={2}>{renderTextInput(buildFieldKey(38))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(39))}</td>
                                            <td colSpan={3}>{renderTextInput(buildFieldKey(40))}</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Size:</td>
                                            <td colSpan={5}>{renderTextInput(buildFieldKey(41), 'Glass Size')}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={17} className="p-2">
                                                <img src="../IMAGES/GelTest.jpg" alt="Gel Test" className="w-full h-auto max-h-[300px] object-contain rounded-md" />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Date, Shift, & Time</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Workshop</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Platen Position</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#1</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#2</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#3</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#4</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#5</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Average</td>
                                            <td colSpan={4} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Mean</td>
                                        </tr>
                                        {measurementRows.map((row, rowIndex) => (
                                            <tr key={row.label}>
                                                {row.dateShiftTimeKey && row.dateShiftTimeField && (
                                                    <td colSpan={2} rowSpan={row.dateShiftTimeRowSpan} className="p-2 align-middle">
                                                        {renderDateShiftTimeFields(row.dateShiftTimeKey, row.dateShiftTimeField)}
                                                    </td>
                                                )}
                                                {rowIndex === 0 && (
                                                    <td colSpan={2} rowSpan={7} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
                                                        VSL FAB-II
                                                    </td>
                                                )}
                                                <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
                                                    {row.label}
                                                </td>
                                                {row.dataKeys.map(key => (
                                                    <td key={key} className="p-2 text-center">
                                                        {renderDataInput(key)}
                                                    </td>
                                                ))}
                                                <td colSpan={2} className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">
                                                    {averageValues[rowIndex] || '0'}
                                                </td>
                                                {rowIndex === 0 && (
                                                    <td colSpan={4} rowSpan={7} className="mean-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">
                                                        {meanValue}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
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
                        {renderGelReportsList(reportsForMainList, isOperatorRole ? 'Submitted/Draft Reports' : 'Submitted Reports', 'main')}
                    </div>
                )}
                {activeTab === 'returned-reports' && isOperatorRole && (
                    <div className="tab-content active">
                        {renderGelReportsList(returnedReports, 'Returned Reports', 'returned')}
                    </div>
                )}
            </div>
        </>
    );
}
