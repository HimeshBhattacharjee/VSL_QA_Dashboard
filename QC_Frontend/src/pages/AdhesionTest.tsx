import { useEffect, useRef, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';
import TestHeading from '../components/TestHeading';

interface AdhesionTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean; };
    averages: { [key: string]: string; };
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

export default function AdhesionTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<AdhesionTestReport[]>([]);
    const [adhesionReportName, setAdhesionReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
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

    const apiService = {
        getAllReports: async (): Promise<AdhesionTestReport[]> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<AdhesionTestReport, '_id'>): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/`, {
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
        updateReport: async (id: string, report: Omit<AdhesionTestReport, '_id'>): Promise<AdhesionTestReport> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`, {
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
            const response = await fetch(`${ADHESION_API_BASE_URL}/${id}`, { method: 'DELETE' });
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
        setTimeout(() => saveFormData(), 0);
    };

    // Handle editable input changes
    const handleEditableChange = (key: string, value: string) => {
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
        setTimeout(() => saveFormData(), 0);
    };

    // Handle data input changes - immediate update with ref for real-time calculation
    const handleDataChange = (key: string, value: string) => {
        // Allow empty string, hyphen, or numbers
        if (value === '' || value === '-' || !isNaN(parseFloat(value))) {
            const newValues = { ...dataValuesRef.current, [key]: value };
            syncDataValues(newValues);
            setHasUnsavedChanges(true);
            setTimeout(() => saveFormData(), 0);
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
            setTimeout(() => {
                saveFormData();
            }, 0);
        }
    };

    useEffect(() => {
        if (adhesionReportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
        if (adhesionReportName !== '') saveFormData();
    }, [adhesionReportName]);

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
        setTimeout(() => {
            saveFormData();
        }, 0);
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
        setTimeout(() => {
            saveFormData();
        }, 0);
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
            setAdhesionReportName(fullReport.name);
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

    const loadReportData = (report: AdhesionTestReport) => {
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
            saveFormData();
        }, 200);
    };

    useEffect(() => {
        if (activeTab === 'edit-report') {
            const editingReportData = sessionStorage.getItem('editingReportData');
            if (editingReportData) {
                clearFormData(false);
                setTimeout(() => {
                    const report = JSON.parse(editingReportData) as AdhesionTestReport;
                    loadReportData(report);
                    setHasUnsavedChanges(true);
                }, 100);
            } else {
                loadFormData();
            }
        }
    }, [activeTab]);

    const saveFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        // Save editable text fields
        Object.keys(editableValues).forEach(key => {
            formData[key] = editableValues[key];
        });

        // Save data cells
        Object.keys(dataValues).forEach(key => {
            formData[key] = dataValues[key] || '-';
        });

        formData.preparedBySignature = preparedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = adhesionReportName;
        formData.testDate = testDate;
        formData.shift = shift;
        formData.laminator = laminator;
        formData.laminationPosition = laminationPosition;
        formData.lamParams = JSON.stringify(lamParams);

        sessionStorage.setItem('adhesionTestFormData', JSON.stringify(formData));
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('adhesionTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);

            if (formData.reportName !== undefined) setAdhesionReportName(formData.reportName);
            if (formData.testDate !== undefined) setTestDate(formData.testDate);
            if (formData.shift !== undefined) setShift(formData.shift);
            if (formData.laminator !== undefined) setLaminator(formData.laminator);
            if (formData.laminationPosition !== undefined) setLaminationPosition(formData.laminationPosition);
            if (formData.lamParams !== undefined) setLamParams(JSON.parse(formData.lamParams));

            // Load editable text fields
            const editableInputs: { [key: string]: string } = {};
            for (let i = 0; i <= 33; i++) {
                const key = `adhesion_editable_${i}`;
                if (formData[key] !== undefined) {
                    editableInputs[key] = formData[key];
                }
            }
            setEditableValues(editableInputs);

            // Load data cells
            const dataInputs: { [key: string]: string } = {};
            for (let i = 0; i <= 19; i++) {
                const key = `adhesion_data_${i}`;
                if (formData[key] !== undefined) {
                    dataInputs[key] = formData[key];
                } else {
                    dataInputs[key] = '-';
                }
            }
            syncDataValues(dataInputs);

            if (formData.preparedBySignature !== undefined) {
                setPreparedBySignature(formData.preparedBySignature as string);
            }
            if (formData.verifiedBySignature !== undefined) {
                setVerifiedBySignature(formData.verifiedBySignature as string);
            }

            calculateAverages();

            setHasUnsavedChanges(true);
        } else {
            // Initialize data cells with hyphens if no saved data
            initializeDataCellsWithHyphens();
        }
    };

    const clearFormData = (clearEditingState = true) => {
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
            sessionStorage.removeItem('editingReportId');
            sessionStorage.removeItem('editingReportData');
        }

        setAverages({ ...DEFAULT_ADHESION_AVERAGES });

        if (clearEditingState) {
            sessionStorage.removeItem('adhesionTestFormData');
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
        if (!adhesionReportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }

        try {
            setIsLoading(true);
            const currentAverages = getAdhesionAverages(dataValuesRef.current);

            const reportData: Omit<AdhesionTestReport, '_id'> = {
                name: adhesionReportName,
                timestamp: new Date().toISOString(),
                formData: {},
                averages: { ...currentAverages },
            };

            // Save editable text fields
            Object.keys(editableValues).forEach(key => {
                reportData.formData[key] = editableValues[key];
            });

            // Save data cells
            Object.keys(dataValues).forEach(key => {
                reportData.formData[key] = dataValues[key] || '-';
            });

            reportData.formData.preparedBySignature = preparedBySignature;
            reportData.formData.verifiedBySignature = verifiedBySignature;
            reportData.formData.testDate = testDate;
            reportData.formData.shift = shift;
            reportData.formData.laminator = laminator;
            reportData.formData.laminationPosition = laminationPosition;
            reportData.formData.lamParams = JSON.stringify(lamParams);

            const editingId = sessionStorage.getItem('editingReportId');

            if (editingId) {
                const existingReport = await apiService.getReportById(editingId);
                if (adhesionReportName === existingReport.name) {
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    const nameExists = await apiService.checkReportNameExists(adhesionReportName, editingId);
                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${adhesionReportName}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                                const allReports = await apiService.getAllReports();
                                const existingReportWithSameName = allReports.find(report => report.name === adhesionReportName);
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
                const nameExists = await apiService.checkReportNameExists(adhesionReportName);
                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${adhesionReportName}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                            const allReports = await apiService.getAllReports();
                            const existingReport = allReports.find(report => report.name === adhesionReportName);
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
        try {
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const currentAverages = getAdhesionAverages(dataValuesRef.current);

            const formData: { [key: string]: string | boolean } = {};

            // Save editable text fields
            Object.keys(editableValues).forEach(key => {
                formData[key] = editableValues[key];
            });

            // Save data cells
            Object.keys(dataValues).forEach(key => {
                formData[key] = dataValues[key] || '-';
            });

            formData.preparedBySignature = preparedBySignature;
            formData.verifiedBySignature = verifiedBySignature;
            formData.testDate = testDate;
            formData.shift = shift;
            formData.laminator = laminator;
            formData.laminationPosition = laminationPosition;
            formData.lamParams = JSON.stringify(lamParams);

            const adhesionReportData = {
                report_name: adhesionReportName.trim() || 'Adhesion_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: formData,
                averages: { ...currentAverages },
            };

            const response = await fetch(`${ADHESION_API_BASE_URL}/generate-adhesion-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adhesionReportData),
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
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            showAlert('info', 'Please wait! Exporting Excel will take some time...');

            const report = reports[index];
            const response = await fetch(`${ADHESION_API_BASE_URL}/generate-adhesion-report`, {
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
                    heading="Adhesion Test"
                    criteria="Glass to Encapsulant ≥ 60N/cm & Backsheet to Encapsulant ≥ 40N/cm"
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
                                value={adhesionReportName}
                                onChange={(e) => setAdhesionReportName(e.target.value)}
                                className="adhesion-report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-[rgba(48,30,107,0.3)] dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                        <div className="test-report-container bg-white dark:bg-gray-900 p-1 mt-2 rounded-md shadow-lg">
                            <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
                                <table ref={tableRef} className="w-full border-collapse min-w-[800px]">
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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
                                                        setTimeout(() => saveFormData(), 0);
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

