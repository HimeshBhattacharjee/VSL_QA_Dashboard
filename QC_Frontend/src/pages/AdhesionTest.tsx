import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';

interface AdhesionTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean; };
    averages: { [key: string]: string; };
}

export default function AdhesionTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<AdhesionTestReport[]>([]);
    const [reportName, setReportName] = useState('');
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

    const apiService = {
        getAllReports: async (): Promise<AdhesionTestReport[]> => {
            const response = await fetch(`${ADHESION_API_BASE_URL}`);
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
            const response = await fetch(`${ADHESION_API_BASE_URL}`, {
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

    const initializeForm = () => { calculateAverages() };

    const handleEditableCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';
        const oldValue = currentText.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        const handleBlur = () => {
            const newValue = input.value.trim();
            cell.textContent = newValue || ' ';
            if (newValue) cell.classList.add('has-content');
            else cell.classList.remove('has-content');
            if (detectMeaningfulChange(oldValue, newValue)) {
                setHasUnsavedChanges(true);
                saveFormData();
            }
            saveFormData();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') input.blur();
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
    };

    const handleDataCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';
        const oldValue = currentText.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.textAlign = 'center';
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        const handleBlur = () => {
            const value = input.value.trim();
            const isValid = value === '' || !isNaN(parseFloat(value));
            if (isValid) {
                cell.textContent = value || '';
                if (value) cell.classList.add('has-content');
                else cell.classList.remove('has-content');
                calculateAverages();
                if (detectMeaningfulChange(oldValue, value)) {
                    setHasUnsavedChanges(true);
                    saveFormData();
                }
                saveFormData();
            } else {
                showAlert('error', 'Please enter a valid number');
                cell.textContent = currentText || '';
                if (currentText) cell.classList.add('has-content');
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') input.blur();
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
    };

    useEffect(() => {
        if (reportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
        if (reportName !== '') saveFormData();
    }, [reportName]);

    const detectMeaningfulChange = (oldValue: string, newValue: string): boolean => {
        if (!oldValue.trim() && !newValue.trim()) return false;
        return oldValue.trim() !== newValue.trim();
    };

    const calculateAverages = () => {
        // Front Glass to Encapsulant Min (Column B)
        const frontMinCells = document.querySelectorAll('.front-min-cell');
        let frontMinSum = 0;
        let frontMinCount = 0;
        frontMinCells.forEach(cell => {
            const value = cell.textContent?.trim() || '';
            if (value) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    frontMinSum += numValue;
                    frontMinCount++;
                }
            }
        });
        const frontMinAvg = frontMinCount > 0 ? (frontMinSum / frontMinCount).toFixed(2) : '0';
        const frontMinAvgCell = document.querySelector('.front-min-avg');
        if (frontMinAvgCell) frontMinAvgCell.textContent = frontMinAvg;

        // Front Glass to Encapsulant Max (Column C)
        const frontMaxCells = document.querySelectorAll('.front-max-cell');
        let frontMaxSum = 0;
        let frontMaxCount = 0;
        frontMaxCells.forEach(cell => {
            const value = cell.textContent?.trim() || '';
            if (value) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    frontMaxSum += numValue;
                    frontMaxCount++;
                }
            }
        });
        const frontMaxAvg = frontMaxCount > 0 ? (frontMaxSum / frontMaxCount).toFixed(2) : '0';
        const frontMaxAvgCell = document.querySelector('.front-max-avg');
        if (frontMaxAvgCell) frontMaxAvgCell.textContent = frontMaxAvg;

        // Backsheet to Encapsulant Min (Column D)
        const backMinCells = document.querySelectorAll('.back-min-cell');
        let backMinSum = 0;
        let backMinCount = 0;
        backMinCells.forEach(cell => {
            const value = cell.textContent?.trim() || '';
            if (value) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    backMinSum += numValue;
                    backMinCount++;
                }
            }
        });
        const backMinAvg = backMinCount > 0 ? (backMinSum / backMinCount).toFixed(2) : '0';
        const backMinAvgCell = document.querySelector('.back-min-avg');
        if (backMinAvgCell) backMinAvgCell.textContent = backMinAvg;

        // Backsheet to Encapsulant Max (Column E)
        const backMaxCells = document.querySelectorAll('.back-max-cell');
        let backMaxSum = 0;
        let backMaxCount = 0;
        backMaxCells.forEach(cell => {
            const value = cell.textContent?.trim() || '';
            if (value) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    backMaxSum += numValue;
                    backMaxCount++;
                }
            }
        });
        const backMaxAvg = backMaxCount > 0 ? (backMaxSum / backMaxCount).toFixed(2) : '0';
        const backMaxAvgCell = document.querySelector('.back-max-avg');
        if (backMaxAvgCell) backMaxAvgCell.textContent = backMaxAvg;
    };

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
            setReportName(fullReport.name);
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
        setReportName(report.name);

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            const key = `editable_${index}`;
            if (report.formData[key] !== undefined) {
                const value = report.formData[key] as string;
                cell.textContent = value;
                if (value.trim()) cell.classList.add('has-content');
                else cell.classList.remove('has-content');
            }
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach((cell, index) => {
            const key = `data_${index}`;
            if (report.formData[key] !== undefined) {
                const value = report.formData[key] as string;
                cell.textContent = value;
                if (value.trim()) cell.classList.add('has-content');
                else cell.classList.remove('has-content');
            }
        });

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

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach((cell, index) => {
            formData[`data_${index}`] = cell.textContent?.trim() || '';
        });

        formData.preparedBySignature = preparedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = reportName;

        sessionStorage.setItem('adhesionTestFormData', JSON.stringify(formData));
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('adhesionTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);

            if (formData.reportName !== undefined) setReportName(formData.reportName);

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                const key = `editable_${index}`;
                if (formData[key] !== undefined) {
                    cell.textContent = formData[key] as string;
                    if ((formData[key] as string).trim()) cell.classList.add('has-content');
                }
            });

            const dataCells = document.querySelectorAll('.data-cell');
            dataCells.forEach((cell, index) => {
                const key = `data_${index}`;
                if (formData[key] !== undefined) {
                    cell.textContent = formData[key] as string;
                    if ((formData[key] as string).trim()) cell.classList.add('has-content');
                }
            });

            if (formData.preparedBySignature !== undefined) {
                setPreparedBySignature(formData.preparedBySignature as string);
            }
            if (formData.verifiedBySignature !== undefined) {
                setVerifiedBySignature(formData.verifiedBySignature as string);
            }

            setTimeout(() => {
                calculateAverages();
            }, 100);

            setHasUnsavedChanges(true);
        }
    };

    const clearFormData = (clearEditingState = true) => {
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('has-content');
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('has-content');
        });

        setPreparedBySignature('');
        setVerifiedBySignature('');

        if (clearEditingState) {
            setReportName('');
            sessionStorage.removeItem('editingReportId');
            sessionStorage.removeItem('editingReportData');
        }

        // Reset average cells
        const avgCells = document.querySelectorAll('.front-min-avg, .front-max-avg, .back-min-avg, .back-max-avg');
        avgCells.forEach(cell => {
            cell.textContent = '0';
        });

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
        if (!reportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }

        try {
            setIsLoading(true);

            const averages: { [key: string]: string } = {};

            const frontMinAvgCell = document.querySelector('.front-min-avg');
            averages.frontMinAvg = frontMinAvgCell?.textContent?.trim() || '0';

            const frontMaxAvgCell = document.querySelector('.front-max-avg');
            averages.frontMaxAvg = frontMaxAvgCell?.textContent?.trim() || '0';

            const backMinAvgCell = document.querySelector('.back-min-avg');
            averages.backMinAvg = backMinAvgCell?.textContent?.trim() || '0';

            const backMaxAvgCell = document.querySelector('.back-max-avg');
            averages.backMaxAvg = backMaxAvgCell?.textContent?.trim() || '0';

            const reportData: Omit<AdhesionTestReport, '_id'> = {
                name: reportName,
                timestamp: new Date().toISOString(),
                formData: {},
                averages: averages,
            };

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                reportData.formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const dataCells = document.querySelectorAll('.data-cell');
            dataCells.forEach((cell, index) => {
                reportData.formData[`data_${index}`] = cell.textContent?.trim() || '';
            });

            reportData.formData.preparedBySignature = preparedBySignature;
            reportData.formData.verifiedBySignature = verifiedBySignature;

            const editingId = sessionStorage.getItem('editingReportId');

            if (editingId) {
                const existingReport = await apiService.getReportById(editingId);
                if (reportName === existingReport.name) {
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    const nameExists = await apiService.checkReportNameExists(reportName, editingId);
                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${reportName}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                                const allReports = await apiService.getAllReports();
                                const existingReportWithSameName = allReports.find(report => report.name === reportName);
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
                const nameExists = await apiService.checkReportNameExists(reportName);
                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${reportName}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                            const allReports = await apiService.getAllReports();
                            const existingReport = allReports.find(report => report.name === reportName);
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

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const dataCells = document.querySelectorAll('.data-cell');
            dataCells.forEach((cell, index) => {
                formData[`data_${index}`] = cell.textContent?.trim() || '';
            });

            formData.preparedBySignature = preparedBySignature;
            formData.verifiedBySignature = verifiedBySignature;

            const averages: { [key: string]: string } = {};

            const frontMinAvgCell = document.querySelector('.front-min-avg');
            averages.frontMinAvg = frontMinAvgCell?.textContent?.trim() || '0';

            const frontMaxAvgCell = document.querySelector('.front-max-avg');
            averages.frontMaxAvg = frontMaxAvgCell?.textContent?.trim() || '0';

            const backMinAvgCell = document.querySelector('.back-min-avg');
            averages.backMinAvg = backMinAvgCell?.textContent?.trim() || '0';

            const backMaxAvgCell = document.querySelector('.back-max-avg');
            averages.backMaxAvg = backMaxAvgCell?.textContent?.trim() || '0';

            const adhesionReportData = {
                report_name: reportName.trim() || 'Adhesion_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: formData,
                averages: averages,
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
            a.download = `${reportName.trim() || 'Adhesion_Test_Report'}.xlsx`;
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
        const editableCells = document.querySelectorAll('.editable:not(.data-cell)');
        editableCells.forEach(cell => {
            cell.addEventListener('click', handleEditableCellClick);
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach(cell => {
            cell.addEventListener('click', handleDataCellClick);
        });

        return () => {
            editableCells.forEach(cell => {
                cell.removeEventListener('click', handleEditableCellClick);
            });
            dataCells.forEach(cell => {
                cell.removeEventListener('click', handleDataCellClick);
            });
        };
    }, []);

    useEffect(() => {
        if (reportName.trim() && !hasUnsavedChanges) setHasUnsavedChanges(true);
    }, [reportName]);

    return (
        <>
            <div className="container mx-auto">
                <div className="text-center mb-6">
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
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                className="report-name-input p-2.5 rounded-md bg-white dark:bg-gray-800 border-2 border-[rgba(48,30,107,0.3)] dark:border-gray-600 w-full sm:w-[50%] text-center text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                                <img src="../LOGOS/VSL_Logo (1).png" height={70} alt="VSL Logo" className="mx-auto" />
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
                                                    <strong className="px-2 text-gray-800 dark:text-white">Allowable Limit:</strong>
                                                    <span className="text-gray-700 dark:text-gray-300"> (Glass to Encapsulant ≥ 60N/cm & Backsheet to Encapsulant ≥ 40N/cm)</span>
                                                </div>
                                            </td>
                                            <td colSpan={1} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Type of Test:</td>
                                            <td colSpan={5} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Date:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Shift:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">P.O.:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Room Temp (°C):</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">RH %:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Laminator:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lamination Position:</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">LAMINATION PARAMETER</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Chamber :</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 1</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 2</td>
                                            <td colSpan={4} className="p-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">Lam - 3</td>
                                        </tr>

                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Set Temp. (°C) :</td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>

                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pumping time (Sec) :</td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>

                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Pressing /Cooling time (Sec) :</td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>

                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Venting time (Sec) :</td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>

                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Process time (Sec) :</td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">RAW MATERIAL DETAILS</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Encapsulant Supplier :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Encapsulant Type :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Encapsulant Supplier :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Encapsulant Type :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Back Sheet Supplier :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Supplier :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Glass Size :</td>
                                            <td colSpan={12} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={14} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">ADHESION STRENGTH</td>
                                        </tr>
                                        <tr>
                                            <td rowSpan={2} colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Position</td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Front Glass to Encapsulant (N/cm)</td>
                                            <td colSpan={6} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Backsheet/ Back Glass to Encapsulant (N/cm)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Min</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Max</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Min</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">Max</td>
                                        </tr>
                                        {[1, 2, 3, 4, 5].map(pos => (
                                            <tr key={pos}>
                                                <td colSpan={2} className="p-2 text-center bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-bold">{pos}</td>
                                                <td colSpan={3} className="editable data-cell front-min-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2 text-center"></td>
                                                <td colSpan={3} className="editable data-cell front-max-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2 text-center"></td>
                                                <td colSpan={3} className="editable data-cell back-min-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2 text-center"></td>
                                                <td colSpan={3} className="editable data-cell back-max-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out dark:text-white hover:border-blue-500 dark:hover:border-blue-400 p-2 text-center"></td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 dark:bg-gray-700 text-center p-2 text-gray-800 dark:text-white">AVERAGE</td>
                                            <td colSpan={3} className="front-min-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                            <td colSpan={3} className="front-max-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                            <td colSpan={3} className="back-min-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                            <td colSpan={3} className="back-max-avg font-bold bg-gray-50 dark:bg-gray-900 p-2 text-center text-gray-800 dark:text-white">0</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Signatures Footer */}
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