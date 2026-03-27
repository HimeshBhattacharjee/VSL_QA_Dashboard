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
    const [acceptedBySignature, setAcceptedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');
    
    // New state variables for date and shift
    const [testDate, setTestDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState<string>('');
    
    // State for all editable input values
    const [editableValues, setEditableValues] = useState<{ [key: string]: string }>({});
    // State for data cells (gel data cells)
    const [dataValues, setDataValues] = useState<{ [key: string]: string }>({});
    // State for checkboxes
    const [checkboxValues, setCheckboxValues] = useState<{ [key: string]: boolean }>({});

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
        calculateAverages();
        initializeDataCellsWithHyphens();
    };

    const initializeDataCellsWithHyphens = () => {
        const initialData: { [key: string]: string } = {};
        // Initialize all data cells (positions A-G with 5 readings each)
        // Total 7 positions * 5 readings = 35 cells
        for (let i = 0; i < 35; i++) {
            initialData[`gel_data_${i}`] = '';
        }
        setDataValues(initialData);
    };

    const calculateAverages = () => {
        // Group data by position (7 positions: A, B, C, D, E, F, G)
        // Each position has 5 readings (indices 0-4 for position A, 5-9 for B, etc.)
        const positions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        
        positions.forEach((position, posIndex) => {
            let sum = 0;
            let count = 0;
            let hasPercentage = false;
            
            for (let i = 0; i < 5; i++) {
                const dataIndex = posIndex * 5 + i;
                const key = `gel_data_${dataIndex}`;
                const value = dataValues[key] || '';
                
                if (value && value.trim() !== '') {
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
            }
            
            let average = 0;
            if (count > 0) average = sum / count;
            let averageDisplay = average.toFixed(2);
            if (hasPercentage && count > 0) averageDisplay += '%';
            
            // Update average cell in DOM
            const avgCells = document.querySelectorAll('.average-cell');
            if (avgCells[posIndex]) {
                avgCells[posIndex].textContent = averageDisplay;
            }
        });
        
        // Calculate mean of all averages
        const avgCells = document.querySelectorAll('.average-cell');
        let totalSum = 0;
        let validCount = 0;
        let anyHasPercentage = false;
        
        avgCells.forEach(cell => {
            const text = cell.textContent?.trim() || '';
            if (text && text !== '0' && text !== '-') {
                let numericValue = parseFloat(text);
                if (!isNaN(numericValue)) {
                    totalSum += numericValue;
                    validCount++;
                    if (text.includes('%')) anyHasPercentage = true;
                }
            }
        });
        
        const meanCell = document.querySelector('.mean-cell');
        if (meanCell) {
            if (validCount > 0) {
                const mean = totalSum / validCount;
                let meanDisplay = mean.toFixed(2);
                if (anyHasPercentage) meanDisplay += '%';
                meanCell.textContent = meanDisplay;
            } else {
                meanCell.textContent = '0';
            }
        }
    };

    // Handle editable input changes
    const handleEditableChange = (key: string, value: string) => {
        setEditableValues(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
        setTimeout(() => saveFormData(), 0);
    };

    // Handle data cell changes
    const handleDataChange = (key: string, value: string) => {
        // Allow empty string or numbers (with or without %)
        if (value === '' || value === '-' || !isNaN(parseFloat(value)) || (value.includes('%') && !isNaN(parseFloat(value.replace('%', ''))))) {
            setDataValues(prev => {
                const newValues = { ...prev, [key]: value };
                setTimeout(() => {
                    calculateAverages();
                }, 0);
                return newValues;
            });
            setHasUnsavedChanges(true);
            setTimeout(() => saveFormData(), 0);
        } else {
            showAlert('error', 'Please enter a valid number (with or without % sign)');
        }
    };

    // Handle checkbox changes
    const handleCheckboxChange = (key: string, checked: boolean) => {
        setCheckboxValues(prev => ({ ...prev, [key]: checked }));
        setHasUnsavedChanges(true);
        setTimeout(() => saveFormData(), 0);
    };

    const handleAddSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
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
        if (section === 'accepted' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can add signature to Accepted By section');
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
            case 'accepted':
                setAcceptedBySignature(signatureText);
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

    const handleRemoveSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
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
            case 'accepted':
                setAcceptedBySignature('');
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

    const canRemoveSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        return currentSignature.includes(username);
    };

    const canAddSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (currentSignature.trim()) return false;
        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'accepted':
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
        setGelReportName(report.name);
        
        // Load date
        if (report.formData.testDate !== undefined) {
            setTestDate(report.formData.testDate as string);
        }
        
        // Load shift
        if (report.formData.shift !== undefined) {
            setShift(report.formData.shift as string);
        }
        
        // Load editable fields
        const editableInputs: { [key: string]: string } = {};
        for (let i = 0; i < 35; i++) {
            const key = `gel_editable_${i}`;
            if (report.formData[key] !== undefined) {
                editableInputs[key] = report.formData[key] as string;
            }
        }
        setEditableValues(editableInputs);
        
        // Load data cells
        const dataInputs: { [key: string]: string } = {};
        for (let i = 0; i < 35; i++) {
            const key = `gel_data_${i}`;
            if (report.formData[key] !== undefined) {
                dataInputs[key] = report.formData[key] as string;
            } else {
                dataInputs[key] = '';
            }
        }
        setDataValues(dataInputs);
        
        // Load checkboxes
        const checkboxInputs: { [key: string]: boolean } = {};
        for (let i = 0; i < 5; i++) {
            const key = `checkbox_${i}`;
            if (report.formData[key] !== undefined) {
                checkboxInputs[key] = report.formData[key] as boolean;
            }
        }
        setCheckboxValues(checkboxInputs);
        
        if (report.formData.preparedBySignature !== undefined) {
            setPreparedBySignature(report.formData.preparedBySignature as string);
        } else {
            setPreparedBySignature('');
        }
        
        if (report.formData.acceptedBySignature !== undefined) {
            setAcceptedBySignature(report.formData.acceptedBySignature as string);
        } else {
            setAcceptedBySignature('');
        }
        
        if (report.formData.verifiedBySignature !== undefined) {
            setVerifiedBySignature(report.formData.verifiedBySignature as string);
        } else {
            setVerifiedBySignature('');
        }
        
        setTimeout(() => {
            calculateAverages();
        }, 150);
        
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
                    const report = JSON.parse(editingReportData) as GelTestReport;
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
        
        // Save editable fields
        Object.keys(editableValues).forEach(key => {
            formData[key] = editableValues[key];
        });
        
        // Save data cells
        Object.keys(dataValues).forEach(key => {
            formData[key] = dataValues[key] || '';
        });
        
        // Save checkboxes
        Object.keys(checkboxValues).forEach(key => {
            formData[key] = checkboxValues[key];
        });
        
        formData.preparedBySignature = preparedBySignature;
        formData.acceptedBySignature = acceptedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = gelReportName;
        formData.testDate = testDate;
        formData.shift = shift;
        
        sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            if (formData.reportName !== undefined) setGelReportName(formData.reportName);
            if (formData.testDate !== undefined) setTestDate(formData.testDate);
            if (formData.shift !== undefined) setShift(formData.shift);
            
            // Load editable fields
            const editableInputs: { [key: string]: string } = {};
            for (let i = 0; i < 35; i++) {
                const key = `gel_editable_${i}`;
                if (formData[key] !== undefined) {
                    editableInputs[key] = formData[key];
                }
            }
            setEditableValues(editableInputs);
            
            // Load data cells
            const dataInputs: { [key: string]: string } = {};
            for (let i = 0; i < 35; i++) {
                const key = `gel_data_${i}`;
                if (formData[key] !== undefined) {
                    dataInputs[key] = formData[key];
                } else {
                    dataInputs[key] = '';
                }
            }
            setDataValues(dataInputs);
            
            // Load checkboxes
            const checkboxInputs: { [key: string]: boolean } = {};
            for (let i = 0; i < 5; i++) {
                const key = `checkbox_${i}`;
                if (formData[key] !== undefined) {
                    checkboxInputs[key] = formData[key] as boolean;
                }
            }
            setCheckboxValues(checkboxInputs);
            
            if (formData.preparedBySignature !== undefined) {
                setPreparedBySignature(formData.preparedBySignature as string);
            }
            if (formData.acceptedBySignature !== undefined) {
                setAcceptedBySignature(formData.acceptedBySignature as string);
            }
            if (formData.verifiedBySignature !== undefined) {
                setVerifiedBySignature(formData.verifiedBySignature as string);
            }
            
            setTimeout(() => {
                calculateAverages();
            }, 100);
            
            setHasUnsavedChanges(true);
        } else {
            // Initialize data cells with empty values
            initializeDataCellsWithHyphens();
        }
    };

    const clearFormData = (clearEditingState = true) => {
        setEditableValues({});
        
        const initialDataInputs: { [key: string]: string } = {};
        for (let i = 0; i < 35; i++) {
            initialDataInputs[`gel_data_${i}`] = '';
        }
        setDataValues(initialDataInputs);
        
        setCheckboxValues({});
        setPreparedBySignature('');
        setAcceptedBySignature('');
        setVerifiedBySignature('');
        setTestDate(new Date().toISOString().split('T')[0]);
        setShift('');
        
        if (clearEditingState) {
            setGelReportName('');
            sessionStorage.removeItem('editingReportId');
            sessionStorage.removeItem('editingReportData');
        }
        
        // Reset average cells
        const avgCells = document.querySelectorAll('.average-cell');
        avgCells.forEach(cell => {
            cell.textContent = '0';
        });
        const meanCell = document.querySelector('.mean-cell');
        if (meanCell) {
            meanCell.textContent = '0';
        }
        
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
        try {
            setIsLoading(true);
            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });
            const meanCell = document.querySelector('.mean-cell');
            averages.mean = meanCell?.textContent?.trim() || '0';
            
            const reportData: Omit<GelTestReport, '_id'> = {
                name: gelReportName,
                timestamp: new Date().toISOString(),
                formData: {},
                averages: averages,
            };
            
            // Save editable fields
            Object.keys(editableValues).forEach(key => {
                reportData.formData[key] = editableValues[key];
            });
            
            // Save data cells
            Object.keys(dataValues).forEach(key => {
                reportData.formData[key] = dataValues[key] || '';
            });
            
            // Save checkboxes
            Object.keys(checkboxValues).forEach(key => {
                reportData.formData[key] = checkboxValues[key];
            });
            
            reportData.formData.preparedBySignature = preparedBySignature;
            reportData.formData.acceptedBySignature = acceptedBySignature;
            reportData.formData.verifiedBySignature = verifiedBySignature;
            reportData.formData.testDate = testDate;
            reportData.formData.shift = shift;
            
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
        try {
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const formData: { [key: string]: string | boolean } = {};
            
            // Save editable fields
            Object.keys(editableValues).forEach(key => {
                formData[key] = editableValues[key];
            });
            
            // Save data cells
            Object.keys(dataValues).forEach(key => {
                formData[key] = dataValues[key] || '';
            });
            
            // Save checkboxes
            Object.keys(checkboxValues).forEach(key => {
                formData[key] = checkboxValues[key];
            });
            
            formData.preparedBySignature = preparedBySignature;
            formData.acceptedBySignature = acceptedBySignature;
            formData.verifiedBySignature = verifiedBySignature;
            formData.testDate = testDate;
            formData.shift = shift;
            
            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });
            const meanCell = document.querySelector('.mean-cell');
            if (meanCell) averages.mean = meanCell.textContent?.trim() || '0';
            
            const gelReportData = {
                report_name: gelReportName.trim() || 'Gel_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: formData,
                averages: averages,
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

    useEffect(() => {
        if (gelReportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
    }, [gelReportName]);

    // Define editable field keys for text inputs
    const editableFieldKeys = [
        'gel_editable_0',   // Inv. No./ Date
        'gel_editable_1',   // P.O. No.
        'gel_editable_2',   // Type of Test
        'gel_editable_3',   // Laminator Details
        'gel_editable_4',   // Pumping Time Lam-1
        'gel_editable_5',   // Pumping Time Lam-2
        'gel_editable_6',   // Pumping Time Lam-3 (CP)
        'gel_editable_7',   // Pressing/Cooling Time Lam-1
        'gel_editable_8',   // Pressing/Cooling Time Lam-2
        'gel_editable_9',   // Pressing/Cooling Time Lam-3 (CP)
        'gel_editable_10',  // Venting Time Lam-1
        'gel_editable_11',  // Venting Time Lam-2
        'gel_editable_12',  // Venting Time Lam-3 (CP)
        'gel_editable_13',  // Lower Heating Lam-1
        'gel_editable_14',  // Lower Heating Lam-2
        'gel_editable_15',  // Lower Heating Lam-3 (CP)
        'gel_editable_16',  // Upper Heating Lam-1
        'gel_editable_17',  // Upper Heating Lam-2
        'gel_editable_18',  // Upper Heating Lam-3 (CP)
        'gel_editable_19',  // Upper Pressure Lam-1
        'gel_editable_20',  // Upper Pressure Lam-2
        'gel_editable_21',  // Upper Pressure Lam-3 (CP)
        'gel_editable_22',  // Lower Pressure Lam-1
        'gel_editable_23',  // Lower Pressure Lam-2
        'gel_editable_24',  // Lower Pressure Lam-3 (CP)
        'gel_editable_25',  // Date, Shift, & Time (first cell - will use date picker and dropdown)
        'gel_editable_26',  // Date, Shift, & Time (second cell - will use date picker and dropdown)
        'gel_editable_27',  // Category cell 1
        'gel_editable_28',  // Category cell 2
        'gel_editable_29',  // Category cell 3
        'gel_editable_30',  // Category cell 4
        'gel_editable_31',  // Batch/Lot No. cell 1
        'gel_editable_32',  // Batch/Lot No. cell 2
        'gel_editable_33',  // Batch/Lot No. cell 3
        'gel_editable_34',  // Batch/Lot No. cell 4
        'gel_editable_35',  // MFG. Date cell 1
        'gel_editable_36',  // MFG. Date cell 2
        'gel_editable_37',  // MFG. Date cell 3
        'gel_editable_38',  // MFG. Date cell 4
        'gel_editable_39',  // Exp. Date cell 1
        'gel_editable_40',  // Exp. Date cell 2
        'gel_editable_41',  // Exp. Date cell 3
        'gel_editable_42',  // Exp. Date cell 4
        'gel_editable_43',  // Glass Size
    ];

    // Define data cell keys for gel content readings
    // 7 positions (A-G) with 5 readings each = 35 data cells
    const getDataCellKey = (positionIndex: number, readingIndex: number) => `gel_data_${positionIndex * 5 + readingIndex}`;

    // Define checkbox keys
    const checkboxKeys = [
        'checkbox_0',   // EVA & EPE checkbox
        'checkbox_1',   // POE checkbox
        'checkbox_2',   // EVA checkbox (material info)
        'checkbox_3',   // EPE checkbox (material info)
        'checkbox_4',   // POE checkbox (material info)
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
                        <div className="test-report-container bg-white dark:bg-gray-900 p-1 mt-2 rounded-md shadow-lg">
                            <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
                                <table ref={tableRef} className="w-full border-collapse min-w-[1000px]">
                                    <tbody>
                                        <tr>
                                            <td colSpan={2} rowSpan={3} className="p-2 bg-gray-100 dark:bg-gray-700">
                                                <img src="../LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" className="mx-auto" />
                                            </td>
                                            <td colSpan={8} rowSpan={2} className="section-title text-xl sm:text-2xl md:text-3xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                VIKRAM SOLAR LIMITED
                                            </td>
                                            <td colSpan={6} rowSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Doc. No.: VSL/QAD/FM/90
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Issue Date: 11.01.2023
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={8} className="section-title text-lg sm:text-xl md:text-2xl font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">
                                                Gel Content Test Report
                                            </td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-sm sm:text-base text-gray-800 dark:text-white">
                                                Rev. No./ Date: 03/ 25.02.2025
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} rowSpan={3}>
                                                <div className="allowable-limit p-2.5 bg-gray-50 dark:bg-gray-900 border-l-4 border-l-blue-500 dark:border-l-blue-400 text-left">
                                                    <strong className="px-2.5 text-gray-800 dark:text-white">Allowable Limit:</strong>
                                                    <div className="checkbox-container flex flex-col sm:flex-row gap-2 mt-2">
                                                        <div className="checkbox-item flex items-center mx-2">
                                                            <label htmlFor="eva-epe-checkbox" className="text-sm text-gray-700 dark:text-gray-300">1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                                            <input 
                                                                type="checkbox" 
                                                                id="eva-epe-checkbox" 
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
                                                                id="poe-checkbox" 
                                                                checked={checkboxValues[checkboxKeys[1]] || false}
                                                                onChange={(e) => handleCheckboxChange(checkboxKeys[1], e.target.checked)}
                                                                className="ml-1 w-4 h-4 dark:accent-blue-500" 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={1} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Inv. No./ Date:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[0]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[0], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Inv. No./ Date"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">P.O. No.:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[1]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[1], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="P.O. No."
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Type of Test:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[2]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[2], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Type of Test"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Laminator Parameter</td>
                                            <td colSpan={1} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Laminator Details:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[3]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[3], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Laminator Details"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Process Name</td>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 1</td>
                                            <td colSpan={3} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 2</td>
                                            <td colSpan={3} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 3 (CP)</td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">MATERIAL INFORMATION (S)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pumping Time (Sec)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[4]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[4], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping Time Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[5]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[5], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping Time Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[6]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[6], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pumping Time Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Encapsulant Types:</td>
                                            <td colSpan={5}>
                                                <div className="checkbox-container flex flex-col sm:flex-row justify-center items-center gap-2 p-2">
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="eva-material-checkbox" className="text-sm text-gray-700 dark:text-gray-300">EVA</label>
                                                        <input 
                                                            type="checkbox" 
                                                            id="eva-material-checkbox" 
                                                            checked={checkboxValues[checkboxKeys[2]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[2], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-blue-500" 
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="epe-material-checkbox" className="text-sm text-gray-700 dark:text-gray-300">EPE</label>
                                                        <input 
                                                            type="checkbox" 
                                                            id="epe-material-checkbox" 
                                                            checked={checkboxValues[checkboxKeys[3]] || false}
                                                            onChange={(e) => handleCheckboxChange(checkboxKeys[3], e.target.checked)}
                                                            className="ml-1 w-4 h-4 dark:accent-blue-500" 
                                                        />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="poe-material-checkbox" className="text-sm text-gray-700 dark:text-gray-300">POE</label>
                                                        <input 
                                                            type="checkbox" 
                                                            id="poe-material-checkbox" 
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
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[7]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[7], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling Time Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[8]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[8], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling Time Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[9]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[9], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Pressing/Cooling Time Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Encapsulant Supplier:</td>
                                            <td colSpan={5} className="p-2 text-center text-gray-800 dark:text-white">FIRST</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Venting Time (Sec)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[10]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[10], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting Time Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[11]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[11], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting Time Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[12]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[12], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Venting Time Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Category:</td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[27]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[27], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Category"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[28]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[28], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Category"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[29]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[29], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Category"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[30]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[30], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Category"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Lower Heating (˚C)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[13]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[13], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Heating Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[14]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[14], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Heating Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[15]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[15], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Heating Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Batch/Lot No.:</td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[31]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[31], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Batch/Lot No."
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[32]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[32], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Batch/Lot No."
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[33]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[33], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Batch/Lot No."
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[34]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[34], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Batch/Lot No."
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Upper Heating (˚C)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[16]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[16], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Heating Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[17]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[17], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Heating Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[18]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[18], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Heating Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">MFG. Date:</td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[35]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[35], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="MFG. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[36]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[36], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="MFG. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[37]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[37], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="MFG. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[38]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[38], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="MFG. Date"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Upper Pressure (Kpa)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[19]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[19], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Pressure Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[20]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[20], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Pressure Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[21]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[21], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Upper Pressure Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Exp. Date:</td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[39]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[39], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Exp. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[40]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[40], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Exp. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[41]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[41], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Exp. Date"
                                                />
                                            </td>
                                            <td colSpan={1}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[42]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[42], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Exp. Date"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Lower Pressure (Kpa)</td>
                                            <td colSpan={2}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[22]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[22], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Pressure Lam-1"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[23]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[23], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Pressure Lam-2"
                                                />
                                            </td>
                                            <td colSpan={3}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[24]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[24], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Lower Pressure Lam-3 (CP)"
                                                />
                                            </td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Size:</td>
                                            <td colSpan={5}>
                                                <input
                                                    type="text"
                                                    value={editableValues[editableFieldKeys[43]] || ''}
                                                    onChange={(e) => handleEditableChange(editableFieldKeys[43], e.target.value)}
                                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                    placeholder="Glass Size"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={16} className="p-2">
                                                <img src="../IMAGES/GelTest.jpg" alt="Gel Test" className="w-full h-auto max-h-[300px] object-contain rounded-md" />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Date, Shift, & Time: </td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Workshop</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Platen Position (A/B/C/D/E/F/G)</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#1</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#2</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#3</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#4</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">#5</td>
                                            <td className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Average (A/B/C/D/E/F/G)</td>
                                            <td colSpan={4} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Mean</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>
                                                <div className="flex flex-col gap-2 p-2">
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
                                                    <input
                                                        type="text"
                                                        value={editableValues[editableFieldKeys[25]] || ''}
                                                        onChange={(e) => handleEditableChange(editableFieldKeys[25], e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                                                        placeholder="Time"
                                                    />
                                                </div>
                                            </td>
                                            <td rowSpan={7} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">VSL FAB-II</td>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">A</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`A_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(0, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(0, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                            <td colSpan={4} rowSpan={7} className="mean-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">B</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`B_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(1, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(1, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">C</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`C_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(2, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(2, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">D</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`D_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(3, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(3, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">E</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`E_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(4, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(4, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">F</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`F_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(5, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(5, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">G</td>
                                            {[0, 1, 2, 3, 4].map(readingIdx => (
                                                <td key={`G_${readingIdx}`} className="p-2 text-center">
                                                    <input
                                                        type="text"
                                                        value={dataValues[getDataCellKey(6, readingIdx)] || ''}
                                                        onChange={(e) => handleDataChange(getDataCellKey(6, readingIdx), e.target.value)}
                                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-center"
                                                        placeholder=""
                                                    />
                                                </td>
                                            ))}
                                            <td className="average-cell font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
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
                                    <p className="font-bold text-gray-800 dark:text-white mb-2">ACCEPTED BY:</p>
                                    <div className="w-full min-h-24 border border-gray-300 dark:border-gray-700 rounded-md flex items-center justify-center">
                                        <div className="text-center relative signature-field p-4 w-full h-full flex items-center justify-center">
                                            <span className="text-gray-800 dark:text-white text-lg font-semibold">{acceptedBySignature}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                                        <button
                                            className={`px-3 py-2 text-sm text-white rounded ${canAddSignature('accepted') ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                            onClick={() => handleAddSignature('accepted')}
                                            disabled={!canAddSignature('accepted')}
                                        >
                                            Add my Signature
                                        </button>
                                        <button
                                            className={`px-3 py-2 text-sm text-white rounded ${canRemoveSignature('accepted') ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                            onClick={() => handleRemoveSignature('accepted')}
                                            disabled={!canRemoveSignature('accepted')}
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
                            <div className="controlled-copy text-center text-lg text-red-500 dark:text-red-400 mt-4">
                                <p>(Controlled Copy)</p>
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