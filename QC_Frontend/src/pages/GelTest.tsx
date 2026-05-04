import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';
import TestHeading from '../components/TestHeading';

interface GelTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean; };
    averages: { [key: string]: string; };
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

export default function GelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<GelTestReport[]>([]);
    const [gelReportName, setGelReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
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
    const getDateShiftTimeFieldType = (key: string): 'date' | 'shift' | 'time' => {
        if (key === 'gel_editable_42') return 'date';
        if (key === 'gel_editable_53') return 'shift';
        return 'time';
    };
    const apiService = {
        getAllReports: async (): Promise<GelTestReport[]> => {
            const response = await fetch(`${GEL_API_BASE_URL}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        deleteReport: async (id: string): Promise<void> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
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
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    const handleBackToHome = () => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: function () {
                    sessionStorage.removeItem('editingReportIndex');
                    sessionStorage.removeItem('editingReportData');
                    clearFormData();
                    navigate('/home');
                }
            });
        } else {
            sessionStorage.removeItem('editingReportIndex');
            sessionStorage.removeItem('editingReportData');
            clearFormData();
            navigate('/home');
        }
    };

    useEffect(() => {
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
        return () => { window.removeEventListener('beforeunload', handleBeforeUnload) };
    }, []);

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
        sessionStorage.setItem('gelTestFormData', JSON.stringify(buildFormData()));
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
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    const handleDateShiftTimeChange = (
        key: string,
        field: 'date' | 'shift' | 'time',
        value: string
    ) => {
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
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const reportMetadata = reports[index];
            const fullReport = await apiService.getReportById(reportMetadata._id!);
            clearFormData(false);
            setGelReportName(fullReport.name);
            sessionStorage.setItem('editingReportData', JSON.stringify(fullReport));
            sessionStorage.setItem('editingReportId', fullReport._id!);
            setActiveTab('edit-report');
            setTimeout(() => {
                loadReportData(fullReport);
                setHasUnsavedChanges(true);
            }, 150);
            showAlert('info', `Now editing: ${fullReport.name}`);
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
            const editingReportData = sessionStorage.getItem('editingReportData');
            if (editingReportData) {
                clearFormData(false);
                setTimeout(() => {
                    const report = JSON.parse(editingReportData) as GelTestReport;
                    loadReportData(report);
                    setHasUnsavedChanges(true);
                }, 100);
            } else {
                loadFormData();
            }
        }
    }, [activeTab]);

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');
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
            sessionStorage.removeItem('editingReportId');
            sessionStorage.removeItem('editingReportData');
        }

        setAverageValues(Array(7).fill('0'));
        setMeanValue('0');

        if (clearEditingState) {
            sessionStorage.removeItem('gelTestFormData');
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

    const saveReport = async () => {
        if (!gelReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }

        if (!validateDataFields()) {
            return;
        }

        try {
            setIsLoading(true);
            const reportData: Omit<GelTestReport, '_id'> = {
                name: gelReportName,
                timestamp: new Date().toISOString(),
                formData: buildFormData(),
                averages: buildAverages(),
            };
            const editingId = sessionStorage.getItem('editingReportId');
            if (editingId) {
                const existingReport = await apiService.getReportById(editingId);
                if (gelReportName === existingReport.name) {
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    const nameExists = await apiService.checkReportNameExists(gelReportName, editingId);
                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${gelReportName}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                                const allReports = await apiService.getAllReports();
                                const existingReportWithSameName = allReports.find(report => report.name === gelReportName);
                                if (existingReportWithSameName) {
                                    await apiService.updateReport(existingReportWithSameName._id!, reportData);
                                    showAlert('success', 'Report updated successfully!');
                                } else {
                                    await apiService.createReport(reportData);
                                    showAlert('success', 'New report created successfully!');
                                }
                                sessionStorage.removeItem('editingReportId');
                                sessionStorage.removeItem('editingReportData');
                                clearFormData();
                                loadSavedReports();
                                setActiveTab('saved-reports');
                            }
                        });
                        return;
                    } else {
                        await apiService.createReport(reportData);
                        showAlert('success', 'New report created with updated name!');
                    }
                }
                sessionStorage.removeItem('editingReportId');
                sessionStorage.removeItem('editingReportData');
            } else {
                const nameExists = await apiService.checkReportNameExists(gelReportName);
                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${gelReportName}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                            const allReports = await apiService.getAllReports();
                            const existingReport = allReports.find(report => report.name === gelReportName);
                            if (existingReport) {
                                await apiService.updateReport(existingReport._id!, reportData);
                                showAlert('success', 'Report updated successfully!');
                            } else {
                                await apiService.createReport(reportData);
                                showAlert('success', 'New report created successfully!');
                            }
                            clearFormData();
                            loadSavedReports();
                            setActiveTab('saved-reports');
                        }
                    });
                    return;
                } else {
                    await apiService.createReport(reportData);
                    showAlert('success', 'Report saved successfully!');
                }
            }
            clearFormData();
            loadSavedReports();
            setActiveTab('saved-reports');
        } catch (error) {
            console.error('Error saving report:', error);
            showAlert('error', 'Failed to save report');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSavedReport = async (index: number) => {
        try {
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            const report = reports[index];
            await apiService.deleteReport(report._id!);
            await loadSavedReports();
            showAlert('info', 'Report deleted successfully');
        } catch (error) {
            console.error('Error deleting report:', error);
            showAlert('error', 'Failed to delete report');
        }
    };

    const exportToExcel = async () => {
        if (!validateDataFields()) {
            return;
        }

        try {
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const gelReportData = {
                report_name: gelReportName.trim() || 'Gel_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: buildFormData(),
                averages: buildAverages(),
            };
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gelReportData),
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
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const report = reports[index];
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-2 text-gray-700 dark:text-gray-300">Loading...</p>
                        </div>
                    </div>
                )}
                <TestHeading
                    heading="Gel Content Test"
                    criteria="Gel Content should be 75 to 95% for EVA and EPE and ≥ 60% for POE"
                />
                <div className="flex justify-center mb-2">
                    <div
                        className={`tab ${activeTab === 'edit-report' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('edit-report')}
                    >
                        Edit Report
                    </div>
                    <div
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('saved-reports')}
                    >
                        Saved Reports
                    </div>
                </div>
                {activeTab === 'edit-report' && (
                    <div className="tab-content active">
                        <div className="save-actions flex flex-col sm:flex-row justify-center items-center gap-3.5">
                            <input
                                type="text"
                                value={gelReportName}
                                onChange={(e) => setGelReportName(e.target.value)}
                                className="gel-report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-[rgba(48,30,107,0.3)] dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter report name"
                            />
                            <button
                                className="save-btn w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-blue-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                onClick={saveReport}
                            >
                                Save Report
                            </button>
                            <button
                                className="save-btn export-excel w-full sm:w-[23%] p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-green-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                                onClick={exportToExcel}
                            >
                                Export as Excel
                            </button>
                        </div>
                        <div className="test-report-container bg-white dark:bg-gray-900 p-1 mt-2 rounded-md shadow-lg custom-scrollbar">
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
                                                <div className="allowable-limit p-2.5 bg-gray-50 dark:bg-gray-900 border-l-4 border-l-blue-500 dark:border-l-blue-400 text-left">
                                                    <strong className="px-2.5 text-gray-800 dark:text-white">Allowable Limit:</strong>
                                                    <div className="checkbox-container flex flex-col sm:flex-row gap-2 mt-2">
                                                        <div className="checkbox-item flex items-center mx-2">
                                                            <label htmlFor="gel-limit-eva-epe" className="text-sm text-gray-700 dark:text-gray-300">1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                                            <input
                                                                type="checkbox"
                                                                id="gel-limit-eva-epe"
                                                                checked={checkboxValues[checkboxKeys[0]] || false}
                                                                onChange={(e) => handleCheckboxChange(checkboxKeys[0], e.target.checked)}
                                                                className="ml-1 w-4 h-4 dark:accent-blue-500"
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
                                                                className="ml-1 w-4 h-4 dark:accent-blue-500"
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
                                                            className="ml-1 w-4 h-4 dark:accent-blue-500"
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="epe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">EPE</label>
                                                        <input
                                                            type="checkbox"
                                                            id="gel-material-epe"
                                                            checked={checkboxValues[checkboxKeys[3]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[3], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-blue-500"
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="poe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">POE</label>
                                                        <input
                                                            type="checkbox"
                                                            id="gel-material-poe"
                                                            checked={checkboxValues[checkboxKeys[4]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[4], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-blue-500"
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
                        </div>
                    </div>
                )}
                {activeTab === 'saved-reports' && (
                    <div className="tab-content active">
                        <SavedReportsNChecksheets
                            reports={savedReports}
                            onExportExcel={exportSavedReportToExcel}
                            onEdit={editSavedReport}
                            onDelete={deleteSavedReport}
                        />
                    </div>
                )}
            </div>
        </>
    );
}